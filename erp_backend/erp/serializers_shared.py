from rest_framework import serializers
from .models import User

class UserValueSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'name')
