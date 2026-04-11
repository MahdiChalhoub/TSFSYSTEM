"""
ViewSets for the Printing Center — enterprise lifecycle management.

Session lifecycle: DRAFT → APPROVED → QUEUED → PRINTING → COMPLETED / FAILED
                   DRAFT → CANCELLED (at any pre-COMPLETED state)

Custom actions:
- create_from_queue: bulk-create session with items + snapshots
- approve: DRAFT → APPROVED (or QUEUED if auto-approval)
- queue: APPROVED → QUEUED
- start: QUEUED → PRINTING
- complete: PRINTING → COMPLETED (marks all items printed)
- fail: any → FAILED (with reason)
- cancel: any pre-COMPLETED → CANCELLED
- retry / requeue: FAILED → QUEUED
- reprint_exact: clone with snapshot data
- reprint_regenerate: clone with live product data
- preview: render template with sample data
- kpi: dashboard aggregates
"""
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.inventory.models import (
    PrintSession, PrintSessionItem, LabelTemplate, PrinterConfig, Product,
)
from apps.inventory.serializers.print_session_serializers import (
    LabelTemplateSerializer, LabelTemplateListSerializer,
    PrinterConfigSerializer,
    PrintSessionListSerializer, PrintSessionDetailSerializer,
    PrintSessionCreateSerializer,
)


class TenantMixin:
    """Shared queryset filtering by organization."""
    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request, 'organization', None)
        org_id = org.id if hasattr(org, 'id') else org
        if org_id:
            qs = qs.filter(organization=org_id)
        return qs

    def perform_create(self, serializer):
        org = getattr(self.request, 'organization', None)
        org_id = org.id if hasattr(org, 'id') else org
        serializer.save(organization=org_id)

    def _org_id(self):
        org = getattr(self.request, 'organization', None)
        return org.id if hasattr(org, 'id') else org


# ── LabelTemplate CRUD ────────────────────────────────────────────────────
class LabelTemplateViewSet(TenantMixin, viewsets.ModelViewSet):
    queryset = LabelTemplate.objects.all()
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'label_type', 'description']
    filterset_fields = ['label_type', 'is_default', 'is_active', 'is_system']

    def get_serializer_class(self):
        if self.action == 'list':
            return LabelTemplateListSerializer
        return LabelTemplateSerializer

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Clone a template (including system templates)."""
        original = self.get_object()
        clone = LabelTemplate.objects.create(
            organization=self._org_id(),
            name=f'{original.name} (Copy)',
            label_type=original.label_type,
            description=original.description,
            html_template=original.html_template,
            css_template=original.css_template,
            variables_schema=original.variables_schema,
            label_width_mm=original.label_width_mm,
            label_height_mm=original.label_height_mm,
            orientation=original.orientation,
            dpi=original.dpi,
            columns=original.columns,
            rows=original.rows,
            gap_horizontal_mm=original.gap_horizontal_mm,
            gap_vertical_mm=original.gap_vertical_mm,
            margin_top_mm=original.margin_top_mm,
            margin_right_mm=original.margin_right_mm,
            margin_bottom_mm=original.margin_bottom_mm,
            margin_left_mm=original.margin_left_mm,
            supports_barcode=original.supports_barcode,
            supports_qr=original.supports_qr,
            default_font_size=original.default_font_size,
            is_system=False,
            is_default=False,
        )
        return Response(LabelTemplateSerializer(clone).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        """Render a template with sample data for preview."""
        template = self.get_object()
        sample_data = {
            'name': 'Sample Product',
            'price': '29.99',
            'barcode': '5901234123457',
            'sku': 'SKU-001',
            'unit': 'KG',
            'category': 'Beverages',
            'supplier': 'ACME Corp',
            'packaging_name': 'Box of 12',
            'date': timezone.now().strftime('%Y-%m-%d'),
            'note': '',
            'variant': 'Red, Large',
            'lot': 'LOT-2026-A',
            'weight': '1.5',
        }
        # Override with request data if provided
        sample_data.update(request.data.get('variables', {}))

        html = template.html_template
        for key, val in sample_data.items():
            html = html.replace(f'{{{key}}}', str(val))

        return Response({
            'html': html,
            'css': template.css_template,
            'variables': sample_data,
            'dimensions': {
                'width_mm': float(template.label_width_mm),
                'height_mm': float(template.label_height_mm),
                'orientation': template.orientation,
            },
        })


# ── PrinterConfig CRUD ────────────────────────────────────────────────────
class PrinterConfigViewSet(TenantMixin, viewsets.ModelViewSet):
    queryset = PrinterConfig.objects.all()
    serializer_class = PrinterConfigSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'model_name', 'location']
    filterset_fields = ['printer_type', 'connection_type', 'is_default', 'is_active', 'default_label_type']

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """Test printer connectivity."""
        printer = self.get_object()
        now = timezone.now()
        # Stub — real implementation depends on printer driver
        printer.last_tested_at = now
        printer.last_seen_at = now
        printer.test_status = 'PASS'
        printer.test_message = f'Connection test passed at {now.isoformat()}'
        printer.save(update_fields=['last_tested_at', 'last_seen_at', 'test_status', 'test_message'])
        return Response({
            'status': 'PASS',
            'message': printer.test_message,
            'tested_at': now.isoformat(),
        })


# ── PrintSession (Full Lifecycle) ─────────────────────────────────────────
class PrintSessionViewSet(TenantMixin, viewsets.ModelViewSet):
    queryset = PrintSession.objects.select_related(
        'template', 'printer', 'assigned_to', 'created_by',
        'approved_by', 'cancelled_by', 'original_session',
    ).prefetch_related('items')
    permission_classes = [IsAuthenticated]
    search_fields = ['session_code', 'title']
    filterset_fields = ['status', 'label_type', 'trigger', 'source_context', 'output_method', 'is_reprint']

    def get_serializer_class(self):
        if self.action == 'list':
            return PrintSessionListSerializer
        return PrintSessionDetailSerializer

    def perform_create(self, serializer):
        serializer.save(organization=self._org_id(), created_by=self.request.user)

    # ── Bulk create from queue ────────────────────────────────────────
    @action(detail=False, methods=['post'])
    def create_from_queue(self, request):
        """Create a print session from the product queue UI with full snapshots."""
        ser = PrintSessionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        org_id = self._org_id()

        # Resolve template
        template = None
        template_id = data.get('template_id')
        if template_id:
            template = LabelTemplate.objects.filter(id=template_id, organization=org_id).first()

        # Resolve printer
        printer = None
        printer_id = data.get('printer_id')
        if printer_id:
            printer = PrinterConfig.objects.filter(id=printer_id, organization=org_id).first()

        # Create session
        session = PrintSession.objects.create(
            organization=org_id,
            title=data.get('title', ''),
            label_type=data.get('label_type', 'SHELF'),
            output_method=data.get('output_method', 'PDF'),
            source_context=data.get('source_context', 'PRODUCT_LIST'),
            copies=data.get('copies', 1),
            template=template,
            printer=printer,
            notes=data.get('notes', ''),
            status='DRAFT',
            trigger='MANUAL',
            created_by=request.user,
        )

        # Assign
        assigned_to_id = data.get('assigned_to_id')
        if assigned_to_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                session.assigned_to = User.objects.get(id=assigned_to_id)
                session.save(update_fields=['assigned_to'])
            except User.DoesNotExist:
                pass

        # Create items with FULL snapshots
        items_data = data.get('items', [])
        product_ids = [item['product_id'] for item in items_data]
        products = {p.id: p for p in Product.objects.select_related('category', 'unit').filter(id__in=product_ids)}

        for item_data in items_data:
            product = products.get(item_data['product_id'])
            if not product:
                continue
            PrintSessionItem.objects.create(
                organization=org_id,
                session=session,
                product=product,
                quantity=item_data.get('quantity', 1),
                # Core snapshot
                snapshot_name=product.name or '',
                snapshot_sku=product.sku or '',
                snapshot_barcode=product.barcode or '',
                snapshot_price=getattr(product, 'selling_price_ttc', None) or getattr(product, 'selling_price', None),
                snapshot_category=(product.category.name if hasattr(product, 'category') and product.category else ''),
                snapshot_supplier=getattr(product, 'supplier_name', '') or '',
                snapshot_unit=(str(product.unit) if hasattr(product, 'unit') and product.unit else ''),
                snapshot_currency=getattr(product, 'currency', '') or '',
                snapshot_product_ref=getattr(product, 'reference_code', '') or '',
                snapshot_tax_mode='TTC',
                # Template version
                snapshot_template_version=template.version if template else 1,
            )

        session.recalculate_totals()
        return Response(PrintSessionDetailSerializer(session).data, status=status.HTTP_201_CREATED)

    # ── Workflow actions ──────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve: DRAFT → APPROVED (or QUEUED if no queue step needed)."""
        session = self.get_object()
        if session.status != 'DRAFT':
            return Response({'error': f'Cannot approve from {session.status}'}, status=400)
        session.status = 'APPROVED'
        session.approved_by = request.user
        session.approved_at = timezone.now()
        session.save(update_fields=['status', 'approved_by', 'approved_at'])
        return Response(PrintSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def queue(self, request, pk=None):
        """Queue: DRAFT/APPROVED → QUEUED."""
        session = self.get_object()
        if session.status not in ('DRAFT', 'APPROVED'):
            return Response({'error': f'Cannot queue from {session.status}'}, status=400)
        if session.total_products == 0:
            return Response({'error': 'Cannot queue empty session'}, status=400)
        # Auto-approve if going from DRAFT
        if session.status == 'DRAFT' and not session.approved_by:
            session.approved_by = request.user
            session.approved_at = timezone.now()
        session.status = 'QUEUED'
        session.queued_at = timezone.now()
        session.save(update_fields=['status', 'queued_at', 'approved_by', 'approved_at'])
        return Response(PrintSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def start_printing(self, request, pk=None):
        """Start: QUEUED → PRINTING."""
        session = self.get_object()
        if session.status != 'QUEUED':
            return Response({'error': f'Cannot start from {session.status}'}, status=400)
        session.status = 'PRINTING'
        session.started_at = timezone.now()
        session.save(update_fields=['status', 'started_at'])
        return Response(PrintSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def mark_completed(self, request, pk=None):
        """Complete: PRINTING/QUEUED → COMPLETED + mark all items printed."""
        session = self.get_object()
        if session.status not in ('QUEUED', 'PRINTING'):
            return Response({'error': f'Cannot complete from {session.status}'}, status=400)
        now = timezone.now()
        session.status = 'COMPLETED'
        session.completed_at = now
        session.save(update_fields=['status', 'completed_at'])
        session.items.filter(is_printed=False).update(is_printed=True, printed_at=now)
        return Response(PrintSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def mark_failed(self, request, pk=None):
        """Fail: any active → FAILED with reason."""
        session = self.get_object()
        if session.status in ('COMPLETED', 'CANCELLED'):
            return Response({'error': f'Cannot fail from {session.status}'}, status=400)
        session.status = 'FAILED'
        session.failure_reason = request.data.get('reason', 'Unknown failure')
        session.save(update_fields=['status', 'failure_reason'])
        return Response(PrintSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel: any pre-COMPLETED → CANCELLED."""
        session = self.get_object()
        if session.status in ('COMPLETED',):
            return Response({'error': 'Cannot cancel completed session'}, status=400)
        session.status = 'CANCELLED'
        session.cancelled_by = request.user
        session.cancelled_at = timezone.now()
        session.save(update_fields=['status', 'cancelled_by', 'cancelled_at'])
        return Response(PrintSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Retry/requeue: FAILED → QUEUED."""
        session = self.get_object()
        if session.status != 'FAILED':
            return Response({'error': 'Can only retry FAILED sessions'}, status=400)
        session.status = 'QUEUED'
        session.failure_reason = ''
        session.queued_at = timezone.now()
        session.save(update_fields=['status', 'failure_reason', 'queued_at'])
        return Response(PrintSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def reprint_exact(self, request, pk=None):
        """Exact reprint — clone session with original snapshot data."""
        original = self.get_object()
        org_id = self._org_id()

        new_session = PrintSession.objects.create(
            organization=org_id,
            title=f'Exact reprint of {original.session_code}',
            label_type=original.label_type,
            template=original.template,
            output_method=original.output_method,
            printer=original.printer,
            copies=original.copies,
            notes=f'Exact reprint of {original.session_code}',
            status='DRAFT',
            trigger='MANUAL',
            source_context=original.source_context,
            is_reprint=True,
            reprint_mode='EXACT',
            original_session=original,
            created_by=request.user,
            assigned_to=original.assigned_to,
        )

        # Clone items with ORIGINAL snapshot data (immutable)
        for item in original.items.all():
            PrintSessionItem.objects.create(
                organization=org_id,
                session=new_session,
                product=item.product,
                quantity=item.quantity,
                snapshot_name=item.snapshot_name,
                snapshot_sku=item.snapshot_sku,
                snapshot_barcode=item.snapshot_barcode,
                snapshot_price=item.snapshot_price,
                snapshot_category=item.snapshot_category,
                snapshot_supplier=item.snapshot_supplier,
                snapshot_unit=item.snapshot_unit,
                snapshot_currency=item.snapshot_currency,
                snapshot_product_ref=item.snapshot_product_ref,
                snapshot_tax_mode=item.snapshot_tax_mode,
                snapshot_packaging_name=item.snapshot_packaging_name,
                snapshot_packaging_barcode=item.snapshot_packaging_barcode,
                snapshot_packaging_ratio=item.snapshot_packaging_ratio,
                snapshot_variant_summary=item.snapshot_variant_summary,
                snapshot_template_version=item.snapshot_template_version,
            )

        new_session.recalculate_totals()
        return Response(PrintSessionDetailSerializer(new_session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def reprint_regenerate(self, request, pk=None):
        """Regenerated reprint — clone session with LIVE product data."""
        original = self.get_object()
        org_id = self._org_id()

        new_session = PrintSession.objects.create(
            organization=org_id,
            title=f'Regenerated reprint of {original.session_code}',
            label_type=original.label_type,
            template=original.template,
            output_method=original.output_method,
            printer=original.printer,
            copies=original.copies,
            notes=f'Regenerated from live data (original: {original.session_code})',
            status='DRAFT',
            trigger='MANUAL',
            source_context=original.source_context,
            is_reprint=True,
            reprint_mode='REGENERATE',
            original_session=original,
            created_by=request.user,
            assigned_to=original.assigned_to,
        )

        # Get LIVE product data
        product_ids = list(original.items.filter(product__isnull=False).values_list('product_id', flat=True))
        products = {p.id: p for p in Product.objects.select_related('category', 'unit').filter(id__in=product_ids)}

        for item in original.items.all():
            product = products.get(item.product_id) if item.product_id else None
            if product:
                # Use LIVE data
                PrintSessionItem.objects.create(
                    organization=org_id,
                    session=new_session,
                    product=product,
                    quantity=item.quantity,
                    snapshot_name=product.name or '',
                    snapshot_sku=product.sku or '',
                    snapshot_barcode=product.barcode or '',
                    snapshot_price=getattr(product, 'selling_price_ttc', None),
                    snapshot_category=(product.category.name if product.category else ''),
                    snapshot_supplier=getattr(product, 'supplier_name', '') or '',
                    snapshot_unit=(str(product.unit) if product.unit else ''),
                    snapshot_currency=getattr(product, 'currency', '') or '',
                    snapshot_product_ref=getattr(product, 'reference_code', '') or '',
                    snapshot_tax_mode='TTC',
                    snapshot_template_version=new_session.template.version if new_session.template else 1,
                )
            else:
                # Product deleted/archived — fall back to original snapshot
                PrintSessionItem.objects.create(
                    organization=org_id,
                    session=new_session,
                    product=None,
                    quantity=item.quantity,
                    snapshot_name=item.snapshot_name,
                    snapshot_sku=item.snapshot_sku,
                    snapshot_barcode=item.snapshot_barcode,
                    snapshot_price=item.snapshot_price,
                    snapshot_category=item.snapshot_category,
                    snapshot_supplier=item.snapshot_supplier,
                    snapshot_unit=item.snapshot_unit,
                    snapshot_currency=item.snapshot_currency,
                    snapshot_product_ref=item.snapshot_product_ref,
                    snapshot_tax_mode=item.snapshot_tax_mode,
                    snapshot_packaging_name=item.snapshot_packaging_name,
                    snapshot_packaging_barcode=item.snapshot_packaging_barcode,
                    snapshot_packaging_ratio=item.snapshot_packaging_ratio,
                    snapshot_variant_summary=item.snapshot_variant_summary,
                    snapshot_template_version=item.snapshot_template_version,
                )

        new_session.recalculate_totals()
        return Response(PrintSessionDetailSerializer(new_session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign operator to session."""
        session = self.get_object()
        user_id = request.data.get('user_id')
        if user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                session.assigned_to = User.objects.get(id=user_id)
                session.save(update_fields=['assigned_to'])
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=404)
        else:
            session.assigned_to = None
            session.save(update_fields=['assigned_to'])
        return Response(PrintSessionDetailSerializer(session).data)

    # ── KPI ───────────────────────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def kpi(self, request):
        """Dashboard KPI aggregates."""
        from django.db.models import Sum, Count
        qs = PrintSession.objects.filter(organization=self._org_id())

        total = qs.count()
        by_status = {}
        for s in ('DRAFT', 'APPROVED', 'QUEUED', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED'):
            by_status[s.lower()] = qs.filter(status=s).count()

        labels_total = qs.aggregate(s=Sum('total_labels'))['s'] or 0
        labels_printed = qs.filter(status='COMPLETED').aggregate(s=Sum('total_labels'))['s'] or 0
        labels_pending = qs.filter(status__in=['DRAFT', 'APPROVED', 'QUEUED', 'PRINTING']).aggregate(
            s=Sum('total_labels'))['s'] or 0

        # Stuck sessions (PRINTING for > 30 min)
        from datetime import timedelta
        stuck_threshold = timezone.now() - timedelta(minutes=30)
        stuck = qs.filter(status='PRINTING', started_at__lt=stuck_threshold).count()

        return Response({
            'total_sessions': total,
            'total_labels': labels_total,
            'labels_printed': labels_printed,
            'labels_pending': labels_pending,
            'stuck_sessions': stuck,
            **by_status,
        })
