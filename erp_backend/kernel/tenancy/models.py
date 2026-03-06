"""
Tenancy Base Models (abstract only — safe to import at module level)

These abstract base classes do NOT register with Django's app registry,
so they can be imported at any time without AppRegistryNotReady errors.
"""

from django.db import models
from django.core.exceptions import ValidationError
from .managers import TenantManager
from .context import get_current_tenant


class TenantOwnedModel(models.Model):
    """
    Abstract base model for all tenant-owned data.

    Usage:
        class Invoice(TenantOwnedModel):
            invoice_number = models.CharField(max_length=20)

    Auto-assigns current tenant on save. Filters by tenant on query.
    """

    tenant = models.ForeignKey(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='%(app_label)s_%(class)s_set',
        db_index=True,
        null=True,
        blank=True,
    )

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True
        ordering = ['-id']

    def save(self, *args, **kwargs):
        if not self.tenant_id:
            current_tenant = get_current_tenant()
            if current_tenant:
                self.tenant = current_tenant
            else:
                raise ValidationError(
                    f"{self.__class__.__name__} requires a tenant. "
                    "Either set tenant explicitly or ensure request has tenant context."
                )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        current_tenant = get_current_tenant()
        if current_tenant and self.tenant_id != current_tenant.id:
            raise ValidationError(
                f"Cannot delete {self.__class__.__name__} from different tenant. "
                f"Current tenant: {current_tenant.id}, Object tenant: {self.tenant_id}"
            )
        super().delete(*args, **kwargs)


class TenantAwareModel(models.Model):
    """
    Alternative base model for models that need tenant awareness
    but are not directly owned by a tenant (e.g. SystemLog, GlobalSettings).
    """

    class Meta:
        abstract = True

    def get_tenant_context(self):
        return get_current_tenant()
