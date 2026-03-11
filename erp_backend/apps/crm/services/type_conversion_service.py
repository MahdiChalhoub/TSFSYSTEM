"""
Contact Type Conversion Service
================================
Implements §18.3 — Safe type conversion with validation and COA re-linking.
"""
from django.db import transaction
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class ContactTypeConversionService:
    """
    Safely convert a contact from one type to another,
    handling COA re-linking and validation per §18.3.
    """

    # Allowed type transition matrix (§18.3)
    ALLOWED_CONVERSIONS = {
        'LEAD':     {'CUSTOMER', 'CONTACT', 'SUPPLIER'},
        'CONTACT':  {'CUSTOMER', 'SUPPLIER', 'SERVICE', 'CREDITOR', 'DEBTOR'},
        'CUSTOMER': {'BOTH'},
        'SUPPLIER': {'BOTH'},
        'BOTH':     {'CUSTOMER', 'SUPPLIER'},
        'SERVICE':  {'SUPPLIER', 'BOTH'},
        'CREDITOR': {'SUPPLIER'},
        'DEBTOR':   {'CUSTOMER'},
    }

    # Types that CANNOT be converted without admin override
    RESTRICTED_STATUSES = {'MERGED', 'ARCHIVED'}

    @classmethod
    def validate_conversion(cls, contact, new_type):
        """Validate whether conversion is allowed."""
        errors = []

        if contact.status in cls.RESTRICTED_STATUSES:
            errors.append(f'{contact.status} contacts cannot be type-converted.')

        allowed = cls.ALLOWED_CONVERSIONS.get(contact.type, set())
        if new_type not in allowed:
            errors.append(
                f'Conversion {contact.type} → {new_type} is not allowed. '
                f'Allowed: {", ".join(sorted(allowed)) if allowed else "none"}.'
            )

        if new_type == contact.type:
            errors.append('Contact already has this type.')

        return errors

    @classmethod
    @transaction.atomic
    def convert(cls, contact, new_type, reason='', actor_user_id=None, actor_name=None):
        """
        Execute type conversion with COA re-linking if needed.
        """
        from apps.crm.models import ContactAuditLog

        errors = cls.validate_conversion(contact, new_type)
        if errors:
            return {'success': False, 'errors': errors}

        old_type = contact.type
        contact.type = new_type

        # Handle COA re-linking for transactional type changes
        coa_result = None
        if new_type in contact.TRANSACTIONAL_TYPES and old_type not in contact.TRANSACTIONAL_TYPES:
            # Newly transactional — needs COA linking
            coa_result = cls._attempt_coa_link(contact)
        elif new_type == 'BOTH' and old_type in ('CUSTOMER', 'SUPPLIER'):
            # Upgrading to BOTH — may need secondary account
            coa_result = cls._attempt_dual_link(contact, old_type)

        contact.save(update_fields=['type', 'updated_at'])

        # Audit trail
        ContactAuditLog.log_change(
            contact=contact, action='FIELD_CHANGE',
            field_name='type',
            old_value=old_type, new_value=new_type,
            reason=reason or f'Type converted {old_type} → {new_type}',
            source='API',
            actor_user_id=actor_user_id,
            actor_name=actor_name,
        )

        # Emit event for Global Scoring Engine (WISE)
        try:
            from kernel.events import emit_event
            emit_event(
                event_type='contact.type_converted',
                payload={
                    'contact_id': contact.id,
                    'old_type': old_type,
                    'new_type': new_type,
                    'user_id': actor_user_id,
                    'contact_name': contact.name,
                    'tenant_id': contact.tenant_id
                },
                aggregate_type='crm.contact',
                aggregate_id=contact.id
            )
        except Exception:
            pass

        return {
            'success': True,
            'old_type': old_type,
            'new_type': new_type,
            'coa_result': coa_result,
        }

    @classmethod
    def _attempt_coa_link(cls, contact):
        """Attempt to create COA sub-account for newly-transactional contact."""
        try:
            from erp.models import Organization
            from erp.services import ConfigurationService
            from apps.finance.models import ChartOfAccount
            from apps.finance.services import LedgerService

            org = Organization.objects.get(pk=contact.tenant_id)
            mapping = contact.COA_MAPPING.get(contact.type)
            if not mapping:
                return {'status': 'N_A', 'message': 'No COA mapping for this type'}

            cat1, key1, cat2, key2, sub_type = mapping
            posting_rules = ConfigurationService.get_posting_rules(org)
            parent_id = (
                posting_rules.get(cat1, {}).get(key1) or
                posting_rules.get(cat2, {}).get(key2)
            )

            if not parent_id:
                contact.finance_link_status = 'FAILED'
                return {'status': 'FAILED', 'message': 'No posting rule configured'}

            try:
                parent = ChartOfAccount.objects.get(pk=parent_id, tenant=org)
            except ChartOfAccount.DoesNotExist:
                contact.finance_link_status = 'FAILED'
                return {'status': 'FAILED', 'message': 'Parent account not found'}

            sub = LedgerService.get_or_create_sub_account(
                tenant=org, parent=parent,
                sub_name=contact.name, sub_type=sub_type,
            )
            contact.linked_account_id = sub.id
            contact.finance_link_status = 'LINKED'
            return {'status': 'LINKED', 'account_id': sub.id, 'account_name': sub.name}

        except Exception as e:
            contact.finance_link_status = 'PENDING'
            return {'status': 'PENDING', 'message': str(e)[:200]}

    @classmethod
    def _attempt_dual_link(cls, contact, old_type):
        """For BOTH contacts, ensure both AR and AP accounts exist."""
        try:
            from erp.models import Organization
            from erp.services import ConfigurationService
            from apps.finance.models import ChartOfAccount
            from apps.finance.services import LedgerService

            org = Organization.objects.get(pk=contact.tenant_id)
            posting_rules = ConfigurationService.get_posting_rules(org)

            # If was CUSTOMER, already has AR → create AP
            if old_type == 'CUSTOMER':
                ap_parent_id = (
                    posting_rules.get('automation', {}).get('supplierRoot') or
                    posting_rules.get('purchases', {}).get('payable')
                )
                if ap_parent_id:
                    parent = ChartOfAccount.objects.get(pk=ap_parent_id, tenant=org)
                    sub = LedgerService.get_or_create_sub_account(
                        tenant=org, parent=parent,
                        sub_name=contact.name, sub_type='PAYABLE',
                    )
                    contact.linked_payable_account_id = sub.id
                    return {'status': 'LINKED', 'secondary_account_id': sub.id}

            # If was SUPPLIER, already has AP → create AR
            elif old_type == 'SUPPLIER':
                ar_parent_id = (
                    posting_rules.get('automation', {}).get('customerRoot') or
                    posting_rules.get('sales', {}).get('receivable')
                )
                if ar_parent_id:
                    parent = ChartOfAccount.objects.get(pk=ar_parent_id, tenant=org)
                    sub = LedgerService.get_or_create_sub_account(
                        tenant=org, parent=parent,
                        sub_name=contact.name, sub_type='RECEIVABLE',
                    )
                    # Swap: current linked_account_id is AP, new one is AR
                    contact.linked_payable_account_id = contact.linked_account_id
                    contact.linked_account_id = sub.id
                    return {'status': 'LINKED', 'primary_account_id': sub.id}

            return {'status': 'N_A'}

        except Exception as e:
            return {'status': 'PENDING', 'message': str(e)[:200]}
