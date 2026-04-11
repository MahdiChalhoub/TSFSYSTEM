"""
Tenancy Managers

Custom QuerySet and Manager that automatically scope queries by organization.
"""

from django.db import models
from django.db.models import QuerySet
from .context import get_current_tenant


class TenantQuerySet(QuerySet):
    """
    QuerySet that automatically filters by current organization.

    This is the magic that prevents cross-organization data leaks.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._tenant_id = None

    def _clone(self):
        """Preserve organization_id when cloning queryset."""
        clone = super()._clone()
        clone._tenant_id = self._tenant_id
        return clone

    def for_tenant(self, organization):
        """
        Explicitly scope queryset to a specific organization.

        Usage:
            Invoice.objects.for_tenant(organization).all()
        """
        clone = self._clone()
        if organization:
            clone._tenant_id = organization.id if hasattr(organization, 'id') else organization
        return clone

    def _fetch_all(self):
        """
        Override _fetch_all to inject organization filter automatically.

        This is called before any query execution.
        """
        if self._result_cache is None:
            # Get current organization if not explicitly set
            if self._tenant_id is None:
                current_tenant = get_current_tenant()
                if current_tenant:
                    self._tenant_id = current_tenant.id

            # Apply organization filter if we have a organization
            if self._tenant_id is not None:
                # IMPORTANT: str(self.query) contains DATABASE column names
                where_sql = str(self.query).lower()
                # Check for both standard and legacy/alternate naming
                # (Contact table uses 'tenant_id', others use 'organization_id')
                if 'tenant_id' not in where_sql and 'organization_id' not in where_sql:
                    # Apply automatic organization scoping
                    # ForeignKey field name is 'organization', so virtual ID is 'organization_id'
                    self.query.add_q(models.Q(organization_id=self._tenant_id))

        super()._fetch_all()


class TenantManager(models.Manager):
    """
    Manager that uses TenantQuerySet.

    Provides additional utility methods for organization-scoped queries.
    """

    def get_queryset(self):
        """Return TenantQuerySet instead of regular QuerySet."""
        return TenantQuerySet(self.model, using=self._db)

    def for_tenant(self, organization):
        """
        Scope all queries to a specific organization.
        """
        return self.get_queryset().for_tenant(organization)

    def current_tenant(self):
        """
        Get queryset for current organization from request context.
        """
        current_tenant = get_current_tenant()
        if not current_tenant:
            raise ValueError(
                "No current organization in context. "
                "Ensure TenantMiddleware is installed or use for_tenant()."
            )
        return self.for_tenant(current_tenant)

    def create(self, **kwargs):
        """
        Override create to automatically set organization.
        """
        if 'organization' not in kwargs and 'organization_id' not in kwargs:
            current_tenant = get_current_tenant()
            if current_tenant:
                kwargs['organization'] = current_tenant

        return super().create(**kwargs)

    def bulk_create(self, objs, **kwargs):
        """
        Override bulk_create to automatically set organization on all objects.
        """
        current_tenant = get_current_tenant()

        if current_tenant:
            for obj in objs:
                if not getattr(obj, 'organization_id', None):
                    setattr(obj, 'organization', current_tenant)

        return super().bulk_create(objs, **kwargs)
