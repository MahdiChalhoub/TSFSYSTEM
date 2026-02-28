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



from .services_base import MigrationBaseMixin
from .services_entities import MigrationEntitiesMixin
from .services_inventory import MigrationInventoryMixin
from .services_finance import MigrationFinanceMixin
from .services_orders import MigrationOrdersMixin
from .services_rollback import MigrationRollbackService

class MigrationService(MigrationBaseMixin, MigrationEntitiesMixin, MigrationInventoryMixin, MigrationFinanceMixin, MigrationOrdersMixin):

    """
    Orchestrates the full migration pipeline:
    1. Parse source data (SQL dump or direct DB)
    2. Migrate in dependency order
    3. Track progress and mappings
    """

    # Migration order (dependencies first)
    MIGRATION_STEPS = [
        ('sites', 'Importing Sites/Locations', 3),
        ('currency_check', 'Validating Currency', 4),
        ('taxes', 'Importing Tax Rates', 5),
        ('units', 'Importing Units', 8),
        ('categories', 'Importing Categories', 12),
        ('brands', 'Importing Brands', 16),
        ('users', 'Importing Users', 20),
        ('products', 'Importing Products', 38),
        ('combo_links', 'Linking Combo Components', 40),
        ('contacts', 'Importing Contacts', 48),
        ('accounts', 'Importing Financial Accounts', 52),
        ('expenses', 'Importing Expenses', 56),
        ('inventory', 'Importing Opening Stock', 62),
        ('stock_adjustments', 'Importing Stock Adjustments', 66),
        ('stock_transfers', 'Importing Stock Transfers', 70),
        ('transactions', 'Importing Transactions', 76),
        ('sell_lines', 'Importing Sale Lines', 82),
        ('purchase_lines', 'Importing Purchase Lines', 86),
        ('payments', 'Importing Payment Records', 90),
        ('account_transactions', 'Importing Financial Ledger', 96),
        ('finalize', 'Finalizing', 100),
    ]
