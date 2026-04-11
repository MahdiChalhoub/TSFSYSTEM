from apps.inventory.models import (
    Brand,
    Category,
    ComboComponent,
    Inventory,
    InventoryMovement,
    OperationalRequestLine,
    Parfum,
    Product,
    ProductGroup,
    Unit,
)
from apps.inventory.serializers import (
    ComboComponentSerializer,
    ProductCreateSerializer,
    ProductSerializer,
    StorefrontProductSerializer,
)
from .base import (
    AnonRateThrottle,
    Coalesce,
    Count,
    DecimalField,
    Organization,
    Q,
    Response,
    Sum,
    TenantModelViewSet,
    _get_org_or_400,
    action,
    permissions,
    status,
    timezone,
    timedelta,
    transaction,
)
from erp.mixins import UDLEViewSetMixin


class ProductBulkMixin:

    # --- H5: bulk_move with target validation ---
    @action(detail=False, methods=['post'])
    def bulk_move(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        product_ids = request.data.get('productIds', [])
        target_id = request.data.get('targetId')
        move_type = request.data.get('type')

        if not product_ids or not target_id or not move_type:
            return Response({"error": "Missing parameters"}, status=400)

        # Validate target entity exists and belongs to this organization
        target_model_map = {
            'category': Category,
            'brand': Brand,
            'unit': Unit,
            'country': None,  # Country is a shared model, no org filter
            'attribute': Parfum,
        }

        target_model = target_model_map.get(move_type)
        if target_model is None and move_type == 'country':
            from erp.models import Country
            if not Country.objects.filter(id=target_id).exists():
                return Response({"error": f"Country with id {target_id} not found"}, status=404)
        elif target_model:
            if not target_model.objects.filter(id=target_id, organization=organization).exists():
                return Response({"error": f"{move_type.title()} with id {target_id} not found"}, status=404)
        else:
            return Response({"error": f"Unknown move type: {move_type}"}, status=400)

        with transaction.atomic():
            products = Product.objects.filter(id__in=product_ids, organization=organization)

            updates = {}
            if move_type == 'category':
                updates['category_id'] = target_id
                updates['product_group_id'] = None
            elif move_type == 'brand':
                updates['brand_id'] = target_id
                updates['product_group_id'] = None
            elif move_type == 'unit':
                updates['unit_id'] = target_id
            elif move_type == 'country':
                updates['country_id'] = target_id
            elif move_type == 'attribute':
                updates['parfum_id'] = target_id

            count = 0
            if updates:
                count = products.update(**updates)

            return Response({"success": True, "count": count})


    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        Bulk update product fields. Accepts a list of updates:
        [{ "id": 123, "name": "New Name", "tva_rate": "19.00", ... }, ...]
        Allowed fields: name, barcode, category, brand, unit, parfum, tva_rate,
        cost_price_ht, cost_price_ttc, selling_price_ht, selling_price_ttc, size
        """
        organization, err = _get_org_or_400()
        if err: return err

        updates = request.data.get('updates', [])
        if not updates:
            return Response({"error": "No updates provided"}, status=400)

        ALLOWED_FIELDS = {
            'name', 'barcode', 'tva_rate', 'cost_price_ht', 'cost_price_ttc',
            'selling_price_ht', 'selling_price_ttc', 'size', 'description',
            'min_stock_level', 'is_expiry_tracked',
        }
        FK_FIELDS = {
            'category': ('category_id', Category),
            'brand': ('brand_id', Brand),
            'unit': ('unit_id', Unit),
            'parfum': ('parfum_id', Parfum),
        }

        updated = 0
        errors = []
        with transaction.atomic():
            for item in updates:
                product_id = item.get('id')
                if not product_id:
                    continue
                try:
                    product = Product.objects.get(id=product_id, organization=organization)
                except Product.DoesNotExist:
                    errors.append(f"Product {product_id} not found")
                    continue

                for field, value in item.items():
                    if field == 'id':
                        continue
                    if field in ALLOWED_FIELDS:
                        setattr(product, field, value)
                    elif field in FK_FIELDS:
                        db_field, model_class = FK_FIELDS[field]
                        if value is None:
                            setattr(product, db_field, None)
                        else:
                            setattr(product, db_field, value)

                product.save()
                updated += 1

        return Response({"success": True, "updated": updated, "errors": errors})


    @action(detail=False, methods=['post'])
    def generate_barcodes(self, request):
        """
        Generate EAN-13 barcodes for products that don't have one.
        Accepts: { "product_ids": [1, 2, 3] } or { "all_missing": true }
        """
        organization, err = _get_org_or_400()
        if err: return err

        product_ids = request.data.get('product_ids', [])
        all_missing = request.data.get('all_missing', False)

        if all_missing:
            products = Product.objects.filter(
                organization=organization,
                is_active=True,
            ).filter(
                Q(barcode__isnull=True) | Q(barcode='')
            )
        elif product_ids:
            products = Product.objects.filter(
                id__in=product_ids, organization=organization
            ).filter(
                Q(barcode__isnull=True) | Q(barcode='')
            )
        else:
            return Response({"error": "Provide product_ids or set all_missing=true"}, status=400)

        try:
            from erp.connector_engine import connector_engine
        except ImportError:
            return Response({"error": "Connector engine not available"}, status=500)

        generated = 0
        with transaction.atomic():
            for product in products:
                result = connector_engine.route_write(
                    target_module='finance',
                    endpoint='generate_barcode',
                    data={'organization_id': organization.id},
                    organization_id=organization.id,
                    source_module='inventory',
                )
                barcode = None
                if result and result.data and isinstance(result.data, dict):
                    barcode = result.data.get('barcode')
                if barcode:
                    product.barcode = barcode
                    product.save(update_fields=['barcode'])
                    generated += 1

        return Response({"success": True, "generated": generated})

