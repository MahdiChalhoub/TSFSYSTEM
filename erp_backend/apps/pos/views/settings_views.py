"""
POS Settings ViewSet — GET and PATCH for the org's POSSettings.
Also provides a test_sms action to verify SMS provider configuration.
"""
from .base import Response, action, status, get_current_tenant_id, Organization
from rest_framework import viewsets

from apps.pos.models.register_models import POSSettings
from apps.pos.services import sms_service


class POSSettingsViewSet(viewsets.ViewSet):
    """
    GET  /api/pos/pos-settings/        — return current org settings
    PATCH /api/pos/pos-settings/       — update settings
    POST  /api/pos/pos-settings/test_sms/ — send a test SMS
    """

    def _get_or_create_settings(self, org):
        ps, _ = POSSettings.objects.get_or_create(organization=org)
        return ps

    # ── GET ──
    def list(self, request):
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'No org context'}, status=400)
        org = Organization.objects.get(id=org_id)
        ps = self._get_or_create_settings(org)
        return Response(self._serialize(ps))

    # ── PATCH ──
    def partial_update(self, request, pk=None):
        return self._update(request)

    def update(self, request, pk=None):
        return self._update(request)

    # Also support PATCH to /pos-settings/ (no PK) via create override
    def create(self, request):
        return self._update(request)

    def _update(self, request):
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'No org context'}, status=400)
        org = Organization.objects.get(id=org_id)
        ps = self._get_or_create_settings(org)

        # Patchable fields (snake_case DB field names)
        fields = [
            'require_driver_pos_code', 'require_client_delivery_code',
            'sms_delivery_code_enabled', 'sms_provider',
            'sms_account_sid', 'sms_api_key', 'sms_sender_id', 'sms_webhook_url',
            'loyalty_point_value', 'loyalty_earn_rate',
            'allow_negative_stock', 'restrict_unique_cash_account',
            'pos_offline_enabled',
            # Authentication
            'require_pin_for_login', 'allow_cashier_switch', 'auto_lock_idle_minutes',
            # Manager overrides
            'require_manager_for_void', 'require_manager_for_discount',
            'require_manager_for_price_override', 'require_manager_for_refund',
            'require_manager_for_clear_cart', 'require_manager_for_delete_item',
            'max_discount_percent',
            # Register close
            'lock_register_on_close', 'print_receipt_on_close', 'require_count_on_close',
            # Reconciliation
            'enable_reconciliation', 'controlled_accounts_are_truth',
            'auto_calibrate_to_close', 'require_statement_on_close',
            'enable_account_book', 'auto_transfer_excess_to_reserve',
            'auto_deduct_shortage_from_cashier',
            # Delivery codes
            'delivery_code_mode', 'delivery_code_digits', 'delivery_code_expiry_hours',
            # SMS triggers
            'sms_on_order_confirm', 'sms_on_delivery_assign', 'sms_on_delivery_complete',
        ]

        # Map frontend camelCase keys → snake_case DB fields
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

        # Normalize request data: convert camelCase → snake_case
        data = {}
        for key, val in request.data.items():
            snake = CAMEL_TO_SNAKE.get(key, key)
            data[snake] = val

        updated = []
        for f in fields:
            if f in data:
                setattr(ps, f, data[f])
                updated.append(f)
        if updated:
            ps.save(update_fields=updated)

        return Response(self._serialize(ps))

    # ── test_sms ──
    @action(detail=False, methods=['post'], url_path='test_sms')
    def test_sms(self, request):
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'No org context'}, status=400)
        org = Organization.objects.get(id=org_id)
        ps = self._get_or_create_settings(org)

        phone = str(request.data.get('phone', '')).strip()
        if not phone:
            return Response({'error': 'Phone number is required'}, status=400)

        sent = sms_service.send_delivery_code_sms(
            phone=phone,
            recipient_name='Test',
            code='123456',
            pos_settings=ps,
        )
        if sent:
            return Response({'ok': True, 'message': f'Test SMS sent to {phone}'})
        return Response(
            {'error': 'SMS sending failed. Check your provider credentials and try again.'},
            status=400,
        )

    def _serialize(self, ps: POSSettings) -> dict:
        return {
            # Delivery codes
            'require_driver_pos_code': ps.require_driver_pos_code,
            'require_client_delivery_code': ps.require_client_delivery_code,
            'delivery_code_mode': ps.delivery_code_mode,
            'delivery_code_digits': ps.delivery_code_digits,
            'delivery_code_expiry_hours': ps.delivery_code_expiry_hours,
            # SMS
            'sms_delivery_code_enabled': ps.sms_delivery_code_enabled,
            'sms_provider': ps.sms_provider,
            'sms_account_sid': ps.sms_account_sid or '',
            'sms_api_key': '••••••••' if ps.sms_api_key else '',
            'sms_sender_id': ps.sms_sender_id or '',
            'sms_webhook_url': ps.sms_webhook_url or '',
            'sms_on_order_confirm': ps.sms_on_order_confirm,
            'sms_on_delivery_assign': ps.sms_on_delivery_assign,
            'sms_on_delivery_complete': ps.sms_on_delivery_complete,
            # Loyalty
            'loyalty_point_value': float(ps.loyalty_point_value),
            'loyalty_earn_rate': float(ps.loyalty_earn_rate),
            # Stock & register isolation
            'allow_negative_stock': ps.allow_negative_stock,
            'restrict_unique_cash_account': ps.restrict_unique_cash_account,
            'pos_offline_enabled': ps.pos_offline_enabled,
            # Authentication (camelCase for frontend compat)
            'requirePinForLogin': ps.require_pin_for_login,
            'allowCashierSwitch': ps.allow_cashier_switch,
            'autoLockIdleMinutes': ps.auto_lock_idle_minutes,
            # Manager overrides
            'requireManagerForVoid': ps.require_manager_for_void,
            'requireManagerForDiscount': ps.require_manager_for_discount,
            'requireManagerForPriceOverride': ps.require_manager_for_price_override,
            'requireManagerForRefund': ps.require_manager_for_refund,
            'requireManagerForClearCart': ps.require_manager_for_clear_cart,
            'requireManagerForDeleteItem': ps.require_manager_for_delete_item,
            'maxDiscountPercent': ps.max_discount_percent,
            # Register close
            'lockRegisterOnClose': ps.lock_register_on_close,
            'printReceiptOnClose': ps.print_receipt_on_close,
            'requireCountOnClose': ps.require_count_on_close,
            # Reconciliation
            'enableReconciliation': ps.enable_reconciliation,
            'controlledAccountsAreTruth': ps.controlled_accounts_are_truth,
            'autoCalibrateToClose': ps.auto_calibrate_to_close,
            'requireStatementOnClose': ps.require_statement_on_close,
            'enableAccountBook': ps.enable_account_book,
            'autoTransferExcessToReserve': ps.auto_transfer_excess_to_reserve,
            'autoDeductShortageFromCashier': ps.auto_deduct_shortage_from_cashier,
        }

