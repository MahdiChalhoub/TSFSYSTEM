"""
Seed balanced, guard-respecting journal entries into every OPEN fiscal period.

Unlike `seed_ledger_test_data`, this command:
  - Refuses to post into CLOSED / SOFT_LOCKED / HARD_LOCKED / FUTURE periods
    (FiscalPeriod.can_post('user') must return True).
  - Refuses to post into FINALIZED (hard-locked) fiscal years.
  - Stamps each JE with its matching fiscal_year and fiscal_period derived
    from the transaction_date, so period aggregations include the data.
  - Picks Dr/Cr account pairs semantically by system_role / type rather than
    at random — so the entries are valid business transactions.
  - Saves the JE as DRAFT with lines first, then flips to POSTED so the
    immutable-ledger clean() check passes on balanced, ≥2-line entries.
  - Never uses force_audit_bypass — lets the model's guards speak.

Usage:
    python manage.py seed_journal_entries_safe
    python manage.py seed_journal_entries_safe --entries-per-period 5
    python manage.py seed_journal_entries_safe --org-id 3 --dry-run
"""
from __future__ import annotations

import random
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction as db_tx
from django.utils import timezone


class Command(BaseCommand):
    help = 'Seed balanced journal entries into OPEN fiscal periods only.'

    def add_arguments(self, parser):
        parser.add_argument('--org-id', type=int, default=None,
                            help='Restrict seeding to one organization id.')
        parser.add_argument('--entries-per-period', type=int, default=3,
                            help='Number of JEs to create per OPEN period (default 3).')
        parser.add_argument('--scope', choices=['OFFICIAL', 'INTERNAL', 'BOTH'], default='OFFICIAL',
                            help='Which reporting scope to seed. BOTH emits both in the same run. Default OFFICIAL.')
        parser.add_argument('--dry-run', action='store_true',
                            help='Plan only — do not persist anything.')

    # ── Account selection helpers ────────────────────────────────────────
    @staticmethod
    def _by_role(accounts, *roles):
        """First active, postable, non-control account matching any of the given system_roles."""
        for a in accounts:
            if a.system_role in roles and a.is_active and a.allow_posting and not a.is_control_account:
                return a
        return None

    @staticmethod
    def _by_type(accounts, t):
        """First active, postable, non-control account with the given `type`."""
        for a in accounts:
            if a.type == t and a.is_active and a.allow_posting and not a.is_control_account:
                return a
        return None

    def _pick_pair(self, accounts, kind):
        """Return (dr_account, cr_account) for a given transaction kind, or (None, None)."""
        if kind == 'cash_sale':
            dr = self._by_role(accounts, 'CASH_ACCOUNT', 'BANK_ACCOUNT') or self._by_type(accounts, 'ASSET')
            cr = self._by_role(accounts, 'REVENUE', 'REVENUE_CONTROL') or self._by_type(accounts, 'INCOME')
        elif kind == 'expense_payment':
            dr = self._by_role(accounts, 'EXPENSE') or self._by_type(accounts, 'EXPENSE')
            cr = self._by_role(accounts, 'CASH_ACCOUNT', 'BANK_ACCOUNT') or self._by_type(accounts, 'ASSET')
        elif kind == 'bank_deposit':
            dr = self._by_role(accounts, 'BANK_ACCOUNT') or self._by_type(accounts, 'ASSET')
            cr = self._by_role(accounts, 'CASH_ACCOUNT') or self._by_type(accounts, 'ASSET')
        elif kind == 'cogs':
            dr = self._by_role(accounts, 'COGS', 'COGS_CONTROL') or self._by_type(accounts, 'EXPENSE')
            cr = self._by_role(accounts, 'INVENTORY', 'INVENTORY_ASSET') or self._by_type(accounts, 'ASSET')
        else:
            return None, None
        if dr and cr and dr.id != cr.id:
            return dr, cr
        return None, None

    # ── Core handler ─────────────────────────────────────────────────────
    def handle(self, *args, **opts):
        from erp.models import Organization
        from apps.finance.models import ChartOfAccount
        from apps.finance.models.fiscal_models import FiscalPeriod

        org_qs = Organization.objects.all()
        if opts['org_id']:
            org_qs = org_qs.filter(id=opts['org_id'])
        if not org_qs.exists():
            self.stderr.write('No organizations match the given filter.')
            return

        n_per_period: int = opts['entries_per_period']
        dry: bool = opts['dry_run']
        scope_arg: str = opts['scope']
        scopes = ['OFFICIAL', 'INTERNAL'] if scope_arg == 'BOTH' else [scope_arg]

        KINDS = [
            ('cash_sale',       'Cash sale — retail counter'),
            ('expense_payment', 'Utility payment'),
            ('bank_deposit',    'Daily bank deposit'),
            ('cogs',            'Inventory issued to COGS'),
        ]

        for org in org_qs:
            accounts = list(
                ChartOfAccount.objects
                .filter(organization=org, is_active=True, allow_posting=True, is_control_account=False)
                .order_by('code')
            )
            if len(accounts) < 2:
                self.stdout.write(self.style.WARNING(
                    f'[{org}] Skipping — fewer than 2 postable accounts.'
                ))
                continue

            # Only OPEN periods in non-hard-locked years are eligible.
            periods = list(
                FiscalPeriod.objects
                .select_related('fiscal_year')
                .filter(
                    organization=org,
                    status='OPEN',
                    fiscal_year__is_hard_locked=False,
                    start_date__isnull=False,
                    end_date__isnull=False,
                )
                .order_by('start_date')
            )
            if not periods:
                self.stdout.write(self.style.WARNING(
                    f'[{org}] No OPEN periods in non-finalized years — nothing to seed.'
                ))
                continue

            self.stdout.write(self.style.NOTICE(
                f'[{org}] Found {len(periods)} eligible OPEN period(s).'
            ))

            created_total = 0
            skipped_total = 0

            for period in periods:
                assert period.can_post('user'), (
                    f'Period {period.name} filtered but can_post returned False — bug.'
                )
                for scope in scopes:
                    created_here, skipped_here = self._seed_one_period(
                        org=org, period=period, accounts=accounts,
                        kinds=KINDS, n=n_per_period, dry=dry, scope=scope,
                    )
                    created_total += created_here
                    skipped_total += skipped_here

            msg = (f'[{org}] {"DRY-RUN: would create" if dry else "Created"} '
                   f'{created_total} JE(s) across scopes={scopes}; '
                   f'skipped {skipped_total} (duplicate ref or no valid account pair).')
            self.stdout.write(self.style.SUCCESS(msg))

    # ── One period ───────────────────────────────────────────────────────
    def _seed_one_period(self, *, org, period, accounts, kinds, n, dry, scope):
        from apps.finance.models import JournalEntry, JournalEntryLine

        created = 0
        skipped = 0
        scope_tag = 'O' if scope == 'OFFICIAL' else 'I'

        # Anchor transaction_date = period.start + 2 days, walking forward by 3 days.
        base_date = period.start_date + timedelta(days=min(2, (period.end_date - period.start_date).days))
        max_offset = max(0, (period.end_date - base_date).days)

        for i in range(n):
            kind_key, base_desc = kinds[i % len(kinds)]
            dr_acct, cr_acct = self._pick_pair(accounts, kind_key)
            if not (dr_acct and cr_acct):
                skipped += 1
                continue

            # Spread transaction_date across the period window.
            offset = min(max_offset, i * 3)
            tx_date_d = base_date + timedelta(days=offset)
            # Sit the datetime at noon UTC so it can't land outside the date window.
            tx_dt = timezone.make_aware(datetime.combine(tx_date_d, time(hour=12)))

            # Amount: 100..10_000 in 50 steps, deterministic per period.id so reruns stable.
            rnd = random.Random(period.id * 1000 + i)
            amount = Decimal(str(rnd.randrange(2, 201) * 50))  # 100..10_000

            ref = f'SEED-{scope_tag}-{org.id}-P{period.id}-{i+1:02d}'
            if JournalEntry.objects.filter(organization=org, reference=ref).exists():
                skipped += 1
                continue

            if dry:
                self.stdout.write(
                    f'  · would create {ref}  [{scope}]  {tx_date_d.isoformat()}  '
                    f'Dr {dr_acct.code} / Cr {cr_acct.code}  {amount}'
                )
                created += 1
                continue

            try:
                with db_tx.atomic():
                    # Create DRAFT first — clean() only validates POSTED entries,
                    # so we can seat the lines before flipping to POSTED.
                    je = JournalEntry.objects.create(
                        organization=org,
                        description=f'{base_desc} — {period.name} [{scope}]',
                        reference=ref,
                        journal_type='GENERAL',
                        journal_role='USER_GENERAL',
                        status='DRAFT',
                        scope=scope,
                        fiscal_year=period.fiscal_year,
                        fiscal_period=period,
                        transaction_date=tx_dt,
                        total_debit=amount,
                        total_credit=amount,
                    )
                    JournalEntryLine.objects.create(
                        organization=org, journal_entry=je, account=dr_acct,
                        debit=amount, credit=Decimal('0.00'),
                        description=f'Dr {dr_acct.code} {dr_acct.name}',
                    )
                    JournalEntryLine.objects.create(
                        organization=org, journal_entry=je, account=cr_acct,
                        debit=Decimal('0.00'), credit=amount,
                        description=f'Cr {cr_acct.code} {cr_acct.name}',
                    )
                    # Now flip to POSTED — clean() validates ≥2 lines + balanced.
                    je.status = 'POSTED'
                    je.posted_at = timezone.now()
                    je.save()
                created += 1
            except Exception as exc:
                skipped += 1
                self.stderr.write(f'  ✗ {ref}: {exc}')

        if created or skipped:
            self.stdout.write(
                f'  [{period.fiscal_year.name} / {period.name}] [{scope}]  '
                f'{"(dry) " if dry else ""}created={created} skipped={skipped}'
            )
        return created, skipped
