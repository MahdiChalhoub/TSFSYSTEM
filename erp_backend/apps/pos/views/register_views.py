"""
POS Register management views.
Handles register CRUD, session open/close, PIN authentication, and lobby data.
"""
from .base import (
    viewsets, status, Response, action, get_current_tenant_id,
    Organization, User, Warehouse, timezone
)
from django.db.models import Sum, Count, Q
from decimal import Decimal

from apps.pos.models import POSRegister, RegisterSession, Order, CashierAddressBook
from apps.pos.models.register_models import SessionAccountReconciliation



from .register_lobby import RegisterLobbyMixin
from .register_session import RegisterSessionMixin
from .register_order import RegisterOrderMixin
from .register_address_book import RegisterAddressBookMixin

class POSRegisterViewSet(RegisterLobbyMixin, RegisterSessionMixin, RegisterOrderMixin, RegisterAddressBookMixin, viewsets.ModelViewSet):

    """Manages POS registers and sessions."""

    @action(detail=False, methods=['get', 'patch'], url_path='pos-settings')
    def pos_settings(self, request):
        """Read or update the POSSettings for this organisation.
        GET → returns all settings fields.
        PATCH → updates provided fields only.
        """
        from apps.pos.models.register_models import POSSettings
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=org_id)
        settings_obj, _ = POSSettings.objects.get_or_create(organization=organization)

        if request.method == 'GET':
            return Response({
                'restrict_unique_cash_account': settings_obj.restrict_unique_cash_account,
                'allow_negative_stock': settings_obj.allow_negative_stock,
                'require_driver_pos_code': settings_obj.require_driver_pos_code,
                'require_client_delivery_code': settings_obj.require_client_delivery_code,
                'sms_delivery_code_enabled': settings_obj.sms_delivery_code_enabled,
                'loyalty_point_value': float(settings_obj.loyalty_point_value),
                'loyalty_earn_rate': float(settings_obj.loyalty_earn_rate),
                # Authentication
                'requirePinForLogin': settings_obj.require_pin_for_login,
                'allowCashierSwitch': settings_obj.allow_cashier_switch,
                'autoLockIdleMinutes': settings_obj.auto_lock_idle_minutes,
                # Manager overrides
                'requireManagerForVoid': settings_obj.require_manager_for_void,
                'requireManagerForDiscount': settings_obj.require_manager_for_discount,
                'requireManagerForPriceOverride': settings_obj.require_manager_for_price_override,
                'requireManagerForRefund': settings_obj.require_manager_for_refund,
                'requireManagerForClearCart': settings_obj.require_manager_for_clear_cart,
                'requireManagerForDeleteItem': settings_obj.require_manager_for_delete_item,
                'maxDiscountPercent': settings_obj.max_discount_percent,
                # Register close
                'lockRegisterOnClose': settings_obj.lock_register_on_close,
                'printReceiptOnClose': settings_obj.print_receipt_on_close,
                'requireCountOnClose': settings_obj.require_count_on_close,
                # Reconciliation
                'enableReconciliation': settings_obj.enable_reconciliation,
                'controlledAccountsAreTruth': settings_obj.controlled_accounts_are_truth,
                'autoCalibrateToClose': settings_obj.auto_calibrate_to_close,
                'requireStatementOnClose': settings_obj.require_statement_on_close,
                'enableAccountBook': settings_obj.enable_account_book,
                'autoTransferExcessToReserve': settings_obj.auto_transfer_excess_to_reserve,
                'autoDeductShortageFromCashier': settings_obj.auto_deduct_shortage_from_cashier,
            })

        # PATCH — update only provided fields
        CAMEL_TO_SNAKE = {
            'requirePinForLogin': 'require_pin_for_login',
            'allowCashierSwitch': 'allow_cashier_switch',
            'autoLockIdleMinutes': 'auto_lock_idle_minutes',
            'requireManagerForVoid': 'require_manager_for_void',
            'requireManagerForDiscount': 'require_manager_for_discount',
            'requireManagerForPriceOverride': 'require_manager_for_price_override',
            'requireManagerForRefund': 'require_manager_for_refund',
            'requireManagerForClearCart': 'require_manager_for_clear_cart',
            'requireManagerForDeleteItem': 'require_manager_for_delete_item',
            'maxDiscountPercent': 'max_discount_percent',
            'lockRegisterOnClose': 'lock_register_on_close',
            'printReceiptOnClose': 'print_receipt_on_close',
            'requireCountOnClose': 'require_count_on_close',
            'allowNegativeStock': 'allow_negative_stock',
            'enableReconciliation': 'enable_reconciliation',
            'controlledAccountsAreTruth': 'controlled_accounts_are_truth',
            'autoCalibrateToClose': 'auto_calibrate_to_close',
            'requireStatementOnClose': 'require_statement_on_close',
            'enableAccountBook': 'enable_account_book',
            'autoTransferExcessToReserve': 'auto_transfer_excess_to_reserve',
            'autoDeductShortageFromCashier': 'auto_deduct_shortage_from_cashier',
        }
        PATCHABLE = [
            'restrict_unique_cash_account', 'allow_negative_stock',
            'require_driver_pos_code', 'require_client_delivery_code',
            'require_pin_for_login', 'allow_cashier_switch', 'auto_lock_idle_minutes',
            'require_manager_for_void', 'require_manager_for_discount',
            'require_manager_for_price_override', 'require_manager_for_refund',
            'require_manager_for_clear_cart', 'require_manager_for_delete_item',
            'max_discount_percent', 'lock_register_on_close', 'print_receipt_on_close',
            'require_count_on_close', 'enable_reconciliation',
            'controlled_accounts_are_truth', 'auto_calibrate_to_close',
            'require_statement_on_close', 'enable_account_book',
            'auto_transfer_excess_to_reserve', 'auto_deduct_shortage_from_cashier',
        ]
        # Normalize camelCase → snake_case
        data = {}
        for key, val in request.data.items():
            data[CAMEL_TO_SNAKE.get(key, key)] = val

        updated = []
        for field in PATCHABLE:
            if field in data:
                setattr(settings_obj, field, data[field])
                updated.append(field)
        if updated:
            settings_obj.save(update_fields=updated)
        return Response({'message': 'POS settings updated', 'updated_fields': updated})


