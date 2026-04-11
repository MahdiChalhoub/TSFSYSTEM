from rest_framework import serializers
from apps.crm.models import (
    RelationshipAssignment, FollowUpPolicy, ScheduledActivity, 
    ActivityReminder, InteractionLog, SupplierProductPolicy
)
from django.contrib.auth import get_user_model

User = get_user_model()

class RelationshipAssignmentSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.username', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.username', read_only=True)
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    
    class Meta:
        model = RelationshipAssignment
        fields = '__all__'

class FollowUpPolicySerializer(serializers.ModelSerializer):
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)
    trigger_type_display = serializers.CharField(source='get_trigger_type_display', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.username', read_only=True)
    
    class Meta:
        model = FollowUpPolicy
        fields = '__all__'

class ScheduledActivitySerializer(serializers.ModelSerializer):
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.username', read_only=True)
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    
    class Meta:
        model = ScheduledActivity
        fields = '__all__'

class ActivityReminderSerializer(serializers.ModelSerializer):
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ActivityReminder
        fields = '__all__'

class InteractionLogSerializer(serializers.ModelSerializer):
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    outcome_display = serializers.CharField(source='get_outcome_display', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = InteractionLog
        fields = '__all__'

class SupplierProductPolicySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.sku', read_only=True)
    reorder_mode_display = serializers.CharField(source='get_reorder_mode_display', read_only=True)
    assigned_buyer_name = serializers.CharField(source='assigned_buyer.username', read_only=True)
    
    class Meta:
        model = SupplierProductPolicy
        fields = '__all__'
