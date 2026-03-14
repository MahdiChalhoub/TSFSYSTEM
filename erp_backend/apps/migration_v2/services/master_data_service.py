"""
Master Data Migration Service
=============================
Handles migration of master data entities in dependency order:
1. Units
2. Categories (with hierarchy)
3. Brands
4. Tax Rates
5. Products (simple first, then combos)
"""
import logging
from decimal import Decimal
from django.db import transaction
from apps.inventory.models import Unit, Category, Brand, Product, ProductVariant
# from apps.finance.models import TaxRate  # TODO: Handle tax rates
from ..models import MigrationJob, MigrationMapping

logger = logging.getLogger(__name__)


class MasterDataMigrationService:
    """
    Handles migration of master data following TSFSYSTEM architecture.

    Rules:
    - All operations use transaction.atomic
    - Uses organization from job (organization isolation)
    - Stores mappings for all entities
    - Logs errors but doesn't stop the process
    """

    def __init__(self, job: MigrationJob):
        self.job = job
        self.organization = job.target_organization
        self.errors = []
        self.warnings = []

    @transaction.atomic
    def import_units(self, upos_units: list) -> int:
        """Import units of measure from UltimatePOS."""
        imported = 0
        self.job.current_step = 'Importing Units'
        self.job.save(update_fields=['current_step'])

        logger.info(f"Importing {len(upos_units)} units for organization {self.organization.id}")

        for upos_unit in upos_units:
            try:
                # Create unit in TSFSYSTEM
                unit = Unit.objects.create(
                    organization=self.organization,
                    name=upos_unit.get('actual_name', '').strip() or upos_unit.get('short_name', '').strip(),
                    short_name=upos_unit.get('short_name', '').strip()[:10],  # Ensure max length
                    allow_decimal=bool(upos_unit.get('allow_decimal', 0)),
                    # Base unit handling - will be mapped after all units are created
                    base_unit_id=None,  # First pass
                    base_unit_multiplier=Decimal(str(upos_unit.get('base_unit_multiplier', 1)))
                )

                # Store mapping
                MigrationMapping.objects.create(
                    job=self.job,
                    entity_type='UNIT',
                    source_id=upos_unit['id'],
                    target_id=unit.id,
                    source_data=upos_unit
                )

                imported += 1

            except Exception as e:
                logger.error(f"Failed to import unit {upos_unit.get('id')}: {e}")
                self.errors.append({
                    'entity_type': 'UNIT',
                    'source_id': upos_unit.get('id'),
                    'error': str(e)
                })

        # Second pass: Link base units
        self._link_base_units(upos_units)

        self.job.imported_units = imported
        self.job.save(update_fields=['imported_units'])

        logger.info(f"Imported {imported}/{len(upos_units)} units")
        return imported

    def _link_base_units(self, upos_units: list):
        """Second pass to link base units after all units are created."""
        for upos_unit in upos_units:
            if upos_unit.get('base_unit_id'):
                try:
                    # Get mapped base unit ID
                    base_mapping = MigrationMapping.objects.filter(
                        job=self.job,
                        entity_type='UNIT',
                        source_id=upos_unit['base_unit_id']
                    ).first()

                    if base_mapping:
                        # Get current unit mapping
                        unit_mapping = MigrationMapping.objects.get(
                            job=self.job,
                            entity_type='UNIT',
                            source_id=upos_unit['id']
                        )

                        # Update unit with base unit
                        unit = Unit.objects.get(id=unit_mapping.target_id)
                        unit.base_unit_id = base_mapping.target_id
                        unit.save(update_fields=['base_unit_id'])

                except Exception as e:
                    logger.warning(f"Failed to link base unit for {upos_unit['id']}: {e}")

    @transaction.atomic
    def import_categories(self, upos_categories: list) -> int:
        """Import categories with parent-child hierarchy."""
        imported = 0
        self.job.current_step = 'Importing Categories'
        self.job.save(update_fields=['current_step'])

        logger.info(f"Importing {len(upos_categories)} categories")

        # Sort by parent_id (NULL first for roots)
        sorted_cats = sorted(upos_categories, key=lambda c: (c.get('parent_id') is not None, c.get('parent_id') or 0))

        for upos_cat in sorted_cats:
            try:
                # Get parent mapping if exists
                parent_id = None
                if upos_cat.get('parent_id'):
                    parent_mapping = MigrationMapping.objects.filter(
                        job=self.job,
                        entity_type='CATEGORY',
                        source_id=upos_cat['parent_id']
                    ).first()
                    if parent_mapping:
                        parent_id = parent_mapping.target_id

                category = Category.objects.create(
                    organization=self.organization,
                    name=upos_cat.get('name', '').strip() or f'Category {upos_cat["id"]}',
                    code=upos_cat.get('short_code', '')[:20],  # Ensure max length
                    description=upos_cat.get('description'),
                    parent_id=parent_id
                )

                MigrationMapping.objects.create(
                    job=self.job,
                    entity_type='CATEGORY',
                    source_id=upos_cat['id'],
                    target_id=category.id,
                    source_data=upos_cat
                )

                imported += 1

            except Exception as e:
                logger.error(f"Failed to import category {upos_cat.get('id')}: {e}")
                self.errors.append({
                    'entity_type': 'CATEGORY',
                    'source_id': upos_cat.get('id'),
                    'error': str(e)
                })

        self.job.imported_categories = imported
        self.job.save(update_fields=['imported_categories'])

        logger.info(f"Imported {imported}/{len(upos_categories)} categories")
        return imported

    @transaction.atomic
    def import_brands(self, upos_brands: list) -> int:
        """Import brands."""
        imported = 0
        self.job.current_step = 'Importing Brands'
        self.job.save(update_fields=['current_step'])

        logger.info(f"Importing {len(upos_brands)} brands")

        for upos_brand in upos_brands:
            try:
                brand = Brand.objects.create(
                    organization=self.organization,
                    name=upos_brand.get('name', '').strip() or f'Brand {upos_brand["id"]}',
                    description=upos_brand.get('description')
                )

                MigrationMapping.objects.create(
                    job=self.job,
                    entity_type='BRAND',
                    source_id=upos_brand['id'],
                    target_id=brand.id,
                    source_data=upos_brand
                )

                imported += 1

            except Exception as e:
                logger.error(f"Failed to import brand {upos_brand.get('id')}: {e}")
                self.errors.append({
                    'entity_type': 'BRAND',
                    'source_id': upos_brand.get('id'),
                    'error': str(e)
                })

        self.job.imported_brands = imported
        self.job.save(update_fields=['imported_brands'])

        logger.info(f"Imported {imported}/{len(upos_brands)} brands")
        return imported

    @transaction.atomic
    def import_products_batch(self, upos_products: list, batch_size: int = 100) -> int:
        """
        Import products in batches to handle ~9,000 products efficiently.

        Args:
            upos_products: List of product dicts from UltimatePOS
            batch_size: Number of products to process per batch
        """
        total = len(upos_products)
        imported = 0

        self.job.current_step = 'Importing Products'
        self.job.save(update_fields=['current_step'])

        logger.info(f"Importing {total} products in batches of {batch_size}")

        # Filter out combo products for now (will handle later)
        simple_products = [p for p in upos_products if p.get('type') != 'combo']

        for i in range(0, len(simple_products), batch_size):
            batch = simple_products[i:i + batch_size]

            for upos_product in batch:
                try:
                    product = Product.objects.create(
                        organization=self.organization,
                        name=upos_product.get('name', '').strip() or f'Product {upos_product["id"]}',
                        sku=upos_product.get('sku'),
                        barcode=upos_product.get('barcode_type'),
                        description=upos_product.get('product_description'),
                        # Mapped foreign keys
                        unit_id=self._get_mapped_id('UNIT', upos_product.get('unit_id')),
                        category_id=self._get_mapped_id('CATEGORY', upos_product.get('category_id')),
                        brand_id=self._get_mapped_id('BRAND', upos_product.get('brand_id')),
                        # Stock management
                        enable_stock=bool(upos_product.get('enable_stock', 1)),
                        alert_quantity=Decimal(str(upos_product.get('alert_quantity', 0))) if upos_product.get('alert_quantity') else None,
                        # Additional fields
                        weight=Decimal(str(upos_product.get('weight', 0))) if upos_product.get('weight') else None,
                    )

                    MigrationMapping.objects.create(
                        job=self.job,
                        entity_type='PRODUCT',
                        source_id=upos_product['id'],
                        target_id=product.id,
                        source_data=upos_product
                    )

                    imported += 1

                    # Update progress every 50 products
                    if imported % 50 == 0:
                        progress = int((imported / total) * 100)
                        self.job.current_step_detail = f"{imported} / {total} products ({progress}%)"
                        self.job.save(update_fields=['current_step_detail'])

                except Exception as e:
                    logger.error(f"Failed to import product {upos_product.get('id')}: {e}")
                    self.errors.append({
                        'entity_type': 'PRODUCT',
                        'source_id': upos_product.get('id'),
                        'error': str(e)
                    })

        self.job.imported_products = imported
        self.job.current_step_detail = f"Completed: {imported} / {total} products"
        self.job.save(update_fields=['imported_products', 'current_step_detail'])

        logger.info(f"Imported {imported}/{total} products")
        return imported

    def _get_mapped_id(self, entity_type: str, source_id: int):
        """Helper to retrieve mapped ID from previous imports."""
        if not source_id:
            return None

        mapping = MigrationMapping.objects.filter(
            job=self.job,
            entity_type=entity_type,
            source_id=source_id
        ).first()

        return mapping.target_id if mapping else None

    def get_errors(self) -> list:
        """Return list of errors encountered during migration."""
        return self.errors

    def get_warnings(self) -> list:
        """Return list of warnings encountered during migration."""
        return self.warnings
