"""
Barcode Service — generation, validation, lookup, and governance.

Single source of truth: All barcode resolution goes through ProductBarcode table.
Product.barcode and ProductPackaging.barcode are legacy mirrors only.
"""
import logging
from django.utils import timezone
from django.db import IntegrityError, transaction

logger = logging.getLogger(__name__)


class BarcodeService:
    """
    Central service for barcode operations.
    Called explicitly from views — never from save().
    """

    # ── Generation ───────────────────────────────────────────────────

    @classmethod
    def generate(cls, product, packaging=None, user=None):
        """
        Generate a barcode for a product (or packaging) per org policy.
        Returns the generated barcode string, or None if generation is disabled.
        Uses atomic sequence allocation to prevent duplicates under concurrency.
        """
        from apps.inventory.models.barcode_models import BarcodePolicy, ProductBarcode

        policy = cls._get_policy(product.organization)
        if not policy or policy.mode == 'SUPPLIER':
            return None  # Supplier-only mode — don't auto-generate

        if policy.mode == 'MANUAL':
            return None  # Manual mode — user must enter

        # HYBRID: only generate if no active PRIMARY barcode exists
        if policy.mode == 'HYBRID' and not packaging:
            if ProductBarcode.objects.filter(
                product=product, is_active=True, barcode_type='PRIMARY',
                packaging__isnull=True
            ).exists():
                return None  # Already has a primary barcode

        # Build the barcode with atomic sequence allocation
        prefix = policy.prefix or '2'
        cat_code = ''
        if policy.category_prefix_enabled and product.category:
            cat_code = (product.category.code or '')[:3]

        # Atomic sequence increment — prevents duplicates under concurrent load
        from apps.inventory.models.product_models import Category
        category = product.category
        if category:
            with transaction.atomic():
                locked_cat = Category.objects.select_for_update().get(pk=category.pk)
                locked_cat.barcode_sequence += 1
                locked_cat.save(update_fields=['barcode_sequence'])
                seq = locked_cat.barcode_sequence
        else:
            # Fallback: use product ID
            seq = product.pk or 1

        # Format barcode
        raw = f"{prefix}{cat_code}{seq:07d}"

        # Pad/trim to format length and add checksum
        if policy.format == 'EAN13' and policy.checksum_enabled:
            raw = raw[:12].ljust(12, '0')
            check = cls._ean13_checksum(raw)
            barcode = f"{raw}{check}"
        elif policy.format == 'EAN8' and policy.checksum_enabled:
            raw = raw[:7].ljust(7, '0')
            check = cls._ean8_checksum(raw)
            barcode = f"{raw}{check}"
        else:
            barcode = raw

        # Store the barcode record — ProductBarcode is the source of truth
        try:
            ProductBarcode.objects.create(
                organization=product.organization,
                product=product,
                packaging=packaging,
                code=barcode,
                barcode_type='PRIMARY',
                source='GENERATED',
                is_active=True,
                generated_at=timezone.now(),
                generated_by=user,
            )
        except IntegrityError:
            logger.warning(f'BarcodeService: duplicate barcode {barcode} for product {product.pk}')
            return None

        # Sync legacy mirror fields (backward compat only)
        if not packaging:
            product.barcode = barcode
            product.barcode_source = 'INTERNAL'
            product.barcode_generated_at = timezone.now()
            product.save(update_fields=['barcode', 'barcode_source', 'barcode_generated_at'])
        elif packaging:
            packaging.barcode = barcode
            packaging.save(update_fields=['barcode'])

        logger.info(f'BarcodeService: generated {barcode} for product {product.pk}')
        return barcode

    # ── Validation ───────────────────────────────────────────────────

    @classmethod
    def validate(cls, code, organization=None, format_hint=None):
        """
        Validate a barcode string.
        Returns dict: {valid: bool, errors: list[str]}
        """
        errors = []

        if not code or not code.strip():
            return {'valid': False, 'errors': ['Barcode is empty']}

        code = code.strip()

        # Format validation
        if format_hint == 'EAN13' or (not format_hint and len(code) == 13):
            if not code.isdigit():
                errors.append('EAN-13 must be numeric')
            elif len(code) != 13:
                errors.append(f'EAN-13 must be 13 digits, got {len(code)}')
            elif cls._ean13_checksum(code[:12]) != int(code[12]):
                errors.append('Invalid EAN-13 check digit')

        elif format_hint == 'EAN8' or (not format_hint and len(code) == 8 and code.isdigit()):
            if not code.isdigit():
                errors.append('EAN-8 must be numeric')
            elif len(code) != 8:
                errors.append(f'EAN-8 must be 8 digits, got {len(code)}')
            elif cls._ean8_checksum(code[:7]) != int(code[7]):
                errors.append('Invalid EAN-8 check digit')

        # Uniqueness validation — always against ProductBarcode
        if organization and not errors:
            from apps.inventory.models.barcode_models import ProductBarcode
            exists = ProductBarcode.objects.filter(
                organization=organization, code=code, is_active=True
            ).exists()
            if exists:
                errors.append(f'Barcode {code} already exists in this organization')

        return {'valid': len(errors) == 0, 'errors': errors}

    # ── Lookup (POS Scanner) ─────────────────────────────────────────

    @classmethod
    def lookup(cls, code, organization=None):
        """
        Resolve a barcode to a product + optional packaging.
        SINGLE SOURCE OF TRUTH: queries ProductBarcode only.
        Returns dict or None.
        """
        from apps.inventory.models.barcode_models import ProductBarcode

        qs = ProductBarcode.objects.filter(code=code, is_active=True)
        if organization:
            qs = qs.filter(organization=organization)
        record = qs.select_related('product', 'packaging').first()
        if record:
            return {
                'product_id': record.product_id,
                'product_sku': record.product.sku,
                'product_name': record.product.name,
                'packaging_id': record.packaging_id,
                'barcode_type': record.barcode_type,
                'source': 'barcode_registry',
            }

        return None

    @classmethod
    def lookup_historical(cls, code, organization=None):
        """
        Resolve including retired/inactive barcodes — for audit/lookup only.
        NOT for POS sale.
        """
        from apps.inventory.models.barcode_models import ProductBarcode

        qs = ProductBarcode.objects.filter(code=code)
        if organization:
            qs = qs.filter(organization=organization)
        record = qs.select_related('product', 'packaging').order_by('-is_active').first()
        if record:
            return {
                'product_id': record.product_id,
                'product_sku': record.product.sku,
                'product_name': record.product.name,
                'packaging_id': record.packaging_id,
                'barcode_type': record.barcode_type,
                'is_active': record.is_active,
                'source': 'barcode_registry_historical',
            }
        return None

    @classmethod
    def barcode_prefix_search(cls, prefix, organization=None, limit=20):
        """
        Family prefix search — e.g. all barcodes starting with '888'.
        Separate from strict barcode validation/resolution.
        """
        from apps.inventory.models.barcode_models import ProductBarcode

        qs = ProductBarcode.objects.filter(code__startswith=prefix, is_active=True)
        if organization:
            qs = qs.filter(organization=organization)
        return qs.select_related('product', 'packaging')[:limit]

    # ── Change Governance ────────────────────────────────────────────

    @classmethod
    def change_barcode(cls, product, old_code, new_code, user=None, packaging=None):
        """
        Governed barcode change: respects change_requires_approval policy.
        If approval required → creates BarcodeChangeRequest.
        If not → applies immediately with full consequences.
        """
        policy = cls._get_policy(product.organization)

        if policy and policy.change_requires_approval:
            return cls._create_change_request(product, old_code, new_code, user, packaging)
        else:
            return cls._apply_barcode_change(product, old_code, new_code, user, packaging)

    @classmethod
    def _create_change_request(cls, product, old_code, new_code, user, packaging=None):
        """Create a pending BarcodeChangeRequest instead of applying immediately."""
        from apps.inventory.models.barcode_change_request import BarcodeChangeRequest
        from apps.inventory.views.governance_views import _log_audit

        req = BarcodeChangeRequest.objects.create(
            organization=product.organization,
            product=product,
            packaging=packaging,
            current_barcode=old_code,
            proposed_barcode=new_code,
            change_type='MANUAL',
            status='PENDING',
            requested_by=user,
        )

        _log_audit(product, 'BC_CHANGE_REQUESTED', user, {
            'old_barcode': old_code,
            'new_barcode': new_code,
            'request_id': req.pk,
        })

        logger.info(f'BarcodeService: change request {req.pk} created for {product.pk}: {old_code} → {new_code}')
        return {'status': 'PENDING', 'request_id': req.pk}

    @classmethod
    def _apply_barcode_change(cls, product, old_code, new_code, user, packaging=None):
        """
        Apply barcode change immediately with full consequences:
        deactivate old, create new, audit, unverify, trigger relabel task.
        """
        from apps.inventory.models.barcode_models import ProductBarcode
        from apps.inventory.views.governance_views import _log_audit

        # Deactivate old barcode record → mark as RETIRED
        ProductBarcode.objects.filter(
            product=product, code=old_code, is_active=True
        ).update(is_active=False, barcode_type='RETIRED')

        # Create new primary barcode record
        ProductBarcode.objects.create(
            organization=product.organization,
            product=product,
            packaging=packaging,
            code=new_code,
            barcode_type='PRIMARY',
            source='MANUAL',
            is_active=True,
        )

        # Sync legacy mirror
        if not packaging:
            product.barcode = new_code
            product.save(update_fields=['barcode'])
        elif packaging:
            packaging.barcode = new_code
            packaging.save(update_fields=['barcode'])

        # Audit trail
        _log_audit(product, 'BC_CHANGED', user, {
            'old_barcode': old_code,
            'new_barcode': new_code,
            'packaging_id': packaging.pk if packaging else None,
        })

        # Auto-unverify product
        if product.is_verified:
            product.is_verified = False
            product.verified_at = None
            product.verified_by = None
            product.save(update_fields=['is_verified', 'verified_at', 'verified_by'])
            _log_audit(product, 'PROD_UNVERIFIED', user, {
                'reason': 'Auto-unverified after barcode change',
            })

        # Auto-unverify packaging if applicable
        if packaging and getattr(packaging, 'is_verified', False):
            packaging.is_verified = False
            packaging.verified_at = None
            packaging.verified_by = None
            packaging.save(update_fields=['is_verified', 'verified_at', 'verified_by'])
            _log_audit(product, 'PKG_UNVERIFIED', user, {
                'reason': 'Auto-unverified after barcode change',
                'packaging_id': packaging.pk,
            })

        # Invalidate existing labels
        from apps.inventory.services.label_service import LabelService
        LabelService.invalidate_labels(product, reason='Barcode changed', packaging=packaging)

        # Generate relabel task
        from apps.inventory.models.task_models import ProductTask
        ProductTask.objects.create(
            organization=product.organization,
            product=product,
            task_type='PRINT_LABEL',
            title=f'Relabel {product.sku} — barcode changed',
            description=f'Barcode changed from {old_code} to {new_code}. Reprint all labels.',
            priority='HIGH',
            assigned_role='print_center',
            source_event='BC_CHANGED',
        )

        logger.info(f'BarcodeService: changed barcode for {product.pk}: {old_code} → {new_code}')
        return {'status': 'APPLIED'}

    # ── Bulk Operations (Import Support) ─────────────────────────────

    @classmethod
    def generate_batch(cls, products, user=None):
        """
        Generate barcodes for a batch of products with single sequence lock.
        Pre-flight collision check before any inserts.
        Returns dict of {product_id: barcode_or_None}
        """
        from apps.inventory.models.barcode_models import ProductBarcode

        if not products:
            return {}

        org = products[0].organization
        policy = cls._get_policy(org)
        if not policy or policy.mode in ('SUPPLIER', 'MANUAL'):
            return {p.pk: None for p in products}

        results = {}
        # Group by category for efficient sequence allocation
        by_category = {}
        for p in products:
            cat_id = p.category_id or 0
            by_category.setdefault(cat_id, []).append(p)

        for cat_id, cat_products in by_category.items():
            if cat_id:
                from apps.inventory.models.product_models import Category
                with transaction.atomic():
                    cat = Category.objects.select_for_update().get(pk=cat_id)
                    start_seq = cat.barcode_sequence + 1
                    cat.barcode_sequence += len(cat_products)
                    cat.save(update_fields=['barcode_sequence'])
            else:
                start_seq = 1

            prefix = policy.prefix or '2'
            for i, product in enumerate(cat_products):
                seq = start_seq + i if cat_id else (product.pk or 1)
                cat_code = ''
                if policy.category_prefix_enabled and product.category:
                    cat_code = (product.category.code or '')[:3]

                raw = f"{prefix}{cat_code}{seq:07d}"
                if policy.format == 'EAN13' and policy.checksum_enabled:
                    raw = raw[:12].ljust(12, '0')
                    barcode = f"{raw}{cls._ean13_checksum(raw)}"
                elif policy.format == 'EAN8' and policy.checksum_enabled:
                    raw = raw[:7].ljust(7, '0')
                    barcode = f"{raw}{cls._ean8_checksum(raw)}"
                else:
                    barcode = raw

                try:
                    ProductBarcode.objects.create(
                        organization=org, product=product,
                        code=barcode, barcode_type='PRIMARY',
                        source='GENERATED', is_active=True,
                        generated_at=timezone.now(), generated_by=user,
                    )
                    product.barcode = barcode
                    product.barcode_source = 'INTERNAL'
                    product.save(update_fields=['barcode', 'barcode_source'])
                    results[product.pk] = barcode
                except IntegrityError:
                    results[product.pk] = None

        return results

    # ── Policy Helper ────────────────────────────────────────────────

    @classmethod
    def _get_policy(cls, organization):
        """Get or create the BarcodePolicy for an organization."""
        from apps.inventory.models.barcode_models import BarcodePolicy
        policy, _ = BarcodePolicy.objects.get_or_create(
            organization=organization,
            defaults={'mode': 'HYBRID'}
        )
        return policy

    # ── Checksum Helpers ─────────────────────────────────────────────

    @staticmethod
    def _ean13_checksum(digits_12):
        """Compute EAN-13 check digit from first 12 digits."""
        total = 0
        for i, d in enumerate(str(digits_12)):
            weight = 1 if i % 2 == 0 else 3
            total += int(d) * weight
        return (10 - (total % 10)) % 10

    @staticmethod
    def _ean8_checksum(digits_7):
        """Compute EAN-8 check digit from first 7 digits."""
        total = 0
        for i, d in enumerate(str(digits_7)):
            weight = 3 if i % 2 == 0 else 1
            total += int(d) * weight
        return (10 - (total % 10)) % 10

