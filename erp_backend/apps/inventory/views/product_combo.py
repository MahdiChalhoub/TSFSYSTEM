import uuid
import json
from decimal import Decimal

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
    ProductPackaging,
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
from apps.inventory.services.product_completeness import ProductCompletenessService


def _generate_sku(organization, category_code, brand_code, index):
    """Generate a smart SKU like CAT-BRD-0001"""
    prefix = f"{(category_code or 'GEN')[:3].upper()}-{(brand_code or 'XX')[:3].upper()}"
    # Find the next available sequence
    existing = Product.objects.filter(
        organization=organization,
        sku__startswith=prefix
    ).count()
    seq = existing + index + 1
    return f"{prefix}-{seq:04d}"


def _generate_barcode(organization, category, brand, index):
    """Generate a smart internal barcode: CountryCode + BrandCode + CategorySeq"""
    brand_code = (brand.short_name or brand.name[:3]).upper() if brand else 'XXX'
    cat_code = (category.code or category.short_name or category.name[:3]).upper() if category else 'GEN'

    # Increment the category barcode sequence
    if category:
        category.barcode_sequence += 1
        category.save(update_fields=['barcode_sequence'])
        seq = category.barcode_sequence
    else:
        seq = Product.objects.filter(organization=organization).count() + index + 1

    return f"INT{brand_code}{cat_code}{seq:06d}"


class ProductComboMixin:

    @action(detail=False, methods=['post'])
    def create_complex(self, request):
        """
        Advanced product creation endpoint.
        Handles:
          - Single product creation (legacy behavior)
          - Mass variation creation (multiple products from comma-separated names)
          - Packaging hierarchy creation (ProductPackaging levels)
          - Supplier linking (ProductSupplier)
        """
        organization, err = _get_org_or_400()
        if err:
            return err

        data = request.data

        # ── Reset any poisoned DB connection before starting ──
        from django.db import connection
        if connection.needs_rollback:
            connection.cursor()  # Force connection reset
            try:
                connection.ensure_connection()
            except Exception:
                pass

        try:
            with transaction.atomic():
                # --- 1. Resolve Category, Brand, Country ---
                category_id = data.get('categoryId')
                brand_id = data.get('brandId')
                country_id = data.get('countryId')
                unit_id = data.get('unitId')
                product_type = data.get('productType', 'STANDARD')

                category = Category.objects.filter(id=category_id, organization=organization).first() if category_id else None
                brand = Brand.objects.filter(id=brand_id, organization=organization).first() if brand_id else None

                # --- 2. Resolve Parfum/Flavor & ProductGroup ---
                parfum_id = None
                product_group_id = data.get('productGroupId') or None

                # Parse variations from the JSON payload
                variations_raw = data.get('variations', [])
                if isinstance(variations_raw, str):
                    try:
                        variations_raw = json.loads(variations_raw)
                    except (json.JSONDecodeError, TypeError):
                        variations_raw = []

                # Fallback: legacy parfumName field
                parfum_name = data.get('parfumName', '')
                if not parfum_name and variations_raw:
                    parfum_name = variations_raw[0].get('name', '') if variations_raw else ''

                if parfum_name and parfum_name.strip() and brand_id:
                    try:
                        parfum, _ = Parfum.objects.update_or_create(
                            organization=organization,
                            name=parfum_name.strip(),
                            defaults={}
                        )
                        parfum_id = parfum.id
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).warning(f'Parfum create failed: {e}')

                    if parfum_id and not product_group_id:
                        group = ProductGroup.objects.filter(
                            organization=organization,
                            brand_id=brand_id,
                            parfum_id=parfum_id
                        ).first()

                        if not group:
                            group_name = f"{brand.name} {parfum_name}".strip() if brand else parfum_name
                            group = ProductGroup.objects.create(
                                organization=organization,
                                name=group_name,
                                brand_id=brand_id,
                                parfum_id=parfum_id,
                                category_id=category_id,
                                description=f"Auto-generated group via advanced form"
                            )
                        product_group_id = group.id

                # --- 3. Compute Pricing ---
                cost_price = Decimal(str(data.get('costPrice', 0) or 0))
                sell_price = Decimal(str(data.get('basePrice', 0) or 0))
                tax_rate = Decimal(str(data.get('taxRate', 0) or 0))
                is_tax_included = data.get('isTaxIncluded', True)

                tax_multiplier = 1 + tax_rate
                if is_tax_included:
                    cost_ht = cost_price / tax_multiplier if tax_multiplier else cost_price
                    cost_ttc = cost_price
                    sell_ht = sell_price / tax_multiplier if tax_multiplier else sell_price
                    sell_ttc = sell_price
                else:
                    cost_ht = cost_price
                    cost_ttc = cost_price * tax_multiplier
                    sell_ht = sell_price
                    sell_ttc = sell_price * tax_multiplier

                # --- 4. Common product fields ---
                base_product_name = data.get('name', '')
                base_name = data.get('baseName', '')
                attribute_value_ids = data.get('attributeValueIds', [])
                base_description = data.get('description', '')
                size_val = data.get('size')
                size_unit_id = data.get('sizeUnitId')
                min_stock = data.get('minStockLevel', 10)
                is_expiry_tracked = bool(data.get('isExpiryTracked', False))
                is_for_sale = bool(data.get('isForSale', True))
                is_serialized = bool(data.get('isSerialized', False))

                # Map frontend product types to backend choices
                type_map = {
                    'SINGLE': 'STANDARD',
                    'COMBO': 'COMBO',
                    'SERVICE': 'SERVICE',
                    'CONSUMABLE': 'STANDARD',
                    'FINAL_PRODUCT': 'STANDARD',
                    'RAW_MATERIAL': 'STANDARD',
                }
                db_product_type = type_map.get(product_type, 'STANDARD')

                # --- 5. Create Products (Single or Mass Variations) ---
                created_products = []

                if not variations_raw or len(variations_raw) == 0:
                    # --- Single Product ---
                    sku = data.get('sku') or _generate_sku(organization, category.code if category else None, brand.short_name if brand else None, 0)
                    barcode = data.get('barcode') or _generate_barcode(organization, category, brand, 0)

                    # Check uniqueness
                    if Product.objects.filter(organization=organization, sku=sku).exists():
                        return Response({"error": f"SKU '{sku}' already exists"}, status=status.HTTP_400_BAD_REQUEST)

                    product = Product.objects.create(
                        organization=organization,
                        name=base_product_name,
                        base_name=base_name,
                        description=base_description,
                        sku=sku,
                        barcode=barcode,
                        product_type=db_product_type,
                        category=category,
                        brand=brand,
                        unit_id=unit_id or None,
                        country_id=country_id or None,
                        parfum_id=parfum_id,
                        product_group_id=product_group_id,
                        size=size_val or None,
                        size_unit_id=size_unit_id or None,
                        cost_price=cost_ht,
                        cost_price_ht=cost_ht,
                        cost_price_ttc=cost_ttc,
                        selling_price_ht=sell_ht,
                        selling_price_ttc=sell_ttc,
                        tva_rate=tax_rate,
                        min_stock_level=min_stock,
                        is_expiry_tracked=is_expiry_tracked,
                        tracks_serials=is_serialized,
                        status='ACTIVE',
                    )
                    
                    if attribute_value_ids:
                        # Phase 4 — go through the helper so the m2m_changed
                        # pre_add scope guard runs. Bulk path: validate each
                        # value, then commit the whole set in one atomic call.
                        from apps.inventory.services.attribute_scope import assign_attribute_value
                        from apps.inventory.models import ProductAttribute
                        for vid in attribute_value_ids:
                            try:
                                value = ProductAttribute.objects.get(id=vid)
                            except ProductAttribute.DoesNotExist:
                                continue
                            assign_attribute_value(product, value)
                        # Re-sync name once from attributes if rules suggest it
                        product.name = product.compute_display_name()
                        product.save(update_fields=['name'])

                    created_products.append(product)
                else:
                    # --- Mass Variation Creation ---
                    for idx, variation in enumerate(variations_raw):
                        v_name = variation.get('name', f'Variant {idx + 1}')
                        v_barcode = variation.get('barcode', '').strip()
                        v_sku = variation.get('sku', '').strip()
                        v_attr_ids = variation.get('attributeValueIds', attribute_value_ids)

                        # Generate if not provided by manufacturer
                        if not v_sku:
                            v_sku = _generate_sku(
                                organization,
                                category.code if category else None,
                                brand.short_name if brand else None,
                                idx
                            )
                        if not v_barcode:
                            v_barcode = _generate_barcode(organization, category, brand, idx)

                        # Ensure the parfum for this variation exists
                        var_parfum_id = parfum_id
                        if v_name and brand_id:
                            try:
                                var_parfum, _ = Parfum.objects.update_or_create(
                                    organization=organization,
                                    name=v_name,
                                    defaults={}
                                )
                                var_parfum_id = var_parfum.id
                            except Exception:
                                pass

                        # Full name resolution: use v2 compute if attributes are specific to variation,
                        # else fallback to string replace (legacy)
                        full_name = v_name
                        
                        # Check SKU uniqueness
                        if Product.objects.filter(organization=organization, sku=v_sku).exists():
                            return Response(
                                {"error": f"SKU '{v_sku}' already exists (for variation '{v_name}')"},
                                status=status.HTTP_400_BAD_REQUEST
                            )

                        product = Product.objects.create(
                            organization=organization,
                            name=full_name,
                            base_name=base_name,
                            description=base_description,
                            sku=v_sku,
                            barcode=v_barcode,
                            product_type=db_product_type,
                            category=category,
                            brand=brand,
                            unit_id=unit_id or None,
                            country_id=country_id or None,
                            parfum_id=var_parfum_id,
                            product_group_id=product_group_id,
                            size=size_val or None,
                            size_unit_id=size_unit_id or None,
                            cost_price=cost_ht,
                            cost_price_ht=cost_ht,
                            cost_price_ttc=cost_ttc,
                            selling_price_ht=sell_ht,
                            selling_price_ttc=sell_ttc,
                            tva_rate=tax_rate,
                            min_stock_level=min_stock,
                            is_expiry_tracked=is_expiry_tracked,
                            tracks_serials=is_serialized,
                            status='ACTIVE',
                        )
                        
                        if v_attr_ids:
                            # Same scope guard as the single-product path above.
                            from apps.inventory.services.attribute_scope import assign_attribute_value
                            from apps.inventory.models import ProductAttribute
                            for vid in v_attr_ids:
                                try:
                                    value = ProductAttribute.objects.get(id=vid)
                                except ProductAttribute.DoesNotExist:
                                    continue
                                assign_attribute_value(product, value)
                            product.name = product.compute_display_name()
                            product.save(update_fields=['name'])
                        
                        created_products.append(product)

                # --- 6. Create Packaging Levels ---
                packaging_raw = data.get('packagingLevels', [])
                if isinstance(packaging_raw, str):
                    try:
                        packaging_raw = json.loads(packaging_raw)
                    except (json.JSONDecodeError, TypeError):
                        packaging_raw = []

                if packaging_raw:
                    for product in created_products:
                        for level_idx, pkg in enumerate(packaging_raw):
                            pkg_unit_id = pkg.get('unitId')
                            pkg_ratio = Decimal(str(pkg.get('ratio', 1) or 1))
                            pkg_barcode = pkg.get('barcode', '').strip() or None
                            pkg_price = pkg.get('price')
                            pkg_price = Decimal(str(pkg_price)) if pkg_price else None

                            if pkg_unit_id:  # Only create if a unit was selected
                                ProductPackaging.objects.create(
                                    organization=organization,
                                    product=product,
                                    unit_id=pkg_unit_id,
                                    level=level_idx + 1,
                                    ratio=pkg_ratio,
                                    barcode=pkg_barcode,
                                    custom_selling_price=pkg_price if pkg_price and pkg_price > 0 else None,
                                )

                # --- 7. Link Supplier ---
                supplier_id = data.get('supplierId')
                if supplier_id:
                    from erp.connector_registry import connector as _conn
                    Contact = _conn.require('crm.contacts.get_model', org_id=organization.id, source='inventory.product_combo')
                    if Contact:
                        try:
                            supplier = Contact.objects.get(id=supplier_id, organization=organization)
                            supplier_sku = data.get('supplierSku', '')
                            supplier_price = data.get('supplierPrice')
                            supplier_lt = data.get('supplierLeadTime')

                            # Import the ProductSupplier model
                            from django.apps import apps
                            try:
                                ProductSupplier = apps.get_model('pos', 'ProductSupplier')
                            except LookupError:
                                ProductSupplier = None
                            
                            if ProductSupplier:
                                for product in created_products:
                                    ProductSupplier.objects.update_or_create(
                                        organization=organization,
                                        product=product,
                                        supplier=supplier,
                                        defaults={
                                            'supplier_sku': supplier_sku or '',
                                            'last_purchased_price': Decimal(str(supplier_price)) if supplier_price else None,
                                            'lead_time_days': int(supplier_lt) if supplier_lt else None,
                                            'is_preferred': True,
                                            'is_active': True,
                                        }
                                    )
                        except Exception:
                            pass  # Supplier linking is non-critical, don't fail the whole creation

                # --- 8. Compute completeness + structured response ---
                section_results = {'core': {'ok': True}}

                for p in created_products:
                    ProductCompletenessService.refresh(p, save=True)

                primary = created_products[0]
                missing = ProductCompletenessService.get_missing(primary)

                if len(created_products) == 1:
                    return Response({
                        'product': ProductSerializer(primary).data,
                        'sections': section_results,
                        'completeness': {
                            'level': primary.data_completeness_level,
                            'label': primary.completeness_label,
                            'missing': missing,
                        },
                        'warnings': missing,
                    }, status=status.HTTP_201_CREATED)
                else:
                    return Response({
                        'products': ProductSerializer(created_products, many=True).data,
                        'count': len(created_products),
                        'sections': section_results,
                        'completeness': {
                            'level': primary.data_completeness_level,
                            'label': primary.completeness_label,
                            'missing': missing,
                        },
                        'warnings': missing,
                    }, status=status.HTTP_201_CREATED)

        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            import logging
            logging.getLogger(__name__).error(f'create_complex failed: {tb}')
            return Response({"error": str(e), "traceback": tb}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=False, methods=['post'])
    def create_quick(self, request):
        """
        Quick product creation for cashiers/reception.
        Accepts minimal fields: name, barcode, selling_price (optional).
        Creates a product at L0 (DRAFT) or L2 (PRICED) level.
        """
        organization, err = _get_org_or_400()
        if err:
            return err

        data = request.data
        name = (data.get('name') or '').strip()
        barcode = (data.get('barcode') or '').strip()
        selling_price = Decimal(str(data.get('selling_price') or data.get('basePrice') or 0))

        if not name:
            return Response({"error": "Product name is required"}, status=status.HTTP_400_BAD_REQUEST)

        # ── Reset any poisoned DB connection ──
        from django.db import connection
        if connection.needs_rollback:
            try:
                connection.ensure_connection()
            except Exception:
                pass

        try:
            # Auto-generate SKU
            sku = data.get('sku') or f"QCK-{uuid.uuid4().hex[:8].upper()}"

            # Check uniqueness
            if Product.objects.filter(organization=organization, sku=sku).exists():
                sku = f"QCK-{uuid.uuid4().hex[:8].upper()}"

            if barcode and Product.objects.filter(organization=organization, barcode=barcode).exists():
                return Response({"error": f"Barcode '{barcode}' already exists"}, status=status.HTTP_400_BAD_REQUEST)

            product = Product.objects.create(
                organization=organization,
                name=name,
                sku=sku,
                barcode=barcode or None,
                selling_price_ttc=selling_price,
                selling_price_ht=selling_price / Decimal('1.18') if selling_price > 0 else Decimal('0'),
                status='ACTIVE',
            )

            # Compute completeness via service
            ProductCompletenessService.refresh(product, save=True)
            missing = ProductCompletenessService.get_missing(product)

            return Response({
                'product': ProductSerializer(product).data,
                'completeness': {
                    'level': product.data_completeness_level,
                    'label': product.completeness_label,
                    'missing': missing,
                },
                'is_sellable': product.is_sellable,
                'warnings': missing,
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            import logging
            logging.getLogger(__name__).error(f'create_quick failed: {tb}')
            return Response({"error": str(e), "traceback": tb}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['get'], url_path='combo-components')
    def combo_components(self, request, pk=None):
        """List all components of a combo/bundle product."""
        product = self.get_object()
        components = ComboComponent.objects.filter(
            combo_product=product
        ).select_related('component_product').order_by('sort_order')
        serializer = ComboComponentSerializer(components, many=True)
        return Response(serializer.data)


    @action(detail=True, methods=['post'], url_path='add-component')
    def add_combo_component(self, request, pk=None):
        """Add a component to a combo/bundle product."""
        product = self.get_object()
        if product.product_type != 'COMBO':
            return Response({'error': 'Product is not a combo/bundle'}, status=400)

        component_id = request.data.get('component_product_id')
        quantity = request.data.get('quantity', 1)
        price_override = request.data.get('price_override')
        sort_order = request.data.get('sort_order', 0)

        if not component_id:
            return Response({'error': 'component_product_id is required'}, status=400)
        if str(component_id) == str(product.id):
            return Response({'error': 'Cannot add product as its own component'}, status=400)

        try:
            component_product = Product.objects.get(
                id=component_id, organization=product.organization
            )
        except Product.DoesNotExist:
            return Response({'error': 'Component product not found'}, status=404)

        comp, created = ComboComponent.objects.update_or_create(
            combo_product=product,
            component_product=component_product,
            organization=product.organization,
            defaults={
                'quantity': quantity,
                'price_override': price_override,
                'sort_order': sort_order,
            }
        )
        return Response(
            ComboComponentSerializer(comp).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


    @action(detail=True, methods=['delete'], url_path='remove-component/(?P<component_id>[^/.]+)')
    def remove_combo_component(self, request, pk=None, component_id=None):
        """Remove a component from a combo/bundle product."""
        product = self.get_object()
        deleted, _ = ComboComponent.objects.filter(
            combo_product=product, id=component_id
        ).delete()
        if deleted:
            return Response({'success': True})
        return Response({'error': 'Component not found'}, status=404)
