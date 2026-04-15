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
        
        try:
            from apps.finance.services import FiscalYearService
            FiscalYearService.close_fiscal_year(organization, fiscal_year)
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


class FiscalPeriodViewSet(TenantModelViewSet):
    queryset = FiscalPeriod.objects.all()
    serializer_class = FiscalPeriodSerializer

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
