"""
Tenancy View Mixins

Provides reusable mixins for enforcing tenant isolation in views and viewsets.
"""

from django.core.exceptions import PermissionDenied
from rest_framework import viewsets
from .context import get_current_tenant


class TenantFilteringMixin:
    """
    Mixin that automatically filters ViewSet querysets by current organization.

    This ensures that API endpoints only return data for the current tenant,
    preventing cross-tenant data leakage.

    Usage:
        class InvoiceViewSet(TenantFilteringMixin, viewsets.ModelViewSet):
            queryset = Invoice.objects.all()  # Will be automatically filtered
            serializer_class = InvoiceSerializer

    Notes:
        - Requires TenantMiddleware to be installed
        - Model must have 'organization' ForeignKey field
        - Automatically applies to list, retrieve, update, destroy actions
    """

    def get_queryset(self):
        """
        Override get_queryset to filter by current organization.

        This method is called by DRF for all ViewSet actions.
        """
        queryset = super().get_queryset()

        # Get current tenant from middleware
        current_tenant = get_current_tenant()

        if not current_tenant:
            # No tenant in context - return empty queryset
            # This is safer than raising an exception (prevents info disclosure)
            return queryset.none()

        # Check if model has organization field
        model = queryset.model
        if hasattr(model, 'organization'):
            # Filter by current organization
            return queryset.filter(organization=current_tenant)

        # If model doesn't have organization field, return as-is
        # (This handles global reference data like Country, Currency, etc.)
        return queryset

    def perform_create(self, serializer):
        """
        Automatically set organization on creation.

        Ensures newly created objects are scoped to the current tenant.
        """
        current_tenant = get_current_tenant()

        if not current_tenant:
            raise PermissionDenied("No tenant context available")

        # Check if model has organization field
        if hasattr(serializer.Meta.model, 'organization'):
            serializer.save(organization=current_tenant)
        else:
            serializer.save()


class TenantRequiredMixin:
    """
    Mixin that enforces tenant context is present.

    Raises PermissionDenied if no tenant is set in request context.
    Use this for views that MUST have a tenant (business data).

    Usage:
        class InvoiceViewSet(TenantRequiredMixin, TenantFilteringMixin, viewsets.ModelViewSet):
            queryset = Invoice.objects.all()
            serializer_class = InvoiceSerializer
    """

    def dispatch(self, request, *args, **kwargs):
        """
        Check tenant exists before dispatching request.
        """
        current_tenant = get_current_tenant()

        if not current_tenant:
            raise PermissionDenied(
                "No tenant context. Ensure you are accessing via proper tenant subdomain or header."
            )

        return super().dispatch(request, *args, **kwargs)


class TenantOwnershipMixin:
    """
    Mixin that validates objects belong to current tenant on retrieve/update/delete.

    Provides an additional security layer beyond queryset filtering.

    Usage:
        class InvoiceViewSet(TenantOwnershipMixin, TenantFilteringMixin, viewsets.ModelViewSet):
            queryset = Invoice.objects.all()
            serializer_class = InvoiceSerializer
    """

    def get_object(self):
        """
        Override get_object to verify ownership.

        Returns 404 instead of 403 to avoid information disclosure
        (attacker shouldn't know if object exists in another tenant).
        """
        obj = super().get_object()

        current_tenant = get_current_tenant()

        if not current_tenant:
            raise PermissionDenied("No tenant context")

        # Verify object belongs to current tenant
        if hasattr(obj, 'organization') and obj.organization != current_tenant:
            # Return 404 instead of 403 to avoid info leakage
            from django.http import Http404
            raise Http404("Object not found")

        return obj


class MultiTenantViewSetBase(TenantRequiredMixin, TenantFilteringMixin, TenantOwnershipMixin):
    """
    Complete multi-tenant ViewSet base class.

    Combines all tenant security mixins into one convenient base class.
    Use this as the base for all business data ViewSets.

    Usage:
        class InvoiceViewSet(MultiTenantViewSetBase, viewsets.ModelViewSet):
            queryset = Invoice.objects.all()
            serializer_class = InvoiceSerializer

    Features:
        - Requires tenant context (raises 403 if missing)
        - Automatically filters queryset by current organization
        - Verifies ownership on retrieve/update/delete
        - Auto-assigns organization on create
    """
    pass
