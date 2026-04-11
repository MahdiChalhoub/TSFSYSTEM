"""
Warehouse Location Views
"""
from rest_framework.decorators import action
from rest_framework.response import Response
from erp.views import TenantModelViewSet

from apps.inventory.models import (
    WarehouseZone, WarehouseAisle, WarehouseRack,
    WarehouseShelf, WarehouseBin, ProductLocation
)
from apps.inventory.serializers import (
    WarehouseZoneSerializer, WarehouseAisleSerializer, WarehouseRackSerializer,
    WarehouseShelfSerializer, WarehouseBinSerializer, ProductLocationSerializer
)


class WarehouseZoneViewSet(TenantModelViewSet):
    queryset = WarehouseZone.objects.all()
    serializer_class = WarehouseZoneSerializer

    @action(detail=True, methods=['get'], url_path='layout')
    def layout(self, request, pk=None):
        """Get full layout tree for a zone."""
        zone = self.get_object()
        data = {
            'id': str(zone.id),
            'code': zone.code,
            'name': zone.name,
            'zone_type': zone.zone_type,
            'aisles': []
        }
        for aisle in zone.aisles.all():
            aisle_data = {
                'id': str(aisle.id),
                'code': aisle.code,
                'name': aisle.name,
                'racks': []
            }
            for rack in aisle.racks.all():
                rack_data = {
                    'id': str(rack.id),
                    'code': rack.code,
                    'shelves': []
                }
                for shelf in rack.shelves.all():
                    shelf_data = {
                        'id': str(shelf.id),
                        'code': shelf.code,
                        'bins': []
                    }
                    for bin_obj in shelf.bins.all():
                        bin_data = {
                            'id': str(bin_obj.id),
                            'code': bin_obj.code,
                            'full_code': bin_obj.full_location_code,
                            'is_active': bin_obj.is_active,
                            'products': bin_obj.product_locations.count(),
                        }
                        shelf_data['bins'].append(bin_data)
                    rack_data['shelves'].append(shelf_data)
                aisle_data['racks'].append(rack_data)
            data['aisles'].append(aisle_data)
        return Response(data)


class WarehouseAisleViewSet(TenantModelViewSet):
    queryset = WarehouseAisle.objects.all()
    serializer_class = WarehouseAisleSerializer


class WarehouseRackViewSet(TenantModelViewSet):
    queryset = WarehouseRack.objects.all()
    serializer_class = WarehouseRackSerializer


class WarehouseShelfViewSet(TenantModelViewSet):
    queryset = WarehouseShelf.objects.all()
    serializer_class = WarehouseShelfSerializer


class WarehouseBinViewSet(TenantModelViewSet):
    queryset = WarehouseBin.objects.all()
    serializer_class = WarehouseBinSerializer


class ProductLocationViewSet(TenantModelViewSet):
    queryset = ProductLocation.objects.all().select_related('product', 'bin')
    serializer_class = ProductLocationSerializer

    @action(detail=False, methods=['get'], url_path='by-product/(?P<product_id>[^/.]+)')
    def by_product(self, request, product_id=None):
        """Get all locations for a specific product."""
        locs = self.get_queryset().filter(product_id=product_id)
        serializer = self.get_serializer(locs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-bin/(?P<bin_id>[^/.]+)')
    def by_bin(self, request, bin_id=None):
        """Get all products in a specific bin."""
        locs = self.get_queryset().filter(bin_id=bin_id)
        serializer = self.get_serializer(locs, many=True)
        return Response(serializer.data)
