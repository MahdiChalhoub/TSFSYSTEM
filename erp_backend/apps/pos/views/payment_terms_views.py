"""Payment Terms ViewSet — full CRUD for managing payment conditions."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.pos.models import PaymentTerm
from apps.pos.serializers.purchase_serializers import PaymentTermSerializer
from erp.middleware import get_current_tenant_id


class PaymentTermViewSet(viewsets.ModelViewSet):
    """CRUD for payment terms (organization-scoped)."""
    serializer_class = PaymentTermSerializer
    queryset = PaymentTerm.objects.all()

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        from erp.models import Organization
        org = Organization.objects.get(id=org_id)
        serializer.save(organization=org)

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        """Seed standard payment terms if none exist."""
        org_id = get_current_tenant_id()
        from erp.models import Organization
        org = Organization.objects.get(id=org_id)

        if PaymentTerm.objects.filter(organization=org).exists():
            return Response({'message': 'Payment terms already exist.'}, status=status.HTTP_200_OK)

        defaults = [
            {'code': '100_DELIVERY', 'name': '100% at Delivery', 'days': 0, 'is_default': True, 'sort_order': 1},
            {'code': 'NET_30', 'name': 'Net 30 Days', 'days': 30, 'sort_order': 2},
            {'code': 'NET_60', 'name': 'Net 60 Days', 'days': 60, 'sort_order': 3},
            {'code': 'NET_90', 'name': 'Net 90 Days', 'days': 90, 'sort_order': 4},
            {'code': 'PREPAID', 'name': 'Prepaid', 'days': 0, 'sort_order': 5,
             'description': 'Full payment before shipment'},
            {'code': 'COD', 'name': 'Cash on Delivery', 'days': 0, 'sort_order': 6},
            {'code': '50_50', 'name': '50% Advance / 50% Delivery', 'days': 0, 'sort_order': 7,
             'description': '50% paid upfront, 50% on delivery'},
            {'code': '2_10_NET_30', 'name': '2/10 Net 30', 'days': 30, 'discount_percent': 2, 'discount_days': 10,
             'sort_order': 8, 'description': '2% discount if paid within 10 days, otherwise net 30'},
        ]

        created = []
        for d in defaults:
            pt = PaymentTerm.objects.create(organization=org, **d)
            created.append(pt.name)

        return Response({'message': f'Created {len(created)} payment terms.', 'terms': created},
                        status=status.HTTP_201_CREATED)
