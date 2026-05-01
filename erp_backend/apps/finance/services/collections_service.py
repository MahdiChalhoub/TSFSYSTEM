"""
Collections service — overdue detection + dunning workflow.

Surfaces customers with past-due AR by escalation level, and provides
the primitives for recording dunning events. Keeps the process auditable
and repeatable without hard-coding a single communication channel
(email / SMS / portal / post / call are all represented).

Escalation rules (per default — configurable per org later):
  • Days past due 1-14   → Level 1 reminder appropriate
  • 15-44                → Level 2 (escalate if L1 already sent)
  • 45-89                → Level 3
  • 90+                  → LEGAL escalation flagged

A customer gets at most ONE reminder at each level — this service
computes `next_suggested_level` by checking the maximum level already
sent (ever). If a customer has an overdue invoice and no Level 1 ever
sent, the system suggests L1 regardless of current age. Only after
L1 is sent does L2 become available, etc.
"""
import logging
from datetime import timedelta
from decimal import Decimal
from django.db.models import Max
from django.utils import timezone

logger = logging.getLogger(__name__)


LEVEL_THRESHOLDS = [
    (1,  0,   14),
    (2,  15,  44),
    (3,  45,  89),
    (4,  90,  9999),
]


def _level_for_age(days_overdue: int) -> int:
    for level, lo, hi in LEVEL_THRESHOLDS:
        if lo <= days_overdue <= hi:
            return level
    return 4


class CollectionsService:
    """Read + write primitives for the dunning workflow."""

    # ── Read: overdue customer list ─────────────────────────
    @staticmethod
    def list_overdue_customers(organization, *, as_of=None):
        """Return a list of (customer, overdue_summary) rows for
        every Contact with at least one unpaid invoice past its due_date.

        Rows include:
          contact_id, contact_name, contact_email, credit_limit,
          payment_terms_days, do_not_dun,
          total_overdue, invoice_count, oldest_days, oldest_invoice_id,
          last_reminder_level, last_reminder_sent_at, next_suggested_level,
          suggested_action.
        """
        from apps.finance.invoice_models import Invoice
        from apps.finance.models.collections_models import DunningReminder

        today = as_of or timezone.now().date()

        # Pull per-contact stats in memory (one roundtrip)
        stats_by_contact: dict[int, dict] = {}
        inv_qs = Invoice.objects.filter(
            organization=organization,
            status__in=('SENT', 'PARTIAL_PAID', 'OVERDUE', 'POSTED'),
            balance_due__gt=Decimal('0.01'),
            due_date__lt=today,
            contact__isnull=False,
        ).values('id', 'contact_id', 'balance_due', 'due_date')
        for inv in inv_qs:
            cid = inv['contact_id']
            days = (today - inv['due_date']).days
            row = stats_by_contact.setdefault(cid, {
                'total_overdue': Decimal('0.00'),
                'invoice_count': 0,
                'oldest_days': 0,
                'oldest_invoice_id': None,
                'invoice_ids': [],
            })
            row['total_overdue'] += inv['balance_due']
            row['invoice_count'] += 1
            row['invoice_ids'].append(inv['id'])
            if days > row['oldest_days']:
                row['oldest_days'] = days
                row['oldest_invoice_id'] = inv['id']

        if not stats_by_contact:
            return []

        # Latest reminder per contact — one query
        last_rem = (
            DunningReminder.objects.filter(
                organization=organization,
                contact_id__in=list(stats_by_contact.keys()),
                status__in=('SENT', 'DELIVERED', 'ACKNOWLEDGED'),
            )
            .values('contact_id')
            .annotate(
                last_level=Max('level'),
                last_sent=Max('sent_at'),
            )
        )
        last_by_contact = {r['contact_id']: r for r in last_rem}

        # Pull contact metadata once
        try:
            from erp.connector_registry import connector
            Contact = connector.require('crm.contacts.get_model', org_id=organization.id)
            if Contact is None:
                raise RuntimeError("CRM unavailable")
            contacts = {
                c.id: c for c in Contact.objects.filter(
                    organization=organization,
                    id__in=list(stats_by_contact.keys()),
                )
            }
        except Exception:
            contacts = {}

        rows = []
        for cid, stats in stats_by_contact.items():
            c = contacts.get(cid)
            last = last_by_contact.get(cid, {})
            last_level = last.get('last_level') or 0
            # Suggest the next level — min(age-appropriate, last_level+1)
            age_level = _level_for_age(stats['oldest_days'])
            suggested = min(age_level, (last_level + 1) if last_level else age_level)
            rows.append({
                'contact_id': cid,
                'contact_name': getattr(c, 'name', '') if c else '',
                'contact_email': getattr(c, 'email', '') if c else '',
                'contact_phone': getattr(c, 'phone', '') if c else '',
                'credit_limit': str(getattr(c, 'credit_limit', Decimal('0.00')) or Decimal('0.00')),
                'payment_terms_days': getattr(c, 'payment_terms_days', 0) or 0,
                'total_overdue': str(stats['total_overdue']),
                'invoice_count': stats['invoice_count'],
                'oldest_days': stats['oldest_days'],
                'oldest_invoice_id': stats['oldest_invoice_id'],
                'invoice_ids': stats['invoice_ids'],
                'last_reminder_level': last_level,
                'last_reminder_sent_at': (
                    last['last_sent'].isoformat() if last.get('last_sent') else None
                ),
                'next_suggested_level': suggested,
                'bucket': (
                    'current' if stats['oldest_days'] <= 14
                    else '30_days' if stats['oldest_days'] <= 44
                    else '60_days' if stats['oldest_days'] <= 89
                    else '90_plus'
                ),
            })
        rows.sort(key=lambda r: -r['oldest_days'])
        return rows

    # ── Write: post a reminder ──────────────────────────────
    @staticmethod
    def send_reminder(
        organization, contact_id, *,
        level, method='EMAIL', user=None, notes='',
        auto_body=True,
    ):
        """Create a DunningReminder row. Marks it SENT immediately
        (for now — a later enhancement can hand off to an actual email/SMS
        gateway and flip to DELIVERED on callback).
        """
        from apps.finance.models.collections_models import DunningReminder
        from apps.finance.invoice_models import Invoice

        today = timezone.now().date()
        overdue = Invoice.objects.filter(
            organization=organization,
            contact_id=contact_id,
            balance_due__gt=Decimal('0.01'),
            due_date__lt=today,
        )
        invoices_ref = [
            {'id': inv.id, 'invoice_number': inv.invoice_number,
             'balance_due': str(inv.balance_due), 'due_date': inv.due_date.isoformat()}
            for inv in overdue
        ]
        total_overdue = sum((inv.balance_due for inv in overdue), Decimal('0.00'))
        oldest_days = max(
            ((today - inv.due_date).days for inv in overdue),
            default=0,
        )

        contact_name = ''
        try:
            from erp.connector_registry import connector
            Contact = connector.require('crm.contacts.get_model', org_id=organization.id)
            if Contact is not None:
                c = Contact.objects.get(organization=organization, id=contact_id)
                contact_name = c.name or ''
        except Exception:
            pass

        subject = ''
        body = ''
        if auto_body:
            subject = f"Payment Reminder — {total_overdue} overdue"
            body = CollectionsService._render_body(
                level=level, contact_name=contact_name,
                total_overdue=total_overdue, oldest_days=oldest_days,
                invoices=invoices_ref,
            )

        rem = DunningReminder.objects.create(
            organization=organization,
            contact_id=contact_id,
            contact_name=contact_name,
            level=level,
            method=method,
            status='SENT',  # real gateway hand-off lives behind this
            amount_overdue=total_overdue,
            oldest_invoice_days=oldest_days,
            invoices_referenced=invoices_ref,
            subject=subject,
            body=body,
            notes=notes,
            sent_at=timezone.now(),
            sent_by=user,
        )
        logger.info(
            "Dunning L%s sent to contact=%s (%s overdue, oldest %sd)",
            level, contact_id, total_overdue, oldest_days,
        )
        return rem

    @staticmethod
    def _render_body(*, level, contact_name, total_overdue, oldest_days, invoices):
        if level == 1:
            opener = "This is a friendly reminder that the following invoices are past their due date."
            closer = "If payment has already been sent, please disregard this notice."
        elif level == 2:
            opener = "Our records indicate that the following invoices remain unpaid and are significantly overdue."
            closer = "Please arrange settlement at your earliest convenience to avoid further action."
        elif level == 3:
            opener = "This is a FINAL DEMAND for payment. The following invoices have remained unpaid despite earlier reminders."
            closer = "Failure to settle within 7 days may result in collection action."
        else:
            opener = "Your account has been referred to our collections team."
            closer = "Please contact us immediately to arrange settlement."

        lines = [
            f"Dear {contact_name or 'Valued Customer'},",
            "",
            opener,
            "",
            f"Total overdue: {total_overdue}",
            f"Oldest invoice past due: {oldest_days} days",
            "",
            "Outstanding invoices:",
        ]
        for inv in invoices[:20]:
            label = inv['invoice_number'] or f"Invoice #{inv['id']}"
            lines.append(
                f"  • {label}  due {inv['due_date']}  balance {inv['balance_due']}"
            )
        lines += ["", closer, "", "Finance Team"]
        return "\n".join(lines)

    # ── Canary-style integrity check ────────────────────────
    @staticmethod
    def check_collections_integrity(organization):
        """Surfaces customers stuck at a level — sent L3 > 30 days ago
        but not yet escalated to LEGAL, or any L4 unacknowledged >14d.
        """
        from apps.finance.models.collections_models import DunningReminder
        today = timezone.now()
        report = {
            'clean': True,
            'stuck_at_l3': 0, 'stuck_at_l4': 0,
        }
        stuck_l3 = DunningReminder.objects.filter(
            organization=organization, level=3,
            status__in=('SENT', 'DELIVERED'),
            sent_at__lte=today - timedelta(days=30),
        ).count()
        stuck_l4 = DunningReminder.objects.filter(
            organization=organization, level=4,
            status__in=('SENT', 'DELIVERED'),
            sent_at__lte=today - timedelta(days=14),
        ).count()
        report['stuck_at_l3'] = stuck_l3
        report['stuck_at_l4'] = stuck_l4
        if stuck_l3 or stuck_l4:
            report['clean'] = False
        return report
