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
            user_obj = None
            try:
                from erp.middleware import get_current_tenant_id
                tenant_id = get_current_tenant_id()
                
                # Filter by tenant if present, otherwise assume root/null org
                if tenant_id:
                    user_obj = User.objects.filter(username=username, organization_id=tenant_id).first()
                else:
                    # ROOT LOGIN (SaaS Panel) - User must belong to 'saas' org
                    user_obj = User.objects.filter(username=username, organization__slug='saas').first()
                    
                    # STRICT ACCESS CONTROL: Only SaaS Staff can enter the Root Panel
                    if user_obj and not (user_obj.is_staff or user_obj.is_superuser):
                         raise serializers.ValidationError(_("Access Restricted. Only SaaS Federation Staff authorized."), code='forbidden')

            except serializers.ValidationError:
                raise  # Re-raise validation errors
            except Exception:
                pass

            # 1. Try main password (Django authenticate) → full 'internal' access
            # Authenticate respects our TenantAuthBackend which uses get_current_tenant_id()
            user = authenticate(request=self.context.get('request'),
                                username=username, password=password)

            if user:
                attrs['user'] = user
                attrs['scope_access'] = 'internal'  # Main password = full access
                return attrs

            # 2. If main auth failed, check scope passwords
            # SECURITY: scope PIN lookup must respect tenant isolation
            if not user_obj:
                try:
                    from erp.middleware import get_current_tenant_id
                    tenant_id = get_current_tenant_id()
                    if tenant_id:
                        user_obj = User.objects.filter(username=username, organization_id=tenant_id, is_active=True).first()
                    else:
                        user_obj = User.objects.filter(username=username, organization__slug='saas', is_active=True).first()
                except Exception:
                    pass

            if user_obj and user_obj.is_active:
                # Check Official scope password → official-only access
                if user_obj.scope_pin_official and user_obj.check_scope_pin('official', password):
                    attrs['user'] = user_obj
                    attrs['scope_access'] = 'official'
                    return attrs

                # Check Internal scope password → full access
                if user_obj.scope_pin_internal and user_obj.check_scope_pin('internal', password):
                    attrs['user'] = user_obj
                    attrs['scope_access'] = 'internal'
                    return attrs

            msg = _('Unable to log in with provided credentials.')
            raise serializers.ValidationError(msg, code='authorization')
        else:
            msg = _('Must include "username" and "password".')
            raise serializers.ValidationError(msg, code='authorization')

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
    business_slug = serializers.SlugField(required=False, allow_blank=True)
    slug = serializers.SlugField(required=False, allow_blank=True)
    
    # Industry & Currency
    business_type_id = serializers.IntegerField(required=False, allow_null=True)
    currency_id = serializers.IntegerField(required=False, allow_null=True)
    
    # Admin User Details
    admin_first_name = serializers.CharField(max_length=150)
    admin_last_name = serializers.CharField(max_length=150)
    admin_username = serializers.CharField(max_length=150)
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(write_only=True, min_length=8)
    
    # Optional Profile Details
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    website = serializers.URLField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    zip_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    country = serializers.CharField(max_length=100, required=False, allow_blank=True)
    timezone = serializers.CharField(max_length=50, required=False, default='UTC')

    def validate(self, attrs):
        # Accept 'slug' as alias for 'business_slug'
        slug = attrs.pop('slug', None) or attrs.get('business_slug', None)
        if slug:
            attrs['business_slug'] = slug
        if not attrs.get('business_slug'):
            raise serializers.ValidationError({'business_slug': _('A workspace slug is required.')})
        
        # Validate slug uniqueness
        from erp.models import Organization
        slug_val = attrs['business_slug'].lower()
        if Organization.objects.filter(slug=slug_val).exists():
            raise serializers.ValidationError({'business_slug': _('This business slug is already taken.')})
        attrs['business_slug'] = slug_val
        return attrs

    def validate_admin_username(self, value):
        # Username uniqueness is enforced per-org at the DB level,
        # but we provide a friendly error here for the global 'saas' scope.
        # Cross-org uniqueness is NOT required (each tenant has its own namespace).
        if User.objects.filter(username=value, organization__slug='saas').exists():
            raise serializers.ValidationError('This username is already taken.')
        return value
