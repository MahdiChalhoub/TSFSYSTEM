# Shared ViewSet Mixins
# AuditLogMixin - Automatic audit logging for CRUD operations
# ConnectorAwareMixin - Routes requests through Connector Engine

from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status
import json


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
        """Get organization ID from request."""
        return getattr(self.request, 'org_id', None)
    
    def _log_action(self, action, instance, old_data=None):
        """Create audit log entry."""
        from .models_audit import AuditLog
        
        org_id = self._get_org_id()
        user = self.request.user if self.request.user.is_authenticated else None
        
        new_data = self._serialize_instance(instance) if action != 'DELETE' else None
        
        try:
            AuditLog.objects.create(
                organization_id=org_id,
                user=user,
                action=action,
                entity_type=self.audit_model_name or instance.__class__.__name__,
                entity_id=str(instance.pk) if instance else None,
                new_data=new_data,
                old_data=old_data,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                user_agent=self.request.META.get('HTTP_USER_AGENT', '')[:500],
            )
        except Exception as e:
            # Don't fail the request if audit logging fails
            print(f"[AUDIT] Failed to log action: {e}")
    
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
