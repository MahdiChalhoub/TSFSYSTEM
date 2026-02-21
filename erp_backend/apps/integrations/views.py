from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from erp.mixins import TenantFilterMixin
from erp.views import AuditLogMixin
from .models import EcommerceIntegration, ExternalProductMapping, ExternalOrderMapping
from .serializers import (
    EcommerceIntegrationSerializer, 
    ExternalProductMappingSerializer, 
    ExternalOrderMappingSerializer
)
from .sync_service import EcommerceSyncService

class EcommerceIntegrationViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = EcommerceIntegration.objects.all()
    serializer_class = EcommerceIntegrationSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        integration = self.get_object()
        service = EcommerceSyncService(integration)
        result = service.connector.test_connection()
        if 'error' in result:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=['post'])
    def sync_products(self, request, pk=None):
        integration = self.get_object()
        service = EcommerceSyncService(integration)
        limit = request.query_params.get('limit', 50)
        result = service.sync_products(limit=int(limit))
        if 'error' in result:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=['post'])
    def sync_orders(self, request, pk=None):
        integration = self.get_object()
        service = EcommerceSyncService(integration)
        limit = request.query_params.get('limit', 50)
        result = service.import_orders(limit=int(limit))
        if 'error' in result:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=['post'])
    def sync_all(self, request, pk=None):
        integration = self.get_object()
        service = EcommerceSyncService(integration)
        
        p_res = service.sync_products(limit=100)
        o_res = service.import_orders(limit=100)
        
        return Response({
            'products': p_res,
            'orders': o_res
        })

class ExternalProductMappingViewSet(TenantFilterMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ExternalProductMapping.objects.all()
    serializer_class = ExternalProductMappingSerializer
    permission_classes = [IsAuthenticated]

class ExternalOrderMappingViewSet(TenantFilterMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ExternalOrderMapping.objects.all()
    serializer_class = ExternalOrderMappingSerializer
    permission_classes = [IsAuthenticated]
