"""
Connector Module - API Views
=============================
REST API endpoints for Connector module management.

These endpoints allow SuperAdmin to:
- View module states across the platform
- Configure connector policies
- Monitor and manage buffered requests
- View routing logs
"""

from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.utils import timezone

from .connector_models import (
    ModuleContract, ConnectorPolicy, BufferedRequest,
    ConnectorCache, ConnectorLog
)
from .connector_engine import ConnectorEngine, ModuleState, connector_engine
from .permissions import IsSuperAdmin


# =============================================================================
# SERIALIZERS
# =============================================================================

from rest_framework import serializers


class ModuleContractSerializer(serializers.ModelSerializer):
    module_name = serializers.CharField(source='module.name', read_only=True)
    module_version = serializers.CharField(source='module.version', read_only=True)
    
    class Meta:
        model = ModuleContract
        fields = [
            'id', 'module_name', 'module_version',
            'provides', 'needs', 'rules', 'version',
            'created_at', 'updated_at'
        ]


class ConnectorPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = ConnectorPolicy
        fields = [
            'id', 'source_module', 'target_module', 'target_endpoint',
            'when_missing_read', 'when_missing_write',
            'when_disabled_read', 'when_disabled_write',
            'when_unauthorized_read', 'when_unauthorized_write',
            'cache_ttl_seconds', 'buffer_ttl_seconds', 'max_buffer_size',
            'priority', 'is_active', 'created_at', 'updated_at'
        ]


class BufferedRequestSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    is_expired = serializers.BooleanField(read_only=True)
    can_retry = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = BufferedRequest
        fields = [
            'id', 'target_module', 'target_endpoint', 'source_module',
            'organization', 'organization_name', 'method', 'payload',
            'status', 'retry_count', 'max_retries',
            'created_at', 'expires_at', 'replayed_at', 'last_attempt_at',
            'last_error', 'is_expired', 'can_retry'
        ]
        read_only_fields = ['id', 'created_at', 'replayed_at']


class ConnectorLogSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    user_email = serializers.CharField(
        source='user.email', read_only=True
    )
    
    class Meta:
        model = ConnectorLog
        fields = [
            'id', 'source_module', 'target_module', 'target_endpoint',
            'operation', 'module_state', 'decision', 'policy_applied',
            'organization', 'organization_name', 'user', 'user_email',
            'success', 'response_time_ms', 'error_message', 'created_at'
        ]


class ModuleStateSerializer(serializers.Serializer):
    """Serializer for module state overview."""
    module_code = serializers.CharField()
    module_name = serializers.CharField()
    state = serializers.CharField()
    is_available = serializers.BooleanField()
    pending_buffers = serializers.IntegerField()
    last_activity = serializers.DateTimeField(allow_null=True)


# =============================================================================
# VIEW SETS
# =============================================================================

class ModuleContractViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Module Contracts.
    Contracts define what modules provide and need.
    """
    queryset = ModuleContract.objects.select_related('module').all()
    serializer_class = ModuleContractSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        module = self.request.query_params.get('module')
        if module:
            queryset = queryset.filter(module__name=module)
        return queryset


class ConnectorPolicyViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Connector Policies.
    Policies define fallback behaviors per module state.
    """
    queryset = ConnectorPolicy.objects.all()
    serializer_class = ConnectorPolicySerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        module = self.request.query_params.get('module')
        if module:
            queryset = queryset.filter(target_module=module)
        active_only = self.request.query_params.get('active_only')
        if active_only == 'true':
            queryset = queryset.filter(is_active=True)
        return queryset
    
    @action(detail=False, methods=['post'])
    def set_default(self, request):
        """Set a global default policy for all modules."""
        serializer = self.get_serializer(data={
            **request.data,
            'target_module': '*',
            'target_endpoint': '*'
        })
        serializer.is_valid(raise_exception=True)
        
        # Update or create the global policy
        policy, created = ConnectorPolicy.objects.update_or_create(
            target_module='*',
            target_endpoint='*',
            defaults=serializer.validated_data
        )
        
        return Response(
            self.get_serializer(policy).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class BufferedRequestViewSet(viewsets.ModelViewSet):
    """
    View and manage buffered requests.
    Buffered requests are writes that couldn't be delivered.
    """
    queryset = BufferedRequest.objects.select_related('organization').all()
    serializer_class = BufferedRequestSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by module
        module = self.request.query_params.get('module')
        if module:
            queryset = queryset.filter(target_module=module)
        
        # Filter by organization
        org_id = self.request.query_params.get('organization')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Manually retry a buffered request."""
        buffered = self.get_object()
        
        if buffered.status != 'pending':
            return Response(
                {'error': 'Only pending requests can be retried'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if target module is now available
        state = connector_engine.get_module_state(
            buffered.target_module,
            buffered.organization_id
        )
        
        if state != ModuleState.AVAILABLE:
            return Response(
                {'error': f'Target module is {state.value}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Attempt replay
        try:
            connector_engine._forward_write_request(
                buffered.target_module,
                buffered.target_endpoint,
                buffered.payload,
                buffered.organization_id,
                buffered.method
            )
            
            buffered.status = 'replayed'
            buffered.replayed_at = timezone.now()
            buffered.save()
            
            return Response({'status': 'replayed'})
            
        except Exception as e:
            buffered.retry_count += 1
            buffered.last_error = str(e)
            buffered.last_attempt_at = timezone.now()
            buffered.save()
            
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def replay_all(self, request):
        """Replay all pending buffers for a module."""
        module = request.data.get('module')
        org_id = request.data.get('organization_id')
        
        if not module or not org_id:
            return Response(
                {'error': 'module and organization_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        replayed, failed = connector_engine.replay_buffered(module, org_id)
        
        return Response({
            'replayed': replayed,
            'failed': failed
        })
    
    @action(detail=False, methods=['post'])
    def cleanup_expired(self, request):
        """Mark all expired buffers as expired."""
        count = connector_engine.cleanup_expired_buffers()
        return Response({'expired_count': count})


class ConnectorLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to connector routing logs.
    For audit and debugging purposes.
    """
    queryset = ConnectorLog.objects.select_related(
        'organization', 'user', 'policy_applied'
    ).all()
    serializer_class = ConnectorLogSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by module
        module = self.request.query_params.get('module')
        if module:
            queryset = queryset.filter(
                Q(source_module=module) | Q(target_module=module)
            )
        
        # Filter by organization
        org_id = self.request.query_params.get('organization')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        
        # Filter by decision
        decision = self.request.query_params.get('decision')
        if decision:
            queryset = queryset.filter(decision=decision)
        
        # Filter by date range
        from_date = self.request.query_params.get('from')
        to_date = self.request.query_params.get('to')
        if from_date:
            queryset = queryset.filter(created_at__gte=from_date)
        if to_date:
            queryset = queryset.filter(created_at__lte=to_date)
        
        return queryset[:1000]  # Limit for performance


# =============================================================================
# SPECIALIZED VIEWS
# =============================================================================

class ModuleStateOverviewView(APIView):
    """
    Get an overview of all module states for a specific organization.
    Used by the Connector Dashboard.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        org_id = request.query_params.get('organization_id')
        if not org_id:
            # Try to get from request context
            org_id = getattr(request, 'tenant_id', None)
        
        if not org_id:
            return Response(
                {'error': 'organization_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all module states
        states = connector_engine.get_all_module_states(int(org_id))
        
        # Get pending buffer counts
        from django.db.models import Count
        buffer_counts = dict(
            BufferedRequest.objects.filter(
                organization_id=org_id,
                status='pending'
            ).values('target_module').annotate(
                count=Count('id')
            ).values_list('target_module', 'count')
        )
        
        # Get last activity per module
        from .models import SystemModule
        modules = SystemModule.objects.all()
        
        result = []
        for module in modules:
            last_log = ConnectorLog.objects.filter(
                target_module=module.name,
                organization_id=org_id
            ).order_by('-created_at').first()
            
            state = states.get(module.name, ModuleState.MISSING)
            
            result.append({
                'module_code': module.name,
                'module_name': module.manifest.get('display_name', module.name),
                'state': state.value,
                'is_available': state == ModuleState.AVAILABLE,
                'pending_buffers': buffer_counts.get(module.name, 0),
                'last_activity': last_log.created_at if last_log else None
            })
        
        return Response(result)


class ConnectorDashboardView(APIView):
    """
    Dashboard view for the Connector admin panel.
    Returns summary statistics.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    
    def get(self, request):
        from .models import SystemModule, Organization
        
        # Count modules by status
        from .models import OrganizationModule
        
        total_modules = SystemModule.objects.count()
        active_policies = ConnectorPolicy.objects.filter(is_active=True).count()
        
        # Buffer statistics
        buffer_stats = BufferedRequest.objects.aggregate(
            pending=Count('id', filter=Q(status='pending')),
            replayed=Count('id', filter=Q(status='replayed')),
            failed=Count('id', filter=Q(status='failed')),
            expired=Count('id', filter=Q(status='expired')),
        )
        
        # Recent routing decisions
        recent_logs = ConnectorLog.objects.order_by('-created_at')[:10]
        
        # Decision distribution (last 24 hours)
        from datetime import timedelta
        yesterday = timezone.now() - timedelta(hours=24)
        decision_counts = dict(
            ConnectorLog.objects.filter(
                created_at__gte=yesterday
            ).values('decision').annotate(
                count=Count('id')
            ).values_list('decision', 'count')
        )
        
        return Response({
            'summary': {
                'total_modules': total_modules,
                'active_policies': active_policies,
                'contracts_registered': ModuleContract.objects.count(),
            },
            'buffer_stats': buffer_stats,
            'decision_distribution': decision_counts,
            'recent_logs': ConnectorLogSerializer(recent_logs, many=True).data
        })


class ConnectorRouteView(APIView):
    """
    Main routing endpoint for inter-module communication.
    This is used by frontend connectors to route requests.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """
        Route a request through the connector.
        
        Request body:
        {
            "target_module": "inventory",
            "endpoint": "products/",
            "operation": "read",  # read, write, event
            "data": {...},  # for write operations
            "params": {...}  # for read operations
        }
        """
        target_module = request.data.get('target_module')
        endpoint = request.data.get('endpoint')
        operation = request.data.get('operation', 'read')
        
        if not target_module or not endpoint:
            return Response(
                {'error': 'target_module and endpoint required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        org_id = getattr(request, 'tenant_id', None)
        if not org_id:
            return Response(
                {'error': 'Organization context required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user_id = request.user.id if request.user.is_authenticated else None
        
        if operation == 'read':
            response = connector_engine.route_read(
                target_module=target_module,
                endpoint=endpoint,
                organization_id=org_id,
                user_id=user_id,
                params=request.data.get('params')
            )
        elif operation == 'write':
            response = connector_engine.route_write(
                target_module=target_module,
                endpoint=endpoint,
                data=request.data.get('data', {}),
                organization_id=org_id,
                user_id=user_id,
                method=request.data.get('method', 'POST')
            )
        elif operation == 'event':
            results = connector_engine.dispatch_event(
                source_module=request.data.get('source_module', 'unknown'),
                event_name=request.data.get('event_name'),
                payload=request.data.get('payload', {}),
                organization_id=org_id
            )
            return Response({'results': results})
        else:
            return Response(
                {'error': f'Unknown operation: {operation}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response(response.to_dict())
