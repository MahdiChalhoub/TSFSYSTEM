from .base import (
    transaction, viewsets, status, Response, action,
    TenantModelViewSet, UDLEViewSetMixin, get_current_tenant_id,
    Organization
)
from apps.finance.models import (
    JournalEntry, JournalEntryLine, ChartOfAccount, TransactionSequence,
    BarcodeSettings, Loan, FinancialEvent, ForensicAuditLog
)
from apps.finance.serializers import (
    JournalEntrySerializer, TransactionSequenceSerializer,
    BarcodeSettingsSerializer, LoanSerializer, FinancialEventSerializer,
    ForensicAuditLogSerializer
)
from apps.finance.services import (
    LedgerService, BarcodeService, LoanService,
    FinancialEventService, AuditVerificationService
)
from kernel.performance import profile_view

class JournalEntryViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer

    @profile_view
    def get_queryset(self):
        qs = super().get_queryset().select_related(
            'fiscal_year', 'fiscal_period', 'created_by', 'organization'
        ).prefetch_related('lines__account').order_by('-transaction_date', '-id')
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

        # Filter by scope is already handled by TenantModelViewSet.get_queryset()
        # but we can add more specific filtering if needed here.
        pass

        # Filter by entry type (opening vs manual vs auto)
        entry_type = params.get('entry_type')
        from django.db.models import Q
        if entry_type == 'OPENING':
            qs = qs.filter(reference__startswith='OPEN-')
        elif entry_type == 'MANUAL':
            qs = qs.filter(Q(reference__startswith='OFF-') | Q(reference__startswith='INT-'))
        elif entry_type == 'AUTO':
            qs = qs.exclude(
                Q(reference__startswith='OPEN-') | 
                Q(reference__startswith='OFF-') | 
                Q(reference__startswith='INT-')
            )

        # Search
        search = params.get('search')
        if search:
            qs = qs.filter(description__icontains=search)

        # Advanced Filters
        is_verified = params.get('verified')
        if is_verified is not None:
            qs = qs.filter(is_verified=(is_verified.lower() == 'true'))

        is_locked = params.get('locked')
        if is_locked is not None:
            qs = qs.filter(is_locked=(is_locked.lower() == 'true'))

        user_id = params.get('user')
        if user_id:
            qs = qs.filter(created_by_id=user_id)

        auto_source = params.get('auto_source')
        if auto_source:
            if auto_source == 'INVOICE':
                qs = qs.filter(reference__startswith='INV-')
            elif auto_source == 'PAYMENT':
                qs = qs.filter(Q(reference__startswith='CUS-') | Q(reference__startswith='SUP-'))
            elif auto_source == 'RETURN':
                qs = qs.filter(Q(reference__startswith='SAL-') | Q(reference__startswith='PUR-') | Q(reference__startswith='CRE-'))
            elif auto_source == 'PAYROLL':
                qs = qs.filter(Q(reference__startswith='PAYROLL-') | Q(reference__startswith='PRL-'))

        return qs

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        # --- STRICT SCOPE ENFORCEMENT ---
        scope = request.data.get('scope', 'OFFICIAL')
        self.check_scope_permission(scope)
        
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
        """DANGEROUS: Clears all financial data. Restricted to superusers."""
        if not request.user or not request.user.is_superuser:
            return Response({"error": "Forbidden: Only superusers can clear financial data."}, status=status.HTTP_403_FORBIDDEN)
        
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        LedgerService.clear_all_data(organization)
        return Response({"message": "All data cleared successfully"})

    @action(detail=False, methods=['get', 'post'], url_path='vat-settlement')
    def vat_settlement(self, request):
        """
        GET  → Preview the TVA settlement calculation for a period (no posting).
        POST → Post the settlement entry to the ledger and pay the net to DGI.

        Query/Body params:
          period_start: YYYY-MM-DD
          period_end:   YYYY-MM-DD
          bank_account_id: int (required for POST only)
        """
        from apps.finance.services.vat_settlement_service import VATSettlementService

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)

        data = request.data if request.method == 'POST' else request.query_params
        period_start = data.get('period_start')
        period_end = data.get('period_end')

        if not period_start or not period_end:
            return Response(
                {"error": "period_start and period_end are required (format: YYYY-MM-DD)"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if request.method == 'GET':
                report = VATSettlementService.calculate_settlement(organization, period_start, period_end)
                return Response(report)

            # POST — post the settlement entry
            bank_account_id = data.get('bank_account_id')
            if not bank_account_id:
                return Response({"error": "bank_account_id is required to post the settlement"}, status=400)

            result = VATSettlementService.post_settlement(
                organization=organization,
                period_start=period_start,
                period_end=period_end,
                bank_account_id=int(bank_account_id),
                user=request.user
            )
            return Response(result, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        # --- STRICT SCOPE ENFORCEMENT ---
        if 'scope' in request.data:
            self.check_scope_permission(request.data.get('scope'))

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
            return Response({"error": str(e)}, status=400)


class TransactionSequenceViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only: Sequence generators must not be manually modified via API."""
    queryset = TransactionSequence.objects.all()
    serializer_class = TransactionSequenceSerializer

    def get_queryset(self):
        org_id = get_current_tenant_id()
        return super().get_queryset().filter(organization_id=org_id)


class ForensicAuditLogViewSet(TenantModelViewSet):
    queryset = ForensicAuditLog.objects.all()
    serializer_class = ForensicAuditLogSerializer
    http_method_names = ['get'] # Strictly read-only

    def get_queryset(self):
        qs = super().get_queryset().order_by('-timestamp')
        
        # --- STRICT SCOPE ISOLATION ---
        from erp.middleware import get_authorized_scope
        auth_scope = get_authorized_scope() or 'official'
        if auth_scope == 'official':
             from django.db.models import Q
             # Filter payload for _scope='OFFICIAL' or no _scope (legacy)
             qs = qs.filter(Q(payload___scope='OFFICIAL') | Q(payload___scope__isnull=True))
        return qs


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
