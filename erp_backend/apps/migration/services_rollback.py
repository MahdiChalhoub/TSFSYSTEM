"""
Migration Service — Orchestrates the full UltimatePOS → TSF migration.
Runs entity imports in dependency order with transaction safety and progress tracking.
"""
import logging
import traceback
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.migration.models import MigrationJob, MigrationMapping
from apps.migration.parsers import SQLDumpParser, DirectDBReader
from apps.migration.mappers import (
    UnitMapper, CategoryMapper, BrandMapper, ProductMapper,
    ContactMapper, TransactionMapper, SellLineMapper, PurchaseLineMapper,
    AccountMapper, SiteMapper, ExpenseMapper, TransactionPaymentMapper,
    safe_int, safe_bool, safe_decimal, safe_str
)

logger = logging.getLogger(__name__)




class MigrationRollbackService:
    """Rolls back a migration by deleting all created objects."""

    @staticmethod
    def rollback(job: MigrationJob):
        """Delete all objects created by a migration job, in reverse dependency order."""
        from apps.pos.models import OrderLine, Order
        from apps.crm.models import Contact
        from apps.inventory.models import Product, Brand, Category, Unit, Warehouse, Inventory, ComboComponent
        from apps.finance.models import FinancialAccount, TaxGroup
        from apps.finance.models.ledger_models import JournalEntry
        from apps.finance.payment_models import Payment
        from apps.finance.models import DirectExpense
        from erp.models import User

        entity_model_map = {
            'JOURNAL_ENTRY': JournalEntry,
            'PAYMENT': Payment,
            'ORDER_LINE': OrderLine,
            'INVENTORY': Inventory,
            'COMBO_LINK': ComboComponent,
            'TRANSACTION': Order,
            'EXPENSE': DirectExpense,
            'ACCOUNT': FinancialAccount,
            'CONTACT': Contact,
            'PRODUCT': Product,
            'BRAND': Brand,
            'CATEGORY': Category,
            'UNIT': Unit,
            'TAX_GROUP': TaxGroup,
            'USER': User,
            'SITE': Warehouse,
        }

        # Delete in reverse dependency order
        delete_order = [
            'JOURNAL_ENTRY', 'PAYMENT', 'ORDER_LINE', 'INVENTORY', 'COMBO_LINK',
            'TRANSACTION', 'EXPENSE', 'ACCOUNT', 'CONTACT', 'PRODUCT', 'BRAND',
            'CATEGORY', 'UNIT', 'TAX_GROUP', 'USER', 'SITE'
        ]

        total_deleted = 0
        for entity_type in delete_order:
            model = entity_model_map.get(entity_type)
            if not model:
                continue

            mappings = MigrationMapping.objects.filter(
                job=job, entity_type=entity_type
            )
            target_ids = list(mappings.values_list('target_id', flat=True))

            if target_ids:
                try:
                    # Batch delete in chunks to avoid query size limits
                    for i in range(0, len(target_ids), 1000):
                        chunk = target_ids[i:i+1000]
                        deleted_count, _ = model.objects.filter(id__in=chunk).delete()
                        total_deleted += deleted_count
                    logger.info(f"Rolled back {len(target_ids)} {entity_type} records")
                except Exception as e:
                    logger.error(f"Failed to rollback {entity_type}: {str(e)}")

        # Mark job as rolled back
        job.status = 'ROLLED_BACK'
        job.save()

        # Delete mappings
        MigrationMapping.objects.filter(job=job).delete()

        logger.info(f"Rollback complete. Deleted {total_deleted} records total.")
        return total_deleted
