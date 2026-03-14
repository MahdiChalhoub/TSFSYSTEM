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

        fields = [
            'require_driver_pos_code', 'require_client_delivery_code',
            'sms_delivery_code_enabled', 'sms_provider',
            'sms_account_sid', 'sms_api_key', 'sms_sender_id', 'sms_webhook_url',
            'loyalty_point_value', 'loyalty_earn_rate',
            'allow_negative_stock', 'restrict_unique_cash_account',
            'pos_offline_enabled',
        ]
        updated = []
        for f in fields:
            if f in request.data:
                setattr(ps, f, request.data[f])
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
            'require_driver_pos_code': ps.require_driver_pos_code,
            'require_client_delivery_code': ps.require_client_delivery_code,
            'sms_delivery_code_enabled': ps.sms_delivery_code_enabled,
            'sms_provider': ps.sms_provider,
            'sms_account_sid': ps.sms_account_sid or '',
            # Never expose raw API key — mask it
            'sms_api_key': '••••••••' if ps.sms_api_key else '',
            'sms_sender_id': ps.sms_sender_id or '',
            'sms_webhook_url': ps.sms_webhook_url or '',
            'loyalty_point_value': float(ps.loyalty_point_value),
            'loyalty_earn_rate': float(ps.loyalty_earn_rate),
            'allow_negative_stock': ps.allow_negative_stock,
            'restrict_unique_cash_account': ps.restrict_unique_cash_account,
            'pos_offline_enabled': ps.pos_offline_enabled,
        }
