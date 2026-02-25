from .base import (
    Response, action, TenantModelViewSet
)
from apps.pos.discount_models import DiscountRule, DiscountUsageLog
from apps.pos.serializers import DiscountRuleSerializer, DiscountUsageLogSerializer

class DiscountRuleViewSet(TenantModelViewSet):
    """CRUD for discount rules + toggle and usage log."""
    queryset = DiscountRule.objects.select_related('product', 'category', 'brand', 'created_by').all()
    serializer_class = DiscountRuleSerializer

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """Toggle active/inactive."""
        rule = self.get_object()
        rule.is_active = not rule.is_active
        rule.save(update_fields=['is_active'])
        return Response(DiscountRuleSerializer(rule).data)

    @action(detail=True, methods=['get'], url_path='usage-log')
    def usage_log(self, request, pk=None):
        """Get usage log for this rule."""
        rule = self.get_object()
        logs = DiscountUsageLog.objects.filter(rule=rule).select_related('order', 'applied_by')[:50]
        return Response(DiscountUsageLogSerializer(logs, many=True).data)

    @action(detail=False, methods=['get'], url_path='active-rules')
    def active_rules(self, request):
        """Get all active & valid rules (for POS checkout)."""
        rules = self.get_queryset().filter(is_active=True)
        valid = [r for r in rules if r.is_valid]
        return Response(DiscountRuleSerializer(valid, many=True).data)
