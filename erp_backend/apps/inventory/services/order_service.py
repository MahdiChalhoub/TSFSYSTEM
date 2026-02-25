from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .base import logger

class OrderService:
    @staticmethod
    def process_adjustment_order(organization, order, user=None):
        from apps.inventory.models import StockAdjustmentLine
        from .stock_service import StockService

        lines = StockAdjustmentLine.objects.filter(order=order)
        
        if not lines.exists():
            raise ValidationError("Cannot post an empty adjustment order.")
            
        with transaction.atomic():
            order.lifecycle_status = 'LOCKED'
            order.save(update_fields=['lifecycle_status'])
            
            finance_lines = []
            from erp.services import ConfigurationService
            rules = ConfigurationService.get_posting_rules(organization)
            inv_acc = rules.get('sales', {}).get('inventory')
            adj_acc = rules.get('inventory', {}).get('adjustment')
            
            for line in lines:
                StockService.adjust_stock(
                    organization=organization,
                    product=line.product,
                    warehouse=line.warehouse,
                    quantity=line.qty_adjustment,
                    reason=line.reason or order.reason or f"ADJ Order #{order.id}",
                    reference=order.reference,
                    user=user,
                    skip_finance=True
                )
                
                if inv_acc and adj_acc:
                    cost_basis = Decimal(str(line.product.cost_price))
                    adj_value = abs(line.qty_adjustment * cost_basis)
                    if line.qty_adjustment > 0:
                        finance_lines.append({"account_id": inv_acc, "debit": adj_value, "credit": Decimal('0')})
                        finance_lines.append({"account_id": adj_acc, "debit": Decimal('0'), "credit": adj_value})
                    else:
                        finance_lines.append({"account_id": adj_acc, "debit": adj_value, "credit": Decimal('0')})
                        finance_lines.append({"account_id": inv_acc, "debit": Decimal('0'), "credit": adj_value})

            if finance_lines:
                try:
                    from apps.finance.services import LedgerService
                    LedgerService.create_journal_entry(
                        organization=organization, transaction_date=timezone.now(),
                        description=f"Bulk Stock Adjustment: {order.reference}",
                        reference=order.reference, status='POSTED',
                        user=user, lines=finance_lines
                    )
                except (ImportError, Exception):
                    logger.warning("Finance module unavailable for bulk adjustment posting.")

            order.is_posted = True
            order.lifecycle_status = 'CONFIRMED'
            order.save(update_fields=['is_posted', 'lifecycle_status'])
            
            from apps.finance.services import ForensicAuditService
            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="StockAdjustmentOrder",
                object_id=order.id,
                change_type="UPDATE",
                payload={"ref": order.reference, "status": "CONFIRMED"}
            )
            
        return True

    @staticmethod
    def process_transfer_order(organization, order, user=None):
        from apps.inventory.models import StockTransferLine
        from .stock_service import StockService

        lines = StockTransferLine.objects.filter(order=order)
        
        if not lines.exists():
            raise ValidationError("Cannot post an empty transfer order.")
            
        with transaction.atomic():
            order.lifecycle_status = 'LOCKED'
            order.save(update_fields=['lifecycle_status'])
            
            for line in lines:
                StockService.transfer_stock(
                    organization=organization,
                    product=line.product,
                    source_warehouse=line.from_warehouse,
                    destination_warehouse=line.to_warehouse,
                    quantity=line.qty_transferred,
                    reference=order.reference,
                    user=user
                )
            
            order.is_posted = True
            order.lifecycle_status = 'CONFIRMED'
            order.save(update_fields=['is_posted', 'lifecycle_status'])

            from apps.finance.services import ForensicAuditService
            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="StockTransferOrder",
                object_id=order.id,
                change_type="UPDATE",
                payload={"ref": order.reference, "status": "CONFIRMED"}
            )
            
        return True
