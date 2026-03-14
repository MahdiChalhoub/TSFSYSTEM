from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from apps.pos.models import POSAuditEvent, POSAuditRule
from apps.pos.serializers import POSAuditEventSerializer, POSAuditRuleSerializer
from erp.middleware import get_current_tenant_id

class POSAuditRuleViewSet(viewsets.ModelViewSet):
    serializer_class = POSAuditRuleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['event_type', 'is_active']
    search_fields = ['event_type', 'notify_roles']

    def get_queryset(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return POSAuditRule.objects.none()
        return POSAuditRule.objects.filter(organization_id=org_id)

    def perform_create(self, serializer):
        serializer.save(organization_id=get_current_tenant_id())

class POSAuditEventViewSet(viewsets.ModelViewSet):
    serializer_class = POSAuditEventSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['event_type', 'is_reviewed', 'register_id', 'user_id']
    search_fields = ['event_name', 'reference_id', 'details']
    ordering_fields = ['created_at', 'event_type']
    ordering = ['-created_at']

    def get_queryset(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return POSAuditEvent.objects.none()
        return POSAuditEvent.objects.filter(organization_id=org_id)

    def perform_create(self, serializer):
        # Usually created programmatically, but allow manual creation for testing if needed
        serializer.save(organization_id=get_current_tenant_id())

    @action(detail=True, methods=['post'])
    def mark_reviewed(self, request, pk=None):
        event = self.get_object()
        event.is_reviewed = True
        event.reviewed_by = request.user
        event.review_notes = request.data.get('notes', '')
        event.save()
        return Response(self.get_serializer(event).data)
