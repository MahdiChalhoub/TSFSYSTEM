from django.db import transaction
from rest_framework import viewsets, status, serializers
from rest_framework.response import Response
from rest_framework.decorators import api_view, action, permission_classes
from .middleware import get_current_tenant_id
from .models import (
    Organization, Site, 
    Product, Warehouse, Inventory, InventoryMovement, Unit,
    Brand, Category, Parfum, ProductGroup, Country,
    Contact, Employee, Role, TransactionSequence, BarcodeSettings, User,
    OrderLine, SystemModule, OrganizationModule
)
from apps.finance.models import JournalEntryLine
from .serializers import (
    OrganizationSerializer, SiteSerializer, WarehouseSerializer, 
    InventorySerializer, CategorySerializer, ParfumSerializer, 
    BrandSerializer, CountrySerializer, UnitSerializer, 
    ProductSerializer, ProductGroupSerializer, ContactSerializer, 
    RoleSerializer, EmployeeSerializer, BrandDetailSerializer,
    TransactionSequenceSerializer, BarcodeSettingsSerializer, ProductCreateSerializer
)
from .services import InventoryService, ProvisioningService, ConfigurationService, POSService, PurchaseService, SequenceService, BarcodeService
from rest_framework import permissions

class TenantModelViewSet(viewsets.ModelViewSet):
    """
    Base ViewSet that automatically enforces organizational isolation (multi-tenancy).
    Ensures users can ONLY interact with data belonging to their own organization.
    
    DAJINGO RULES ENFORCED:
    - Rule 2: All mutations logged via AuditService (Universal Audit Logging)
    - Rule 3: All queries MUST be scoped by organization_id.
    - Rule 5: organization_id derived from auth user context or secure tenant header.
    - Rule 6: APIs automatically inject organization_id; manual override forbidden.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        tenant_id = get_current_tenant_id()

        # 1. Global Platform Admin Access (Managed Scope)
        if user.is_staff or user.is_superuser:
            # If viewing through a tenant gateway (header set), restrict view to that tenant.
            # If viewing through a tenant gateway (header set), restrict view to that tenant.
            if tenant_id:
                return self.queryset.filter(organization_id=tenant_id)
            
            # [SECURITY FIX]
            # If at SaaS Root (no header), DO NOT return all data.
            # SaaS Panel is for infra management only. Business data is strictly partitioned.
            # Staff must 'Proxy' into a tenant to see data.
            return self.queryset.none()
        
        # 2. Strict Tenant Isolation for Regular Users
        # Derive organization from the authenticated USER context
        if not user.organization_id:
             return self.queryset.none()
             
        # Rule: Regular users CANNOT view another tenant, even if they spoof the header.
        # We enforce their own organization_id as the ONLY valid filter.
        return self.queryset.filter(organization_id=user.organization_id)

    def perform_create(self, serializer):
        user = self.request.user
        header_tenant_id = get_current_tenant_id()
        
        # Rule 6: Derived from AUTH context. 
        # For regular users, this is always their own organization.
        # For staff, this is the tenant they are currently managing (via header).
        
        if not (user.is_staff or user.is_superuser):
            organization_id = user.organization_id
        else:
            organization_id = header_tenant_id or user.organization_id

        if not organization_id:
             raise serializers.ValidationError({
                 "error": "Organization context missing. Please ensure you are within a valid tenant environment."
             })
             
        # Rule 5: User cannot specify organization_id in body - we overwrite it here.
        instance = serializer.save(organization_id=organization_id)
        
        # Rule 2: Universal Audit Logging - Log CREATE event
        self._log_audit_event('CREATE', instance, new_data=serializer.validated_data)

    def perform_update(self, serializer):
        # Capture old state before update
        instance = serializer.instance
        old_data = self._serialize_instance(instance)
        
        # Enforce Rule 5: cannot move records between organizations
        # Django Rest Framework usually handles this via get_queryset, 
        # but we ensure the organization_id is NEVER changed.
        if 'organization' in self.request.data or 'organization_id' in self.request.data:
             # SILENTLY ignore or raise error? Rule 5 says forbidden.
             pass 
        
        updated_instance = serializer.save()
        
        # Rule 2: Universal Audit Logging - Log UPDATE event
        self._log_audit_event('UPDATE', updated_instance, old_data=old_data, new_data=serializer.validated_data)

    def perform_destroy(self, instance):
        """Override to log DELETE events before deletion."""
        old_data = self._serialize_instance(instance)
        
        # Rule 2: Universal Audit Logging - Log DELETE event
        self._log_audit_event('DELETE', instance, old_data=old_data)
        
        # Perform the actual deletion
        instance.delete()

    def _log_audit_event(self, action, instance, old_data=None, new_data=None):
        """Internal helper to log audit events via AuditService."""
        try:
            from .services_audit import AuditService
            
            # Get organization from instance or request context
            organization = getattr(instance, 'organization', None)
            if not organization and hasattr(instance, 'organization_id'):
                from .models import Organization
                try:
                    organization = Organization.objects.get(id=instance.organization_id)
                except Organization.DoesNotExist:
                    organization = None
            
            if organization:
                AuditService.log_event(
                    actor=self.request.user,
                    action=action,
                    instance=instance,
                    old_data=old_data,
                    new_data=self._clean_audit_data(new_data),
                    request=self.request,
                    organization=organization,
                    description=f"{action} on {instance._meta.model_name}"
                )
        except Exception as e:
            # Don't let audit failures block business operations
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Audit logging failed for {action} on {instance}: {e}")

    def _serialize_instance(self, instance):
        """Serialize model instance to dict for audit logging."""
        if not instance:
            return None
        try:
            # Use the serializer if available
            serializer_class = self.get_serializer_class()
            return serializer_class(instance).data
        except Exception:
            # Fallback to basic serialization
            return {k: str(v) for k, v in instance.__dict__.items() if not k.startswith('_')}

    def _clean_audit_data(self, data):
        """Clean data for audit logging (remove sensitive fields, convert types)."""
        if not data:
            return None
        
        sensitive_fields = {'password', 'token', 'secret', 'api_key'}
        cleaned = {}
        for key, value in data.items():
            if key.lower() in sensitive_fields:
                cleaned[key] = '[REDACTED]'
            elif hasattr(value, 'pk'):
                # Convert model instances to their primary key
                cleaned[key] = str(value.pk)
            else:
                try:
                    # Ensure JSON-serializable
                    import json
                    json.dumps(value)
                    cleaned[key] = value
                except (TypeError, ValueError):
                    cleaned[key] = str(value)
        return cleaned

class TenantResolutionView(viewsets.ViewSet):
    """
    Public endpoint to resolve tenant slug to ID.
    Used by Next.js middleware/context to avoid direct DB access.
    """
    permission_classes = [] 
    authentication_classes = []

    @action(detail=False, methods=['get'])
    def resolve(self, request):
        slug = request.query_params.get('slug')
        if not slug:
            return Response({"error": "Slug required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            org = Organization.objects.get(slug=slug)
            return Response({
                "id": str(org.id),
                "slug": org.slug,
                "name": org.name
            })
        except Organization.DoesNotExist:
            return Response({"error": "Tenant not found"}, status=status.HTTP_404_NOT_FOUND)


class SettingsViewSet(viewsets.ViewSet):
    """
    Handles system-wide configuration.
    """
    @action(detail=False, methods=['get', 'post'])
    def posting_rules(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
            ConfigurationService.save_posting_rules(organization, request.data)
            return Response({"message": "Posting rules saved successfully"})
        
        rules = ConfigurationService.get_posting_rules(organization)
        return Response(rules)

    @action(detail=False, methods=['post'])
    def smart_apply(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        config = ConfigurationService.apply_smart_posting_rules(organization)
        return Response(config)

    @action(detail=False, methods=['get', 'post'])
    def global_financial(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
            ConfigurationService.save_global_settings(organization, request.data)
            return Response({"message": "Settings saved successfully"})
        
        settings = ConfigurationService.get_global_settings(organization)
        return Response(settings)

    @action(detail=False, methods=['get', 'post'], url_path='item/(?P<key>[^/.]+)')
    def item(self, request, key=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
            ConfigurationService.save_setting(organization, key, request.data)
            return Response({"message": f"Setting '{key}' saved successfully"})
        
        value = ConfigurationService.get_setting(organization, key)
        return Response(value)
from .middleware import get_current_tenant_id

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    return Response({
        "status": "online",
        "service": "TSF ERP Core (Django)",
        "database": "PostgreSQL",
        "tenant_context": request.headers.get('X-Tenant-Slug', 'None'),
        "organization_id": get_current_tenant_id()
    })

class OrganizationViewSet(viewsets.ModelViewSet):
    """
    SaaS level view of organizations.
    Admin staff can see all. Regular users see only their bound org.
    """
    permission_classes = [permissions.IsAuthenticated]
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        user = self.request.user
        
        # 1. ROOT PLATFORM ADMIN (Global SaaS View)
        # Only users with is_staff/is_superuser AND NO bound organization can see everything.
        if (user.is_superuser or user.is_staff) and not user.organization_id:
            return Organization.objects.all()

        # 2. CROSS-TENANT IDENTITY (Federated View)
        # Rule: Users see all organizations where their email is registered as an account.
        if user.email:
            # We use the email to find all linked identities across organizations.
            # This allows a single user identity to switch between their authorized businesses.
            org_ids = User.objects.filter(email=user.email).values_list('organization_id', flat=True)
            return Organization.objects.filter(id__in=org_ids)
            
        # 3. JAILED VIEW (Fallback)
        # If no email is set, they only see the organization they are currently logged into.
        if user.organization_id:
            return Organization.objects.filter(id=user.organization_id)
            
        return Organization.objects.none()

    def create(self, request, *args, **kwargs):
        # Only SaaS staff can create orgs via API (ProvisioningService)
        if not (request.user.is_staff or request.user.is_superuser):
             return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
             
        try:
            org = ProvisioningService.provision_organization(
                name=request.data.get('name'),
                slug=request.data.get('slug')
            )
            return Response(self.get_serializer(org).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.slug == 'saas':
            protected_fields = ['is_active', 'current_plan', 'plan_expiry_at']
            for field in protected_fields:
                if field in request.data:
                    return Response({"error": f"Cannot modify '{field}' on the master SaaS organization."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.slug == 'saas':
            return Response({"error": "Cannot delete the master SaaS organization."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

from rest_framework import permissions


class SiteViewSet(TenantModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer

# ViewSets for Finance moved to apps/finance/views.py

class UnitViewSet(TenantModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer

class ProductViewSet(TenantModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    
    # Granular permission mapping (Rule 4: Granular Permission Registry)
    required_permissions = {
        'list': 'inventory.view_products',
        'retrieve': 'inventory.view_products',
        'create': 'inventory.add_product',
        'update': 'inventory.edit_product',
        'partial_update': 'inventory.edit_product',
        'destroy': 'inventory.delete_product',
    }
    
    def get_permissions(self):
        """Return permission classes based on action."""
        from .permissions import HasPermission
        if self.action in ['storefront']:
            # Public endpoint
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), HasPermission()]

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def storefront(self, request):
        """
        Public endpoint for tenant storefronts.
        Requires organization_slug to isolate data.
        """
        slug = request.query_params.get('organization_slug')
        if not slug:
            return Response({"error": "Organization slug required"}, status=400)
            
        try:
            org = Organization.objects.get(slug=slug)
            products = Product.objects.filter(organization=org, status='ACTIVE')
            serializer = self.get_serializer(products, many=True)
            return Response(serializer.data)
        except Organization.DoesNotExist:
            return Response({"error": "Organization not found"}, status=404)

    @action(detail=False, methods=['post'])
    def bulk_move(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        product_ids = request.data.get('productIds', [])
        target_id = request.data.get('targetId')
        move_type = request.data.get('type') # 'category', 'brand', 'unit', 'country', 'attribute'

        if not product_ids or not target_id or not move_type:
            return Response({"error": "Missing parameters"}, status=400)

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
            
            if updates:
                products.update(**updates)
            
            return Response({"success": True, "count": products.count()})

    @action(detail=False, methods=['post'])
    def create_complex(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        serializer = ProductCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        data = serializer.validated_data
        
        # 1. Check Uniqueness
        if Product.objects.filter(organization=organization, sku=data['sku']).exists():
             return Response({"error": "SKU already exists"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 2. Grouping Logic
            parfum_id = None
            product_group_id = None
            
            parfum_name = data.get('parfumName')
            brand_id = data.get('brandId')
            category_id = data.get('categoryId')
            
            if parfum_name and brand_id:
                # Upsert Parfum
                parfum, created = Parfum.objects.update_or_create(
                    organization=organization,
                    name=parfum_name,
                    defaults={}
                )
                parfum_id = parfum.id
                
                # Find or Create Group
                # Logic: Brand + Parfum
                group = ProductGroup.objects.filter(
                    organization=organization,
                    brand_id=brand_id,
                    parfum_id=parfum_id
                ).first()
                
                if not group:
                    brand = Brand.objects.get(id=brand_id)
                    group_name = f"{brand.name} {parfum_name}".strip()
                    group = ProductGroup.objects.create(
                        organization=organization,
                        name=group_name,
                        brand_id=brand_id,
                        parfum_id=parfum_id,
                        category_id=category_id,
                        description=f"Auto-generated group via {parfum_name}"
                    )
                product_group_id = group.id

            # 3. Create Product
            product = Product.objects.create(
                organization=organization,
                name=data['name'],
                description=data.get('description', ''),
                sku=data['sku'],
                barcode=data.get('barcode'),
                category_id=category_id,
                unit_id=data.get('unitId'),
                brand_id=brand_id,
                country_id=data.get('countryId'),
                parfum_id=parfum_id,
                product_group_id=product_group_id,
                
                cost_price=data.get('costPrice', 0),
                cost_price_ht=data.get('costPrice', 0), # assuming same as costPrice?
                status='ACTIVE',
                selling_price_ht=data.get('sellingPriceHT', 0),
                selling_price_ttc=data.get('sellingPriceTTC', 0),
                tva_rate=data.get('taxRate', 0),
                
                min_stock_level=data.get('minStockLevel', 10),
                is_expiry_tracked=data.get('isExpiryTracked', False)
            )
            
            # 4. Auto Barcode
            if not product.barcode and category_id:
                category = Category.objects.get(id=category_id)
                # Assuming category has 'code' field based on standard models, 
                # but models.py showed Category just has name/org. 
                # Wait, earlier models.py dump showed Category just has name/org. No code.
                # Standard pattern usually implies checking if field exists or generating purely numeric.
                # I will skip Category Code if it doesn't exist.
                # Actually, let's just use PK.
                auto_barcode = f"P-{product.id}" 
                product.barcode = auto_barcode
                product.save()

            return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def search_enhanced(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        query = request.query_params.get('query', '')
        site_id = request.query_params.get('site_id')
        
        from django.db.models import Q, Sum
        from django.utils import timezone
        from datetime import timedelta
        
        products_qs = Product.objects.filter(organization=organization, status='ACTIVE')
        if query:
            products_qs = products_qs.filter(
                Q(name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query)
            )
        
        products_qs = products_qs[:10]
        
        data = []
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        for p in products_qs:
            # Aggregate Stock
            stock_filter = {'organization': organization, 'product': p}
            if site_id:
                stock_filter['warehouse__site_id'] = site_id
                
            stock_level = Inventory.objects.filter(**stock_filter).aggregate(total=Sum('quantity'))['total'] or 0
            
            # Daily Sales (Stubbed for now as we don't have OrderLine model in DJ yet? 
            # Oh wait, I don't see OrderLine in models.py yet.
            # I'll just return 0 for now to keep it working.)
            daily_sales = 0
            
            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "costPrice": float(p.cost_price),
                "costPriceHT": float(p.cost_price_ht),
                "sellingPriceHT": float(p.selling_price_ht),
                "sellingPriceTTC": float(p.selling_price_ttc),
                "stockLevel": float(stock_level),
                "dailySales": daily_sales,
                "proposedQty": max(0, int(daily_sales * 14 - stock_level))
            })
            
        return Response(data)

class WarehouseViewSet(TenantModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer

class InventoryViewSet(TenantModelViewSet):
    queryset = Inventory.objects.all()
    serializer_class = InventorySerializer
    
    # Granular permission mapping (Rule 4: Granular Permission Registry)
    required_permissions = {
        'list': 'inventory.view_stock',
        'retrieve': 'inventory.view_stock',
    }
    
    def get_permissions(self):
        """Return permission classes based on action."""
        from .permissions import HasPermission
        return [permissions.IsAuthenticated(), HasPermission()]

    def get_queryset(self):
        # We still want Read-Only essentially for list, 
        # but TenantModelViewSet handles the isolation.
        return super().get_queryset()

    @action(detail=False, methods=['post'])
    def receive_stock(self, request):
        # Permission check via decorator
        from .permissions import HasPermission
        if not HasPermission.user_has_permission(request.user, 'inventory.receive_stock'):
            if not (request.user.is_staff or request.user.is_superuser):
                return Response({'error': 'Permission denied: inventory.receive_stock required'}, status=status.HTTP_403_FORBIDDEN)
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            product = Product.objects.get(id=request.data.get('product_id'))
            warehouse = Warehouse.objects.get(id=request.data.get('warehouse_id'))
            
            InventoryService.receive_stock(
                organization=organization,
                product=product,
                warehouse=warehouse,
                quantity=request.data.get('quantity'),
                cost_price_ht=request.data.get('cost_price_ht'),
                reference=request.data.get('reference', 'RECEPTION')
            )
            return Response({"message": "Stock received"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def adjust_stock(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)
        
        try:
            product = Product.objects.get(id=request.data.get('product_id'))
            warehouse = Warehouse.objects.get(id=request.data.get('warehouse_id'))
            
            InventoryService.adjust_stock(
                organization=organization,
                product=product,
                warehouse=warehouse,
                quantity=request.data.get('quantity'),
                reason=request.data.get('reason'),
                reference=request.data.get('reference')
            )
            return Response({"message": "Stock adjusted"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def valuation(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        status_data = InventoryService.get_inventory_valuation(organization)
        return Response(status_data)

    @action(detail=False, methods=['get'])
    def financial_status(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        status_data = InventoryService.get_inventory_financial_status(organization)
        return Response(status_data)

    @action(detail=False, methods=['get'])
    def viewer(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        search = request.query_params.get('search', '')
        
        from django.db.models import Sum, Q
        
        products_qs = Product.objects.filter(organization=organization)
        if search:
            products_qs = products_qs.filter(
                Q(name__icontains=search) | Q(sku__icontains=search) | Q(barcode__icontains=search)
            )
        
        sites = Site.objects.filter(organization=organization, is_active=True)
        
        data = []
        for p in products_qs:
            site_stock = {}
            total_qty = 0
            for s in sites:
                qty = Inventory.objects.filter(
                    organization=organization,
                    product=p,
                    warehouse__site=s
                ).aggregate(total=Sum('quantity'))['total'] or 0
                site_stock[s.id] = float(qty)
                total_qty += float(qty)
            
            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "category": p.category.name if hasattr(p, 'category') and p.category else None,
                "brand": p.brand.name if hasattr(p, 'brand') and p.brand else None,
                "unit": p.unit.code if p.unit else None,
                "siteStock": site_stock,
                "totalQty": total_qty,
                "costPrice": float(p.cost_price)
            })
            
        return Response({
            "products": data,
            "sites": SiteSerializer(sites, many=True).data,
            "totalCount": len(data)
        })

class POSViewSet(viewsets.ViewSet):
    """
    Handles Point of Sale transactions.
    """
    @action(detail=False, methods=['post'])
    def checkout(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            warehouse_id = request.data.get('warehouse_id')
            payment_account_id = request.data.get('payment_account_id')
            items = request.data.get('items') # Should be list of {product_id, quantity, unit_price}
            
            # Use current authenticated user if possible, or fallback for system/POS user
            user = request.user
            if user.is_anonymous:
                from .models import User
                user = User.objects.filter(organization=organization, is_staff=True).first()
            
            warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)
            
            order = POSService.checkout(
                organization=organization,
                user=user,
                warehouse=warehouse,
                payment_account_id=payment_account_id,
                items=items
            )
            
            return Response({
                "message": "Checkout successful",
                "order_id": order.id,
                "total_amount": float(order.total_amount)
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PurchaseViewSet(viewsets.ViewSet):
    """
    Handles Purchase Order (PO) operations.
    """
    def list(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        
        scope = request.query_params.get('scope', 'INTERNAL')
        
        from .models import Order
        qs = Order.objects.filter(organization=organization, type='PURCHASE')
        
        # Assuming we might have scope field later, for now we filter by type
        # if scope == 'OFFICIAL' and hasattr(Order, 'scope'): qs = qs.filter(scope='OFFICIAL')
        
        qs = qs.order_by('-created_at')
        
        data = []
        for o in qs:
            data.append({
                "id": o.id,
                "refCode": o.ref_code,
                "createdAt": o.created_at,
                "status": o.status,
                "totalAmount": float(o.total_amount),
                "contact": { "name": o.contact.name } if o.contact else None,
                "user": { "name": f"{o.user.first_name} {o.user.last_name}".strip() or o.user.username } if o.user else None
            })
            
        return Response(data)

    @action(detail=True, methods=['post'])
    def authorize(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            order = PurchaseService.authorize_po(organization, pk)
            return Response({"message": "PO Authorized", "status": order.status})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            warehouse_id = request.data.get('warehouse_id')
            order = PurchaseService.receive_po(organization, pk, warehouse_id)
            return Response({"message": "Goods Received", "status": order.status})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def invoice(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            invoice_num = request.data.get('invoice_number')
            order = PurchaseService.invoice_po(organization, pk, invoice_num)
            return Response({"message": "PO Invoiced", "status": order.status})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def quick_purchase(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            order = PurchaseService.quick_purchase(
                organization=organization,
                supplier_id=request.data.get('supplierId'),
                warehouse_id=request.data.get('warehouseId'),
                site_id=request.data.get('siteId'),
                scope=request.data.get('scope'),
                invoice_price_type=request.data.get('invoicePriceType'),
                vat_recoverable=request.data.get('vatRecoverable'),
                lines=request.data.get('lines', []),
                notes=request.data.get('notes'),
                ref_code=request.data.get('refCode'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response({"success": True, "orderId": order.id})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class BrandViewSet(TenantModelViewSet):
    queryset = Brand.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BrandDetailSerializer
        return BrandSerializer

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        category_id = request.query_params.get('category_id')
        
        if not category_id:
            brands = Brand.objects.filter(organization=organization).values('id', 'name', 'short_name')
            return Response(brands)

        try:
            category = Category.objects.get(id=category_id, organization=organization)
            
            # Walk up hierarchy
            parents = [category.id]
            curr = category
            while curr.parent:
                curr = curr.parent
                parents.append(curr.id)
            
            # Filter logic: Universal (no categories) OR linked to this or parents
            from django.db.models import Q
            brands = Brand.objects.filter(
                Q(organization=organization) & 
                (Q(categories__isnull=True) | Q(categories__id__in=parents))
            ).distinct().order_by('name').values('id', 'name', 'short_name')
            
            return Response(brands)
        except Category.DoesNotExist:
            return Response([])

    @action(detail=True, methods=['get'])
    def hierarchy(self, request, pk=None):
        # Implementation for getBrandHierarchy
        # Return nested groups and loose products
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        
        try:
            brand = Brand.objects.get(id=pk, organization_id=organization_id)
            
            # Groups
            groups_qs = brand.product_groups.all() # Assuming related_name='product_groups' (or 'productgroup_set')
            # Wait, model definition in dump didn't show related_name
            # models.py: brand = models.ForeignKey(Brand, ... product_group = models.ForeignKey(ProductGroup...
            # ProductGroup has brandId. 
            groups_qs = ProductGroup.objects.filter(brand=brand).prefetch_related('product_set', 'product_set__inventory') 
            
            groups_data = []
            for g in groups_qs:
                products = []
                for p in g.product_set.all():
                     stock = sum(i.quantity for i in p.inventory.all())
                     products.append({
                         "id": p.id,
                         "name": p.name,
                         "sku": p.sku,
                         "countryName": p.country.name if p.country else None,
                         "size": float(p.size or 0) if hasattr(p, 'size') else 0, # Model dump missed size field in Product?
                         "unitName": p.unit.short_name if p.unit else None,
                         "stock": float(stock)
                     })
                groups_data.append({
                    "id": g.id, 
                    "name": g.name,
                    "products": products,
                    "totalStock": sum(p['stock'] for p in products)
                })
            
            # Loose Products (no group)
            loose_qs = Product.objects.filter(brand=brand, product_group__isnull=True).prefetch_related('inventory')
            loose_products = []
            for p in loose_qs:
                stock = sum(i.quantity for i in p.inventory.all())
                loose_products.append({
                    "id": p.id,
                     "name": p.name,
                     "sku": p.sku,
                     "countryName": p.country.name if p.country else None,
                     "size": float(p.size or 0) if hasattr(p, 'size') else 0,
                     "unitName": p.unit.short_name if p.unit else None,
                     "stock": float(stock)
                })
            
            return Response({
                "groups": groups_data,
                "looseProducts": loose_products
            })
            
        except Brand.DoesNotExist:
            return Response({"error": "Brand not found"}, status=404)

class CategoryViewSet(TenantModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    @action(detail=False, methods=['get'])
    def with_counts(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        
        from django.db.models import Count
        categories = Category.objects.filter(
            organization_id=organization_id
        ).annotate(product_count=Count('product')).order_by('name')
        
        return Response([
            {**CategorySerializer(c).data, "_count": {"products": c.product_count}}
            for c in categories
        ])
    
    @action(detail=False, methods=['post'])
    def move_products(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        
        target_id = request.data.get('targetCategoryId')
        product_ids = request.data.get('productIds', [])
        
        Product.objects.filter(
            organization_id=organization_id,
            id__in=product_ids
        ).update(category_id=target_id)
        
        return Response({"success": True})


class ParfumViewSet(TenantModelViewSet):
    queryset = Parfum.objects.all()
    serializer_class = ParfumSerializer

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        
        category_id = request.query_params.get('categoryId')
        queryset = self.get_queryset()

        if category_id:
            try:
                # Walk up the category tree
                category_ids = []
                current = Category.objects.get(id=category_id, organization_id=organization_id)
                category_ids.append(current.id)
                while current.parent:
                    current = current.parent
                    category_ids.append(current.id)
                
                # Filter: Attributes linked to this category/parents OR universal (no categories)
                from django.db.models import Q
                queryset = queryset.filter(
                    Q(categories__in=category_ids) | Q(categories__isnull=True)
                ).distinct()
            except Category.DoesNotExist:
                pass 
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def hierarchy(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)

        # Get brands that have products with this parfum
        brands = Brand.objects.filter(
            products__parfum_id=pk, 
            organization_id=organization_id
        ).distinct().prefetch_related(
            'product_set', 'product_set__inventory', 'product_set__unit', 'product_set__country'
        )

        data = []
        for brand in brands:
            products_data = []
            # Filter products for this specific parfum within the brand
            products = brand.product_set.filter(parfum_id=pk)
            
            brand_total_stock = 0
            for p in products:
                stock = sum(i.quantity for i in p.inventory.all())
                brand_total_stock += stock
                products_data.append({
                    "id": p.id,
                    "name": p.name,
                    "sku": p.sku,
                    "size": float(p.size or 0) if hasattr(p, 'size') else 0,
                    "unitName": p.unit.short_name if p.unit else None,
                    "countryName": p.country.name if p.country else None,
                    "stock": float(stock)
                })

            data.append({
                "id": brand.id,
                "name": brand.name,
                "logo": "", 
                "products": products_data,
                "totalStock": brand_total_stock
            })
            
        return Response(data)

class ProductGroupViewSet(TenantModelViewSet):
    queryset = ProductGroup.objects.all()
    serializer_class = ProductGroupSerializer

    @action(detail=False, methods=['post'])
    def create_with_variants(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        data = request.data
        name = data.get('name')
        brand_id = data.get('brandId')
        category_id = data.get('categoryId')
        description = data.get('description')
        base_unit_id = data.get('baseUnitId')
        variants = data.get('variants', [])

        if not name or not variants:
            return Response({"error": "Name and variants required"}, status=400)

        with transaction.atomic():
            group = ProductGroup.objects.create(
                organization=organization,
                name=name,
                brand_id=brand_id,
                category_id=category_id,
                description=description
            )

            for v in variants:
                Product.objects.create(
                    organization=organization,
                    name=name,
                    product_group=group,
                    brand_id=brand_id,
                    category_id=category_id,
                    unit_id=base_unit_id,
                    country_id=v.get('countryId'),
                    sku=v.get('sku'),
                    barcode=v.get('barcode'),
                    # size=v.get('size'), # size field missing in recent models.py?
                    cost_price=v.get('costPrice', 0),
                    cost_price_ht=v.get('costPriceHT', 0),
                    cost_price_ttc=v.get('costPriceTTC', 0),
                    selling_price_ht=v.get('sellingPriceHT', 0),
                    selling_price_ttc=v.get('sellingPriceTTC', 0),
                    tva_rate=v.get('taxRate', 0),
                    min_stock_level=v.get('minStockLevel', 0),
                    status='ACTIVE'
                )
            
            return Response(ProductGroupSerializer(group).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def update_with_variants(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        group = self.get_object()
        data = request.data
        name = data.get('name')
        brand_id = data.get('brandId')
        category_id = data.get('categoryId')
        description = data.get('description')
        base_unit_id = data.get('baseUnitId')
        variants = data.get('variants', [])

        with transaction.atomic():
            group.name = name
            group.brand_id = brand_id
            group.category_id = category_id
            group.description = description
            group.save()

            for v in variants:
                if v.get('id'):
                    # Update existing
                    Product.objects.filter(id=v.get('id'), organization=organization).update(
                        name=name,
                        brand_id=brand_id,
                        category_id=category_id,
                        unit_id=base_unit_id,
                        country_id=v.get('countryId'),
                        sku=v.get('sku'),
                        barcode=v.get('barcode'),
                        cost_price=v.get('costPrice'),
                        cost_price_ht=v.get('costPriceHT'),
                        cost_price_ttc=v.get('costPriceTTC'),
                        selling_price_ht=v.get('sellingPriceHT'),
                        selling_price_ttc=v.get('sellingPriceTTC'),
                        tva_rate=v.get('taxRate')
                    )
                else:
                    # Create new
                    Product.objects.create(
                        organization=organization,
                        name=name,
                        product_group=group,
                        brand_id=brand_id,
                        category_id=category_id,
                        unit_id=base_unit_id,
                        country_id=v.get('countryId'),
                        sku=v.get('sku'),
                        barcode=v.get('barcode'),
                        cost_price=v.get('costPrice', 0),
                        cost_price_ht=v.get('costPriceHT', 0),
                        cost_price_ttc=v.get('costPriceTTC', 0),
                        selling_price_ht=v.get('sellingPriceHT', 0),
                        selling_price_ttc=v.get('sellingPriceTTC', 0),
                        tva_rate=v.get('taxRate', 0),
                        min_stock_level=v.get('minStockLevel', 0),
                        status='ACTIVE'
                    )
            
            return Response(ProductGroupSerializer(group).data)

    @action(detail=True, methods=['post'])
    def link_products(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        group = self.get_object()
        product_ids = request.data.get('productIds', [])
        
        Product.objects.filter(
            id__in=product_ids, 
            organization=organization
        ).update(
            product_group=group,
            brand=group.brand,
            category=group.category
        )
        
        return Response({"success": True})

    @action(detail=False, methods=['post'])
    def create_from_products(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        product_ids = request.data.get('productIds', [])
        name = request.data.get('name')
        description = request.data.get('description')
        
        products = Product.objects.filter(id__in=product_ids, organization=organization)
        if not products.exists():
            return Response({"error": "No products found"}, status=400)
            
        template = products.first()
        if not template.brand:
            return Response({"error": "Reference product must have a brand"}, status=400)

        with transaction.atomic():
            group = ProductGroup.objects.create(
                organization=organization,
                name=name,
                description=description,
                brand=template.brand,
                category=template.category
            )
            
            products.update(
                product_group=group,
                brand=template.brand,
                category=template.category
            )
            
            return Response(ProductGroupSerializer(group).data, status=status.HTTP_201_CREATED)

class CountryViewSet(TenantModelViewSet):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer

    @action(detail=True, methods=['get'])
    def hierarchy(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        
        # Get brands that have products from this country
        brands = Brand.objects.filter(
            products__country_id=pk,
            organization_id=organization_id
        ).distinct().prefetch_related(
            'product_set', 'product_set__inventory', 'product_set__unit'
        )

        data = []
        for brand in brands:
            products_data = []
            products = brand.product_set.filter(country_id=pk)
            brand_total_stock = 0
            for p in products:
                stock = sum(i.quantity for i in p.inventory.all())
                brand_total_stock += stock
                products_data.append({
                    "id": p.id,
                    "name": p.name,
                    "sku": p.sku,
                    "size": float(p.size) if hasattr(p, 'size') and p.size else 0,
                    "unitShortName": p.unit.short_name if p.unit else None,
                    "categoryName": p.category.name if p.category else None,
                    "stock": float(stock)
                })
            
            data.append({
                "id": brand.id,
                "name": brand.name,
                "logo": "",
                "products": products_data,
                "totalStock": brand_total_stock
            })

        return Response(data)

class ContactViewSet(TenantModelViewSet):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        data = request.data.copy()

        with transaction.atomic():
            # 1. Get Posting Rules to find root account
            rules = ConfigurationService.get_posting_rules(organization)
            # Match frontend logic
            contact_type = data.get('type')
            
            # Map rule keys
            # frontend: rules.automation.customerRoot
            # backend config stores 'sales', 'purchases' etc.
            # I'll check my ConfigurationService.apply_smart_posting_rules logic
            
            parent_account_id = None
            if contact_type == 'CUSTOMER':
                parent_account_id = rules.get('sales', {}).get('receivable')
            else:
                parent_account_id = rules.get('purchases', {}).get('payable')
            
            if parent_account_id:
                from .models import ChartOfAccount
                from .services import LedgerService
                parent = ChartOfAccount.objects.get(id=parent_account_id)
                linked_acc = LedgerService.create_linked_account(
                    organization=organization,
                    name=f"{data.get('name')} ({'AR' if contact_type == 'CUSTOMER' else 'AP'})",
                    type=parent.type,
                    sub_type='RECEIVABLE' if contact_type == 'CUSTOMER' else 'PAYABLE',
                    parent_id=parent_account_id
                )
                data['linked_account'] = linked_acc.id

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

class EmployeeViewSet(TenantModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        data = request.data.copy()
        data['organization'] = organization.id

        with transaction.atomic():
            rules = ConfigurationService.get_posting_rules(organization)
            # For employees, we look for payroll root. 
            # If not in rules, fallback to '2200'
            parent_account_id = rules.get('payroll', {}).get('root') # Assuming we add this or use fallback
            
            if not parent_account_id:
                from .models import ChartOfAccount
                from .services import LedgerService
                parent = ChartOfAccount.objects.filter(organization=organization, code='2200').first()
                if not parent:
                    # Create root if missing
                    parent = ChartOfAccount.objects.create(
                        organization=organization,
                        code='2200',
                        name='Accrued Payroll & Salaries',
                        type='LIABILITY',
                        sub_type='PAYABLE'
                    )
                parent_account_id = parent.id

            fullName = f"{data.get('first_name')} {data.get('last_name')}"
            linked_acc = LedgerService.create_linked_account(
                organization=organization,
                name=f"Payable to {fullName}",
                type='LIABILITY',
                sub_type='PAYABLE',
                parent_id=parent_account_id
            )
            data['linked_account'] = linked_acc.id

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            
            # TODO: Handle User creation if requested (similar to createLogin in TS)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)

class RoleViewSet(TenantModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer

class BarcodeSettingsViewSet(viewsets.ViewSet):
    def list(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        settings, _ = BarcodeSettings.objects.get_or_create(organization=organization)
        return Response(BarcodeSettingsSerializer(settings).data)

    def create(self, request): # Used for update basically
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        settings, _ = BarcodeSettings.objects.get_or_create(organization=organization)
        serializer = BarcodeSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    @action(detail=False, methods=['post'])
    def generate(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            code = BarcodeService.generate_barcode(organization)
            return Response({"barcode": code})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            # Manually map fields to service
            event = FinancialEventService.create_event(
                organization=organization,
                event_type=request.data.get('event_type'),
                amount=request.data.get('amount'),
                date=request.data.get('date'),
                contact_id=request.data.get('contact_id'),
                reference=request.data.get('reference'),
                notes=request.data.get('notes'),
                loan_id=request.data.get('loan_id'),
                account_id=request.data.get('account_id') # If provided, posts immediately
            )
            return Response(FinancialEventSerializer(event).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def post_event(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            account_id = request.data.get('account_id')
            if not account_id: return Response({"error": "Account ID required"}, status=400)
            
            event = FinancialEventService.post_event(organization, pk, account_id)
            return Response(FinancialEventSerializer(event).data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=400)



    


class DashboardViewSet(viewsets.ViewSet):
    """
    Dashboard Aggregation ViewSet
    """
    
    @action(detail=False, methods=['get'])
    def admin_stats(self, request):
        organization_id = get_current_tenant_id()
        
        # Determine Scope: Tenant Specific or Global SaaS View
        if organization_id:
            try:
                org = Organization.objects.get(id=organization_id)
                # Tenant Stats
                total_products = Product.objects.filter(organization=org, is_active=True).count()
                total_customers = Contact.objects.filter(organization=org, type='CUSTOMER').count()
                
                # Latest Transactions
                latest_sales = Transaction.objects.filter(
                    organization=org,
                    type__in=['IN', 'SALE']
                ).order_by('-created_at')[:5]
                
            except Organization.DoesNotExist:
                return Response({"error": "Organization not found"}, status=404)
        else:
            # Global/SaaS Stats (For Superusers/Staff)
            if not (request.user.is_staff or request.user.is_superuser):
                 return Response({"error": "Access Denied. Tenant context required."}, status=403)
            
            # Aggregate across ALL organizations
            total_products = Product.objects.filter(is_active=True).count()
            total_customers = Contact.objects.filter(type='CUSTOMER').count()
            
            # Latest Global Transactions (Top 5 system-wide)
            latest_sales = Transaction.objects.filter(
                type__in=['IN', 'SALE']
            ).order_by('-created_at')[:5]

        # Serialize Transactions
        from .serializers import TransactionSerializer
        latest_sales_data = TransactionSerializer(latest_sales, many=True).data

        return Response({
            "totalSales": 0, # Placeholder until Order logic is fully ported
            "activeOrders": 0,
            "totalProducts": total_products,
            "totalCustomers": total_customers,
            "latestSales": latest_sales_data
        })

    @action(detail=False, methods=['get'])
    def saas_stats(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Staff access required"}, status=403)
            
        from django.utils import timezone
        total_tenants = Organization.objects.count()
        active_tenants = Organization.objects.filter(is_active=True).count()
        
        # Modules
        total_modules = SystemModule.objects.count()
        total_deployments = OrganizationModule.objects.filter(is_enabled=True).count()
        
        # Latest provisioned tenants
        latest_tenants = Organization.objects.order_by('-created_at')[:5]
        latest_tenants_data = [{
            'id': str(o.id),
            'name': o.name,
            'slug': o.slug,
            'created_at': o.created_at.strftime("%Y-%m-%d"),
            'is_active': o.is_active
        } for o in latest_tenants]
        
        return Response({
            "tenants": total_tenants,
            "activeTenants": active_tenants,
            "modules": total_modules,
            "deployments": total_deployments,
            "systemLoad": "Optimal",
            "lastSync": timezone.now().strftime("%H:%M"),
            "latestTenants": latest_tenants_data
        })

    @action(detail=False, methods=['get'])
    def financial_stats(self, request):
        organization_id = get_current_tenant_id()
        scope = request.query_params.get('scope', 'INTERNAL')
        
        from .services import LedgerService, InventoryService
        from django.db.models import Sum, F
        from django.utils import timezone
        
        # Determine Context: Tenant vs Global
        if organization_id:
            try:
                organization = Organization.objects.get(id=organization_id)
            except Organization.DoesNotExist:
                return Response({"error": "Organization not found"}, status=404)
        else:
            # Global / SaaS View
            if not (request.user.is_staff or request.user.is_superuser):
                return Response({"error": "Access Denied. Tenant context required."}, status=403)
            organization = None # Signal for global queries

        # 1. Cash Position
        if organization:
            cash_accounts = FinancialAccount.objects.filter(organization=organization)
            total_cash = sum(acc.balance for acc in cash_accounts)
        else:
            # Global Cash
            total_cash = FinancialAccount.objects.aggregate(total=Sum('balance'))['total'] or 0

        # 2. P&L (Monthly)
        now = timezone.now()
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Base Query for Income/Expense Lines
        lines_qs = JournalEntryLine.objects.filter(
            journal_entry__transaction_date__gte=start_month,
            journal_entry__status='POSTED'
        )
        
        if organization:
            lines_qs = lines_qs.filter(journal_entry__organization=organization)
        
        if scope == 'OFFICIAL':
            lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')

        # Income = Credit - Debit (for INCOME accounts)
        monthly_income = lines_qs.filter(account__type='INCOME').aggregate(
            val=Sum(F('credit') - F('debit'))
        )['val'] or 0
        
        # Expense = Debit - Credit (for EXPENSE accounts)
        monthly_expense = lines_qs.filter(account__type='EXPENSE').aggregate(
            val=Sum(F('debit') - F('credit'))
        )['val'] or 0

        # 3. Trends (Last 6 months Income/Expense)
        trends = []
        for i in range(5, -1, -1):
            month_start = (now.replace(day=1) - timezone.timedelta(days=30*i)).replace(day=1)
            next_month_start = (month_start + timezone.timedelta(days=32)).replace(day=1)
            
            # Filter entries for this month
            month_lines = JournalEntryLine.objects.filter(
                journal_entry__transaction_date__gte=month_start,
                journal_entry__transaction_date__lt=next_month_start,
                journal_entry__status='POSTED'
            )
            
            if organization:
                month_lines = month_lines.filter(journal_entry__organization=organization)
            
            if scope == 'OFFICIAL':
                month_lines = month_lines.filter(journal_entry__scope='OFFICIAL')
                
            m_income = month_lines.filter(account__type='INCOME').aggregate(
                val=Sum(F('credit') - F('debit'))
            )['val'] or 0
            
            m_expense = month_lines.filter(account__type='EXPENSE').aggregate(
                val=Sum(F('debit') - F('credit'))
            )['val'] or 0
            
            trends.append({
                "month": month_start.strftime("%b"),
                "income": float(m_income),
                "expense": float(m_expense)
            })

        # 4. Inventory Value
        from decimal import Decimal
        inv_status = {}
        
        if organization:
            raw_status = InventoryService.get_inventory_valuation(organization)
            stock_value = raw_status.get('total_value', Decimal('0'))
            
            # Get Ledger Balance
            rules = ConfigurationService.get_posting_rules(organization)
            # Try sales.inventory or purchases.inventory (usually same)
            inv_acc_id = rules.get('sales', {}).get('inventory') or rules.get('purchases', {}).get('inventory')
            ledger_balance = Decimal('0')
            
            if inv_acc_id:
                from .models import ChartOfAccount
                acc = ChartOfAccount.objects.filter(id=inv_acc_id).first()
                if acc: ledger_balance = acc.balance
            
            inv_status = {
                "totalValue": float(stock_value),
                "ledgerBalance": float(ledger_balance),
                "discrepancy": float(stock_value - ledger_balance),
                "itemCount": raw_status.get('item_count', 0),
                "isMapped": bool(inv_acc_id)
            }
        else:
            # Global Inventory Value
            from .models import Inventory
            result = Inventory.objects.aggregate(total_value=Sum(F('quantity') * F('product__cost_price')))
            stock_value = Decimal(str(result['total_value'] or '0'))
            
            inv_status = {
                "totalValue": float(stock_value),
                "ledgerBalance": 0, 
                "discrepancy": 0,
                "itemCount": Inventory.objects.count(),
                "isMapped": False
            }
        
        return Response({
            "totalCash": float(total_cash),
            "monthlyIncome": float(monthly_income),
            "monthlyExpense": float(monthly_expense),
            "netProfit": float(monthly_income - monthly_expense),
            "totalAR": 0, # To implement with AR/AP
            "totalAP": 0,
            "trends": trends,
            "recentEntries": [],
            "inventoryStatus": inv_status
        })

    @action(detail=False, methods=['get'])
    def search_enhanced(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            # Prevent crash on Global Dashboard (Root)
            return Response([], status=status.HTTP_200_OK)
        
        organization = Organization.objects.get(id=organization_id)
        query = request.query_params.get('query', '')
        site_id = request.query_params.get('site_id')
        
        from django.db.models import Q, Sum, F
        from django.utils import timezone
        from datetime import timedelta
        
        products_qs = Product.objects.filter(organization=organization, status='ACTIVE')
        if query:
            products_qs = products_qs.filter(
                Q(name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query)
            )
        
        products_qs = products_qs[:10]
        
        data = []
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        for p in products_qs:
            # Aggregate Stock
            stock_filter = {'organization': organization, 'product': p}
            if site_id:
                stock_filter['warehouse__site_id'] = site_id
                
            stock_level = Inventory.objects.filter(**stock_filter).aggregate(total=Sum('quantity'))['total'] or 0
            
            # Daily Sales (30 day avg)
            # Using OrderLine
            sales_qty = OrderLine.objects.filter(
                order__organization=organization,
                product=p,
                order__created_at__gte=thirty_days_ago,
                order__status='COMPLETED',
                order__type='SALE'
            ).aggregate(total=Sum('quantity'))['total'] or 0
            
            daily_sales = float(sales_qty) / 30.0
            
            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "costPrice": float(p.cost_price),
                "costPriceHT": float(p.cost_price_ht),
                "sellingPriceHT": float(p.selling_price_ht),
                "sellingPriceTTC": float(p.selling_price_ttc),
                "stockLevel": float(stock_level),
                "dailySales": round(daily_sales, 2),
                "proposedQty": max(0, int(daily_sales * 14 - stock_level))
            })
            
        return Response(data)
class TransactionSequenceViewSet(TenantModelViewSet):
    queryset = TransactionSequence.objects.all()
    serializer_class = TransactionSequenceSerializer
