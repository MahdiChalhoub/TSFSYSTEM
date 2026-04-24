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

        try:
            from apps.finance.services.closing_service import ClosingService
            result = ClosingService.close_fiscal_year(
                organization, fiscal_year,
                user=request.user if request.user.is_authenticated else None,
                close_date=close_date,
                dry_run=dry_run,
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

        from apps.finance.models import ChartOfAccount, JournalEntry, FiscalPeriod
        from django.db.models import Sum, Q, Count
        from decimal import Decimal

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
        draft_je = draft_qs.count()
        posted_je = JournalEntry.objects.filter(
            organization=organization, status='POSTED',
        ).filter(
            Q(fiscal_year=fiscal_year) |
            Q(fiscal_year__isnull=True,
              transaction_date__date__gte=fiscal_year.start_date,
              transaction_date__date__lte=fiscal_year.end_date)
        ).count()

        # P&L summary
        income_accounts = ChartOfAccount.objects.filter(
            organization=organization, type='INCOME', is_active=True,
        )
        expense_accounts = ChartOfAccount.objects.filter(
            organization=organization, type='EXPENSE', is_active=True,
        )

        total_revenue = abs(income_accounts.aggregate(s=Sum('balance_official'))['s'] or Decimal(0))
        total_expenses = expense_accounts.aggregate(s=Sum('balance_official'))['s'] or Decimal(0)
        net_income = total_revenue - total_expenses

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

        # Balance sheet accounts for opening balances preview
        bs_accounts = ChartOfAccount.objects.filter(
            organization=organization, type__in=['ASSET', 'LIABILITY', 'EQUITY'],
            is_active=True,
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
                'id': cje.id,
                'reference': cje.reference,
                'date': str(cje.transaction_date),
                'description': cje.description,
                'lines': [{'code': l.account.code, 'name': l.account.name, 'debit': float(l.debit), 'credit': float(l.credit)} for l in closing_lines],
            }

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
        je_by_month_rows = (
            JournalEntry.objects.filter(organization=org, status='POSTED')
            .filter(
                Q(fiscal_year=fiscal_year) |
                Q(fiscal_year__isnull=True,
                  transaction_date__date__gte=fiscal_year.start_date,
                  transaction_date__date__lte=fiscal_year.end_date)
            )
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
