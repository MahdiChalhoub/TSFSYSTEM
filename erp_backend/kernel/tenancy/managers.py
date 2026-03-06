"""
Tenancy Managers

Custom QuerySet and Manager that automatically scope queries by tenant.
"""

from django.db import models
from django.db.models import QuerySet
from .context import get_current_tenant


class TenantQuerySet(QuerySet):
    """
    QuerySet that automatically filters by current tenant.

    This is the magic that prevents cross-tenant data leaks.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._tenant_id = None

    def _clone(self):
        """Preserve tenant_id when cloning queryset."""
        clone = super()._clone()
        clone._tenant_id = self._tenant_id
        return clone

    def for_tenant(self, tenant):
        """
        Explicitly scope queryset to a specific tenant.

        Usage:
            Invoice.objects.for_tenant(tenant).all()
        """
        clone = self._clone()
        if tenant:
            clone._tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
        return clone

    def _fetch_all(self):
        """
        Override _fetch_all to inject tenant filter automatically.

        This is called before any query execution.
        """
        if self._result_cache is None:
            # Get current tenant if not explicitly set
            if self._tenant_id is None:
                current_tenant = get_current_tenant()
                if current_tenant:
                    self._tenant_id = current_tenant.id

            # Apply tenant filter if we have a tenant
            if self._tenant_id is not None:
                # Check if tenant filter already applied
                where_sql = str(self.query)
                if 'tenant_id' not in where_sql:
                    # Apply automatic tenant scoping
                    self.query.add_q(models.Q(tenant_id=self._tenant_id))

        super()._fetch_all()


class TenantManager(models.Manager):
    """
    Manager that uses TenantQuerySet.

    Provides additional utility methods for tenant-scoped queries.
    """

    def get_queryset(self):
        """Return TenantQuerySet instead of regular QuerySet."""
        return TenantQuerySet(self.model, using=self._db)

    def for_tenant(self, tenant):
        """
        Scope all queries to a specific tenant.

        Usage:
            Invoice.objects.for_tenant(tenant).filter(status='paid')
        """
        return self.get_queryset().for_tenant(tenant)

    def current_tenant(self):
        """
        Get queryset for current tenant from request context.

        Usage:
            Invoice.objects.current_tenant().all()
        """
        current_tenant = get_current_tenant()
        if not current_tenant:
            raise ValueError(
                "No current tenant in context. "
                "Ensure TenantMiddleware is installed or use for_tenant()."
            )
        return self.for_tenant(current_tenant)

    def create(self, **kwargs):
        """
        Override create to automatically set tenant.

        If tenant is not provided, uses current tenant from context.
        """
        if 'tenant' not in kwargs and 'tenant_id' not in kwargs:
            current_tenant = get_current_tenant()
            if current_tenant:
                kwargs['tenant'] = current_tenant

        return super().create(**kwargs)

    def bulk_create(self, objs, **kwargs):
        """
        Override bulk_create to automatically set tenant on all objects.
        """
        current_tenant = get_current_tenant()

        if current_tenant:
            for obj in objs:
                if not obj.tenant_id:
                    obj.tenant = current_tenant

        return super().bulk_create(objs, **kwargs)
