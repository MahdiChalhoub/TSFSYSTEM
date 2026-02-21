import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction

from apps.inventory.models import Product, Inventory
from apps.client_portal.models import ClientOrder, ClientOrderLine
from .models import EcommerceIntegration, ExternalProductMapping, ExternalOrderMapping
from .ecommerce_connector import get_connector, EcommerceSyncConfig

logger = logging.getLogger(__name__)

class EcommerceSyncService:
    def __init__(self, integration: EcommerceIntegration):
        self.integration = integration
        self.config = EcommerceSyncConfig(
            platform=integration.platform,
            api_url=integration.api_url,
            api_key=integration.get_api_key(),
            api_secret=integration.get_api_secret(),
            organization_id=integration.organization_id
        )
        self.connector = get_connector(self.config)

    def sync_products(self, limit=50):
        """Pull products from external store and sync with local catalog."""
        result = self.connector.import_products(limit=limit)
        if 'error' in result:
            return result

        synced_count = 0
        for ext_p in result.get('products', []):
            with transaction.atomic():
                # 1. Try to find existing mapping
                mapping = ExternalProductMapping.objects.filter(
                    integration=self.integration,
                    external_id=ext_p['external_id']
                ).first()

                product = None
                if mapping:
                    product = mapping.product
                else:
                    # 2. Match by SKU if no mapping
                    if ext_p.get('sku'):
                        product = Product.objects.filter(
                            organization=self.integration.organization,
                            sku=ext_p['sku']
                        ).first()

                # 3. Create or update product
                if not product:
                    # Create new product
                    product = Product.objects.create(
                        organization=self.integration.organization,
                        sku=ext_p.get('sku') or f"EXT-{ext_p['external_id']}",
                        name=ext_p['name'],
                        description=ext_p.get('description', ''),
                        selling_price_ttc=ext_p.get('price', Decimal('0.00')),
                        is_active=True
                    )
                else:
                    # Update existing product (optional: decide which fields to overrite)
                    product.name = ext_p['name']
                    # We might not want to overwrite price if ERP is master
                    product.save()

                # 4. Create/update mapping
                if not mapping:
                    ExternalProductMapping.objects.create(
                        organization=self.integration.organization,
                        integration=self.integration,
                        product=product,
                        external_id=ext_p['external_id'],
                        external_variant_id=ext_p.get('external_variant_id')
                    )
                
                synced_count += 1

        self.integration.last_sync_at = timezone.now()
        self.integration.save(update_fields=['last_sync_at'])
        
        return {'status': 'success', 'synced': synced_count}

    def import_orders(self, limit=50):
        """Pull orders from external store and create local ClientOrders."""
        result = self.connector.import_orders(limit=limit)
        if 'error' in result:
            return result

        imported_count = 0
        for ext_o in result.get('orders', []):
            # Check if order already imported
            if ExternalOrderMapping.objects.filter(
                integration=self.integration,
                external_id=ext_o['external_id']
            ).exists():
                continue

            with transaction.atomic():
                # Create ClientOrder
                # Note: We might need to find or create a Contact based on email
                from apps.crm.models import Contact
                contact = Contact.objects.filter(
                    organization=self.integration.organization,
                    email=ext_o.get('email', ext_o.get('billing_email'))
                ).first()

                if not contact:
                    contact = Contact.objects.create(
                        organization=self.integration.organization,
                        name=ext_o.get('email', 'External Customer'),
                        email=ext_o.get('email', ext_o.get('billing_email', 'unknown@external.com')),
                        type='CLIENT'
                    )

                order = ClientOrder.objects.create(
                    organization=self.integration.organization,
                    contact=contact,
                    status='PLACED',
                    payment_status='PAID' if ext_o.get('financial_status') == 'paid' or ext_o.get('status') == 'completed' else 'PENDING',
                    total_amount=ext_o.get('total_price', ext_o.get('total', Decimal('0.00'))),
                    currency=ext_o.get('currency', 'USD'),
                    notes=f"Imported from {self.integration.platform} (#{ext_o.get('order_number')})"
                )

                # Create lines
                for li in ext_o.get('line_items', []):
                    # Try to match product by SKU
                    product = None
                    if li.get('sku'):
                        product = Product.objects.filter(
                            organization=self.integration.organization,
                            sku=li['sku']
                        ).first()

                    ClientOrderLine.objects.create(
                        organization=self.integration.organization,
                        order=order,
                        product=product,
                        product_name=li['name'],
                        quantity=li['quantity'],
                        unit_price=li['price']
                    )

                # Create mapping
                ExternalOrderMapping.objects.create(
                    organization=self.integration.organization,
                    integration=self.integration,
                    order=order,
                    external_id=ext_o['external_id'],
                    external_number=str(ext_o.get('order_number', ''))
                )
                
                imported_count += 1

        return {'status': 'success', 'imported': imported_count}

    def push_inventory(self, product: Product):
        """Push local inventory level to external store."""
        mapping = ExternalProductMapping.objects.filter(
            integration=self.integration,
            product=product
        ).first()

        if not mapping:
            return {'error': 'No mapping found for this product'}

        # Calculate total quantity across all warehouses
        total_qty = Inventory.objects.filter(
            product=product
        ).aggregate(total=models.Sum('quantity'))['total'] or 0

        if self.integration.platform == 'SHOPIFY':
            return self.connector.sync_inventory(product.sku, total_qty)
        elif self.integration.platform == 'WOOCOMMERCE':
            return self.connector.sync_inventory(mapping.external_id, total_qty)

        return {'error': 'Unsupported platform for inventory push'}
