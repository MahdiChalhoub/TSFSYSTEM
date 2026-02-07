"""
Finance Module Views
ViewSets for all accounting, ledger, tax, and financial management endpoints.
"""
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.views import TenantModelViewSet
from erp.middleware import get_current_tenant_id
from erp.models import Organization, User

from apps.finance.models import (
    FinancialAccount, ChartOfAccount, FiscalYear, FiscalPeriod,
    JournalEntry, TransactionSequence, BarcodeSettings, Loan, FinancialEvent
)
from apps.finance.serializers import (
    FinancialAccountSerializer, ChartOfAccountSerializer,
    FiscalYearSerializer, FiscalPeriodSerializer, JournalEntrySerializer,
    TransactionSequenceSerializer, BarcodeSettingsSerializer,
    LoanSerializer, FinancialEventSerializer
)
from apps.finance.services import (
    FinancialAccountService, LedgerService, SequenceService,
    BarcodeService, LoanService, FinancialEventService
)


class FinancialAccountViewSet(TenantModelViewSet):
    queryset = FinancialAccount.objects.all()
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


class ChartOfAccountViewSet(TenantModelViewSet):
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
        
        from erp.serializers import JournalEntryLineSerializer
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


class FiscalYearViewSet(TenantModelViewSet):
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


class FiscalPeriodViewSet(TenantModelViewSet):
    queryset = FiscalPeriod.objects.all()
    serializer_class = FiscalPeriodSerializer


class JournalEntryViewSet(TenantModelViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer

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
                site_id=request.data.get('site_id')
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
            LedgerService.reverse_journal_entry(organization, pk)
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
                lines=lines
            )
            serializer = self.get_serializer(entry)
            return Response(serializer.data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)


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
            loan = LoanService.create_contract(organization, request.data)
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
            loan = LoanService.disburse_loan(organization, pk, transaction_ref, account_id)
            return Response(LoanSerializer(loan).data)
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
                account_id=request.data.get('account_id')
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
            
            event = FinancialEventService.post_event(organization, pk, account_id)
            return Response(FinancialEventSerializer(event).data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=400)


class TransactionSequenceViewSet(TenantModelViewSet):
    queryset = TransactionSequence.objects.all()
    serializer_class = TransactionSequenceSerializer
