"""
Detect (and optionally repair) sub-ledger integrity violations on
control accounts — lines that lack partner identification (no Contact
FK and no partner_id) or reference a deleted Contact (orphan partner).

These violations break AR/AP aging, customer statements, collection
reports, and vendor payables — all of which enumerate transactions
grouped by partner. Without the link, the money is floating outside
the sub-ledger.

Usage:
  # Report only (safe, default):
  python manage.py finance_detect_subledger_issues

  # Filter by scope / org / fiscal year:
  python manage.py finance_detect_subledger_issues \
      --org <id> --scope OFFICIAL --fiscal-year 37

  # Repair by attributing all partnerless lines on one control account
  # to a specific Contact:
  python manage.py finance_detect_subledger_issues \
      --migrate \
      --from-account 1110 \
      --partner-id <contact_id> \
      --partner-type CUSTOMER \
      --audit-reason "Historical AR lines missing partner_id — attributed \
          to holding customer per ops decision 2026-04-24"

Repair pattern:
  Partnerless lines are immutable (POSTED). The repair writes an
  ADJUSTMENT JE per scope that:
    • reverses the partnerless net on the control account
    • re-posts the same amount on the same control account WITH the
      chosen partner link (contact + partner_type + partner_id)
  Net effect on the control account's balance: zero. Net effect on the
  sub-ledger: the partner now owns those amounts, so aging reports
  pick them up correctly going forward.

Important: this is a **collapse** just like parent reclassification —
all partnerless lines on the chosen control account are attributed to
the single specified partner. If they actually belong to multiple
customers/suppliers, you must run the command separately for each
subset (using --line-ids <id1>,<id2>,... to scope to specific lines).
"""
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Sum, Count, Q
from django.utils import timezone


PARTNER_TYPES = {'CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'PARTNER'}


class Command(BaseCommand):
    help = "Detect and optionally repair partnerless/orphan control-account lines."

    def add_arguments(self, parser):
        parser.add_argument('--org', type=str, default=None,
                            help='Organization ID/UUID (default: all orgs)')
        parser.add_argument('--scope', type=str, default=None,
                            choices=['OFFICIAL', 'INTERNAL'],
                            help='Restrict to one scope (default: both)')
        parser.add_argument('--fiscal-year', type=int, default=None,
                            help='Restrict scan to one FiscalYear ID')
        parser.add_argument('--migrate', action='store_true', default=False,
                            help='Repair partnerless lines by attributing them to --partner-id')
        parser.add_argument('--from-account', type=str, default=None,
                            help='Control account CODE to repair (required with --migrate)')
        parser.add_argument('--partner-id', type=int, default=None,
                            help='Target Contact / User ID to attribute (required with --migrate)')
        parser.add_argument('--partner-type', type=str, default=None,
                            choices=sorted(PARTNER_TYPES),
                            help='CUSTOMER / SUPPLIER / EMPLOYEE / PARTNER (required with --migrate)')
        parser.add_argument('--line-ids', type=str, default=None,
                            help='Comma-separated JournalEntryLine IDs to repair — if provided, '
                                 'only these specific lines are migrated (preserves segmentation).')
        parser.add_argument('--audit-reason', type=str, default=None,
                            help='Free-text reason stamped onto the reclassification JE description. '
                                 'Strongly recommended.')
        parser.add_argument('--use-unidentified', action='store_true', default=False,
                            help=('Auto-create (or reuse) a dedicated "Unidentified '
                                  '(Legacy Cleanup)" Contact for the --partner-type and '
                                  'attribute the partnerless lines to it. SAFER than '
                                  'rolling them into a real customer/supplier — keeps '
                                  'the legacy bucket clearly labelled in aging reports. '
                                  'When set, --partner-id is ignored.'))

    # ── Entry point ─────────────────────────────────────────
    def handle(self, *args, **opts):
        from apps.finance.models import ChartOfAccount, JournalEntryLine
        from erp.models import Organization

        if opts['migrate']:
            # --use-unidentified auto-resolves partner_id, so only
            # from_account + partner_type are required then.
            required_fields = (
                ('from_account', 'partner_type')
                if opts.get('use_unidentified')
                else ('from_account', 'partner_id', 'partner_type')
            )
            missing = [f for f in required_fields
                       if not opts.get(f)]
            if missing:
                raise CommandError(
                    f"--migrate requires: {', '.join('--' + m.replace('_','-') for m in missing)}"
                )

        orgs = (
            Organization.objects.filter(id=opts['org'])
            if opts['org'] else Organization.objects.all()
        )
        scopes = [opts['scope']] if opts['scope'] else ['OFFICIAL', 'INTERNAL']

        total_partnerless = 0
        total_orphan = 0
        dirty_orgs = 0

        for org in orgs:
            control_ids = list(
                ChartOfAccount.objects
                .filter(organization=org, is_control_account=True, is_active=True)
                .values_list('id', flat=True)
            )
            if not control_ids:
                continue

            self.stdout.write(f"\n── Org: {getattr(org, 'slug', org.id)} ──")
            org_dirty = False

            # Precompute orphan partner IDs across all control accounts
            orphan_ids = self._orphan_partner_ids(org, control_ids)

            for scope in scopes:
                # Missing-partner report
                pless = (
                    JournalEntryLine.objects
                    .filter(
                        organization=org,
                        account_id__in=control_ids,
                        journal_entry__scope=scope,
                        journal_entry__status='POSTED',
                        journal_entry__is_superseded=False,
                        contact__isnull=True, partner_id__isnull=True,
                    )
                )
                if opts['fiscal_year']:
                    pless = pless.filter(journal_entry__fiscal_year_id=opts['fiscal_year'])

                pless_by_acc = pless.values(
                    'account_id', 'account__code', 'account__name',
                ).annotate(d=Sum('debit'), c=Sum('credit'), n=Count('id'))
                for r in pless_by_acc:
                    net = (r['d'] or Decimal('0.00')) - (r['c'] or Decimal('0.00'))
                    total_partnerless += r['n']
                    org_dirty = True
                    self.stdout.write(
                        f"  [{scope}] {r['account__code']} {r['account__name']} "
                        f"MISSING-PARTNER: {r['n']} line(s), DR {r['d']} / CR {r['c']} → net {net}"
                    )

                # Orphan-partner report
                if orphan_ids:
                    orph = (
                        JournalEntryLine.objects
                        .filter(
                            organization=org,
                            account_id__in=control_ids,
                            journal_entry__scope=scope,
                            journal_entry__status='POSTED',
                            journal_entry__is_superseded=False,
                            partner_id__in=orphan_ids,
                        )
                    )
                    if opts['fiscal_year']:
                        orph = orph.filter(journal_entry__fiscal_year_id=opts['fiscal_year'])
                    orph_by_acc = orph.values(
                        'account_id', 'account__code', 'account__name',
                    ).annotate(d=Sum('debit'), c=Sum('credit'), n=Count('id'))
                    for r in orph_by_acc:
                        net = (r['d'] or Decimal('0.00')) - (r['c'] or Decimal('0.00'))
                        total_orphan += r['n']
                        org_dirty = True
                        self.stdout.write(
                            f"  [{scope}] {r['account__code']} {r['account__name']} "
                            f"ORPHAN-PARTNER: {r['n']} line(s), net {net}"
                        )

                if not pless_by_acc.exists() and not (orphan_ids and orph_by_acc.exists()):
                    self.stdout.write(f"  [{scope}] clean ✓")

            if org_dirty:
                dirty_orgs += 1

            if opts['migrate'] and org_dirty:
                self._repair(org, opts, scopes, control_ids)

        self.stdout.write("\n── Summary ──")
        self.stdout.write(f"  dirty orgs:               {dirty_orgs}")
        self.stdout.write(f"  partnerless lines:        {total_partnerless}")
        self.stdout.write(f"  orphan-partner lines:     {total_orphan}")
        if dirty_orgs and not opts['migrate']:
            self.stdout.write(self.style.WARNING(
                "\nRun with --migrate --from-account <code> --partner-id <id> "
                "--partner-type <type> [--line-ids a,b,c] --audit-reason '...' "
                "to repair."
            ))

    # ── Helpers ─────────────────────────────────────────────
    def _orphan_partner_ids(self, org, control_ids):
        from apps.finance.models import JournalEntryLine
        from erp.connector_registry import connector
        Contact = connector.require('crm.contacts.get_model', org_id=org.id)
        if Contact is None:
            return set()

        referenced = set(
            JournalEntryLine.objects
            .filter(
                organization=org,
                account_id__in=control_ids,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                partner_id__isnull=False,
            )
            .values_list('partner_id', flat=True)
            .distinct()
        )
        existing = set(
            Contact.objects.filter(organization=org, id__in=referenced)
            .values_list('id', flat=True)
        )
        return referenced - existing

    def _ensure_unidentified_contact(self, org, partner_type):
        """Get-or-create the dedicated "Unidentified (Legacy Cleanup)"
        Contact for a given partner_type. Keeps legacy ungrouped lines
        in their own clearly-labelled sub-ledger bucket rather than
        polluting a real customer/supplier.

        Idempotent: look up by name; create only if missing.
        """
        from erp.connector_registry import connector
        Contact = connector.require('crm.contacts.get_model', org_id=org.id)
        if Contact is None:
            raise RuntimeError("CRM Contact model not available via connector")

        label = f"Unidentified {partner_type.title()} (Legacy Cleanup)"
        contact, created = Contact.objects.get_or_create(
            organization=org,
            name=label,
            defaults={
                'type': partner_type,
                'company_name': label,
                # Keep this contact clearly flagged — it's a bookkeeping
                # construct, not a real counterparty. Minimal fields.
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(
                f"  ✓ Created dedicated contact: {label} (id={contact.id})"
            ))
        return contact.id

    def _repair(self, org, opts, scopes, control_ids):
        from apps.finance.models import ChartOfAccount, JournalEntryLine
        from apps.finance.services.ledger_core import LedgerCoreMixin

        from_code = opts['from_account']
        partner_type = opts['partner_type']
        reason = opts.get('audit_reason') or '(no reason provided)'

        # Resolve partner_id — if --use-unidentified, get-or-create the
        # dedicated "Unidentified (Legacy Cleanup)" Contact and use its
        # id. Otherwise take the operator-supplied value as-is.
        if opts.get('use_unidentified'):
            partner_id = self._ensure_unidentified_contact(org, partner_type)
            self.stdout.write(self.style.WARNING(
                f"  Using dedicated 'Unidentified {partner_type.title()} "
                f"(Legacy Cleanup)' contact — id={partner_id}"
            ))
        else:
            partner_id = opts['partner_id']

        acc = ChartOfAccount.objects.filter(
            organization=org, code=from_code, is_control_account=True,
        ).first()
        if not acc:
            self.stdout.write(self.style.ERROR(
                f"  --from-account {from_code} not found or not a control account in this org"
            ))
            return
        if acc.children.filter(is_active=True).exists():
            self.stdout.write(self.style.ERROR(
                f"  {from_code} has active children — post to a leaf child, not a header. "
                f"(Archived/inactive children don't count.)"
            ))
            return

        # Optional line-ID scoping — preserves segmentation when ops has
        # already determined which lines belong to this specific partner.
        line_ids_filter = None
        if opts.get('line_ids'):
            try:
                line_ids_filter = [
                    int(x.strip()) for x in opts['line_ids'].split(',') if x.strip()
                ]
            except ValueError:
                raise CommandError("--line-ids must be a comma-separated list of integers")

        for scope in scopes:
            qs = JournalEntryLine.objects.filter(
                organization=org, account=acc,
                journal_entry__scope=scope,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                contact__isnull=True, partner_id__isnull=True,
            )
            if line_ids_filter:
                qs = qs.filter(id__in=line_ids_filter)

            agg = qs.aggregate(d=Sum('debit'), c=Sum('credit'), n=Count('id'))
            n = agg['n'] or 0
            d = agg['d'] or Decimal('0.00')
            c = agg['c'] or Decimal('0.00')
            net = d - c
            if n == 0:
                self.stdout.write(f"  [{scope}] no partnerless lines to repair")
                continue

            # Pattern: reverse the partnerless net on this account (no
            # partner), then re-post the same net WITH the partner link.
            # A single ADJUSTMENT JE carries both lines so the net impact
            # on the control account's *balance* is zero — only the
            # partner attribution changes.
            if net > Decimal('0.00'):
                lines = [
                    {'account_id': acc.id, 'debit': Decimal('0'), 'credit': net,
                     'description': f"Reattribute {from_code} partnerless net (reverse DR)"},
                    {'account_id': acc.id, 'debit': net, 'credit': Decimal('0'),
                     'description': f"Reattribute {from_code} partnerless net → partner {partner_id}",
                     'contact_id': partner_id, 'partner_type': partner_type,
                     'partner_id': partner_id},
                ]
            elif net < Decimal('0.00'):
                amt = -net
                lines = [
                    {'account_id': acc.id, 'debit': amt, 'credit': Decimal('0'),
                     'description': f"Reattribute {from_code} partnerless net (reverse CR)"},
                    {'account_id': acc.id, 'debit': Decimal('0'), 'credit': amt,
                     'description': f"Reattribute {from_code} partnerless net → partner {partner_id}",
                     'contact_id': partner_id, 'partner_type': partner_type,
                     'partner_id': partner_id},
                ]
            else:
                self.stdout.write(f"  [{scope}] partnerless lines net to zero — skipping")
                continue

            segment_flag = ' [scope-wide collapse]' if not line_ids_filter else ''
            description = (
                f"Sub-ledger reattribution: {from_code} partnerless → "
                f"partner#{partner_id} ({partner_type}, {scope}){segment_flag} "
                f"— reason: {reason}"
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
                source_id=acc.id,
                internal_bypass=True,
            )
            self.stdout.write(self.style.SUCCESS(
                f"  [{scope}] reattributed {n} line(s) totaling net {net} "
                f"to partner#{partner_id} via JE {je.reference} ({je.id})"
            ))
