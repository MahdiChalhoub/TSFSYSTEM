"""
FiscalYearViewSet mixins — `finalize` + `close_preview` + `draft_audit`.

Heavy actions extracted from `fiscal_views.py` for the 300-line
maintainability ceiling. Inherited by `FiscalYearViewSet`.
"""
from .base import (
    status, Response, action,
    get_current_tenant_id, Organization,
)


class FiscalYearFinalizeMixin:
    """@action methods: finalize, draft_audit."""

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
            allowed = False
            if request.user and request.user.is_authenticated:
                if request.user.is_superuser:
                    allowed = True
                else:
                    try:
                        from kernel.rbac.permissions import check_permission
                        allowed = check_permission(
                            request.user, 'finance.override_close_checklist', organization,
                        )
                    except ImportError:
                        allowed = False
            if not allowed:
                return Response(
                    {"error": "Checklist override requires the 'finance.override_close_checklist' permission (or superuser)."},
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

    @action(detail=True, methods=['get'], url_path='draft-audit')
    def draft_audit(self, request, pk=None):
        """List all draft JEs in this fiscal year — for blocker resolution."""
        from kernel.rbac.permissions import check_permission

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


class FiscalYearClosePreviewMixin:
    """@action method: close_preview."""

    @action(detail=True, methods=['get'], url_path='close-preview')
    def close_preview(self, request, pk=None):
        """Pre-close report: show what will happen before year-end close."""
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        from apps.finance.models import (
            ChartOfAccount, JournalEntry, JournalEntryLine, FiscalPeriod, FiscalYear,
        )
        from django.db.models import Sum, Q
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
        # OFFICIAL → balance_official (OFFICIAL journals only)
        # INTERNAL → balance           (all journals — full picture)
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
