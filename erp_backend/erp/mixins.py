# Shared ViewSet Mixins
# AuditLogMixin - Automatic audit logging for CRUD operations
# ConnectorAwareMixin - Routes requests through Connector Engine

import json

from rest_framework import status
from rest_framework.response import Response


class AuditLogMixin:
    """
    Mixin that automatically logs create/update/delete actions to AuditLog.
    
    Usage:
        class ProductViewSet(AuditLogMixin, viewsets.ModelViewSet):
            audit_model_name = 'Product'
    """
    audit_model_name = None  # Override in subclass, e.g., 'Product', 'ChartOfAccount'
    audit_exclude_fields = ['password', 'token', 'secret']  # Fields to exclude from logs

    def _serialize_instance(self, instance):
        """Safely serialize instance data for logging."""
        if instance is None:
            return None

        data = {}
        for field in instance._meta.fields:
            field_name = field.name
            if field_name in self.audit_exclude_fields:
                data[field_name] = '[REDACTED]'
            else:
                value = getattr(instance, field_name, None)
                # Handle special types
                if hasattr(value, 'isoformat'):
                    data[field_name] = value.isoformat()
                elif hasattr(value, 'pk'):
                    data[field_name] = str(value.pk)
                else:
                    try:
                        json.dumps(value)  # Test if serializable
                        data[field_name] = value
                    except (TypeError, ValueError):
                        data[field_name] = str(value)
        return data

    def _get_org_id(self):
        """Get organization ID from middleware context."""
        from .middleware import get_current_tenant_id
        return get_current_tenant_id()

    def _log_action(self, action, instance, old_data=None):
        """Create audit log entry."""
        from django.db import transaction as db_transaction

        from .models_audit import AuditLog

        org_id = self._get_org_id()
        user = self.request.user if self.request.user.is_authenticated else None

        new_data = self._serialize_instance(instance) if action != 'DELETE' else None

        try:
            # Use a savepoint so that if the auditlog table doesn't exist
            # (managed=False, not created in tests), the error is contained
            # and doesn't poison the outer transaction.
            with db_transaction.atomic():
                AuditLog.objects.create(
                    organization_id=org_id,
                    actor=user,
                    action=action,
                    table_name=self.audit_model_name or instance.__class__.__name__,
                    record_id=str(instance.pk) if instance else '',
                    new_value=new_data,
                    old_value=old_data,
                    ip_address=self.request.META.get('REMOTE_ADDR'),
                    user_agent=self.request.META.get('HTTP_USER_AGENT', '')[:500],
                )
        except Exception as e:
            # Don't fail the request if audit logging fails
            import logging
            logging.getLogger('erp').warning(f"[AUDIT] Failed to log action: {e}")

    def perform_create(self, serializer):
        """Override to log CREATE actions."""
        instance = serializer.save()
        self._log_action('CREATE', instance)
        return instance

    def perform_update(self, serializer):
        """Override to log UPDATE actions with before/after data."""
        instance = self.get_object()
        old_data = self._serialize_instance(instance)
        updated_instance = serializer.save()
        self._log_action('UPDATE', updated_instance, old_data=old_data)
        return updated_instance

    def perform_destroy(self, instance):
        """Override to log DELETE actions."""
        old_data = self._serialize_instance(instance)
        self._log_action('DELETE', instance, old_data=old_data)
        instance.delete()


class ConnectorAwareMixin:
    """
    Mixin that routes requests through the Connector Engine
    when the target module is not enabled for the tenant.
    
    Usage:
        class ProductViewSet(ConnectorAwareMixin, viewsets.ModelViewSet):
            connector_module = 'inventory'
    """
    connector_module = None  # Override in subclass: 'inventory', 'finance', 'pos', etc.
    connector_bypass_actions = ['list', 'retrieve']  # Actions that don't need module check

    def _check_module_enabled(self):
        """Returns True if module is enabled for this tenant."""
        if not self.connector_module:
            return True

        from .module_manager import ModuleManager
        org_id = getattr(self.request, 'org_id', None)

        if not org_id:
            # No org context (SaaS admin) - always enabled
            return True

        return ModuleManager.is_enabled(self.connector_module, org_id)

    def _buffer_request(self, action_name):
        """Buffer the request if module is not enabled."""
        from .connector_engine import connector_engine

        org_id = getattr(self.request, 'org_id', None)

        # Prepare request data
        request_data = {
            'method': self.request.method,
            'path': self.request.path,
            'data': self.request.data if hasattr(self.request, 'data') else {},
            'query_params': dict(self.request.query_params),
            'user_id': self.request.user.id if self.request.user.is_authenticated else None,
        }

        result = connector_engine.buffer_request(
            module=self.connector_module,
            action=action_name,
            data=request_data,
            organization_id=org_id
        )

        return Response({
            'status': 'buffered',
            'message': f'Module {self.connector_module} is not enabled. Request has been buffered.',
            'buffer_id': result.get('buffer_id') if isinstance(result, dict) else None,
        }, status=status.HTTP_202_ACCEPTED)

    def initial(self, request, *args, **kwargs):
        """Check module status before processing request."""
        super().initial(request, *args, **kwargs)

        # Skip check for bypass actions
        if self.action in self.connector_bypass_actions:
            return

        # Check if module is enabled
        if not self._check_module_enabled():
            # Store flag to buffer later
            self._should_buffer = True
        else:
            self._should_buffer = False

    def create(self, request, *args, **kwargs):
        """Override create to handle buffering."""
        if getattr(self, '_should_buffer', False):
            return self._buffer_request('create')
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        """Override update to handle buffering."""
        if getattr(self, '_should_buffer', False):
            return self._buffer_request('update')
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Override destroy to handle buffering."""
        if getattr(self, '_should_buffer', False):
            return self._buffer_request('destroy')
        return super().destroy(request, *args, **kwargs)


class TenantFilterMixin:
    """
    Mixin that automatically filters querysets by organization.
    
    Usage:
        class ProductViewSet(TenantFilterMixin, viewsets.ModelViewSet):
            queryset = Product.objects.all()
    """

    def get_queryset(self):
        """Filter queryset by organization from request."""
        qs = super().get_queryset()
        org_id = getattr(self.request, 'org_id', None)

        if org_id and hasattr(qs.model, 'organization_id'):
            return qs.filter(organization_id=org_id)
        return qs

    def perform_create(self, serializer):
        """Automatically set organization on create."""
        org_id = getattr(self.request, 'org_id', None)
        if org_id and 'organization_id' not in serializer.validated_data:
            serializer.save(organization_id=org_id)
        else:
            serializer.save()


class PriceChangeApprovalRequired(Exception):
    """Exception raised when a price change requires workflow approval."""
    def __init__(self, approval_id, message="Price change requires approval"):
        self.approval_id = approval_id
        self.message = message
        super().__init__(message)


class PriceChangeWorkflowMixin:
    """
    Mixin to check if price changes require approval workflow.
    
    Usage:
        class ProductViewSet(PriceChangeWorkflowMixin, viewsets.ModelViewSet):
            pass
    
    When a price field is modified and a workflow requires PRE approval:
    - Returns 202 Accepted with approval_request_id
    - Change is NOT applied until approved
    """
    price_fields = ['cost_price', 'cost_price_ht', 'cost_price_ttc',
                    'selling_price_ht', 'selling_price_ttc']

    def check_price_change_workflow(self, instance, new_data, request):
        """
        Check if price change requires approval.
        
        Args:
            instance: The existing model instance
            new_data: Dict of new values being set
            request: The HTTP request
            
        Returns:
            Tuple of (requires_hold: bool, approval_id: UUID or None)
        """
        from decimal import Decimal, InvalidOperation

        # Detect if any price field is changing
        price_changes = {}
        for field in self.price_fields:
            old_val = getattr(instance, field, None)
            new_val = new_data.get(field)

            # Skip if not being updated
            if new_val is None:
                continue

            # Convert to Decimal for comparison
            try:
                old_decimal = Decimal(str(old_val)) if old_val else Decimal('0')
                new_decimal = Decimal(str(new_val)) if new_val else Decimal('0')
            except (TypeError, ValueError, InvalidOperation):
                continue

            if old_decimal != new_decimal:
                price_changes[field] = {
                    'old': float(old_decimal),
                    'new': float(new_decimal)
                }

        if not price_changes:
            return False, None  # No price changes

        # Check workflow
        from .services_audit import WorkflowService

        org = getattr(instance, 'organization', None)

        result = WorkflowService.check_workflow(
            event_type='product.price_change',
            actor=request.user,
            payload={
                'product_id': str(instance.id),
                'product_name': getattr(instance, 'name', str(instance)),
                'sku': getattr(instance, 'sku', ''),
                'changes': price_changes
            },
            organization=org,
            target_table='Product',
            target_id=str(instance.id)
        )

        return result.requires_hold, result.request_id

    def perform_update_with_workflow(self, serializer):
        """
        Perform update with workflow check for price changes.
        Call this from perform_update if you want workflow protection.
        """
        instance = self.get_object()

        # Check for price change workflow
        requires_hold, approval_id = self.check_price_change_workflow(
            instance,
            serializer.validated_data,
            self.request
        )

        if requires_hold:
            # Return 202 - change requires approval
            raise PriceChangeApprovalRequired(approval_id)

        # Proceed with update
        return serializer.save()


from django.db import models as dj_models
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter


class UDLEViewSetMixin:
    """
    Universal Dynamic List Engine (UDLE) Mixin.
    Provides:
    1. Schema metadata action for frontend introspection.
    2. Standardized filtering, searching, and ordering.
    3. Customization hooks for column visibility and defaults.
    """
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    # Override in subclass if needed
    udle_exclude_fields = ['password', 'secret', 'token']

    @action(detail=False, methods=['get'], url_path='schema-meta')
    def schema_meta(self, request):
        """
        Returns JSON metadata describing the model fields for dynamic UI generation.
        """
        model = self.get_queryset().model
        meta = model._meta

        fields_info = []
        for field in meta.get_fields():
            # Skip reverse relations and explicitly excluded fields
            if field.one_to_many or field.many_to_many or field.name in self.udle_exclude_fields:
                continue

            field_type = "string"
            choices = None

            if isinstance(field, dj_models.IntegerField) or isinstance(field, dj_models.AutoField):
                field_type = "number"
            elif isinstance(field, dj_models.DecimalField) or isinstance(field, dj_models.FloatField):
                field_type = "decimal"
            elif isinstance(field, dj_models.BooleanField):
                field_type = "boolean"
            elif isinstance(field, dj_models.DateTimeField):
                field_type = "datetime"
            elif isinstance(field, dj_models.DateField):
                field_type = "date"
            elif isinstance(field, dj_models.ForeignKey):
                field_type = "relation"

            if hasattr(field, 'choices') and field.choices:
                choices = [{"value": c[0], "label": str(c[1])} for c in field.choices]
                field_type = "select"

            fields_info.append({
                "name": field.name,
                "label": getattr(field, 'verbose_name', field.name).capitalize(),
                "type": field_type,
                "required": not field.null if hasattr(field, 'null') else False,
                "sortable": True,
                "filterable": True,
                "choices": choices
            })

        return Response({
            "model": meta.model_name,
            "verbose_name": meta.verbose_name.capitalize(),
            "verbose_name_plural": meta.verbose_name_plural.capitalize(),
            "fields": fields_info,
            "default_columns": [f["name"] for f in fields_info[:8]], # Suggest first 8 as default
        })

