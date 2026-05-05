"""
Audit Logger

Core logging functions and context management.
"""

import threading
import logging
from typing import Optional, Dict, Any
from django.contrib.auth import get_user_model
from .models import AuditLog, AuditTrail
from kernel.tenancy.middleware import get_current_tenant

User = get_user_model()
logger = logging.getLogger('erp.audit')

# Thread-local storage for audit context
_thread_locals = threading.local()


def set_audit_context(
    user=None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    http_method: Optional[str] = None,
    request_path: Optional[str] = None
):
    """
    Set audit context for the current request.
    Called by AuditMiddleware automatically.

    Args:
        user: User instance
        ip_address: Client IP address
        user_agent: Browser user agent
        http_method: HTTP method (GET, POST, etc.)
        request_path: Request path
    """
    _thread_locals.audit_context = {
        'user': user,
        'ip_address': ip_address,
        'user_agent': user_agent,
        'http_method': http_method,
        'request_path': request_path,
    }


def get_audit_context() -> Dict[str, Any]:
    """Get current audit context from thread-local storage."""
    return getattr(_thread_locals, 'audit_context', {})


def clear_audit_context():
    """Clear audit context (called at end of request)."""
    if hasattr(_thread_locals, 'audit_context'):
        del _thread_locals.audit_context


def audit_log(
    action: str,
    user=None,
    resource_type: str = '',
    resource_id: Optional[int] = None,
    resource_repr: str = '',
    details: Optional[Dict[str, Any]] = None,
    success: bool = True,
    error_message: str = '',
    severity: str = 'INFO',
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    http_method: Optional[str] = None,
    request_path: Optional[str] = None
) -> AuditLog:
    """
    Create an audit log entry.

    Args:
        action: Action performed (e.g., 'invoice.create', 'payment.void')
        user: User who performed action (defaults to current audit context)
        resource_type: Type of resource affected (e.g., 'invoice', 'payment')
        resource_id: ID of affected resource
        resource_repr: String representation of resource
        details: Additional context data
        success: Whether action succeeded
        error_message: Error message if failed
        severity: INFO, WARNING, ERROR, CRITICAL
        ip_address: Override IP from context
        user_agent: Override user agent from context
        http_method: Override HTTP method from context
        request_path: Override request path from context

    Returns:
        AuditLog instance

    Example:
        audit_log(
            action='invoice.void',
            resource_type='invoice',
            resource_id=invoice.id,
            resource_repr=f'Invoice {invoice.invoice_number}',
            details={'reason': 'Duplicate invoice', 'voided_by': 'manager'},
            severity='WARNING'
        )
    """
    import sys
    print(f"[AUDIT-DEBUG] audit_log called: action={action} resource_type={resource_type} resource_id={resource_id}", file=sys.stderr, flush=True)
    organization = get_current_tenant()
    print(f"[AUDIT-DEBUG] kernel get_current_tenant() = {organization}", file=sys.stderr, flush=True)
    if not organization:
        # Fallback: The active TenantMiddleware (erp.middleware) uses a ContextVar
        # that stores the tenant_id as a string, while kernel.tenancy stores an
        # Organization object in thread-locals.  Bridge the gap here.
        try:
            from erp.middleware import get_current_tenant_id
            from erp.models import Organization
            tid = get_current_tenant_id()
            print(f"[AUDIT-DEBUG] erp get_current_tenant_id() = {tid}", file=sys.stderr, flush=True)
            if tid:
                organization = Organization.objects.filter(id=tid).first()
                print(f"[AUDIT-DEBUG] Organization resolved from ERP context: {organization}", file=sys.stderr, flush=True)
        except Exception as bridge_err:
            print(f"[AUDIT-DEBUG] Bridge failed: {bridge_err}", file=sys.stderr, flush=True)
    if not organization:
        print("[AUDIT-DEBUG] SKIPPED — no organization context", file=sys.stderr, flush=True)
        logger.warning("audit_log skipped — no organization context (table may not exist yet)")
        return None

    # Get context from thread-local if not provided
    context = get_audit_context()
    if user is None:
        user = context.get('user')
    if ip_address is None:
        ip_address = context.get('ip_address')
    if user_agent is None:
        user_agent = context.get('user_agent', '')
    if http_method is None:
        http_method = context.get('http_method', '')
    if request_path is None:
        request_path = context.get('request_path', '')

    # Create audit log
    try:
        print(f"[AUDIT-DEBUG] Creating AuditLog: org={organization.id} action={action}", file=sys.stderr, flush=True)
        log = AuditLog.all_objects.create(
            organization=organization,
            user=user,
            username=user.username if user else '',
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else '',
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_repr=resource_repr[:255] if resource_repr else '',
            http_method=http_method,
            request_path=request_path[:500] if request_path else '',
            details=details or {},
            success=success,
            error_message=error_message,
            severity=severity
        )
        print(f"[AUDIT-DEBUG] SUCCESS — AuditLog.id={log.id}", file=sys.stderr, flush=True)
        return log
    except Exception as e:
        print(f"[AUDIT-DEBUG] FAILED — {e}", file=sys.stderr, flush=True)
        logger.warning(f"Audit tracking failed (likely missing table): {e}")
        return None


def audit_field_change(
    audit_log: AuditLog,
    model_name: str,
    object_id: int,
    field_name: str,
    old_value: Any,
    new_value: Any,
    field_type: str = ''
):
    """
    Record a field-level change.

    Args:
        audit_log: Parent AuditLog entry
        model_name: Model name (e.g., 'Invoice')
        object_id: Object ID
        field_name: Field that changed
        old_value: Previous value
        new_value: New value
        field_type: Field type (CharField, DecimalField, etc.)

    Returns:
        AuditTrail instance
    """
    organization = get_current_tenant()
    if not organization:
        try:
            from erp.middleware import get_current_tenant_id
            from erp.models import Organization
            tid = get_current_tenant_id()
            if tid:
                organization = Organization.objects.filter(id=tid).first()
        except Exception:
            pass
    if not organization:
        logger.warning("audit_field_change skipped — no organization context")
        return None

    # Convert values to strings for storage
    old_str = str(old_value) if old_value is not None else None
    new_str = str(new_value) if new_value is not None else None

    try:
        trail = AuditTrail.all_objects.create(
            organization=organization,
            audit_log=audit_log,
            model_name=model_name,
            object_id=object_id,
            field_name=field_name,
            old_value=old_str,
            new_value=new_str,
            field_type=field_type
        )
        return trail
    except Exception as e:
        logger.warning(f"Audit field tracking failed: {e}")
        return None


def audit_model_change(
    action: str,
    instance,
    changed_fields: Optional[Dict[str, tuple]] = None,
    details: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """
    Audit a model change with field-level tracking.

    Args:
        action: Action performed (e.g., 'invoice.update')
        instance: Model instance
        changed_fields: Dict of {field_name: (old_value, new_value)}
        details: Additional context

    Returns:
        AuditLog instance

    Example:
        audit_model_change(
            action='invoice.update',
            instance=invoice,
            changed_fields={
                'status': ('draft', 'sent'),
                'total': (Decimal('100.00'), Decimal('150.00'))
            }
        )
    """
    # Create main audit log
    log = audit_log(
        action=action,
        resource_type=instance.__class__.__name__.lower(),
        resource_id=instance.pk,
        resource_repr=str(instance),
        details=details
    )

    # Record field changes
    if changed_fields and log:
        for field_name, (old_value, new_value) in changed_fields.items():
            # Get field type
            field = instance._meta.get_field(field_name)
            field_type = field.__class__.__name__

            audit_field_change(
                audit_log=log,
                model_name=instance.__class__.__name__,
                object_id=instance.pk,
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
                field_type=field_type
            )

    return log


def get_resource_audit_history(organization, resource_type: str, resource_id, limit: int = 50):
    """
    Return the last `limit` audit entries for a single resource, in the
    shape the side-panel AuditTab components consume:

        [{ id, timestamp, action, actor, old_value, new_value, description }, …]

    `action` is normalized to one of `CREATE` / `UPDATE` / `DELETE` so
    the existing icon + tint logic in AuditTab.tsx keeps working — the
    underlying AuditLog action is `<resource>.<verb>` (e.g. `'brand.update'`).

    `old_value` / `new_value` are reconstructed from the linked AuditTrail
    rows (one per changed field) so the diff renderer in the tab still has
    field-level data to compare. CREATE/DELETE entries get an empty new/old
    pair which the renderer handles with no special-casing.

    Single source of truth for both BrandViewSet.audit and
    CategoryViewSet.audit (and future viewsets that want a side-panel
    audit tab on a TenantOwnedModel that uses AuditLogMixin).
    """
    if not organization or resource_id is None:
        return []
    try:
        rid_int = int(resource_id)
    except (TypeError, ValueError):
        return []

    # Fetch the request-level audit rows. `resource_type` from
    # AuditLogMixin is `instance.__class__.__name__.lower()` — match
    # case-insensitively so callers can pass either 'brand' or 'Brand'.
    logs = (
        AuditLog.all_objects
        .filter(
            organization=organization,
            resource_type__iexact=resource_type,
            resource_id=rid_int,
        )
        .select_related('user')
        .prefetch_related('field_changes')
        .order_by('-timestamp')[:limit]
    )

    out = []
    for log in logs:
        # Normalize 'brand.update' → 'UPDATE'. Defensive split: some
        # callers (raw audit_log()) write fully-custom actions like
        # 'login.success' that don't map cleanly to CREATE/UPDATE/DELETE
        # — those get returned as-is so the tab can still show them.
        verb = log.action.rsplit('.', 1)[-1].upper() if '.' in log.action else log.action.upper()

        # Reconstruct old/new dicts from per-field AuditTrail rows.
        old_value: Dict[str, Any] = {}
        new_value: Dict[str, Any] = {}
        for trail in log.field_changes.all():
            old_value[trail.field_name] = trail.old_value
            new_value[trail.field_name] = trail.new_value

        # Actor display: prefer full name → email → username.
        actor = None
        if log.user_id and log.user:
            actor = log.user.get_full_name() or log.user.email or log.user.username
        elif log.username:
            actor = log.username

        # Description: details dict has a fields_changed list for UPDATE,
        # otherwise fall back to resource_repr or empty.
        details = log.details or {}
        if verb == 'UPDATE' and details.get('fields_changed'):
            description = f"Updated: {', '.join(details['fields_changed'])}"
        elif verb == 'CREATE':
            description = f"Created {log.resource_repr or resource_type}"
        elif verb == 'DELETE':
            description = f"Deleted {log.resource_repr or resource_type}"
        else:
            description = log.resource_repr or ''

        out.append({
            'id': str(log.id),
            'timestamp': log.timestamp,
            'action': verb,
            'actor': actor,
            'old_value': old_value or None,
            'new_value': new_value or None,
            'description': description,
        })
    return out
