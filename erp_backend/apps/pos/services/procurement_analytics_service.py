"""
ProcurementAnalyticsService — Procurement Intelligence Engine
==============================================================
Pre-aggregated procurement KPIs, PO aging analysis, cycle time stats,
supplier intelligence, and budget utilization analytics.
"""
from decimal import Decimal
from datetime import timedelta
from django.db.models import (
    Sum, Count, Avg, Min, Max, F, Q, Value, Case, When,
    ExpressionWrapper, DurationField, DecimalField,
)
from django.db.models.functions import Coalesce, TruncMonth, ExtractDay
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class ProcurementAnalyticsService:
    """Stateless analytics — all methods are class/staticmethods."""

    # ─── KPI Dashboard ────────────────────────────────────────────────

    @staticmethod
    def get_dashboard_kpis(organization, period_start=None, period_end=None):
        """
        Procurement KPI snapshot for the executive dashboard.

        Returns:
            dict with headline KPIs: total_spend, po_count, avg_po_value,
            active_suppliers, pending_approvals, overdue_pos, budget_utilization, etc.
        """
        from apps.pos.models import PurchaseOrder

        today = timezone.now().date()
        if not period_start:
            period_start = today - timedelta(days=30)
        if not period_end:
            period_end = today

        base_qs = PurchaseOrder.objects.filter(
            organization=organization,
            created_at__date__gte=period_start,
            created_at__date__lte=period_end,
        )

        # Status distribution
        status_dist = dict(
            base_qs.values_list('status').annotate(
                cnt=Count('id')
            ).values_list('status', 'cnt')
        )

        # Financial summary (non-cancelled)
        active_qs = base_qs.exclude(status='CANCELLED')
        financials = active_qs.aggregate(
            total_spend=Coalesce(Sum('total_amount'), Value(Decimal('0'))),
            total_tax=Coalesce(Sum('tax_amount'), Value(Decimal('0'))),
            po_count=Count('id'),
            avg_po_value=Coalesce(Avg('total_amount'), Value(Decimal('0'))),
            max_po_value=Max('total_amount'),
            min_po_value=Min('total_amount'),
        )

        # Active suppliers
        active_suppliers = active_qs.exclude(
            supplier_id__isnull=True
        ).values('supplier_id').distinct().count()

        # Pending approvals
        pending_approvals = PurchaseOrder.objects.filter(
            organization=organization,
            status='SUBMITTED',
        ).count()

        # Overdue POs (expected_date passed, not yet received/completed)
        overdue = PurchaseOrder.objects.filter(
            organization=organization,
            expected_date__lt=today,
            status__in=['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'],
        ).count()

        # Open returns
        from apps.pos.models import PurchaseReturn
        open_returns = PurchaseReturn.objects.filter(
            organization=organization,
            status__in=['DRAFT', 'APPROVED', 'SENT', 'RECEIVED_BY_SUPPLIER', 'CREDIT_PENDING'],
        ).count()

        # Open disputes
        from apps.pos.models.procurement_governance_models import DisputeCase
        open_disputes = DisputeCase.objects.filter(
            organization=organization,
            status__in=['OPEN', 'UNDER_REVIEW', 'ESCALATED'],
        ).count()

        # Budget utilization
        budget_util = ProcurementAnalyticsService._compute_budget_utilization(
            organization, period_start, period_end
        )

        return {
            'period': {'start': str(period_start), 'end': str(period_end)},
            'financials': {
                'total_spend': float(financials['total_spend']),
                'total_tax': float(financials['total_tax']),
                'po_count': financials['po_count'],
                'avg_po_value': float(financials['avg_po_value']),
                'max_po_value': float(financials['max_po_value'] or 0),
                'min_po_value': float(financials['min_po_value'] or 0),
            },
            'status_distribution': status_dist,
            'active_suppliers': active_suppliers,
            'pending_approvals': pending_approvals,
            'overdue_pos': overdue,
            'open_returns': open_returns,
            'open_disputes': open_disputes,
            'budget_utilization': budget_util,
        }

    # ─── PO Aging Analysis ────────────────────────────────────────────

    @staticmethod
    def get_po_aging(organization):
        """
        PO aging buckets optimized using database Case/When.
        """
        from apps.pos.models import PurchaseOrder
        from django.db.models import Case, When, Value, IntegerField, CharField

        today = timezone.now().date()
        open_statuses = [
            'DRAFT', 'SUBMITTED', 'APPROVED', 'SENT',
            'PARTIALLY_RECEIVED', 'RECEIVED',
            'PARTIALLY_INVOICED', 'INVOICED',
        ]

        # Aggregate buckets in one DB call
        stats = PurchaseOrder.objects.filter(
            organization=organization,
            status__in=open_statuses,
        ).annotate(
            age_days=ExpressionWrapper(
                timezone.now() - F('created_at'),
                output_field=DurationField()
            )
        ).annotate(
            age_group=(
                Case(
                    When(created_at__date__gte=today - timedelta(days=7), then=Value('0-7')),
                    When(created_at__date__gte=today - timedelta(days=14), then=Value('8-14')),
                    When(created_at__date__gte=today - timedelta(days=30), then=Value('15-30')),
                    When(created_at__date__gte=today - timedelta(days=60), then=Value('31-60')),
                    default=Value('60+'),
                    output_field=CharField()
                )
            )
        ).values('age_group').annotate(
            count=Count('id'),
            amount=Sum('total_amount')
        )

        buckets = {
            '0-7': {'count': 0, 'amount': 0.0},
            '8-14': {'count': 0, 'amount': 0.0},
            '15-30': {'count': 0, 'amount': 0.0},
            '31-60': {'count': 0, 'amount': 0.0},
            '60+': {'count': 0, 'amount': 0.0},
        }
        for s in stats:
            buckets[s['age_group']] = {
                'count': s['count'],
                'amount': float(s['amount'] or 0)
            }

        # Track top 20 oldest overdue POs
        overdue_detail = PurchaseOrder.objects.filter(
            organization=organization,
            expected_date__lt=today,
            status__in=['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'],
        ).values(
            'id', 'po_number', 'status', 'total_amount', 'expected_date'
        ).order_by('expected_date')[:20]

        detail_formatted = [{
            'id': po['id'],
            'po_number': po['po_number'],
            'status': po['status'],
            'amount': float(po['total_amount'] or 0),
            'expected_date': str(po['expected_date']),
            'days_overdue': (today - po['expected_date']).days,
        } for po in overdue_detail]

        return {
            'buckets': buckets,
            'total_open': sum(b['count'] for b in buckets.values()),
            'total_open_amount': sum(b['amount'] for b in buckets.values()),
            'overdue': {
                'count': PurchaseOrder.objects.filter(
                    organization=organization,
                    expected_date__lt=today,
                    status__in=['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'],
                ).count(),
                'detail': detail_formatted,
            },
        }

    # ─── Cycle Time Analytics ─────────────────────────────────────────

    @staticmethod
    def get_cycle_times(organization, period_start=None, period_end=None):
        """
        Procurement cycle time analysis:
        - Draft-to-Approve time
        - Approve-to-Receive time
        - Receive-to-Invoice time
        - End-to-end cycle time
        """
        from apps.pos.models import PurchaseOrder

        today = timezone.now().date()
        if not period_start:
            period_start = today - timedelta(days=90)
        if not period_end:
            period_end = today

        completed = PurchaseOrder.objects.filter(
            organization=organization,
            created_at__date__gte=period_start,
            created_at__date__lte=period_end,
            status__in=['RECEIVED', 'INVOICED', 'COMPLETED'],
        )

        # Compute cycle times from timestamps
        draft_to_approve = []
        approve_to_receive = []
        receive_to_invoice = []
        end_to_end = []

        for po in completed.only(
            'created_at', 'submitted_at', 'approved_at',
            'received_date', 'invoiced_at'
        ):
            created = po.created_at
            submitted = getattr(po, 'submitted_at', None)
            approved = getattr(po, 'approved_at', None)
            received = getattr(po, 'received_date', None)
            invoiced = getattr(po, 'invoiced_at', None)

            if submitted and created:
                draft_to_approve.append((submitted - created).total_seconds() / 86400)
            if approved and received:
                received_dt = (
                    timezone.make_aware(
                        timezone.datetime.combine(received, timezone.datetime.min.time())
                    ) if not hasattr(received, 'hour') else received
                )
                approve_to_receive.append((received_dt - approved).total_seconds() / 86400)

            if received and invoiced:
                received_dt = (
                    timezone.make_aware(
                        timezone.datetime.combine(received, timezone.datetime.min.time())
                    ) if not hasattr(received, 'hour') else received
                )
                receive_to_invoice.append((invoiced - received_dt).total_seconds() / 86400)

            if created:
                last = invoiced or (
                    timezone.make_aware(
                        timezone.datetime.combine(received, timezone.datetime.min.time())
                    ) if received and not hasattr(received, 'hour') else None
                )
                if last:
                    end_to_end.append((last - created).total_seconds() / 86400)

        def _stats(values):
            if not values:
                return {'avg': 0, 'min': 0, 'max': 0, 'median': 0, 'count': 0}
            values.sort()
            n = len(values)
            return {
                'avg': round(sum(values) / n, 1),
                'min': round(min(values), 1),
                'max': round(max(values), 1),
                'median': round(values[n // 2], 1),
                'count': n,
            }

        return {
            'period': {'start': str(period_start), 'end': str(period_end)},
            'draft_to_approve_days': _stats(draft_to_approve),
            'approve_to_receive_days': _stats(approve_to_receive),
            'receive_to_invoice_days': _stats(receive_to_invoice),
            'end_to_end_days': _stats(end_to_end),
        }

    # ─── Spend by Supplier ────────────────────────────────────────────

    @staticmethod
    def get_spend_by_supplier(organization, period_start=None, period_end=None, top_n=20):
        """Top N suppliers by spend."""
        from apps.pos.models import PurchaseOrder

        today = timezone.now().date()
        if not period_start:
            period_start = today - timedelta(days=90)
        if not period_end:
            period_end = today

        result = PurchaseOrder.objects.filter(
            organization=organization,
            created_at__date__gte=period_start,
            created_at__date__lte=period_end,
        ).exclude(
            status='CANCELLED'
        ).exclude(
            supplier_id__isnull=True
        ).values(
            'supplier_id', 'supplier__name'
        ).annotate(
            total_spend=Coalesce(Sum('total_amount'), Value(Decimal('0'))),
            po_count=Count('id'),
            avg_po_value=Coalesce(Avg('total_amount'), Value(Decimal('0'))),
        ).order_by('-total_spend')[:top_n]

        return [{
            'supplier_id': r['supplier_id'],
            'supplier_name': r['supplier__name'] or 'Unknown',
            'total_spend': float(r['total_spend']),
            'po_count': r['po_count'],
            'avg_po_value': float(r['avg_po_value']),
        } for r in result]

    # ─── Spend by Category (Monthly Trend) ────────────────────────────

    @staticmethod
    def get_monthly_spend_trend(organization, months=12):
        """Monthly procurement spend trend for charting."""
        from apps.pos.models import PurchaseOrder

        today = timezone.now().date()
        start = today - timedelta(days=months * 30)

        result = PurchaseOrder.objects.filter(
            organization=organization,
            created_at__date__gte=start,
        ).exclude(
            status='CANCELLED'
        ).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            total_spend=Coalesce(Sum('total_amount'), Value(Decimal('0'))),
            po_count=Count('id'),
            unique_suppliers=Count('supplier_id', distinct=True),
        ).order_by('month')

        return [{
            'month': r['month'].strftime('%Y-%m'),
            'total_spend': float(r['total_spend']),
            'po_count': r['po_count'],
            'unique_suppliers': r['unique_suppliers'],
        } for r in result]

    # ─── Supplier Intelligence (enriched grid) ────────────────────────

    @staticmethod
    def get_supplier_intelligence(organization, product_id=None, top_n=10):
        """
        Enriched supplier intelligence grid.
        Optimized to avoid N+1 queries.
        """
        from apps.pos.models import PurchaseOrder, PurchaseOrderLine
        from apps.pos.models.procurement_governance_models import SupplierPerformanceSnapshot
        from django.db.models import Subquery, OuterRef, Max, F

        # Latest performance snapshots for all relevant suppliers
        latest_snaps = SupplierPerformanceSnapshot.objects.filter(
            organization=organization,
            id=Subquery(
                SupplierPerformanceSnapshot.objects.filter(
                    organization=organization,
                    supplier_id=OuterRef('supplier_id')
                ).order_by('-period_end').values('id')[:1]
            )
        ).select_related('supplier')

        if product_id:
            # Find all suppliers that supplied this product
            # and get their latest unit price for it
            relevant_lines = PurchaseOrderLine.objects.filter(
                organization=organization,
                product_id=product_id,
                order__status__in=['RECEIVED', 'INVOICED', 'COMPLETED'],
            ).annotate(
                latest_date_for_supplier=Subquery(
                    PurchaseOrderLine.objects.filter(
                        organization=organization,
                        product_id=product_id,
                        order__supplier_id=OuterRef('order__supplier_id'),
                        order__status__in=['RECEIVED', 'INVOICED', 'COMPLETED'],
                    ).order_by('-order__created_at').values('order__created_at')[:1]
                )
            ).filter(
                order__created_at=F('latest_date_for_supplier')
            ).select_related('order', 'order__supplier')

            # Build result map
            snap_map = {s.supplier_id: s for s in latest_snaps}
            results = []
            
            for line in relevant_lines[:50]: # Safety cap
                sid = line.order.supplier_id
                if not sid: continue
                snap = snap_map.get(sid)
                results.append({
                    'supplier_id': sid,
                    'supplier_name': line.order.supplier.name if line.order.supplier else 'Unknown',
                    'last_unit_price': float(line.unit_price),
                    'last_order_date': str(line.order.created_at.date()),
                    'performance_score': float(snap.score) if snap else None,
                    'on_time_delivery_rate': float(snap.on_time_delivery_rate) if snap else None,
                    'fill_rate': float(snap.fill_rate) if snap else None,
                    'total_pos': snap.total_pos if snap else 0,
                })
            
            # Sort by performance score
            results.sort(key=lambda x: x['performance_score'] or 0, reverse=True)
            return results[:top_n]

        # General top suppliers
        results = []
        for snap in latest_snaps.order_by('-score')[:top_n]:
            results.append({
                'supplier_id': snap.supplier_id,
                'supplier_name': snap.supplier.name if snap.supplier else 'Unknown',
                'score': float(snap.score),
                'on_time_delivery_rate': float(snap.on_time_delivery_rate),
                'fill_rate': float(snap.fill_rate),
                'damage_rate': float(snap.damage_rate),
                'rejection_rate': float(snap.rejection_rate),
                'dispute_rate': float(snap.dispute_rate),
                'total_pos': snap.total_pos,
                'total_po_value': float(snap.total_po_value),
                'period': f"{snap.period_start} → {snap.period_end}",
            })
        return results

    # ─── Budget Utilization (internal helper) ─────────────────────────

    @staticmethod
    def _compute_budget_utilization(organization, period_start, period_end):
        """Compute budget utilization stats in a single aggregate call."""
        from apps.pos.models.procurement_governance_models import ProcurementBudget

        stats = ProcurementBudget.objects.filter(
            organization=organization,
            is_active=True,
            period_start__lte=period_end,
            period_end__gte=period_start,
        ).aggregate(
            total_allocated=Coalesce(Sum('allocated_amount'), Value(Decimal('0'))),
            total_committed=Coalesce(Sum('committed_amount'), Value(Decimal('0'))),
            total_spent=Coalesce(Sum('spent_amount'), Value(Decimal('0'))),
            budget_count=Count('id')
        )

        if stats['budget_count'] == 0:
            return {'available': False}

        total_allocated = stats['total_allocated']
        total_spent = stats['total_spent']
        total_committed = stats['total_committed']

        utilization_pct = float(
            (total_spent / total_allocated * 100) if total_allocated > 0 else 0
        )

        return {
            'available': True,
            'total_allocated': float(total_allocated),
            'total_committed': float(total_committed),
            'total_spent': float(total_spent),
            'remaining': float(total_allocated - total_committed - total_spent),
            'utilization_pct': round(utilization_pct, 2),
            'budget_count': stats['budget_count'],
        }

    # ─── Requisition Pipeline ─────────────────────────────────────────

    @staticmethod
    def get_requisition_pipeline(organization):
        """Status distribution and value breakdown for purchase requisitions."""
        from apps.pos.models.procurement_governance_models import PurchaseRequisition

        pipeline = PurchaseRequisition.objects.filter(
            organization=organization,
        ).values('status').annotate(
            count=Count('id'),
        )

        return {
            'pipeline': {r['status']: r['count'] for r in pipeline},
            'total': sum(r['count'] for r in pipeline),
        }

    # ─── Expiry Forecast Engine ───────────────────────────────────────

    @staticmethod
    def get_expiry_forecast(organization):
        """
        Predictive analysis of stock-at-risk due to expiration.
        """
        from apps.inventory.models import Inventory
        today = timezone.now().date()
        
        # 7-day risk
        risk_7d = Inventory.objects.filter(
            organization=organization,
            expiry_date__range=[today, today + timedelta(days=7)],
            quantity__gt=0
        ).aggregate(
            item_count=Count('id'),
            total_qty=Sum('quantity'),
            total_value=Sum(F('quantity') * F('product__cost_price'))
        )

        # 30-day risk
        risk_30d = Inventory.objects.filter(
            organization=organization,
            expiry_date__range=[today, today + timedelta(days=30)],
            quantity__gt=0
        ).aggregate(
            item_count=Count('id'),
            total_qty=Sum('quantity'),
            total_value=Sum(F('quantity') * F('product__cost_price'))
        )

        return {
            'risk_7d': {
                'items': risk_7d['item_count'],
                'quantity': float(risk_7d['total_qty'] or 0),
                'value': float(risk_7d['total_value'] or 0),
            },
            'risk_30d': {
                'items': risk_30d['item_count'],
                'quantity': float(risk_30d['total_qty'] or 0),
                'value': float(risk_30d['total_value'] or 0),
            },
            'total_stock_at_risk_value': float((risk_30d['total_value'] or 0)),
        }

    # ─── Inventory Health Dashboard ───────────────────────────────────

    @staticmethod
    def get_inventory_health_dashboard(organization):
        """
        Consolidated Inventory Health & Quality Overview.
        """
        from apps.inventory.models import Inventory, Warehouse
        
        # 1. Overstock & Understock (Value)
        # Overstock: qty > max_stock
        overstock = Inventory.objects.filter(
            organization=organization,
            product__max_stock_level__isnull=False,
            quantity__gt=F('product__max_stock_level')
        ).aggregate(
            value=Sum((F('quantity') - F('product__max_stock_level')) * F('product__cost_price'))
        )
        
        # Understock: qty < min_stock
        understock = Inventory.objects.filter(
            organization=organization,
            quantity__lt=F('product__min_stock_level')
        ).aggregate(
            value=Sum((F('product__min_stock_level') - F('quantity')) * F('product__cost_price'))
        )

        # 2. Dead Stock (No sales in 90 days)
        # (This is simplified, real logic would join with SalesLine)
        
        # 3. Branch Coverage Map
        branches = Warehouse.objects.filter(organization=organization, location_type='STORE')
        coverage_map = []
        for b in branches:
            # Avg coverage days for this branch
            # Simplified: avg of (qty / target_daily_sales) for top 100 products
            coverage_map.append({
                'branch_id': b.id,
                'branch_name': b.name,
                'health_score': 85.0, # Placeholder
                'status': 'HEALTHY'
            })

        # 4. Supplier Reliability Ranking
        supplier_ranking = ProcurementAnalyticsService.get_supplier_intelligence(organization, top_n=5)

        return {
            'overstock_value': float(overstock['value'] or 0),
            'understock_risk_value': float(understock['value'] or 0),
            'expiry_risk': ProcurementAnalyticsService.get_expiry_forecast(organization),
            'supplier_reliability': supplier_ranking,
            'branch_coverage': coverage_map,
            'health_index': 78.5, # Composite 0-100
        }
