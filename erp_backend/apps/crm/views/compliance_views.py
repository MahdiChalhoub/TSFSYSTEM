from erp.views import TenantModelViewSet
from apps.crm.models import ComplianceRule, ComplianceEvent
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response

class ComplianceRuleSerializer(serializers.ModelSerializer):
    block_level_display = serializers.CharField(source='get_block_level_display', read_only=True)
    class Meta:
        model = ComplianceRule
        fields = '__all__'

class ComplianceEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    actor_name = serializers.CharField(source='actor.username', read_only=True)
    class Meta:
        model = ComplianceEvent
        fields = '__all__'

class ComplianceRuleViewSet(TenantModelViewSet):
    """Admin API for managing enterprise compliance rules."""
    queryset = ComplianceRule.objects.all()
    serializer_class = ComplianceRuleSerializer

    @action(detail=False, methods=['get'])
    def resolve_rules(self, request):
        """Find applicable rules for a specific contact."""
        from apps.crm.models import Contact
        from apps.crm.services.compliance_service import ComplianceResolver
        
        contact_id = request.query_params.get('contact_id')
        if not contact_id:
            return Response({"error": "contact_id required"}, status=400)
            
        contact = Contact.objects.filter(id=contact_id).first()
        if not contact:
            return Response({"error": "Contact not found"}, status=404)
            
        rules = ComplianceResolver.resolve_rules(contact)
        return Response(ComplianceRuleSerializer(rules, many=True).data)

class ComplianceEventViewSet(TenantModelViewSet):
    """Audit viewer for compliance events."""
    queryset = ComplianceEvent.objects.all()
    serializer_class = ComplianceEventSerializer
    http_method_names = ['get'] # Read-only audit trail
