from apps.inventory.models import (
    Brand,
    Category,
    ComboComponent,
    Inventory,
    InventoryMovement,
    OperationalRequestLine,
    Parfum,
    Product,
    ProductGroup,
    ProductPackaging,
    Unit,
)
from apps.inventory.serializers import (
    ComboComponentSerializer,
    ProductCreateSerializer,
    ProductSerializer,
    StorefrontProductSerializer,
)
from .base import (
    AnonRateThrottle,
    Coalesce,
    Count,
    DecimalField,
    Organization,
    Q,
    Response,
    Sum,
    TenantModelViewSet,
    _get_org_or_400,
    action,
    permissions,
    status,
    timezone,
    timedelta,
    transaction,
)
from erp.mixins import UDLEViewSetMixin


from .product_bulk import ProductBulkMixin
from .product_analytics import ProductAnalyticsMixin
from .product_combo import ProductComboMixin
from .product_storefront import ProductStorefrontMixin
from erp.permissions import InventoryReadOnlyOrManage
from apps.inventory.services.product_completeness import ProductCompletenessService

from rest_framework.pagination import PageNumberPagination

class ProductPagePagination(PageNumberPagination):
    """Products page uses offset pagination (needs `count` for the frontend grid)."""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500

class ProductViewSet(ProductBulkMixin, ProductAnalyticsMixin, ProductComboMixin, ProductStorefrontMixin, UDLEViewSetMixin, TenantModelViewSet):
    permission_classes = [permissions.IsAuthenticated, InventoryReadOnlyOrManage]
    pagination_class = ProductPagePagination
    queryset = Product.objects.select_related(
        'brand', 'country', 'category', 'unit', 'parfum', 'size_unit', 'product_group'
    ).all()

    serializer_class = ProductSerializer

    def get_serializer_class(self):
        # Pickers / dropdowns can request a skinny payload with
        # ``?lite=1`` — it drops the nested serializers and
        # per-row SerializerMethodFields that make the default
        # shape expensive for large lists.
        if self.action == 'list' and self.request.query_params.get('lite') in ('1', 'true', 'yes'):
            from apps.inventory.serializers import ProductLiteSerializer
            return ProductLiteSerializer
        return super().get_serializer_class()

    filterset_fields = ['category', 'brand', 'unit', 'product_type', 'is_active', 'tracks_serials',
                        'data_completeness_level', 'is_verified', 'status']

    search_fields = ['name', 'sku', 'barcode', 'description']

    ordering_fields = ['name', 'sku', 'selling_price_ttc', 'cost_price', 'stock_level',
                       'created_at', 'data_completeness_level']

    def perform_update(self, serializer):
        """Refresh completeness level after any product field update."""
        instance = serializer.save()
        ProductCompletenessService.refresh(instance, save=True)
        return instance

    # ── Product Completeness Summary ────────────────────────────────
    @action(detail=False, methods=['get'], url_path='completeness-summary')
    def completeness_summary(self, request):
        """Returns count of products per completeness level + separate sellable/verified counts."""
        from django.db.models import Count, Q
        org = _get_org_or_400(request)
        if isinstance(org, Response):
            return org

        base_qs = Product.objects.filter(organization=org, is_active=True)

        # Level breakdown
        level_data = (
            base_qs
            .values('data_completeness_level')
            .annotate(count=Count('id'))
            .order_by('data_completeness_level')
        )

        labels = Product.COMPLETENESS_LABELS
        levels = [
            {
                'level': row['data_completeness_level'],
                'label': labels.get(row['data_completeness_level'], 'Unknown'),
                'count': row['count'],
            }
            for row in level_data
        ]

        # Separate operational counts
        total = base_qs.count()
        verified_count = base_qs.filter(is_verified=True).count()
        sellable_count = base_qs.filter(selling_price_ttc__gt=0).count()
        needs_completion = base_qs.filter(data_completeness_level__lt=7).count()

        return Response({
            'total': total,
            'levels': levels,
            'verified_count': verified_count,
            'sellable_count': sellable_count,
            'needs_completion_count': needs_completion,
        })

    # ── Verify / Unverify Product ────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='verify')
    def verify_product(self, request, pk=None):
        """Mark a product as verified by the current user (governance approval)."""
        product = self.get_object()
        if product.is_verified:
            return Response({'detail': 'Product is already verified.'}, status=status.HTTP_400_BAD_REQUEST)

        product.is_verified = True
        product.verified_at = timezone.now()
        product.verified_by = request.user
        product.save(update_fields=['is_verified', 'verified_at', 'verified_by', 'updated_at'])

        # Audit trail
        from apps.inventory.views.governance_views import _log_audit
        _log_audit(product, 'VERIFIED', request.user, {
            'level': product.data_completeness_level,
            'label': product.completeness_label,
        })

        return Response({
            'detail': 'Product verified.',
            'is_verified': True,
            'verified_at': product.verified_at.isoformat(),
            'verified_by': request.user.username,
        })

    @action(detail=True, methods=['post'], url_path='unverify')
    def unverify_product(self, request, pk=None):
        """Remove verification (e.g. after significant changes)."""
        product = self.get_object()
        if not product.is_verified:
            return Response({'detail': 'Product is not verified.'}, status=status.HTTP_400_BAD_REQUEST)

        product.is_verified = False
        product.verified_at = None
        product.verified_by = None
        product.save(update_fields=['is_verified', 'verified_at', 'verified_by', 'updated_at'])

        # Audit trail
        from apps.inventory.views.governance_views import _log_audit
        _log_audit(product, 'UNVERIFIED', request.user, {
            'reason': request.data.get('reason', 'Manual unverification'),
        })

        return Response({'detail': 'Product verification removed.', 'is_verified': False})

    # ── Completeness Detail (profile-aware) ──────────────────────────
    @action(detail=True, methods=['get'], url_path='completeness-detail')
    def completeness_detail(self, request, pk=None):
        """
        Returns detailed completeness info for a single product,
        including profile-aware missing requirements.
        """
        product = self.get_object()
        level = ProductCompletenessService.compute(product)
        missing = ProductCompletenessService.get_missing(product)
        profile = ProductCompletenessService.get_profile(product.product_type)

        return Response({
            'level': level,
            'label': product.COMPLETENESS_LABELS.get(level, 'Draft'),
            'max_level': profile['max_level'],
            'profile': product.product_type,
            'profile_label': profile['label'],
            'missing': missing,
            'is_sellable': product.is_sellable,
            'is_verified': product.is_verified,
            'verified_at': product.verified_at.isoformat() if product.verified_at else None,
            'verified_by': product.verified_by.username if product.verified_by else None,
            'is_complete': level >= profile['max_level'],
        })

    # ── Universal Barcode Resolution ────────────────────────────────
    @action(detail=False, methods=['get'], url_path='barcode-lookup')
    def barcode_lookup(self, request):
        """
        Scan-optimized lookup: checks Product.barcode first,
        then ProductPackaging.barcode. Returns product + packaging context.
        Used by POS terminal, purchase receiving, and inventory scanning.
        """
        code = request.query_params.get('code', '').strip()
        if not code:
            return Response({"error": "code parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        org = _get_org_or_400(request)
        if isinstance(org, Response):
            return org

        # 1. Try Product.barcode (base unit)
        product = Product.objects.filter(organization=org, barcode=code, is_active=True).first()
        if product:
            serializer = self.get_serializer(product)
            return Response({
                "source": "product",
                "product": serializer.data,
                "packaging": None,
            })

        # 2. Try ProductPackaging.barcode (package scan)
        pkg = ProductPackaging.objects.filter(
            organization=org, barcode=code, is_active=True
        ).select_related('product', 'unit').first()
        if pkg:
            product_serializer = self.get_serializer(pkg.product)
            return Response({
                "source": "packaging",
                "product": product_serializer.data,
                "packaging": {
                    "id": pkg.id,
                    "name": pkg.display_name,
                    "sku": pkg.sku,
                    "barcode": pkg.barcode,
                    "ratio": float(pkg.ratio),
                    "unit": pkg.unit.name if pkg.unit else None,
                    "unit_id": pkg.unit_id,
                    "level": pkg.level,
                    "selling_price_ttc": float(pkg.effective_selling_price),
                    "selling_price_ht": float(pkg.effective_selling_price_ht),
                    "purchase_price_ht": float(pkg.purchase_price_ht) if pkg.purchase_price_ht else None,
                    "weight_kg": float(pkg.weight_kg) if pkg.weight_kg else None,
                    "is_default_sale": pkg.is_default_sale,
                    "is_default_purchase": pkg.is_default_purchase,
                },
            })

        # 3. Try ProductVariant.barcode (variant scan)
        from apps.inventory.models.product_models import ProductVariant
        variant = ProductVariant.objects.filter(
            organization=org, barcode=code, is_active=True
        ).select_related('product').first()
        if variant:
            product_serializer = self.get_serializer(variant.product)
            return Response({
                "source": "variant",
                "product": product_serializer.data,
                "packaging": None,
                "variant": {
                    "id": variant.id,
                    "sku": variant.sku,
                    "barcode": variant.barcode,
                    "selling_price_ht": float(variant.selling_price_ht) if variant.selling_price_ht else None,
                    "selling_price_ttc": float(variant.selling_price_ttc) if variant.selling_price_ttc else None,
                },
            })

        return Response(
            {"error": f"No product, packaging, or variant found for barcode '{code}'"},
            status=status.HTTP_404_NOT_FOUND
        )

    @action(detail=True, methods=['get'])
    def active_operations(self, request, pk=None):
        product = self.get_object()
        operations = []

        # 1. Purchase Orders
        try:
            from erp.connector_registry import connector
            PurchaseOrderLine = connector.require('pos.purchase_order_lines.get_model', org_id=0, source='inventory')
            po_lines = PurchaseOrderLine.objects.filter(
                product=product,
                organization=product.organization,
                order__status__in=['SUBMITTED', 'APPROVED', 'ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED']
            ).select_related('order', 'order__supplier', 'order__warehouse', 'order__site', 'warehouse', 'order__rejected_by', 'order__cancelled_by')

            for line in po_lines:
                dest = line.warehouse.name if line.warehouse else (
                    line.order.warehouse.name if line.order.warehouse else (
                        line.order.site.name if line.order.site else 'Default Warehouse'
                    )
                )
                
                failed_by = None
                reason = None
                failure_type = None

                if line.order.status == 'REJECTED':
                    failed_by = f"{line.order.rejected_by.first_name} {line.order.rejected_by.last_name}".strip() if line.order.rejected_by else 'Unknown User'
                    reason = line.order.rejection_reason or 'No reason provided'
                    failure_type = 'INTERNAL_REJECTION'
                elif line.order.status == 'CANCELLED':
                    failed_by = f"{line.order.cancelled_by.first_name} {line.order.cancelled_by.last_name}".strip() if line.order.cancelled_by else 'Unknown User'
                    reason = line.order.cancellation_reason or line.order.notes or 'Supplier cancellation'
                    failure_type = 'SUPPLIER_FAILURE'

                # If it's fully received with ZERO discrepancies, we don't need to show it in the 'Active' pipeline 
                # UNLESS there are active discrepancies we need to flag.
                has_discrepancies = line.qty_missing > 0 or line.qty_damaged > 0 or line.qty_rejected > 0
                if line.order.status == 'RECEIVED' and not has_discrepancies:
                    continue

                discrepancies = {
                    'missing': float(line.qty_missing),
                    'damaged': float(line.qty_damaged),
                    'rejected': float(line.qty_rejected),
                    'notes': line.receipt_notes
                } if has_discrepancies else None

                operations.append({
                    'id': f"po-{line.id}",
                    'type': 'PURCHASE',
                    'status': line.order.status,
                    'reference': line.order.po_number or f"PO-{line.order.id}",
                    'quantity': float(line.quantity - line.qty_received),
                    'source': line.order.supplier.name if line.order.supplier else 'Unknown Supplier',
                    'destination': dest,
                    'date': line.order.created_at.isoformat() if line.order.created_at else None,
                    'failed_by': failed_by,
                    'reason': reason,
                    'failure_type': failure_type,
                    'discrepancies': discrepancies
                })
        except Exception as e:
            pass

        # 2. Strategy Manifests (StockTransferOrder)
        try:
            from apps.inventory.models import StockTransferLine
            manifest_lines = StockTransferLine.objects.filter(
                product=product,
                organization=product.organization,
                order__lifecycle_status__in=['OPEN', 'APPROVED', 'CANCELLED']
            ).select_related('order', 'from_warehouse', 'to_warehouse')

            for line in manifest_lines:
                operations.append({
                    'id': f"manifest-{line.id}",
                    'type': 'MANIFEST',
                    'status': line.order.lifecycle_status,
                    'reference': line.order.reference or f"TRF-{line.order.id}",
                    'quantity': float(line.qty_transferred),
                    'source': line.from_warehouse.name if line.from_warehouse else 'Unknown',
                    'destination': line.to_warehouse.name if line.to_warehouse else 'Unknown',
                    'date': line.order.created_at.isoformat() if line.order.created_at else None,
                    'reason': line.order.notes if line.order.lifecycle_status == 'CANCELLED' else None
                })
        except Exception as e:
            pass

        # 3. Execution Transfers (StockMove)
        try:
            from apps.inventory.models import StockMoveLine
            move_lines = StockMoveLine.objects.filter(
                product=product,
                organization=product.organization,
                move__status__in=['DRAFT', 'PENDING', 'IN_TRANSIT', 'CANCELLED']
            ).select_related('move', 'move__from_warehouse', 'move__to_warehouse')

            for line in move_lines:
                operations.append({
                    'id': f"move-{line.id}",
                    'type': 'TRANSFER',
                    'status': line.move.status,
                    'reference': line.move.ref_code or f"MOVE-{line.move.id}",
                    'quantity': float(line.quantity - line.quantity_done),
                    'source': line.move.from_warehouse.name if line.move.from_warehouse else 'Unknown',
                    'destination': line.move.to_warehouse.name if line.move.to_warehouse else 'Unknown',
                    'date': line.move.created_at.isoformat() if line.move.created_at else None,
                    'reason': line.move.notes if line.move.status == 'CANCELLED' else None
                })
        except Exception as e:
            pass

        operations.sort(key=lambda x: x['date'] or '', reverse=True)
        return Response(operations)

    # ── Package Management (CRUD for packaging levels) ──────────────
    @action(detail=True, methods=['get'], url_path='packaging')
    def list_packaging(self, request, pk=None):
        """List all packaging levels for a product."""
        product = self.get_object()
        packages = ProductPackaging.objects.filter(
            product=product, organization=product.organization
        ).select_related('unit').order_by('level')
        from apps.inventory.serializers import ProductPackagingSerializer
        serializer = ProductPackagingSerializer(packages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='packaging/create')
    def create_packaging(self, request, pk=None):
        """Create a new packaging level for a product."""
        product = self.get_object()
        from apps.inventory.serializers import ProductPackagingSerializer
        serializer = ProductPackagingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(product=product, organization=product.organization)
        # Refresh completeness after packaging added
        ProductCompletenessService.refresh(product, save=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path=r'packaging/(?P<pkg_id>\d+)')
    def update_packaging(self, request, pk=None, pkg_id=None):
        """Update a specific packaging level."""
        product = self.get_object()
        try:
            pkg = ProductPackaging.objects.get(
                id=pkg_id, product=product, organization=product.organization
            )
        except ProductPackaging.DoesNotExist:
            return Response({"error": "Package not found"}, status=status.HTTP_404_NOT_FOUND)

        from apps.inventory.serializers import ProductPackagingSerializer
        serializer = ProductPackagingSerializer(pkg, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # Refresh completeness after packaging updated
        ProductCompletenessService.refresh(product, save=True)
        return Response(serializer.data)

    @action(detail=True, methods=['delete'], url_path=r'packaging/(?P<pkg_id>\d+)/delete')
    def delete_packaging(self, request, pk=None, pkg_id=None):
        """Delete a packaging level (only if unused in transactions)."""
        product = self.get_object()
        try:
            pkg = ProductPackaging.objects.get(
                id=pkg_id, product=product, organization=product.organization
            )
        except ProductPackaging.DoesNotExist:
            return Response({"error": "Package not found"}, status=status.HTTP_404_NOT_FOUND)

        # Safety: don't delete if used in transactions
        if hasattr(pkg, 'order_lines') and pkg.order_lines.exists():
            return Response(
                {"error": "Cannot delete: used in POS sales. Deactivate it instead."},
                status=status.HTTP_409_CONFLICT
            )
        if hasattr(pkg, 'purchase_lines') and pkg.purchase_lines.exists():
            return Response(
                {"error": "Cannot delete: used in purchase orders. Deactivate it instead."},
                status=status.HTTP_409_CONFLICT
            )

        pkg.delete()
        # Refresh completeness after packaging removed
        ProductCompletenessService.refresh(product, save=True)
        return Response(status=status.HTTP_204_NO_CONTENT)
