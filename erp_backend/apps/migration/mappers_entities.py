"""
Entity Mappers — Translate UltimatePOS rows → TSF model field dictionaries.
Each mapper handles one entity type with a map_row() method.
"""
from decimal import Decimal, InvalidOperation
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)



from .mappers_utils import safe_decimal, safe_int, safe_str, safe_bool


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
            'created_by': safe_int(row.get('created_by')),
            'is_tax_group': safe_bool(row.get('is_tax_group')),
        }
