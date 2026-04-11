from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id
)
from apps.finance.gateway_models import GatewayConfig

class GatewayConfigViewSet(TenantModelViewSet):
    """Payment gateway CRUD with secure key management."""
    queryset = GatewayConfig.objects.all()

    def get_serializer_class(self):
        from rest_framework import serializers
        from apps.finance.gateway_models import GatewayConfig as GC

        class GatewayConfigSerializer(serializers.ModelSerializer):
            class Meta:
                model = GC
                exclude = ['api_key_encrypted', 'webhook_secret_encrypted']

        return GatewayConfigSerializer

    @action(detail=True, methods=['post'], url_path='set-keys')
    def set_keys(self, request, pk=None):
        """Set encrypted API keys. Body: { "api_key": "sk_...", "webhook_secret": "whsec_..." }"""
        config = self.get_object()
        api_key = request.data.get('api_key')
        webhook_secret = request.data.get('webhook_secret')
        if api_key:
            config.set_api_key(api_key)
        if webhook_secret:
            config.set_webhook_secret(webhook_secret)
        config.save()
        return Response({"message": "Keys updated securely"})

    @action(detail=True, methods=['post'], url_path='test-connection')
    def test_connection(self, request, pk=None):
        """Test gateway connection."""
        config = self.get_object()
        if config.gateway_type == 'STRIPE':
            from apps.finance.stripe_gateway import StripeGatewayService
            service = StripeGatewayService(str(config.organization_id))
            try:
                result = service.retrieve_payment_intent('test')
                if 'error' in result and 'No such payment_intent' in str(result.get('error', '')):
                    return Response({"connected": True, "message": "Stripe API key valid"})
                return Response({"connected": True, "result": result})
            except Exception as e:
                return Response({"connected": False, "error": str(e)}, status=400)
        return Response({"message": f"Connection test not available for {config.gateway_type}"})

    @action(detail=False, methods=['post'], url_path='stripe-webhook')
    def stripe_webhook(self, request):
        """Handle incoming Stripe webhooks (public endpoint)."""
        from apps.finance.stripe_gateway import StripeGatewayService
        from erp.middleware import get_current_tenant_id

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No organization context"}, status=400)

        service = StripeGatewayService(org_id)
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        event = service.verify_webhook(payload, sig_header)
        if not event:
            return Response({"error": "Invalid webhook signature"}, status=400)

        result = service.handle_webhook_event(event)
        return Response(result)
