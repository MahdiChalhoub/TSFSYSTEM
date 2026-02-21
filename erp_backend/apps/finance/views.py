"""
Finance Module Views
ViewSets for all accounting, ledger, tax, and financial management endpoints.
"""
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.views import TenantModelViewSet
from erp.lifecycle_mixin import LifecycleViewSetMixin
from erp.mixins import UDLEViewSetMixin
from erp.middleware import get_current_tenant_id
from erp.models import Organization, User

from apps.finance.models import (
    FinancialAccount, ChartOfAccount, FiscalYear, FiscalPeriod,
    JournalEntry, TransactionSequence, BarcodeSettings, Loan, FinancialEvent,
    ForensicAuditLog, DeferredExpense, DirectExpense, Asset, AmortizationSchedule, Voucher, ProfitDistribution,
    TaxGroup
)
from apps.finance.payment_models import Payment, CustomerBalance, SupplierBalance
from apps.finance.serializers import (
    FinancialAccountSerializer, ChartOfAccountSerializer,
    FiscalYearSerializer, FiscalPeriodSerializer, JournalEntrySerializer,
    TransactionSequenceSerializer, BarcodeSettingsSerializer,
    LoanSerializer, FinancialEventSerializer, ForensicAuditLogSerializer,
    DeferredExpenseSerializer, DirectExpenseSerializer, AssetSerializer, AmortizationScheduleSerializer,
    VoucherSerializer, ProfitDistributionSerializer, TaxGroupSerializer,
    PaymentSerializer, CustomerBalanceSerializer, SupplierBalanceSerializer
)
from apps.finance.services import (
    FinancialAccountService, LedgerService, SequenceService,
    BarcodeService, LoanService, FinancialEventService, AuditVerificationService,
    DeferredExpenseService, AssetService, VoucherService, ProfitDistributionService
)
from apps.inventory.services import InventoryService


class FinancialAccountViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = FinancialAccount.objects.select_related('linked_coa').all()
    serializer_class = FinancialAccountSerializer

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            account = FinancialAccountService.create_account(
                organization=organization,
                name=request.data.get('name'),
                type=request.data.get('type'),
                currency=request.data.get('currency', 'USD'),
                site_id=request.data.get('site_id')
            )
            serializer = self.get_serializer(account)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def assign_user(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            user_id = request.data.get('user_id')
            user = User.objects.get(id=user_id, organization=organization)
            account = FinancialAccount.objects.get(id=pk, organization=organization)
            
            user.cash_register = account
            user.save()
            
            return Response({"message": "User assigned successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def remove_user(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            user_id = request.data.get('user_id')
            user = User.objects.get(id=user_id, organization=organization)
            
            if user.cash_register_id == int(pk):
                user.cash_register = None
                user.save()
            
            return Response({"message": "User unassigned successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ChartOfAccountViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = ChartOfAccount.objects.all()
    serializer_class = ChartOfAccountSerializer

    @action(detail=False, methods=['get'])
    def templates(self, request):
        from erp.coa_templates import TEMPLATES
        data = [{"key": k, "name": k.replace('_', ' ')} for k in TEMPLATES.keys()]
        return Response(data)

    @action(detail=False, methods=['get'])
    def coa(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response([], status=status.HTTP_200_OK)
        
        organization = Organization.objects.get(id=organization_id)
        scope = request.query_params.get('scope', 'INTERNAL')
        include_inactive = request.query_params.get('include_inactive') == 'true'
        
        accounts = LedgerService.get_chart_of_accounts(organization, scope, include_inactive)
        
        data = []
        for acc in accounts:
            data.append({
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "type": acc.type,
                "subType": acc.sub_type,
                "isActive": acc.is_active,
                "parentId": acc.parent_id,
                "syscohadaCode": acc.syscohada_code,
                "syscohadaClass": acc.syscohada_class,
                "temp_balance": float(acc.temp_balance),
                "rollup_balance": float(acc.rollup_balance)
            })
        return Response(data)

    @action(detail=False, methods=['post'])
    def apply_template(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        template_key = request.data.get('template_key')
        reset = request.data.get('reset', False)
        
        if not template_key:
            return Response({"error": "template_key is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            LedgerService.apply_coa_template(organization, template_key, reset)
            return Response({"message": "Template applied successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def migrate(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        mappings = request.data.get('mappings', [])
        description = request.data.get('description', "COA Migration")
        
        if not mappings:
            return Response({"error": "Mappings are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            LedgerService.migrate_coa(organization, mappings, description)
            return Response({"message": "Migration completed successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        scope = request.query_params.get('scope', 'INTERNAL')
        
        result = LedgerService.get_account_statement(organization, pk, start_date, end_date, scope)
        
        from apps.finance.serializers import JournalEntryLineSerializer
        account_data = ChartOfAccountSerializer(result['account']).data
        lines_data = JournalEntryLineSerializer(result['lines'], many=True).data
        
        return Response({
            "account": account_data,
            "opening_balance": float(result['opening_balance']),
            "lines": lines_data
        })

    @action(detail=False, methods=['get'])
    def trial_balance(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        as_of = request.query_params.get('as_of')
        scope = request.query_params.get('scope', 'INTERNAL')
        
        accounts = LedgerService.get_trial_balance(organization, as_of, scope)
        
        data = []
        for acc in accounts:
            data.append({
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "type": acc.type,
                "temp_balance": float(acc.temp_balance),
                "rollup_balance": float(acc.rollup_balance),
                "parent_id": acc.parent_id
            })
        return Response(data)


class FiscalYearViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            with transaction.atomic():
                fiscal_year = serializer.save(organization=organization)
                
                start_date = fiscal_year.start_date
                end_date = fiscal_year.end_date
                frequency = request.data.get('frequency', 'MONTHLY')
                
                from datetime import timedelta, date
                import calendar
                
                curr = start_date
                period_count = 1
                
                while curr <= end_date:
                    last_day_of_month = calendar.monthrange(curr.year, curr.month)[1]
                    period_end = date(curr.year, curr.month, last_day_of_month)
                    
                    if period_end > end_date:
                        period_end = end_date
                    
                    period_name = f"P{str(period_count).zfill(2)}-{curr.year}"
                    
                    FiscalPeriod.objects.create(
                        organization=organization,
                        fiscal_year=fiscal_year,
                        name=period_name,
                        start_date=curr,
                        end_date=period_end
                    )
                    
                    curr = period_end + timedelta(days=1)
                    period_count += 1

                return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)
        
        try:
            # 1. Validate all control accounts
            LedgerService.validate_closure(organization, fiscal_year=fiscal_year)
            
            # 2. Ensure all periods are closed
            unclosed_periods = fiscal_year.periods.filter(is_closed=False)
            if unclosed_periods.exists():
                return Response(
                    {"error": f"Cannot close year. {unclosed_periods.count()} periods are still open."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            fiscal_year.is_closed = True
            fiscal_year.save()
            return Response({"status": "Fiscal Year Closed"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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


class JournalEntryViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer

    def get_queryset(self):
        qs = super().get_queryset().order_by('-transaction_date', '-id')
        params = self.request.query_params

        # Filter by fiscal year
        fiscal_year = params.get('fiscal_year')
        if fiscal_year:
            qs = qs.filter(fiscal_year_id=fiscal_year)

        # Filter by date range
        date_from = params.get('date_from')
        date_to = params.get('date_to')
        if date_from:
            qs = qs.filter(transaction_date__gte=date_from)
        if date_to:
            qs = qs.filter(transaction_date__lte=date_to)

        # Filter by status
        status_filter = params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Filter by scope
        scope = params.get('scope')
        if scope:
            qs = qs.filter(scope=scope)

        # Filter by entry type (opening vs manual)
        entry_type = params.get('entry_type')
        if entry_type == 'OPENING':
            qs = qs.filter(reference__startswith='OPEN-')
        elif entry_type == 'MANUAL':
            qs = qs.exclude(reference__startswith='OPEN-')

        # Search
        search = params.get('search')
        if search:
            qs = qs.filter(description__icontains=search)

        return qs

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=request.data.get('transaction_date'),
                description=request.data.get('description'),
                lines=request.data.get('lines'),
                reference=request.data.get('reference'),
                status=request.data.get('status', 'DRAFT'),
                scope=request.data.get('scope', 'OFFICIAL'),
                site_id=request.data.get('site_id'),
                user=request.user
            )
            serializer = self.get_serializer(entry)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reverse(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            LedgerService.reverse_journal_entry(organization, pk, user=request.user)
            return Response({"message": "Journal entry reversed successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def opening_entries(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        entries = JournalEntry.objects.filter(
            organization_id=organization_id,
            reference__startswith='OPEN-'
        )
        serializer = self.get_serializer(entries, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def recalculate_balances(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        LedgerService.recalculate_balances(organization)
        return Response({"message": "Balances recalculated successfully"})

    @action(detail=False, methods=['post'])
    def clear_all(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        LedgerService.clear_all_data(organization)
        return Response({"message": "All data cleared successfully"})

    def update(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            lines = request.data.get('lines')
            if lines:
                for line in lines:
                    if 'accountId' in line:
                        line['account_id'] = line.pop('accountId')

            entry = LedgerService.update_journal_entry(
                organization=organization,
                entry_id=kwargs.get('pk'),
                transaction_date=request.data.get('transactionDate') or request.data.get('transaction_date'),
                description=request.data.get('description'),
                status=request.data.get('status'),
                lines=lines,
                user=request.user
            )
            serializer = self.get_serializer(entry)
            return Response(serializer.data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='bank-reconciliation')
    def bank_reconciliation(self, request):
        """Bank reconciliation — unreconciled entries on bank/cash accounts."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)

        from django.db.models import Sum, Q
        account_id = request.query_params.get('account_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        # List bank/cash accounts (COA type = ASSET, sub_type in bank/cash)
        bank_accounts = ChartOfAccount.objects.filter(
            organization=organization,
            is_active=True,
            type='ASSET',
        ).filter(
            Q(sub_type__icontains='bank') |
            Q(sub_type__icontains='cash') |
            Q(name__icontains='bank') |
            Q(name__icontains='caisse') |
            Q(syscohada_class='5')
        )

        if not account_id:
            # Return list of bank accounts with balances
            accounts_data = []
            for acc in bank_accounts:
                lines = JournalEntryLine.objects.filter(
                    organization=organization,
                    account=acc,
                    journal_entry__status='POSTED',
                )
                total_debit = float(lines.aggregate(s=Sum('debit'))['s'] or 0)
                total_credit = float(lines.aggregate(s=Sum('credit'))['s'] or 0)
                book_balance = total_debit - total_credit
                accounts_data.append({
                    'id': acc.id,
                    'code': acc.code,
                    'name': acc.name,
                    'book_balance': book_balance,
                    'coa_balance': float(acc.balance),
                    'entry_count': lines.count(),
                })
            return Response({'accounts': accounts_data})

        # Detail: journal entries for specific account
        try:
            account = ChartOfAccount.objects.get(id=account_id, organization=organization)
        except ChartOfAccount.DoesNotExist:
            return Response({"error": "Account not found"}, status=404)

        lines_qs = JournalEntryLine.objects.filter(
            organization=organization,
            account=account,
            journal_entry__status='POSTED',
        ).select_related('journal_entry')

        if start_date:
            lines_qs = lines_qs.filter(journal_entry__transaction_date__gte=start_date)
        if end_date:
            lines_qs = lines_qs.filter(journal_entry__transaction_date__lte=end_date)

        lines_qs = lines_qs.order_by('journal_entry__transaction_date')

        total_debit = 0
        total_credit = 0
        entries = []
        for line in lines_qs:
            d = float(line.debit)
            c = float(line.credit)
            total_debit += d
            total_credit += c
            entries.append({
                'id': line.id,
                'je_id': line.journal_entry_id,
                'date': str(line.journal_entry.transaction_date.date()) if line.journal_entry.transaction_date else None,
                'reference': line.journal_entry.reference,
                'description': line.description or line.journal_entry.description,
                'debit': d,
                'credit': c,
                'running_balance': total_debit - total_credit,
            })

        return Response({
            'account': {
                'id': account.id,
                'code': account.code,
                'name': account.name,
            },
            'summary': {
                'total_debit': total_debit,
                'total_credit': total_credit,
                'book_balance': total_debit - total_credit,
                'entry_count': len(entries),
            },
            'entries': entries,
        })



class BarcodeSettingsViewSet(viewsets.ViewSet):
    def list(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        settings, _ = BarcodeSettings.objects.get_or_create(organization=organization)
        return Response(BarcodeSettingsSerializer(settings).data)

    def create(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        settings, _ = BarcodeSettings.objects.get_or_create(organization=organization)
        serializer = BarcodeSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    @action(detail=False, methods=['post'])
    def generate(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            code = BarcodeService.generate_barcode(organization)
            return Response({"barcode": code})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class LoanViewSet(TenantModelViewSet):
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer

    def get_queryset(self):
        return super().get_queryset().order_by('-created_at')

    @action(detail=False, methods=['post'])
    def contract(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            data = request.data.copy()
            data['user'] = request.user
            loan = LoanService.create_contract(organization, data)
            return Response(LoanSerializer(loan).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def disburse(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            transaction_ref = request.data.get('transaction_ref')
            account_id = request.data.get('account_id')
            loan = LoanService.disburse_loan(organization, pk, transaction_ref, account_id, user=request.user)
            return Response(LoanSerializer(loan).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def repay(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            amount = request.data.get('amount')
            account_id = request.data.get('account_id')
            reference = request.data.get('reference')
            
            if not amount or not account_id:
                return Response({"error": "Amount and Account ID are required"}, status=400)
                
            event = LoanService.process_repayment(organization, pk, amount, account_id, reference, user=request.user)
            return Response(FinancialEventSerializer(event).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class FinancialEventViewSet(TenantModelViewSet):
    queryset = FinancialEvent.objects.all()
    serializer_class = FinancialEventSerializer

    def get_queryset(self):
        return super().get_queryset().order_by('-date')

    @action(detail=False, methods=['post'])
    def create_event(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            event = FinancialEventService.create_event(
                organization=organization,
                event_type=request.data.get('event_type'),
                amount=request.data.get('amount'),
                date=request.data.get('date'),
                contact_id=request.data.get('contact_id'),
                reference=request.data.get('reference'),
                notes=request.data.get('notes'),
                loan_id=request.data.get('loan_id'),
                account_id=request.data.get('account_id'),
                user=request.user
            )
            return Response(FinancialEventSerializer(event).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def post_event(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            account_id = request.data.get('account_id')
            if not account_id: return Response({"error": "Account ID required"}, status=400)
            
            event = FinancialEventService.post_event(organization, pk, account_id, user=request.user)
            return Response(FinancialEventSerializer(event).data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=400)


class TransactionSequenceViewSet(TenantModelViewSet):
    queryset = TransactionSequence.objects.all()
    serializer_class = TransactionSequenceSerializer


class ForensicAuditLogViewSet(TenantModelViewSet):
    queryset = ForensicAuditLog.objects.all()
    serializer_class = ForensicAuditLogSerializer
    http_method_names = ['get'] # Strictly read-only

    def get_queryset(self):
        return super().get_queryset().order_by('-timestamp')


class AuditVerificationViewSet(viewsets.ViewSet):
    """
    Quantum Audit: Dedicated ViewSet for ledger and inventory integrity verification.
    """
    def list(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        return Response({
            "services": [
                {"name": "Ledger Chain Verification", "endpoint": "/api/finance/audit/verify-ledger/"},
                {"name": "Inventory-Finance Reconciliation", "endpoint": "/api/finance/audit/reconcile-inventory/"}
            ]
        })

    @action(detail=False, methods=['get'], url_path='verify-ledger')
    def verify_ledger(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        result = AuditVerificationService.verify_ledger_integrity(organization)
        return Response(result)

    @action(detail=False, methods=['get'], url_path='reconcile-inventory')
    def reconcile_inventory(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        result = InventoryService.reconcile_with_finance(organization)
        return Response(result)


class DeferredExpenseViewSet(TenantModelViewSet):
    queryset = DeferredExpense.objects.all()
    serializer_class = DeferredExpenseSerializer

    def get_queryset(self):
        return super().get_queryset().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            expense = DeferredExpenseService.create_deferred_expense(
                organization=organization,
                data=request.data,
                user=request.user,
                scope=request.data.get('scope', 'OFFICIAL')
            )
            return Response(DeferredExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def recognize(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            period_date = request.data.get('period_date')
            expense = DeferredExpenseService.recognize_monthly(organization, pk, period_date, user=request.user)
            return Response(DeferredExpenseSerializer(expense).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class DirectExpenseViewSet(TenantModelViewSet):
    queryset = DirectExpense.objects.all()
    serializer_class = DirectExpenseSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        status_filter = self.request.query_params.get('status')
        if category:
            qs = qs.filter(category=category)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            data = request.data.copy()
            # Auto-generate reference
            ref = TransactionSequence.next_value(organization, 'EXPENSE')
            expense = DirectExpense.objects.create(
                organization=organization,
                name=data.get('name'),
                description=data.get('description', ''),
                category=data.get('category', 'OTHER'),
                amount=data.get('amount'),
                date=data.get('date'),
                reference=ref,
                source_account_id=data.get('source_account_id'),
                expense_coa_id=data.get('expense_coa_id'),
                scope=data.get('scope', 'OFFICIAL'),
            )
            return Response(DirectExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def update(self, request, *args, **kwargs):
        expense = self.get_object()
        if expense.status != 'DRAFT':
            return Response({"error": "Only DRAFT expenses can be edited."}, status=400)
        allowed = {'name', 'description', 'category', 'amount', 'date',
                   'source_account_id', 'expense_coa_id'}
        update_data = {k: v for k, v in request.data.items() if k in allowed}
        for key, value in update_data.items():
            setattr(expense, key, value)
        expense.save()
        return Response(DirectExpenseSerializer(expense).data)

    def destroy(self, request, *args, **kwargs):
        expense = self.get_object()
        if expense.status != 'DRAFT':
            return Response({"error": "Only DRAFT expenses can be deleted."}, status=400)
        expense.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def post_expense(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            expense = DirectExpense.objects.get(id=pk, organization=organization)
            if expense.status != 'DRAFT':
                return Response({"error": "Only DRAFT expenses can be posted."}, status=400)

            with transaction.atomic():
                # 1. Create financial event
                event = FinancialEvent.objects.create(
                    organization=organization,
                    event_type='EXPENSE',
                    amount=expense.amount,
                    date=expense.date,
                    reference=expense.reference,
                    notes=f"Direct Expense: {expense.name}",
                    financial_account=expense.source_account,
                    scope=expense.scope,
                    status='COMPLETED',
                )

                # 2. Create journal entry (Debit expense COA, Credit source account COA)
                je = JournalEntry.objects.create(
                    organization=organization,
                    transaction_date=expense.date,
                    description=f"Direct Expense: {expense.name}",
                    reference=expense.reference,
                    scope=expense.scope,
                    status='POSTED',
                    created_by=request.user if request.user.is_authenticated else None,
                    posted_by=request.user if request.user.is_authenticated else None,
                )
                from apps.finance.models import JournalEntryLine
                # Debit expense account
                if expense.expense_coa:
                    JournalEntryLine.objects.create(
                        organization=organization,
                        journal_entry=je,
                        account=expense.expense_coa,
                        debit=expense.amount,
                        credit=0,
                        description=expense.name,
                    )
                # Credit source account's linked COA
                if expense.source_account and expense.source_account.linked_coa:
                    JournalEntryLine.objects.create(
                        organization=organization,
                        journal_entry=je,
                        account=expense.source_account.linked_coa,
                        debit=0,
                        credit=expense.amount,
                        description=expense.name,
                    )

                # 3. Update expense record
                expense.financial_event = event
                expense.journal_entry = je
                expense.status = 'POSTED'
                expense.save()

            return Response(DirectExpenseSerializer(expense).data)
        except DirectExpense.DoesNotExist:
            return Response({"error": "Expense not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def cancel_expense(self, request, pk=None):
        expense = self.get_object()
        if expense.status != 'DRAFT':
            return Response({"error": "Only DRAFT expenses can be cancelled."}, status=400)
        expense.status = 'CANCELLED'
        expense.save()
        return Response(DirectExpenseSerializer(expense).data)


class AssetViewSet(TenantModelViewSet):
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer

    def get_queryset(self):
        return super().get_queryset().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            asset = AssetService.acquire_asset(
                organization=organization,
                data=request.data,
                user=request.user,
                scope=request.data.get('scope', 'OFFICIAL')
            )
            return Response(AssetSerializer(asset).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        asset = self.get_object()
        lines = asset.amortization_lines.all().order_by('period_date')
        return Response(AmortizationScheduleSerializer(lines, many=True).data)

    @action(detail=True, methods=['post'], url_path='depreciate/(?P<schedule_id>[^/.]+)')
    def depreciate(self, request, pk=None, schedule_id=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            line = AssetService.post_depreciation(organization, schedule_id, user=request.user)
            return Response(AmortizationScheduleSerializer(line).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class VoucherViewSet(LifecycleViewSetMixin, TenantModelViewSet):
    queryset = Voucher.objects.all()
    serializer_class = VoucherSerializer
    lifecycle_transaction_type = 'VOUCHER'

    def get_queryset(self):
        vtype = self.request.query_params.get('type')
        lc_status = self.request.query_params.get('lifecycle_status')
        qs = super().get_queryset().order_by('-created_at')
        if vtype:
            qs = qs.filter(voucher_type=vtype)
        if lc_status:
            qs = qs.filter(lifecycle_status=lc_status)
        return qs

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            voucher = VoucherService.create_voucher(
                organization=organization,
                data=request.data,
                user=request.user,
                scope=request.data.get('scope', 'OFFICIAL')
            )
            return Response(VoucherSerializer(voucher).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def update(self, request, *args, **kwargs):
        voucher = self.get_object()
        if not voucher.is_editable:
            return Response({"error": "Only OPEN vouchers can be edited."}, status=400)
        # Only allow updating certain fields
        allowed = {'amount', 'date', 'description', 'source_account_id',
                   'destination_account_id', 'financial_event_id', 'contact_id'}
        update_data = {k: v for k, v in request.data.items() if k in allowed}
        for key, value in update_data.items():
            setattr(voucher, key, value)
        voucher.save()
        return Response(VoucherSerializer(voucher).data)

    def destroy(self, request, *args, **kwargs):
        voucher = self.get_object()
        if not voucher.is_editable:
            return Response({"error": "Only OPEN vouchers can be deleted."}, status=400)
        voucher.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def post_voucher(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        voucher = self.get_object()
        if voucher.lifecycle_status != 'CONFIRMED':
            return Response({"error": "Voucher must be CONFIRMED before posting."}, status=400)
        if voucher.is_posted:
            return Response({"error": "Voucher is already posted."}, status=400)

        try:
            voucher = VoucherService.post_voucher(organization, pk, user=request.user)
            return Response(VoucherSerializer(voucher).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def cancel_voucher(self, request, pk=None):
        voucher = self.get_object()
        if voucher.is_posted:
            return Response({"error": "Posted vouchers cannot be cancelled. Create a reversal instead."}, status=400)
        if not voucher.is_editable:
            return Response({"error": "Only OPEN vouchers can be cancelled."}, status=400)
        voucher.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfitDistributionViewSet(TenantModelViewSet):
    queryset = ProfitDistribution.objects.all()
    serializer_class = ProfitDistributionSerializer

    @action(detail=False, methods=['post'])
    def calculate(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            result = ProfitDistributionService.calculate_distribution(
                organization=organization,
                fiscal_year_id=request.data.get('fiscal_year_id'),
                allocations=request.data.get('allocations', {})
            )
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            dist = ProfitDistributionService.create_distribution(
                organization=organization,
                fiscal_year_id=request.data.get('fiscal_year_id'),
                allocations=request.data.get('allocations', {}),
                distribution_date=request.data.get('distribution_date'),
                notes=request.data.get('notes', ''),
                user=request.user
            )
            return Response(ProfitDistributionSerializer(dist).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def post_distribution(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            dist = ProfitDistributionService.post_distribution(
                organization=organization,
                distribution_id=pk,
                retained_earnings_coa_id=request.data.get('retained_earnings_coa_id'),
                allocation_coa_map=request.data.get('allocation_coa_map', {}),
                user=request.user
            )
            return Response(ProfitDistributionSerializer(dist).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class TaxGroupViewSet(TenantModelViewSet):
    queryset = TaxGroup.objects.all()
    serializer_class = TaxGroupSerializer

    @action(detail=False, methods=['post'])
    def set_default(self, request):
        """Set a tax group as the default for this organization."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "Tenant context missing"}, status=400)
        tax_group_id = request.data.get('tax_group_id')
        if not tax_group_id:
            return Response({"error": "tax_group_id required"}, status=400)
        try:
            TaxGroup.objects.filter(organization_id=organization_id).update(is_default=False)
            tg = TaxGroup.objects.get(id=tax_group_id, organization_id=organization_id)
            tg.is_default = True
            tg.save()
            return Response(TaxGroupSerializer(tg).data)
        except TaxGroup.DoesNotExist:
            return Response({"error": "Tax group not found"}, status=404)


# =============================================================================
# PAYMENTS & BALANCES
# =============================================================================

class PaymentViewSet(TenantModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    @action(detail=False, methods=['post'])
    def supplier_payment(self, request):
        """Record a payment to a supplier."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        from apps.finance.payment_service import PaymentService
        try:
            payment = PaymentService.record_supplier_payment(
                organization=organization,
                contact_id=request.data.get('contact_id'),
                amount=request.data.get('amount'),
                payment_date=request.data.get('payment_date'),
                payment_account_id=request.data.get('payment_account_id'),
                method=request.data.get('method', 'CASH'),
                description=request.data.get('description'),
                supplier_invoice_id=request.data.get('supplier_invoice_id'),
                scope=request.data.get('scope', 'OFFICIAL'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(PaymentSerializer(payment).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['post'])
    def customer_receipt(self, request):
        """Record a receipt from a customer."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        from apps.finance.payment_service import PaymentService
        try:
            payment = PaymentService.record_customer_receipt(
                organization=organization,
                contact_id=request.data.get('contact_id'),
                amount=request.data.get('amount'),
                payment_date=request.data.get('payment_date'),
                payment_account_id=request.data.get('payment_account_id'),
                method=request.data.get('method', 'CASH'),
                description=request.data.get('description'),
                sales_order_id=request.data.get('sales_order_id'),
                scope=request.data.get('scope', 'OFFICIAL'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(PaymentSerializer(payment).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['get'])
    def aged_receivables(self, request):
        """Get aged receivables report."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        from apps.finance.payment_service import PaymentService
        return Response(PaymentService.get_aged_receivables(organization))

    @action(detail=False, methods=['get'])
    def aged_payables(self, request):
        """Get aged payables report."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        from apps.finance.payment_service import PaymentService
        return Response(PaymentService.get_aged_payables(organization))

    @action(detail=True, methods=['post'], url_path='allocate-to-invoice')
    def allocate_to_invoice(self, request, pk=None):
        """Allocate (part of) a payment to an invoice."""
        payment = self.get_object()
        invoice_id = request.data.get('invoice_id')
        amount = request.data.get('amount')
        if not invoice_id or not amount:
            return Response({'error': 'invoice_id and amount are required'}, status=400)
        try:
            invoice = Invoice.objects.get(id=invoice_id, organization_id=payment.organization_id)
            from apps.finance.invoice_service import InvoiceService
            allocation = InvoiceService.allocate_payment(payment, invoice, amount)
            return Response({
                'allocation_id': allocation.id,
                'payment': PaymentSerializer(payment).data,
                'invoice_balance': float(invoice.balance_due),
                'invoice_status': invoice.status,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['get'], url_path='payment-summary')
    def payment_summary(self, request, pk=None):
        """Get allocation summary for a payment."""
        payment = self.get_object()
        allocations = payment.allocations.select_related('invoice').all()
        allocated = sum(a.allocated_amount for a in allocations)
        return Response({
            'payment_id': payment.id,
            'total_amount': float(payment.amount),
            'allocated_amount': float(allocated),
            'unallocated_amount': float(payment.amount - allocated),
            'allocations': [
                {
                    'invoice_id': a.invoice_id,
                    'invoice_number': a.invoice.invoice_number,
                    'allocated_amount': float(a.allocated_amount),
                    'allocated_at': a.allocated_at.isoformat() if a.allocated_at else None,
                }
                for a in allocations
            ],
        })

    @action(detail=False, methods=['post'], url_path='check-overdue')
    def check_overdue(self, request):
        """Trigger overdue invoice detection."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'Tenant context missing'}, status=400)
        organization = Organization.objects.get(id=organization_id)
        from apps.finance.invoice_service import InvoiceService
        count = InvoiceService.check_overdue_invoices(organization)
        return Response({'overdue_count': count, 'message': f'{count} invoices marked overdue'})


class CustomerBalanceViewSet(TenantModelViewSet):
    queryset = CustomerBalance.objects.all()
    serializer_class = CustomerBalanceSerializer


class SupplierBalanceViewSet(TenantModelViewSet):
    queryset = SupplierBalance.objects.all()
    serializer_class = SupplierBalanceSerializer


# =============================================================================
# INVOICES
# =============================================================================

from apps.finance.invoice_models import Invoice, InvoiceLine, PaymentAllocation
from apps.finance.serializers import (
    InvoiceSerializer, InvoiceLineSerializer, PaymentAllocationSerializer
)


class InvoiceViewSet(TenantModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related('contact', 'created_by', 'site').prefetch_related('lines')
        # Filters
        inv_type = self.request.query_params.get('type')
        inv_status = self.request.query_params.get('status')
        contact_id = self.request.query_params.get('contact_id')
        sub_type = self.request.query_params.get('sub_type')
        if inv_type:
            qs = qs.filter(type=inv_type)
        if inv_status:
            qs = qs.filter(status=inv_status)
        if contact_id:
            qs = qs.filter(contact_id=contact_id)
        if sub_type:
            qs = qs.filter(sub_type=sub_type)
        return qs

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            lines_data = request.data.pop('lines', [])
            data = request.data.copy()

            # Snapshot contact info
            from apps.crm.models import Contact
            contact = Contact.objects.get(id=data.get('contact'), organization=organization)
            data.setdefault('contact_name', contact.name)
            data.setdefault('contact_email', contact.email)
            data.setdefault('contact_address', contact.address)
            data.setdefault('contact_vat_id', getattr(contact, 'tax_id', None))

            # Calculate due date from payment terms
            if data.get('issue_date') and data.get('payment_terms'):
                from datetime import datetime, timedelta
                TERM_DAYS = {
                    'IMMEDIATE': 0, 'NET_7': 7, 'NET_15': 15,
                    'NET_30': 30, 'NET_45': 45, 'NET_60': 60, 'NET_90': 90,
                }
                days = TERM_DAYS.get(data['payment_terms'], 30)
                if data['payment_terms'] == 'CUSTOM':
                    days = int(data.get('payment_terms_days', 30))
                data['payment_terms_days'] = days
                issue = datetime.strptime(data['issue_date'], '%Y-%m-%d').date() if isinstance(data['issue_date'], str) else data['issue_date']
                data.setdefault('due_date', str(issue + timedelta(days=days)))

            invoice = Invoice.objects.create(
                organization=organization,
                created_by=request.user if request.user.is_authenticated else None,
                **{k: v for k, v in data.items() if k not in ('organization',)}
            )

            # Create lines
            for i, line_data in enumerate(lines_data):
                InvoiceLine.objects.create(
                    organization=organization,
                    invoice=invoice,
                    sort_order=i,
                    **line_data
                )

            # Recalculate totals from lines
            if lines_data:
                invoice.recalculate_totals()

            return Response(InvoiceSerializer(invoice).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def send_invoice(self, request, pk=None):
        """Mark invoice as SENT and auto-generate invoice number."""
        invoice = self.get_object()
        if invoice.status != 'DRAFT':
            return Response({"error": "Only DRAFT invoices can be sent."}, status=400)
        invoice.status = 'SENT'
        invoice.save()  # Triggers auto-numbering in save()
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """Record a payment against this invoice with proper allocation."""
        invoice = self.get_object()
        amount = request.data.get('amount')
        method = request.data.get('method', 'CASH')
        payment_account_id = request.data.get('payment_account_id')
        if not amount:
            return Response({"error": "Amount is required."}, status=400)
        if not payment_account_id:
            # Fall back to simple record (no Payment object created)
            try:
                invoice.record_payment(amount)
                return Response(InvoiceSerializer(invoice).data)
            except Exception as e:
                return Response({"error": str(e)}, status=400)
        try:
            from apps.finance.invoice_service import InvoiceService
            payment, allocation = InvoiceService.record_payment_for_invoice(
                invoice=invoice,
                amount=amount,
                method=method,
                payment_account_id=payment_account_id,
                description=request.data.get('description'),
                reference=request.data.get('reference'),
                user=request.user if request.user.is_authenticated else None,
            )
            return Response({
                'invoice': InvoiceSerializer(invoice).data,
                'payment_id': payment.id,
                'allocation_id': allocation.id,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def cancel_invoice(self, request, pk=None):
        """Cancel an unpaid invoice."""
        invoice = self.get_object()
        try:
            invoice.cancel()
            return Response(InvoiceSerializer(invoice).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        """Add a line item to the invoice."""
        invoice = self.get_object()
        if invoice.status not in ('DRAFT',):
            return Response({"error": "Lines can only be added to DRAFT invoices."}, status=400)
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)
        try:
            line = InvoiceLine.objects.create(
                organization=organization,
                invoice=invoice,
                **request.data
            )
            invoice.recalculate_totals()
            return Response(InvoiceLineSerializer(line).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Invoice dashboard stats."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "Tenant context missing"}, status=400)

        from django.db.models import Sum, Count, Q
        from django.utils import timezone

        qs = Invoice.objects.filter(organization_id=organization_id)
        today = timezone.now().date()

        return Response({
            'total_invoices': qs.count(),
            'draft': qs.filter(status='DRAFT').count(),
            'sent': qs.filter(status='SENT').count(),
            'overdue': qs.filter(status='OVERDUE').count(),
            'paid': qs.filter(status='PAID').count(),
            'total_outstanding': float(qs.filter(
                status__in=['SENT', 'PARTIAL_PAID', 'OVERDUE']
            ).aggregate(s=Sum('balance_due'))['s'] or 0),
            'total_overdue': float(qs.filter(
                status='OVERDUE'
            ).aggregate(s=Sum('balance_due'))['s'] or 0),
            'total_received': float(qs.aggregate(s=Sum('paid_amount'))['s'] or 0),
        })


class InvoiceLineViewSet(TenantModelViewSet):
    queryset = InvoiceLine.objects.all()
    serializer_class = InvoiceLineSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        invoice_id = self.request.query_params.get('invoice_id')
        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)
        return qs


class PaymentAllocationViewSet(TenantModelViewSet):
    queryset = PaymentAllocation.objects.all()
    serializer_class = PaymentAllocationSerializer


# ── Payment Gateway Configuration ──────────────────────────────

class GatewayConfigViewSet(TenantModelViewSet):
    """Payment gateway CRUD with secure key management."""
    from apps.finance.gateway_models import GatewayConfig
    queryset = GatewayConfig.objects.all()

    def get_serializer_class(self):
        from rest_framework import serializers
        from apps.finance.gateway_models import GatewayConfig as GC

        class GatewayConfigSerializer(serializers.ModelSerializer):
            class Meta:
                model = GC
                exclude = ['api_key_encrypted', 'webhook_secret_encrypted']

        return GatewayConfigSerializer

    @action(detail=True, methods=['post'], url_path='set-keys')
    def set_keys(self, request, pk=None):
        """Set encrypted API keys. Body: { "api_key": "sk_...", "webhook_secret": "whsec_..." }"""
        config = self.get_object()
        api_key = request.data.get('api_key')
        webhook_secret = request.data.get('webhook_secret')
        if api_key:
            config.set_api_key(api_key)
        if webhook_secret:
            config.set_webhook_secret(webhook_secret)
        config.save()
        return Response({"message": "Keys updated securely"})

    @action(detail=True, methods=['post'], url_path='test-connection')
    def test_connection(self, request, pk=None):
        """Test gateway connection."""
        config = self.get_object()
        if config.gateway_type == 'STRIPE':
            from apps.finance.stripe_gateway import StripeGatewayService
            service = StripeGatewayService(str(config.organization_id))
            try:
                result = service.retrieve_payment_intent('test')
                if 'error' in result and 'No such payment_intent' in str(result.get('error', '')):
                    return Response({"connected": True, "message": "Stripe API key valid"})
                return Response({"connected": True, "result": result})
            except Exception as e:
                return Response({"connected": False, "error": str(e)}, status=400)
        return Response({"message": f"Connection test not available for {config.gateway_type}"})

    @action(detail=False, methods=['post'], url_path='stripe-webhook')
    def stripe_webhook(self, request):
        """Handle incoming Stripe webhooks (public endpoint)."""
        from apps.finance.stripe_gateway import StripeGatewayService
        from erp.middleware import get_current_tenant_id

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No organization context"}, status=400)

        service = StripeGatewayService(org_id)
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        event = service.verify_webhook(payload, sig_header)
        if not event:
            return Response({"error": "Invalid webhook signature"}, status=400)

        result = service.handle_webhook_event(event)
        return Response(result)


# ── Report Builder ──────────────────────────────────────────────

class ReportViewSet(TenantModelViewSet):
    """Report definition CRUD with run/export actions."""
    from apps.finance.report_models import ReportDefinition
    queryset = ReportDefinition.objects.all()

    def get_serializer_class(self):
        from rest_framework import serializers
        from apps.finance.report_models import ReportDefinition as RD

        class ReportDefinitionSerializer(serializers.ModelSerializer):
            class Meta:
                model = RD
                fields = '__all__'

        return ReportDefinitionSerializer

    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        """Execute a report and return results (or export to file).
        Optional body: { "export_format": "EXCEL" }
        """
        from apps.finance.report_service import ReportService
        from apps.finance.report_models import ReportExecution
        from erp.middleware import get_current_tenant_id
        from django.utils import timezone

        report_def = self.get_object()
        org_id = get_current_tenant_id()
        export_format = request.data.get('export_format')

        execution = ReportExecution.objects.create(
            organization_id=org_id,
            report=report_def,
            executed_by=request.user,
            export_format=export_format or report_def.default_export_format,
            status='RUNNING',
            started_at=timezone.now(),
        )

        service = ReportService(org_id)

        if export_format:
            result = service.run_and_export(report_def, export_format=export_format)
            execution.status = 'COMPLETED' if 'error' not in result else 'FAILED'
            execution.row_count = result.get('row_count', 0)
            execution.output_file = result.get('file_path')
            execution.error_message = result.get('error')
            execution.completed_at = timezone.now()
            execution.save()
            return Response(result)
        else:
            data = service.execute(report_def)
            execution.status = 'COMPLETED' if 'error' not in data else 'FAILED'
            execution.row_count = data.get('row_count', 0)
            execution.error_message = data.get('error')
            execution.completed_at = timezone.now()
            execution.save()
            return Response(data)

    @action(detail=True, methods=['get'])
    def executions(self, request, pk=None):
        """Get execution history for a report."""
        from apps.finance.report_models import ReportExecution
        report = self.get_object()
        execs = ReportExecution.objects.filter(report=report).order_by('-created_at')[:20]
        return Response([{
            'id': str(e.id),
            'status': e.status,
            'export_format': e.export_format,
            'row_count': e.row_count,
            'output_file': e.output_file,
            'error_message': e.error_message,
            'started_at': e.started_at.isoformat() if e.started_at else None,
            'completed_at': e.completed_at.isoformat() if e.completed_at else None,
        } for e in execs])

    @action(detail=False, methods=['get'], url_path='data-sources')
    def data_sources(self, request):
        """List available data sources for report builder."""
        from apps.finance.report_service import MODEL_REGISTRY, _build_registry
        _build_registry()
        sources = []
        for name, model in MODEL_REGISTRY.items():
            fields = [{'field': f.name, 'type': f.get_internal_type()}
                      for f in model._meta.get_fields() if hasattr(f, 'column')]
            sources.append({'name': name, 'fields': fields})
        return Response(sources)
