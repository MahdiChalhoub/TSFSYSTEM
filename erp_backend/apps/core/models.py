from django.db import models
from django.conf import settings
from django.utils import timezone
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.config import get_config
from kernel.lifecycle.constants import LifecycleStatus, LifecycleAction

# Core platform settings or global entities can go here.
# For now, most core logic is in the 'erp' app (Organization, User, etc.)
# As we modularize, we might move them here.

class SystemSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField()
    description = models.TextField(null=True, blank=True)
    
    class Meta:
        db_table = 'system_settings'

    def __str__(self):
        return self.key
