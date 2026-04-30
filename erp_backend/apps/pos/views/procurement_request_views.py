"""
Procurement Request ViewSet
Lifecycle: PENDING → APPROVED → EXECUTED  or  REJECTED / CANCELLED.
Referenced by the PO Intelligence Grid's per-row Transfer ⇄ / Request 📨 actions.
"""
import logging
from datetime import timedelta
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status as drf_status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.views import TenantModelViewSet
from apps.pos.models.procurement_request_models import ProcurementRequest
from apps.pos.serializers.procurement_request_serializers import ProcurementRequestSerializer
from apps.pos.services.procurement_notifications import (
    create_review_task as _create_review_task,
    notify_assignees as _notify_assignees,
    update_review_task as _update_review_task,
)

logger = logging.getLogger(__name__)


class ProcurementRequestViewSet(TenantModelViewSet):
    queryset = ProcurementRequest.objects.all()
    serializer_class = ProcurementRequestSerializer

    # PO statuses that count as "the goods are still en route" — duplicate request blocked
    _PO_OPEN_STATUSES = (
        'DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'CONFIRMED',
        'IN_TRANSIT', 'PARTIALLY_RECEIVED',
    )

    def create(self, request, *args, **kwargs):
        """Type-aware duplicate guard.

        TRANSFER:
            Always allowed — the same product can have multiple concurrent
            transfer requests (different from/to warehouses). The (product,
            from_wh, to_wh) tuple is the natural uniqueness; if the operator
            wants to bump an existing identical route they should use the
            bump action instead. We block only the *exact same route* PENDING
            duplicate as a guardrail.

        PURCHASE:
            By default, only one PURCHASE in flight per product (single-source).
            Operators can flip the org setting `purchase_multi_source` to
            allow multiple concurrent PURCHASE requests for the same product
            (e.g. quoting from several suppliers at once).
        """
        product_id = request.data.get('product')
        request_type = (request.data.get('request_type') or '').upper()
        if not product_id:
            return super().create(request, *args, **kwargs)
        org = request.user.organization

        if request_type == 'TRANSFER':
            from_wh = request.data.get('from_warehouse') or None
            to_wh = request.data.get('to_warehouse') or None
            # Only block the exact same route still PENDING/APPROVED.
            same_route = ProcurementRequest.objects.filter(
                product_id=product_id, organization=org, request_type='TRANSFER',
                status__in=('PENDING', 'APPROVED'),
                from_warehouse_id=from_wh, to_warehouse_id=to_wh,
            ).order_by('-requested_at').first()
            if same_route:
                return Response({
                    'detail': (
                        f"This exact transfer route already has an active request "
                        f"(#{same_route.id}, {same_route.get_status_display()}). "
                        f"Use Bump to escalate it, or pick a different destination."
                    ),
                    'existing_request_id': same_route.id,
                    'existing_status': same_route.status,
                }, status=drf_status.HTTP_409_CONFLICT)
            return super().create(request, *args, **kwargs)

        if request_type == 'PURCHASE':
            # Read multi-source setting from the org config (lazy import).
            multi = False
            try:
                from erp.services import ConfigurationService
                cfg = ConfigurationService.get_setting(org, 'purchase_analytics_config', {}) or {}
                multi = bool(cfg.get('purchase_multi_source', False))
            except Exception:
                multi = False
            if not multi:
                # Single-source: block any active PURCHASE for this product
                existing = ProcurementRequest.objects.filter(
                    product_id=product_id, organization=org, request_type='PURCHASE',
                    status__in=('PENDING', 'APPROVED'),
                ).order_by('-requested_at').first()
                if not existing:
                    executed = ProcurementRequest.objects.filter(
                        product_id=product_id, organization=org,
                        request_type='PURCHASE', status='EXECUTED',
                    ).order_by('-requested_at').first()
                    if executed and (executed.source_po is None or executed.source_po.status in self._PO_OPEN_STATUSES):
                        existing = executed
                if existing:
                    return Response({
                        'detail': (
                            f"This product already has an active purchase request "
                            f"(#{existing.id}, {existing.get_status_display()}). "
                            f"Enable Multi-Source Purchasing in settings to allow concurrent purchase requests."
                        ),
                        'existing_request_id': existing.id,
                        'existing_status': existing.status,
                    }, status=drf_status.HTTP_409_CONFLICT)
            # Multi-source enabled: but still block exact-supplier duplicates
            supplier_id = request.data.get('supplier')
            if supplier_id:
                same_supplier = ProcurementRequest.objects.filter(
                    product_id=product_id, organization=org, request_type='PURCHASE',
                    status__in=('PENDING', 'APPROVED'),
                    supplier_id=supplier_id,
                ).order_by('-requested_at').first()
                if same_supplier:
                    return Response({
                        'detail': (
                            f"You already have a pending purchase request for this product "
                            f"with the same supplier (#{same_supplier.id}). "
                            f"Pick a different supplier or bump the existing request."
                        ),
                        'existing_request_id': same_supplier.id,
                        'existing_status': same_supplier.status,
                    }, status=drf_status.HTTP_409_CONFLICT)
            return super().create(request, *args, **kwargs)

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        instance = serializer.save(
            organization=self.request.user.organization,
            requested_by=self.request.user,
            status='PENDING',
        )
        # Best-effort fan-out: create review task + notify assignees.
        # Failures here MUST NOT roll back the request — they're side effects.
        _create_review_task(instance, event='created')
        _notify_assignees(instance, kind='created', actor=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        req = self.get_object()
        if req.status != 'PENDING':
            return Response(
                {'detail': f'Cannot approve — current status is {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'APPROVED'
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
        _notify_assignees(req, kind='approved', actor=request.user, also_requester=True)
        _update_review_task(req, event='approved', actor=request.user,
                            note=f"Approved by {request.user.username}")
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        req = self.get_object()
        if req.status != 'PENDING':
            return Response(
                {'detail': f'Cannot reject — current status is {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        reason = request.data.get('reason', '') or ''
        req.status = 'REJECTED'
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.notes = (req.notes or '') + f"\nRejected: {reason}"
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'notes'])
        _notify_assignees(req, kind='rejected', actor=request.user, reason=reason or '-', also_requester=True)
        _update_review_task(req, event='rejected', actor=request.user,
                            note=f"Rejected by {request.user.username}: {reason or '-'}")
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Mark approved request as executed — does NOT auto-create the transfer/PO,
        that's the operator's decision. Just flips the lifecycle state."""
        req = self.get_object()
        if req.status != 'APPROVED':
            return Response(
                {'detail': f'Cannot execute — current status is {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'EXECUTED'
        req.save(update_fields=['status'])
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=['post'], url_path='convert-to-po')
    def convert_to_po(self, request, pk=None):
        """
        Build a DRAFT PurchaseOrder from this request, link it via source_po,
        flip request to EXECUTED. Only valid for PURCHASE-type, APPROVED requests.
        Returns {po_id, po_url} for the frontend to navigate to.
        """
        from decimal import Decimal as D
        from django.db import transaction
        from apps.pos.models.purchase_order_models import PurchaseOrder, PurchaseOrderLine

        req = self.get_object()
        if req.request_type != 'PURCHASE':
            return Response({'detail': 'Only PURCHASE requests convert to a PO.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        if req.status != 'APPROVED':
            return Response({'detail': f'Cannot convert — current status is {req.status}.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        if req.source_po_id:
            return Response({'detail': 'Already linked to PO.', 'po_id': req.source_po_id})

        with transaction.atomic():
            unit_price = req.suggested_unit_price or getattr(req.product, 'cost_price_ht', None) or D('0')
            tax_rate = getattr(req.product, 'tva_rate', None) or D('0')
            po = PurchaseOrder.objects.create(
                organization=req.organization,
                supplier=req.supplier,
                supplier_name=getattr(req.supplier, 'name', '') or '',
                status='DRAFT',
                priority=req.priority,
                notes=f"Auto-generated from procurement request #{req.id}.\n{req.reason or ''}".strip(),
            )
            PurchaseOrderLine.objects.create(
                organization=req.organization,
                order=po,
                product=req.product,
                product_name=req.product.name,
                product_sku=req.product.sku,
                quantity=req.quantity,
                unit_price=unit_price,
                discount_percent=D('0'),
                tax_rate=tax_rate,
            )
            req.source_po = po
            req.status = 'EXECUTED'
            req.reviewed_by = request.user
            req.reviewed_at = timezone.now()
            req.save(update_fields=['source_po', 'status', 'reviewed_by', 'reviewed_at'])

        _notify_assignees(req, kind='converted', actor=request.user, po_id=po.id, also_requester=True)
        _update_review_task(req, event='converted', actor=request.user,
                            note=f"Converted to PO #{po.id} by {request.user.username}")
        return Response({
            'po_id': po.id,
            'po_url': f'/purchases/purchase-orders/{po.id}',
            **self.get_serializer(req).data,
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        req = self.get_object()
        if req.status in ('EXECUTED', 'CANCELLED'):
            return Response(
                {'detail': f'Already in terminal state {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'CANCELLED'
        req.save(update_fields=['status'])
        _update_review_task(req, event='cancelled', actor=request.user,
                            note=f"Cancelled by {request.user.username}")
        return Response(self.get_serializer(req).data)

    @action(detail=False, methods=['post'], url_path='bump')
    def bump(self, request):
        """
        POST /procurement-requests/bump/?product_id=N
          OR /procurement-requests/bump/  with body {"request_id": N}

        Reminder/escalation for an existing request — does NOT create a duplicate.
        Bumps priority one level (LOW → NORMAL → HIGH → URGENT), appends a
        timestamped reminder note. Returns the updated request.
        """
        request_id = request.data.get('request_id')
        product_id = request.query_params.get('product_id') or request.data.get('product_id')
        org = request.user.organization

        if request_id:
            try:
                req = ProcurementRequest.objects.get(id=request_id, organization=org)
            except ProcurementRequest.DoesNotExist:
                return Response({'detail': 'Request not found'}, status=drf_status.HTTP_404_NOT_FOUND)
        elif product_id:
            req = ProcurementRequest.objects.filter(
                product_id=product_id, organization=org,
                status__in=('PENDING', 'APPROVED'),
            ).order_by('-requested_at').first()
            if req is None:
                executed = ProcurementRequest.objects.filter(
                    product_id=product_id, organization=org, status='EXECUTED',
                ).order_by('-requested_at').first()
                if executed and (executed.source_po is None or executed.source_po.status in self._PO_OPEN_STATUSES):
                    req = executed
            if req is None:
                return Response({'detail': 'No active request found for this product'},
                                status=drf_status.HTTP_404_NOT_FOUND)
        else:
            return Response({'detail': 'request_id or product_id required'},
                            status=drf_status.HTTP_400_BAD_REQUEST)

        # Bump priority one level (no-op if already URGENT)
        ladder = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
        try:
            idx = ladder.index(req.priority)
        except ValueError:
            idx = 1  # treat unknown as NORMAL
        prev_priority = req.priority
        new_priority = ladder[min(idx + 1, len(ladder) - 1)]
        req.priority = new_priority

        # Append reminder note
        username = request.user.username if request.user else 'system'
        stamp = timezone.now().isoformat(timespec='seconds')
        line = f"[Reminder by {username} at {stamp}] priority {prev_priority} → {new_priority}"
        req.notes = (req.notes + '\n' + line) if req.notes else line

        req.last_bumped_at = timezone.now()
        req.bump_count = (req.bump_count or 0) + 1
        req.save(update_fields=['priority', 'notes', 'last_bumped_at', 'bump_count'])
        _notify_assignees(req, kind='bumped', actor=request.user,
                          prev_priority=prev_priority, new_priority=new_priority,
                          also_requester=True)
        _update_review_task(req, event='bumped', actor=request.user,
                            note=f"Bumped by {username}: priority {prev_priority} → {new_priority}")

        # ── Bump-while-PO-in-flight policy ─────────────────────────────────
        # If the request is already linked to a PO, the bump's effect depends
        # on where the PO is in its lifecycle:
        #   - Internal stages (DRAFT/SUBMITTED/APPROVED) — propagate the
        #     priority bump to the PO itself; reviewers see it on their list.
        #   - With supplier (SENT/CONFIRMED/IN_TRANSIT/PARTIALLY_RECEIVED) —
        #     priority is set in stone with the supplier, but we still record
        #     the bump as a comment on the PO so the buyer notices, and we
        #     return a hint string the UI can surface to the operator.
        # Anything else (RECEIVED/COMPLETED/REJECTED/CANCELLED) — no-op.
        po_hint = None
        po = req.source_po
        if po is not None:
            INTERNAL = {'DRAFT', 'SUBMITTED', 'APPROVED'}
            WITH_SUPPLIER = {'SENT', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'}
            try:
                if po.status in INTERNAL:
                    if po.priority != new_priority:
                        po.priority = new_priority
                        po.save(update_fields=['priority'])
                    po_hint = f"PO #{po.id} ({po.status.lower()}) priority bumped to {new_priority}."
                elif po.status in WITH_SUPPLIER:
                    # Goods are already with the supplier — internal priority
                    # change isn't actionable. Stamp the PO notes so the buyer
                    # sees the bump on the next refresh.
                    stamp_line = (
                        f"[Bump by {username} at {stamp}] linked request priority "
                        f"{prev_priority} → {new_priority}"
                    )
                    po.notes = (po.notes + '\n' + stamp_line) if po.notes else stamp_line
                    po.save(update_fields=['notes'])
                    po_hint = (
                        f"PO #{po.id} is already with the supplier ({po.status.lower()}). "
                        f"Priority recorded on the PO; contact the supplier to escalate."
                    )
            except Exception as e:
                logger.warning(f"[BUMP] Failed to propagate to PO #{po.id}: {e}")
                po_hint = f"Bumped, but couldn't update linked PO #{po.id}."

        return Response({
            'detail': f'Reminded — priority {prev_priority} → {new_priority}',
            'previous_priority': prev_priority,
            'new_priority': new_priority,
            'po_hint': po_hint,
            **self.get_serializer(req).data,
        })

    @action(detail=False, methods=['get'], url_path='suggest-quantity')
    def suggest_quantity(self, request):
        """
        GET /procurement-requests/suggest-quantity/?product_id=N
        Returns the proposed order quantity using the active PurchaseAnalyticsConfig:
            avg_daily_sales × proposed_qty_lead_days × proposed_qty_safety_multiplier
        Avg daily sales is computed from InventoryMovement (type='OUT') over the
        configured sales_avg_period_days window (default 180).
        Falls back to product.reorder_quantity, then min_stock_level × safety, then 1.
        """
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({'error': 'product_id required'}, status=drf_status.HTTP_400_BAD_REQUEST)
        try:
            product_id = int(product_id)
        except (TypeError, ValueError):
            return Response({'error': 'product_id must be an integer'}, status=drf_status.HTTP_400_BAD_REQUEST)

        try:
            from apps.inventory.models import Product, InventoryMovement
        except ImportError:
            return Response({'suggested_qty': 1, 'source': 'fallback', 'reason': 'inventory module unavailable'})

        org = request.user.organization
        try:
            product = Product.objects.get(id=product_id, organization=org)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=drf_status.HTTP_404_NOT_FOUND)

        try:
            from erp.services import ConfigurationService
            cfg = ConfigurationService.get_setting(org, 'purchase_analytics_config', {}) or {}
        except Exception:
            cfg = {}

        period = int(cfg.get('sales_avg_period_days') or 180)
        lead_days = int(cfg.get('proposed_qty_lead_days') or 14)
        safety = Decimal(str(cfg.get('proposed_qty_safety_multiplier') or '1.5'))

        cutoff = timezone.now() - timedelta(days=period)
        total_out = InventoryMovement.objects.filter(
            product=product, organization=org, type='OUT', created_at__gte=cutoff,
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
        avg_daily = total_out / Decimal(period) if period > 0 else Decimal('0')

        suggested = avg_daily * Decimal(lead_days) * safety
        source = 'formula'
        reason = f'avg_daily ({avg_daily:.4f}) × lead_days ({lead_days}) × safety ({safety})'

        if suggested <= 0:
            reorder = getattr(product, 'reorder_quantity', None)
            if reorder and reorder > 0:
                suggested = Decimal(str(reorder))
                source = 'reorder_quantity'
                reason = 'no recent sales — used product.reorder_quantity'
            else:
                min_stock = getattr(product, 'min_stock_level', None) or 0
                if min_stock and min_stock > 0:
                    suggested = Decimal(str(min_stock)) * safety
                    source = 'min_stock'
                    reason = f'no recent sales — used min_stock ({min_stock}) × safety ({safety})'
                else:
                    suggested = Decimal('1')
                    source = 'fallback'
                    reason = 'no sales history, no thresholds configured'

        from math import ceil
        return Response({
            'product_id': product.id,
            'suggested_qty': int(ceil(float(suggested))),
            'source': source,
            'reason': reason,
            'inputs': {
                'avg_daily_sales': float(avg_daily),
                'sales_avg_period_days': period,
                'proposed_qty_lead_days': lead_days,
                'proposed_qty_safety_multiplier': float(safety),
            },
        })
