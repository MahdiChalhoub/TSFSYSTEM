"""
Entity Mappers — Translate UltimatePOS rows → TSF model field dictionaries.
Each mapper handles one entity type with a map_row() method.
"""
from decimal import Decimal, InvalidOperation
import logging

logger = logging.getLogger(__name__)


def safe_decimal(value, default='0.00'):
    """Convert a value to Decimal safely."""
    if value is None:
        return Decimal(default)
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal(default)


def safe_int(value, default=None):
    """Convert a value to int safely."""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def safe_str(value, max_length=None, default=''):
    """Convert a value to string safely with optional truncation."""
    if value is None:
        return default or None
    s = str(value)
    if max_length and len(s) > max_length:
        s = s[:max_length]
    return s


def safe_bool(value, default=False):
    """Convert a value to boolean safely."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.lower() in ('1', 'true', 'yes')
    return default


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

        # Resolve tax from the 'tax' field (tax_rate_id in UltimatePOS)
        tax_rate = Decimal('0.00')
        source_tax_id = safe_int(row.get('tax'))
        if source_tax_id and tax_mapping:
            tax_rate = tax_mapping.get(source_tax_id, Decimal('0.00'))

        result = {
            'sku': safe_str(row.get('sku'), max_length=100),
            'name': safe_str(row.get('name'), max_length=255),
            'type': product_type,
            'purchase_price_ht': purchase_price,
            'sell_price_ht': sell_price,
            'sell_price_ttc': safe_decimal(variation_data.get('sell_price_inc_tax')) if variation_data else sell_price,
            'tax_rate': tax_rate,
            'barcode': safe_str(variation_data.get('sub_sku'), max_length=100) if variation_data else None,
            'description': safe_str(row.get('product_description')),
            'image': safe_str(row.get('image'), max_length=255),
            'is_active': not safe_bool(row.get('is_inactive')),
            'alert_quantity': safe_decimal(row.get('alert_quantity'), '0'),
            'manage_stock': safe_bool(row.get('enable_stock')),
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


class ContactMapper:
    """Maps UltimatePOS `contacts` → TSF `Contact`."""

    TYPE_MAP = {
        'supplier': 'SUPPLIER',
        'customer': 'CUSTOMER',
        'both': 'SUPPLIER',  # Will create two contacts if needed
    }

    @staticmethod
    def map_row(row, contact_type_override=None):
        pos_type = safe_str(row.get('type', '')).lower()
        tsf_type = contact_type_override or ContactMapper.TYPE_MAP.get(pos_type, 'CUSTOMER')

        # Build name from parts
        name_parts = []
        if row.get('prefix'):
            name_parts.append(safe_str(row.get('prefix')))
        if row.get('first_name'):
            name_parts.append(safe_str(row.get('first_name')))
        if row.get('middle_name'):
            name_parts.append(safe_str(row.get('middle_name')))
        if row.get('last_name'):
            name_parts.append(safe_str(row.get('last_name')))

        name = ' '.join(name_parts) if name_parts else safe_str(row.get('name'), max_length=255)
        if not name:
            name = safe_str(row.get('supplier_business_name'), max_length=255) or f"Contact-{row.get('id')}"

        # Build address
        address_parts = []
        if row.get('address_line_1'):
            address_parts.append(safe_str(row.get('address_line_1')))
        if row.get('address_line_2'):
            address_parts.append(safe_str(row.get('address_line_2')))
        if row.get('city'):
            address_parts.append(safe_str(row.get('city')))
        if row.get('state'):
            address_parts.append(safe_str(row.get('state')))
        if row.get('country'):
            address_parts.append(safe_str(row.get('country')))
        if row.get('zip_code'):
            address_parts.append(safe_str(row.get('zip_code')))

        # Payment terms
        pay_days = 0
        if row.get('pay_term_number'):
            term_num = safe_int(row.get('pay_term_number'), 0)
            term_type = safe_str(row.get('pay_term_type', 'days')).lower()
            if term_type == 'months':
                pay_days = term_num * 30
            else:
                pay_days = term_num

        result = {
            'type': tsf_type,
            'name': name[:255],
            'company_name': safe_str(row.get('supplier_business_name'), max_length=255),
            'email': safe_str(row.get('email'), max_length=254),
            'phone': safe_str(row.get('mobile'), max_length=50),
            'address': '\n'.join(address_parts) if address_parts else None,
            'vat_id': safe_str(row.get('tax_number'), max_length=100),
            'balance': safe_decimal(row.get('balance')),
            'credit_limit': safe_decimal(row.get('credit_limit')),
            'payment_terms_days': pay_days,
            'is_active': safe_str(row.get('contact_status', 'active')).lower() == 'active',
        }

        # Customer-specific
        if tsf_type == 'CUSTOMER':
            result['loyalty_points'] = safe_int(row.get('total_rp'), 0)

        return result

    @staticmethod
    def extra_data(row):
        data = {
            'contact_type': safe_str(row.get('contact_type')),
            'landline': safe_str(row.get('landline')),
            'alternate_number': safe_str(row.get('alternate_number')),
            'dob': safe_str(row.get('dob')),
            'shipping_address': safe_str(row.get('shipping_address')),
            'customer_group_id': safe_int(row.get('customer_group_id')),
            'total_rp_used': safe_int(row.get('total_rp_used')),
            'total_rp_expired': safe_int(row.get('total_rp_expired')),
        }
        for i in range(1, 11):
            val = row.get(f'custom_field{i}')
            if val:
                data[f'custom_field{i}'] = safe_str(val)
        return data


class TransactionMapper:
    """Maps UltimatePOS `transactions` → TSF `Order`."""

    TYPE_MAP = {
        'purchase': 'PURCHASE',
        'sell': 'SALE',
        'purchase_return': 'RETURN',
        'sell_return': 'RETURN',
        'expense': None,  # Skip expenses
        'stock_adjustment': None,  # Skip
        'purchase_order': 'PURCHASE',
        'sales_order': 'SALE',
        'opening_stock': None,  # Skip
        'purchase_transfer': None,  # Skip
        'sell_transfer': None,  # Skip
    }

    STATUS_MAP = {
        'received': 'RECEIVED',
        'pending': 'PENDING',
        'ordered': 'PENDING',
        'final': 'COMPLETED',
        'draft': 'DRAFT',
        'completed': 'COMPLETED',
        'cancelled': 'CANCELLED',
    }

    PAYMENT_METHOD_MAP = {
        'cash': 'CASH',
        'card': 'CARD',
        'cheque': 'CHECK',
        'bank_transfer': 'BANK',
        'other': 'OTHER',
        'custom_pay_1': 'OTHER',
        'custom_pay_2': 'OTHER',
        'custom_pay_3': 'OTHER',
    }

    @staticmethod
    def map_row(row, contact_mapping=None, site_mapping=None):
        pos_type = safe_str(row.get('type', '')).lower()
        tsf_type = TransactionMapper.TYPE_MAP.get(pos_type)

        if tsf_type is None:
            return None  # Skip non-migratable transaction types

        status = TransactionMapper.STATUS_MAP.get(
            safe_str(row.get('status', '')).lower(), 'COMPLETED'
        )

        # Resolve contact
        contact_id = None
        if row.get('contact_id') and contact_mapping:
            contact_id = contact_mapping.get(safe_int(row.get('contact_id')))

        # Resolve site/location
        site_id = None
        if row.get('location_id') and site_mapping:
            site_id = site_mapping.get(safe_int(row.get('location_id')))

        # Payment method from prefer_payment_method
        payment_method = TransactionMapper.PAYMENT_METHOD_MAP.get(
            safe_str(row.get('prefer_payment_method', 'cash')).lower(), 'CASH'
        )

        result = {
            'type': tsf_type,
            'status': status,
            'ref_code': safe_str(row.get('ref_no'), max_length=100),
            'invoice_number': safe_str(row.get('invoice_no'), max_length=100),
            'total_amount': safe_decimal(row.get('final_total')),
            'tax_amount': safe_decimal(row.get('tax_amount')),
            'discount': safe_decimal(row.get('discount_amount')),
            'payment_method': payment_method,
            'notes': safe_str(row.get('additional_notes')),
            'created_at': safe_str(row.get('created_at')),
        }

        if contact_id:
            result['contact_id'] = contact_id
        if site_id:
            result['site_id'] = site_id

        return result

    @staticmethod
    def extra_data(row):
        return {
            'original_type': safe_str(row.get('type')),
            'sub_type': safe_str(row.get('sub_type')),
            'payment_status': safe_str(row.get('payment_status')),
            'discount_type': safe_str(row.get('discount_type')),
            'shipping_details': safe_str(row.get('shipping_details')),
            'shipping_charges': str(row.get('shipping_charges')) if row.get('shipping_charges') else None,
            'staff_note': safe_str(row.get('staff_note')),
            'exchange_rate': str(row.get('exchange_rate')) if row.get('exchange_rate') else None,
            'round_off_amount': str(row.get('round_off_amount')) if row.get('round_off_amount') else None,
            'total_before_tax': str(row.get('total_before_tax')) if row.get('total_before_tax') else None,
        }


class SellLineMapper:
    """Maps UltimatePOS `transaction_sell_lines` → TSF `OrderLine`."""

    @staticmethod
    def map_row(row, order_mapping=None, product_mapping=None):
        order_id = None
        if row.get('transaction_id') and order_mapping:
            order_id = order_mapping.get(safe_int(row.get('transaction_id')))

        product_id = None
        if row.get('product_id') and product_mapping:
            product_id = product_mapping.get(safe_int(row.get('product_id')))

        if not order_id or not product_id:
            return None  # Can't create line without order and product

        result = {
            'order_id': order_id,
            'product_id': product_id,
            'quantity': safe_decimal(row.get('quantity')),
            'unit_price': safe_decimal(row.get('unit_price_inc_tax') or row.get('unit_price')),
            'vat_amount': safe_decimal(row.get('item_tax')),
            'total': safe_decimal(row.get('quantity', 0)) * safe_decimal(row.get('unit_price_inc_tax') or row.get('unit_price', 0)),
        }

        # Line discount
        disc_type = safe_str(row.get('line_discount_type', '')).lower()
        disc_amount = safe_decimal(row.get('line_discount_amount'))
        if disc_type == 'percentage' and disc_amount > 0:
            result['total'] = result['total'] * (1 - disc_amount / 100)

        return result

    @staticmethod
    def extra_data(row):
        return {
            'variation_id': safe_int(row.get('variation_id')),
            'quantity_returned': str(row.get('quantity_returned')) if row.get('quantity_returned') else None,
            'line_discount_type': safe_str(row.get('line_discount_type')),
            'line_discount_amount': str(row.get('line_discount_amount')) if row.get('line_discount_amount') else None,
            'sell_line_note': safe_str(row.get('sell_line_note')),
        }


class PurchaseLineMapper:
    """Maps UltimatePOS `purchase_lines` → TSF `OrderLine`."""

    @staticmethod
    def map_row(row, order_mapping=None, product_mapping=None):
        order_id = None
        if row.get('transaction_id') and order_mapping:
            order_id = order_mapping.get(safe_int(row.get('transaction_id')))

        product_id = None
        if row.get('product_id') and product_mapping:
            product_id = product_mapping.get(safe_int(row.get('product_id')))

        if not order_id or not product_id:
            return None

        result = {
            'order_id': order_id,
            'product_id': product_id,
            'quantity': safe_decimal(row.get('quantity')),
            'unit_price': safe_decimal(row.get('purchase_price_inc_tax') or row.get('purchase_price')),
            'unit_cost_ht': safe_decimal(row.get('purchase_price')),
            'unit_cost_ttc': safe_decimal(row.get('purchase_price_inc_tax')),
            'vat_amount': safe_decimal(row.get('item_tax')),
            'total': safe_decimal(row.get('quantity', 0)) * safe_decimal(row.get('purchase_price_inc_tax') or row.get('purchase_price', 0)),
        }

        # Expiry date
        exp_date = row.get('exp_date')
        if exp_date and exp_date != 'NULL':
            result['expiry_date'] = safe_str(exp_date)

        return result

    @staticmethod
    def extra_data(row):
        return {
            'variation_id': safe_int(row.get('variation_id')),
            'pp_without_discount': str(row.get('pp_without_discount')) if row.get('pp_without_discount') else None,
            'discount_percent': str(row.get('discount_percent')) if row.get('discount_percent') else None,
            'quantity_sold': str(row.get('quantity_sold')) if row.get('quantity_sold') else None,
            'quantity_adjusted': str(row.get('quantity_adjusted')) if row.get('quantity_adjusted') else None,
            'quantity_returned': str(row.get('quantity_returned')) if row.get('quantity_returned') else None,
            'lot_number': safe_str(row.get('lot_number')),
            'mfg_date': safe_str(row.get('mfg_date')),
        }


class AccountMapper:
    """Maps UltimatePOS `accounts` → TSF `FinancialAccount`."""

    @staticmethod
    def map_row(row):
        return {
            'name': safe_str(row.get('name'), max_length=255),
            'type': 'BANK',  # UltimatePOS accounts are typically bank/cash
        }

    @staticmethod
    def extra_data(row):
        return {
            'account_number': safe_str(row.get('account_number')),
            'account_details': safe_str(row.get('account_details')),
            'account_type_id': safe_int(row.get('account_type_id')),
            'note': safe_str(row.get('note')),
            'is_closed': safe_bool(row.get('is_closed')),
        }


class TaxGroupMapper:
    """Maps UltimatePOS `tax_rates` → TSF `TaxGroup`."""

    @staticmethod
    def map_row(row):
        return {
            'name': safe_str(row.get('name'), max_length=100),
            'rate': safe_decimal(row.get('amount')),
            'is_active': True,
        }

    @staticmethod
    def extra_data(row):
        return {
            'is_tax_group': safe_bool(row.get('is_tax_group')),
            'created_by': safe_int(row.get('created_by')),
        }


class SiteMapper:
    """Maps UltimatePOS `business_locations` → TSF `Site`."""

    @staticmethod
    def map_row(row):
        return {
            'name': safe_str(row.get('name'), max_length=255),
            'code': safe_str(row.get('location_id'), max_length=50) or f"LOC-{row.get('id')}",
            'address': ', '.join(filter(None, [
                safe_str(row.get('landmark')),
                safe_str(row.get('city')),
                safe_str(row.get('state')),
                safe_str(row.get('country')),
            ])),
            'is_active': safe_bool(row.get('is_active'), True),
        }

    @staticmethod
    def extra_data(row):
        return {
            'mobile': safe_str(row.get('mobile')),
            'email': safe_str(row.get('email')),
            'website': safe_str(row.get('website')),
            'zip_code': safe_str(row.get('zip_code')),
        }
