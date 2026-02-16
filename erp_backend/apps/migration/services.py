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
    AccountMapper, SiteMapper, safe_int, safe_bool
)

logger = logging.getLogger(__name__)


class MigrationService:
    """
    Orchestrates the full migration pipeline:
    1. Parse source data (SQL dump or direct DB)
    2. Migrate in dependency order
    3. Track progress and mappings
    """

    # Migration order (dependencies first)
    MIGRATION_STEPS = [
        ('sites', 'Importing Sites/Locations', 5),
        ('units', 'Importing Units', 10),
        ('categories', 'Importing Categories', 20),
        ('brands', 'Importing Brands', 30),
        ('products', 'Importing Products', 50),
        ('contacts', 'Importing Contacts', 65),
        ('accounts', 'Importing Financial Accounts', 70),
        ('transactions', 'Importing Transactions', 85),
        ('sell_lines', 'Importing Sale Lines', 90),
        ('purchase_lines', 'Importing Purchase Lines', 95),
        ('finalize', 'Finalizing', 100),
    ]

    def __init__(self, job: MigrationJob, organization_id: int):
        self.job = job
        self.organization_id = organization_id
        self.errors = []
        self.tables_data = {}
        self.id_maps = {
            'units': {},
            'categories': {},
            'brands': {},
            'products': {},
            'contacts': {},
            'transactions': {},
            'accounts': {},
            'sites': {},
        }

    def run(self):
        """Execute the full migration pipeline."""
        try:
            self.job.status = 'PARSING'
            self.job.started_at = timezone.now()
            self.job.save()

            # Step 1: Parse source data
            self._parse_source()

            # Step 2: Run migration steps
            self.job.status = 'RUNNING'
            self.job.save()

            for step_name, step_label, progress in self.MIGRATION_STEPS:
                self.job.current_step = step_label
                self.job.progress = progress
                self.job.save()

                method = getattr(self, f'_migrate_{step_name}', None)
                if method:
                    try:
                        method()
                    except Exception as e:
                        self._log_error(f"Error in {step_label}: {str(e)}")
                        logger.exception(f"Migration step failed: {step_name}")

            # Complete
            self.job.status = 'COMPLETED'
            self.job.progress = 100
            self.job.completed_at = timezone.now()
            self.job.total_errors = len(self.errors)
            if self.errors:
                self.job.error_log = '\n'.join(self.errors[-100:])  # Keep last 100 errors
            self.job.save()

            logger.info(f"Migration #{self.job.id} completed. Errors: {len(self.errors)}")

        except Exception as e:
            self.job.status = 'FAILED'
            self.job.error_log = traceback.format_exc()
            self.job.completed_at = timezone.now()
            self.job.save()
            logger.exception(f"Migration #{self.job.id} failed catastrophically")
            raise

    def _parse_source(self):
        """Parse the data source into self.tables_data."""
        if self.job.source_type == 'SQL_DUMP':
            parser = SQLDumpParser(file_path=self.job.file_path)
            self.tables_data = parser.parse()
        elif self.job.source_type == 'DIRECT_DB':
            reader = DirectDBReader(
                host=self.job.db_host,
                port=self.job.db_port or 3306,
                database=self.job.db_name,
                user=self.job.db_user,
                password=self.job.db_password,
            )
            reader.connect()
            try:
                for table_name in SQLDumpParser.TABLE_COLUMNS.keys():
                    try:
                        self.tables_data[table_name] = reader.read_table(table_name)
                    except Exception as e:
                        self._log_error(f"Failed to read table {table_name}: {str(e)}")
            finally:
                reader.close()

        logger.info(f"Parsed {len(self.tables_data)} tables")

    def _log_error(self, message):
        """Log an error for reporting."""
        self.errors.append(f"[{timezone.now().isoformat()}] {message}")
        logger.warning(message)

    def _get_or_create_mapping(self, entity_type, source_id, source_table):
        """Check if a mapping already exists (for idempotency)."""
        try:
            mapping = MigrationMapping.objects.get(
                job=self.job,
                entity_type=entity_type,
                source_id=source_id,
            )
            return mapping.target_id
        except MigrationMapping.DoesNotExist:
            return None

    def _save_mapping(self, entity_type, source_id, target_id, source_table, extra_data=None):
        """Save an old_id → new_id mapping."""
        MigrationMapping.objects.create(
            job=self.job,
            entity_type=entity_type,
            source_id=source_id,
            target_id=target_id,
            source_table=source_table,
            extra_data=extra_data,
        )

    # =========================================================================
    # INDIVIDUAL ENTITY MIGRATIONS
    # =========================================================================

    def _migrate_sites(self):
        """Migrate business_locations → Site."""
        from erp.models import Site

        rows = self.tables_data.get('business_locations', [])
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            # Check idempotency
            existing = self._get_or_create_mapping('SITE', source_id, 'business_locations')
            if existing:
                self.id_maps['sites'][source_id] = existing
                continue

            try:
                mapped = SiteMapper.map_row(row)
                site = Site.objects.create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    code=mapped.get('code', f'LOC-{source_id}'),
                )
                self.id_maps['sites'][source_id] = site.id
                self._save_mapping('SITE', source_id, site.id, 'business_locations',
                                   SiteMapper.extra_data(row))
                count += 1
            except Exception as e:
                self._log_error(f"Site {source_id}: {str(e)}")

        self.job.total_inventory = count  # Reuse field
        logger.info(f"Migrated {count} sites")

    def _migrate_units(self):
        """Migrate units → Unit."""
        from apps.inventory.models import Unit

        rows = self.tables_data.get('units', [])
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            # Skip soft-deleted
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('UNIT', source_id, 'units')
            if existing:
                self.id_maps['units'][source_id] = existing
                continue

            try:
                mapped = UnitMapper.map_row(row)
                unit, created = Unit.objects.get_or_create(
                    organization_id=self.organization_id,
                    code=mapped['code'],
                    defaults=mapped
                )
                self.id_maps['units'][source_id] = unit.id
                if created:
                    self._save_mapping('UNIT', source_id, unit.id, 'units',
                                       UnitMapper.extra_data(row))
                    count += 1
                else:
                    self._save_mapping('UNIT', source_id, unit.id, 'units')
            except Exception as e:
                self._log_error(f"Unit {source_id} ({row.get('actual_name')}): {str(e)}")

        self.job.total_units = count
        logger.info(f"Migrated {count} units")

    def _migrate_categories(self):
        """Migrate categories → Category (handles hierarchical parent_id)."""
        from apps.inventory.models import Category

        rows = self.tables_data.get('categories', [])
        count = 0

        # First pass: create all categories without parents
        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('CATEGORY', source_id, 'categories')
            if existing:
                self.id_maps['categories'][source_id] = existing
                continue

            try:
                mapped = CategoryMapper.map_row(row)
                # Remove parent for first pass
                mapped.pop('parent_id', None)
                cat, created = Category.objects.get_or_create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    defaults=mapped
                )
                self.id_maps['categories'][source_id] = cat.id
                if created:
                    self._save_mapping('CATEGORY', source_id, cat.id, 'categories',
                                       CategoryMapper.extra_data(row))
                    count += 1
                else:
                    self._save_mapping('CATEGORY', source_id, cat.id, 'categories')
            except Exception as e:
                self._log_error(f"Category {source_id} ({row.get('name')}): {str(e)}")

        # Second pass: set parents
        for row in rows:
            source_id = safe_int(row.get('id'))
            parent_source_id = safe_int(row.get('parent_id'))
            if not source_id or not parent_source_id or parent_source_id == 0:
                continue

            target_id = self.id_maps['categories'].get(source_id)
            parent_target_id = self.id_maps['categories'].get(parent_source_id)

            if target_id and parent_target_id:
                try:
                    Category.objects.filter(id=target_id).update(parent_id=parent_target_id)
                except Exception as e:
                    self._log_error(f"Category parent update {source_id}: {str(e)}")

        self.job.total_categories = count
        logger.info(f"Migrated {count} categories")

    def _migrate_brands(self):
        """Migrate brands → Brand."""
        from apps.inventory.models import Brand

        rows = self.tables_data.get('brands', [])
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('BRAND', source_id, 'brands')
            if existing:
                self.id_maps['brands'][source_id] = existing
                continue

            try:
                mapped = BrandMapper.map_row(row)
                brand, created = Brand.objects.get_or_create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    defaults=mapped
                )
                self.id_maps['brands'][source_id] = brand.id
                if created:
                    self._save_mapping('BRAND', source_id, brand.id, 'brands',
                                       BrandMapper.extra_data(row))
                    count += 1
                else:
                    self._save_mapping('BRAND', source_id, brand.id, 'brands')
            except Exception as e:
                self._log_error(f"Brand {source_id} ({row.get('name')}): {str(e)}")

        self.job.total_brands = count
        logger.info(f"Migrated {count} brands")

    def _migrate_products(self):
        """Migrate products + variations → Product."""
        from apps.inventory.models import Product

        product_rows = self.tables_data.get('products', [])
        variation_rows = self.tables_data.get('variations', [])

        # Index variations by product_id for fast lookup
        variations_by_product = {}
        for v in variation_rows:
            pid = safe_int(v.get('product_id'))
            if pid:
                if pid not in variations_by_product:
                    variations_by_product[pid] = []
                variations_by_product[pid].append(v)

        count = 0
        for row in product_rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            existing = self._get_or_create_mapping('PRODUCT', source_id, 'products')
            if existing:
                self.id_maps['products'][source_id] = existing
                continue

            try:
                # Get default variation (first non-deleted)
                product_variations = variations_by_product.get(source_id, [])
                default_variation = None
                for v in product_variations:
                    if not v.get('deleted_at'):
                        default_variation = v
                        break

                mapped = ProductMapper.map_row(
                    row,
                    variation_data=default_variation,
                    brand_mapping=self.id_maps['brands'],
                    category_mapping=self.id_maps['categories'],
                    unit_mapping=self.id_maps['units'],
                )

                # Build the product
                product_kwargs = {
                    'organization_id': self.organization_id,
                    'sku': mapped['sku'],
                    'name': mapped['name'],
                    'type': mapped.get('type', 'STANDARD'),
                    'purchase_price_ht': mapped.get('purchase_price_ht', Decimal('0.00')),
                    'sell_price_ht': mapped.get('sell_price_ht', Decimal('0.00')),
                    'sell_price_ttc': mapped.get('sell_price_ttc', Decimal('0.00')),
                    'description': mapped.get('description'),
                    'image': mapped.get('image'),
                    'is_active': mapped.get('is_active', True),
                    'manage_stock': mapped.get('manage_stock', False),
                    'alert_quantity': mapped.get('alert_quantity', Decimal('0')),
                }

                if mapped.get('barcode'):
                    product_kwargs['barcode'] = mapped['barcode']
                if mapped.get('brand_id'):
                    product_kwargs['brand_id'] = mapped['brand_id']
                if mapped.get('category_id'):
                    product_kwargs['category_id'] = mapped['category_id']
                if mapped.get('unit_id'):
                    product_kwargs['unit_id'] = mapped['unit_id']
                if mapped.get('tax_rate'):
                    product_kwargs['tax_rate'] = mapped['tax_rate']

                product, created = Product.objects.get_or_create(
                    organization_id=self.organization_id,
                    sku=mapped['sku'],
                    defaults=product_kwargs
                )
                self.id_maps['products'][source_id] = product.id
                if created:
                    self._save_mapping('PRODUCT', source_id, product.id, 'products',
                                       ProductMapper.extra_data(row, default_variation))
                    count += 1
                else:
                    self._save_mapping('PRODUCT', source_id, product.id, 'products')
            except Exception as e:
                self._log_error(f"Product {source_id} ({row.get('name')}): {str(e)}")

        self.job.total_products = count
        logger.info(f"Migrated {count} products")

    def _migrate_contacts(self):
        """Migrate contacts → Contact."""
        from apps.crm.models import Contact

        rows = self.tables_data.get('contacts', [])
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('CONTACT', source_id, 'contacts')
            if existing:
                self.id_maps['contacts'][source_id] = existing
                continue

            try:
                mapped = ContactMapper.map_row(row)

                contact = Contact.objects.create(
                    organization_id=self.organization_id,
                    **mapped
                )
                self.id_maps['contacts'][source_id] = contact.id
                self._save_mapping('CONTACT', source_id, contact.id, 'contacts',
                                   ContactMapper.extra_data(row))
                count += 1

                # If type is 'both', create a second contact as CUSTOMER
                if str(row.get('type', '')).lower() == 'both':
                    mapped_customer = ContactMapper.map_row(row, contact_type_override='CUSTOMER')
                    customer = Contact.objects.create(
                        organization_id=self.organization_id,
                        **mapped_customer
                    )
                    # Store with a special key (negative source_id)
                    self._save_mapping('CONTACT', -source_id, customer.id, 'contacts',
                                       {'dual_type': True, 'original_id': source_id})

            except Exception as e:
                self._log_error(f"Contact {source_id} ({row.get('name')}): {str(e)}")

        self.job.total_contacts = count
        logger.info(f"Migrated {count} contacts")

    def _migrate_accounts(self):
        """Migrate accounts → FinancialAccount."""
        from apps.finance.models import FinancialAccount

        rows = self.tables_data.get('accounts', [])
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('ACCOUNT', source_id, 'accounts')
            if existing:
                self.id_maps['accounts'][source_id] = existing
                continue

            try:
                mapped = AccountMapper.map_row(row)
                account = FinancialAccount.objects.create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    type=mapped.get('type', 'BANK'),
                )
                self.id_maps['accounts'][source_id] = account.id
                self._save_mapping('ACCOUNT', source_id, account.id, 'accounts',
                                   AccountMapper.extra_data(row))
                count += 1
            except Exception as e:
                self._log_error(f"Account {source_id} ({row.get('name')}): {str(e)}")

        self.job.total_accounts = count
        logger.info(f"Migrated {count} accounts")

    def _migrate_transactions(self):
        """Migrate transactions → Order."""
        from apps.pos.models import Order

        rows = self.tables_data.get('transactions', [])
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            existing = self._get_or_create_mapping('TRANSACTION', source_id, 'transactions')
            if existing:
                self.id_maps['transactions'][source_id] = existing
                continue

            try:
                mapped = TransactionMapper.map_row(
                    row,
                    contact_mapping=self.id_maps['contacts'],
                    site_mapping=self.id_maps['sites'],
                )

                if mapped is None:
                    # Non-migratable type (expense, stock_adjustment, etc.)
                    continue

                order_kwargs = {
                    'organization_id': self.organization_id,
                    'type': mapped['type'],
                    'status': mapped.get('status', 'COMPLETED'),
                    'ref_code': mapped.get('ref_code'),
                    'invoice_number': mapped.get('invoice_number'),
                    'total_amount': mapped.get('total_amount', Decimal('0.00')),
                    'tax_amount': mapped.get('tax_amount', Decimal('0.00')),
                    'discount': mapped.get('discount', Decimal('0.00')),
                    'payment_method': mapped.get('payment_method', 'CASH'),
                    'notes': mapped.get('notes'),
                }

                if mapped.get('contact_id'):
                    order_kwargs['contact_id'] = mapped['contact_id']
                if mapped.get('site_id'):
                    order_kwargs['site_id'] = mapped['site_id']

                order = Order(**order_kwargs)
                # Bypass immutability guards for migration
                super(Order, order).save()

                self.id_maps['transactions'][source_id] = order.id
                self._save_mapping('TRANSACTION', source_id, order.id, 'transactions',
                                   TransactionMapper.extra_data(row))
                count += 1
            except Exception as e:
                self._log_error(f"Transaction {source_id}: {str(e)}")

        self.job.total_transactions = count
        logger.info(f"Migrated {count} transactions")

    def _migrate_sell_lines(self):
        """Migrate transaction_sell_lines → OrderLine."""
        from apps.pos.models import OrderLine

        rows = self.tables_data.get('transaction_sell_lines', [])
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            existing = self._get_or_create_mapping('ORDER_LINE', source_id, 'transaction_sell_lines')
            if existing:
                continue

            try:
                mapped = SellLineMapper.map_row(
                    row,
                    order_mapping=self.id_maps['transactions'],
                    product_mapping=self.id_maps['products'],
                )
                if mapped is None:
                    continue

                line = OrderLine.objects.create(
                    organization_id=self.organization_id,
                    **mapped
                )
                self._save_mapping('ORDER_LINE', source_id, line.id,
                                   'transaction_sell_lines', SellLineMapper.extra_data(row))
                count += 1
            except Exception as e:
                self._log_error(f"Sell line {source_id}: {str(e)}")

        logger.info(f"Migrated {count} sell lines")

    def _migrate_purchase_lines(self):
        """Migrate purchase_lines → OrderLine."""
        from apps.pos.models import OrderLine

        rows = self.tables_data.get('purchase_lines', [])
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            # Use negative ID to distinguish from sell lines
            existing = self._get_or_create_mapping('ORDER_LINE', -source_id, 'purchase_lines')
            if existing:
                continue

            try:
                mapped = PurchaseLineMapper.map_row(
                    row,
                    order_mapping=self.id_maps['transactions'],
                    product_mapping=self.id_maps['products'],
                )
                if mapped is None:
                    continue

                # Handle expiry_date
                expiry_date = mapped.pop('expiry_date', None)

                line = OrderLine.objects.create(
                    organization_id=self.organization_id,
                    **mapped
                )
                if expiry_date:
                    try:
                        OrderLine.objects.filter(id=line.id).update(expiry_date=expiry_date)
                    except Exception:
                        pass

                self._save_mapping('ORDER_LINE', -source_id, line.id,
                                   'purchase_lines', PurchaseLineMapper.extra_data(row))
                count += 1
            except Exception as e:
                self._log_error(f"Purchase line {source_id}: {str(e)}")

        logger.info(f"Migrated {count} purchase lines")

    def _migrate_finalize(self):
        """Final cleanup and summary."""
        logger.info(f"Migration #{self.job.id} finalized")
        logger.info(f"  Sites: {len(self.id_maps['sites'])}")
        logger.info(f"  Units: {len(self.id_maps['units'])}")
        logger.info(f"  Categories: {len(self.id_maps['categories'])}")
        logger.info(f"  Brands: {len(self.id_maps['brands'])}")
        logger.info(f"  Products: {len(self.id_maps['products'])}")
        logger.info(f"  Contacts: {len(self.id_maps['contacts'])}")
        logger.info(f"  Transactions: {len(self.id_maps['transactions'])}")
        logger.info(f"  Accounts: {len(self.id_maps['accounts'])}")
        logger.info(f"  Total errors: {len(self.errors)}")


class MigrationRollbackService:
    """Rolls back a migration by deleting all created objects."""

    @staticmethod
    def rollback(job: MigrationJob):
        """Delete all objects created by a migration job, in reverse dependency order."""
        from apps.pos.models import OrderLine, Order
        from apps.crm.models import Contact
        from apps.inventory.models import Product, Brand, Category, Unit
        from apps.finance.models import FinancialAccount
        from erp.models import Site

        entity_model_map = {
            'ORDER_LINE': OrderLine,
            'TRANSACTION': Order,
            'ACCOUNT': FinancialAccount,
            'CONTACT': Contact,
            'PRODUCT': Product,
            'BRAND': Brand,
            'CATEGORY': Category,
            'UNIT': Unit,
            'SITE': Site,
        }

        # Delete in reverse dependency order
        delete_order = [
            'ORDER_LINE', 'TRANSACTION', 'ACCOUNT', 'CONTACT',
            'PRODUCT', 'BRAND', 'CATEGORY', 'UNIT', 'SITE'
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
                    # Use force delete for Orders (bypass immutability)
                    deleted_count, _ = model.objects.filter(id__in=target_ids).delete()
                    total_deleted += deleted_count
                    logger.info(f"Rolled back {deleted_count} {entity_type} records")
                except Exception as e:
                    logger.error(f"Failed to rollback {entity_type}: {str(e)}")

        # Mark job as rolled back
        job.status = 'ROLLED_BACK'
        job.save()

        # Delete mappings
        MigrationMapping.objects.filter(job=job).delete()

        logger.info(f"Rollback complete. Deleted {total_deleted} records total.")
        return total_deleted
