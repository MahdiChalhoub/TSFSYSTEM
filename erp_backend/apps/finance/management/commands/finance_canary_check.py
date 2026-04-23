"""
finance_canary_check — One-shot production canary gate for flipping
USE_JE_OPENING. Runs the four accounting invariants the user requires
before rollout:

  1. Trial balance: ΣDebit == ΣCredit per year, per scope
  2. Balance sheet: Assets = Liabilities + Equity per year, per scope
  3. Retained earnings continuity: new-year RE opening == prior-year RE close
  4. OB↔JE account-level drift: max abs diff ≤ 1¢ across every account

Any failure → exit code 1 (CI-gated). Use in a monitoring loop during
the 48h canary window:

  while true; do
    python manage.py finance_canary_check --org acme || alert
    sleep 300
  done
"""
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Sum, Q
from erp.models import Organization
from apps.finance.models import FiscalYear, JournalEntryLine, ChartOfAccount
from apps.finance.services.closing_service import ClosingService


TOL = Decimal('0.01')


class Command(BaseCommand):
    help = 'Canary gate — runs TB, BS, RE continuity, and OB/JE drift checks per tenant.'

    def add_arguments(self, parser):
        parser.add_argument('--org', help='Organization slug')
        parser.add_argument('--org-id', type=int, help='Organization ID')
        parser.add_argument('--all', action='store_true', help='Process all organizations')
        parser.add_argument('--verbose-fail', action='store_true',
            help='Print every failing account/scope even if noisy')
        # Post-flip invariant: snapshot balances before flipping USE_JE_OPENING,
        # diff against them after. The diff output exits 1 if any account
        # drifted more than 1¢ — drop straight into deploy pipelines so the
        # flip is auto-gated by "nothing changed" before we commit.
        parser.add_argument('--snapshot', metavar='PATH',
            help='Write a trial-balance snapshot to PATH (JSON). Run before flipping USE_JE_OPENING.')
        parser.add_argument('--diff-snapshot', metavar='PATH',
            help='Compare current balances against the snapshot at PATH. Exit 1 on any drift > 1¢.')

    def handle(self, *args, **options):
        if options['all']:
            orgs = list(Organization.objects.all())
        elif options.get('org_id'):
            orgs = [Organization.objects.get(id=options['org_id'])]
        elif options.get('org'):
            orgs = [Organization.objects.get(slug=options['org'])]
        else:
            raise CommandError('Specify --org, --org-id, or --all')

        # Snapshot / diff modes short-circuit the full canary — they run
        # a simpler trial-balance aggregation per (org, fy, scope, account)
        # and either serialize it or diff it against a previously serialized
        # one. No BS equation checks here — this is specifically for
        # verifying "nothing changed across the flag flip".
        if options.get('snapshot'):
            self._write_snapshot(orgs, options['snapshot'])
            return
        if options.get('diff_snapshot'):
            self._diff_snapshot(orgs, options['diff_snapshot'])
            return

        any_fail = False

        for org in orgs:
            self.stdout.write(self.style.NOTICE(f'\n── {org.slug} (id={org.id}) ──'))
            org_failures = 0
            years = list(FiscalYear.objects.filter(organization=org).order_by('start_date'))
            for fy in years:
                failures = self._check_year(org, fy, verbose=options['verbose_fail'])
                if failures:
                    org_failures += len(failures)
                    self.stdout.write(self.style.ERROR(
                        f'  FAIL  {fy.name} — {len(failures)} check(s) failed'
                    ))
                    for f in failures:
                        self.stdout.write(f'    • {f}')
                else:
                    self.stdout.write(self.style.SUCCESS(f'  PASS  {fy.name}'))
            if org_failures:
                any_fail = True
                self.stdout.write(self.style.ERROR(
                    f'  {org.slug}: {org_failures} canary violation(s) across {len(years)} year(s)'
                ))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f'  {org.slug}: all {len(years)} year(s) pass canary'
                ))

        if any_fail:
            self.stdout.write(self.style.ERROR('\nCANARY FAILED — do NOT flip USE_JE_OPENING.'))
            import sys
            sys.exit(1)
        self.stdout.write(self.style.SUCCESS('\nCANARY PASSED — safe to flip USE_JE_OPENING.'))

    def _compute_snapshot(self, orgs):
        """Aggregate posted JE lines into {org: {fy: {scope: {account: net}}}}.

        Uses a single grouped query per (org, fy, scope) slice. Includes
        every account that has non-zero activity — balance-sheet, P&L,
        and OPENING JE lines alike, because the goal is to prove the
        flag flip didn't move any number anywhere.
        """
        snap = {}
        for org in orgs:
            # org.id may be UUID — coerce to str for JSON portability
            snap[org.slug] = {'org_id': str(org.id), 'years': {}}
            for fy in FiscalYear.objects.filter(organization=org).order_by('start_date'):
                snap[org.slug]['years'][fy.name] = {
                    'fy_id': fy.id,
                    'scopes': {'OFFICIAL': {}, 'INTERNAL': {}},
                }
                for scope in ('OFFICIAL', 'INTERNAL'):
                    agg = (
                        JournalEntryLine.objects
                        .filter(
                            journal_entry__organization=org,
                            journal_entry__status='POSTED',
                            journal_entry__scope=scope,
                        )
                        .filter(
                            Q(journal_entry__fiscal_year=fy) |
                            Q(journal_entry__fiscal_year__isnull=True,
                              journal_entry__transaction_date__date__gte=fy.start_date,
                              journal_entry__transaction_date__date__lte=fy.end_date)
                        )
                        .values('account_id')
                        .annotate(d=Sum('debit'), c=Sum('credit'))
                    )
                    for row in agg:
                        d = row['d'] or Decimal('0.00')
                        c = row['c'] or Decimal('0.00')
                        net = d - c
                        if net == Decimal('0.00'):
                            continue
                        # JSON-safe: str() on Decimal preserves precision
                        snap[org.slug]['years'][fy.name]['scopes'][scope][str(row['account_id'])] = str(net)
        return snap

    def _write_snapshot(self, orgs, path):
        import json
        snap = self._compute_snapshot(orgs)
        payload = {'version': 1, 'tolerance': str(TOL), 'snapshot': snap}
        with open(path, 'w') as f:
            json.dump(payload, f, indent=2)
        total_accounts = sum(
            len(scope_map)
            for o in snap.values()
            for y in o['years'].values()
            for scope_map in y['scopes'].values()
        )
        self.stdout.write(self.style.SUCCESS(
            f'Snapshot written to {path} — {len(orgs)} org(s), {total_accounts} account-scope rows'
        ))

    def _diff_snapshot(self, orgs, path):
        import json
        with open(path) as f:
            payload = json.load(f)
        old = payload['snapshot']
        new = self._compute_snapshot(orgs)
        drifts = []

        # Walk the union of keys at every level so we catch both sides
        all_orgs = set(old) | set(new)
        for org_slug in sorted(all_orgs):
            old_org = old.get(org_slug, {'years': {}})
            new_org = new.get(org_slug, {'years': {}})
            all_years = set(old_org['years']) | set(new_org['years'])
            for fy_name in sorted(all_years):
                old_fy = old_org['years'].get(fy_name, {'scopes': {}})
                new_fy = new_org['years'].get(fy_name, {'scopes': {}})
                for scope in ('OFFICIAL', 'INTERNAL'):
                    old_s = old_fy['scopes'].get(scope, {})
                    new_s = new_fy['scopes'].get(scope, {})
                    all_accs = set(old_s) | set(new_s)
                    for acc in all_accs:
                        a = Decimal(old_s.get(acc, '0'))
                        b = Decimal(new_s.get(acc, '0'))
                        diff = (a - b).copy_abs()
                        if diff > TOL:
                            drifts.append({
                                'org': org_slug, 'fy': fy_name, 'scope': scope,
                                'account_id': acc, 'before': a, 'after': b, 'diff': diff,
                            })

        if drifts:
            self.stdout.write(self.style.ERROR(
                f'\n❌ {len(drifts)} account(s) drifted across the flag flip — rolling back advised'
            ))
            for d in drifts[:50]:
                self.stdout.write(
                    f'  {d["org"]} / {d["fy"]} / {d["scope"]} / acc={d["account_id"]}: '
                    f'{d["before"]} → {d["after"]} (Δ={d["diff"]})'
                )
            if len(drifts) > 50:
                self.stdout.write(f'  … and {len(drifts) - 50} more')
            import sys
            sys.exit(1)

        # Accounts that vanished or appeared also count as drift above
        # (net crosses zero threshold), so reaching here means numerical
        # parity across every (org, fy, scope, account) row.
        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Zero drift across the flag flip — safe to keep USE_JE_OPENING=true'
        ))

    def _check_year(self, org, fy, verbose=False):
        """Return a list of human-readable failure descriptions."""
        failures = []

        # ── 1. Trial balance per scope ──
        for scope in ('OFFICIAL', 'INTERNAL'):
            agg = JournalEntryLine.objects.filter(
                journal_entry__organization=org,
                journal_entry__status='POSTED',
                journal_entry__scope=scope,
            ).filter(
                Q(journal_entry__fiscal_year=fy) |
                Q(journal_entry__fiscal_year__isnull=True,
                  journal_entry__transaction_date__date__gte=fy.start_date,
                  journal_entry__transaction_date__date__lte=fy.end_date)
            ).aggregate(d=Sum('debit'), c=Sum('credit'))
            d = agg['d'] or Decimal('0.00')
            c = agg['c'] or Decimal('0.00')
            if (d - c).copy_abs() > TOL:
                failures.append(
                    f'[{scope}] TB mismatch: ΣDebit={d} ΣCredit={c} diff={abs(d - c)}'
                )

        # ── 2. Full accounting equation per scope ──
        # For OPEN years: the strict BS identity A = L + E does NOT hold
        # because P&L (Income / Expense) hasn't been swept to Retained
        # Earnings yet. The universal invariant that holds regardless of
        # year state is the full equation: Assets + Expenses = Liabilities
        # + Equity + Income, or equivalently ΣBS_net + ΣPL_net = 0.
        # We check the full equation always; we also check the tight
        # A = L + E form only on closed years where P&L has been cleared.
        for scope in ('OFFICIAL', 'INTERNAL'):
            sums = {}
            for t in ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'):
                agg = JournalEntryLine.objects.filter(
                    journal_entry__organization=org,
                    journal_entry__status='POSTED',
                    journal_entry__scope=scope,
                    account__type=t,
                ).filter(
                    Q(journal_entry__fiscal_year=fy) |
                    Q(journal_entry__fiscal_year__isnull=True,
                      journal_entry__transaction_date__date__gte=fy.start_date,
                      journal_entry__transaction_date__date__lte=fy.end_date)
                ).aggregate(d=Sum('debit'), c=Sum('credit'))
                sums[t] = (agg['d'] or Decimal('0.00')) - (agg['c'] or Decimal('0.00'))

            # Universal invariant: whole-book nets to zero (always true
            # for double-entry, even on open years). If this fails, there
            # are unbalanced JEs somewhere.
            total_net = sum(sums.values(), Decimal('0.00'))
            if total_net.copy_abs() > TOL:
                failures.append(
                    f'[{scope}] Full equation: ΣBS + ΣPL = {total_net} (must be 0 — unbalanced JE somewhere)'
                )

            # Strict BS identity only on closed years (P&L swept to RE)
            if fy.is_closed:
                lhs = sums['ASSET']
                rhs = -(sums['LIABILITY'] + sums['EQUITY'])
                if (lhs - rhs).copy_abs() > TOL:
                    failures.append(
                        f'[{scope}] BS equation (closed year): Assets={lhs} vs L+E={rhs} diff={abs(lhs - rhs)}'
                    )

        # ── 3. OB↔JE drift + account coverage (both must hold) ──
        # Coverage catches the zero-sum trap: a missing account on one
        # side can net to zero while hiding real data loss. Balance
        # equality alone is insufficient — we demand set equality too.
        drift_rpt = ClosingService.validate_opening_ob_vs_je(org, fy)
        for scope, data in drift_rpt['scopes'].items():
            if data['drifts']:
                if verbose:
                    for d in data['drifts']:
                        failures.append(
                            f'[{scope}] account {d["account_id"]}: OB={d["ob_net"]} JE={d["je_net"]} diff={d["diff"]}'
                        )
                else:
                    failures.append(
                        f'[{scope}] {len(data["drifts"])} account(s) with OB↔JE drift > {TOL}'
                    )
            # Account coverage — OB account set must equal JE account set
            only_ob = data.get('only_in_ob') or []
            only_je = data.get('only_in_je') or []
            if only_ob:
                failures.append(
                    f'[{scope}] {len(only_ob)} account(s) in OB but missing from OPENING JE: {only_ob[:10]}'
                )
            if only_je:
                failures.append(
                    f'[{scope}] {len(only_je)} account(s) in OPENING JE but missing from OB: {only_je[:10]}'
                )

        # ── 4. RE continuity (only if there's a prior year with a close) ──
        prior = FiscalYear.objects.filter(
            organization=org, end_date__lt=fy.start_date,
        ).order_by('-end_date').first()
        if prior and prior.is_closed:
            # Try to resolve RE account the same way ClosingService does
            from apps.finance.models.posting_rule import PostingRule
            rule = PostingRule.objects.filter(
                organization=org,
                event_code='equity.retained_earnings.transfer',
                is_active=True,
            ).select_related('account').first()
            if rule:
                re_acc = rule.account
                for scope in ('OFFICIAL', 'INTERNAL'):
                    prior_close = JournalEntryLine.objects.filter(
                        journal_entry__organization=org,
                        journal_entry__fiscal_year=prior,
                        journal_entry__status='POSTED',
                        journal_entry__scope=scope,
                        account=re_acc,
                    ).aggregate(d=Sum('debit'), c=Sum('credit'))
                    pc = (prior_close['d'] or Decimal('0.00')) - (prior_close['c'] or Decimal('0.00'))

                    this_open = JournalEntryLine.objects.filter(
                        journal_entry__organization=org,
                        journal_entry__fiscal_year=fy,
                        journal_entry__journal_type='OPENING',
                        journal_entry__status='POSTED',
                        journal_entry__scope=scope,
                        account=re_acc,
                    ).aggregate(d=Sum('debit'), c=Sum('credit'))
                    to = (this_open['d'] or Decimal('0.00')) - (this_open['c'] or Decimal('0.00'))

                    # INTERNAL opening is delta-only; compare to delta of prior close
                    if scope == 'INTERNAL':
                        off_close = JournalEntryLine.objects.filter(
                            journal_entry__organization=org,
                            journal_entry__fiscal_year=prior,
                            journal_entry__status='POSTED',
                            journal_entry__scope='OFFICIAL',
                            account=re_acc,
                        ).aggregate(d=Sum('debit'), c=Sum('credit'))
                        oc = (off_close['d'] or Decimal('0.00')) - (off_close['c'] or Decimal('0.00'))
                        pc = pc - oc

                    if (pc - to).copy_abs() > TOL:
                        failures.append(
                            f'[{scope}] RE continuity: prior close ({prior.name})={pc} '
                            f'vs this open ({fy.name})={to} diff={abs(pc - to)}'
                        )

        return failures
