from .base import (
    transaction, viewsets, status, Response, action,
    TenantModelViewSet, UDLEViewSetMixin, get_current_tenant_id,
    Organization
)
from apps.finance.models import FiscalYear, FiscalPeriod
from apps.finance.serializers import FiscalYearSerializer, FiscalPeriodSerializer
from apps.finance.services import LedgerService

class FiscalYearViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer

    def perform_destroy(self, instance):
        """Clean up related data before deleting a fiscal year."""
        if instance.is_hard_locked:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Cannot delete a permanently locked fiscal year.")
        # Clean up opening balances, journal entries, and periods
        from apps.finance.models import OpeningBalance, JournalEntry
        OpeningBalance.objects.filter(fiscal_year=instance).delete()
        JournalEntry.objects.filter(fiscal_year=instance).update(fiscal_year=None, fiscal_period=None)
        instance.periods.all().delete()
        instance.delete()

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            from apps.finance.services import FiscalYearService
            fiscal_year = FiscalYearService.create_fiscal_year(
                organization=organization,
                data=request.data
            )
            serializer = self.get_serializer(fiscal_year)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        # Optional close_date for partial year close
        close_date = request.data.get('close_date') if hasattr(request, 'data') else None

        try:
            from apps.finance.services.closing_service import ClosingService
            ClosingService.close_fiscal_year(
                organization, fiscal_year,
                user=request.user if request.user.is_authenticated else None,
                close_date=close_date,
            )
            return Response({"status": "Fiscal Year Closed"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='close-preview')
    def close_preview(self, request, pk=None):
        """Pre-close report: show what will happen before year-end close."""
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        from apps.finance.models import ChartOfAccount, JournalEntry, FiscalPeriod
        from django.db.models import Sum, Q, Count
        from decimal import Decimal

        periods = FiscalPeriod.objects.filter(fiscal_year=fiscal_year)
        open_periods = periods.filter(status='OPEN').count()
        closed_periods = periods.filter(status='CLOSED').count()
        future_periods = periods.filter(status='FUTURE').count()

        draft_je = JournalEntry.objects.filter(
            organization=organization, fiscal_year=fiscal_year, status='DRAFT'
        ).count()
        posted_je = JournalEntry.objects.filter(
            organization=organization, fiscal_year=fiscal_year, status='POSTED'
        ).count()

        # P&L summary
        income_accounts = ChartOfAccount.objects.filter(
            organization=organization, type='INCOME', is_active=True
        )
        expense_accounts = ChartOfAccount.objects.filter(
            organization=organization, type='EXPENSE', is_active=True
        )

        total_revenue = abs(income_accounts.aggregate(s=Sum('balance_official'))['s'] or Decimal(0))
        total_expenses = expense_accounts.aggregate(s=Sum('balance_official'))['s'] or Decimal(0)
        net_income = total_revenue - total_expenses

        # Retained earnings account
        from django.db.models import Q as DQ
        re_account = ChartOfAccount.objects.filter(
            organization=organization, type='EQUITY', is_active=True
        ).filter(
            DQ(system_role='RETAINED_EARNINGS') |
            DQ(name__icontains='retained') |
            DQ(name__icontains='report')
        ).first()

        # Next year
        next_year = FiscalYear.objects.filter(
            organization=organization, start_date__gt=fiscal_year.end_date
        ).order_by('start_date').first()

        # Balance sheet accounts for opening balances preview
        bs_accounts = ChartOfAccount.objects.filter(
            organization=organization, type__in=['ASSET', 'LIABILITY', 'EQUITY'],
            is_active=True
        ).exclude(balance_official=Decimal(0)).order_by('type', 'code')
        bs_accounts_count = bs_accounts.count()

        opening_preview = []
        for acc in bs_accounts[:30]:  # Limit to 30 for performance
            opening_preview.append({
                'code': acc.code, 'name': acc.name, 'type': acc.type,
                'balance': float(acc.balance_official),
            })

        # Blockers
        blockers = []
        if draft_je > 0:
            blockers.append(f"{draft_je} draft journal entries — post or delete them")
        if not re_account:
            blockers.append("No Retained Earnings account found — create one with system_role=RETAINED_EARNINGS")
        if fiscal_year.is_hard_locked:
            blockers.append("This fiscal year is already finalized")

        return Response({
            'year': {'id': fiscal_year.id, 'name': fiscal_year.name, 'start_date': str(fiscal_year.start_date), 'end_date': str(fiscal_year.end_date)},
            'periods': {'total': periods.count(), 'open': open_periods, 'closed': closed_periods, 'future': future_periods},
            'journal_entries': {'posted': posted_je, 'draft': draft_je},
            'pnl': {'revenue': float(total_revenue), 'expenses': float(total_expenses), 'net_income': float(net_income)},
            'retained_earnings': {'code': re_account.code, 'name': re_account.name, 'id': re_account.id} if re_account else None,
            'next_year': {'id': next_year.id, 'name': next_year.name} if next_year else None,
            'opening_balances_count': bs_accounts_count,
            'opening_preview': opening_preview,
            'blockers': blockers,
            'can_close': len(blockers) == 0,
        })

    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        fiscal_year = self.get_object()
        if not fiscal_year.is_closed:
            return Response({"error": "Year must be closed before locking"}, status=status.HTTP_400_BAD_REQUEST)

        fiscal_year.is_hard_locked = True
        fiscal_year.save()
        return Response({"status": "Fiscal Year Locked"})

    @action(detail=True, methods=['get'], url_path='summary')
    def summary(self, request, pk=None):
        """Year-end summary: P&L, BS, closing entry, opening balances, period stats."""
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        org = Organization.objects.get(id=organization_id)

        from apps.finance.models import ChartOfAccount, JournalEntry, JournalEntryLine, OpeningBalance
        from django.db.models import Sum, Count, Q
        from decimal import Decimal

        periods = fiscal_year.periods.all().order_by('start_date')

        # Journal entry stats
        je_qs = JournalEntry.objects.filter(organization=org, fiscal_year=fiscal_year)
        je_stats = je_qs.aggregate(
            total=Count('id'),
            posted=Count('id', filter=Q(status='POSTED')),
            draft=Count('id', filter=Q(status='DRAFT')),
            total_debit=Sum('total_debit'),
            total_credit=Sum('total_credit'),
        )

        # P&L
        income_bal = ChartOfAccount.objects.filter(organization=org, type='INCOME', is_active=True).aggregate(s=Sum('balance_official'))['s'] or Decimal(0)
        expense_bal = ChartOfAccount.objects.filter(organization=org, type='EXPENSE', is_active=True).aggregate(s=Sum('balance_official'))['s'] or Decimal(0)
        revenue = abs(income_bal)
        net_income = revenue - expense_bal

        # Balance sheet
        asset_bal = ChartOfAccount.objects.filter(organization=org, type='ASSET', is_active=True).aggregate(s=Sum('balance_official'))['s'] or Decimal(0)
        liability_bal = ChartOfAccount.objects.filter(organization=org, type='LIABILITY', is_active=True).aggregate(s=Sum('balance_official'))['s'] or Decimal(0)
        equity_bal = ChartOfAccount.objects.filter(organization=org, type='EQUITY', is_active=True).aggregate(s=Sum('balance_official'))['s'] or Decimal(0)

        # Closing entry
        closing_je = None
        if fiscal_year.closing_journal_entry_id:
            cje = fiscal_year.closing_journal_entry
            closing_lines = JournalEntryLine.objects.filter(journal_entry=cje).select_related('account').order_by('-debit', 'credit')
            closing_je = {
                'reference': cje.reference,
                'date': str(cje.transaction_date),
                'description': cje.description,
                'lines': [{'code': l.account.code, 'name': l.account.name, 'debit': float(l.debit), 'credit': float(l.credit)} for l in closing_lines],
            }

        # Opening balances generated for next year
        from apps.finance.models import FiscalYear as FY
        next_fy = FY.objects.filter(organization=org, start_date__gt=fiscal_year.end_date).order_by('start_date').first()
        opening_bals = []
        if next_fy:
            obs = OpeningBalance.objects.filter(organization=org, fiscal_year=next_fy).select_related('account').order_by('account__type', 'account__code')
            opening_bals = [{'code': ob.account.code, 'name': ob.account.name, 'type': ob.account.type,
                             'debit': float(ob.debit_amount), 'credit': float(ob.credit_amount)} for ob in obs]

        # Period breakdown
        period_data = []
        for p in periods:
            p_je_count = JournalEntry.objects.filter(fiscal_period=p, status='POSTED').count()
            period_data.append({
                'name': p.name, 'status': p.status,
                'start_date': str(p.start_date), 'end_date': str(p.end_date),
                'journal_entries': p_je_count,
            })

        return Response({
            'year': {'name': fiscal_year.name, 'start_date': str(fiscal_year.start_date), 'end_date': str(fiscal_year.end_date),
                     'status': fiscal_year.status, 'is_hard_locked': fiscal_year.is_hard_locked,
                     'closed_at': fiscal_year.closed_at.isoformat() if fiscal_year.closed_at else None},
            'journal_entries': {
                'total': je_stats['total'] or 0, 'posted': je_stats['posted'] or 0, 'draft': je_stats['draft'] or 0,
                'total_debit': float(je_stats['total_debit'] or 0), 'total_credit': float(je_stats['total_credit'] or 0),
            },
            'pnl': {'revenue': float(revenue), 'expenses': float(expense_bal), 'net_income': float(net_income)},
            'balance_sheet': {
                'assets': float(asset_bal), 'liabilities': float(abs(liability_bal)),
                'equity': float(abs(equity_bal)),
            },
            'closing_entry': closing_je,
            'opening_balances': opening_bals,
            'opening_balances_target': next_fy.name if next_fy else None,
            'periods': period_data,
        })

    @action(detail=True, methods=['get'], url_path='history')
    def year_history(self, request, pk=None):
        """Audit log for a fiscal year — period changes, closings, JE counts by month."""
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        org = Organization.objects.get(id=organization_id)

        from apps.finance.models import JournalEntry
        from django.db.models import Count, Q

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

        # JE count by month
        je_by_month = list(
            JournalEntry.objects.filter(organization=org, fiscal_year=fiscal_year, status='POSTED')
            .extra(select={'month': "TO_CHAR(transaction_date, 'YYYY-MM')"})
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )

        return Response({
            'events': events,
            'je_by_month': je_by_month,
        })

    @action(detail=True, methods=['get'], url_path='draft-audit')
    def draft_audit(self, request, pk=None):
        """List all draft JEs in this fiscal year — for blocker resolution."""
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()

        from apps.finance.models import JournalEntry

        period_id = request.query_params.get('period_id')
        qs = JournalEntry.objects.filter(
            organization_id=organization_id, status='DRAFT'
        )
        if period_id:
            qs = qs.filter(fiscal_period_id=period_id)
        else:
            qs = qs.filter(fiscal_year=fiscal_year)

        drafts = qs.order_by('transaction_date')[:50]
        data = [{
            'id': je.id, 'reference': je.reference,
            'date': str(je.transaction_date), 'description': je.description,
            'total_debit': float(je.total_debit or 0), 'total_credit': float(je.total_credit or 0),
        } for je in drafts]

        return Response({'drafts': data, 'total': qs.count()})


class FiscalPeriodViewSet(TenantModelViewSet):
    queryset = FiscalPeriod.objects.all()
    serializer_class = FiscalPeriodSerializer

    def perform_update(self, serializer):
        """Block status changes if the fiscal year is hard-locked."""
        period = serializer.instance
        if period.fiscal_year.is_hard_locked:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Cannot modify periods in a permanently locked fiscal year.")
        serializer.save()

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        period = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)
        
        try:
            # Validate control accounts
            LedgerService.validate_closure(organization, fiscal_period=period)
            
            period.is_closed = True
            period.save()
            return Response({"status": "Period Closed"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
