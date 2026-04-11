"""
Product Task Engine — auto-generates tasks from governance events.
"""
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class ProductTaskEngine:
    """
    Generates ProductTask records from governance events.
    Called from governance views and completeness service.
    """

    @classmethod
    def on_product_created(cls, product, user=None):
        """Generate tasks after a new product is created."""
        from apps.inventory.models.task_models import ProductTask
        tasks = []

        # Always need a shelf placement task
        tasks.append(ProductTask(
            organization=product.organization,
            product=product,
            task_type='SHELF_PLACEMENT',
            title=f'Place {product.sku} on shelf',
            description=f'New product "{product.name}" needs shelf placement.',
            priority='MEDIUM',
            assigned_role='shelf_manager',
            source_event='PRODUCT_CREATED',
        ))

        # If the product has a selling price, also need a label
        if (product.selling_price_ttc or 0) > 0:
            tasks.append(ProductTask(
                organization=product.organization,
                product=product,
                task_type='PRINT_LABEL',
                title=f'Print label for {product.sku}',
                description=f'Print price label: {product.name} @ {product.selling_price_ttc}',
                priority='MEDIUM',
                assigned_role='print_center',
                source_event='PRODUCT_CREATED',
            ))

        if tasks:
            ProductTask.objects.bulk_create(tasks)
            logger.info(f'ProductTaskEngine: created {len(tasks)} tasks for product {product.pk}')

    @classmethod
    def on_price_applied(cls, pcr, user=None):
        """Generate print label task after a price change is applied."""
        from apps.inventory.models.task_models import ProductTask

        ProductTask.objects.create(
            organization=pcr.product.organization,
            product=pcr.product,
            task_type='PRINT_LABEL',
            title=f'Reprint label for {pcr.product.sku} (price changed)',
            description=(
                f'Price changed from {pcr.current_price_ttc} to {pcr.proposed_price_ttc}. '
                f'Reprint shelf label and POS label.'
            ),
            priority='HIGH',
            assigned_role='print_center',
            source_event='PRICE_APPLIED',
            source_id=pcr.pk,
        )
        logger.info(f'ProductTaskEngine: PRINT_LABEL task for PCR-{pcr.pk}')

    @classmethod
    def on_verification_needed(cls, product, user=None):
        """Generate verify task when a product reaches completeness threshold."""
        from apps.inventory.models.task_models import ProductTask
        from apps.inventory.services.product_completeness import ProductCompletenessService

        profile = ProductCompletenessService.get_profile(product.product_type)
        level = product.data_completeness_level
        max_level = profile['max_level']

        # Only suggest verification when product is at max level but not yet verified
        if level >= max_level and not product.is_verified:
            # Check if there's already an open verify task
            existing = ProductTask.objects.filter(
                product=product, task_type='VERIFY_PRODUCT', status__in=['OPEN', 'IN_PROGRESS']
            ).exists()

            if not existing:
                ProductTask.objects.create(
                    organization=product.organization,
                    product=product,
                    task_type='VERIFY_PRODUCT',
                    title=f'Verify {product.sku} — data complete (L{level})',
                    description=(
                        f'Product "{product.name}" has reached L{level} ({profile["label"]}). '
                        f'Please review and verify the product data.'
                    ),
                    priority='LOW',
                    assigned_role='controller',
                    source_event='LEVEL_COMPLETE',
                )
                logger.info(f'ProductTaskEngine: VERIFY_PRODUCT task for {product.pk}')

    @classmethod
    def on_incomplete_data(cls, product, missing, user=None):
        """Generate complete-data task when significant fields are missing."""
        from apps.inventory.models.task_models import ProductTask

        if not missing or len(missing) <= 1:
            return

        # Check if there's already an open task
        existing = ProductTask.objects.filter(
            product=product, task_type='COMPLETE_DATA', status__in=['OPEN', 'IN_PROGRESS']
        ).exists()

        if not existing:
            ProductTask.objects.create(
                organization=product.organization,
                product=product,
                task_type='COMPLETE_DATA',
                title=f'Complete data for {product.sku} ({len(missing)} fields missing)',
                description=f'Missing: {", ".join(missing)}',
                priority='MEDIUM',
                assigned_role='shelf_manager',
                source_event='DATA_INCOMPLETE',
            )
