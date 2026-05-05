"""
Inventory Module Signals
========================
Event-driven signal handlers for stock adjustments and transfers.
"""
from django.db.models.signals import post_save, m2m_changed, post_delete
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


try:
    from apps.inventory.models import (
        StockAdjustmentOrder, StockTransferOrder,
        Product, ProductAttribute
    )
except ImportError:
    StockAdjustmentOrder = None
    StockTransferOrder = None
    Product = None
    ProductAttribute = None


if StockAdjustmentOrder:
    @receiver(post_save, sender=StockAdjustmentOrder)
    def handle_stock_adjustment_posted(sender, instance, **kwargs):
        """
        Fires when a StockAdjustmentOrder status changes to POSTED.
        Adjusts inventory quantities and posts GL entries.
        """
        if instance.status != 'POSTED':
            return
        logger.info(f"[SIGNAL] StockAdjustmentOrder #{instance.id} posted — inventory adjusted")


if StockTransferOrder:
    @receiver(post_save, sender=StockTransferOrder)
    def handle_stock_transfer_posted(sender, instance, **kwargs):
        """
        Fires when a StockTransferOrder status changes to POSTED.
        Moves stock between warehouses.
        """
        if instance.status != 'POSTED':
            return
        logger.info(f"[SIGNAL] StockTransferOrder #{instance.id} posted — stock transferred")


if Product:
    @receiver(post_save, sender=Product)
    def handle_product_auto_linkage(sender, instance, **kwargs):
        """
        Auto-link Brand to Country and Category on product save.
        """
        brand = instance.brand
        category = instance.category
        country = instance.country_of_origin

        if not brand:
            return

        # 1. Link Brand to Product's Country of Origin
        if country:
            if not brand.origin_countries.filter(id=country.id).exists():
                brand.origin_countries.add(country)
                logger.info(f"[SIGNAL] Auto-linked Brand {brand.name} to Country {country.name}")

        # 2. Link Brand to Product's Category
        if category:
            if not brand.categories.filter(id=category.id).exists():
                brand.categories.add(category)
                logger.info(f"[SIGNAL] Auto-linked Brand {brand.name} to Category {category.name}")


    @receiver(m2m_changed, sender=Product.attribute_values.through)
    def handle_product_attribute_scope_validation(sender, instance, action, pk_set, **kwargs):
        """
        Phase 4 of multi-dim attribute scoping — backend hard validation.

        Fires BEFORE every Product.attribute_values.add(...). For each
        candidate value id, runs the same check_scope() helper the form
        uses on the frontend; if any value is out-of-scope for the
        product's (category, country, brand) we raise ValidationError
        and the M2M write is rolled back.

        Bypass mechanism: assign_attribute_value(force=True) sets a
        thread-local override flag that this signal honors — so
        sanctioned overrides go through cleanly, but stray bare .add()
        calls are caught.

        Pre-migration safety: check_scope returns [] when the
        scope_* fields don't exist yet, so this signal is a no-op
        until 0004_attribute_value_scopes is applied.
        """
        if action != "pre_add" or not pk_set:
            return
        try:
            from apps.inventory.services.attribute_scope import (
                check_scope, is_scope_override_active,
            )
        except ImportError:
            return  # service module not yet importable
        if is_scope_override_active():
            return  # sanctioned override path
        from rest_framework.exceptions import ValidationError as DRFValidationError

        violations_per_value = []
        for value_id in pk_set:
            try:
                value = ProductAttribute.objects.get(id=value_id)
            except ProductAttribute.DoesNotExist:
                continue
            v = check_scope(instance, value)
            if v:
                violations_per_value.append({
                    'value_id': value_id, 'value_name': value.name, 'failed': v,
                })
        if violations_per_value:
            # Raise DRF's ValidationError so REST views surface a 400
            # with a structured error payload instead of a 500. Inside a
            # plain Python context (management commands, tests) DRF's
            # ValidationError is also a subclass of Exception so callers
            # can still catch it.
            raise DRFValidationError({
                'attribute_values': [
                    f'Value "{v["value_name"]}" (id {v["value_id"]}) is out-of-scope on: '
                    f'{", ".join(v["failed"])}. Use assign_attribute_value(force=True) '
                    f'to override.'
                    for v in violations_per_value
                ],
            })

    @receiver(m2m_changed, sender=Product.attribute_values.through)
    def handle_product_attribute_linkage(sender, instance, action, pk_set, **kwargs):
        """
        Auto-link Attribute Groups to Brand and Category when attributes are assigned.
        """
        if action != "post_add" or not pk_set:
            return

        brand = instance.brand
        category = instance.category
        
        if not brand and not category:
            return

        # Resolve parent attribute groups for the added values
        group_ids = ProductAttribute.objects.filter(
            id__in=pk_set, parent__isnull=False
        ).values_list('parent_id', flat=True).distinct()

        if not group_ids:
            return

        groups = ProductAttribute.objects.filter(id__in=group_ids)
        for group in groups:
            if brand:
                if not brand.attributes.filter(id=group.id).exists():
                    brand.attributes.add(group)
                    logger.info(f"[SIGNAL] Auto-linked Attribute Group {group.name} to Brand {brand.name}")
            
            if category:
                if not category.attributes.filter(id=group.id).exists():
                    category.attributes.add(group)
                    logger.info(f"[SIGNAL] Auto-linked Attribute Group {group.name} to Category {category.name}")


# ─── Procurement-status cache invalidation ────────────────────────────────
#
# The /api/products/ list endpoint caches its computed
# `pipeline_status` per (org, product-id-set) for 30s. Without these
# signal handlers, an operator who creates / approves / cancels a PR or PO
# would see the chip stay stuck on its previous state for up to 30s while
# the cached batch lingers.
#
# We don't `cache.delete` individual keys (the cache key includes a set
# of product ids that we don't track) — instead we bump a per-org version
# counter, so every existing key for that org is silently unreachable.
# Old keys age out via TTL.
try:
    from apps.pos.models.procurement_request_models import ProcurementRequest
    from apps.pos.models.purchase_order_models import PurchaseOrder, PurchaseOrderLine
    from apps.inventory.models import OperationalRequestLine
    from apps.inventory.services.procurement_status_service import (
        invalidate_procurement_status_cache,
    )

    def _bump_org_cache(org_id):
        # Defensive: signal handlers must never break a save. Catch
        # everything, log, move on.
        try:
            invalidate_procurement_status_cache(org_id)
        except Exception:
            logger.exception('Failed to invalidate procurement status cache')

    @receiver(post_save, sender=ProcurementRequest)
    def _proc_req_saved(sender, instance, **kwargs):
        _bump_org_cache(instance.organization_id)

    @receiver(post_delete, sender=ProcurementRequest)
    def _proc_req_deleted(sender, instance, **kwargs):
        _bump_org_cache(instance.organization_id)

    @receiver(post_save, sender=PurchaseOrder)
    def _purchase_order_saved(sender, instance, **kwargs):
        _bump_org_cache(instance.organization_id)

    @receiver(post_delete, sender=PurchaseOrder)
    def _purchase_order_deleted(sender, instance, **kwargs):
        _bump_org_cache(instance.organization_id)

    @receiver(post_save, sender=PurchaseOrderLine)
    def _purchase_order_line_saved(sender, instance, **kwargs):
        _bump_org_cache(instance.organization_id)

    @receiver(post_save, sender=OperationalRequestLine)
    def _op_request_line_saved(sender, instance, **kwargs):
        # OperationalRequestLine.organization can be null in legacy rows
        # (the request itself owns the tenant). Fall back via FK.
        org_id = getattr(instance, 'organization_id', None)
        if not org_id and getattr(instance, 'request_id', None):
            try:
                org_id = instance.request.organization_id
            except Exception:
                org_id = None
        _bump_org_cache(org_id)

except Exception as exc:  # noqa: BLE001 — wiring is best-effort at startup
    logger.warning(f'Procurement cache signals not wired: {exc}')
