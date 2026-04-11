"""
Readiness Service — computes operational readiness from product/packaging/label state.
"""
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class ReadinessService:
    """
    Computes and persists operational readiness for a product.
    Called after completeness refresh, label prints, and packaging changes.
    """

    @classmethod
    def refresh(cls, product, trigger='system'):
        """
        Recompute all 5 readiness dimensions and persist.
        Returns the ProductReadiness instance.
        """
        from apps.inventory.models.readiness_models import ProductReadiness

        readiness, _ = ProductReadiness.objects.get_or_create(
            product=product,
            defaults={'organization': product.organization}
        )

        readiness.is_scan_ready = cls._check_scan_ready(product)
        readiness.is_label_ready = cls._check_label_ready(product)
        readiness.is_shelf_ready = cls._check_shelf_ready(product)
        readiness.is_purchase_ready = cls._check_purchase_ready(product)
        readiness.is_replenishment_ready = cls._check_replenishment_ready(product)
        readiness.is_catalog_ready = cls._check_catalog_ready(product)
        readiness.last_assessed_by = trigger
        readiness.save()

        logger.info(
            f'ReadinessService: product {product.pk} = {readiness.score}/5 '
            f'({readiness.status}), missing: {readiness.missing}'
        )
        return readiness

    @classmethod
    def _check_scan_ready(cls, product):
        """Has a valid primary barcode resolvable by POS scanner."""
        return bool(product.barcode)

    @classmethod
    def _check_label_ready(cls, product):
        """Has at least one valid (not invalidated) label record."""
        from apps.inventory.models.label_models import LabelRecord
        return LabelRecord.objects.filter(
            product=product, status='VALID'
        ).exists()

    @classmethod
    def _check_shelf_ready(cls, product):
        """Has at least one product location assigned."""
        if not product.pk:
            return False
        try:
            from apps.inventory.models import ProductLocation
            return ProductLocation.objects.filter(product=product).exists()
        except (LookupError, Exception):
            return False

    @classmethod
    def _check_purchase_ready(cls, product):
        """Has at least one active supplier with any pricing."""
        if not product.pk:
            return False
        try:
            from django.apps import apps
            ProductSupplier = apps.get_model('pos', 'ProductSupplier')
            return ProductSupplier.objects.filter(
                product=product, is_active=True
            ).exists()
        except (LookupError, Exception):
            return False

    @classmethod
    def _check_replenishment_ready(cls, product):
        """Has min_stock_level set and a replenishment rule."""
        if not product.min_stock_level or product.min_stock_level <= 0:
            return False
        try:
            from apps.inventory.models import ReplenishmentRule
            return ReplenishmentRule.objects.filter(product=product).exists()
        except (LookupError, Exception):
            return False

    @classmethod
    def _check_catalog_ready(cls, product):
        """Has image, catalog description, and is approved for display."""
        return bool(
            getattr(product, 'catalog_ready', False)
            and product.image_url
            and getattr(product, 'catalog_description', None)
        )
