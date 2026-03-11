"""
Contact Merge Service
=====================
Full merge workflow per §21 of CRM documentation.
Handles: dependent reassignment, audit trail, validation, and conflict detection.
"""
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class ContactMergeService:
    """
    Merges a source contact into a target (surviving master) contact.

    Steps:
    1. Pre-merge validation (§21.5 restricted cases)
    2. Reassign dependent records (orders, payments, balances, pricing rules)
    3. Merge data fields (loyalty points, tags, people, etc.)
    4. Mark source as MERGED with pointer to target
    5. Create audit trail entries on both contacts
    """

    # Contact type conversion allowed during merge
    ALLOWED_TYPE_PROMOTIONS = {
        ('CUSTOMER', 'SUPPLIER'): 'BOTH',
        ('SUPPLIER', 'CUSTOMER'): 'BOTH',
        ('LEAD', 'CUSTOMER'): 'CUSTOMER',
        ('LEAD', 'SUPPLIER'): 'SUPPLIER',
        ('CONTACT', 'CUSTOMER'): 'CUSTOMER',
        ('CONTACT', 'SUPPLIER'): 'SUPPLIER',
    }

    @classmethod
    def validate_merge(cls, source, target):
        """
        Pre-merge validation. Returns list of warnings/blockers.
        """
        issues = []

        if source.id == target.id:
            issues.append({'severity': 'BLOCKER', 'message': 'Cannot merge a contact into itself.'})

        if source.organization_id != target.organization_id:
            issues.append({'severity': 'BLOCKER', 'message': 'Contacts belong to different organizations.'})

        if source.status == 'MERGED':
            issues.append({'severity': 'BLOCKER', 'message': f'Source is already MERGED into #{source.merged_into_contact_id}.'})

        if target.status in ('ARCHIVED', 'MERGED'):
            issues.append({'severity': 'BLOCKER', 'message': f'Target is {target.status} — cannot merge into it.'})

        # §21.5 — Restricted cases requiring admin review
        if source.linked_account_id and target.linked_account_id and source.linked_account_id != target.linked_account_id:
            issues.append({
                'severity': 'WARNING',
                'message': 'Both contacts have different linked finance accounts. Post-merge reconciliation will be required.',
                'field': 'linked_account_id',
            })

        if source.vat_id and target.vat_id and source.vat_id != target.vat_id:
            issues.append({
                'severity': 'WARNING',
                'message': f'Different VAT IDs: source={source.vat_id}, target={target.vat_id}.',
                'field': 'vat_id',
            })

        if source.tax_profile_id and target.tax_profile_id and source.tax_profile_id != target.tax_profile_id:
            issues.append({
                'severity': 'WARNING',
                'message': 'Different tax profiles assigned.',
                'field': 'tax_profile_id',
            })

        return issues

    @classmethod
    @transaction.atomic
    def merge(cls, source, target, reason='', actor_user_id=None, actor_name=None,
              merge_loyalty=True, merge_tags=True, merge_people=True,
              reassign_orders=True, reassign_payments=True, reassign_pricing=True):
        """
        Execute the full merge of source → target.

        Returns dict with merge results and reassignment counts.
        """
        from apps.crm.models import ContactAuditLog

        # Validate first
        issues = cls.validate_merge(source, target)
        blockers = [i for i in issues if i['severity'] == 'BLOCKER']
        if blockers:
            return {
                'success': False,
                'error': 'Merge blocked by validation.',
                'issues': blockers,
            }

        org_id = source.organization_id
        result = {
            'source_id': source.id,
            'target_id': target.id,
            'reassigned': {},
            'merged_data': {},
            'warnings': [i for i in issues if i['severity'] == 'WARNING'],
        }

        # ── 1. Type promotion ──
        if source.type != target.type:
            key = (target.type, source.type)
            promoted = cls.ALLOWED_TYPE_PROMOTIONS.get(key)
            if promoted:
                old_type = target.type
                target.type = promoted
                result['merged_data']['type_promoted'] = f'{old_type} → {promoted}'

        # ── 2. Reassign Orders ──
        if reassign_orders:
            try:
                from apps.pos.models import Order
                count = Order.objects.filter(
                    tenant_id=org_id, contact=source
                ).update(contact=target)
                result['reassigned']['orders'] = count
            except Exception as e:
                logger.warning(f"[Merge] Order reassignment failed: {e}")
                result['reassigned']['orders'] = f'FAILED: {str(e)[:100]}'

        # ── 3. Reassign Payments ──
        if reassign_payments:
            try:
                from apps.finance.payment_models import Payment
                count = Payment.objects.filter(
                    tenant_id=org_id, contact=source
                ).update(contact=target)
                result['reassigned']['payments'] = count
            except Exception as e:
                logger.warning(f"[Merge] Payment reassignment failed: {e}")
                result['reassigned']['payments'] = f'FAILED: {str(e)[:100]}'

            # Reassign balance records
            for BalanceModel in cls._get_balance_models():
                try:
                    count = BalanceModel.objects.filter(
                        tenant_id=org_id, contact=source
                    ).update(contact=target)
                    result['reassigned'][f'balance.{BalanceModel.__name__}'] = count
                except Exception:
                    pass

        # ── 4. Reassign Pricing Rules ──
        if reassign_pricing:
            try:
                from apps.crm.models import ClientPriceRule, PriceGroupMember
                rule_count = ClientPriceRule.objects.filter(
                    tenant_id=org_id, contact=source
                ).update(contact=target)
                result['reassigned']['pricing_rules'] = rule_count

                member_count = PriceGroupMember.objects.filter(
                    tenant_id=org_id, contact=source
                ).update(contact=target)
                result['reassigned']['price_group_memberships'] = member_count
            except Exception as e:
                logger.warning(f"[Merge] Pricing reassignment failed: {e}")

        # ── 5. Merge Loyalty Points ──
        if merge_loyalty and source.loyalty_points > 0:
            old_points = target.loyalty_points
            target.loyalty_points += source.loyalty_points
            result['merged_data']['loyalty_points'] = {
                'source_had': source.loyalty_points,
                'target_before': old_points,
                'target_after': target.loyalty_points,
            }
            # Also merge lifetime_value
            target.lifetime_value += source.lifetime_value
            target.total_orders += source.total_orders

        # ── 6. Merge Tags ──
        if merge_tags:
            source_tags = set(source.tags.values_list('id', flat=True))
            target_tags = set(target.tags.values_list('id', flat=True))
            new_tags = source_tags - target_tags
            if new_tags:
                target.tags.add(*new_tags)
                result['merged_data']['tags_added'] = len(new_tags)

        # ── 7. Migrate People (ContactPerson) ──
        if merge_people:
            try:
                from apps.crm.models import ContactPerson
                people_count = ContactPerson.objects.filter(
                    contact=source
                ).update(contact=target)
                result['reassigned']['people'] = people_count
            except Exception:
                pass

        # ── 8. Fill missing fields on target from source ──
        fields_to_fill = [
            'email', 'phone', 'address', 'website', 'vat_id',
            'company_name', 'whatsapp_group_id', 'notes',
        ]
        filled = []
        for field in fields_to_fill:
            source_val = getattr(source, field)
            target_val = getattr(target, field)
            if source_val and not target_val:
                setattr(target, field, source_val)
                filled.append(field)
        if filled:
            result['merged_data']['fields_filled'] = filled

        # ── 9. Merge supplier performance ──
        if source.type in ('SUPPLIER', 'BOTH', 'SERVICE') and source.total_ratings > 0:
            target.supplier_total_orders += source.supplier_total_orders
            target.on_time_deliveries += source.on_time_deliveries
            target.late_deliveries += source.late_deliveries
            target.total_purchase_amount += source.total_purchase_amount

        # ── 10. Mark source as MERGED ──
        source.status = 'MERGED'
        source.is_active = False
        source.merged_into_contact_id = target.id
        source.merge_reason = reason or f'Merged into #{target.id} ({target.name})'
        source.save()

        # ── 11. Save target ──
        target.save()

        # ── 12. Audit trail on both ──
        ContactAuditLog.log_change(
            contact=source, action='MERGE',
            field_name='status', old_value='ACTIVE', new_value='MERGED',
            reason=f'Merged into #{target.id} ({target.name}). {reason}',
            source='API',
            actor_user_id=actor_user_id,
            actor_name=actor_name,
        )

        ContactAuditLog.log_change(
            contact=target, action='MERGE',
            field_name='merge_absorbed',
            old_value=None,
            new_value=f'Absorbed #{source.id} ({source.name})',
            reason=reason,
            source='API',
            actor_user_id=actor_user_id,
            actor_name=actor_name,
        )

        result['success'] = True
        return result

    @staticmethod
    def _get_balance_models():
        """Safely get balance models if they exist."""
        models = []
        try:
            from apps.finance.payment_models import CustomerBalance
            models.append(CustomerBalance)
        except Exception:
            pass
        try:
            from apps.finance.payment_models import SupplierBalance
            models.append(SupplierBalance)
        except Exception:
            pass
        return models
