from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from erp.models import User, Role

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(label=_("Username"))
    password = serializers.CharField(
        label=_("Password"),
        style={'input_type': 'password'},
        trim_whitespace=False
    )

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if username and password:
            # Check if user exists first to provide better feedback
            try:
                from erp.middleware import get_current_tenant_id
                tenant_id = get_current_tenant_id()
                
                # Filter by tenant if present, otherwise assume root/null org
                if tenant_id:
                    user_obj = User.objects.get(username=username, organization_id=tenant_id)
                else:
                    # ROOT LOGIN (SaaS Panel) - User must belong to 'saas' org OR have null org (legacy)
                    try:
                        user_obj = User.objects.get(username=username, organization__slug='saas')
                    except User.DoesNotExist:
                        # Fallback: legacy null org users
                        user_obj = User.objects.get(username=username, organization__isnull=True)
                    
                    # STRICT ACCESS CONTROL: Only SaaS Staff can enter the Root Panel
                    if not (user_obj.is_staff or user_obj.is_superuser):
                         raise serializers.ValidationError(_("Access Restricted. Only SaaS Federation Staff authorized."), code='forbidden')

                # Note: registration_status check removed if model doesn't have it yet, 
                # but I'll check model definition again.
            except (User.DoesNotExist, User.MultipleObjectsReturned):
                pass

            user = authenticate(request=self.context.get('request'),
                                username=username, password=password)

            if not user:
                msg = _('Unable to log in with provided credentials.')
                raise serializers.ValidationError(msg, code='authorization')
        else:
            msg = _('Must include "username" and "password".')
            raise serializers.ValidationError(msg, code='authorization')

        attrs['user'] = user
        return attrs

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name']

class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'is_staff', 'is_superuser', 'organization', 'role']
