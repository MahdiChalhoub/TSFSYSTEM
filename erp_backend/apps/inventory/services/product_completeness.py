"""
Product Completeness Service — computes data maturity level (L0-L7).

Called explicitly from views/endpoints, NOT from Product.save().
This ensures no expensive related-table queries run on every save.

Supports product-type-specific completeness profiles:
  STANDARD: L0-L7 (all levels required)
  COMBO:    L0-L4 (no packaging/supplier requirements)
  SERVICE:  L0-L2 (only identity + pricing needed)
  BLANK:    L0-L2 (internal/repack, created before supplier details known)
  FRESH:    L0-L3 (variable-weight/fresh, needs inventory but not packaging/supplier)
"""
import logging

logger = logging.getLogger(__name__)


# ── Completeness Profiles per Product Type ───────────────────────────
# Each profile defines the max level and which checks are required.
# Checks beyond the profile's max_level are skipped.
COMPLETENESS_PROFILES = {
    'STANDARD': {
        'label': 'Standard Product',
        'max_level': 7,
        'checks': ['identified', 'priced', 'inventoried', 'grouped', 'packaged', 'sourced'],
    },
    'COMBO': {
        'label': 'Combo / Bundle',
        'max_level': 4,
        'checks': ['identified', 'priced', 'inventoried', 'grouped'],
        # Combos don't need packaging or supplier — they derive from components
    },
    'SERVICE': {
        'label': 'Service',
        'max_level': 2,
        'checks': ['identified', 'priced'],
        # Services don't need inventory, packaging, or supplier
    },
    'BLANK': {
        'label': 'Blank / Internal / Repack',
        'max_level': 2,
        'checks': ['identified', 'priced'],
        # Created before supplier details are known; barcode auto-generated
    },
    'FRESH': {
        'label': 'Fresh / Variable Weight',
        'max_level': 3,
        'checks': ['identified', 'priced', 'inventoried'],
        # Variable-weight items don't need packaging or supplier links
    },
}

DEFAULT_PROFILE = COMPLETENESS_PROFILES['STANDARD']


class ProductCompletenessService:
    """
    Computes data maturity level for a Product instance.

    Levels:
        0 = Draft        (name + barcode)
        1 = Identified   (+ category, brand/unit)
        2 = Priced       (+ selling price > 0)
        3 = Inventoried  (+ min stock configured)         [STANDARD, COMBO only]
        4 = Grouped      (+ product group assigned)       [STANDARD, COMBO only]
        5 = Packaged     (+ at least one ProductPackaging) [STANDARD only]
        6 = Sourced      (+ at least one supplier linked)  [STANDARD only]
        7 = Complete     (all above)                       [STANDARD only]
    """

    LABELS = {
        0: 'Draft', 1: 'Identified', 2: 'Priced', 3: 'Inventoried',
        4: 'Grouped', 5: 'Packaged', 6: 'Sourced', 7: 'Complete',
    }

    # Check registry — maps check name to method
    _CHECK_MAP = {
        'identified':  '_is_identified',
        'priced':      '_is_priced',
        'inventoried': '_is_inventoried',
        'grouped':     '_is_grouped',
        'packaged':    '_has_packaging',
        'sourced':     '_has_supplier',
    }

    @classmethod
    def get_profile(cls, product_type: str) -> dict:
        """Get the completeness profile for a product type."""
        return COMPLETENESS_PROFILES.get(product_type, DEFAULT_PROFILE)

    @classmethod
    def compute(cls, product) -> int:
        """
        Compute the completeness level from product fields + related records.
        Profile-aware: SERVICE products max out at L2, COMBO at L4.
        Does NOT save the product — caller must call .refresh() if persistence is needed.
        """
        # L0: must have name and barcode
        if not (product.name and product.barcode):
            return 0

        profile = cls.get_profile(getattr(product, 'product_type', 'STANDARD'))
        checks = profile['checks']
        max_level = profile['max_level']
        level = 0

        # Walk through checks in order, each bumps level by 1
        for i, check_name in enumerate(checks):
            method = getattr(cls, cls._CHECK_MAP[check_name])
            if not method(product):
                return level
            level = i + 1
            if level >= max_level:
                return max_level

        return min(level, max_level)

    @classmethod
    def refresh(cls, product, save=True) -> int:
        """
        Compute and persist the completeness level.
        Returns the new level.
        """
        level = cls.compute(product)
        changed = product.data_completeness_level != level
        if changed:
            old_level = product.data_completeness_level
            product.data_completeness_level = level
            if save:
                product.save(update_fields=['data_completeness_level', 'updated_at'])
            logger.info(
                f'Product {product.pk} completeness: L{old_level} → L{level} '
                f'({cls.LABELS.get(level, "?")})'
            )
        return level

    @classmethod
    def get_missing(cls, product) -> list:
        """
        Returns a list of human-readable strings describing what's missing
        for the product to reach the next level, profile-aware.
        """
        profile = cls.get_profile(getattr(product, 'product_type', 'STANDARD'))
        checks = profile['checks']
        missing = []

        if not product.name:
            missing.append('name')
        if not product.barcode:
            missing.append('barcode')

        # Check each required field for this profile
        if 'identified' in checks and not cls._is_identified(product):
            if not product.category_id:
                missing.append('category')
            if not product.brand_id:
                missing.append('brand')
            if not product.unit_id:
                missing.append('unit')

        if 'priced' in checks and not cls._is_priced(product):
            missing.append('selling_price')

        if 'inventoried' in checks and not cls._is_inventoried(product):
            missing.append('min_stock_level')

        if 'grouped' in checks and not cls._is_grouped(product):
            missing.append('product_group')

        if product.pk:
            if 'packaged' in checks and not cls._has_packaging(product):
                missing.append('packaging')
            if 'sourced' in checks and not cls._has_supplier(product):
                missing.append('supplier')

        if not product.is_verified:
            missing.append('verification')

        return missing

    # ── Private check methods ────────────────────────────────────────

    @classmethod
    def _is_identified(cls, product) -> bool:
        """L1: category + brand + unit."""
        return bool(product.category_id and product.brand_id and product.unit_id)

    @classmethod
    def _is_priced(cls, product) -> bool:
        """L2: selling price > 0."""
        return (product.selling_price_ttc or 0) > 0

    @classmethod
    def _is_inventoried(cls, product) -> bool:
        """L3: min stock level configured."""
        return (product.min_stock_level or 0) > 0

    @classmethod
    def _is_grouped(cls, product) -> bool:
        """L4: product group assigned."""
        return bool(product.product_group_id)

    @classmethod
    def _has_packaging(cls, product) -> bool:
        """L5: at least one COMPLETE, ACTIVE packaging (name + barcode + conversion ratio)."""
        if not product.pk:
            return False
        from apps.inventory.models import ProductPackaging
        return ProductPackaging.objects.filter(
            product=product,
            is_active=True,
            name__isnull=False,
            barcode__isnull=False,
            ratio__gt=0,
        ).exclude(name='').exclude(barcode='').exists()

    @classmethod
    def _has_supplier(cls, product) -> bool:
        """L6: at least one supplier linked."""
        if not product.pk:
            return False
        try:
            from django.apps import apps
            ProductSupplier = apps.get_model('pos', 'ProductSupplier')
            return ProductSupplier.objects.filter(product=product).exists()
        except (LookupError, Exception):
            return False
