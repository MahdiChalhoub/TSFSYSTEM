from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from erp.models import User

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
                user_obj = User.objects.get(username=username)
                if user_obj.registration_status == 'PENDING':
                    raise serializers.ValidationError(_("Security Clearance Required. Your enlistment is still being processed."), code='pending')
                if user_obj.registration_status == 'REJECTED':
                    raise serializers.ValidationError(_("Access Denied. Your registration was not approved by command."), code='rejected')
            except User.DoesNotExist:
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

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'is_staff', 'is_superuser']
