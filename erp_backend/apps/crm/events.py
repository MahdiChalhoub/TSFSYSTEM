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
        'subscription:payment_created': _on_subscription_payment_created,
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
        
        # Create client contact in SaaS org's CRM
        client_contact = Contact.objects.create(
            organization=saas_org,
            type='CUSTOMER',
            customer_type='B2B',
            name=f"{org_name} (Tenant)",
            email=f"billing@{org_slug}.tsf-city.com",
            is_airsi_subject=False,
            balance=Decimal('0.00'),
            credit_limit=Decimal('0.00')
        )
        
        # Link the billing contact back to the new organization
        new_org = Organization.objects.filter(id=org_id).first()
        if new_org:
            new_org.billing_contact_id = client_contact.id
            new_org.save(update_fields=['billing_contact_id'])
        
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


def _on_subscription_payment_created(payload: dict, organization_id: int) -> dict:
    """
    React to a subscription payment — update billing contact balance.
    
    When a plan change creates payment records, the billing contact's
    balance should reflect the outstanding amount:
    - PURCHASE: increases balance (tenant owes more)
    - CREDIT_NOTE: decreases balance (credit applied)
    
    Contact lookup: Organization → SaaSClient (org.client) → Contact
    (matched by email in SaaS org, customer_type='SAAS').
    """
    from .models import Contact
    from erp.models import Organization
    
    org_id = payload.get('org_id')
    amount_str = payload.get('amount', '0')
    payment_type = payload.get('type')  # PURCHASE or CREDIT_NOTE
    plan_name = payload.get('plan_name', 'Unknown')
    
    if not org_id or not payment_type:
        logger.debug("CRM: subscription:payment_created missing org_id or type")
        return {'success': True, 'skipped': True}
    
    amount = Decimal(str(amount_str))
    if amount <= 0:
        return {'success': True, 'skipped': True, 'reason': 'zero_amount'}
    
    # Find the tenant org and its SaaS client
    org = Organization.objects.filter(id=org_id).select_related('client').first()
    if not org or not org.client:
        logger.debug(f"CRM: No SaaS client linked for org {org_id}")
        return {'success': True, 'skipped': True, 'reason': 'no_saas_client'}
    
    # Find the CRM contact in the SaaS org by the client's email
    saas_org = Organization.objects.filter(slug='saas').first()
    if not saas_org:
        logger.debug("CRM: No SaaS master org found")
        return {'success': True, 'skipped': True, 'reason': 'no_saas_org'}
    
    contact = Contact.objects.filter(
        organization=saas_org,
        email=org.client.email,
        customer_type='SAAS'
    ).first()
    
    if not contact:
        logger.warning(f"CRM: No billing contact found for client '{org.client.email}'")
        return {'success': False, 'error': 'Billing contact not found'}
    
    try:
        old_balance = contact.balance or Decimal('0.00')
        
        if payment_type == 'PURCHASE':
            contact.balance = old_balance + amount
        elif payment_type == 'CREDIT_NOTE':
            contact.balance = old_balance - amount
        else:
            logger.debug(f"CRM: Ignoring unknown payment type '{payment_type}'")
            return {'success': True, 'skipped': True}
        
        contact.save(update_fields=['balance'])
        
        logger.info(
            f"✅ CRM: Updated billing contact '{contact.name}' balance: "
            f"${old_balance} → ${contact.balance} ({payment_type} ${amount}, plan: {plan_name})"
        )
        
        return {
            'success': True,
            'contact_id': str(contact.id),
            'old_balance': str(old_balance),
            'new_balance': str(contact.balance),
        }
        
    except Exception as e:
        logger.error(f"CRM: Failed to update billing contact balance: {e}")
        return {'success': False, 'error': str(e)}
