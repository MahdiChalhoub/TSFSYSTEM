"""
Integrations App — Webhook Subscription CRUD Views
====================================================
Tenant admins configure outbound webhook subscriptions here.
"""
import logging
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.views import TenantModelViewSet
from .event_models import WebhookSubscription, WebhookDeliveryLog, SUPPORTED_EVENTS

logger = logging.getLogger('integrations.views')


class WebhookSubscriptionSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model = WebhookSubscription
        fields = [
            'id', 'event_type', 'event_type_display',
            'target_url', 'secret', 'description',
            'is_active', 'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'secret': {'write_only': True},  # Do not expose in GET responses
        }


class WebhookDeliveryLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookDeliveryLog
        fields = [
            'id', 'event_type', 'response_status', 'response_body',
            'delivered_at', 'failed', 'error_message', 'retry_count', 'created_at',
        ]
        read_only_fields = fields


class WebhookSubscriptionViewSet(TenantModelViewSet):
    """
    CRUD for org-specific outbound webhook subscriptions.

    GET    /api/integrations/webhooks/                     → list
    POST   /api/integrations/webhooks/                     → create
    GET    /api/integrations/webhooks/{id}/                → detail
    PATCH  /api/integrations/webhooks/{id}/                → update
    DELETE /api/integrations/webhooks/{id}/                → delete
    GET    /api/integrations/webhooks/{id}/delivery-logs/  → delivery audit trail
    POST   /api/integrations/webhooks/{id}/test/           → fire test ping
    GET    /api/integrations/webhooks/supported-events/    → list supported event types
    """
    queryset = WebhookSubscription.objects.all()
    serializer_class = WebhookSubscriptionSerializer

    @action(detail=False, methods=['get'], url_path='supported-events')
    def supported_events(self, request):
        """Returns the list of event types available for subscription."""
        return Response([
            {'value': code, 'label': label}
            for code, label in SUPPORTED_EVENTS
        ])

    @action(detail=True, methods=['get'], url_path='delivery-logs')
    def delivery_logs(self, request, pk=None):
        """Returns the 50 most recent delivery attempts for this subscription."""
        subscription = self.get_object()
        logs = WebhookDeliveryLog.objects.filter(
            subscription=subscription,
        ).order_by('-created_at')[:50]
        return Response(WebhookDeliveryLogSerializer(logs, many=True).data)

    @action(detail=True, methods=['post'], url_path='test')
    def send_test(self, request, pk=None):
        """
        Fires a synthetic 'webhook.test' event to the subscription URL.
        Useful for verifying connectivity before production use.
        """
        subscription = self.get_object()
        import json, hmac, hashlib, requests
        from django.utils import timezone

        test_payload = {
            'event': 'webhook.test',
            'timestamp': timezone.now().isoformat(),
            'organization_slug': subscription.organization.slug,
            'data': {'message': 'This is a test delivery from TSFSYSTEM.'},
        }
        body = json.dumps(test_payload).encode('utf-8')
        headers = {'Content-Type': 'application/json', 'X-TSFSYSTEM-Event': 'webhook.test'}
        if subscription.secret:
            sig = hmac.new(subscription.secret.encode(), body, hashlib.sha256).hexdigest()
            headers['X-TSFSYSTEM-Signature'] = f"sha256={sig}"

        try:
            resp = requests.post(subscription.target_url, data=body, headers=headers, timeout=5)
            return Response({
                'delivered': True,
                'response_status': resp.status_code,
                'response_body': resp.text[:500],
            })
        except Exception as e:
            return Response({'delivered': False, 'error': str(e)}, status=500)
