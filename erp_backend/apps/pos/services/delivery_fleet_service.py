from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from erp.connector_engine import connector_engine
from apps.pos.models.driver_models import Driver
from apps.pos.models.delivery_models import DeliveryOrder

class DeliveryFleetService:
    """
    DeliveryFleetService — Orchestrates the lifecycle of delivery fleet operations.
    Handles driver assignment, status transitions, and automated commission/expense logging.
    """

    @classmethod
    @transaction.atomic
    def assign_driver(cls, delivery_id, user_id, actor=None):
        """
        Assigns a driver (represented by their User record) to a DeliveryOrder.
        Automatically sets the driver's status to BUSY.
        """
        try:
            order = DeliveryOrder.objects.get(id=delivery_id)
            driver_profile = Driver.objects.get(user_id=user_id)
            
            if driver_profile.status == 'OFFLINE':
                raise ValueError("Cannot assign an offline driver.")

            order.driver_id = user_id
            order.status = 'DISPATCHED'
            order.save(update_fields=['driver', 'status'])

            # Update driver status to BUSY
            driver_profile.status = 'BUSY'
            driver_profile.save(update_fields=['status'])

            return order
        except Exception as e:
            raise e

    @classmethod
    def on_delivery_completed(cls, order, user=None):
        """
        Triggered when a DeliveryOrder is marked as DELIVERED in SalesWorkflowService.
        Calculates commission and posts an expense to Finance.
        """
        if not order.driver:
            return

        try:
            driver_profile = Driver.objects.get(user=order.driver)
            
            # 1. Update Driver Status (Back to ONLINE if they are active)
            if driver_profile.is_active:
                driver_profile.status = 'ONLINE'
                driver_profile.save(update_fields=['status'])

            # 2. Update Performance Metrics
            driver_profile.total_deliveries += 1
            driver_profile.save(update_fields=['total_deliveries'])

            # 3. Calculate Commission
            commission = cls._calculate_commission(order, driver_profile)
            
            if commission > 0:
                cls._log_commission_expense(order, driver_profile, commission, user)

        except Driver.DoesNotExist:
            pass # No profile, no commission
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error(
                "[DeliveryFleetService] Failed to process delivery completion for order %s: %s",
                order.id, exc, exc_info=True
            )

    @classmethod
    def _calculate_commission(cls, order, driver_profile):
        """
        Logic for commission calculation based on profile settings.
        """
        val = Decimal(driver_profile.commission_value or '0')
        if driver_profile.commission_type == 'FLAT':
            return val
        elif driver_profile.commission_type == 'PERCENT':
            # Percentage of the order's delivery fee? Or total amount?
            # Usually percentage of the delivery fee.
            delivery_fee = Decimal(getattr(order, 'delivery_fee', '0') or '0')
            return (delivery_fee * val / Decimal('100')).quantize(Decimal('0.01'))
        return Decimal('0')

    @classmethod
    def _log_commission_expense(cls, order, driver_profile, amount, user=None):
        """
        Posts a commission expense record to the Finance module via ConnectorEngine.
        This creates a pending payout or a journal entry.
        """
        connector_engine.route_write(
            target_module='finance',
            endpoint='log_delivery_expense',
            data={
                'organization_id': order.organization_id,
                'type': 'COMMISSION',
                'amount': str(amount),
                'beneficiary_user_id': driver_profile.user_id,
                'order_ref': order.order_ref or f'DEL-{order.id}',
                'description': f"Delivery commission for order {order.order_ref}",
                'site_id': getattr(order, 'site_id', None),
                'user_id': user.id if user else None,
            },
            organization_id=order.organization_id,
            source_module='pos',
        )
