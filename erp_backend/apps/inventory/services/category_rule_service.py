"""
Category Rule Service — applies category-specific creation rules during product creation.
"""
import logging
from django.db import models

logger = logging.getLogger(__name__)


class CategoryRuleService:
    """
    Applies CategoryCreationRule policies during product lifecycle events.
    Called from product creation views.
    """

    @classmethod
    def get_rule(cls, category):
        """Get the creation rule for a category, walking up the tree if needed."""
        if not category:
            return None
        from apps.inventory.models.category_rule_models import CategoryCreationRule
        # Try exact category first
        try:
            return CategoryCreationRule.objects.get(category=category)
        except CategoryCreationRule.DoesNotExist:
            pass
        # Walk up the parent chain
        parent = category.parent
        while parent:
            try:
                return CategoryCreationRule.objects.get(category=parent)
            except CategoryCreationRule.DoesNotExist:
                parent = parent.parent
        return None

    @classmethod
    def validate_creation(cls, product_data, category):
        """
        Validate product creation data against category rules.
        Returns: {valid: bool, errors: list[str], defaults: dict}
        """
        rule = cls.get_rule(category)
        if not rule:
            return {'valid': True, 'errors': [], 'defaults': {}}

        errors = []
        defaults = {}

        # Check required fields
        if rule.requires_barcode and not product_data.get('barcode'):
            errors.append(f'Barcode is required for category "{category.name}"')
        if rule.requires_brand and not product_data.get('brand'):
            errors.append(f'Brand is required for category "{category.name}"')
        if rule.requires_unit and not product_data.get('unit'):
            errors.append(f'Unit of measure is required for category "{category.name}"')

        # Apply defaults
        if rule.default_product_type and not product_data.get('product_type'):
            defaults['product_type'] = rule.default_product_type
        if rule.default_unit_id and not product_data.get('unit'):
            defaults['unit_id'] = rule.default_unit_id
        if rule.default_tva_rate is not None and not product_data.get('tva_rate'):
            defaults['tva_rate'] = rule.default_tva_rate

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'defaults': defaults,
        }

    @classmethod
    def apply_post_creation(cls, product, user=None):
        """
        Run post-creation hooks: auto-generate barcode, auto-create packaging,
        auto-create tasks per rule.
        """
        rule = cls.get_rule(product.category)
        if not rule:
            return

        # Auto-generate barcode for BLANK/INTERNAL products
        if product.product_type in ('BLANK', 'FRESH') or (
            not product.barcode and rule.barcode_mode_override == 'INTERNAL_AUTO'
        ):
            from apps.inventory.services.barcode_service import BarcodeService
            BarcodeService.generate(product, user=user)

        # Auto-create packaging from template
        if rule.auto_create_packaging and rule.packaging_template:
            cls._create_packaging_from_template(product, rule.packaging_template)

        # Auto-create tasks
        from apps.inventory.services.product_task_engine import ProductTaskEngine
        if rule.auto_print_label:
            ProductTaskEngine.on_product_created(product)
        elif rule.shelf_placement_required:
            from apps.inventory.models.task_models import ProductTask
            if not ProductTask.objects.filter(
                product=product, task_type='SHELF_PLACEMENT',
                status__in=['OPEN', 'IN_PROGRESS']
            ).exists():
                ProductTask.objects.create(
                    organization=product.organization,
                    product=product,
                    task_type='SHELF_PLACEMENT',
                    title=f'Place {product.sku} on shelf',
                    assigned_role='shelf_manager',
                    source_event='PRODUCT_CREATED',
                )

        logger.info(f'CategoryRuleService: applied post-creation rules for {product.pk}')

    @classmethod
    def _create_packaging_from_template(cls, product, template):
        """Create packaging levels from a JSON template."""
        from apps.inventory.models import ProductPackaging, Unit
        for i, tmpl in enumerate(template):
            name = tmpl.get('name', f'Package Level {i + 1}')
            ratio = tmpl.get('ratio', 1)
            unit_id = tmpl.get('unit_id')
            unit = None
            if unit_id:
                try:
                    unit = Unit.objects.get(pk=unit_id)
                except Unit.DoesNotExist:
                    pass
            ProductPackaging.objects.create(
                organization=product.organization,
                product=product,
                name=name,
                level=i + 1,
                ratio=ratio,
                unit=unit,
                is_active=True,
            )
        logger.info(f'Created {len(template)} packaging levels from template for {product.pk}')
