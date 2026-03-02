"""
Analytics Views — Gap 9
========================
Read-only API for SalesDailySummary pre-aggregated data.

Endpoints:
  GET /pos/analytics/daily/
    ?from=2026-02-01&to=2026-02-28
    &site=<warehouse_id>
    &scope=OFFICIAL|INTERNAL
    &page_size=30

  GET /pos/analytics/daily/summary/
    Returns a single rolled-up total across a date range.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum

from datetime import date, timedelta


class SalesDailySummaryListView(APIView):
    """
    GET /pos/analytics/daily/

    Returns SalesDailySummary rows for a date range, scoped to the
    current organization (via request.tenant).

    Query params (all optional):
      from        YYYY-MM-DD  (default: 30 days ago)
      to          YYYY-MM-DD  (default: yesterday)
      site        Warehouse ID
      scope       OFFICIAL | INTERNAL  (default: all)
      page_size   1-365  (default: 30)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.pos.models.analytics_models import SalesDailySummary

        org = getattr(request, 'organization', None) or getattr(request.user, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'}, status=http_status.HTTP_400_BAD_REQUEST)

        # ── Date range ────────────────────────────────────────────────────────
        today     = date.today()
        yesterday = today - timedelta(days=1)
        try:
            date_from = date.fromisoformat(request.query_params.get('from', str(today - timedelta(days=30))))
            date_to   = date.fromisoformat(request.query_params.get('to',   str(yesterday)))
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=http_status.HTTP_400_BAD_REQUEST)

        page_size = min(int(request.query_params.get('page_size', 30)), 365)

        qs = SalesDailySummary.original_objects.filter(
            organization=org,
            date__gte=date_from,
            date__lte=date_to,
        )

        site_id = request.query_params.get('site')
        if site_id:
            qs = qs.filter(site_id=site_id)

        scope = request.query_params.get('scope')
        if scope:
            qs = qs.filter(scope=scope.upper())

        qs = qs.select_related('site').order_by('-date', 'scope')[:page_size]

        data = [cls._serialize(row) for row in qs]
        return Response({'results': data, 'count': len(data)})

    @staticmethod
    def _serialize(row) -> dict:
        return {
            'date':              row.date.isoformat(),
            'site_id':           row.site_id,
            'site_name':         row.site.name if row.site else 'All Sites',
            'scope':             row.scope,
            # Counts
            'orders_total':      row.orders_total,
            'orders_confirmed':  row.orders_confirmed,
            'orders_delivered':  row.orders_delivered,
            'orders_paid':       row.orders_paid,
            'orders_cancelled':  row.orders_cancelled,
            # Revenue
            'revenue_ht':        str(row.revenue_ht),
            'revenue_ttc':       str(row.revenue_ttc),
            'tax_collected':     str(row.tax_collected),
            'airsi_withheld':    str(row.airsi_withheld),
            'discount_total':    str(row.discount_total),
            # COGS
            'cogs_total':        str(row.cogs_total),
            'gross_margin':      str(row.gross_margin),
            'gross_margin_pct':  str(row.gross_margin_pct),
            # Payments
            'cash_total':        str(row.cash_total),
            'mobile_total':      str(row.mobile_total),
            'credit_total':      str(row.credit_total),
            'bank_total':        str(row.bank_total),
            'other_total':       str(row.other_total),
            # Misc
            'items_sold':        str(row.items_sold),
            'unique_products':   row.unique_products,
            'unique_customers':  row.unique_customers,
            'avg_order_value':   str(row.avg_order_value),
            'computed_at':       row.computed_at.isoformat(),
        }


class SalesDailyRollupView(APIView):
    """
    GET /pos/analytics/daily/summary/

    Returns a single rolled-up aggregate across the requested date range.
    Accepts same params as SalesDailySummaryListView.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.pos.models.analytics_models import SalesDailySummary

        org = getattr(request, 'organization', None) or getattr(request.user, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'}, status=http_status.HTTP_400_BAD_REQUEST)

        today     = date.today()
        yesterday = today - timedelta(days=1)
        try:
            date_from = date.fromisoformat(request.query_params.get('from', str(today - timedelta(days=30))))
            date_to   = date.fromisoformat(request.query_params.get('to',   str(yesterday)))
        except ValueError:
            return Response({'error': 'Invalid date format.'}, status=http_status.HTTP_400_BAD_REQUEST)

        qs = SalesDailySummary.original_objects.filter(
            organization=org,
            date__gte=date_from,
            date__lte=date_to,
        )
        if sid := request.query_params.get('site'):
            qs = qs.filter(site_id=sid)
        if sc := request.query_params.get('scope'):
            qs = qs.filter(scope=sc.upper())

        totals = qs.aggregate(
            revenue_ht=Sum('revenue_ht'),
            revenue_ttc=Sum('revenue_ttc'),
            tax_collected=Sum('tax_collected'),
            airsi_withheld=Sum('airsi_withheld'),
            discount_total=Sum('discount_total'),
            cogs_total=Sum('cogs_total'),
            gross_margin=Sum('gross_margin'),
            cash_total=Sum('cash_total'),
            mobile_total=Sum('mobile_total'),
            credit_total=Sum('credit_total'),
            bank_total=Sum('bank_total'),
            other_total=Sum('other_total'),
            orders_total=Sum('orders_total'),
            orders_paid=Sum('orders_paid'),
            orders_cancelled=Sum('orders_cancelled'),
            items_sold=Sum('items_sold'),
        )

        # Compute rolled-up margin pct
        rev_ht = totals['revenue_ht'] or 0
        margin = totals['gross_margin'] or 0
        margin_pct = round(margin / rev_ht * 100, 2) if rev_ht else 0

        return Response({
            'date_from':        date_from.isoformat(),
            'date_to':          date_to.isoformat(),
            'days':             (date_to - date_from).days + 1,
            **{k: str(v or 0) for k, v in totals.items()},
            'gross_margin_pct': str(margin_pct),
        })
