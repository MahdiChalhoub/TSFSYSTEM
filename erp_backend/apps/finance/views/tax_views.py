from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id
)
from apps.finance.models import TaxGroup
from apps.finance.serializers import TaxGroupSerializer

class TaxGroupViewSet(TenantModelViewSet):
    queryset = TaxGroup.objects.all()
    serializer_class = TaxGroupSerializer

    @action(detail=False, methods=['post'])
    def set_default(self, request):
        """Set a tax group as the default for this organization."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "Tenant context missing"}, status=400)
        tax_group_id = request.data.get('tax_group_id')
        if not tax_group_id:
            return Response({"error": "tax_group_id required"}, status=400)
        try:
            TaxGroup.objects.filter(organization_id=organization_id).update(is_default=False)
            tg = TaxGroup.objects.get(id=tax_group_id, organization_id=organization_id)
            tg.is_default = True
            tg.save()
            return Response(TaxGroupSerializer(tg).data)
        except TaxGroup.DoesNotExist:
            return Response({"error": "Tax group not found"}, status=404)
