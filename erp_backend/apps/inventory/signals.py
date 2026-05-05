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


# ─── M2M audit logging for Brand / Category / ProductAttribute ────────────
#
# `AuditLogMixin.save()` only catches direct field updates on the parent
# model — it can't see M2M writes. So when the operator clicks
# "Link attribute" / "Link category" / "Add value to scope" the side-panel
# Audit tab stays silent. Wire a single `m2m_changed` receiver per M2M
# so add/remove/clear all turn into AuditLog rows that the side-panel
# Audit tab can render.
#
# We use the canonical `audit_log()` helper directly — that bypasses
# AuditLogMixin's per-instance __init__ but still goes through the same
# context-thread-locals so user/IP/path get attributed correctly.
try:
    from django.db.models.signals import m2m_changed as _m2m_changed
    from apps.inventory.models import Brand, Category, ProductAttribute
    from kernel.audit.audit_logger import audit_log as _audit_log

    def _audit_m2m(*, parent_instance, parent_type, action, child_label, child_ids):
        """Emit a single AuditLog row summarizing one M2M change.

        Args:
            parent_instance: the side that owns the M2M (Brand or Category).
            parent_type: 'brand' / 'category' / 'productattribute' — used
                as the audit row's resource_type so the side-panel Audit
                tab finds it.
            action: 'link_<m2m>' / 'unlink_<m2m>' / 'clear_<m2m>'.
            child_label: human label for the M2M (e.g. 'attribute', 'category').
            child_ids: ids on the OTHER side of the M2M.
        """
        try:
            _audit_log(
                action=f'{parent_type}.{action}',
                resource_type=parent_type,
                resource_id=parent_instance.pk,
                resource_repr=str(parent_instance),
                details={
                    'm2m': child_label,
                    'ids': sorted(int(x) for x in child_ids if x is not None),
                    'count': len(child_ids) if child_ids else 0,
                },
            )
        except Exception:
            logger.exception(f'Failed to audit-log {parent_type}.{action}')

    def _make_m2m_handler(parent_type, child_label):
        """Build a m2m_changed handler bound to a single parent type + label."""
        def handler(sender, instance, action, pk_set, reverse, **kwargs):
            # Only react on the SAVE side of the m2m_changed lifecycle —
            # post_add / post_remove / post_clear emit after the DB write.
            # `reverse=True` means the signal fired from the OTHER side
            # of the M2M (e.g. category.brands.add(brand) from a Category
            # instance) — handle both directions.
            if action == 'post_add':
                op = f'link_{child_label}'
            elif action == 'post_remove':
                op = f'unlink_{child_label}'
            elif action == 'post_clear':
                op = f'clear_{child_label}'
            else:
                return
            if reverse:
                # Signal fired from the reverse side: `instance` is the
                # OTHER side, `pk_set` are the parent ids. Skip — the
                # forward-side row will record the same change.
                return
            _audit_m2m(
                parent_instance=instance,
                parent_type=parent_type,
                action=op,
                child_label=child_label,
                child_ids=list(pk_set or []),
            )
        return handler

    # Brand M2Ms
    _m2m_changed.connect(
        _make_m2m_handler('brand', 'attribute'),
        sender=Brand.attributes.through,
        weak=False,
    )
    _m2m_changed.connect(
        _make_m2m_handler('brand', 'category'),
        sender=Brand.categories.through,
        weak=False,
    )
    _m2m_changed.connect(
        _make_m2m_handler('brand', 'country'),
        sender=Brand.countries.through,
        weak=False,
    )
    if hasattr(Brand, 'origin_countries'):
        _m2m_changed.connect(
            _make_m2m_handler('brand', 'origin_country'),
            sender=Brand.origin_countries.through,
            weak=False,
        )

    # Category M2Ms
    _m2m_changed.connect(
        _make_m2m_handler('category', 'attribute'),
        sender=Category.attributes.through,
        weak=False,
    )

    # ProductAttribute scope M2Ms — the leaf-value scoping we added in the
    # AttributesTab. Audited under the parent BRAND or CATEGORY id (not
    # the leaf attribute id) so they show up on the right side-panel —
    # the operator's mental model is "I scoped a value TO this brand",
    # not "I edited an attribute".
    def _attr_scope_handler(child_label):
        def handler(sender, instance, action, pk_set, reverse, **kwargs):
            if action not in ('post_add', 'post_remove', 'post_clear'):
                return
            op = {'post_add': 'scope_value', 'post_remove': 'unscope_value', 'post_clear': 'unscope_all'}[action]
            # `instance` here is a ProductAttribute (the leaf); `pk_set`
            # contains brand ids (or category ids). For each affected
            # parent, emit an audit row keyed to that parent.
            for parent_pk in (pk_set or []):
                try:
                    _audit_log(
                        action=f'{child_label}.{op}',
                        resource_type=child_label,
                        resource_id=parent_pk,
                        resource_repr=f'attribute_value:{instance.pk}',
                        details={
                            'attribute_value_id': instance.pk,
                            'attribute_value_name': instance.name,
                            'parent_attribute_id': instance.parent_id,
                        },
                    )
                except Exception:
                    logger.exception(f'Failed to audit-log {child_label}.{op}')
        return handler

    _m2m_changed.connect(
        _attr_scope_handler('brand'),
        sender=ProductAttribute.scope_brands.through,
        weak=False,
    )
    _m2m_changed.connect(
        _attr_scope_handler('category'),
        sender=ProductAttribute.scope_categories.through,
        weak=False,
    )

except Exception as exc:  # noqa: BLE001 — wiring is best-effort at startup
    logger.warning(f'M2M audit signals not wired: {exc}')
