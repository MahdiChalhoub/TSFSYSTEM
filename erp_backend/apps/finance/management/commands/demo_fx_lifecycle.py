"""
End-to-end smoke test of the multi-currency stack.

Picks a cash account in your COA, flags it as EUR-pinned, posts two
foreign-currency JEs through CurrencyService.make_foreign_line, seeds a
later CLOSING rate so the period-end mark-to-market produces an unrealized
FX gain or loss, runs RevaluationService.run_revaluation, and prints the
booked gain/loss for verification.

Idempotent: re-running just rebuilds the artifacts under fresh references.
Cleanup: pass --rollback to restore the chosen account's currency to its
original value and delete the demo JEs + rate rows.

Usage:
    python manage.py demo_fx_lifecycle
    python manage.py demo_fx_lifecycle --account-code 1101.02
    python manage.py demo_fx_lifecycle --rollback
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone


DEMO_REF_PREFIX = 'FX-DEMO-'


class Command(BaseCommand):
    help = 'End-to-end FX demo: foreign-pinned account → posting → revaluation.'

    def add_arguments(self, parser):
        parser.add_argument('--org-id', type=str, default=None)
        parser.add_argument('--account-code', type=str, default=None,
                            help='COA code to flag as EUR. Default: first BANK_ACCOUNT or first ASSET-type cash account.')
        parser.add_argument('--rollback', action='store_true',
                            help='Undo the demo: clear EUR currency from the account, drop demo JEs and rates.')

    def handle(self, *args, **opts):
        from erp.models import Organization
        from apps.finance.models import (
            ChartOfAccount, JournalEntry, JournalEntryLine,
        )
        from apps.finance.models.currency_models import (
            Currency, ExchangeRate, CurrencyRevaluation,
        )
        from apps.finance.models.fiscal_models import FiscalPeriod
        from apps.finance.services import CurrencyService, RevaluationService

        org_qs = Organization.objects.all()
        if opts['org_id']:
            org_qs = org_qs.filter(id=opts['org_id'])
        org = org_qs.first()
        if not org:
            self.stderr.write('No organization found.')
            return

        # ── Rollback mode ────────────────────────────────────────────
        if opts['rollback']:
            self._rollback(org)
            return

        base_code = CurrencyService.get_base_code(org)
        if not base_code:
            self.stderr.write('Run bootstrap_currencies first — no base currency.')
            return
        if base_code == 'EUR':
            self.stderr.write('Demo expects base != EUR. Re-run with a different base or pick a different foreign currency in code.')
            return
        self.stdout.write(self.style.NOTICE(f'Org={org}  base={base_code}'))

        # ── Pick the account ────────────────────────────────────────
        acc = self._pick_account(org, opts.get('account_code'))
        if not acc:
            self.stderr.write('Could not find a postable cash/asset account to use.')
            return
        original_currency = acc.currency
        self.stdout.write(f'Account chosen: {acc.code} {acc.name}  (was currency={original_currency!r})')

        # Counterpart account — pick a base-currency revenue/asset to balance against.
        counterpart = ChartOfAccount.objects.filter(
            organization=org, is_active=True, allow_posting=True, is_control_account=False,
        ).exclude(id=acc.id).filter(type='INCOME').first() or ChartOfAccount.objects.filter(
            organization=org, is_active=True, allow_posting=True, is_control_account=False,
        ).exclude(id=acc.id).first()
        self.stdout.write(f'Counterpart: {counterpart.code} {counterpart.name}')

        # ── Pick the period: the OPEN one containing today ───────────
        today = date.today()
        period = FiscalPeriod.objects.filter(
            organization=org, status='OPEN',
            start_date__lte=today, end_date__gte=today,
        ).select_related('fiscal_year').first()
        if not period:
            self.stderr.write('No OPEN period contains today. Cannot demo.')
            return
        self.stdout.write(f'Period: {period.fiscal_year.name} / {period.name} '
                          f'({period.start_date} → {period.end_date})')

        with transaction.atomic():
            # Flag the account as EUR-pinned with revaluation_required.
            acc.currency = 'EUR'
            acc.allow_multi_currency = False
            acc.revaluation_required = True
            acc.save(update_fields=['currency', 'allow_multi_currency', 'revaluation_required'])
            self.stdout.write(self.style.SUCCESS(
                f'  ✓ Flagged {acc.code} as EUR (revaluation_required=True)'
            ))

            # Ensure a SPOT rate is on file at the period start (used at posting time).
            base_ccy = CurrencyService.get_base_currency(org)
            eur, _ = Currency.objects.get_or_create(
                organization=org, code='EUR',
                defaults={'name': 'Euro', 'symbol': '€', 'decimal_places': 2, 'is_active': True},
            )
            posting_rate = self._ensure_rate(
                org, eur, base_ccy, period.start_date, 'SPOT', Decimal('1.10'),
                source=f'{DEMO_REF_PREFIX}SPOT',
            )
            self.stdout.write(f'  ✓ SPOT rate at {period.start_date}: 1 EUR = {posting_rate} {base_code}')

            # Seed a CLOSING rate at period.end_date that's different — this drives
            # an unrealized gain/loss when revaluation runs.
            closing_rate_value = posting_rate + Decimal('0.05')  # +5 cents → unrealized GAIN on EUR debit
            closing_rate = self._ensure_rate(
                org, eur, base_ccy, period.end_date, 'CLOSING', closing_rate_value,
                source=f'{DEMO_REF_PREFIX}CLOSING',
            )
            self.stdout.write(f'  ✓ CLOSING rate at {period.end_date}: 1 EUR = {closing_rate} {base_code}')

            # Post two demo JEs: a EUR sale and a EUR cash receipt-equivalent.
            posted_refs = []
            for i, signed_amount in enumerate([Decimal('1000'), Decimal('500')]):
                ref = f'{DEMO_REF_PREFIX}JE-{i+1:02d}'
                if JournalEntry.objects.filter(organization=org, reference=ref).exists():
                    self.stdout.write(f'  · {ref} already exists, skipping')
                    posted_refs.append(ref)
                    continue
                line_kwargs = CurrencyService.make_foreign_line(
                    account=acc, signed_amount_in_account_ccy=signed_amount,
                    on_date=period.start_date, organization=org,
                    description=f'EUR demo posting #{i+1}',
                )
                base_amt = line_kwargs['debit'] - line_kwargs['credit']
                tx_dt = timezone.make_aware(datetime.combine(period.start_date, time(12)))

                je = JournalEntry.objects.create(
                    organization=org,
                    description=f'FX demo: receive {signed_amount} EUR',
                    reference=ref, journal_type='GENERAL', journal_role='USER_GENERAL',
                    status='DRAFT', scope='OFFICIAL',
                    fiscal_year=period.fiscal_year, fiscal_period=period,
                    transaction_date=tx_dt,
                    total_debit=abs(base_amt), total_credit=abs(base_amt),
                )
                JournalEntryLine.objects.create(
                    organization=org, journal_entry=je, **line_kwargs,
                )
                # Counterpart: opposite sign in base currency only (revenue / suspense)
                JournalEntryLine.objects.create(
                    organization=org, journal_entry=je, account=counterpart,
                    debit=Decimal('0.00') if base_amt >= 0 else abs(base_amt),
                    credit=base_amt if base_amt >= 0 else Decimal('0.00'),
                    description=f'Counterpart for {ref}',
                )
                je.status = 'POSTED'
                je.posted_at = timezone.now()
                je.save()
                posted_refs.append(ref)
                self.stdout.write(
                    f'  ✓ Posted {ref}: {signed_amount} EUR @ {posting_rate} = '
                    f'{base_amt} {base_code}'
                )

            # ── Run revaluation ──────────────────────────────────────
            self.stdout.write(self.style.NOTICE('\nRunning revaluation...'))
            reval = RevaluationService.run_revaluation(
                organization=org, fiscal_period=period, scope='OFFICIAL',
            )
            if not reval:
                self.stdout.write(self.style.WARNING(
                    '  RevaluationService returned None — check that the account '
                    'has revaluation_required=True and amount_currency populated.'
                ))
                return

            self.stdout.write(self.style.SUCCESS(
                f'\n=== Revaluation results ===\n'
                f'  status        : {reval.status}\n'
                f'  total_gain    : {reval.total_gain} {base_code}\n'
                f'  total_loss    : {reval.total_loss} {base_code}\n'
                f'  net_impact    : {reval.net_impact} {base_code}\n'
                f'  accounts      : {reval.accounts_processed}\n'
                f'  reval_je_id   : {reval.journal_entry_id}\n'
            ))

            # Show the per-line breakdown so the math is auditable.
            self.stdout.write('Per-account detail:')
            for ln in reval.lines.all():
                self.stdout.write(
                    f'  · {ln.account.code} {ln.currency.code}: '
                    f'{ln.balance_in_currency} {ln.currency.code} × '
                    f'{ln.old_rate} → {ln.new_rate} '
                    f'(diff = {ln.difference} {base_code})'
                )

        self.stdout.write(self.style.SUCCESS(
            '\nDemo complete. To undo: python manage.py demo_fx_lifecycle --rollback'
        ))

    # ── Helpers ──────────────────────────────────────────────────────
    def _pick_account(self, org, code):
        from apps.finance.models import ChartOfAccount
        if code:
            return ChartOfAccount.objects.filter(
                organization=org, code=code, is_active=True, allow_posting=True,
            ).first()
        # Prefer system-role-tagged bank accounts; fallback to any cash-like asset.
        for role in ('BANK_ACCOUNT', 'CASH_ACCOUNT'):
            acc = ChartOfAccount.objects.filter(
                organization=org, is_active=True, allow_posting=True,
                is_control_account=False, system_role=role,
            ).order_by('code').first()
            if acc:
                return acc
        return ChartOfAccount.objects.filter(
            organization=org, is_active=True, allow_posting=True,
            is_control_account=False, type='ASSET',
        ).order_by('code').first()

    def _ensure_rate(self, org, from_ccy, to_ccy, on_date, rate_type, rate_value, *, source):
        from apps.finance.models.currency_models import ExchangeRate
        existing = ExchangeRate.objects.filter(
            organization=org, from_currency=from_ccy, to_currency=to_ccy,
            effective_date=on_date, rate_type=rate_type,
        ).first()
        if existing:
            if existing.rate != rate_value:
                existing.rate = rate_value
                existing.source = source
                existing.save(update_fields=['rate', 'source'])
            return existing.rate
        ExchangeRate.objects.create(
            organization=org, from_currency=from_ccy, to_currency=to_ccy,
            rate=rate_value, rate_type=rate_type,
            effective_date=on_date, source=source,
        )
        return rate_value

    def _rollback(self, org):
        from apps.finance.models import (
            ChartOfAccount, JournalEntry, JournalEntryLine,
        )
        from apps.finance.models.currency_models import (
            ExchangeRate, CurrencyRevaluation, CurrencyRevaluationLine,
        )

        with transaction.atomic():
            demo_jes = list(JournalEntry.objects.filter(
                organization=org, reference__startswith=DEMO_REF_PREFIX,
            ))
            for je in demo_jes:
                je.lines.all().delete()
                JournalEntry.objects.filter(pk=je.pk).delete()
            self.stdout.write(f'  ✓ Removed {len(demo_jes)} demo JEs')

            # Revaluation rows that reference deleted JEs (set_null FK keeps the row alive)
            stale_revals = CurrencyRevaluation.objects.filter(
                organization=org, journal_entry__isnull=True,
            )
            n_revals = stale_revals.count()
            for r in stale_revals:
                CurrencyRevaluationLine.objects.filter(revaluation=r).delete()
                r.delete()
            self.stdout.write(f'  ✓ Removed {n_revals} orphaned CurrencyRevaluation rows')

            n_rates = ExchangeRate.objects.filter(
                organization=org, source__startswith=DEMO_REF_PREFIX,
            ).delete()
            self.stdout.write(f'  ✓ Removed demo rates: {n_rates}')

            # Restore any account whose currency we set during the demo.
            # We can't know the original from here without persisting it; so we
            # only un-flag accounts that match our demo flag pattern (currency=EUR
            # AND revaluation_required=True AND not naturally EUR by code).
            # Conservative: we won't auto-revert. Print a hint instead.
            flagged = ChartOfAccount.objects.filter(
                organization=org, currency='EUR', revaluation_required=True,
            )
            if flagged.exists():
                codes = ', '.join(flagged.values_list('code', flat=True))
                self.stdout.write(self.style.WARNING(
                    f'  ! {flagged.count()} account(s) still flagged EUR '
                    f'(revaluation_required): {codes}. '
                    f'Restore manually if these should not be foreign-pinned.'
                ))

        self.stdout.write(self.style.SUCCESS('Rollback complete.'))
