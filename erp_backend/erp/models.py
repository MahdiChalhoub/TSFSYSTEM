from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
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

class SystemModule(models.Model):
    """
    Internal registry of installed modules.
    """
    STATUS_CHOICES = (
        ('INSTALLED', 'Installed'),
        ('UPGRADING', 'Upgrading'),
        ('FAILED', 'Failed'),
        ('DISABLED', 'Disabled'),
    )
    name = models.CharField(max_length=100, unique=True) # e.g. 'inventory'
    version = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='INSTALLED')
    manifest = models.JSONField(default=dict)
    checksum = models.CharField(max_length=64) # SHA-256 for integrity
    
    installed_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'SystemModule'

    def __str__(self):
        return f"{self.name} ({self.version})"

class SystemUpdate(models.Model):
    """
    Dedicated table for Kernel/Platform updates.
    Distinct from functional modules.
    """
    version = models.CharField(max_length=50, unique=True)
    changelog = models.TextField(null=True, blank=True)
    release_date = models.DateTimeField(null=True, blank=True)
    
    package_hash = models.CharField(max_length=255, null=True, blank=True)
    is_applied = models.BooleanField(default=False)
    applied_at = models.DateTimeField(null=True, blank=True)
    
    metadata = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'SystemUpdate'
        ordering = ['-created_at']

    def __str__(self):
        return f"Kernel Update v{self.version} ({'Applied' if self.is_applied else 'Pending'})"

class SystemModuleLog(models.Model):
    """
    ERP-grade auditing for module operations.
    """
    module = models.ForeignKey(SystemModule, on_delete=models.SET_NULL, related_name='logs', null=True, blank=True)
    module_name = models.CharField(max_length=100, null=True, blank=True)
    action = models.CharField(max_length=50) # 'INSTALL', 'UPGRADE', 'UNINSTALL', 'DELETE'
    from_version = models.CharField(max_length=50, null=True, blank=True)
    to_version = models.CharField(max_length=50, null=True, blank=True)
    status = models.CharField(max_length=20, default='SUCCESS') # 'SUCCESS', 'FAILURE'
    logs = models.TextField(null=True, blank=True)
    details = models.JSONField(null=True, blank=True)
    performed_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'SystemModuleLog'

    def __str__(self):
        return f"{self.module_name or 'System'}: {self.action} ({self.status})"

class OrganizationModule(models.Model):
    """
    Tracks which modules are enabled for a specific organization.
    This is for feature entitlement within the SaaS environment.
    """
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='enabled_modules')
    module_name = models.CharField(max_length=100, default='legacy')
    is_enabled = models.BooleanField(default=True)
    active_features = models.JSONField(default=list, blank=True) # List of enabled feature codes
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'OrganizationModule'
        unique_together = ('organization', 'module_name')

    def __str__(self):
        return f"{self.module_name} for {self.organization.slug}"

class GlobalCurrency(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True) # USD, EUR
    symbol = models.CharField(max_length=10) # $, €
    
    class Meta:
        db_table = 'GlobalCurrency'

    def __str__(self):
        return f"{self.name} ({self.code})"

class TenantManager(models.Manager):
    def get_queryset(self):
        tenant_id = get_current_tenant_id()
        if tenant_id:
            return super().get_queryset().filter(organization_id=tenant_id)
        return super().get_queryset()

class TenantModel(models.Model):
    organization = models.ForeignKey('erp.Organization', on_delete=models.CASCADE)

    objects = TenantManager()
    original_objects = models.Manager() # Fallback for cross-tenant logic if needed

    class Meta:
        abstract = True

class Unit(TenantModel):
    code = models.CharField(max_length=50) # PC, BOX
    name = models.CharField(max_length=255) # Piece, Box
    short_name = models.CharField(max_length=50, null=True, blank=True)
    type = models.CharField(max_length=50, default='COUNT')
    allow_fraction = models.BooleanField(default=False)
    needs_balance = models.BooleanField(default=False)
    balance_code_structure = models.CharField(max_length=100, null=True, blank=True)
    
    base_unit = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    conversion_factor = models.DecimalField(max_digits=15, decimal_places=6, default=1.0)

    class Meta:
        db_table = 'Unit'
        unique_together = ('code', 'organization')

    def __str__(self):
        return f"{self.name} ({self.code})"

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Onboarding Fields
    logo = models.ImageField(upload_to='logos/', null=True, blank=True)
    business_email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    zip_code = models.CharField(max_length=20, null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True)
    timezone = models.CharField(max_length=50, default='UTC')
    
    business_type = models.ForeignKey(BusinessType, on_delete=models.SET_NULL, null=True, blank=True)
    base_currency = models.ForeignKey(GlobalCurrency, on_delete=models.SET_NULL, null=True, blank=True)

    # Subscription & Billing
    current_plan = models.ForeignKey('SubscriptionPlan', on_delete=models.SET_NULL, null=True, blank=True, related_name='organizations')
    plan_expiry_at = models.DateTimeField(null=True, blank=True)
    is_read_only = models.BooleanField(default=False, help_text="If true, organization has read-only access due to plan expiry.")
    
    # Usage Tracking
    data_usage_bytes = models.BigIntegerField(default=0)
    reminder_config = models.JSONField(default=dict, blank=True, help_text="e.g. {'days_before': 5}")
    
    # Financial Integration
    billing_contact_id = models.IntegerField(null=True, blank=True, help_text="ID of the Contact record in the SaaS Provider's ledger.")

    class Meta:
        db_table = 'Organization'

    def __str__(self):
        return self.name

class SystemSettings(TenantModel):
    key = models.CharField(max_length=100)
    value = models.TextField() # JSON stored as string
    
    class Meta:
        db_table = 'SystemSettings'
        unique_together = ('key', 'organization')

    def __str__(self):
        return f"{self.key} ({self.organization.name})"

class Site(TenantModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    vat_number = models.CharField(max_length=100, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Site'
        unique_together = ('code', 'organization')

    def __str__(self):
        return f"{self.name} ({self.organization.name})"

class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True) # e.g. 'pos.sell'
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Permission'

    def __str__(self):
        return self.name

class Role(TenantModel):
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    is_public_requestable = models.BooleanField(default=False)
    permissions = models.ManyToManyField(Permission, related_name='roles')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Role'
        unique_together = ('name', 'organization')

    def __str__(self):
        return f"{self.name} ({self.organization.name})"

# Logic for Finance and Inventory moved to apps/

class User(AbstractUser):
    # Override username to allow duplicates across tenants
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
    cash_register = models.IntegerField(null=True, blank=True) # ID of the assigned drawer if applicable
    is_active_account = models.BooleanField(default=True)
    
    # Registration Status
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

class TransactionSequence(TenantModel):
    type = models.CharField(max_length=50) # 'INVOICE', 'LOAN', etc.
    prefix = models.CharField(max_length=20, null=True, blank=True)
    suffix = models.CharField(max_length=20, null=True, blank=True)
    next_number = models.IntegerField(default=1)
    padding = models.IntegerField(default=5)
    
    class Meta:
        db_table = 'TransactionSequence'
        unique_together = ('type', 'organization')

class BarcodeSettings(TenantModel):
    prefix = models.CharField(max_length=10, default="200")
    next_sequence = models.IntegerField(default=1000)
    length = models.IntegerField(default=13)
    is_enabled = models.BooleanField(default=True)

    class Meta:
        db_table = 'BarcodeSettings'

# --- Subscription System ---

class PlanCategory(models.Model):
    CATEGORY_TYPES = (
        ('PUBLIC', 'Public (Landing Page)'),
        ('ORGANIZATION', 'Organization Specific'),
        ('INTERNAL', 'Internal / Legacy'),
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=CATEGORY_TYPES)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    country = models.ForeignKey('Country', on_delete=models.SET_NULL, null=True, blank=True)
    allowed_organizations = models.ManyToManyField('Organization', blank=True, related_name='available_plan_categories')

    class Meta:
        db_table = 'PlanCategory'
        verbose_name_plural = "Plan Categories"

    def __str__(self):
        return f"{self.name} ({self.type})"

class SubscriptionPlan(models.Model):
    category = models.ForeignKey(PlanCategory, on_delete=models.CASCADE, related_name='plans')
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    
    # Billing
    monthly_price = models.DecimalField(max_digits=15, decimal_places=2)
    annual_price = models.DecimalField(max_digits=15, decimal_places=2)
    
    # Feature Entitlement
    modules = models.JSONField(default=list, help_text="List of module codes enabled for this plan")
    features = models.JSONField(default=dict, help_text="Dictionary of feature flags and settings")
    
    # Limits
    limits = models.JSONField(default=dict, help_text="Usage limits, e.g. {'max_users': 10, 'storage_gb': 5}")
    
    # Hierarchy
    upgrade_path = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='downgrade_options')
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'SubscriptionPlan'

    def __str__(self):
        return f"{self.name} - {self.category.name}"

class SubscriptionPayment(models.Model):
    PAYMENT_STATUS = (
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
    )
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='subscription_payments')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    billing_cycle = models.CharField(max_length=20, choices=(('MONTHLY', 'Monthly'), ('ANNUAL', 'Annual')))
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='PENDING')
    
    # Reference to ledger (JournalEntry ID)
    journal_entry_id = models.IntegerField(null=True, blank=True)
    
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'SubscriptionPayment'
