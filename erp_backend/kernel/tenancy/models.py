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
    Abstract base model for all organization-owned data.

    Usage:
        class Invoice(TenantOwnedModel):
            invoice_number = models.CharField(max_length=20)

    Auto-assigns current organization on save. Filters by organization on query.
    """

    organization = models.ForeignKey(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='%(app_label)s_%(class)s_v2_set',
        db_index=True,
        null=True,
        blank=True,
        db_column='tenant_id', # Database column remains tenant_id for consistency
    )

    @property
    def tenant(self):
        """Compatibility property for 'tenant' access."""
        return self.organization

    @tenant.setter
    def tenant(self, value):
        self.organization = value

    @property
    def tenant_id(self):
        """Compatibility property for 'tenant_id' access."""
        return self.organization_id

    @tenant_id.setter
    def tenant_id(self, value):
        self.organization_id = value

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True
        ordering = ['-id']

    def save(self, *args, **kwargs):
        if not self.organization_id:
            current_tenant = get_current_tenant()
            if current_tenant:
                self.organization = current_tenant
            else:
                raise ValidationError(
                    f"{self.__class__.__name__} requires an organization. "
                    "Either set organization explicitly or ensure request has organization context."
                )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        current_tenant = get_current_tenant()
        if current_tenant and self.organization_id != current_tenant.id:
            raise ValidationError(
                f"Cannot delete {self.__class__.__name__} from different organization. "
                f"Current organization: {current_tenant.id}, Object organization: {self.organization_id}"
            )
        super().delete(*args, **kwargs)


class TenantAwareModel(models.Model):
    """
    Alternative base model for models that need organization awareness
    but are not directly owned by a organization (e.g. SystemLog, GlobalSettings).
    """

    class Meta:
        abstract = True

    def get_tenant_context(self):
        return get_current_tenant()


# Lazy import alias for middleware compatibility
# The middleware imports 'Tenant' from this module, but the actual model is Organization in erp.models
def _get_tenant_model():
    """Lazy import to avoid circular dependency and AppRegistryNotReady"""
    from erp.models import Organization
    return Organization

# Create a module-level attribute that acts like a class
# This allows middleware to do: from .models import Tenant
class _TenantProxy:
    """Proxy object that forwards all attribute access to the Organization model"""
    def __getattr__(self, name):
        return getattr(_get_tenant_model(), name)

Tenant = _TenantProxy()
