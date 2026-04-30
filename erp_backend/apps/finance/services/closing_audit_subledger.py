"""
Closing Audit — Sub-ledger integrity and JE-opening cutover readiness.

Read-only checks. Extracted from `closing_service.py` for the 300-line
maintainability ceiling. Re-attached to `ClosingService` as static
methods by the facade.
"""
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


def check_subledger_integrity(organization):
    """Sub-ledger tripwire — enforces the invariant that every JE
    line targeting a control account (AR, AP, employee advances, etc.)
    carries partner identification.

    A control account is a roll-up of per-party balances: its total
    net MUST equal the sum of its per-party nets. If a line is
    posted without a `contact` / `partner_id` link, that amount
    floats outside the sub-ledger and breaks aging, statements, and
    collection reports silently.

    Also flags orphan references — lines that name a partner_id
    whose Contact row no longer exists.

    Report shape:
      {
        'organization_id': ..., 'organization_slug': ...,
        'clean': bool,
        'control_accounts_checked': int,
        'offenders': [
          {'account_id', 'code', 'name', 'scope', 'kind',
           'n_lines', 'debit', 'credit', 'net',
           'partner_ids': [...] (only for 'orphan_partner' kind),
          },
          ...
        ],
      }

    `kind` is one of:
      'missing_partner' — contact IS NULL AND partner_id IS NULL
      'orphan_partner'  — partner_id references a non-existent Contact
    """
    from apps.finance.models import ChartOfAccount, JournalEntryLine
    from apps.finance.services.closing_service import ClosingService
    from django.db.models import Count, Sum, Q

    report = {
        'organization_id': organization.id,
        'organization_slug': getattr(organization, 'slug', None),
        'clean': True,
        'control_accounts_checked': 0,
        'offenders': [],
    }

    control_accounts = list(
        ChartOfAccount.objects.filter(
            organization=organization,
            is_control_account=True,
            is_active=True,
        )
    )
    report['control_accounts_checked'] = len(control_accounts)
    if not control_accounts:
        return report

    # Build orphan-partner lookup: partner_ids referenced on this org's
    # JE lines that don't map to an existing Contact. One query,
    # reused across scopes.
    try:
        from apps.crm.models import Contact
        referenced_ids = set(
            JournalEntryLine.objects
            .filter(
                organization=organization,
                account__in=control_accounts,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                partner_id__isnull=False,
            )
            .values_list('partner_id', flat=True)
            .distinct()
        )
        existing_ids = set(
            Contact.objects.filter(
                organization=organization,
                id__in=referenced_ids,
            ).values_list('id', flat=True)
        )
        orphan_ids = referenced_ids - existing_ids
    except Exception:
        # CRM app import failed (rare in tests); skip orphan check
        # rather than break the entire integrity pass.
        orphan_ids = set()

    for acc in control_accounts:
        for scope in ('OFFICIAL', 'INTERNAL'):
            base = JournalEntryLine.objects.filter(
                organization=organization,
                account=acc,
                journal_entry__scope=scope,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
            )

            # 1) Missing partner: no contact FK AND no partner_id
            # Only flag if the partnerless group has a non-zero NET
            # impact on the sub-ledger. If DR/CR cancel (e.g. a
            # reclass JE posted a contra-line without partner to
            # reverse the original), the sub-ledger is effectively
            # clean on this account.
            missing = base.filter(
                contact__isnull=True, partner_id__isnull=True,
            ).aggregate(d=Sum('debit'), c=Sum('credit'), n=Count('id'))
            if missing['n']:
                net = (missing['d'] or Decimal('0.00')) - (missing['c'] or Decimal('0.00'))
                if net.copy_abs() > ClosingService._RECON_TOLERANCE:
                    report['offenders'].append({
                        'account_id': acc.id,
                        'code': acc.code, 'name': acc.name,
                        'scope': scope, 'kind': 'missing_partner',
                        'n_lines': missing['n'],
                        'debit': missing['d'] or Decimal('0.00'),
                        'credit': missing['c'] or Decimal('0.00'),
                        'net': net,
                    })
                    report['clean'] = False

            # 2) Orphan partner: partner_id points nowhere
            if orphan_ids:
                orphan = base.filter(
                    partner_id__in=orphan_ids,
                ).aggregate(d=Sum('debit'), c=Sum('credit'), n=Count('id'))
                if orphan['n']:
                    net = (orphan['d'] or Decimal('0.00')) - (orphan['c'] or Decimal('0.00'))
                    orphan_refs = list(
                        base.filter(partner_id__in=orphan_ids)
                        .values_list('partner_id', flat=True)
                        .distinct()
                    )
                    report['offenders'].append({
                        'account_id': acc.id,
                        'code': acc.code, 'name': acc.name,
                        'scope': scope, 'kind': 'orphan_partner',
                        'n_lines': orphan['n'],
                        'debit': orphan['d'] or Decimal('0.00'),
                        'credit': orphan['c'] or Decimal('0.00'),
                        'net': net,
                        'partner_ids': orphan_refs,
                    })
                    report['clean'] = False

    return report


def is_safe_to_flip_flag(organization):
    """Cutover readiness gate — returns (safe: bool, report: dict).

    Walks every fiscal year for `organization`, runs the OB↔JE
    validator, and returns safe=True only if every year shows
    zero drift AND every year has a POSTED OPENING JE for each
    scope that has a corresponding OpeningBalance row.

    Call this from a management command, admin action, or a future
    UI that manages the USE_JE_OPENING flag per deployment. Never
    flip the flag on a tenant where this returns safe=False — the
    legacy and new paths will disagree and the year-summary UI
    plus the RE continuity check will start showing different
    numbers than the rest of the ledger.

    Report shape:
      {
        'organization_id': int, 'organization_slug': str,
        'safe': bool,
        'years_total': int, 'years_drift': int, 'years_missing_je': int,
        'years': [ {fy_id, fy_name, has_drift, je_coverage: {...}}, ... ],
      }
    """
    from apps.finance.models import FiscalYear, JournalEntry, OpeningBalance
    from apps.finance.services.closing_service import ClosingService

    report = {
        'organization_id': organization.id,
        'organization_slug': getattr(organization, 'slug', None),
        'safe': True,
        'years_total': 0,
        'years_drift': 0,
        'years_missing_je': 0,
        'years': [],
    }

    for fy in FiscalYear.objects.filter(organization=organization).order_by('start_date'):
        report['years_total'] += 1
        drift_rpt = ClosingService.validate_opening_ob_vs_je(organization, fy)

        # JE coverage — for every (scope) with OB rows, there must be
        # at least one POSTED OPENING JE. Missing coverage means the
        # JE path will silently show nothing for that year.
        coverage = {}
        coverage_mismatch = False
        for scope in ('OFFICIAL', 'INTERNAL'):
            has_ob = OpeningBalance.objects.filter(
                organization=organization, fiscal_year=fy, scope=scope,
            ).exists()
            has_je = JournalEntry.objects.filter(
                organization=organization, fiscal_year=fy, scope=scope,
                journal_type='OPENING', status='POSTED',
                is_superseded=False,
            ).exists()
            # Account-set equality — fine-grained safety net beyond
            # the "both exist" check. set(OB_accounts) must equal
            # set(OPENING_JE_accounts) per scope, or we risk a
            # zero-sum trap where balances match but data is
            # incomplete.
            scope_rpt = drift_rpt['scopes'].get(scope) or {}
            only_ob = scope_rpt.get('only_in_ob') or []
            only_je = scope_rpt.get('only_in_je') or []
            coverage[scope] = {
                'has_ob': has_ob, 'has_je': has_je,
                'only_in_ob': only_ob, 'only_in_je': only_je,
                'coverage_match': not only_ob and not only_je,
            }
            if has_ob and not has_je:
                report['years_missing_je'] += 1
                report['safe'] = False
            if only_ob or only_je:
                coverage_mismatch = True

        if drift_rpt['has_drift'] or coverage_mismatch:
            report['years_drift'] += 1
            report['safe'] = False

        report['years'].append({
            'fy_id': fy.id,
            'fy_name': fy.name,
            'has_drift': drift_rpt['has_drift'] or coverage_mismatch,
            'coverage': coverage,
        })

    return report
