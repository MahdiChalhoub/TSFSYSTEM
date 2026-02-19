import csv
import io
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from datetime import datetime

logger = logging.getLogger(__name__)

class SalesImportService:
    """
    Service for batch importing sales data from CSV sources.
    Handles mapping, validation, and creation of Orders/Lines with full stock/ledger side-effects.
    """

    @staticmethod
    def process_csv(organization, user, warehouse_id, csv_file, mapping, scope='INTERNAL'):
        """
        mapping: {
            'date': 'Column Name',
            'product_sku': 'Column Name',
            'quantity': 'Column Name',
            'unit_price': 'Column Name',
            'client_name': 'Column Name' (optional),
            'ref': 'Column Name' (optional)
        }
        """
        from erp.models import Warehouse, GlobalCurrency
        from apps.pos.models import Order, OrderLine
        from apps.inventory.models import Product
        from apps.pos.services import POSService
        
        warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)
        
        # Read the CSV
        file_content = csv_file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(file_content))
        
        results = {
            'total_rows': 0,
            'success_count': 0,
            'error_count': 0,
            'errors': []
        }

        # Process in chunks or one by one?
        # One by one within a transaction per row is safer for varied data
        for row_idx, row in enumerate(reader):
            results['total_rows'] += 1
            try:
                with transaction.atomic():
                    # 1. Extract data based on mapping
                    sku = row.get(mapping['product_sku'])
                    qty_str = row.get(mapping['quantity'])
                    price_str = row.get(mapping['unit_price'])
                    date_str = row.get(mapping['date'])
                    
                    if not all([sku, qty_str, price_str]):
                        raise ValidationError("Missing required fields for product, quantity, or price.")

                    product = Product.objects.get(sku=sku, organization=organization)
                    qty = Decimal(qty_str.replace(',', ''))
                    price = Decimal(price_str.replace(',', ''))
                    
                    # Parse date if provided, fallback to now
                    tx_date = timezone.now()
                    if date_str:
                        try:
                            tx_date = timezone.make_aware(datetime.strptime(date_str, "%Y-%m-%d"))
                        except (ValueError, TypeError):
                            try:
                                tx_date = timezone.make_aware(datetime.strptime(date_str, "%d/%m/%Y"))
                            except (ValueError, TypeError):
                                pass # Keep now() if all date formats fail

                    # 2. Use POS logic to create the sale
                    # Note: We need a slight variation of checkout() that accepts a custom date
                    # For now, we manually implement a simplified version or call checkout and then update date
                    
                    items = [{
                        'product_id': product.id,
                        'quantity': qty,
                        'unit_price': price
                    }]
                    
                    # Note: We use a temp payment account (Suspense) if none mapped
                    # In a real import, the user should define the payment account
                    payment_acc_id = mapping.get('payment_account_id')
                    
                    order = POSService.checkout(
                        organization=organization,
                        user=user,
                        warehouse=warehouse,
                        payment_account_id=payment_acc_id,
                        items=items,
                        scope=scope
                    )
                    
                    # Force historical date
                    order.created_at = tx_date
                    order.save(update_fields=['created_at'])
                    
                    # Also update the Ledger entry date if it was created
                    from apps.finance.models import JournalEntry
                    entry = JournalEntry.objects.filter(reference=f"POS-{order.id}").first()
                    if entry:
                        entry.transaction_date = tx_date
                        entry.save(update_fields=['transaction_date'])

                    results['success_count'] += 1
                    
            except Exception as e:
                results['error_count'] += 1
                results['errors'].append({
                    'row': row_idx + 1,
                    'error': str(e)
                })
                logger.error(f"[SALE_IMPORT] Row {row_idx+1} failure: {e}")

        return results
