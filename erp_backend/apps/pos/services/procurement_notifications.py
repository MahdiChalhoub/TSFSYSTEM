"""
Procurement Request — task creation + multi-channel notification fan-out.

All side effects defensive: failures here MUST NOT roll back the originating
ProcurementRequest mutation. Every helper logs warnings and swallows errors.

Tasks land in `workspace.Task` (the live task system at /workspace/tasks/) so
assignees see them in the existing dashboard. Notifications flow through
`erp.notification_service.NotificationService` so user-level channel preferences
(IN_APP / EMAIL / SMS / PUSH) apply.
"""
import logging
from django.db import transaction
from django.db.models import Q

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Templates
# ─────────────────────────────────────────────────────────────────────────────
_PROCUREMENT_TEMPLATES = [
    {
        'code': 'procurement_request_created',
        'name': 'Procurement Request Created',
        'subject': 'New {request_type} request: {product_name}',
        'body': 'A new {request_type} request was created.\n\nProduct: {product_name} ({product_sku})\nQuantity: {quantity}\nPriority: {priority}\nRequested by: {requested_by}\nReason: {reason}\n\nReview at /inventory/requests',
    },
    {
        'code': 'procurement_request_bumped',
        'name': 'Procurement Request Bumped',
        'subject': 'Reminder: {product_name} priority {prev_priority} -> {new_priority}',
        'body': 'A procurement request was bumped.\n\nProduct: {product_name}\nQuantity: {quantity}\nPriority: {prev_priority} -> {new_priority}\nBumped by: {actor}\n\nReview at /inventory/requests',
    },
    {
        'code': 'procurement_request_approved',
        'name': 'Procurement Request Approved',
        'subject': 'Approved: {request_type} for {product_name}',
        'body': 'The procurement request was approved.\n\nProduct: {product_name} ({product_sku})\nQuantity: {quantity}\nApproved by: {actor}\n\nTrack at /inventory/requests',
    },
    {
        'code': 'procurement_request_rejected',
        'name': 'Procurement Request Rejected',
        'subject': 'Rejected: {request_type} for {product_name}',
        'body': 'The procurement request was rejected.\n\nProduct: {product_name} ({product_sku})\nQuantity: {quantity}\nRejected by: {actor}\nReason: {reason}\n\nOpen /inventory/requests to discuss.',
    },
    {
        'code': 'procurement_request_converted',
        'name': 'Procurement Request Converted to PO',
        'subject': 'Converted: {product_name} -> PO #{po_id}',
        'body': 'The procurement request was converted to a draft Purchase Order.\n\nProduct: {product_name}\nQuantity: {quantity}\nPO: #{po_id}\nConverted by: {actor}\n\nOpen /purchases/purchase-orders/{po_id} to edit and send.',
    },
]

_TEMPLATES_SEEDED = False


def _ensure_templates_seeded():
    """Lazy idempotent seed for procurement notification templates.
    Runs once per process; safe across restarts via update_or_create."""
    global _TEMPLATES_SEEDED
    if _TEMPLATES_SEEDED:
        return
    try:
        with transaction.atomic():
            from erp.notification_models import NotificationTemplate
            for t in _PROCUREMENT_TEMPLATES:
                for channel in ('IN_APP', 'EMAIL'):
                    NotificationTemplate.objects.update_or_create(
                        code=t['code'], channel=channel, language='en',
                        defaults={
                            'name': t['name'],
                            'subject_template': t['subject'],
                            'body_template': t['body'],
                            'is_active': True,
                        },
                    )
            _TEMPLATES_SEEDED = True
    except Exception as e:
        logger.warning(f"Could not seed procurement notification templates: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Audience
# ─────────────────────────────────────────────────────────────────────────────
def _priority_to_workspace(priority: str) -> str:
    """Map ProcurementRequest priority (LOW/NORMAL/HIGH/URGENT) to
    workspace.Task priority (LOW/MEDIUM/HIGH/URGENT)."""
    return {'LOW': 'LOW', 'NORMAL': 'MEDIUM', 'HIGH': 'HIGH', 'URGENT': 'URGENT'}.get(priority, 'MEDIUM')


def get_assignees(organization):
    """Find users who should review procurement requests for this org.
    Heuristic: superusers + users whose role name matches admin/manager/owner/procurement.
    Active accounts only. Falls back to any superuser in the org."""
    from erp.models import User as UserModel
    qs = UserModel.objects.filter(organization=organization, is_active=True)
    matched = qs.filter(
        Q(is_superuser=True) |
        Q(role__name__iregex=r'(admin|manager|owner|procurement|purchasing|buyer)')
    ).distinct()
    if matched.exists():
        return list(matched)
    fallback = qs.filter(is_superuser=True)
    return list(fallback) if fallback.exists() else []


def get_procurement_role(organization=None):
    """Return the first role whose name looks like procurement/purchasing/buyer.
    Roles are global (not per-org), so the optional organization arg is ignored
    today but kept for future tenant-scoped roles."""
    try:
        from erp.models import Role
    except ImportError:
        return None
    return Role.objects.filter(name__iregex=r'(procurement|purchasing|buyer)').first()


# ─────────────────────────────────────────────────────────────────────────────
# Task creation (workspace.Task — surfaces in /workspace/tasks/)
# ─────────────────────────────────────────────────────────────────────────────
def create_review_task(req, *, event='created'):
    """Create a workspace.Task asking someone to review/action a procurement request.
    Prefers role-based assignment when a procurement-shaped role exists in the org;
    otherwise assigns the first matching admin user. Non-fatal."""
    from erp.connector_registry import connector
    org = req.organization
    WorkspaceTask = connector.require('workspace.tasks.get_model', org_id=org.id)
    if WorkspaceTask is None:
        logger.warning("workspace.Task not available — skipping task creation")
        return None

    procurement_role = get_procurement_role(org)
    assignees = get_assignees(org)
    primary_user = assignees[0] if assignees else None

    title = f"Review {req.get_request_type_display().lower()}: {req.product.name} x {req.quantity}"
    parts = [
        f"Type: {req.get_request_type_display()}",
        f"Priority: {req.get_priority_display()}",
        f"Quantity: {req.quantity}",
        f"Requested by: {req.requested_by.username if req.requested_by else 'system'}",
    ]
    if req.reason:
        parts.append(f"Reason: {req.reason}")
    if req.supplier_id:
        parts.append(f"Supplier: {getattr(req.supplier, 'name', '?')}")
    parts.append("")
    parts.append("Open /inventory/requests to action.")

    try:
        with transaction.atomic():
            return WorkspaceTask.objects.create(
                organization=org,
                title=title,
                description='\n'.join(parts),
                status='PENDING',
                priority=_priority_to_workspace(req.priority),
                source='SYSTEM',
                assigned_by=req.requested_by,
                assigned_to=primary_user if not procurement_role else None,
                assigned_to_group=procurement_role,
                related_object_type='ProcurementRequest',
                related_object_id=req.id,
                related_object_label=f"{req.get_request_type_display()} #{req.id} — {req.product.name}",
            )
    except Exception as e:
        logger.warning(f"Failed to create workspace task for request {req.id}: {e}")
        return None


def update_review_task(req, *, event: str, actor=None, note: str = None):
    """Reflect a procurement-request lifecycle event onto its workspace.Task.
    The task is matched by (related_object_type, related_object_id).

    Event mapping:
      - 'bumped'    → push priority up; append reminder comment
      - 'approved'  → mark IN_PROGRESS (work to do: execute / convert)
      - 'rejected'  → mark CANCELLED  (no further action expected)
      - 'cancelled' → mark CANCELLED
      - 'converted' → mark COMPLETED  (request fulfilled into a PO)

    Non-fatal: any failure is logged and swallowed.
    """
    from erp.connector_registry import connector
    WorkspaceTask = connector.require('workspace.tasks.get_model', org_id=req.organization_id)
    if WorkspaceTask is None:
        return None

    try:
      with transaction.atomic():
        task = WorkspaceTask.objects.filter(
            organization=req.organization,
            related_object_type='ProcurementRequest',
            related_object_id=req.id,
        ).order_by('-id').first()
        if task is None:
            # Auto-heal: if the create-time task is missing, make one now so the
            # event still surfaces on the board.
            task = create_review_task(req, event=event)
            if task is None:
                return None

        update_fields = []
        if event == 'bumped':
            new_pri = _priority_to_workspace(req.priority)
            if task.priority != new_pri:
                task.priority = new_pri
                update_fields.append('priority')
        elif event == 'approved':
            if task.status not in ('IN_PROGRESS', 'COMPLETED', 'CANCELLED'):
                task.status = 'IN_PROGRESS'
                update_fields.append('status')
        elif event in ('rejected', 'cancelled'):
            if task.status not in ('COMPLETED', 'CANCELLED'):
                task.status = 'CANCELLED'
                update_fields.append('status')
        elif event == 'converted':
            if task.status != 'COMPLETED':
                task.status = 'COMPLETED'
                update_fields.append('status')

        if update_fields:
            task.save(update_fields=update_fields + ['updated_at'])

        # Drop a comment so the audit trail is visible on the task.
        if note:
            try:
                TaskComment = connector.require(
                    'workspace.task_comment.get_model', org_id=req.organization_id
                )
                if TaskComment is not None:
                    TaskComment.objects.create(
                        organization=req.organization,
                        task=task,
                        author=actor,
                        content=note,
                    )
            except Exception as e:
                logger.debug(f"TaskComment write failed for task {task.id}: {e}")

        return task
    except Exception as e:
        logger.warning(f"update_review_task({event}) failed for request {req.id}: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Notification fan-out
# ─────────────────────────────────────────────────────────────────────────────
def _build_template_vars(req, **extra):
    """Variables used by template `{placeholder}` substitution."""
    return {
        'request_type': req.get_request_type_display(),
        'product_name': req.product.name,
        'product_sku': req.product.sku or '-',
        'quantity': str(req.quantity),
        'priority': req.get_priority_display(),
        'requested_by': req.requested_by.username if req.requested_by else 'system',
        'reason': req.reason or '-',
        **extra,
    }


def _send_to_user(user, *, template_code, link, variables, fallback_title, fallback_message, fallback_type):
    """Try NotificationService.send (template-driven, multi-channel); on any failure
    fall back to a direct in-app Notification row so the message still reaches the user.
    Returns True if delivered through any path.

    Each backend call is wrapped in a savepoint — a missing notification table
    or other DB error must not poison the caller's outer transaction.
    """
    try:
        with transaction.atomic():
            from erp.notification_service import NotificationService
            NotificationService.send(user=user, template_code=template_code,
                                      variables=variables, link=link)
        return True
    except Exception as e:
        logger.warning(f"NotificationService.send failed for {user}: {e}")
    # Fallback: direct in-app Notification
    try:
        with transaction.atomic():
            from erp.models import Notification
            Notification.objects.create(
                user=user, title=fallback_title, message=fallback_message,
                type=fallback_type, link=link,
            )
        return True
    except Exception as e:
        logger.warning(f"Direct Notification.create failed for {user}: {e}")
    return False


_KIND_CONFIG = {
    'created':   ('procurement_request_created',   'New {tl} request',                'WARNING_OR_INFO'),
    'bumped':    ('procurement_request_bumped',    'Reminder: {tl} request bumped',   'WARNING'),
    'approved':  ('procurement_request_approved',  '{Tl} request approved',           'SUCCESS'),
    'rejected':  ('procurement_request_rejected',  '{Tl} request rejected',           'ERROR'),
    'converted': ('procurement_request_converted', '{Tl} request converted',          'SUCCESS'),
}


def notify_assignees(req, *, kind: str, actor=None, prev_priority: str = None,
                     new_priority: str = None, reason: str = None, po_id=None,
                     also_requester: bool = False):
    """Fan-out for procurement lifecycle events. `kind` ∈ created|bumped|approved|rejected|converted.
    Notifies all assignees AND optionally the requester (when an action affects them).
    Uses NotificationService.send so user-level channel preferences apply."""
    _ensure_templates_seeded()

    type_label = req.get_request_type_display().lower()
    actor_name = (actor.username if actor
                  else (req.requested_by.username if req.requested_by else 'system'))
    variables = _build_template_vars(req, actor=actor_name,
                                      prev_priority=prev_priority or '',
                                      new_priority=new_priority or '',
                                      po_id=po_id or '')
    if reason:
        variables['reason'] = reason

    template_code, fb_title_tpl, fb_type_raw = _KIND_CONFIG.get(kind, _KIND_CONFIG['created'])
    if fb_type_raw == 'WARNING_OR_INFO':
        fb_type = 'WARNING' if req.priority in ('HIGH', 'URGENT') else 'INFO'
    else:
        fb_type = fb_type_raw

    fb_title = fb_title_tpl.format(tl=type_label, Tl=type_label.capitalize())
    if kind == 'bumped':
        fb_message = f"{req.product.name} — priority {prev_priority} -> {new_priority}"
    elif kind == 'converted':
        fb_message = f"{req.product.name} -> PO #{po_id}"
    else:
        fb_message = f"{req.product.name} x {req.quantity}"

    audience = list(get_assignees(req.organization))
    if also_requester and req.requested_by and req.requested_by not in audience:
        audience.append(req.requested_by)

    sent = 0
    for u in audience:
        if _send_to_user(u, template_code=template_code, link='/inventory/requests',
                         variables=variables, fallback_title=fb_title,
                         fallback_message=fb_message, fallback_type=fb_type):
            sent += 1
    return sent
