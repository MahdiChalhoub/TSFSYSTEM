"""
Label Service — print, invalidate, and track label lifecycle.
"""
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class LabelService:
    """
    Central service for label operations:
    - print: records a label print event with data snapshot
    - invalidate: marks current labels as invalid after data change
    - reprint: creates a new version after invalidation
    """

    @classmethod
    def print_label(cls, product, packaging=None, label_type='SHELF', reason='INITIAL', user=None, template=None):
        """
        Record a label print event with frozen data snapshot.
        Returns the LabelRecord.
        """
        from apps.inventory.models.label_models import LabelRecord, LabelPolicy
        from apps.inventory.views.governance_views import _log_audit

        # Resolve template from policy if not provided
        if not template:
            template = cls._resolve_template(product, label_type)

        # Get next version for this product+packaging+type combo
        last = LabelRecord.objects.filter(
            product=product, packaging=packaging, label_type=label_type
        ).order_by('-version').first()
        version = (last.version + 1) if last else 1

        # Build snapshot
        if packaging:
            name = packaging.name or product.name
            barcode = packaging.barcode or product.barcode
            price = packaging.custom_selling_price or product.selling_price_ttc
            unit_name = str(packaging.unit) if packaging.unit else str(product.unit) if product.unit else ''
        else:
            name = product.name
            barcode = product.barcode
            price = product.selling_price_ttc
            unit_name = str(product.unit) if product.unit else ''

        record = LabelRecord.objects.create(
            organization=product.organization,
            product=product,
            packaging=packaging,
            label_type=label_type,
            template_name=template,
            status='VALID',
            reason=reason,
            printed_name=name,
            printed_barcode=barcode,
            printed_price=price or 0,
            printed_unit=unit_name,
            version=version,
            printed_by=user,
        )

        # Update packaging label tracking if applicable
        if packaging:
            packaging.label_printed_at = timezone.now()
            packaging.label_version = version
            packaging.save(update_fields=['label_printed_at', 'label_version'])

        # Audit trail
        _log_audit(product, 'LABEL_PRINTED', user, {
            'label_type': label_type,
            'version': version,
            'template': template,
            'reason': reason,
            'packaging_id': packaging.pk if packaging else None,
        })

        logger.info(f'LabelService: printed {label_type} v{version} for product {product.pk}')
        return record

    @classmethod
    def invalidate_labels(cls, product, reason='Data change', packaging=None, user=None):
        """
        Invalidate all currently valid labels for a product (optionally filtered by packaging).
        Called after price or barcode changes.
        Auto-creates a print session for reprinting.
        """
        from apps.inventory.models.label_models import LabelRecord

        qs = LabelRecord.objects.filter(product=product, status='VALID')
        if packaging:
            qs = qs.filter(packaging=packaging)

        now = timezone.now()
        count = qs.update(
            status='INVALIDATED',
            invalidated_at=now,
            invalidated_reason=reason[:255],
        )
        logger.info(f'LabelService: invalidated {count} labels for product {product.pk} ({reason})')

        # Auto-create print session for reprinting
        if count > 0:
            from apps.inventory.services.print_session_service import PrintSessionService
            trigger = 'PRICE_CHANGE' if 'price' in reason.lower() else 'BARCODE_GEN'
            label_type = 'SHELF' if trigger == 'PRICE_CHANGE' else 'BARCODE'
            try:
                PrintSessionService.auto_create_session(
                    org_id=product.organization,
                    products=[product],
                    trigger=trigger,
                    label_type=label_type,
                    user=user,
                )
            except Exception as e:
                logger.warning(f'LabelService: failed to auto-create print session: {e}')

        return count

    @classmethod
    def _resolve_template(cls, product, label_type):
        """Resolve template name from org policy."""
        from apps.inventory.models.label_models import LabelPolicy

        try:
            policy = LabelPolicy.objects.get(organization=product.organization)
        except LabelPolicy.DoesNotExist:
            policy = None

        if not policy:
            return 'shelf_standard'

        if label_type == 'SHELF':
            return policy.default_shelf_template or 'shelf_standard'
        elif label_type == 'PACKAGING':
            return policy.default_packaging_template or 'packaging_standard'
        elif label_type == 'FRESH':
            return policy.default_fresh_template or 'fresh_weight'

        return 'shelf_standard'
