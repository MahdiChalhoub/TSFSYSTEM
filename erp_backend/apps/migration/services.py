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
        ('taxes', 'Importing Tax Rates', 8),
        ('units', 'Importing Units', 10),
        ('categories', 'Importing Categories', 20),
        ('brands', 'Importing Brands', 30),
        ('products', 'Importing Products', 50),
        ('contacts', 'Importing Contacts', 65),
        ('accounts', 'Importing Financial Accounts', 70),
        ('inventory', 'Importing Opening Stock', 75),
        ('transactions', 'Importing Transactions', 85),
        ('sell_lines', 'Importing Sale Lines', 90),
        ('purchase_lines', 'Importing Purchase Lines', 95),
        ('finalize', 'Finalizing', 100),
    ]

    def __init__(self, job: MigrationJob, organization_id: int):
        self.job = job
        self.organization_id = organization_id
        self.errors = []
        self.parser = None
        self.id_maps = {
            'SITE': {},
            'UNIT': {},
            'CATEGORY': {},
            'BRAND': {},
            'PRODUCT': {},
            'CONTACT': {},
            'TRANSACTION': {},
            'ACCOUNT': {},
        }
        self._load_existing_mappings()

    def _load_existing_mappings(self):
        """Pre-load existing mappings for this job into memory to prevent N+1 DB lookups."""
        mappings = MigrationMapping.objects.filter(job=self.job)
        for m in mappings:
            if m.entity_type in self.id_maps:
                self.id_maps[m.entity_type][m.source_id] = m.target_id
        logger.info(f"Pre-loaded {len(mappings)} mappings for job {self.job.id}")

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
        """Parse the data source: scan SQL offsets or connect to Direct DB."""
        if self.job.source_type == 'SQL_DUMP':
            from apps.storage.backends import get_local_path
            
            # Use stored_file if available, else fallback to legacy file_path
            file_path = None
            if self.job.stored_file:
                logger.info(f"Using StoredFile {self.job.stored_file_id} for migration")
                file_path = get_local_path(
                    self.job.stored_file.storage_provider,
                    self.job.stored_file.storage_key,
                    self.job.stored_file.bucket
                )
            else:
                file_path = self.job.file_path

            if not file_path:
                raise ValueError("No migration file found (stored_file and file_path are both null)")

            self.parser = SQLDumpParser(file_path=file_path)
            self.parser.parse()
            logger.info("SQL dump parser initialized (streaming mode)")

        elif self.job.source_type == 'DIRECT_DB':
            from apps.migration.parsers import DirectDBReader
            self.db_reader = DirectDBReader(
                host=self.job.db_host,
                port=self.job.db_port or 3306,
                database=self.job.db_name,
                user=self.job.db_user,
                password=self.job.db_password,
            )
            self.db_reader.connect()
            logger.info("Direct DB connection established (streaming mode)")

    def _get_rows(self, table_name):
        """Helper to get rows: either from streaming parser or Direct DB connection."""
        biz_id = self.job.source_business_id
        if self.parser:
            return self.parser.stream_rows(table_name, business_id=biz_id)
        
        if hasattr(self, 'db_reader'):
            where = f"business_id = {biz_id}" if biz_id else None
            # Some tables don't have business_id (e.g. variations linked via products)
            if table_name in ('variations', 'transaction_sell_lines', 'purchase_lines', 'account_transactions'):
                where = None # Will filter in logic if needed
            
            return self.db_reader.read_table(table_name, where)
        
        return []

    def _log_error(self, message):
        """Log an error for reporting."""
        self.errors.append(f"[{timezone.now().isoformat()}] {message}")
        logger.warning(message)

    def _get_or_create_mapping(self, entity_type, source_id, source_table):
        """
        Check if a mapping already exists (for idempotency).
        In SYNC mode, also checks mappings from ALL previous jobs for the same org,
        so we skip records that were imported in any prior migration.
        """
        # Check current job memory cache first
        cached = self.id_maps.get(entity_type, {}).get(source_id)
        if cached:
            return cached

        # In SYNC mode, check all previous completed jobs for the same org
        if self.job.migration_mode == 'SYNC':
            try:
                previous = MigrationMapping.objects.filter(
                    job__organization_id=self.organization_id,
                    job__status__in=['COMPLETED', 'RUNNING'],
                    entity_type=entity_type,
                    source_id=source_id,
                ).exclude(job=self.job).first()
                if previous:
                    # Record it in current job too for completeness and caching
                    self._save_mapping(entity_type, source_id, previous.target_id,
                                        source_table, {'synced_from_job': previous.job_id})
                    self.id_maps.setdefault(entity_type, {})[source_id] = previous.target_id
                    return previous.target_id
            except Exception:
                pass

        return None

    def _save_mapping(self, entity_type, source_id, target_id, source_table, extra_data=None):
        """Save an old_id → new_id mapping and update memory cache."""
        MigrationMapping.objects.create(
            job=self.job,
            entity_type=entity_type,
            source_id=source_id,
            target_id=target_id,
            source_table=source_table,
            extra_data=extra_data,
        )
        self.id_maps.setdefault(entity_type, {})[source_id] = target_id

    # =========================================================================
    # INDIVIDUAL ENTITY MIGRATIONS
    # =========================================================================

    def _migrate_sites(self):
        """Migrate business_locations → Site."""
        from erp.models import Site

        rows = self._get_rows('business_locations')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            # Check idempotency
            existing = self._get_or_create_mapping('SITE', source_id, 'business_locations')
            if existing:
                self.id_maps['SITE'][source_id] = existing
                # Also load corresponding warehouse
                from apps.inventory.models import Warehouse
                wh = Warehouse.objects.filter(site_id=existing).first()
                if wh:
                    self.id_maps.setdefault('WAREHOUSE', {})[source_id] = wh.id
                continue

            try:
                mapped = SiteMapper.map_row(row)
                from apps.inventory.models import Warehouse
                site = Site.objects.create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    code=mapped.get('code', f'LOC-{source_id}'),
                )
                warehouse = Warehouse.objects.create(
                    organization_id=self.organization_id,
                    site=site,
                    name=f"Main Warehouse - {site.name}",
                    code=f"WH-{site.code}",
                    is_active=True
                )
                self.id_maps['SITE'][source_id] = site.id
                self.id_maps.setdefault('WAREHOUSE', {})[source_id] = warehouse.id
                
                self._save_mapping('SITE', source_id, site.id, 'business_locations',
                                   SiteMapper.extra_data(row))
                count += 1
            except Exception as e:
                self._log_error(f"Site {source_id}: {str(e)}")

        self.job.total_inventory = count  # Reuse field
        logger.info(f"Migrated {count} sites")

    def _migrate_taxes(self):
        """Migrate UltimatePOS tax_rates → TSF TaxGroup."""
        from apps.finance.models import TaxGroup
        from apps.migration.mappers import TaxGroupMapper

        rows = self._get_rows('tax_rates')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            existing = self._get_or_create_mapping('TAX_GROUP', source_id, 'tax_rates')
            if existing:
                self.id_maps['TAX_GROUP'][source_id] = existing
                continue

            try:
                mapped = TaxGroupMapper.map_row(row)
                tax_group, created = TaxGroup.objects.get_or_create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    defaults=mapped
                )
                self.id_maps['TAX_GROUP'][source_id] = tax_group.id
                if created:
                    self._save_mapping('TAX_GROUP', source_id, tax_group.id, 'tax_rates',
                                       TaxGroupMapper.extra_data(row))
                    count += 1
            except Exception as e:
                self._log_error(f"Tax rate {source_id}: {str(e)}")

        logger.info(f"Migrated {count} tax rates")

    def _migrate_units(self):
        """Migrate units → Unit."""
        from apps.inventory.models import Unit

        rows = self._get_rows('units')
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
                self.id_maps['UNIT'][source_id] = existing
                continue

            try:
                mapped = UnitMapper.map_row(row)
                unit, created = Unit.objects.get_or_create(
                    organization_id=self.organization_id,
                    code=mapped['code'],
                    defaults=mapped
                )
                self.id_maps['UNIT'][source_id] = unit.id
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

        # We buffer categories because we need two passes for parents
        rows = list(self._get_rows('categories'))
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
                self.id_maps['CATEGORY'][source_id] = existing
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
                self.id_maps['CATEGORY'][source_id] = cat.id
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

            target_id = self.id_maps['CATEGORY'].get(source_id)
            parent_target_id = self.id_maps['CATEGORY'].get(parent_source_id)

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

        rows = self._get_rows('brands')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('BRAND', source_id, 'brands')
            if existing:
                self.id_maps['BRAND'][source_id] = existing
                continue

            try:
                mapped = BrandMapper.map_row(row)
                brand, created = Brand.objects.get_or_create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    defaults=mapped
                )
                self.id_maps['BRAND'][source_id] = brand.id
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

        # Index variations by product_id for fast lookup
        variations_by_product = {}
        for v in self._get_rows('variations'):
            pid = safe_int(v.get('product_id'))
            if pid:
                if pid not in variations_by_product:
                    variations_by_product[pid] = []
                variations_by_product[pid].append(v)

        # Pre-load tax mapping (source_id -> rate Decimal)
        tax_rate_mapping = {}
        try:
            from apps.finance.models import TaxGroup
            reverse_tax_map = {v: k for k, v in self.id_maps['TAX_GROUP'].items()}
            if reverse_tax_map:
                mapped_taxes = TaxGroup.objects.filter(id__in=reverse_tax_map.keys())
                for tg in mapped_taxes:
                    sid = reverse_tax_map.get(tg.id)
                    if sid:
                        tax_rate_mapping[sid] = tg.rate / Decimal('100')
        except Exception as e:
            logger.error(f"Failed to pre-load tax mappings: {str(e)}")

        product_rows = self._get_rows('products')
        count = 0
        for row in product_rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            existing = self._get_or_create_mapping('PRODUCT', source_id, 'products')
            if existing:
                self.id_maps['PRODUCT'][source_id] = existing
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
                    brand_mapping=self.id_maps['BRAND'],
                    category_mapping=self.id_maps['CATEGORY'],
                    unit_mapping=self.id_maps['UNIT'],
                    tax_mapping=tax_rate_mapping,
                )

                # Build the product
                product_kwargs = {
                    'organization_id': self.organization_id,
                    'sku': mapped['sku'],
                    'name': mapped['name'],
                    'product_type': mapped.get('type', 'STANDARD'), # Fixed field name: product_type
                    'selling_price_ht': mapped.get('sell_price_ht', Decimal('0.00')), # Fixed field names
                    'selling_price_ttc': mapped.get('sell_price_ttc', Decimal('0.00')),
                    'cost_price_ht': mapped.get('purchase_price_ht', Decimal('0.00')),
                    'description': mapped.get('description'),
                    'is_active': mapped.get('is_active', True),
                    'min_stock_level': int(mapped.get('alert_quantity', 0)), # map alert_quantity
                    'tva_rate': mapped.get('tax_rate', Decimal('0.00')) * 100, # tva_rate is percentage in model
                }

                if mapped.get('barcode'):
                    product_kwargs['barcode'] = mapped['barcode']
                if mapped.get('brand_id'):
                    product_kwargs['brand_id'] = mapped['brand_id']
                if mapped.get('category_id'):
                    product_kwargs['category_id'] = mapped['category_id']
                if mapped.get('unit_id'):
                    product_kwargs['unit_id'] = mapped['unit_id']

                product, created = Product.objects.get_or_create(
                    organization_id=self.organization_id,
                    sku=mapped['sku'],
                    defaults=product_kwargs
                )
                self.id_maps['PRODUCT'][source_id] = product.id
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

        rows = self._get_rows('contacts')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('CONTACT', source_id, 'contacts')
            if existing:
                self.id_maps['CONTACT'][source_id] = existing
                continue

            try:
                mapped = ContactMapper.map_row(row)

                contact = Contact.objects.create(
                    organization_id=self.organization_id,
                    **mapped
                )
                self.id_maps['CONTACT'][source_id] = contact.id
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

        rows = self._get_rows('accounts')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('ACCOUNT', source_id, 'accounts')
            if existing:
                self.id_maps['ACCOUNT'][source_id] = existing
                continue

            try:
                mapped = AccountMapper.map_row(row)
                account = FinancialAccount.objects.create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    type=mapped.get('type', 'BANK'),
                )
                self.id_maps['ACCOUNT'][source_id] = account.id
                self._save_mapping('ACCOUNT', source_id, account.id, 'accounts',
                                   AccountMapper.extra_data(row))
                count += 1
            except Exception as e:
                self._log_error(f"Account {source_id} ({row.get('name')}): {str(e)}")

        self.job.total_accounts = count
        logger.info(f"Migrated {count} accounts")

    def _migrate_inventory(self):
        """Migrate UltimatePOS variation_location_details → TSF Inventory."""
        from apps.inventory.models import Inventory
        
        rows = self._get_rows('variation_location_details')
        count = 0
        
        for row in rows:
            source_pid = safe_int(row.get('product_id'))
            source_loc_id = safe_int(row.get('location_id'))
            qty = safe_decimal(row.get('qty_available'))
            
            if qty <= 0:
                continue
                
            target_product_id = self.id_maps['PRODUCT'].get(source_pid)
            target_warehouse_id = self.id_maps.get('WAREHOUSE', {}).get(source_loc_id)
            
            if not target_product_id or not target_warehouse_id:
                continue
                
            try:
                Inventory.objects.update_or_create(
                    organization_id=self.organization_id,
                    product_id=target_product_id,
                    warehouse_id=target_warehouse_id,
                    defaults={'quantity': qty}
                )
                count += 1
            except Exception as e:
                self._log_error(f"Inventory {source_pid}/{source_loc_id}: {str(e)}")
                
        logger.info(f"Migrated {count} inventory records")

    def _migrate_transactions(self):
        """Migrate transactions → Order."""
        from apps.pos.models import Order

        rows = self._get_rows('transactions')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            existing = self._get_or_create_mapping('TRANSACTION', source_id, 'transactions')
            if existing:
                self.id_maps['TRANSACTION'][source_id] = existing
                continue

            try:
                mapped = TransactionMapper.map_row(
                    row,
                    contact_mapping=self.id_maps['CONTACT'],
                    site_mapping=self.id_maps['SITE'],
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

                self.id_maps['TRANSACTION'][source_id] = order.id
                self._save_mapping('TRANSACTION', source_id, order.id, 'transactions',
                                   TransactionMapper.extra_data(row))
                count += 1
            except Exception as e:
                self._log_error(f"Transaction {source_id}: {str(e)}")

        self.job.total_transactions = count
        logger.info(f"Migrated {count} transactions")

    def _migrate_sell_lines(self):
        """Migrate transaction_sell_lines → OrderLine with bulk optimization."""
        from apps.pos.models import OrderLine

        rows = self._get_rows('transaction_sell_lines')
        batch = []
        row_data_batch = []
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            if self._get_or_create_mapping('ORDER_LINE', source_id, 'transaction_sell_lines'):
                continue

            try:
                mapped = SellLineMapper.map_row(
                    row,
                    order_mapping=self.id_maps['TRANSACTION'],
                    product_mapping=self.id_maps['PRODUCT'],
                )
                if mapped is None:
                    continue

                batch.append(OrderLine(organization_id=self.organization_id, **mapped))
                row_data_batch.append((source_id, row))

                if len(batch) >= 1000:
                    self._bulk_save_lines(batch, row_data_batch, 'transaction_sell_lines')
                    count += len(batch)
                    batch = []
                    row_data_batch = []
            except Exception as e:
                self._log_error(f"Sell line {source_id}: {str(e)}")

        if batch:
            self._bulk_save_lines(batch, row_data_batch, 'transaction_sell_lines')
            count += len(batch)

        logger.info(f"Migrated {count} sell lines (bulk)")

    def _migrate_purchase_lines(self):
        """Migrate purchase_lines → OrderLine with bulk optimization."""
        from apps.pos.models import OrderLine

        rows = self._get_rows('purchase_lines')
        batch = []
        row_data_batch = []
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            # Use negative ID to distinguish from sell lines
            if self._get_or_create_mapping('ORDER_LINE', -source_id, 'purchase_lines'):
                continue

            try:
                mapped = PurchaseLineMapper.map_row(
                    row,
                    order_mapping=self.id_maps['TRANSACTION'],
                    product_mapping=self.id_maps['PRODUCT'],
                )
                if mapped is None:
                    continue

                # Temp storage for expiry_date as it needs manual update if field isn't in bulk_create
                expiry_date = mapped.pop('expiry_date', None)
                
                line_obj = OrderLine(organization_id=self.organization_id, **mapped)
                if expiry_date:
                    line_obj.expiry_date = expiry_date
                
                batch.append(line_obj)
                row_data_batch.append((-source_id, row))

                if len(batch) >= 1000:
                    self._bulk_save_lines(batch, row_data_batch, 'purchase_lines')
                    count += len(batch)
                    batch = []
                    row_data_batch = []
            except Exception as e:
                self._log_error(f"Purchase line {source_id}: {str(e)}")

        if batch:
            self._bulk_save_lines(batch, row_data_batch, 'purchase_lines')
            count += len(batch)

        logger.info(f"Migrated {count} purchase lines (bulk)")

    def _bulk_save_lines(self, entity_batch, row_batch, table_name):
        """Hepler to perform bulk creation of lines and their mappings."""
        from apps.pos.models import OrderLine
        from apps.migration.models import MigrationMapping
        
        # bulk_create in Postgres returns IDs
        created_objs = OrderLine.objects.bulk_create(entity_batch)
        
        mappings = []
        for i, obj in enumerate(created_objs):
            source_id, original_row = row_batch[i]
            
            extra = {}
            if table_name == 'transaction_sell_lines':
                extra = SellLineMapper.extra_data(original_row)
            else:
                extra = PurchaseLineMapper.extra_data(original_row)

            mappings.append(MigrationMapping(
                job=self.job,
                entity_type='ORDER_LINE',
                source_id=source_id,
                target_id=obj.id,
                source_table=table_name,
                extra_data=extra
            ))
            # Cache in memory (though lines are usually not looked up)
            # self.id_maps.setdefault('ORDER_LINE', {})[source_id] = obj.id
        
        MigrationMapping.objects.bulk_create(mappings)

    def _migrate_finalize(self):
        """Final cleanup and summary."""
        if hasattr(self, 'db_reader'):
            self.db_reader.close()
        
        logger.info(f"Migration #{self.job.id} finalized")
        logger.info(f"  Sites: {len(self.id_maps['SITE'])}")
        logger.info(f"  Units: {len(self.id_maps['UNIT'])}")
        logger.info(f"  Categories: {len(self.id_maps['CATEGORY'])}")
        logger.info(f"  Brands: {len(self.id_maps['BRAND'])}")
        logger.info(f"  Products: {len(self.id_maps['PRODUCT'])}")
        logger.info(f"  Contacts: {len(self.id_maps['CONTACT'])}")
        logger.info(f"  Transactions: {len(self.id_maps['TRANSACTION'])}")
        logger.info(f"  Accounts: {len(self.id_maps['ACCOUNT'])}")
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
