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

    # Journal entries owned by the system (year-open/close/adjustment runs)
    # must not be mutated through the normal API surface. The close-
    # fiscal-year process owns their lifecycle — it supersedes the old JE
    # and writes a new one; no external actor may edit, delete, or
    # reverse them. The model-level `is_locked` flag still protects
    # the save() path, but UX-wise a 403 returned here is cleaner than
    # a downstream 500.
    _SYSTEM_ROLES_LOCKED = ('SYSTEM_OPENING', 'SYSTEM_CLOSING', 'SYSTEM_ADJUSTMENT')

    def _assert_not_system_owned(self, entry, action_verb='modify'):
        from rest_framework.exceptions import PermissionDenied
        if getattr(entry, 'journal_role', None) in self._SYSTEM_ROLES_LOCKED:
            raise PermissionDenied(
                f"Cannot {action_verb} system-owned journal entry "
                f"{entry.reference} (role={entry.journal_role}, "
                f"type={entry.journal_type}). These entries are produced "
                f"by the close-fiscal-year workflow and can only be "
                f"changed by reversing the fiscal-year close and "
                f"re-running it."
            )

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
            entry = JournalEntry.objects.get(pk=pk, organization=organization)
        except JournalEntry.DoesNotExist:
            return Response({"error": "Journal entry not found"}, status=status.HTTP_404_NOT_FOUND)
        self._assert_not_system_owned(entry, action_verb='reverse')

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

        # --- SYSTEM-OWNED JE GUARD ---
        try:
            entry_obj = JournalEntry.objects.get(pk=kwargs.get('pk'), organization=organization)
        except JournalEntry.DoesNotExist:
            return Response({"error": "Journal entry not found"}, status=status.HTTP_404_NOT_FOUND)
        self._assert_not_system_owned(entry_obj, action_verb='edit')

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

    def destroy(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)

        try:
            entry_obj = JournalEntry.objects.get(pk=kwargs.get('pk'), organization=organization)
        except JournalEntry.DoesNotExist:
            return Response({"error": "Journal entry not found"}, status=status.HTTP_404_NOT_FOUND)
        self._assert_not_system_owned(entry_obj, action_verb='delete')

        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'], url_path='import')
    def import_csv(self, request):
        """
        Bulk import journal entries from CSV or JSON payload.

        Accepts multipart/form-data with:
          - file: CSV file (text/csv)
          - status: 'DRAFT' | 'POSTED' (default 'DRAFT')

        Or application/json with:
          - rows: list of { date, description, debit_account_code,
                            credit_account_code, amount, reference?, currency? }
          - status: 'DRAFT' | 'POSTED'

        Returns { created: int, errors: [{ row, message }] }
        """
        import csv, io
        from decimal import Decimal, InvalidOperation

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)

        target_status = request.data.get('status', 'DRAFT')
        if target_status not in ('DRAFT', 'POSTED'):
            target_status = 'DRAFT'

        # ── Parse rows ────────────────────────────────────────────
        rows = []
        if 'file' in request.FILES:
            f = request.FILES['file']
            text = f.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                rows.append({k.strip().lower().replace(' ', '_'): v.strip() for k, v in row.items()})
        elif isinstance(request.data.get('rows'), list):
            rows = request.data['rows']
        else:
            return Response({"error": "Provide either a CSV file or a 'rows' list"}, status=400)

        if not rows:
            return Response({"error": "No rows found in input"}, status=400)

        # ── Build account code → id map ───────────────────────────
        codes = set()
        for r in rows:
            if r.get('debit_account_code'):
                codes.add(str(r['debit_account_code']).strip())
            if r.get('credit_account_code'):
                codes.add(str(r['credit_account_code']).strip())

        account_map = {
            acc.code: acc.id
            for acc in ChartOfAccount.objects.filter(
                organization=organization, code__in=codes
            )
        }

        created = 0
        errors = []

        for i, row in enumerate(rows, start=1):
            try:
                date_val = str(row.get('date', '') or '').strip()
                description = str(row.get('description', '') or '').strip() or f'Imported row {i}'
                debit_code = str(row.get('debit_account_code', '') or '').strip()
                credit_code = str(row.get('credit_account_code', '') or '').strip()
                amount_raw = str(row.get('amount', '0') or '0').strip().replace(',', '')
                reference = str(row.get('reference', '') or '').strip() or None

                if not date_val:
                    raise ValueError("date is required")
                if not debit_code:
                    raise ValueError("debit_account_code is required")
                if not credit_code:
                    raise ValueError("credit_account_code is required")

                try:
                    amount = Decimal(amount_raw)
                except InvalidOperation:
                    raise ValueError(f"Invalid amount: {amount_raw!r}")

                if amount <= 0:
                    raise ValueError("amount must be positive")

                if debit_code not in account_map:
                    raise ValueError(f"Debit account code not found: {debit_code!r}")
                if credit_code not in account_map:
                    raise ValueError(f"Credit account code not found: {credit_code!r}")

                lines = [
                    {'account_id': account_map[debit_code],  'debit': str(amount), 'credit': '0'},
                    {'account_id': account_map[credit_code], 'debit': '0', 'credit': str(amount)},
                ]

                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=date_val,
                    description=description,
                    lines=lines,
                    reference=reference,
                    status=target_status,
                    scope='OFFICIAL',
                    user=request.user,
                )
                created += 1

            except Exception as e:
                errors.append({'row': i, 'message': str(e)})

        return Response({
            'created': created,
            'errors': errors,
            'total': len(rows),
        }, status=status.HTTP_207_MULTI_STATUS if errors else status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='import-opening-balances')
    def import_opening_balances(self, request):
        """
        Bulk import opening balances from CSV.

        CSV columns (case-insensitive):
          account_code  — COA account code (required)
          balance       — Positive number (required)
                          ASSET/EXPENSE accounts become Debit lines.
                          All others (LIABILITY/EQUITY/INCOME) become Credit lines.
          date          — YYYY-MM-DD (optional; overrides query param)

        Query / body params:
          date          — YYYY-MM-DD for the opening balance entry (required if not in CSV)
          status        — 'DRAFT' | 'POSTED' (default 'DRAFT')
          auto_balance  — 'true' | 'false' (default 'true')
                          If true, an adjusting line is added to the
                          OPENING_BALANCE-role equity account to balance any difference.

        Returns { created_entry_id, lines_ok, auto_balance_amount, errors }
        """
        import csv, io
        from decimal import Decimal, InvalidOperation

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        target_status = request.data.get('status', 'DRAFT')
        if target_status not in ('DRAFT', 'POSTED'):
            target_status = 'DRAFT'

        auto_balance = str(request.data.get('auto_balance', 'true')).lower() != 'false'
        global_date = request.data.get('date') or request.query_params.get('date')

        # ── Parse rows ────────────────────────────────────────────
        rows = []
        if 'file' in request.FILES:
            f = request.FILES['file']
            text = f.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                rows.append({k.strip().lower().replace(' ', '_'): v.strip() for k, v in row.items()})
        elif isinstance(request.data.get('rows'), list):
            rows = request.data['rows']
        else:
            return Response({"error": "Provide either a CSV file or a 'rows' list"}, status=400)

        if not rows:
            return Response({"error": "No rows found in input"}, status=400)

        # ── Resolve accounts ──────────────────────────────────────
        codes = set(str(r.get('account_code', '') or '').strip() for r in rows if r.get('account_code'))
        account_map = {
            acc.code: acc
            for acc in ChartOfAccount.objects.filter(organization=organization, code__in=codes)
        }

        DEBIT_TYPES = {'ASSET', 'EXPENSE'}
        errors = []
        lines = []
        entry_date = global_date

        for i, row in enumerate(rows, start=1):
            code = str(row.get('account_code', '') or '').strip()
            balance_raw = str(row.get('balance', '0') or '0').strip().replace(',', '')
            row_date = str(row.get('date', '') or '').strip()

            if not code:
                errors.append({'row': i, 'message': 'account_code is required'})
                continue
            if code not in account_map:
                errors.append({'row': i, 'message': f'Account code {code!r} not found'})
                continue

            try:
                amount = Decimal(balance_raw)
            except InvalidOperation:
                errors.append({'row': i, 'message': f'Invalid balance: {balance_raw!r}'})
                continue

            if amount == 0:
                continue  # Skip zero balances silently

            # Use first non-empty row date as the entry date if not set globally
            if not entry_date and row_date:
                entry_date = row_date

            acc = account_map[code]
            is_debit_type = acc.type in DEBIT_TYPES

            if amount > 0:
                debit = amount if is_debit_type else Decimal('0')
                credit = Decimal('0') if is_debit_type else amount
            else:
                # Negative balance → reverse side
                abs_amount = abs(amount)
                debit = Decimal('0') if is_debit_type else abs_amount
                credit = abs_amount if is_debit_type else Decimal('0')

            lines.append({'account_id': acc.id, 'debit': str(debit), 'credit': str(credit)})

        if not entry_date:
            return Response({"error": "date is required (as query param, body field, or CSV column)"}, status=400)

        if not lines:
            return Response({"error": "No valid balance rows found", "errors": errors}, status=400)

        # ── Auto-balance ───────────────────────────────────────────
        total_debit = sum(Decimal(l['debit']) for l in lines)
        total_credit = sum(Decimal(l['credit']) for l in lines)
        diff = total_debit - total_credit
        auto_balance_amount = Decimal('0')

        if auto_balance and abs(diff) > Decimal('0.001'):
            # Find or create the Opening Balance Equity account
            equity_acc = ChartOfAccount.objects.filter(
                organization=organization,
                system_role='OPENING_BALANCE',
                is_active=True
            ).first()

            if not equity_acc:
                # Create it under Equity
                equity_acc = ChartOfAccount.objects.create(
                    organization=organization,
                    code='3999',
                    name='Opening Balance Equity',
                    type='EQUITY',
                    system_role='OPENING_BALANCE',
                    is_active=True,
                )

            # diff > 0 means more debit than credit → add credit to equity
            if diff > 0:
                lines.append({'account_id': equity_acc.id, 'debit': '0', 'credit': str(diff)})
            else:
                lines.append({'account_id': equity_acc.id, 'debit': str(abs(diff)), 'credit': '0'})

            auto_balance_amount = abs(diff)

        # ── Create the entry ──────────────────────────────────────
        try:
            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=entry_date,
                description='Opening Balance Import',
                lines=lines,
                reference=None,
                status=target_status,
                scope='OFFICIAL',
                user=request.user,
            )
        except Exception as e:
            return Response({"error": str(e), "errors": errors}, status=400)

        return Response({
            'created_entry_id': entry.id,
            'lines_ok': len(lines),
            'auto_balance_amount': str(auto_balance_amount),
            'errors': errors,
            'skipped': len(errors),
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='preview-opening-balances')
    def preview_opening_balances(self, request):
        """Preview opening balance import without writing anything."""
        import csv, io
        from decimal import Decimal, InvalidOperation

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        rows = []
        if 'file' in request.FILES:
            f = request.FILES['file']
            text = f.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                rows.append({k.strip().lower().replace(' ', '_'): v.strip() for k, v in row.items()})
        elif isinstance(request.data.get('rows'), list):
            rows = request.data['rows']
        else:
            return Response({"error": "Provide either a CSV file or a 'rows' list"}, status=400)

        codes = set(str(r.get('account_code', '') or '').strip() for r in rows if r.get('account_code'))
        account_map = {
            acc.code: {'id': acc.id, 'name': acc.name, 'type': acc.type, 'code': acc.code}
            for acc in ChartOfAccount.objects.filter(organization=organization, code__in=codes)
        }

        DEBIT_TYPES = {'ASSET', 'EXPENSE'}
        preview_rows = []
        total_debit = Decimal('0')
        total_credit = Decimal('0')

        for i, row in enumerate(rows, start=1):
            code = str(row.get('account_code', '') or '').strip()
            balance_raw = str(row.get('balance', '0') or '0').strip().replace(',', '')
            errs = []

            if not code:
                errs.append('account_code required')
            elif code not in account_map:
                errs.append(f'account {code!r} not found')

            try:
                amount = float(Decimal(balance_raw)) if balance_raw else 0
            except InvalidOperation:
                amount = 0
                errs.append(f'invalid balance: {balance_raw!r}')

            acc = account_map.get(code)
            side = None
            debit_val = 0
            credit_val = 0

            if acc and amount != 0:
                is_debit = acc['type'] in DEBIT_TYPES
                if amount > 0:
                    side = 'Dr' if is_debit else 'Cr'
                    if is_debit:
                        debit_val = amount
                        total_debit += Decimal(str(amount))
                    else:
                        credit_val = amount
                        total_credit += Decimal(str(amount))
                else:
                    side = 'Cr' if is_debit else 'Dr'
                    abs_amount = abs(amount)
                    if is_debit:
                        credit_val = abs_amount
                        total_credit += Decimal(str(abs_amount))
                    else:
                        debit_val = abs_amount
                        total_debit += Decimal(str(abs_amount))

            preview_rows.append({
                'row': i,
                'account_code': code,
                'account': acc,
                'balance': amount,
                'side': side,
                'debit': debit_val,
                'credit': credit_val,
                'errors': errs,
                'valid': len(errs) == 0 and amount != 0,
            })

        diff = float(total_debit - total_credit)
        valid = sum(1 for r in preview_rows if r['valid'])

        return Response({
            'total': len(preview_rows),
            'valid': valid,
            'invalid': len(preview_rows) - valid,
            'total_debit': float(total_debit),
            'total_credit': float(total_credit),
            'difference': diff,
            'rows': preview_rows,
        })

    @action(detail=False, methods=['post'], url_path='preview-import')
    def preview_import(self, request):
        """
        Preview CSV import without creating entries.
        Returns parsed rows with validation results and account resolutions.
        """
        import csv, io
        from decimal import Decimal, InvalidOperation

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        rows = []
        if 'file' in request.FILES:
            f = request.FILES['file']
            text = f.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                rows.append({k.strip().lower().replace(' ', '_'): v.strip() for k, v in row.items()})
        elif isinstance(request.data.get('rows'), list):
            rows = request.data['rows']
        else:
            return Response({"error": "Provide either a CSV file or a 'rows' list"}, status=400)

        codes = set()
        for r in rows:
            if r.get('debit_account_code'):
                codes.add(str(r['debit_account_code']).strip())
            if r.get('credit_account_code'):
                codes.add(str(r['credit_account_code']).strip())

        account_map = {
            acc.code: {'id': acc.id, 'name': acc.name, 'type': acc.type}
            for acc in ChartOfAccount.objects.filter(
                organization=organization, code__in=codes
            )
        }

        preview_rows = []
        for i, row in enumerate(rows, start=1):
            date_val = str(row.get('date', '') or '').strip()
            description = str(row.get('description', '') or '').strip()
            debit_code = str(row.get('debit_account_code', '') or '').strip()
            credit_code = str(row.get('credit_account_code', '') or '').strip()
            amount_raw = str(row.get('amount', '0') or '0').strip().replace(',', '')
            reference = str(row.get('reference', '') or '').strip()

            errs = []
            if not date_val:
                errs.append('date required')
            if not debit_code:
                errs.append('debit_account_code required')
            elif debit_code not in account_map:
                errs.append(f'debit account {debit_code!r} not found')
            if not credit_code:
                errs.append('credit_account_code required')
            elif credit_code not in account_map:
                errs.append(f'credit account {credit_code!r} not found')
            try:
                amount = float(Decimal(amount_raw)) if amount_raw else 0
                if amount <= 0:
                    errs.append('amount must be positive')
            except InvalidOperation:
                amount = 0
                errs.append(f'invalid amount: {amount_raw!r}')

            preview_rows.append({
                'row': i,
                'date': date_val,
                'description': description,
                'debit_code': debit_code,
                'debit_account': account_map.get(debit_code),
                'credit_code': credit_code,
                'credit_account': account_map.get(credit_code),
                'amount': amount,
                'reference': reference,
                'errors': errs,
                'valid': len(errs) == 0,
            })

        valid_count = sum(1 for r in preview_rows if r['valid'])
        return Response({
            'total': len(preview_rows),
            'valid': valid_count,
            'invalid': len(preview_rows) - valid_count,
            'rows': preview_rows,
        })

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


class TransactionSequenceViewSet(TenantModelViewSet):
    """Sequence generators for document numbering."""
    queryset = TransactionSequence.objects.all()
    serializer_class = TransactionSequenceSerializer

    def get_queryset(self):
        org_id = get_current_tenant_id()
        return super().get_queryset().filter(organization_id=org_id)

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        serializer.save(organization=organization)

    @action(detail=False, methods=['get'], url_path='preview')
    def preview(self, request):
        """Return a preview of the next document number for a given type (without consuming it)."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        seq_type = request.query_params.get('type', 'PURCHASE_ORDER')
        try:
            seq = TransactionSequence.objects.get(organization_id=org_id, type=seq_type)
            prefix = seq.prefix or ''
            suffix = seq.suffix or ''
            preview = f"{prefix}{str(seq.next_number).zfill(seq.padding)}{suffix}"
            return Response({
                'preview': preview,
                'prefix': prefix,
                'suffix': suffix,
                'next_number': seq.next_number,
                'padding': seq.padding,
            })
        except TransactionSequence.DoesNotExist:
            # No sequence row yet — use centralized prefix registry
            default_prefix = TransactionSequence.get_prefix(seq_type)
            next_num = 1
            try:
                if 'PURCHASE_ORDER' in seq_type:
                    from apps.pos.models import PurchaseOrder
                    if seq_type == 'PURCHASE_ORDER_DRAFT':
                        next_num = PurchaseOrder.objects.filter(organization_id=org_id, status='DRAFT').count() + 1
                    elif seq_type == 'PURCHASE_ORDER_INTERNAL':
                        next_num = PurchaseOrder.objects.filter(organization_id=org_id, po_number__startswith='IPO-').count() + 1
                    else:
                        next_num = PurchaseOrder.objects.filter(organization_id=org_id, po_number__startswith='PO-').count() + 1
                elif 'QUOTATION' in seq_type:
                    from apps.pos.models import Order
                    next_num = Order.objects.filter(organization_id=org_id, type='QUOTATION').count() + 1
                elif 'INVOICE' in seq_type:
                    from apps.finance.models import JournalEntry
                    next_num = JournalEntry.objects.filter(organization_id=org_id, reference__startswith='INV-').count() + 1
            except Exception:
                pass
            return Response({
                'preview': f"{default_prefix}{str(next_num).zfill(6)}",
                'prefix': default_prefix,
                'suffix': '',
                'next_number': next_num,
                'padding': 6,
            })


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
