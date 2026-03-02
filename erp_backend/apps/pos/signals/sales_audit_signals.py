"""
Sales Audit Signals — Gap 8
============================
Django post_save signals that automatically write SalesAuditLog entries
when order status fields change.

Approach: store the pre-save state using __init__ and compare in post_save.
This gives field-level diffs without requiring any extra DB reads.

Registers:
  - Order.post_save  → detect 4-axis status changes + key field changes
  - Order.pre_save   → capture before-state (via _audit_snapshot)
"""
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

# Fields we care about diff-tracking on Order
TRACKED_STATUS_FIELDS = [
    'order_status', 'delivery_status', 'payment_status', 'invoice_status',
]
TRACKED_EXTRA_FIELDS  = [
    'total_amount', 'payment_method', 'is_locked', 'is_verified',
    'invoice_number', 'scope',
]

# Map (field, new_value) → action_type
_STATUS_ACTION_MAP = {
    ('order_status',    'CONFIRMED'):    'ORDER_CONFIRMED',
    ('order_status',    'PROCESSING'):   'ORDER_PROCESSING',
    ('order_status',    'CLOSED'):       'ORDER_CLOSED',
    ('order_status',    'CANCELLED'):    'ORDER_CANCELLED',
    ('delivery_status', 'PARTIAL'):      'DELIVERY_PARTIAL',
    ('delivery_status', 'DELIVERED'):    'DELIVERY_DELIVERED',
    ('delivery_status', 'RETURNED'):     'DELIVERY_RETURNED',
    ('delivery_status', 'NA'):           'DELIVERY_NA',
    ('payment_status',  'PARTIAL'):      'PAYMENT_PARTIAL',
    ('payment_status',  'PAID'):         'PAYMENT_PAID',
    ('payment_status',  'WRITTEN_OFF'):  'PAYMENT_WRITTEN_OFF',
    ('payment_status',  'OVERPAID'):     'PAYMENT_OVERPAID',
    ('invoice_status',  'GENERATED'):    'INVOICE_GENERATED',
    ('invoice_status',  'SENT'):         'INVOICE_SENT',
    ('invoice_status',  'DISPUTED'):     'INVOICE_DISPUTED',
}


@receiver(pre_save, sender='pos.Order')
def _capture_order_snapshot(sender, instance, **kwargs):
    """
    Before saving: snapshot the current DB state onto the instance
    as a private attribute _audit_snapshot, so post_save can diff it.
    """
    if not instance.pk:
        instance._audit_snapshot = {}
        return
    try:
        db_state = sender.original_objects.filter(pk=instance.pk).values(
            *TRACKED_STATUS_FIELDS, *TRACKED_EXTRA_FIELDS
        ).first() or {}
        instance._audit_snapshot = db_state
    except Exception:
        instance._audit_snapshot = {}


@receiver(post_save, sender='pos.Order')
def _log_order_changes(sender, instance, created, **kwargs):
    """
    After saving: diff against the snapshot and write SalesAuditLog rows.
    One entry per status-axis change. Extra field changes share a FIELD_CHANGE row.
    """
    try:
        from apps.pos.models.audit_models import SalesAuditLog

        snapshot = getattr(instance, '_audit_snapshot', {})
        if not snapshot and not created:
            return  # nothing to diff

        diff       = {}
        action_type = 'FIELD_CHANGE'
        summary_parts = []

        for field in TRACKED_STATUS_FIELDS + TRACKED_EXTRA_FIELDS:
            old_val = snapshot.get(field)
            new_val = getattr(instance, field, None)
            if old_val != new_val:
                diff[field] = {'before': str(old_val) if old_val is not None else None,
                               'after':  str(new_val) if new_val is not None else None}

        # Determine a meaningful action_type from the most important status change
        for field in TRACKED_STATUS_FIELDS:
            if field in diff:
                new_val  = diff[field]['after']
                key      = (field, new_val)
                mapped   = _STATUS_ACTION_MAP.get(key)
                if mapped:
                    action_type = mapped
                    summary_parts.append(
                        f"{field.replace('_', ' ').title()}: "
                        f"{diff[field]['before']} → {diff[field]['after']}"
                    )
                    break  # use the first status-axis change as the primary action

        if not diff:
            if created:
                action_type = 'FIELD_CHANGE'
                summary_parts = ['Order created']
            else:
                return  # no real changes

        if not summary_parts:
            changed = ', '.join(diff.keys())
            summary_parts = [f'Fields changed: {changed}']

        SalesAuditLog.log(
            order=instance,
            action_type=action_type,
            summary=' | '.join(summary_parts),
            actor=None,         # signal fires system-level; actor set by workflow_service._log()
            diff=diff,
        )
    except Exception:
        import logging
        logging.getLogger(__name__).debug(
            '[SalesAuditSignal] Failed to log order %s change', instance.pk, exc_info=True
        )
