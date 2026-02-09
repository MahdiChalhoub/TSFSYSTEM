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
                    # ROOT LOGIN (SaaS Panel) - User must belong to 'saas' org
                    user_obj = User.objects.get(username=username, organization__slug='saas')
                    
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

class OrganizationMinimalSerializer(serializers.Serializer):
    """Lightweight org info returned with user data."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.SlugField()

class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    organization = OrganizationMinimalSerializer(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'is_staff', 'is_superuser', 'organization', 'role']

class BusinessRegistrationSerializer(serializers.Serializer):
    # Business Details
    business_name = serializers.CharField(max_length=255)
    business_slug = serializers.SlugField()
    
    # Admin User Details
    admin_first_name = serializers.CharField(max_length=150)
    admin_last_name = serializers.CharField(max_length=150)
    admin_username = serializers.CharField(max_length=150)
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(write_only=True, min_length=8)
    
    # Optional Profile Details
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    country = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_business_slug(self, value):
        from erp.models import Organization
        if Organization.objects.filter(slug=value.lower()).exists():
            raise serializers.ValidationError(_("This business slug is already taken."))
        return value.lower()

    def validate_admin_username(self, value):
        return value
