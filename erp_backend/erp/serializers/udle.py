from rest_framework import serializers
from ..models import UDLESavedView

class UDLESavedViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = UDLESavedView
        fields = ['id', 'model_name', 'name', 'config', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at', 'user', 'organization']

    def create(self, validated_data):
        request = self.context.get('request')
        if not request:
             raise serializers.ValidationError("Request context missing")
             
        # Check if organization is missing from user
        if not request.user.organization:
            raise serializers.ValidationError("User has no organization assigned")

        validated_data['user'] = request.user
        validated_data['organization'] = request.user.organization
        
        # If this is set as default, unset other defaults for the same model/user
        if validated_data.get('is_default'):
            UDLESavedView.objects.filter(
                user=request.user, 
                model_name=validated_data['model_name']
            ).update(is_default=False)
            
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.get('is_default'):
            UDLESavedView.objects.filter(
                user=instance.user, 
                model_name=instance.model_name
            ).exclude(id=instance.id).update(is_default=False)
        return super().update(instance, validated_data)
