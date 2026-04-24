"""
Detect (and optionally migrate) journal entry lines that are posted
directly to parent / header chart-of-account rows. These lines violate
the "parent = sum of children" invariant and will cause the close
integrity gate to refuse finalization.

Usage:
  # Report only (safe, default):
  python manage.py finance_detect_parent_postings

  # Filter by scope and/or organization:
  python manage.py finance_detect_parent_postings --scope OFFICIAL --org 336877c0-8c75-43bc-8463-b3e775dfee77

  # Migrate mis-posted lines to a child account you pre-selected:
  python manage.py finance_detect_parent_postings \
      --migrate --from-account 1110 --to-account 1111

The --migrate path does NOT delete or edit posted lines (the immutable
ledger forbids it). Instead it writes a reclassification JE with:
    Dr child_account  $X   (move balance into child)
    Cr parent_account $X   (contra-post removing parent net)
...per scope, dated today. The new JE is marked journal_type=ADJUSTMENT,
journal_role=SYSTEM_ADJUSTMENT. The parent account's net becomes zero.

Why not "just fix" in-place? Because those historical lines are already
part of balance sheets, reports, and possibly audit packages. The
reclassification path preserves an audit trail while correcting the
going-forward state.
"""
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count, Sum, Q
from django.utils import timezone


class Command(BaseCommand):
    help = "Detect (and optionally migrate) journal lines posted directly to parent accounts."

    def add_arguments(self, parser):
        parser.add_argument('--org', type=str, default=None,
                            help='Organization ID/UUID (default: all orgs)')
        parser.add_argument('--scope', type=str, default=None,
                            choices=['OFFICIAL', 'INTERNAL'],
                            help='Restrict to one scope (default: both)')
        parser.add_argument('--migrate', action='store_true', default=False,
                            help='Write a reclassification JE moving parent net to --to-account. '
                                 'Without this flag, the command only reports.')
        parser.add_argument('--from-account', type=str, default=None,
                            help='Parent account CODE to migrate from (required with --migrate)')
        parser.add_argument('--to-account', type=str, default=None,
                            help='Child account CODE to receive the balance (required with --migrate)')
        parser.add_argument('--fiscal-year', type=int, default=None,
                            help='Restrict scan to one FiscalYear ID')
        parser.add_argument('--force-collapse', action='store_true', default=False,
                            help=('Acknowledge that collapsing a parent into a single '
                                  'leaf may flatten segmentation the original postings '
                                  'implied (e.g. per-customer buckets under AR). '
                                  'Required whenever --from-account has more than one '
                                  'child — otherwise the migrate step refuses.'))
        parser.add_argument('--audit-reason', type=str, default=None,
                            help=('Free-text reason stamped onto the reclassification JE '
                                  'description. Highly recommended — becomes the only '
                                  'forensic breadcrumb for why this collapse was made.'))

        parser.add_argument('--dimensions', action='store_true', default=False,
                            help=('Break down each offender by partner/contact/cost_center/'
                                  'product. Use BEFORE --migrate to decide whether '
                                  '--force-collapse would silently flatten meaningful '
                                  'segmentation, or whether you need multiple targeted '
                                  '--line-ids migrations instead.'))

    def handle(self, *args, **opts):
        from apps.finance.models import ChartOfAccount, JournalEntryLine, FiscalYear
        from erp.models import Organization

        if opts['migrate']:
            if not opts['from_account'] or not opts['to_account']:
                raise CommandError(
                    "--migrate requires both --from-account and --to-account"
                )

        orgs = (
            Organization.objects.filter(id=opts['org'])
            if opts['org'] else Organization.objects.all()
        )
        scopes = [opts['scope']] if opts['scope'] else ['OFFICIAL', 'INTERNAL']

        total_offending_lines = 0
        total_orgs_clean = 0
        total_orgs_dirty = 0

        for org in orgs:
            # Parent = has children. These cannot accept direct postings.
            parent_ids = list(
                ChartOfAccount.objects
                .filter(organization=org)
                .annotate(n=Count('children'))
                .filter(n__gt=0)
                .values_list('id', flat=True)
            )
            if not parent_ids:
                continue

            org_has_issue = False
            self.stdout.write(f"\n── Org: {getattr(org, 'slug', org.id)} ──")
            for scope in scopes:
                qs = JournalEntryLine.objects.filter(
                    organization=org,
                    account_id__in=parent_ids,
                    journal_entry__scope=scope,
                    journal_entry__is_superseded=False,
                )
                if opts['fiscal_year']:
                    qs = qs.filter(journal_entry__fiscal_year_id=opts['fiscal_year'])

                rows = qs.values(
                    'account_id', 'account__code', 'account__name', 'account__type',
                ).annotate(
                    d=Sum('debit'), c=Sum('credit'), n=Count('id'),
                ).order_by('account__code')

                any_rows = False
                for r in rows:
                    net = (r['d'] or Decimal('0.00')) - (r['c'] or Decimal('0.00'))
                    total_offending_lines += r['n']
                    any_rows = True
                    org_has_issue = True
                    self.stdout.write(
                        f"  [{scope}] {r['account__code']} {r['account__name']} "
                        f"({r['account__type']}): {r['n']} line(s), "
                        f"DR {r['d']} / CR {r['c']} → net {net}"
                    )
                    if opts.get('dimensions'):
                        self._dimension_breakdown(
                            org, scope, r['account_id'], fiscal_year=opts.get('fiscal_year'),
                        )
                if not any_rows:
                    self.stdout.write(f"  [{scope}] clean ✓")

            if org_has_issue:
                total_orgs_dirty += 1
            else:
                total_orgs_clean += 1

            # ── Optional migration pass ──
            if opts['migrate'] and org_has_issue:
                self._migrate(org, opts, scopes)

        self.stdout.write("\n── Summary ──")
        self.stdout.write(f"  orgs clean:   {total_orgs_clean}")
        self.stdout.write(f"  orgs dirty:   {total_orgs_dirty}")
        self.stdout.write(f"  total lines:  {total_offending_lines}")
        if total_orgs_dirty and not opts['migrate']:
            self.stdout.write(self.style.WARNING(
                "\nRun with --migrate --from-account <code> --to-account <code> "
                "to reclassify lines into a leaf account."
            ))

    def _dimension_breakdown(self, org, scope, account_id, *, fiscal_year=None):
        """Show how the offender's balance splits across dimensional
        attributes on JE lines — so the operator can tell whether
        collapsing everything into a single leaf would silently lose
        meaningful segmentation.

        Surfaces four axes: contact (CRM), partner (raw partner_id +
        type), cost_center, product. Empty-valued rows are collected
        under '<none>' so "no partner at all" is visible.
        """
        from apps.finance.models import JournalEntryLine
        from django.db.models import Sum, Count

        base = JournalEntryLine.objects.filter(
            organization=org, account_id=account_id,
            journal_entry__scope=scope,
            journal_entry__is_superseded=False,
            journal_entry__status='POSTED',
        )
        if fiscal_year:
            base = base.filter(journal_entry__fiscal_year_id=fiscal_year)

        def _render(label, key):
            rows = (
                base.values(key)
                .annotate(d=Sum('debit'), c=Sum('credit'), n=Count('id'))
                .order_by(key)
            )
            printed = False
            for r in rows:
                val = r[key]
                if val is None or val == '':
                    val = '<none>'
                net = (r['d'] or Decimal('0.00')) - (r['c'] or Decimal('0.00'))
                if not printed:
                    self.stdout.write(f"      └─ by {label}:")
                    printed = True
                self.stdout.write(
                    f"          {str(val)[:30]:30} n={r['n']:>3}  net={net}"
                )

        _render('contact (CRM)', 'contact_id')
        _render('partner_type', 'partner_type')
        _render('cost_center', 'cost_center')
        _render('product', 'product_id')

    def _migrate(self, org, opts, scopes):
        from apps.finance.models import ChartOfAccount, JournalEntryLine
        from apps.finance.services.ledger_core import LedgerCoreMixin
        from django.db.models import Count, Sum

        from_code = opts['from_account']
        to_code = opts['to_account']

        parent = ChartOfAccount.objects.filter(
            organization=org, code=from_code,
        ).annotate(n=Count('children')).first()
        if not parent:
            self.stdout.write(self.style.ERROR(
                f"  --from-account {from_code} not found in this org"
            ))
            return
        if parent.n == 0:
            self.stdout.write(self.style.ERROR(
                f"  --from-account {from_code} has no children — it's already a leaf"
            ))
            return

        child = ChartOfAccount.objects.filter(
            organization=org, code=to_code,
        ).annotate(n=Count('children')).first()
        if not child:
            self.stdout.write(self.style.ERROR(
                f"  --to-account {to_code} not found in this org"
            ))
            return
        if child.n > 0:
            self.stdout.write(self.style.ERROR(
                f"  --to-account {to_code} is itself a parent — pick a leaf"
            ))
            return
        if not child.allow_posting:
            self.stdout.write(self.style.ERROR(
                f"  --to-account {to_code} has allow_posting=False — pick a postable leaf"
            ))
            return

        # Segmentation-collapse guard. Parents with multiple children
        # probably encode meaningful groupings (per-customer AR, per-tax
        # jurisdiction VAT, per-region revenue). Redirecting all parent
        # postings into one child flattens that structure — a loss the
        # operator must explicitly acknowledge. Single-child parents are
        # usually just malformed hierarchies (one leaf under a wrapper)
        # and don't need the extra gate.
        n_children = parent.children.count()
        if n_children > 1 and not opts['force_collapse']:
            self.stdout.write(self.style.ERROR(
                f"  {parent.code} has {n_children} child accounts — redirecting "
                f"all direct postings into a single leaf ({to_code}) will "
                f"flatten any segmentation they encoded. Pass --force-collapse "
                f"to acknowledge and proceed."
            ))
            return

        if not opts['audit_reason']:
            self.stdout.write(self.style.WARNING(
                f"  (no --audit-reason supplied — consider adding one for traceability)"
            ))

        for scope in scopes:
            agg = JournalEntryLine.objects.filter(
                organization=org, account=parent,
                journal_entry__scope=scope,
                journal_entry__is_superseded=False,
            ).aggregate(d=Sum('debit'), c=Sum('credit'))
            net = (agg['d'] or Decimal('0.00')) - (agg['c'] or Decimal('0.00'))
            if net == Decimal('0.00'):
                self.stdout.write(f"  [{scope}] net is 0 — nothing to migrate")
                continue

            # Reclassification JE: move net from parent → child.
            # net > 0 → parent net is DR → reverse with Cr parent / Dr child
            # net < 0 → parent net is CR → reverse with Dr parent / Cr child
            if net > Decimal('0.00'):
                lines = [
                    {'account_id': child.id,  'debit': net,  'credit': Decimal('0'),
                     'description': f"Reclass {from_code}→{to_code}: receive DR {net}"},
                    {'account_id': parent.id, 'debit': Decimal('0'), 'credit': net,
                     'description': f"Reclass {from_code}→{to_code}: zero parent"},
                ]
            else:
                amt = -net
                lines = [
                    {'account_id': child.id,  'debit': Decimal('0'), 'credit': amt,
                     'description': f"Reclass {from_code}→{to_code}: receive CR {amt}"},
                    {'account_id': parent.id, 'debit': amt, 'credit': Decimal('0'),
                     'description': f"Reclass {from_code}→{to_code}: zero parent"},
                ]

            # Stamp the audit reason into the JE description — it's
            # immutable once POSTED, so this is the canonical forensic
            # record of WHY the collapse happened. Users who skip the
            # reason get a placeholder that flags the gap.
            reason = opts.get('audit_reason') or '(no reason provided)'
            flatten_flag = ' [segmentation-collapsed]' if n_children > 1 else ''
            description = (
                f"Reclassification: {parent.code} → {child.code} ({scope})"
                f"{flatten_flag} — reason: {reason}"
            )

            je = LedgerCoreMixin.create_journal_entry(
                organization=org,
                transaction_date=timezone.now(),
                description=description,
                lines=lines,
                status='POSTED',
                scope=scope,
                journal_type='ADJUSTMENT',
                journal_role='SYSTEM_ADJUSTMENT',
                source_module='finance',
                source_model='ChartOfAccount',
                source_id=parent.id,
                internal_bypass=True,
            )
            self.stdout.write(self.style.SUCCESS(
                f"  [{scope}] reclassified {net} from {parent.code} to {child.code} "
                f"via JE {je.reference} ({je.id})"
            ))
