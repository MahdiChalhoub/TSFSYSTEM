"""
FiscalYearViewSet mixin — `year_history` (audit log).

Period changes, closings, JE counts by month for a fiscal year.
Inherited by `FiscalYearViewSet`.
"""
from .base import (
    Response, action,
    get_current_tenant_id, Organization,
)


class FiscalYearHistoryMixin:
    """@action method: year_history."""

    @action(detail=True, methods=['get'], url_path='history')
    def year_history(self, request, pk=None):
        """Audit log for a fiscal year — period changes, closings, JE counts by month."""
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        org = Organization.objects.get(id=organization_id)

        from apps.finance.models import JournalEntry
        from django.db.models import Count, Q

        # Scope filter — same contract as the summary endpoint.
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'
        ).lower()
        scope = (request.headers.get('X-Scope') or request.query_params.get('scope') or 'OFFICIAL').upper()
        if authorized == 'official' and scope == 'INTERNAL':
            scope = 'OFFICIAL'

        events = []

        # Year creation
        events.append({
            'type': 'CREATED', 'date': str(fiscal_year.start_date),
            'description': f'Fiscal year {fiscal_year.name} created ({fiscal_year.start_date} — {fiscal_year.end_date})',
        })

        # Period events
        for p in fiscal_year.periods.all().order_by('start_date'):
            if p.is_closed and p.closed_at:
                events.append({
                    'type': 'PERIOD_CLOSED', 'date': p.closed_at.isoformat(),
                    'description': f'{p.name} closed',
                    'user': p.closed_by.username if p.closed_by else 'system',
                })

        # Year close
        if fiscal_year.is_closed and fiscal_year.closed_at:
            events.append({
                'type': 'YEAR_CLOSED', 'date': fiscal_year.closed_at.isoformat(),
                'description': f'Year-end close executed',
                'user': fiscal_year.closed_by.username if fiscal_year.closed_by else 'system',
            })

        # Closing JE
        if fiscal_year.closing_journal_entry_id:
            cje = fiscal_year.closing_journal_entry
            events.append({
                'type': 'CLOSING_ENTRY', 'date': str(cje.transaction_date),
                'description': f'Closing journal entry {cje.reference} posted',
            })

        # Hard lock
        if fiscal_year.is_hard_locked:
            events.append({
                'type': 'HARD_LOCKED', 'date': fiscal_year.closed_at.isoformat() if fiscal_year.closed_at else '',
                'description': 'Year permanently locked (immutable)',
            })

        # Sort by date
        events.sort(key=lambda e: e.get('date', ''))

        # JE count by month — portable (no TO_CHAR)
        # Match by FK OR date range to catch orphan JEs (fiscal_year=NULL)
        from django.db.models.functions import TruncMonth
        _je_qs = JournalEntry.objects.filter(organization=org, status='POSTED').filter(
            Q(fiscal_year=fiscal_year) |
            Q(fiscal_year__isnull=True,
              transaction_date__date__gte=fiscal_year.start_date,
              transaction_date__date__lte=fiscal_year.end_date)
        )
        if scope == 'OFFICIAL':
            _je_qs = _je_qs.filter(scope='OFFICIAL')
        je_by_month_rows = (
            _je_qs
            .annotate(month_dt=TruncMonth('transaction_date'))
            .values('month_dt')
            .annotate(count=Count('id'))
            .order_by('month_dt')
        )
        je_by_month = [
            {'month': row['month_dt'].strftime('%Y-%m') if row['month_dt'] else None, 'count': row['count']}
            for row in je_by_month_rows
        ]

        return Response({
            'events': events,
            'je_by_month': je_by_month,
        })
