"""
E-commerce Sync Connector
===========================
Bidirectional sync with Shopify and WooCommerce.
Handles product sync, order import, and inventory level updates.
"""
import logging
import json
from decimal import Decimal

logger = logging.getLogger(__name__)


class EcommerceSyncConfig:
    """Configuration container for e-commerce platform connections."""

    PLATFORMS = ('SHOPIFY', 'WOOCOMMERCE')

    def __init__(self, platform, api_url, api_key, api_secret=None, tenant_id=None):
        self.platform = platform.upper()
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.api_secret = api_secret
        self.organization_id = organization_id

        if self.platform not in self.PLATFORMS:
            raise ValueError(f"Unsupported platform: {self.platform}. Use: {self.PLATFORMS}")


class ShopifyConnector:
    """
    Shopify store integration.

    Sync flow:
        1. import_products() — Pull Shopify products → create/update local Products
        2. export_products() — Push local Products → Shopify
        3. import_orders() — Pull Shopify orders → create local Orders
        4. sync_inventory() — Push local stock levels → Shopify inventory
    """

    def __init__(self, config: EcommerceSyncConfig):
        self.config = config
        self.base_url = f"{config.api_url}/admin/api/2024-01"
        self.headers = {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': config.api_key,
        }

    def _request(self, method, endpoint, data=None):
        """Make authenticated request to Shopify API."""
        import requests
        url = f"{self.base_url}/{endpoint}.json"
        try:
            resp = requests.request(method, url, headers=self.headers, json=data, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"[Shopify] {method} {endpoint} failed: {e}")
            return {'error': str(e)}

    def import_products(self, limit=50):
        """
        Import products from Shopify into local catalog.

        Returns:
            list of dicts with product mappings
        """
        result = self._request('GET', f'products?limit={limit}')
        if 'error' in result:
            return result

        products = result.get('products', [])
        imported = []

        for sp in products:
            mapped = {
                'external_id': str(sp['id']),
                'name': sp['title'],
                'description': sp.get('body_html', ''),
                'sku': sp.get('variants', [{}])[0].get('sku', ''),
                'price': Decimal(str(sp.get('variants', [{}])[0].get('price', '0'))),
                'inventory_quantity': sp.get('variants', [{}])[0].get('inventory_quantity', 0),
                'status': 'active' if sp.get('status') == 'active' else 'draft',
                'images': [img.get('src') for img in sp.get('images', [])],
                'vendor': sp.get('vendor', ''),
                'product_type': sp.get('product_type', ''),
            }
            imported.append(mapped)

        logger.info(f"[Shopify] Imported {len(imported)} products")
        return {'products': imported, 'count': len(imported)}

    def export_product(self, product_data):
        """
        Export a local product to Shopify.

        Args:
            product_data: dict with title, body_html, vendor, variants
        """
        payload = {'product': product_data}
        return self._request('POST', 'products', payload)

    def import_orders(self, status='any', limit=50):
        """Import orders from Shopify."""
        result = self._request('GET', f'orders?status={status}&limit={limit}')
        if 'error' in result:
            return result

        orders = result.get('orders', [])
        imported = []

        for so in orders:
            mapped = {
                'external_id': str(so['id']),
                'order_number': so.get('order_number'),
                'email': so.get('email', ''),
                'total_price': Decimal(str(so.get('total_price', '0'))),
                'subtotal_price': Decimal(str(so.get('subtotal_price', '0'))),
                'total_tax': Decimal(str(so.get('total_tax', '0'))),
                'currency': so.get('currency', 'USD'),
                'financial_status': so.get('financial_status', ''),
                'fulfillment_status': so.get('fulfillment_status', ''),
                'created_at': so.get('created_at'),
                'line_items': [{
                    'name': li.get('name'),
                    'sku': li.get('sku'),
                    'quantity': li.get('quantity', 0),
                    'price': Decimal(str(li.get('price', '0'))),
                } for li in so.get('line_items', [])],
            }
            imported.append(mapped)

        logger.info(f"[Shopify] Imported {len(imported)} orders")
        return {'orders': imported, 'count': len(imported)}

    def sync_inventory(self, sku, quantity, location_id=None):
        """
        Update inventory level for a product variant in Shopify.

        Args:
            sku: Product SKU to look up
            quantity: New inventory quantity
            location_id: Shopify location ID (uses primary if None)
        """
        # Find inventory item by SKU
        result = self._request('GET', f'variants?sku={sku}')
        if 'error' in result:
            return result

        variants = result.get('variants', [])
        if not variants:
            return {'error': f'No variant found for SKU: {sku}'}

        inventory_item_id = variants[0].get('inventory_item_id')
        if not inventory_item_id:
            return {'error': 'No inventory_item_id on variant'}

        # Set inventory level
        payload = {
            'inventory_item_id': inventory_item_id,
            'available': quantity,
        }
        if location_id:
            payload['location_id'] = location_id

        return self._request('POST', 'inventory_levels/set', payload)

    def test_connection(self):
        """Test the Shopify API connection."""
        result = self._request('GET', 'shop')
        if 'error' in result:
            return {'connected': False, 'error': result['error']}
        shop = result.get('shop', {})
        return {
            'connected': True,
            'shop_name': shop.get('name'),
            'domain': shop.get('domain'),
            'currency': shop.get('currency'),
        }


class WooCommerceConnector:
    """
    WooCommerce store integration.
    Uses WooCommerce REST API with consumer key/secret authentication.
    """

    def __init__(self, config: EcommerceSyncConfig):
        self.config = config
        self.base_url = f"{config.api_url}/wp-json/wc/v3"
        self.auth = (config.api_key, config.api_secret or '')

    def _request(self, method, endpoint, data=None, params=None):
        """Make authenticated request to WooCommerce API."""
        import requests
        url = f"{self.base_url}/{endpoint}"
        try:
            resp = requests.request(
                method, url, auth=self.auth,
                json=data, params=params, timeout=30
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"[WooCommerce] {method} {endpoint} failed: {e}")
            return {'error': str(e)}

    def import_products(self, per_page=50):
        """Import products from WooCommerce."""
        result = self._request('GET', 'products', params={'per_page': per_page})
        if isinstance(result, dict) and 'error' in result:
            return result

        products = result if isinstance(result, list) else []
        imported = [{
            'external_id': str(p['id']),
            'name': p.get('name', ''),
            'description': p.get('description', ''),
            'sku': p.get('sku', ''),
            'price': Decimal(str(p.get('price', '0') or '0')),
            'regular_price': Decimal(str(p.get('regular_price', '0') or '0')),
            'inventory_quantity': p.get('stock_quantity', 0),
            'status': p.get('status', 'draft'),
            'categories': [c['name'] for c in p.get('categories', [])],
        } for p in products]

        logger.info(f"[WooCommerce] Imported {len(imported)} products")
        return {'products': imported, 'count': len(imported)}

    def import_orders(self, per_page=50):
        """Import orders from WooCommerce."""
        result = self._request('GET', 'orders', params={'per_page': per_page})
        if isinstance(result, dict) and 'error' in result:
            return result

        orders = result if isinstance(result, list) else []
        imported = [{
            'external_id': str(o['id']),
            'order_number': o.get('number'),
            'total': Decimal(str(o.get('total', '0'))),
            'currency': o.get('currency', 'USD'),
            'status': o.get('status', ''),
            'billing_email': o.get('billing', {}).get('email', ''),
            'created_at': o.get('date_created'),
            'line_items': [{
                'name': li.get('name'),
                'sku': li.get('sku'),
                'quantity': li.get('quantity', 0),
                'price': Decimal(str(li.get('price', '0'))),
            } for li in o.get('line_items', [])],
        } for o in orders]

        logger.info(f"[WooCommerce] Imported {len(imported)} orders")
        return {'orders': imported, 'count': len(imported)}

    def sync_inventory(self, product_external_id, quantity):
        """Update stock quantity for a WooCommerce product."""
        return self._request('PUT', f'products/{product_external_id}', {
            'stock_quantity': quantity,
            'manage_stock': True,
        })

    def test_connection(self):
        """Test the WooCommerce API connection."""
        result = self._request('GET', 'system_status')
        if isinstance(result, dict) and 'error' in result:
            return {'connected': False, 'error': result['error']}
        return {
            'connected': True,
            'wc_version': result.get('environment', {}).get('version', 'unknown'),
        }


def get_connector(config: EcommerceSyncConfig):
    """Factory: return the appropriate connector for the platform."""
    if config.platform == 'SHOPIFY':
        return ShopifyConnector(config)
    elif config.platform == 'WOOCOMMERCE':
        return WooCommerceConnector(config)
    else:
        raise ValueError(f"Unsupported platform: {config.platform}")
