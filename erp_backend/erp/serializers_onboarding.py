from rest_framework import serializers
from erp.models import Organization, BusinessType, GlobalCurrency, User, Employee, Role, Site

class BusinessTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessType
        fields = ['id', 'name', 'slug', 'description']

class GlobalCurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalCurrency
        fields = ['id', 'name', 'code', 'symbol']

class PublicRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description']

class BusinessRegistrationSerializer(serializers.Serializer):
    business_name = serializers.CharField(max_length=255)
    slug = serializers.SlugField()
    business_type_id = serializers.IntegerField()
    currency_id = serializers.IntegerField()
    
    def validate_business_name(self, value):
        from erp.models import Organization
        if Organization.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError("This business name is already registered.")
        return value
    
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    website = serializers.URLField(required=False, allow_blank=True)
    logo = serializers.ImageField(required=False, allow_null=True)
    
    address = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    zip_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    country = serializers.CharField(max_length=100, required=False, allow_blank=True)
    timezone = serializers.CharField(max_length=50, default='UTC')
    
    # Super Admin Info
    admin_first_name = serializers.CharField(max_length=100)
    admin_last_name = serializers.CharField(max_length=100)
    admin_username = serializers.CharField(max_length=100)
    admin_password = serializers.CharField(write_only=True)
    admin_email = serializers.EmailField()

class UserSignUpSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    username = serializers.CharField(max_length=100)
    password = serializers.CharField(write_only=True)
    
    phone = serializers.CharField(max_length=50, required=False)
    nationality = serializers.CharField(max_length=100, required=False)
    address = serializers.CharField(required=False)
    date_of_birth = serializers.DateField(required=False)
    
    role_id = serializers.IntegerField()
