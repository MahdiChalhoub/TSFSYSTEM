from rest_framework import permissions as drf_permissions
from .base import (
    transaction, viewsets, status, Response, action,
    TenantModelViewSet, UDLEViewSetMixin, get_current_tenant_id,
    Organization
)
from apps.finance.models import FiscalYear, FiscalPeriod
from apps.finance.serializers import FiscalYearSerializer, FiscalPeriodSerializer
from apps.finance.services import LedgerService
from kernel.rbac.permissions import check_permission


class FiscalActionPermission(drf_permissions.BasePermission):
    """
    Per-action RBAC for fiscal viewsets. Reads `action_permission_map` from the
    viewset: {action_name: 'module.perm_code' or (code1, code2, ...)}. Missing
    entries default to `default_permission` or deny.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        action_name = getattr(view, 'action', None)
        perm_map = getattr(view, 'action_permission_map', {}) or {}
        default = getattr(view, 'default_permission', None)
        codes = perm_map.get(action_name, default)
        if codes is None:
            return True  # action not in map and no default — allow (read-safe)
        if isinstance(codes, str):
            codes = (codes,)
        return all(check_permission(request.user, c) for c in codes)


class FiscalYearViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer
    permission_classes = [FiscalActionPermission]
    default_permission = 'finance.view_fiscal_years'
    action_permission_map = {
        'list': 'finance.view_fiscal_years',
        'retrieve': 'finance.view_fiscal_years',
        'create': 'finance.manage_fiscal_years',
        'update': 'finance.manage_fiscal_years',
        'partial_update': 'finance.manage_fiscal_years',
        'destroy': 'finance.manage_fiscal_years',
        'close': 'finance.close_fiscal_year',
        'finalize': 'finance.close_fiscal_year',
        'close_preview': 'finance.view_fiscal_years',
        'lock': 'finance.close_fiscal_year',
        'summary': 'finance.view_fiscal_years',
        'year_history': 'finance.view_fiscal_years',
        'draft_audit': 'finance.view_fiscal_years',
        'current': 'finance.view_fiscal_years',
    }

    def perform_destroy(self, instance):
        """
        Clean up related data before deleting a fiscal year.

        JournalEntries are deliberately NOT destroyed — they are immutable
        financial records. They are detached (fiscal_year=NULL, fiscal_period=NULL)
        and survive as orphans, recoverable later via close_fiscal_year's
        date-based backfill. This preserves the audit trail.

        Order matters: detach JEs first (PROTECT FK), delete OpeningBalances
        explicitly, then cascade-delete periods (CASCADE FK from FiscalYear).
        """
        if instance.is_hard_locked:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Cannot delete a permanently locked fiscal year.")
        from apps.finance.models import OpeningBalance, JournalEntry
        with transaction.atomic():
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

        try:
            from apps.finance.services.closing_service import ClosingService
            ClosingService.soft_close_fiscal_year(
                organization, fiscal_year,
                user=request.user if request.user.is_authenticated else None
            )
            return Response({"status": "Fiscal Year Soft Closed"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        """
        Year-end finalize: runs the full SAP-style sequence (P&L → retained earnings, opening
        balances for next year) and permanently hard-locks to FINALIZED.

        Pass `dry_run=true` in the request body to simulate the close
        inside an atomic block and roll back. Returns a preview payload
        describing what WOULD have been written — useful for operators
        to verify invariants + JE shape before committing.
        """
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        # Optional close_date for partial year close
        close_date = request.data.get('close_date') if hasattr(request, 'data') else None
        dry_run = bool(request.data.get('dry_run', False)) if hasattr(request, 'data') else False

        # Optional checklist override (superuser-only, audited)
        override_checklist = bool(request.data.get('override_checklist', False)) if hasattr(request, 'data') else False
        override_reason = (request.data.get('override_reason') or '').strip() if hasattr(request, 'data') else ''
        if override_checklist:
            if not (request.user and request.user.is_authenticated and request.user.is_superuser):
                return Response(
                    {"error": "Checklist override is restricted to superusers."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if not override_reason:
                return Response(
                    {"error": "override_reason is required when overriding the checklist."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            from apps.finance.services.closing_service import ClosingService
            result = ClosingService.close_fiscal_year(
                organization, fiscal_year,
                user=request.user if request.user.is_authenticated else None,
                close_date=close_date,
                dry_run=dry_run,
                override_checklist=override_checklist,
                override_reason=override_reason or None,
            )
            if dry_run:
                # Service returns the preview dict on dry-run
                return Response({
                    "status": "Dry-run complete — no changes persisted",
                    "dry_run": True,
                    "preview": result,
                })
            return Response({"status": "Fiscal Year Finalized"})
        except Exception as e:
            return Response({
                "error": str(e),
                "dry_run": dry_run,
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='close-preview')
    def close_preview(self, request, pk=None):
        """Pre-close report: show what will happen before year-end close."""
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        from apps.finance.models import ChartOfAccount, JournalEntry, JournalEntryLine, FiscalPeriod
        from django.db.models import Sum, Q, Count
        from decimal import Decimal

        # Resolve scope (preview should match the view the user is currently in).
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'
        ).lower()
        scope = (
            request.headers.get('X-Scope')
            or request.query_params.get('scope')
            or 'OFFICIAL'
        ).upper()
        if authorized == 'official' and scope == 'INTERNAL':
            scope = 'OFFICIAL'

        periods = FiscalPeriod.objects.filter(fiscal_year=fiscal_year)
        open_periods = periods.filter(status='OPEN').count()
        closed_periods = periods.filter(status='CLOSED').count()
        future_periods = periods.filter(status='FUTURE').count()

        # Drafts: match by FK OR by transaction_date in range (catches orphans)
        draft_qs = JournalEntry.objects.filter(
            organization=organization, status='DRAFT',
        ).filter(
            Q(fiscal_year=fiscal_year) |
            Q(fiscal_year__isnull=True,
              transaction_date__date__gte=fiscal_year.start_date,
              transaction_date__date__lte=fiscal_year.end_date)
        )
        if scope == 'OFFICIAL':
            draft_qs = draft_qs.filter(scope='OFFICIAL')
        draft_je = draft_qs.count()

        posted_qs = JournalEntry.objects.filter(
            organization=organization, status='POSTED',
        ).filter(
            Q(fiscal_year=fiscal_year) |
            Q(fiscal_year__isnull=True,
              transaction_date__date__gte=fiscal_year.start_date,
              transaction_date__date__lte=fiscal_year.end_date)
        )
        if scope == 'OFFICIAL':
            posted_qs = posted_qs.filter(scope='OFFICIAL')
        posted_je = posted_qs.count()

        # P&L summary — compute from POSTED JE lines for THIS year (scope-filtered),
        # NOT from `balance_official` (which is a denormalized lifetime balance).
        def _net_for_types(types):
            qs = (
                JournalEntryLine.objects
                .filter(
                    organization=organization,
                    journal_entry__status='POSTED',
                    journal_entry__is_superseded=False,
                )
                .filter(
                    Q(journal_entry__fiscal_year=fiscal_year) |
                    Q(journal_entry__fiscal_year__isnull=True,
                      journal_entry__transaction_date__date__gte=fiscal_year.start_date,
                      journal_entry__transaction_date__date__lte=fiscal_year.end_date)
                )
                .filter(account__type__in=types)
                .exclude(journal_entry__journal_type='CLOSING')
                .exclude(journal_entry__journal_role='SYSTEM_OPENING')
            )
            if scope == 'OFFICIAL':
                qs = qs.filter(journal_entry__scope='OFFICIAL')
            agg = qs.aggregate(d=Sum('debit'), c=Sum('credit'))
            return (agg['d'] or Decimal(0)) - (agg['c'] or Decimal(0))

        # Revenue is credit-normal → flip sign so the displayed number is positive
        total_revenue = abs(_net_for_types(['INCOME']))
        total_expenses = _net_for_types(['EXPENSE'])
        net_income = total_revenue - total_expenses

        income_accounts = ChartOfAccount.objects.filter(
            organization=organization, type='INCOME', is_active=True,
        )
        expense_accounts = ChartOfAccount.objects.filter(
            organization=organization, type='EXPENSE', is_active=True,
        )

        # Retained earnings — read from PostingRule (source of truth)
        from apps.finance.models.posting_rule import PostingRule
        re_rule = PostingRule.objects.filter(
            organization=organization,
            event_code='equity.retained_earnings.transfer',
            is_active=True,
        ).select_related('account').first()
        re_account = re_rule.account if re_rule else None

        # Next year
        next_year = FiscalYear.objects.filter(
            organization=organization, start_date__gt=fiscal_year.end_date
        ).order_by('start_date').first()

        # Balance-sheet accounts for opening-balances preview.
        # Use the right balance column for the scope:
        #   OFFICIAL  → balance_official (OFFICIAL journals only)
        #   INTERNAL  → balance           (all journals — full picture)
        bal_field = 'balance_official' if scope == 'OFFICIAL' else 'balance'
        bs_accounts = ChartOfAccount.objects.filter(
            organization=organization, type__in=['ASSET', 'LIABILITY', 'EQUITY'],
            is_active=True,
        ).exclude(**{bal_field: Decimal(0)}).order_by('type', 'code')
        bs_accounts_count = bs_accounts.count()

        opening_preview = []
        for acc in bs_accounts[:30]:  # Limit to 30 for performance
            opening_preview.append({
                'code': acc.code, 'name': acc.name, 'type': acc.type,
                'balance': float(getattr(acc, bal_field)),
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
        if fiscal_year.status != 'CLOSED':
            return Response({"error": "Year must be closed before locking"}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user if request.user.is_authenticated else None
        try:
            fiscal_year.transition_to('FINALIZED', user=user)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
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

        # ── Scope filter ──────────────────────────────────────────────
        # Same contract as the COA endpoint: when scope=OFFICIAL we sum
        # only OFFICIAL-tagged journal entries; INTERNAL = all journals.
        # The frontend cookie/header is forwarded by the Next.js proxy.
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'   # safe default for direct-token API calls
        ).lower()
        requested = (
            request.query_params.get('scope')
            or request.headers.get('X-Scope')
            or 'OFFICIAL'
        ).upper()
        if authorized == 'official' and requested == 'INTERNAL':
            requested = 'OFFICIAL'
        scope = requested

        def _scope_filter(qs, prefix=''):
            """Apply the OFFICIAL filter to a JE/JE-line queryset; INTERNAL = no filter."""
            if scope == 'OFFICIAL':
                key = f'{prefix}scope' if prefix else 'scope'
                return qs.filter(**{key: 'OFFICIAL'})
            return qs

        periods = fiscal_year.periods.all().order_by('start_date')

        # Journal entry stats — match by FK OR by date range for orphan JEs
        # (same logic as close_preview to catch JEs with fiscal_year=NULL)
        je_qs = JournalEntry.objects.filter(
            organization=org,
        ).filter(
            Q(fiscal_year=fiscal_year) |
            Q(fiscal_year__isnull=True,
              transaction_date__date__gte=fiscal_year.start_date,
              transaction_date__date__lte=fiscal_year.end_date)
        )
        je_qs = _scope_filter(je_qs)
        je_stats = je_qs.aggregate(
            total=Count('id'),
            posted=Count('id', filter=Q(status='POSTED')),
            draft=Count('id', filter=Q(status='DRAFT')),
            total_debit=Sum('total_debit'),
            total_credit=Sum('total_credit'),
        )

        # P&L + Balance Sheet — aggregate from posted JE lines within THIS
        # fiscal year (same proven formula as multi_year_comparison).
        # Using balance_official is wrong here: it's a live running total
        # across ALL years, not scoped to this one.
        #
        # IMPORTANT: Exclude the closing JE (which zeroes P&L into Retained
        # Earnings) and system-opening JEs (prior-year carry-forward) so the
        # summary shows actual business activity for this year.
        from decimal import Decimal

        # IDs to exclude from aggregation
        _exclude_je_ids = set()
        if fiscal_year.closing_journal_entry_id:
            _exclude_je_ids.add(fiscal_year.closing_journal_entry_id)
        if hasattr(fiscal_year, 'internal_closing_journal_entry_id') and fiscal_year.internal_closing_journal_entry_id:
            _exclude_je_ids.add(fiscal_year.internal_closing_journal_entry_id)

        def _net_by_types(types):
            """Sum net (debit-credit) for given account types within this FY."""
            qs = (
                JournalEntryLine.objects
                .filter(
                    organization=org,
                    journal_entry__status='POSTED',
                    journal_entry__is_superseded=False,
                )
                .filter(
                    Q(journal_entry__fiscal_year=fiscal_year) |
                    Q(journal_entry__fiscal_year__isnull=True,
                      journal_entry__transaction_date__date__gte=fiscal_year.start_date,
                      journal_entry__transaction_date__date__lte=fiscal_year.end_date)
                )
                .filter(account__type__in=types)
                # Exclude closing JE (zeroes P&L) and system-opening JEs
                # (prior-year carry-forward) so we see THIS year's activity.
                .exclude(journal_entry__journal_type='CLOSING')
                .exclude(journal_entry__journal_role='SYSTEM_OPENING')
            )
            if _exclude_je_ids:
                qs = qs.exclude(journal_entry_id__in=_exclude_je_ids)
            qs = _scope_filter(qs, 'journal_entry__')
            agg = qs.aggregate(d=Sum('debit'), c=Sum('credit'))
            d = agg['d'] or Decimal(0)
            c = agg['c'] or Decimal(0)
            return d - c  # raw net

        # P&L: Income is credit-normal → negate; Expense is debit-normal
        raw_income = _net_by_types(['INCOME'])
        revenue = abs(raw_income)  # Income has negative raw net (credits > debits)
        expense_bal = _net_by_types(['EXPENSE'])
        net_income = revenue - expense_bal

        # Balance Sheet — CUMULATIVE position as-of fiscal_year.end_date.
        # P&L is period activity (right thing). BS is a *position*: assets
        # liabilities and equity carry forward across years, so we sum every
        # POSTED JE line on those accounts up to and including the year-end —
        # opening JEs INCLUDED (they're the prior-year carry-in), closing JEs
        # INCLUDED (they're the equity sweep that gets us to true closing).
        # If we excluded opening like the P&L formula does, FY 2026 would show
        # only in-year movements and look like Assets = 23,925 / Liab = 0 /
        # Equity = 0, which violates A = L + E.
        def _bs_position(types):
            qs = (
                JournalEntryLine.objects
                .filter(
                    organization=org,
                    journal_entry__status='POSTED',
                    journal_entry__is_superseded=False,
                    account__type__in=types,
                    journal_entry__transaction_date__date__lte=fiscal_year.end_date,
                )
            )
            qs = _scope_filter(qs, 'journal_entry__')
            agg = qs.aggregate(d=Sum('debit'), c=Sum('credit'))
            return (agg['d'] or Decimal(0)) - (agg['c'] or Decimal(0))

        asset_bal = _bs_position(['ASSET'])
        raw_liability = _bs_position(['LIABILITY'])
        raw_equity = _bs_position(['EQUITY'])

        # Post-close P&L — includes closing JE (shows zeros after close).
        # This gives full transparency: user sees BOTH views.
        def _net_by_types_raw(types):
            """Same as _net_by_types but WITHOUT excluding closing/opening JEs."""
            qs = (
                JournalEntryLine.objects
                .filter(
                    organization=org,
                    journal_entry__status='POSTED',
                    journal_entry__is_superseded=False,
                )
                .filter(
                    Q(journal_entry__fiscal_year=fiscal_year) |
                    Q(journal_entry__fiscal_year__isnull=True,
                      journal_entry__transaction_date__date__gte=fiscal_year.start_date,
                      journal_entry__transaction_date__date__lte=fiscal_year.end_date)
                )
                .filter(account__type__in=types)
            )
            qs = _scope_filter(qs, 'journal_entry__')
            agg = qs.aggregate(d=Sum('debit'), c=Sum('credit'))
            d = agg['d'] or Decimal(0)
            c = agg['c'] or Decimal(0)
            return d - c

        raw_income_pc = _net_by_types_raw(['INCOME'])
        revenue_pc = abs(raw_income_pc)
        expense_pc = _net_by_types_raw(['EXPENSE'])
        net_income_pc = revenue_pc - expense_pc

        # Closing entries — one per scope (OFFICIAL + INTERNAL)
        def _serialize_closing_je(je_obj, scope_label):
            if not je_obj:
                return None
            lines = JournalEntryLine.objects.filter(journal_entry=je_obj).select_related('account').order_by('-debit', 'credit')
            return {
                'id': je_obj.id,
                'reference': je_obj.reference,
                'date': str(je_obj.transaction_date),
                'description': je_obj.description,
                'scope': scope_label,
                'lines': [{'code': l.account.code, 'name': l.account.name, 'debit': float(l.debit), 'credit': float(l.credit)} for l in lines],
            }

        closing_entries = []
        # OFFICIAL view shows only the OFFICIAL closing JE; INTERNAL view shows
        # both, so the user can audit either book under the toggle they expect.
        if fiscal_year.closing_journal_entry_id:
            ce = _serialize_closing_je(fiscal_year.closing_journal_entry, 'OFFICIAL')
            if ce:
                closing_entries.append(ce)
        if (
            scope == 'INTERNAL'
            and hasattr(fiscal_year, 'internal_closing_journal_entry_id')
            and fiscal_year.internal_closing_journal_entry_id
        ):
            ce = _serialize_closing_je(fiscal_year.internal_closing_journal_entry, 'INTERNAL')
            if ce:
                closing_entries.append(ce)
        # Legacy compat: closing_entry = first entry or None
        closing_je = closing_entries[0] if closing_entries else None

        # Opening balances rendering — feature-flagged migration from the
        # OpeningBalance table to OPENING journal-entry lines. When
        # USE_JE_OPENING is True, we aggregate from the OPENING JE
        # (journal_type='OPENING', status='POSTED'); otherwise the legacy
        # OB table drives the UI. Both paths produce an identical shape.
        from apps.finance.models import FiscalYear as FY
        from django.conf import settings as _s

        def _ob_rows_for_year(target_year):
            """Shape-stable list of {code,name,type,debit,credit} for UI."""
            if getattr(_s, 'USE_JE_OPENING', False):
                # Scope to SYSTEM_OPENING so user-entered capital
                # injections don't render as "carry-forward" in the
                # year-summary UI. Those live in the regular JE list.
                lines = (
                    JournalEntryLine.objects
                    .filter(
                        journal_entry__organization=org,
                        journal_entry__fiscal_year=target_year,
                        journal_entry__journal_type='OPENING',
                        journal_entry__journal_role='SYSTEM_OPENING',
                        journal_entry__status='POSTED',
                        journal_entry__is_superseded=False,
                    )
                    .select_related('account')
                    .order_by('account__type', 'account__code')
                )
                lines = _scope_filter(lines, 'journal_entry__')
                return [{
                    'code': l.account.code, 'name': l.account.name, 'type': l.account.type,
                    'debit': float(l.debit or 0), 'credit': float(l.credit or 0),
                } for l in lines]
            # Legacy path — OpeningBalance table
            obs = (
                OpeningBalance.objects
                .filter(organization=org, fiscal_year=target_year)
                .select_related('account')
                .order_by('account__type', 'account__code')
            )
            return [{
                'code': ob.account.code, 'name': ob.account.name, 'type': ob.account.type,
                'debit': float(ob.debit_amount), 'credit': float(ob.credit_amount),
            } for ob in obs]

        # Opening balances generated for next year (what THIS year sends out)
        next_fy = FY.objects.filter(organization=org, start_date__gt=fiscal_year.end_date).order_by('start_date').first()
        opening_bals = _ob_rows_for_year(next_fy) if next_fy else []

        # Opening balances received from prior year (what THIS year carries in)
        opening_bals_received = _ob_rows_for_year(fiscal_year)

        # Traceability — surface the active SYSTEM_OPENING journal entries
        # so the UI can link from "Opening Balances → FY 2026 (6 accounts)"
        # back to the specific JE row(s) that produced them. Matches the
        # closing_entry block which already does this.
        def _opening_entries_for_year(target_year):
            if not target_year:
                return []
            rows = []
            qs = JournalEntry.objects.filter(
                organization=org, fiscal_year=target_year,
                journal_type='OPENING',
                journal_role='SYSTEM_OPENING',
                status='POSTED',
                is_superseded=False,
            ).order_by('scope', 'transaction_date')
            qs = _scope_filter(qs)
            for je in qs:
                rows.append({
                    'id': je.id,
                    'reference': je.reference,
                    'scope': je.scope,
                    'transaction_date': str(je.transaction_date.date()) if je.transaction_date else None,
                    'line_count': je.lines.count(),
                    'total_debit': float(je.total_debit or 0),
                    'total_credit': float(je.total_credit or 0),
                })
            return rows

        opening_entries = _opening_entries_for_year(next_fy)
        opening_entries_received = _opening_entries_for_year(fiscal_year)

        # Period breakdown
        period_data = []
        for p in periods:
            p_je_qs = JournalEntry.objects.filter(fiscal_period=p, status='POSTED')
            p_je_count = _scope_filter(p_je_qs).count()
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
            'pnl_post_close': {'revenue': float(revenue_pc), 'expenses': float(expense_pc), 'net_income': float(net_income_pc)},
            'balance_sheet': {
                'assets': float(asset_bal), 'liabilities': float(abs(raw_liability)),
                'equity': float(abs(raw_equity)),
            },
            'closing_entry': closing_je,
            'closing_entries': closing_entries,
            'opening_balances': opening_bals,
            'opening_balances_target': next_fy.name if next_fy else None,
            'opening_balances_received': opening_bals_received,
            # Traceability — the SYSTEM_OPENING JE(s) that produced the
            # lines above. UI renders these as clickable references so
            # users can jump to the source journal entry (one JE per scope).
            'opening_entries': opening_entries,
            'opening_entries_received': opening_entries_received,
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

    @action(detail=True, methods=['post'], url_path='prior-period-adjustment')
    def prior_period_adjustment(self, request, pk=None):
        """Post (or preview) a PPA for this CLOSED fiscal year.

        Body:
          lines:    [{account_id:int, debit:str, credit:str, description?:str}, ...]
          reason:   required free text
          dry_run:  bool (default false) — if true, return preview without posting
          current_period_id: optional — else we pick the latest OPEN period

        Wraps `PriorPeriodAdjustmentService.post_adjustment` so operators
        never touch the raw service.
        """
        from apps.finance.services.prior_period_adjustment_service import (
            PriorPeriodAdjustmentService,
        )
        from apps.finance.models import FiscalPeriod
        from django.core.exceptions import ValidationError

        fy = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        lines = request.data.get('lines') or []
        reason = request.data.get('reason') or ''
        dry_run = bool(request.data.get('dry_run', False))
        current_period_id = request.data.get('current_period_id')

        # Resolve target period — caller-supplied or latest OPEN
        if current_period_id:
            try:
                current_fp = FiscalPeriod.objects.get(
                    id=current_period_id, organization=organization,
                )
            except FiscalPeriod.DoesNotExist:
                return Response({'error': 'current_period_id not found'}, status=400)
        else:
            current_fp = (
                FiscalPeriod.objects
                .filter(organization=organization, status='OPEN')
                .order_by('-start_date').first()
            )
            if not current_fp:
                return Response(
                    {'error': 'No OPEN fiscal period — create or reopen one first'},
                    status=400,
                )

        try:
            result = PriorPeriodAdjustmentService.post_adjustment(
                organization=organization,
                target_fiscal_year=fy,
                current_fiscal_period=current_fp,
                lines=lines,
                reason=reason,
                user=request.user if request.user.is_authenticated else None,
                dry_run=dry_run,
            )
            return Response(result)
        except ValidationError as e:
            return Response({'error': str(e.messages[0] if hasattr(e, 'messages') else e)}, status=400)

    @action(detail=True, methods=['get'], url_path='prior-period-adjustments')
    def list_prior_period_adjustments(self, request, pk=None):
        """List PPA JEs targeting this fiscal year (scope-filtered)."""
        from apps.finance.services.prior_period_adjustment_service import (
            PriorPeriodAdjustmentService,
        )
        fy = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        # Scope: OFFICIAL view should never see INTERNAL PPAs.
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'
        ).lower()
        scope = (
            request.headers.get('X-Scope')
            or request.query_params.get('scope')
            or 'OFFICIAL'
        ).upper()
        if authorized == 'official' and scope == 'INTERNAL':
            scope = 'OFFICIAL'

        jes = PriorPeriodAdjustmentService.list_adjustments(
            organization=organization, target_fiscal_year=fy,
        )
        # The service returns a queryset/list of JEs; narrow by scope.
        if scope == 'OFFICIAL':
            jes = [je for je in jes if getattr(je, 'scope', 'OFFICIAL') == 'OFFICIAL']

        return Response([
            {
                'id': je.id,
                'reference': je.reference,
                'transaction_date': je.transaction_date.isoformat() if je.transaction_date else None,
                'description': je.description,
                'created_by': je.created_by.username if je.created_by_id else None,
                'line_count': je.lines.count(),
            }
            for je in jes[:100]
        ])

    @action(detail=False, methods=['get'], url_path='snapshot-chain')
    def snapshot_chain(self, request):
        """Return the full hash-chained snapshot history for this org.

        Merges FiscalYearCloseSnapshot + FiscalPeriodCloseSnapshot into
        one chronologically-ordered list and verifies each row:
          • content_hash matches a fresh recompute → intact ✓
          • stored prev_hash equals the previous row's stored
            content_hash → chain unbroken ✓

        Response shape:
          {
            'rows_checked': int, 'breaks': int, 'clean': bool,
            'chain': [
              {'kind':'year'|'period', 'id', 'label', 'scope',
               'captured_at', 'content_hash', 'prev_hash',
               'status':'intact'|'content_drift'|'chain_break',
               'recomputed_hash' (only if drift),
               'expected_prev' (only if break)},
              ...
            ],
          }
        """
        from apps.finance.models import (
            FiscalYearCloseSnapshot, FiscalPeriodCloseSnapshot,
        )

        organization_id = get_current_tenant_id()

        year_rows = list(
            FiscalYearCloseSnapshot.objects
            .filter(organization_id=organization_id)
            .select_related('fiscal_year')
            .order_by('captured_at', 'id')
        )
        period_rows = list(
            FiscalPeriodCloseSnapshot.objects
            .filter(organization_id=organization_id)
            .select_related('fiscal_period')
            .order_by('captured_at', 'id')
        )

        # Merge by captured_at (+ 'id' for stable tiebreak)
        merged = []
        for s in year_rows:
            merged.append(('year', s))
        for s in period_rows:
            merged.append(('period', s))
        merged.sort(key=lambda pair: (pair[1].captured_at, pair[1].id))

        chain = []
        expected_prev = None
        breaks = 0

        for kind, s in merged:
            recomputed = s.compute_content_hash()
            content_drift = s.content_hash != recomputed
            chain_break = s.prev_hash != expected_prev

            status = 'intact'
            extra = {}
            if content_drift:
                status = 'content_drift'
                extra['recomputed_hash'] = recomputed
                breaks += 1
            elif chain_break:
                status = 'chain_break'
                extra['expected_prev'] = expected_prev
                breaks += 1

            label = (
                s.fiscal_year.name if kind == 'year'
                else s.fiscal_period.name
            )
            chain.append({
                'kind': kind,
                'id': s.id,
                'label': label,
                'scope': s.scope,
                'captured_at': s.captured_at.isoformat() if s.captured_at else None,
                'content_hash': s.content_hash,
                'prev_hash': s.prev_hash,
                'status': status,
                **extra,
            })
            # Walk using STORED hash — not recomputed — so mid-chain
            # tampering cascades and we detect it on subsequent rows too.
            expected_prev = s.content_hash

        return Response({
            'rows_checked': len(chain),
            'breaks': breaks,
            'clean': breaks == 0,
            'chain': chain,
        })

    @action(detail=False, methods=['get'], url_path='multi-year-comparison')
    def multi_year_comparison(self, request):
        """N-year comparative P&L + Balance Sheet, strategic-review shape.

        Query params:
          years: how many years to include (2-10, default 3). Anchored
                 on the current FY (containing today) OR the most recent
                 CLOSED year, whichever is later.

        Response shape:
          {
            'years': [{'id','name','start','end'}, ...]  (newest first),
            'rollups': [
              {'section':'pnl', 'label':'Revenue', 'values':[str,str,...]},
              ...
            ],
            'per_account': [
              {'account_id','code','name','type','section','values':[str,...]},
              ...
            ],
          }
        """
        from apps.finance.models import (
            FiscalYear, JournalEntryLine, ChartOfAccount,
        )
        from django.db.models import Sum, Q
        from decimal import Decimal
        from django.utils import timezone as _tz

        organization_id = get_current_tenant_id()

        # Resolve scope (header + query param), respecting authorized scope
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'
        ).lower()
        scope = (
            request.headers.get('X-Scope')
            or request.query_params.get('scope')
            or 'OFFICIAL'
        ).upper()
        if authorized == 'official' and scope == 'INTERNAL':
            scope = 'OFFICIAL'

        try:
            n = max(2, min(10, int(request.query_params.get('years') or 3)))
        except (TypeError, ValueError):
            n = 3

        # Pick anchor: current or latest year, then walk back n-1 more
        today = _tz.localdate()
        anchor = FiscalYear.objects.filter(
            organization_id=organization_id,
            start_date__lte=today, end_date__gte=today,
        ).order_by('-start_date').first()
        if anchor is None:
            anchor = FiscalYear.objects.filter(
                organization_id=organization_id,
            ).order_by('-end_date').first()
        if anchor is None:
            return Response({'years': [], 'rollups': [], 'per_account': []})

        years = [anchor]
        prev = anchor
        for _ in range(n - 1):
            nxt = (
                FiscalYear.objects
                .filter(organization_id=organization_id, end_date__lt=prev.start_date)
                .order_by('-end_date').first()
            )
            if not nxt:
                break
            years.append(nxt)
            prev = nxt
        # years list is [newest … oldest]; we'll emit columns in that order

        # Per-year aggregation (same formula as yoy_comparison) — scope-filtered
        def _agg(fy):
            qs = (
                JournalEntryLine.objects
                .filter(
                    organization_id=organization_id,
                    journal_entry__status='POSTED',
                    journal_entry__is_superseded=False,
                )
                .filter(
                    Q(journal_entry__fiscal_year=fy) |
                    Q(journal_entry__fiscal_year__isnull=True,
                      journal_entry__transaction_date__date__gte=fy.start_date,
                      journal_entry__transaction_date__date__lte=fy.end_date)
                )
            )
            if scope == 'OFFICIAL':
                qs = qs.filter(journal_entry__scope='OFFICIAL')
            rows = (
                qs
                .values('account_id', 'account__code', 'account__name', 'account__type')
                .annotate(d=Sum('debit'), c=Sum('credit'))
            )
            out = {}
            for r in rows:
                d = r['d'] or Decimal('0.00')
                c = r['c'] or Decimal('0.00')
                raw = d - c
                atype = r['account__type']
                net = (-raw) if atype in ('LIABILITY', 'EQUITY', 'INCOME') else raw
                out[r['account_id']] = {
                    'code': r['account__code'],
                    'name': r['account__name'],
                    'type': atype,
                    'net': net,
                }
            return out

        # P&L = period activity (per FY). BS = cumulative position as-of FY end.
        # Same correction as YoY — without this, Multi-Year BS rows show only
        # in-year movements (e.g. closed FY's Equity=0 instead of accumulated RE).
        def _bs_agg_cumulative(fy):
            qs = (
                JournalEntryLine.objects
                .filter(
                    organization_id=organization_id,
                    journal_entry__status='POSTED',
                    journal_entry__is_superseded=False,
                    account__type__in=('ASSET', 'LIABILITY', 'EQUITY'),
                    journal_entry__transaction_date__date__lte=fy.end_date,
                )
            )
            if scope == 'OFFICIAL':
                qs = qs.filter(journal_entry__scope='OFFICIAL')
            rows = (
                qs
                .values('account_id', 'account__code', 'account__name', 'account__type')
                .annotate(d=Sum('debit'), c=Sum('credit'))
            )
            out = {}
            for r in rows:
                d = r['d'] or Decimal('0.00')
                c = r['c'] or Decimal('0.00')
                raw_net = d - c
                atype = r['account__type']
                net = (-raw_net) if atype in ('LIABILITY', 'EQUITY') else raw_net
                out[r['account_id']] = {
                    'code': r['account__code'], 'name': r['account__name'],
                    'type': atype, 'net': net,
                }
            return out

        per_year_pnl = [_agg(y) for y in years]
        per_year_bs = [_bs_agg_cumulative(y) for y in years]
        # Merge P&L (period) + BS (cumulative) — keys don't collide (account ids
        # are uniquely typed and each side filtered to its own type set).
        per_year = [{**p, **b} for p, b in zip(per_year_pnl, per_year_bs)]

        def _rollup_across(types):
            vals = []
            for yi in per_year:
                total = Decimal('0.00')
                for v in yi.values():
                    if v['type'] in types:
                        total += v['net']
                vals.append(str(total))
            return vals

        rev_vals = _rollup_across(('INCOME',))
        exp_vals = _rollup_across(('EXPENSE',))
        # Net income per year
        ni_vals = [
            str(Decimal(rev_vals[i]) - Decimal(exp_vals[i]))
            for i in range(len(years))
        ]

        rollups = [
            {'section': 'pnl',           'label': 'Revenue',     'values': rev_vals},
            {'section': 'pnl',           'label': 'Expenses',    'values': exp_vals},
            {'section': 'pnl',           'label': 'Net Income',  'values': ni_vals},
            {'section': 'balance_sheet', 'label': 'Assets',      'values': _rollup_across(('ASSET',))},
            {'section': 'balance_sheet', 'label': 'Liabilities', 'values': _rollup_across(('LIABILITY',))},
            {'section': 'balance_sheet', 'label': 'Equity',      'values': _rollup_across(('EQUITY',))},
        ]

        # Per-account matrix — union of ids across all years
        all_ids: set[int] = set()
        for yi in per_year:
            all_ids.update(yi.keys())
        TYPE_TO_SECTION = {
            'ASSET': 'balance_sheet', 'LIABILITY': 'balance_sheet', 'EQUITY': 'balance_sheet',
            'INCOME': 'pnl', 'EXPENSE': 'pnl',
        }
        per_account = []
        for acc_id in all_ids:
            ref = None
            vals = []
            for yi in per_year:
                v = yi.get(acc_id)
                if ref is None and v is not None:
                    ref = v
                vals.append(str(v['net']) if v else '0.00')
            if ref is None:
                continue
            # Skip accounts that are zero across all years
            if all(Decimal(x) == 0 for x in vals):
                continue
            per_account.append({
                'account_id': acc_id,
                'code': ref['code'],
                'name': ref['name'],
                'type': ref['type'],
                'section': TYPE_TO_SECTION.get(ref['type'], 'other'),
                'values': vals,
            })
        per_account.sort(key=lambda x: (x['section'], x['type'], x['code'] or ''))

        return Response({
            'years': [
                {
                    'id': y.id, 'name': y.name,
                    'start': y.start_date.isoformat(),
                    'end': y.end_date.isoformat(),
                }
                for y in years
            ],
            'rollups': rollups,
            'per_account': per_account,
        })

    @action(detail=True, methods=['get'], url_path='yoy-comparison')
    def yoy_comparison(self, request, pk=None):
        """Year-over-year comparative P&L + Balance Sheet + KPIs.

        Compares THIS fiscal year's totals to the immediately prior
        fiscal year (by end_date). Reads directly from POSTED, non-
        superseded JE lines.

        Scope contract (matches `summary` and the COA endpoint):
          OFFICIAL → only OFFICIAL-tagged journals
          INTERNAL → all journals (OFFICIAL + INTERNAL combined)

        Response shape:
          {
            'current_year':  {'id','name','start','end'},
            'prior_year':    {'id','name','start','end'}  (or null),
            'pnl':  {'revenue': {curr, prior, delta, pct},
                     'expenses': {...}, 'net_income': {...}},
            'balance_sheet': {'assets', 'liabilities', 'equity'} each → {curr, prior, delta, pct},
            'accounts': [{code, name, type, curr, prior, delta, pct}],
          }
        """
        from apps.finance.models import (
            FiscalYear, JournalEntryLine, ChartOfAccount,
        )
        from django.db.models import Sum, Q
        from decimal import Decimal

        current = self.get_object()
        organization_id = get_current_tenant_id()

        # Resolve scope (header + query param), respecting authorized scope
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'
        ).lower()
        scope = (
            request.headers.get('X-Scope')
            or request.query_params.get('scope')
            or 'OFFICIAL'
        ).upper()
        if authorized == 'official' and scope == 'INTERNAL':
            scope = 'OFFICIAL'

        # Find the immediately-prior fiscal year by end_date
        prior = (
            FiscalYear.objects
            .filter(organization_id=organization_id, end_date__lt=current.start_date)
            .order_by('-end_date').first()
        )

        def _agg(fy):
            """Per-account aggregation for a fiscal year, scope-filtered.
            Returns {account_id: {code, name, type, net}} where
            net is signed with normal-balance convention flipped for
            display (debit-positive for ASSET/EXPENSE, credit-positive
            for LIABILITY/EQUITY/INCOME).
            """
            qs = (
                JournalEntryLine.objects
                .filter(
                    organization_id=organization_id,
                    journal_entry__status='POSTED',
                    journal_entry__is_superseded=False,
                )
                .filter(
                    Q(journal_entry__fiscal_year=fy) |
                    Q(journal_entry__fiscal_year__isnull=True,
                      journal_entry__transaction_date__date__gte=fy.start_date,
                      journal_entry__transaction_date__date__lte=fy.end_date)
                )
            )
            if scope == 'OFFICIAL':
                qs = qs.filter(journal_entry__scope='OFFICIAL')
            rows = (
                qs
                .values('account_id', 'account__code', 'account__name', 'account__type')
                .annotate(d=Sum('debit'), c=Sum('credit'))
            )
            out = {}
            for r in rows:
                d = r['d'] or Decimal('0.00')
                c = r['c'] or Decimal('0.00')
                raw_net = d - c  # debit - credit
                # Flip sign for credit-normal types so signed display
                # reads naturally (e.g. Revenue = positive number).
                atype = r['account__type']
                net = (-raw_net) if atype in ('LIABILITY', 'EQUITY', 'INCOME') else raw_net
                out[r['account_id']] = {
                    'code': r['account__code'],
                    'name': r['account__name'],
                    'type': atype,
                    'net': net,
                }
            return out

        # P&L is period-only → _agg uses date range. BS is a *position*: the
        # snapshot at year-end must include every prior JE. Without this, a
        # closed FY's BS shows only in-year movement (e.g. Equity=0 even though
        # retained earnings were swept years ago) — same bug class that the
        # Position Snapshot in the Summary tab had.
        def _bs_agg_cumulative(fy):
            qs = (
                JournalEntryLine.objects
                .filter(
                    organization_id=organization_id,
                    journal_entry__status='POSTED',
                    journal_entry__is_superseded=False,
                    account__type__in=('ASSET', 'LIABILITY', 'EQUITY'),
                    journal_entry__transaction_date__date__lte=fy.end_date,
                )
            )
            if scope == 'OFFICIAL':
                qs = qs.filter(journal_entry__scope='OFFICIAL')
            rows = (
                qs
                .values('account_id', 'account__code', 'account__name', 'account__type')
                .annotate(d=Sum('debit'), c=Sum('credit'))
            )
            out = {}
            for r in rows:
                d = r['d'] or Decimal('0.00')
                c = r['c'] or Decimal('0.00')
                raw_net = d - c
                atype = r['account__type']
                net = (-raw_net) if atype in ('LIABILITY', 'EQUITY') else raw_net
                out[r['account_id']] = {
                    'code': r['account__code'], 'name': r['account__name'],
                    'type': atype, 'net': net,
                }
            return out

        # P&L by-account uses period activity (_agg). BS by-account uses
        # cumulative position. Merge them so per-account display works for
        # both sections in one table.
        curr_by_acc_pnl = _agg(current)
        prior_by_acc_pnl = _agg(prior) if prior else {}
        curr_by_acc_bs = _bs_agg_cumulative(current)
        prior_by_acc_bs = _bs_agg_cumulative(prior) if prior else {}

        # Combined map: BS rows from cumulative, P&L rows from period.
        curr_by_acc = {**curr_by_acc_pnl, **curr_by_acc_bs}
        prior_by_acc = {**prior_by_acc_pnl, **prior_by_acc_bs}

        def _delta(a, b):
            delta = a - b
            pct = None
            if b != Decimal('0.00'):
                pct = float(delta / b.copy_abs() * 100)
            return {
                'current': str(a), 'prior': str(b),
                'delta': str(delta), 'pct': pct,
            }

        # Roll up by type
        def _rollup(rows_by_acc, types):
            total = Decimal('0.00')
            for v in rows_by_acc.values():
                if v['type'] in types:
                    total += v['net']
            return total

        curr_rev = _rollup(curr_by_acc, ('INCOME',))
        prior_rev = _rollup(prior_by_acc, ('INCOME',))
        curr_exp = _rollup(curr_by_acc, ('EXPENSE',))
        prior_exp = _rollup(prior_by_acc, ('EXPENSE',))
        curr_net = curr_rev - curr_exp
        prior_net = prior_rev - prior_exp

        curr_assets = _rollup(curr_by_acc, ('ASSET',))
        prior_assets = _rollup(prior_by_acc, ('ASSET',))
        curr_liab = _rollup(curr_by_acc, ('LIABILITY',))
        prior_liab = _rollup(prior_by_acc, ('LIABILITY',))
        curr_eq = _rollup(curr_by_acc, ('EQUITY',))
        prior_eq = _rollup(prior_by_acc, ('EQUITY',))

        # Per-account detail — union of current + prior keys
        all_ids = set(curr_by_acc) | set(prior_by_acc)
        per_account = []
        for acc_id in all_ids:
            c_v = curr_by_acc.get(acc_id)
            p_v = prior_by_acc.get(acc_id)
            ref = c_v or p_v
            c_net = c_v['net'] if c_v else Decimal('0.00')
            p_net = p_v['net'] if p_v else Decimal('0.00')
            if c_net == 0 and p_net == 0:
                continue
            per_account.append({
                'account_id': acc_id,
                'code': ref['code'],
                'name': ref['name'],
                'type': ref['type'],
                **_delta(c_net, p_net),
            })
        per_account.sort(key=lambda x: (x['type'], x['code'] or ''))

        return Response({
            'current_year': {
                'id': current.id, 'name': current.name,
                'start': current.start_date.isoformat(),
                'end': current.end_date.isoformat(),
            },
            'prior_year': (
                {
                    'id': prior.id, 'name': prior.name,
                    'start': prior.start_date.isoformat(),
                    'end': prior.end_date.isoformat(),
                } if prior else None
            ),
            'pnl': {
                'revenue': _delta(curr_rev, prior_rev),
                'expenses': _delta(curr_exp, prior_exp),
                'net_income': _delta(curr_net, prior_net),
            },
            'balance_sheet': {
                'assets': _delta(curr_assets, prior_assets),
                'liabilities': _delta(curr_liab, prior_liab),
                'equity': _delta(curr_eq, prior_eq),
            },
            'accounts': per_account,
        })

    @action(detail=True, methods=['get'], url_path='close-checklist')
    def close_checklist(self, request, pk=None):
        """Return the pre-close checklist run for this fiscal year.
        Creates one from the default template if none exists. Applies
        auto-checks on every call so the progress reflects current state.
        """
        from apps.finance.services.close_checklist_service import (
            CloseChecklistService,
        )
        from apps.finance.models import CloseChecklistRun, CloseChecklistTemplate

        fy = self.get_object()
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)

        run = CloseChecklistRun.objects.filter(
            organization_id=organization_id, fiscal_year=fy,
            status__in=('OPEN', 'READY'),
        ).order_by('-created_at').first()

        if run is None:
            tmpl = CloseChecklistTemplate.objects.filter(
                organization_id=organization_id,
                scope='FISCAL_YEAR', is_default=True,
            ).first()
            if tmpl is None:
                tmpl = CloseChecklistService.ensure_default_template(fy.organization)
            run = CloseChecklistService.start_run(
                fy.organization, template=tmpl, fiscal_year=fy,
            )

        CloseChecklistService.apply_auto_checks(run)
        run.refresh_from_db()

        items = [
            {
                'state_id': state.id,
                'item_id': state.item.id,
                'order': state.item.order,
                'name': state.item.name,
                'category': state.item.category,
                'is_required': state.item.is_required,
                'is_complete': state.is_complete,
                'auto_checked': state.auto_checked,
                'completed_at': state.completed_at.isoformat() if state.completed_at else None,
                'completed_by': state.completed_by.username if state.completed_by_id else None,
                'notes': state.notes,
                'auto_check_signal': state.item.auto_check_signal,
            }
            for state in run.item_states.select_related('item', 'completed_by').order_by('item__order')
        ]
        required_missing = sum(
            1 for s in items if s['is_required'] and not s['is_complete']
        )
        return Response({
            'run_id': run.id,
            'status': run.status,
            'template_name': run.template.name,
            'ready_to_close': run.is_ready_to_close(),
            'total_items': len(items),
            'completed_items': sum(1 for s in items if s['is_complete']),
            'required_missing': required_missing,
            'items': items,
        })

    @action(detail=True, methods=['post'], url_path='close-checklist/toggle')
    def close_checklist_toggle(self, request, pk=None):
        """Tick or untick a single checklist item.

        Body: { state_id: int, complete: bool, notes?: str }
        """
        from apps.finance.models import CloseChecklistItemState
        from django.utils import timezone as tz

        fy = self.get_object()
        state_id = request.data.get('state_id')
        if not state_id:
            return Response({'error': 'state_id required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            state = CloseChecklistItemState.objects.select_related('run', 'item').get(
                id=state_id, run__fiscal_year=fy,
            )
        except CloseChecklistItemState.DoesNotExist:
            return Response({'error': 'item state not found'}, status=status.HTTP_404_NOT_FOUND)

        complete = bool(request.data.get('complete', True))
        notes = request.data.get('notes') or ''
        state.is_complete = complete
        state.completed_at = tz.now() if complete else None
        state.completed_by = request.user if complete else None
        state.auto_checked = False  # manual override
        if notes:
            state.notes = notes
        state.save()

        run = state.run
        if run.is_ready_to_close() and run.status == 'OPEN':
            run.status = 'READY'
            run.save(update_fields=['status'])
        elif not run.is_ready_to_close() and run.status == 'READY':
            run.status = 'OPEN'
            run.save(update_fields=['status'])

        return Response({
            'state_id': state.id,
            'is_complete': state.is_complete,
            'run_status': run.status,
            'ready_to_close': run.is_ready_to_close(),
        })

    @action(detail=True, methods=['post'], url_path='close-checklist/add-item')
    def close_checklist_add_item(self, request, pk=None):
        """Add a custom checklist item to the running close checklist.

        Body: { name: str, category?: str, is_required?: bool }
        Creates the item on the template and adds a state to the active run.
        """
        from apps.finance.models import (
            CloseChecklistItem, CloseChecklistItemState, CloseChecklistRun,
        )
        from django.db import models as db_models

        fy = self.get_object()
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)

        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)

        category = request.data.get('category', 'OTHER')
        is_required = bool(request.data.get('is_required', False))

        run = CloseChecklistRun.objects.filter(
            organization_id=organization_id, fiscal_year=fy,
            status__in=('OPEN', 'READY'),
        ).select_related('template').order_by('-created_at').first()

        if run is None:
            return Response({'error': 'No active checklist run for this year'}, status=status.HTTP_404_NOT_FOUND)

        # Get next order
        max_order = CloseChecklistItem.objects.filter(
            organization_id=organization_id, template=run.template,
        ).aggregate(mx=db_models.Max('order'))['mx'] or 0

        item = CloseChecklistItem.objects.create(
            organization_id=organization_id,
            template=run.template,
            order=max_order + 1,
            name=name,
            category=category,
            is_required=is_required,
        )

        state = CloseChecklistItemState.objects.create(
            organization_id=organization_id,
            run=run,
            item=item,
            is_complete=False,
        )

        # Re-check run status
        if is_required and run.status == 'READY':
            run.status = 'OPEN'
            run.save(update_fields=['status'])

        return Response({
            'state_id': state.id,
            'item_id': item.id,
            'name': item.name,
            'category': item.category,
            'is_required': item.is_required,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='close-checklist/delete-item')
    def close_checklist_delete_item(self, request, pk=None):
        """Delete a checklist item from the running close checklist.

        Body: { state_id: int }
        Removes the item state and the underlying template item.
        """
        from apps.finance.models import CloseChecklistItemState

        fy = self.get_object()
        state_id = request.data.get('state_id')
        if not state_id:
            return Response({'error': 'state_id required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            state = CloseChecklistItemState.objects.select_related('run', 'item').get(
                id=state_id, run__fiscal_year=fy,
            )
        except CloseChecklistItemState.DoesNotExist:
            return Response({'error': 'item state not found'}, status=status.HTTP_404_NOT_FOUND)

        run = state.run
        item = state.item

        # Delete the state and the template item
        state.delete()
        item.delete()

        # Re-check run status
        if run.is_ready_to_close() and run.status == 'OPEN':
            run.status = 'READY'
            run.save(update_fields=['status'])
        elif not run.is_ready_to_close() and run.status == 'READY':
            run.status = 'OPEN'
            run.save(update_fields=['status'])

        return Response({'deleted': True, 'run_status': run.status})

    @action(detail=False, methods=['get'], url_path='integrity-canary')
    def integrity_canary(self, request):
        """Run the close-chain canary synchronously for the current org.

        Returns the same 5 signals the daily scheduled task reports:
          1. OB↔JE drift per fiscal year
          2. Parent-balance purity
          3. Sub-ledger (control-account partner linkage) integrity
          4. FiscalYearCloseSnapshot hash-chain
          5. Denormalized balance vs recomputed JE-line aggregation

        Read-only, completes in ~1s for a typical single-tenant book.
        Shape mirrors the Celery task result so the UI layer can render
        the same pills whether data comes from live or from a stored
        task result.
        """
        from apps.finance.tasks import run_close_chain_canary

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response(
                {'error': 'No organization context'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = run_close_chain_canary(org_id=organization_id)
        return Response(result)

    @action(detail=False, methods=['get'], url_path='current')
    def current(self, request):
        """Return the fiscal year whose [start_date, end_date] contains today."""
        from django.utils import timezone as tz
        today = tz.localdate()
        organization_id = get_current_tenant_id()
        fy = FiscalYear.objects.filter(
            organization_id=organization_id,
            start_date__lte=today,
            end_date__gte=today,
        ).order_by('start_date').first()
        if not fy:
            return Response({'detail': 'No fiscal year covers today.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(fy).data)

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

        # Scope filter — match the rest of the fiscal-year endpoints.
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'
        ).lower()
        scope = (request.headers.get('X-Scope') or request.query_params.get('scope') or 'OFFICIAL').upper()
        if authorized == 'official' and scope == 'INTERNAL':
            scope = 'OFFICIAL'
        if scope == 'OFFICIAL':
            qs = qs.filter(scope='OFFICIAL')

        # Only expose JE references to users who can read journal entries.
        # Everyone with view_fiscal_years gets the count (it's a blocker indicator).
        if check_permission(request.user, 'finance.view_journal'):
            drafts = qs.order_by('transaction_date')[:50]
            data = [{
                'id': je.id, 'reference': je.reference,
                'date': str(je.transaction_date), 'description': je.description,
                'total_debit': float(je.total_debit or 0), 'total_credit': float(je.total_credit or 0),
            } for je in drafts]
        else:
            data = []

        return Response({'drafts': data, 'total': qs.count()})


class FiscalPeriodViewSet(TenantModelViewSet):
    queryset = FiscalPeriod.objects.all()
    serializer_class = FiscalPeriodSerializer
    permission_classes = [FiscalActionPermission]
    default_permission = 'finance.view_fiscal_years'
    action_permission_map = {
        'list': 'finance.view_fiscal_years',
        'retrieve': 'finance.view_fiscal_years',
        'create': 'finance.manage_fiscal_years',
        'update': 'finance.manage_fiscal_years',
        'partial_update': 'finance.manage_fiscal_years',
        'destroy': 'finance.manage_fiscal_years',
        'close': 'finance.close_fiscal_year',
        'soft_lock': 'finance.close_fiscal_year',
        'hard_lock': 'finance.close_fiscal_year',
        'reopen': 'finance.manage_fiscal_years',
    }

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
            user = request.user if request.user.is_authenticated else None
            period.transition_to('CLOSED', user=user)
            return Response({"status": "Period Closed"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='soft-lock')
    def soft_lock(self, request, pk=None):
        """Soft-lock a period: only supervisors can post afterwards."""
        period = self.get_object()
        user = request.user if request.user.is_authenticated else None
        try:
            from apps.finance.services.closing_service import ClosingService
            ClosingService.soft_lock_period(period.organization, period, user=user)
            return Response({"status": "Period Soft-Locked"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='hard-lock')
    def hard_lock(self, request, pk=None):
        """Hard-lock a period: no posting allowed at all."""
        period = self.get_object()
        user = request.user if request.user.is_authenticated else None
        try:
            from apps.finance.services.closing_service import ClosingService
            ClosingService.hard_lock_period(period.organization, period, user=user)
            return Response({"status": "Period Hard-Locked"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """Reopen a closed/locked period (superuser-only, enforced in service)."""
        period = self.get_object()
        user = request.user if request.user.is_authenticated else None
        try:
            from apps.finance.services.closing_service import ClosingService
            ClosingService.reopen_period(period.organization, period, user=user)
            return Response({"status": "Period Reopened"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='request-reopen')
    def request_reopen(self, request, pk=None):
        """Non-superuser path: fire PERIOD_REOPEN_REQUEST so the auto-task
        engine routes it to whoever is configured (specific user, role, or
        ad-hoc user group). The requester identifies themselves and the
        reason; the approver sees both in the generated task."""
        period = self.get_object()
        user = request.user if request.user.is_authenticated else None
        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response(
                {"error": "A reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from apps.workspace.auto_task_service import fire_auto_tasks
            requester_name = (
                user.get_full_name() or user.username if user else 'Anonymous'
            )
            created = fire_auto_tasks(
                period.organization,
                'PERIOD_REOPEN_REQUEST',
                {
                    'user': user,
                    'reference': f'Period {period.name}',
                    'extra': {
                        'object_type': 'FiscalPeriod',
                        'object_id': period.id,
                        'Period': period.name,
                        'Status': period.status,
                        'Requested by': requester_name,
                        'Reason': reason,
                    },
                },
            )
            return Response({
                "status": "Request sent",
                "tasks_created": len(created),
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
