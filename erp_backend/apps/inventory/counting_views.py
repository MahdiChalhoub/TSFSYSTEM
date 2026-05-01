"""
Stock Count ViewSets
======================
ViewSets for InventorySession and InventorySessionLine.
Provides CRUD + counting workflow endpoints.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q, Sum
from decimal import Decimal

from .counting_models import InventorySession, InventorySessionLine
from .counting_serializers import (
    InventorySessionSerializer,
    InventorySessionDetailSerializer,
    InventorySessionLineSerializer,
)
from .models import Product, Inventory, Warehouse, Category, StockAdjustmentOrder, StockAdjustmentLine


class InventorySessionViewSet(viewsets.ModelViewSet):
    """
    CRUD for inventory counting sessions.
    Custom actions:
      - POST /complete/ — mark counting finished → WAITING_VERIFICATION
      - POST /verify/ — manager verifies → VERIFIED
      - POST /adjust/ — create adjustment order → ADJUSTED
      - GET /filter-options/ — get available categories/suppliers for session creation
    """
    serializer_class = InventorySessionSerializer
    filterset_fields = ['status', 'warehouse']
    search_fields = ['reference', 'location', 'section']
    ordering_fields = ['session_date', 'created_at']

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        qs = InventorySession.objects.select_related('warehouse', 'created_by', 'adjustment_order')
        if org:
            qs = qs.filter(organization=org)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return InventorySessionDetailSerializer
        return InventorySessionSerializer

    def perform_create(self, serializer):
        """Create session and auto-populate counting lines from inventory."""
        org = getattr(self.request, 'organization', None)
        session = serializer.save(
            organization=org,
            created_by=self.request.user,
        )

        # Build product queryset based on filters
        products = Product.objects.filter(organization=org, is_active=True)

        if session.category_filter:
            products = products.filter(category__name=session.category_filter)
        if session.supplier_filter:
            products = products.filter(supplier=session.supplier_filter)

        # Qty filters (based on inventory totals)
        if session.qty_filter == 'zero':
            zero_ids = Inventory.objects.filter(
                organization=org, quantity=0
            ).values_list('product_id', flat=True)
            products = products.filter(id__in=zero_ids)
        elif session.qty_filter == 'non_zero':
            nonzero_ids = Inventory.objects.filter(
                organization=org, quantity__gt=0
            ).values_list('product_id', flat=True)
            products = products.filter(id__in=nonzero_ids)
        elif session.qty_filter == 'custom':
            inv_qs = Inventory.objects.filter(organization=org)
            if session.qty_min is not None:
                inv_qs = inv_qs.filter(quantity__gte=session.qty_min)
            if session.qty_max is not None:
                inv_qs = inv_qs.filter(quantity__lte=session.qty_max)
            custom_ids = inv_qs.values_list('product_id', flat=True)
            products = products.filter(id__in=custom_ids)

        # Create counting lines with system qty from inventory
        lines_to_create = []
        for product in products:
            # Get system qty from inventory for the target warehouse
            inv_qs = Inventory.objects.filter(product=product, organization=org)
            if session.warehouse:
                inv_qs = inv_qs.filter(warehouse=session.warehouse)
            system_qty = inv_qs.aggregate(total=Sum('quantity'))['total'] or Decimal('0')

            lines_to_create.append(InventorySessionLine(
                session=session,
                product=product,
                system_qty=system_qty,
            ))

        InventorySessionLine.objects.bulk_create(lines_to_create)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark counting finished → WAITING_VERIFICATION."""
        session = self.get_object()
        if session.status != 'IN_PROGRESS':
            return Response(
                {'error': 'Session must be IN_PROGRESS to complete'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check that at least some items are counted
        uncounted = session.lines.filter(
            physical_qty_person1__isnull=True,
            physical_qty_person2__isnull=True,
        ).count()

        if uncounted == session.lines.count():
            return Response(
                {'error': 'No items have been counted yet'},
                status=status.HTTP_400_BAD_REQUEST
            )

        session.status = 'WAITING_VERIFICATION'
        session.save()
        return Response({'success': True, 'status': session.status})

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Manager verifies the count → VERIFIED."""
        session = self.get_object()
        if session.status != 'WAITING_VERIFICATION':
            return Response(
                {'error': 'Session must be WAITING_VERIFICATION to verify'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark all lines as verified
        session.lines.update(is_verified=True)
        session.status = 'VERIFIED'
        session.save()
        return Response({'success': True, 'status': session.status})

    @action(detail=True, methods=['post'])
    def adjust(self, request, pk=None):
        """Create stock adjustment order from verified lines that need adjustment → ADJUSTED."""
        session = self.get_object()
        if session.status not in ('VERIFIED', 'WAITING_VERIFICATION'):
            return Response(
                {'error': 'Session must be VERIFIED or WAITING_VERIFICATION to adjust'},
                status=status.HTTP_400_BAD_REQUEST
            )

        org = getattr(request, 'organization', None)
        lines_needing_adj = session.lines.filter(needs_adjustment=True, is_adjusted=False)

        if not lines_needing_adj.exists():
            return Response(
                {'error': 'No lines need adjustment'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create a stock adjustment order
        warehouse = session.warehouse or Warehouse.objects.filter(organization=org).first()
        adj_order = StockAdjustmentOrder.objects.create(
            organization=org,
            reference=f"COUNT-{session.pk}",
            date=timezone.now().date(),
            warehouse=warehouse,
            reason=f"Stock count adjustment from session {session.reference or session.pk}",
            created_by=request.user,
        )

        total_qty_adj = Decimal('0')
        total_amount_adj = Decimal('0')

        for line in lines_needing_adj.select_related('product'):
            # Use person1 difference as primary
            diff = line.difference_person1 if line.difference_person1 is not None else line.difference_person2
            if diff is None or diff == 0:
                continue

            StockAdjustmentLine.objects.create(
                order=adj_order,
                product=line.product,
                qty_adjustment=diff,
                warehouse=warehouse,
                reason=f"Count: system={line.system_qty}, physical={line.physical_qty_person1 or line.physical_qty_person2}",
                added_by=request.user,
            )
            total_qty_adj += diff
            line.is_adjusted = True
            line.save(update_fields=['is_adjusted'])

        adj_order.total_qty_adjustment = total_qty_adj
        adj_order.total_amount_adjustment = total_amount_adj
        adj_order.save()

        session.adjustment_order = adj_order
        session.status = 'ADJUSTED'
        session.save()

        return Response({
            'success': True,
            'adjustment_order_id': adj_order.pk,
            'adjustments_created': lines_needing_adj.count(),
        })

    @action(detail=False, methods=['get'], url_path='filter-options')
    def filter_options(self, request):
        """Return available categories, suppliers, and warehouses for session creation."""
        org = getattr(request, 'organization', None)

        categories = list(
            Category.objects.filter(organization=org)
            .values_list('name', flat=True)
            .distinct()
        )

        from erp.connector_registry import connector
        Contact = connector.require('crm.contacts.get_model', org_id=org.id if org else 0)
        if Contact is not None:
            suppliers = list(
                Contact.objects.filter(organization=org, is_supplier=True)
                .values('id', 'company_name')
            )
        else:
            suppliers = []

        warehouses = list(
            Warehouse.objects.filter(organization=org, is_active=True)
            .values('id', 'name', 'code')
        )

        return Response({
            'categories': categories,
            'suppliers': suppliers,
            'warehouses': warehouses,
        })

    @action(detail=False, methods=['get'], url_path='product-count')
    def product_count(self, request):
        """Preview how many products match the given filters."""
        org = getattr(request, 'organization', None)
        products = Product.objects.filter(organization=org, is_active=True)

        category = request.query_params.get('category')
        supplier_id = request.query_params.get('supplier_id')
        qty_filter = request.query_params.get('qty_filter')
        qty_min = request.query_params.get('qty_min')
        qty_max = request.query_params.get('qty_max')

        if category:
            products = products.filter(category__name=category)
        if supplier_id:
            products = products.filter(supplier_id=supplier_id)

        if qty_filter == 'zero':
            zero_ids = Inventory.objects.filter(
                organization=org, quantity=0
            ).values_list('product_id', flat=True)
            products = products.filter(id__in=zero_ids)
        elif qty_filter == 'non_zero':
            nonzero_ids = Inventory.objects.filter(
                organization=org, quantity__gt=0
            ).values_list('product_id', flat=True)
            products = products.filter(id__in=nonzero_ids)
        elif qty_filter == 'custom':
            inv_qs = Inventory.objects.filter(organization=org)
            if qty_min:
                inv_qs = inv_qs.filter(quantity__gte=qty_min)
            if qty_max:
                inv_qs = inv_qs.filter(quantity__lte=qty_max)
            custom_ids = inv_qs.values_list('product_id', flat=True)
            products = products.filter(id__in=custom_ids)

        return Response({'total': products.count()})


class InventorySessionLineViewSet(viewsets.ModelViewSet):
    """
    CRUD for session lines. 
    Custom actions:
      - PATCH /<id>/submit-count/ — submit physical qty for person 1 or 2
      - POST /<id>/verify-line/ — verify a single line
      - POST /<id>/unverify-line/ — un-verify a single line
    """
    serializer_class = InventorySessionLineSerializer
    filterset_fields = ['session', 'is_verified', 'needs_adjustment', 'is_adjusted']

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        qs = InventorySessionLine.objects.select_related(
            'product', 'product__category', 'product__brand', 'session'
        )
        if org:
            qs = qs.filter(session__organization=org)

        # Filter by session if provided
        session_id = self.request.query_params.get('session_id')
        if session_id:
            qs = qs.filter(session_id=session_id)

        return qs

    @action(detail=True, methods=['patch'], url_path='submit-count')
    def submit_count(self, request, pk=None):
        """Submit physical count for person 1 or person 2."""
        line = self.get_object()
        person = request.data.get('person', 1)
        physical_qty = request.data.get('physical_qty')

        if physical_qty is None:
            return Response(
                {'error': 'physical_qty is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        physical_qty = Decimal(str(physical_qty))

        if person == 1:
            line.physical_qty_person1 = physical_qty
        elif person == 2:
            line.physical_qty_person2 = physical_qty
        else:
            return Response(
                {'error': 'person must be 1 or 2'},
                status=status.HTTP_400_BAD_REQUEST
            )

        line.compute_differences()
        line.save()

        return Response(InventorySessionLineSerializer(line).data)

    @action(detail=True, methods=['post'], url_path='verify-line')
    def verify_line(self, request, pk=None):
        """Verify a single counting line."""
        line = self.get_object()
        line.is_verified = True
        line.save(update_fields=['is_verified'])
        return Response({'success': True})

    @action(detail=True, methods=['post'], url_path='unverify-line')
    def unverify_line(self, request, pk=None):
        """Un-verify a single counting line."""
        line = self.get_object()
        line.is_verified = False
        line.save(update_fields=['is_verified'])
        return Response({'success': True})
