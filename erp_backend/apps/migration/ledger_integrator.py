import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.pos.models import Order
from apps.finance.services import LedgerService, ConfigurationService
from erp.services import _safe_import

logger = logging.getLogger(__name__)

class MigrationLedgerIntegrator:
    """
    Handles posting of migrated Orders and Purchases to the Financial Ledger.
    This ensures that historical data migrated from Third Party modules
    is correctly reflected in TSF Trial Balance and Account Statements.
    """

    @staticmethod
    def post_order_to_ledger(order: Order, user=None):
        """
        Calculates and creates a JournalEntry for a migrated Order.
        Reuses TSF forensic posting logic but tailored for migrated data.
        """
        organization = order.organization
        
        # 1. Resolve Posting Rules
        rules = ConfigurationService.get_posting_rules(organization)
        rev_acc = rules.get('sales', {}).get('revenue')
        inv_acc = rules.get('sales', {}).get('inventory')
        cogs_acc = rules.get('sales', {}).get('cogs')
        tax_acc = rules.get('purchases', {}).get('tax') or rev_acc
        receivable_acc = rules.get('sales', {}).get('receivable') or rev_acc
        
        if not all([rev_acc, inv_acc, cogs_acc]):
            raise ValueError(f"Organization {organization.id} missing sales posting rules (Revenue/Inventory/CoGS).")

        # 2. Sum up Line Items
        lines = order.lines.all()
        total_tax = order.tax_amount or Decimal('0.00')
        total_amount = order.total_amount or Decimal('0.00')
        total_cogs = sum(line.quantity * (line.unit_cost_ht or Decimal('0.00')) for line in lines)
        
        revenue_credit = max(Decimal('0'), total_amount - total_tax)
        
        # 3. Build Journal Entry Lines
        je_lines = [
            {"account_id": rev_acc, "debit": Decimal('0'), "credit": revenue_credit},
            {"account_id": tax_acc, "debit": Decimal('0'), "credit": total_tax},
            {"account_id": cogs_acc, "debit": total_cogs, "credit": Decimal('0')},
            {"account_id": inv_acc, "debit": Decimal('0'), "credit": total_cogs},
        ]

        # 4. Handle Payment Side
        # In migration, we usually map payment_method directly to a default account 
        # or follow the order's site configuration.
        # For simplicity, we debit the Receivable account if it's a CREDIT sale, 
        # otherwise we hit the default payment account.
        
        payment_acc_id = receivable_acc
        if order.payment_method != 'CREDIT':
            # Try to resolve from organization settings or use receivable as fallback
            # In a real scenario, we might want to look at the linked Payment records
            from apps.finance.models import FinancialAccount
            fa = FinancialAccount.objects.filter(organization=organization, type='CASH').first()
            if fa:
                payment_acc_id = fa.ledger_account_id or fa.id

        je_lines.append({
            "account_id": payment_acc_id,
            "debit": total_amount,
            "credit": Decimal('0')
        })

        # 5. Create Journal Entry
        with transaction.atomic():
            je = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=order.created_at or timezone.now(),
                description=f"Migrated Sale {order.invoice_number or order.ref_code}",
                reference=f"MIG-POS-{order.id}",
                status='POSTED',
                scope=order.scope or 'INTERNAL',
                site_id=order.site_id,
                user=user,
                lines=je_lines
            )
            return je

    @staticmethod
    def bulk_post_migration(job_id, entity_type='TRANSACTION', user=None):
        """Perform bulk ledger integration for a migration job."""
        from apps.migration.models import MigrationMapping
        
        mappings = MigrationMapping.objects.filter(
            job_id=job_id, 
            entity_type=entity_type,
            audit_status='PENDING'
        )
        
        count = 0
        errors = 0
        
        for m in mappings:
            try:
                order = Order.objects.get(id=m.target_id)
                MigrationLedgerIntegrator.post_order_to_ledger(order, user=user)
                m.audit_status = 'VERIFIED'
                m.audit_at = timezone.now()
                if user: m.audited_by = user
                m.save()
                count += 1
            except Exception as e:
                logger.error(f"Bulk post failed for Order {m.target_id}: {str(e)}")
                m.audit_status = 'FLAGGED'
                m.audit_notes = f"Ledger Integration Error: {str(e)}"
                m.save()
                errors += 1
                
        return count, errors
