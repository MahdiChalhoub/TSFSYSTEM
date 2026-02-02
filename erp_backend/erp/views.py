from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from .models import Organization
from .serializers import OrganizationSerializer

@api_view(['GET'])
def health_check(request):
    return Response({
        "status": "online",
        "service": "TSF ERP Core (Django)",
        "database": "PostgreSQL",
        "tenant_context": request.headers.get('X-Tenant-Slug', 'None')
    })

class OrganizationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
