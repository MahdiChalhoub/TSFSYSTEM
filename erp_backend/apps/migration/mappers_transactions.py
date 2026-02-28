"""
Entity Mappers — Translate UltimatePOS rows → TSF model field dictionaries.
Each mapper handles one entity type with a map_row() method.
"""
from decimal import Decimal, InvalidOperation
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)



from .mappers_utils import safe_decimal, safe_int, safe_str, safe_bool


class TransactionMapper:
    """Maps UltimatePOS `transactions` → TSF `Order`."""

    TYPE_MAP = {
        'purchase': 'PURCHASE',
        'sell': 'SALE',
        'purchase_return': 'RETURN',
        'sell_return': 'RETURN',
        'expense': None,  # Handled separately by _migrate_expenses
        'stock_adjustment': None,  # Handled separately (no TSF Order equivalent)
        'purchase_order': 'PURCHASE',
        'sales_order': 'SALE',
        'opening_stock': None,  # Handled via variation_location_details
        'purchase_transfer': None,  # Handled separately by _migrate_transfers
        'sell_transfer': None,  # Handled separately by _migrate_transfers
        '': None,  # Handle NULL/empty type gracefully
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

        total_amount = safe_decimal(row.get('final_total'))
        tax_amount = safe_decimal(row.get('tax_amount'))
        
        # If the source had 0% tax but we want to display the implied tax component
        if tax_amount == Decimal('0.00') and total_amount > 0:
            # Try to detect rate from tax_id mapping if possible, otherwise use 18%
            tax_rate_val = Decimal('18.00')
            # Note: mapping might not be available here, fallback to historical 18%
            tax_amount = (total_amount - (total_amount / (Decimal('1.00') + (tax_rate_val / Decimal('100'))))).quantize(Decimal('0.01'))

        result = {
            'type': tsf_type,
            'status': status,
            'ref_code': safe_str(row.get('ref_no') or row.get('invoice_no'), max_length=100),
            'invoice_number': safe_str(row.get('invoice_no') or row.get('ref_no'), max_length=100),
            'total_amount': total_amount,
            'tax_amount': tax_amount,
            'discount': safe_decimal(row.get('discount_amount')),
            'payment_method': payment_method,
            'notes': safe_str(row.get('additional_notes')),
            'created_at': safe_str(row.get('transaction_date') or row.get('created_at')),
            'scope': 'INTERNAL',
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
            'tax_rate': safe_decimal(row.get('item_tax')) / safe_decimal(row.get('unit_price')) * 100 if safe_decimal(row.get('unit_price')) > 0 else Decimal('0.00'),
            'subtotal': safe_decimal(row.get('quantity', 0)) * safe_decimal(row.get('unit_price_inc_tax') or row.get('unit_price', 0)),
            'expiry_date': safe_str(row.get('exp_date'))[:10] if row.get('exp_date') else None,
            'batch_number': safe_str(row.get('lot_number'), max_length=100),
        }

        # Line discount
        disc_type = safe_str(row.get('line_discount_type', '')).lower()
        disc_amount = safe_decimal(row.get('line_discount_amount'))
        if disc_type == 'percentage' and disc_amount > 0:
            result['discount_rate'] = disc_amount
            result['subtotal'] = result['subtotal'] * (1 - disc_amount / 100)

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
            'line_total': safe_decimal(row.get('quantity', 0)) * safe_decimal(row.get('purchase_price_inc_tax') or row.get('purchase_price', 0)),
            'expiry_date': safe_str(row.get('exp_date'))[:10] if row.get('exp_date') else None,
            'batch_number': safe_str(row.get('lot_number'), max_length=100),
        }

        # Expiry date
        # PurchaseOrderLine doesn't have expiry_date in current model, 
        # but we can add it to description if needed
        exp_date = row.get('exp_date')
        if exp_date and exp_date != 'NULL':
            result['description'] = f"Exp Date: {exp_date}"

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


class ExpenseMapper:
    """Maps UltimatePOS `transactions` (type=expense) → TSF `DirectExpense`."""

    # Map UPOS expense category names to TSF categories
    CATEGORY_KEYWORD_MAP = {
        'rent': 'RENT', 'loyer': 'RENT', 'bail': 'RENT', 'loyers': 'RENT',
        'electric': 'UTILITIES', 'eau': 'UTILITIES', 'water': 'UTILITIES', 'utility': 'UTILITIES', 'utilities': 'UTILITIES',
        'office': 'OFFICE_SUPPLIES', 'bureau': 'OFFICE_SUPPLIES', 'fourniture': 'OFFICE_SUPPLIES', 'fournitures': 'OFFICE_SUPPLIES',
        'salary': 'SALARIES', 'salaire': 'SALARIES', 'wage': 'SALARIES', 'paie': 'SALARIES', 'salaires': 'SALARIES',
        'maintenance': 'MAINTENANCE', 'repair': 'MAINTENANCE', 'entretien': 'MAINTENANCE', 'reparation': 'MAINTENANCE',
        'transport': 'TRANSPORT', 'fuel': 'TRANSPORT', 'carburant': 'TRANSPORT', 'delivery': 'TRANSPORT', 'voyage': 'TRANSPORT', 'deplacement': 'TRANSPORT',
        'phone': 'TELECOM', 'internet': 'TELECOM', 'telecom': 'TELECOM', 'mobile': 'TELECOM',
        'legal': 'PROFESSIONAL_FEES', 'audit': 'PROFESSIONAL_FEES', 'consulting': 'PROFESSIONAL_FEES', 'honoraires': 'PROFESSIONAL_FEES',
        'tax': 'TAXES_FEES', 'impot': 'TAXES_FEES', 'fee': 'TAXES_FEES', 'licence': 'TAXES_FEES', 'taxe': 'TAXES_FEES', 'taxes': 'TAXES_FEES',
        'marketing': 'MARKETING', 'ads': 'MARKETING', 'publicite': 'MARKETING', 'pub': 'MARKETING',
    }

    @staticmethod
    def map_row(row, expense_category_name=None):
        t_date = row.get('transaction_date', '')
        # Simple date extraction YYYY-MM-DD
        if isinstance(t_date, str) and len(t_date) >= 10:
            t_date = t_date[:10]
        else:
            from django.utils import timezone
            t_date = timezone.now().date().isoformat()

        # Determine category from expense_category_name
        category = 'OTHER'
        if expense_category_name:
            name_lower = str(expense_category_name).lower()
            for keyword, cat in ExpenseMapper.CATEGORY_KEYWORD_MAP.items():
                if keyword in name_lower:
                    category = cat
                    break

        return {
            'name': safe_str(row.get('additional_notes'), max_length=200) or f"Expense {row.get('id')}",
            'description': safe_str(row.get('additional_notes')),
            'amount': safe_decimal(row.get('final_total')),
            'date': t_date,
            'reference': safe_str(row.get('ref_no'), max_length=100),
            'category': category,
            'status': 'POSTED' if safe_str(row.get('status')) == 'final' else 'DRAFT',
            'scope': 'INTERNAL',
            'created_at': safe_str(row.get('transaction_date') or row.get('created_at')),
        }


class TransactionPaymentMapper:
    """Maps UltimatePOS `transaction_payments` → TSF `Payment`."""

    METHOD_MAP = {
        'cash': 'CASH',
        'card': 'CARD',
        'cheque': 'CHECK',
        'bank_transfer': 'BANK',
        'other': 'OTHER',
        'custom_pay_1': 'OTHER',
        'custom_pay_2': 'OTHER',
        'custom_pay_3': 'OTHER',
        'advance': 'OTHER',
    }

    @staticmethod
    def map_row(row, order_mapping=None, contact_mapping=None, 
                account_mapping=None, transaction_contact_map=None,
                transaction_type_map=None):
        """Map a UPOS transaction_payment to TSF Payment fields."""
        amount = safe_decimal(row.get('amount'))
        method = TransactionPaymentMapper.METHOD_MAP.get(
            safe_str(row.get('method', 'cash')).lower(), 'OTHER'
        )

        # Resolve the linked order
        tx_id = safe_int(row.get('transaction_id'))
        order_id = None
        if tx_id and order_mapping:
            order_id = order_mapping.get(tx_id)

        # Resolve contact from the transaction
        contact_id = None
        if tx_id and transaction_contact_map:
            source_contact_id = transaction_contact_map.get(tx_id)
            if source_contact_id and contact_mapping:
                contact_id = contact_mapping.get(source_contact_id)

        # Resolve payment account
        payment_account_id = None
        source_account_id = safe_int(row.get('account_id'))
        if source_account_id and account_mapping:
            payment_account_id = account_mapping.get(source_account_id)

        # Determine payment type from order type
        payment_type = 'CUSTOMER_RECEIPT'  # default
        if tx_id and transaction_type_map:
            tx_type = transaction_type_map.get(tx_id, '')
            if tx_type in ('purchase', 'purchase_order'):
                payment_type = 'SUPPLIER_PAYMENT'
            elif tx_type in ('sell_return', 'purchase_return'):
                payment_type = 'REFUND'

        is_return = safe_bool(row.get('is_return'))
        if is_return:
            payment_type = 'REFUND'

        # Parse payment date
        paid_on = row.get('paid_on', '')
        if isinstance(paid_on, str) and len(paid_on) >= 10:
            payment_date = paid_on[:10]
        else:
            payment_date = None  # Will need to be set to today as fallback

        result = {
            'type': payment_type,
            'amount': abs(amount),  # Always positive in TSF
            'method': method,
            'payment_date': payment_date,
            'reference': safe_str(row.get('payment_ref_no'), max_length=100) or safe_str(row.get('transaction_no'), max_length=100),
            'description': safe_str(row.get('note')),
            'status': 'POSTED',
            'scope': 'INTERNAL',
            'created_at': safe_str(row.get('paid_on') or row.get('created_at')),
        }

        if contact_id:
            result['contact_id'] = contact_id
        if order_id:
            # Determine link field based on payment type
            if payment_type == 'SUPPLIER_PAYMENT':
                result['supplier_invoice_id'] = order_id
            else:
                result['sales_order_id'] = order_id
        if payment_account_id:
            result['payment_account_id'] = payment_account_id

        return result

    @staticmethod
    def extra_data(row):
        return {
            'card_type': safe_str(row.get('card_type')),
            'card_holder_name': safe_str(row.get('card_holder_name')),
            'card_number': safe_str(row.get('card_number')),
            'cheque_number': safe_str(row.get('cheque_number')),
            'bank_account_number': safe_str(row.get('bank_account_number')),
            'gateway': safe_str(row.get('gateway')),
            'is_advance': safe_bool(row.get('is_advance')),
            'payment_for': safe_str(row.get('payment_for')),
            'parent_id': safe_int(row.get('parent_id')),
        }
