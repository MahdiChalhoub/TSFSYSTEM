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
                    from erp.connector_engine import connector_engine
                    connector_engine.route_write(
                        target_module='finance',
                        endpoint='post_stock_adjustment',
                        data={
                            'organization_id': organization.id,
                            'adjustment_amount': str(sum(l['debit'] for l in finance_lines if l['debit'] > 0)),
                            'reference': order.reference,
                            'reason': f"Bulk Stock Adjustment: {order.reference}",
                            'user_id': user.id if user else None,
                        },
                        organization_id=organization.id,
                        source_module='inventory',
                    )
                except Exception:
                    logger.warning("Finance module unavailable for bulk adjustment posting.")

            order.is_posted = True
            order.lifecycle_status = 'CONFIRMED'
            order.save(update_fields=['is_posted', 'lifecycle_status'])
            
            try:
                from erp.connector_engine import connector_engine
                connector_engine.route_write(
                    target_module='finance',
                    endpoint='log_audit_mutation',
                    data={
                        'organization_id': organization.id,
                        'user_id': user.id if user else None,
                        'model_name': 'StockAdjustmentOrder',
                        'object_id': order.id,
                        'change_type': 'UPDATE',
                        'payload': {'ref': order.reference, 'status': 'CONFIRMED'},
                    },
                    organization_id=organization.id,
                    source_module='inventory',
                )
            except Exception:
                pass
            
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

            try:
                from erp.connector_engine import connector_engine
                connector_engine.route_write(
                    target_module='finance',
                    endpoint='log_audit_mutation',
                    data={
                        'organization_id': organization.id,
                        'user_id': user.id if user else None,
                        'model_name': 'StockTransferOrder',
                        'object_id': order.id,
                        'change_type': 'UPDATE',
                        'payload': {'ref': order.reference, 'status': 'CONFIRMED'},
                    },
                    organization_id=organization.id,
                    source_module='inventory',
                )
            except Exception:
                pass
            
        return True
