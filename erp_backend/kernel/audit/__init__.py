"""
Audit Engine — 4-layer audit logging.

Import guide:
    from kernel.audit import audit_log, AuditableModel
    from kernel.audit.models import AuditLog, AuditTrail  # if model access needed
"""

# NOTE: AuditLog/AuditTrail are concrete models — NOT imported here.
# Import from kernel.audit.models directly to avoid AppRegistryNotReady.

from .audit_logger import audit_log, get_audit_context, set_audit_context  # noqa: F401
from .middleware import AuditMiddleware  # noqa: F401
from .mixins import AuditableModel  # noqa: F401

__all__ = [
    'audit_log',
    'get_audit_context',
    'set_audit_context',
    'AuditMiddleware',
    'AuditableModel',
]
