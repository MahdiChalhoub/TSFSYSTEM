"""
IAM Services — Audit Events

First-class audit logging for all IAM state changes.
Every identity and access change must be traceable.
"""
import logging

logger = logging.getLogger('apps.iam')


def emit(event_type, *, user=None, organization=None, actor=None, detail=None, **extra):
    """
    Emit an IAM audit event.

    All events are logged structurally. In future, these can be
    routed to AuditLog model, webhook, or event bus.

    Args:
        event_type: Dot-notation event name (e.g. 'iam.user_registered')
        user: Target user of the event
        organization: Organization context
        actor: Who performed the action (admin, system, self)
        detail: Human-readable description
        **extra: Additional structured data
    """
    data = {
        'event': event_type,
        'user_id': user.id if user else None,
        'user_email': user.email if user else None,
        'org_id': organization.id if organization else (user.organization_id if user else None),
        'actor_id': actor.id if actor else None,
        'actor_email': actor.email if actor else None,
        'detail': detail or '',
    }
    data.update(extra)
    logger.info(f"[IAM_AUDIT] {event_type}", extra=data)

    # Future: persist to AuditLog model
    # from kernel.audit.models import AuditLog
    # AuditLog.objects.create(category='IAM', event_type=event_type, data=data)


# ── Event Constants ──────────────────────────────────────────────────
# Identity lifecycle
USER_REGISTERED = 'iam.user_registered'
USER_ACTIVATED = 'iam.user_activated'
USER_BLOCKED = 'iam.user_blocked'
USER_SUSPENDED = 'iam.user_suspended'
USER_REJECTED = 'iam.user_rejected'

# Portal access lifecycle
CLIENT_ACCESS_CREATED = 'iam.client_access_created'
SUPPLIER_ACCESS_CREATED = 'iam.supplier_access_created'
ACCESS_REVOKED = 'iam.access_revoked'
ACCESS_BLOCKED = 'iam.access_blocked'
ACCESS_REACTIVATED = 'iam.access_reactivated'

# Auto-linking
CONTACT_AUTO_LINKED = 'iam.contact_auto_linked'
CONTACT_AUTO_CREATED = 'iam.contact_auto_created'

# Approvals
APPROVAL_SUBMITTED = 'iam.approval_submitted'
APPROVAL_APPROVED = 'iam.approval_approved'
APPROVAL_REJECTED = 'iam.approval_rejected'
APPROVAL_CORRECTION = 'iam.approval_correction_requested'
APPROVAL_RESUBMITTED = 'iam.approval_resubmitted'

# Transfers
CONTACT_PROMOTED_TO_EMPLOYEE = 'iam.contact_promoted_to_employee'
EMPLOYEE_LINKED_TO_CONTACT = 'iam.employee_linked_to_contact'
USER_LINKED_TO_CONTACT = 'iam.user_linked_to_contact'
