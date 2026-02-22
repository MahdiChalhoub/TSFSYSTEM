import requests
import json
import logging
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from .models import Product, Warehouse, Category, Unit, Brand
from erp.models import Organization

logger = logging.getLogger(__name__)

SYNC_API_URL = "https://www.tsfci.com/API/newInventoryMode/get_products_full_sync.php"
LOCATION_SYNC_API_URL = "https://tsfci.com/API/location/location.php"
BATCH_LIMIT = 500

class StockCountSyncService:
    @staticmethod
    def sync_locations(organization: Organization, api_key: str):
        """Sync warehouses/locations from TSFCI API."""
        try:
            url = f"{LOCATION_SYNC_API_URL}?api_key={api_key}&_t={int(timezone.now().timestamp())}"
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            locations_data = response.json()

            count = 0
            for loc in locations_data:
                # In main app, we map these to Warehouses
                # We need a site. For now, we'll pick the first site of the org or create a default one.
                site = organization.sites.first()
                if not site:
                    logger.error(f"No sites found for organization {organization.name}")
                    continue

                warehouse, created = Warehouse.objects.update_or_create(
                    organization=organization,
                    legacy_id=loc['id'],
                    defaults={
                        'site': site,
                        'name': loc['name'],
                        'code': f"LEGACY-{loc['id']}",
                        'is_active': True
                    }
                )
                count += 1
            
            return {"success": True, "total_synced": count}
        except Exception as e:
            logger.exception("Failed to sync locations")
            return {"success": False, "error": str(e)}

    @staticmethod
    def sync_products(organization: Organization, api_key: str, last_id=0):
        """Sync products from TSFCI API (one batch)."""
        try:
            url = f"{SYNC_API_URL}?api_key={api_key}&limit={BATCH_LIMIT}&last_id={last_id}&_t={int(timezone.now().timestamp())}"
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()

            products_data = data.get('data', [])
            done = data.get('done', False)
            new_last_id = data.get('last_id', last_id)

            count = 0
            for prod in products_data:
                # 1. Category
                cat_name = prod.get('category') or "General"
                category, _ = Category.objects.update_or_create(
                    organization=organization,
                    name=cat_name,
                )

                # 2. Brand
                brand_name = prod.get('brand')
                brand = None
                if brand_name:
                    brand, _ = Brand.objects.update_or_create(
                        organization=organization,
                        name=brand_name
                    )

                # 3. Unit
                unit_code = prod.get('unit') or "PC"
                unit, _ = Unit.objects.update_or_create(
                    organization=organization,
                    code=unit_code,
                    defaults={'name': unit_code}
                )

                # 4. Product
                product, created = Product.objects.update_or_create(
                    organization=organization,
                    legacy_id=prod['product_id'],
                    defaults={
                        'name': prod['name'],
                        'sku': prod.get('sku') or f"LEGACY-{prod['product_id']}",
                        'barcode': prod.get('barcode') or prod.get('sku'),
                        'category': category,
                        'brand': brand,
                        'unit': unit,
                        'image_url': prod.get('image'),
                        'cost_price_ttc': Decimal(str(prod.get('unit_cost') or 0)),
                        'selling_price_ttc': Decimal(str(prod.get('selling_price') or 0)),
                        'is_active': True,
                    }
                )
                count += 1

            return {
                "success": True, 
                "done": done, 
                "batch_synced": count, 
                "last_id": new_last_id
            }
        except Exception as e:
            logger.exception("Failed to sync products")
            return {"success": False, "error": str(e)}

    @staticmethod
    def get_live_qty(api_key: str, barcode: str, legacy_location_id: int):
        """Fetch real-time stock data from TSFCI API."""
        try:
            url = f"https://www.tsfci.com/API/newInventoryMode/get_products.php?api_key={api_key}&barcode={barcode}&location_id={legacy_location_id}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()

            if data.get('count', 0) > 0 and data.get('data'):
                return {"success": True, "data": data['data'][0]}
            return {"success": False, "error": "Product not found in legacy system"}
        except Exception as e:
            logger.exception("Failed to fetch live qty")
            return {"success": False, "error": str(e)}
