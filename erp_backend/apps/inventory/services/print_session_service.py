"""
Print Session Service — auto-creation, assignment, and lifecycle management.

Auto-creates print sessions when:
- A product is purchased or received (BARCODE session for new/generated barcodes)
- A product is transferred between locations (BARCODE session)
- A price changes (SHELF session for shelf price labels)
- A new product is created (BARCODE session)
- A barcode is generated for an existing product (BARCODE session)

All auto-sessions are assigned to the designated person and notified.
Uses source_context to trace which operation spawned the session.
"""
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── Trigger → source_context mapping ──────────────────────────────────────
TRIGGER_SOURCE_MAP = {
    'PURCHASE': 'RECEIVING',
    'TRANSFER': 'STOCK_TRANSFER',
    'PRICE_CHANGE': 'PRICE_UPDATE',
    'BARCODE_GEN': 'BARCODE_GEN',
    'NEW_PRODUCT': 'PRODUCT_LIST',
}

TRIGGER_TITLES = {
    'PURCHASE': 'Purchase Receipt Labels',
    'TRANSFER': 'Transfer Labels',
    'PRICE_CHANGE': 'Price Update — Shelf Labels',
    'BARCODE_GEN': 'New Barcode Labels',
    'NEW_PRODUCT': 'New Product Labels',
}


class PrintSessionService:
    """
    Centralized service for PrintSession lifecycle and auto-creation.
    """

    @classmethod
    def auto_create_session(cls, org_id, products, trigger, label_type='BARCODE',
                            assigned_to=None, title=None, user=None,
                            source_context=None):
        """
        Create a PrintSession automatically from a system event.

        Args:
            org_id: Organization ID (or org instance)
            products: list of Product instances or dicts
            trigger: PURCHASE, TRANSFER, PRICE_CHANGE, BARCODE_GEN, NEW_PRODUCT
            label_type: SHELF, BARCODE, PACKAGING, FRESH, CUSTOM
            assigned_to: User instance or ID
            title: optional session title
            user: user who triggered the event
            source_context: override for source tracking
        """
        from apps.inventory.models.label_models import (
            PrintSession, PrintSessionItem, LabelTemplate,
        )

        if not products:
            return None

        auto_title = title or TRIGGER_TITLES.get(trigger, 'Auto-Generated Labels')
        auto_source = source_context or TRIGGER_SOURCE_MAP.get(trigger, 'PRODUCT_LIST')

        # org_id may be an integer or a model instance
        org_val = org_id.id if hasattr(org_id, 'id') else org_id

        # Resolve default template
        template = LabelTemplate.objects.filter(
            organization=org_val, label_type=label_type,
            is_default=True, is_active=True,
        ).first()

        # Resolve assigned user
        assigned_user = cls._resolve_user(assigned_to)

        # Create session with full workflow metadata
        session = PrintSession.objects.create(
            organization=org_val,
            title=auto_title,
            label_type=label_type,
            status='QUEUED',     # Auto-sessions skip DRAFT → go straight to QUEUED
            trigger=trigger,
            source_context=auto_source,
            template=template,
            output_method='PDF',
            assigned_to=assigned_user,
            created_by=user,
            queued_at=timezone.now(),
        )

        # Add items with FULL snapshots
        template_version = template.version if template else 1
        for product in products:
            snap = cls._build_snapshot(product, template_version)
            if not snap:
                continue
            PrintSessionItem.objects.create(
                organization=org_val,
                session=session,
                product_id=snap.pop('product_id'),
                quantity=1,
                **snap,
            )

        session.recalculate_totals()

        logger.info(
            f'PrintSessionService: auto-created session {session.session_code} '
            f'(trigger={trigger}, source={auto_source}, type={label_type}, '
            f'products={session.total_products})'
        )

        if assigned_user:
            logger.info(f'PrintSessionService: session {session.session_code} assigned to {assigned_user}')

        return session

    @classmethod
    def _build_snapshot(cls, product, template_version=1):
        """Build a full snapshot dict from a Product instance or plain dict."""
        if hasattr(product, 'pk'):
            pid = product.pk
            if not pid:
                return None
            return {
                'product_id': pid,
                'snapshot_name': product.name or '',
                'snapshot_sku': product.sku or '',
                'snapshot_barcode': product.barcode or '',
                'snapshot_price': getattr(product, 'selling_price_ttc', None) or getattr(product, 'selling_price', None),
                'snapshot_category': (product.category.name if hasattr(product, 'category') and product.category else ''),
                'snapshot_supplier': getattr(product, 'supplier_name', '') or '',
                'snapshot_unit': (str(product.unit) if hasattr(product, 'unit') and product.unit else ''),
                'snapshot_currency': getattr(product, 'currency', '') or '',
                'snapshot_product_ref': getattr(product, 'reference_code', '') or '',
                'snapshot_tax_mode': 'TTC',
                'snapshot_template_version': template_version,
            }
        else:
            pid = product.get('id')
            if not pid:
                return None
            return {
                'product_id': pid,
                'snapshot_name': product.get('name', ''),
                'snapshot_sku': product.get('sku', ''),
                'snapshot_barcode': product.get('barcode', ''),
                'snapshot_price': product.get('selling_price_ttc') or product.get('selling_price'),
                'snapshot_category': product.get('category_name', ''),
                'snapshot_supplier': product.get('supplier_name', ''),
                'snapshot_unit': product.get('unit_name', ''),
                'snapshot_currency': product.get('currency', ''),
                'snapshot_product_ref': product.get('reference_code', ''),
                'snapshot_tax_mode': product.get('tax_mode', 'TTC'),
                'snapshot_template_version': template_version,
            }

    @classmethod
    def _resolve_user(cls, user_or_id):
        """Resolve a user instance from ID or return as-is."""
        if not user_or_id:
            return None
        if hasattr(user_or_id, 'pk'):
            return user_or_id
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            return User.objects.get(pk=user_or_id)
        except User.DoesNotExist:
            return None

    # ── Trigger-specific entry points ─────────────────────────────────

    @classmethod
    def on_purchase_received(cls, org_id, products, user=None, assigned_to=None):
        """Purchase receipt → BARCODE session for products with barcodes."""
        barcode_products = [p for p in products if getattr(p, 'barcode', None)]
        if barcode_products:
            return cls.auto_create_session(
                org_id=org_id, products=barcode_products,
                trigger='PURCHASE', label_type='BARCODE',
                assigned_to=assigned_to, user=user,
                source_context='RECEIVING',
            )
        return None

    @classmethod
    def on_transfer_completed(cls, org_id, products, user=None, assigned_to=None):
        """Stock transfer → BARCODE session for transferred products."""
        return cls.auto_create_session(
            org_id=org_id, products=products,
            trigger='TRANSFER', label_type='BARCODE',
            assigned_to=assigned_to, user=user,
            source_context='STOCK_TRANSFER',
        )

    @classmethod
    def on_price_change(cls, org_id, products, user=None, assigned_to=None):
        """Price update → SHELF session for price label reprinting."""
        return cls.auto_create_session(
            org_id=org_id, products=products,
            trigger='PRICE_CHANGE', label_type='SHELF',
            assigned_to=assigned_to, user=user,
            title='Price Update — Reprint Shelf Labels',
            source_context='PRICE_UPDATE',
        )

    @classmethod
    def on_barcode_generated(cls, org_id, products, user=None, assigned_to=None):
        """Barcode generation → BARCODE session."""
        return cls.auto_create_session(
            org_id=org_id, products=products,
            trigger='BARCODE_GEN', label_type='BARCODE',
            assigned_to=assigned_to, user=user,
            source_context='BARCODE_GEN',
        )

    @classmethod
    def on_new_product(cls, org_id, products, user=None, assigned_to=None):
        """New product creation → BARCODE session for initial labeling."""
        return cls.auto_create_session(
            org_id=org_id, products=products,
            trigger='NEW_PRODUCT', label_type='BARCODE',
            assigned_to=assigned_to, user=user,
            source_context='PRODUCT_LIST',
        )
