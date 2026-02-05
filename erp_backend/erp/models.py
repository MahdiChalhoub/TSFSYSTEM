from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.utils.translation import gettext_lazy as _
from django.db import transaction
import uuid
import json
from decimal import Decimal
from .middleware import get_current_tenant_id

class BusinessType(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'BusinessType'
    
    def __str__(self):
        return self.name

class GlobalCurrency(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True)
    symbol = models.CharField(max_length=10)
    
    class Meta:
        db_table = 'GlobalCurrency'

    def __str__(self):
        return f"{self.name} ({self.code})"

class Country(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=10, unique=True)
    
    class Meta:
        db_table = 'Country'

    def __str__(self):
        return self.name

class SystemModule(models.Model):
    STATUS_CHOICES = (
        ('INSTALLED', 'Installed'),
        ('UPGRADING', 'Upgrading'),
        ('FAILED', 'Failed'),
        ('DISABLED', 'Disabled'),
    )
    name = models.CharField(max_length=100, unique=True)
    version = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='INSTALLED')
    manifest = models.JSONField(default=dict)
    checksum = models.CharField(max_length=64)
    installed_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'SystemModule'

class SystemUpdate(models.Model):
    version = models.CharField(max_length=50, unique=True)
    changelog = models.TextField(null=True, blank=True)
    release_date = models.DateTimeField(null=True, blank=True)
    is_applied = models.BooleanField(default=False)
    applied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'SystemUpdate'
        ordering = ['-created_at']

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    business_type = models.ForeignKey(BusinessType, on_delete=models.SET_NULL, null=True, blank=True)
    base_currency = models.ForeignKey(GlobalCurrency, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'Organization'

    def __str__(self):
        return self.name

class TenantManager(models.Manager):
    def get_queryset(self):
        tenant_id = get_current_tenant_id()
        if tenant_id:
            return super().get_queryset().filter(organization_id=tenant_id)
        return super().get_queryset()

class TenantModel(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    objects = TenantManager()
    original_objects = models.Manager()

    class Meta:
        abstract = True

class Site(TenantModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'Site'
        unique_together = ('code', 'organization')

class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)

    class Meta:
        db_table = 'Permission'

class Role(TenantModel):
    name = models.CharField(max_length=100)
    permissions = models.ManyToManyField(Permission, related_name='roles')

    class Meta:
        db_table = 'Role'
        unique_together = ('name', 'organization')

class User(AbstractUser):
    username_validator = UnicodeUsernameValidator()

    username = models.CharField(
        _('username'),
        max_length=150,
        unique=False, 
        help_text=_('Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.'),
        validators=[username_validator],
    )

    class Meta:
        db_table = 'User'
        constraints = [
            models.UniqueConstraint(fields=['username', 'organization'], name='unique_username_per_org')
        ]
    
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='users', null=True, blank=True)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    home_site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name='home_users')
    is_active_account = models.BooleanField(default=True)
    
    REGISTRATION_STATUS = (
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('NEEDS_CORRECTION', 'Needs Correction'),
    )
    registration_status = models.CharField(max_length=50, choices=REGISTRATION_STATUS, default='APPROVED')
    correction_notes = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.email if self.email else self.username

class OrganizationModule(models.Model):
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='enabled_modules')
    module_name = models.CharField(max_length=100, default='legacy')
    is_enabled = models.BooleanField(default=True)
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'OrganizationModule'
        unique_together = ('organization', 'module_name')

class Unit(TenantModel):
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    conversion_factor = models.DecimalField(max_digits=15, decimal_places=6, default=1.0)

    class Meta:
        db_table = 'Unit'
        unique_together = ('code', 'organization')

class ProductGroup(TenantModel):
    name = models.CharField(max_length=255)

    class Meta:
        db_table = 'ProductGroup'

class Parfum(TenantModel):
    name = models.CharField(max_length=255)

    class Meta:
        db_table = 'Parfum'
        unique_together = ('name', 'organization')

class Category(TenantModel):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Category'
        unique_together = ('name', 'organization')

class Brand(TenantModel):
    name = models.CharField(max_length=255)

    class Meta:
        db_table = 'Brand'
        unique_together = ('name', 'organization')

class Product(TenantModel):
    sku = models.CharField(max_length=100)
    barcode = models.CharField(max_length=100, null=True, blank=True)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, default='ACTIVE')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Product'
        unique_together = (('sku', 'organization'), ('barcode', 'organization'))

class ChartOfAccount(TenantModel):
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20)

    class Meta:
        db_table = 'ChartOfAccount'
        unique_together = ('code', 'organization')

class Contact(TenantModel):
    TYPES = (
        ('SUPPLIER', 'Supplier'),
        ('CUSTOMER', 'Customer'),
        ('LEAD', 'Lead')
    )
    type = models.CharField(max_length=20, choices=TYPES)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'Contact'

class FinancialAccount(TenantModel):
    name = models.CharField(max_length=255)

    class Meta:
        db_table = 'FinancialAccount'

class Transaction(TenantModel):
    account = models.ForeignKey(FinancialAccount, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    type = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Transaction'

class PlanCategory(models.Model):
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20)
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'PlanCategory'

class SubscriptionPlan(models.Model):
    category = models.ForeignKey(PlanCategory, on_delete=models.CASCADE, related_name='plans')
    name = models.CharField(max_length=255)
    monthly_price = models.DecimalField(max_digits=15, decimal_places=2)
    annual_price = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        db_table = 'SubscriptionPlan'

class SubscriptionPayment(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    status = models.CharField(max_length=20, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'SubscriptionPayment'

class TransactionSequence(TenantModel):
    type = models.CharField(max_length=50)
    prefix = models.CharField(max_length=20, null=True, blank=True)
    next_number = models.IntegerField(default=1)

    class Meta:
        db_table = 'TransactionSequence'
        unique_together = ('type', 'organization')