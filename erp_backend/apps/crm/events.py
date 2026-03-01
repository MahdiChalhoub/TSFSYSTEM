"""
CRM Module Event Handlers
==============================
Receives inter-module events routed by the ConnectorEngine.

The ConnectorEngine discovers this module via:
    importlib.import_module('apps.crm.events')
    
And calls handle_event() for each subscribed event.

To subscribe to events, register them in your ModuleContract's
`needs.events_from` JSON field.
"""

import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, organization_id: int):
    """
    Main event handler for the CRM module.
    
    Called by ConnectorEngine._deliver_event when an event is
    routed to this module.
    
    Args:
        event_name: The event identifier (e.g., 'org:provisioned')
        payload: Event data dictionary
        organization_id: The tenant context
    """
    handlers = {
        'org:provisioned': _on_org_provisioned,
        'subscription:updated': _on_subscription_updated,
        'order:completed': _on_order_completed,
        'purchase_order:completed': _on_purchase_order_completed,
    }
    
    handler = handlers.get(event_name)
    if handler:
        return handler(payload, organization_id)
    else:
        logger.debug(f"CRM module: unhandled event '{event_name}'")
        return None


def _on_org_provisioned(payload: dict, organization_id: int) -> dict:
    """
    React to a new organization being provisioned.
    
    Creates a client Contact in the SaaS master org's CRM
    so the new tenant can be billed and managed.
    
    Flow:
        1. Kernel emits 'org:provisioned' with new org details
        2. CRM creates a Contact (type=CUSTOMER) in the SaaS org
        3. CRM updates the new org's billing_contact_id
        4. CRM returns the contact_id for downstream consumers (Finance → ledger account)
    
    The ConnectorEngine will pass the returned dict to any dependent
    chained events (e.g., Finance's `contact:created` handler).
    """
    from .models import Contact
    from erp.models import Organization
    
    org_slug = payload.get('org_slug')
    org_name = payload.get('org_name')
    org_id = payload.get('org_id')
    
    if not org_slug or not org_name or not org_id:
        logger.error("CRM: org:provisioned event missing required fields (org_slug, org_name, org_id)")
        return {'success': False, 'error': 'Missing required payload fields'}
    
    # Only create SaaS billing contact for non-SaaS orgs
    if org_slug == 'saas':
        logger.info("CRM: Skipping SaaS master org — no self-billing contact needed")
        return {'success': True, 'skipped': True}
    
    try:
        # Find the SaaS master org to create the contact under
        saas_org = Organization.objects.filter(slug='saas').first()
        if not saas_org:
            logger.warning("CRM: No SaaS master org found — cannot create billing contact")
            return {'success': False, 'error': 'SaaS master org not found'}
        
        # Create/Update client contact in SaaS org's CRM
        client_contact, created = Contact.objects.update_or_create(
            email=f"billing@{org_slug}.tsf-city.com",
            organization=saas_org,
            defaults={
                'type': 'CUSTOMER',
                'customer_type': 'B2B',
                'name': f"{org_name} (Tenant)",
                'is_airsi_subject': False,
                'balance': Decimal('0.00'),
                'credit_limit': Decimal('0.00')
            }
        )
        
        # The billing contact is now strictly resolved via the SaaSClient relationship
        # No direct field 'billing_contact_id' exists on Organization.
        logger.info(
            f"✅ CRM: Created billing contact '{client_contact.name}' "
            f"(id={client_contact.id}) in SaaS org for tenant '{org_slug}'"
        )
        
        # Return result for chained events (Finance will use contact_id)
        return {
            'success': True,
            'contact_id': client_contact.id,
            'contact_name': client_contact.name,
            'saas_org_id': str(saas_org.id),
            'tenant_org_id': org_id,
        }
        
    except Exception as e:
        logger.error(f"CRM: Failed to create billing contact for '{org_slug}': {e}")
        return {'success': False, 'error': str(e)}


def _on_subscription_updated(payload: dict, organization_id: int):
    """
    React to subscription updates — update Contact balance.
    Triggered by SaaS layer when a tenant changes their plan.
    """
    from .models import Contact
    from erp.models import Organization
    
    amount = Decimal(str(payload.get('amount', '0')))
    txn_type = payload.get('type') # PURCHASE or CREDIT_NOTE
    target_org_id = payload.get('target_org_id')

    if amount <= 0:
        return {'success': True, 'skipped': True}

    try:
        # 1. Identify context (should be SaaS org)
        saas_org = Organization.objects.filter(slug='saas').first()
        if not saas_org:
            logger.error("CRM: SaaS master org not found.")
            return {'success': False, 'error': "SaaS org not found"}

        # 2. Find tenant organization and its client
        target_org = Organization.objects.filter(id=target_org_id).select_related('client').first()
        if not target_org or not target_org.client:
            logger.warning(f"CRM: No client found for tenant {target_org_id}. Balance sync skipped.")
            return {'success': True, 'skipped': True, 'reason': 'No client linked'}

        # 3. Resolve Contact via Client email
        contact = Contact.objects.filter(organization=saas_org, email=target_org.client.email).first()
        
        if not contact:
            logger.warning(f"CRM: No CRM contact found for client {target_org.client.email}. Sync skipped.")
            return {'success': True, 'skipped': True, 'reason': 'Contact not found'}

        # 4. Update Contact balance
        old_balance = contact.balance
        if txn_type == 'PURCHASE':
            contact.balance += amount
        else: # CREDIT_NOTE
            contact.balance -= amount
            
        contact.save(update_fields=['balance', 'updated_at'])
        
        logger.info(
            f"✅ CRM: Updated balance for contact '{contact.name}' "
            f"({old_balance} -> {contact.balance}) for subscription {txn_type}"
        )
        return {
            'success': True,
            'contact_id': str(contact.id),
            'old_balance': str(old_balance),
            'new_balance': str(contact.balance)
        }
        
    except Exception as e:
        logger.error(f"CRM: Failed to process subscription update: {e}")
        return {'success': False, 'error': str(e)}


def _on_order_completed(payload: dict, organization_id: int):
    """
    React to POS order completion — update customer analytics.
    """
    from .models import Contact
    from django.utils import timezone
    from erp.models import Organization
    
    order_id = payload.get('order_id')
    order_type = payload.get('type')
    contact_id = payload.get('contact_id')
    total_amount = Decimal(str(payload.get('total_amount', '0')))
    
    if not contact_id or order_type != 'SALE':
        return {'success': True, 'skipped': True}
        
    try:
        contact = Contact.objects.get(pk=contact_id, organization_id=organization_id)
        
        # Update analytics fields
        contact.total_orders += 1
        contact.lifetime_value += total_amount

        now = timezone.now()
        if not contact.first_purchase_date:
            contact.first_purchase_date = now
        contact.last_purchase_date = now

        # Recalculate average
        contact.recalculate_analytics()

        contact.save(update_fields=[
            'total_orders', 'lifetime_value',
            'first_purchase_date', 'last_purchase_date',
            'average_order_value', 'updated_at'
        ])
        
        logger.info(f"📈 CRM: Analytics updated for contact {contact.id}")
        return {'success': True}
        
    except Contact.DoesNotExist:
        logger.warning(f"CRM: Contact {contact_id} not found in org {organization_id}")
        return {'success': False, 'error': "Contact not found"}
    except Exception as e:
        logger.error(f"CRM: Failed to update analytics: {e}")
        return {'success': False, 'error': str(e)}


def _on_purchase_order_completed(payload: dict, organization_id: int):
    """
    React to PO completion — update supplier performance metrics.
    """
    from .models import Contact
    from django.utils import timezone
    from datetime import datetime
    
    supplier_id = payload.get('supplier_id')
    total_amount = Decimal(str(payload.get('total_amount', '0')))
    order_date_str = payload.get('order_date')
    
    if not supplier_id:
        return {'success': True, 'skipped': True}
        
    try:
        supplier = Contact.objects.get(pk=supplier_id, organization_id=organization_id)
        
        supplier.supplier_total_orders += 1
        supplier.total_purchase_amount += total_amount

        # Calculate lead time if order date is known
        if order_date_str:
            order_date = datetime.fromisoformat(order_date_str).date()
            days = (timezone.now().date() - order_date).days
            
            if supplier.avg_lead_time_days > 0:
                # Rolling average
                n = supplier.supplier_total_orders
                supplier.avg_lead_time_days = (
                    (supplier.avg_lead_time_days * (n - 1) + days) / n
                )
            else:
                supplier.avg_lead_time_days = days

        supplier.recalculate_supplier_rating()
        supplier.save(update_fields=[
            'supplier_total_orders', 'total_purchase_amount',
            'avg_lead_time_days', 'overall_rating', 'updated_at'
        ])
        
        logger.info(f"🏗️ CRM: Supplier metrics updated for contact {supplier.id}")
        return {'success': True}
        
    except Contact.DoesNotExist:
        logger.warning(f"CRM: Supplier contact {supplier_id} not found")
        return {'success': False, 'error': "Supplier not found"}
    except Exception as e:
        logger.error(f"CRM: Failed to update supplier metrics: {e}")
        return {'success': False, 'error': str(e)}
