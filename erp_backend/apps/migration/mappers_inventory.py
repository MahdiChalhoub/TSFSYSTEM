"""
Entity Mappers — Translate UltimatePOS rows → TSF model field dictionaries.
Each mapper handles one entity type with a map_row() method.
"""
from decimal import Decimal, InvalidOperation
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)



from .mappers_utils import safe_decimal, safe_int, safe_str, safe_bool


class UnitMapper:
    """Maps UltimatePOS `units` → TSF `Unit`."""

    @staticmethod
    def map_row(row):
        return {
            'name': safe_str(row.get('actual_name'), max_length=255),
            'code': safe_str(row.get('short_name'), max_length=50) or safe_str(row.get('actual_name'), max_length=50),
            'short_name': safe_str(row.get('short_name'), max_length=20),
            'type': 'UNIT',
            'allow_fraction': safe_bool(row.get('allow_decimal')),
        }

    @staticmethod
    def extra_data(row):
        """Capture unmapped fields for reference."""
        return {
            'base_unit_id': safe_int(row.get('base_unit_id')),
            'base_unit_multiplier': str(row.get('base_unit_multiplier')) if row.get('base_unit_multiplier') else None,
        }


class CategoryMapper:
    """Maps UltimatePOS `categories` → TSF `Category`."""

    @staticmethod
    def map_row(row, parent_mapping=None):
        result = {
            'name': safe_str(row.get('name'), max_length=255),
            'code': safe_str(row.get('short_code'), max_length=50),
        }
        # Resolve parent_id through mapping
        parent_id = safe_int(row.get('parent_id'))
        if parent_id and parent_id > 0 and parent_mapping:
            result['parent_id'] = parent_mapping.get(parent_id)
        return result

    @staticmethod
    def extra_data(row):
        return {
            'category_type': safe_str(row.get('category_type')),
            'slug': safe_str(row.get('slug')),
            'description': safe_str(row.get('description')),
        }


class BrandMapper:
    """Maps UltimatePOS `brands` → TSF `Brand`."""

    @staticmethod
    def map_row(row):
        return {
            'name': safe_str(row.get('name'), max_length=255),
        }

    @staticmethod
    def extra_data(row):
        return {
            'description': safe_str(row.get('description')),
        }


class ProductMapper:
    """
    Maps UltimatePOS `products` + `variations` → TSF `Product`.
    UltimatePOS has a separate variations table; TSF uses a flat Product model.
    We merge the default variation's price data into the Product.
    """

    TYPE_MAP = {
        'single': 'STANDARD',
        'variable': 'STANDARD',  # TSF doesn't have variable products
        'modifier': 'STANDARD',
        'combo': 'COMBO',
    }

    @staticmethod
    def map_row(row, variation_data=None, brand_mapping=None,
                category_mapping=None, unit_mapping=None, tax_mapping=None):
        # ...pricing...
        purchase_price = Decimal('0.00')
        sell_price = Decimal('0.00')
        if variation_data:
            purchase_price = safe_decimal(variation_data.get('default_purchase_price'))
            sell_price = safe_decimal(variation_data.get('default_sell_price'))

        product_type = ProductMapper.TYPE_MAP.get(
            safe_str(row.get('type')), 'STANDARD'
        )

        # Resolve foreign keys through mappings
        brand_id = None
        if row.get('brand_id') and brand_mapping:
            brand_id = brand_mapping.get(safe_int(row.get('brand_id')))

        category_id = None
        if row.get('category_id') and category_mapping:
            category_id = category_mapping.get(safe_int(row.get('category_id')))

        unit_id = None
        if row.get('unit_id') and unit_mapping:
            unit_id = unit_mapping.get(safe_int(row.get('unit_id')))

        # Resolve tax rate from mapping if available, fallback to 18%
        tax_rate_val = Decimal('18.00')
        source_tax_id = safe_int(row.get('tax'))
        if source_tax_id and tax_mapping and source_tax_id in tax_mapping:
            tax_rate_val = tax_mapping[source_tax_id] * Decimal('100')
        
        TAX_FACTOR = (Decimal('1.00') + (tax_rate_val / Decimal('100')))
        
        purchase_price_ttc = purchase_price # In source this was TTC
        sell_price_ttc = safe_decimal(variation_data.get('sell_price_inc_tax')) if variation_data else sell_price
        
        purchase_price_ht = (purchase_price_ttc / TAX_FACTOR).quantize(Decimal('0.01'))
        sell_price_ht = (sell_price_ttc / TAX_FACTOR).quantize(Decimal('0.01'))

        result = {
            'sku': safe_str(row.get('sku'), max_length=100),
            'name': safe_str(row.get('name'), max_length=255),
            'type': product_type,
            'purchase_price_ht': purchase_price_ht,
            'purchase_price_ttc': purchase_price_ttc,
            'sell_price_ht': sell_price_ht,
            'sell_price_ttc': sell_price_ttc,
            'tax_rate': tax_rate_val,
            'barcode': safe_str(variation_data.get('sub_sku'), max_length=100) if variation_data else None,
            'description': safe_str(row.get('product_description')),
            'image': safe_str(row.get('image'), max_length=255),
            'is_active': not safe_bool(row.get('is_inactive')),
            'alert_quantity': safe_decimal(row.get('alert_quantity'), '0'),
            'manage_stock': safe_bool(row.get('enable_stock')),
            'is_expiry_tracked': safe_bool(row.get('expiry_period')) or safe_int(row.get('expiry_period'), 0) > 0,
        }

        # Add FK IDs (will be set as _id fields)
        if brand_id:
            result['brand_id'] = brand_id
        if category_id:
            result['category_id'] = category_id
        if unit_id:
            result['unit_id'] = unit_id

        return result

    @staticmethod
    def extra_data(row, variation_data=None):
        data = {
            'original_type': safe_str(row.get('type')),
            'tax_type': safe_str(row.get('tax_type')),
            'barcode_type': safe_str(row.get('barcode_type')),
            'weight': safe_str(row.get('weight')),
            'expiry_period': str(row.get('expiry_period')) if row.get('expiry_period') else None,
            'expiry_period_type': safe_str(row.get('expiry_period_type')),
            'not_for_selling': safe_bool(row.get('not_for_selling')),
        }
        # Store custom fields
        for i in range(1, 21):
            key = f'product_custom_field{i}'
            val = row.get(key)
            if val:
                data[key] = safe_str(val)
        return data
