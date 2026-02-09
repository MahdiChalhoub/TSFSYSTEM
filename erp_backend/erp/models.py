"""
Kernel Models — erp/models.py
Contains ONLY infrastructure and platform-level models.
All business models have been migrated to their respective module directories:
  - apps/finance/models.py  (ChartOfAccount, JournalEntry, FiscalYear, etc.)
  - apps/inventory/models.py (Product, Warehouse, Inventory, etc.)
  - apps/pos/models.py      (Order, OrderLine)
  - apps/crm/models.py      (Contact)
  - apps/hr/models.py       (Employee)
"""
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.utils.translation import gettext_lazy as _
from django.db import transaction
import uuid
import json
from decimal import Decimal
from .middleware import get_current_tenant_id


# =============================================================================
# GLOBAL PLATFORM MODELS (Not tenant-scoped)
# =============================================================================

class BusinessType(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'businesstype'
    
    def __str__(self):
        return self.name


class SystemModule(models.Model):
    STATUS_CHOICES = (
        ('INSTALLED', 'Installed'),
        ('UPGRADING', 'Upgrading'),
        ('FAILED', 'Failed'),
        ('DISABLED', 'Disabled'),
    )
    VISIBILITY_CHOICES = (
        ('public', 'Public – shown on landing page'),
        ('organization', 'Organization – only visible to assigned orgs'),
        ('private', 'Private – hidden/internal only'),
    )
    name = models.CharField(max_length=100, unique=True)
    version = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='INSTALLED')
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='public')
    description = models.TextField(blank=True, default='', help_text="Short description shown on landing page and plan pages")
    icon = models.CharField(max_length=50, blank=True, default='', help_text="Lucide icon name (e.g. 'shopping-cart', 'bar-chart')")
    manifest = models.JSONField(default=dict)
    checksum = models.CharField(max_length=64)
    installed_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'systemmodule'

    def __str__(self):
        return f"{self.name} ({self.version})"



class SystemModuleLog(models.Model):
    module_name = models.CharField(max_length=100)
    from_version = models.CharField(max_length=50, default='N/A')
    to_version = models.CharField(max_length=50, default='N/A')
    action = models.CharField(max_length=20)
    status = models.CharField(max_length=20)
    logs = models.TextField(blank=True, default='')
    performed_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'systemmodulelog'


class SystemUpdate(models.Model):
    version = models.CharField(max_length=50, unique=True)
    changelog = models.TextField(null=True, blank=True)
    release_date = models.DateTimeField(null=True, blank=True)
    is_applied = models.BooleanField(default=False)
    applied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    package_hash = models.CharField(max_length=64, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'systemupdate'
        ordering = ['-created_at']


class GlobalCurrency(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True)
    symbol = models.CharField(max_length=10)
    
    class Meta:
        db_table = 'GlobalCurrency'

    def __str__(self):
        return f"{self.name} ({self.code})"


class Country(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=255)
    
    class Meta:
        db_table = 'Country'

    def __str__(self):
        return self.name


# =============================================================================
# SAAS CLIENT (ACCOUNT OWNER)
# =============================================================================

class SaaSClient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=50, blank=True, default='')
    company_name = models.CharField(max_length=255, blank=True, default='', help_text='Legal company name if different from person name')
    address = models.TextField(blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    country = models.CharField(max_length=100, blank=True, default='')
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'saasclient'
        ordering = ['-created_at']

    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip()
        if self.company_name:
            return f"{name} ({self.company_name})"
        return name

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def organization_count(self):
        return self.organizations.count()

    def sync_to_crm_contact(self):
        """
        Create or update a CRM Contact record in the SaaS org for this client.
        This ensures the client appears in /crm/contacts for the SaaS admin.
        """
        try:
            from apps.crm.models import Contact
            from decimal import Decimal
            saas_org = Organization.objects.filter(slug='saas').first()
            if not saas_org:
                return None

            display_name = self.full_name
            if self.company_name:
                display_name = f"{self.full_name} ({self.company_name})"

            contact, created = Contact.objects.update_or_create(
                email=self.email,
                organization=saas_org,
                defaults={
                    'name': display_name,
                    'type': 'CUSTOMER',
                    'phone': self.phone or '',
                    'address': self.address or '',
                    'customer_type': 'SAAS',
                    'balance': Decimal('0.00'),
                    'credit_limit': Decimal('0.00'),
                    'airsi_tax_rate': Decimal('0.00'),
                    'is_airsi_subject': False,
                }
            )
            return contact
        except Exception:
            return None


# =============================================================================
# ORGANIZATION & MULTI-TENANCY INFRASTRUCTURE
# =============================================================================

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    is_read_only = models.BooleanField(default=False)  # Middleware blocks writes when True (expired subscription)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
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

    # Organization-level settings stored as JSON
    settings = models.JSONField(default=dict, blank=True)

    # SaaS Subscription & Billing
    client = models.ForeignKey('SaaSClient', on_delete=models.SET_NULL, null=True, blank=True, related_name='organizations', help_text='Account owner / billing contact')
    data_usage_bytes = models.BigIntegerField(default=0)
    plan_expiry_at = models.DateTimeField(null=True, blank=True)
    reminder_config = models.JSONField(default=dict, blank=True, help_text="e.g. {'days_before': 5}")
    current_plan = models.ForeignKey('SubscriptionPlan', on_delete=models.SET_NULL, null=True, blank=True, related_name='organizations')

    class Meta:
        db_table = 'organization'

    def __str__(self):
        return self.name


class TenantManager(models.Manager):
    def get_queryset(self):
        tenant_id = get_current_tenant_id()
        if tenant_id:
            return super().get_queryset().filter(organization_id=tenant_id)
        return super().get_queryset()


class TenantModel(models.Model):
    """Base model for all tenant-scoped data. Provides automatic organization filtering."""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    objects = TenantManager()
    original_objects = models.Manager()

    class Meta:
        abstract = True


class OrganizationModule(models.Model):
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='enabled_modules')
    module_name = models.CharField(max_length=100, default='legacy')
    is_enabled = models.BooleanField(default=True)
    active_features = models.JSONField(default=list, blank=True)
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'organizationmodule'
        unique_together = ('organization', 'module_name')


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
        db_table = 'site'
        unique_together = ('code', 'organization')


# =============================================================================
# RBAC (Role-Based Access Control) — Kernel Infrastructure
# =============================================================================

class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'permission'


class Role(TenantModel):
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    permissions = models.ManyToManyField(Permission, related_name='roles')

    class Meta:
        db_table = 'role'
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
        db_table = 'user'
        constraints = [
            models.UniqueConstraint(fields=['username', 'organization'], name='unique_username_per_org')
        ]
    
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='users')
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    home_site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name='home_users')
    cash_register = models.ForeignKey('finance.FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True)
    is_active_account = models.BooleanField(default=True)
    
    registration_status = models.CharField(max_length=50, default='APPROVED')
    correction_notes = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.email if self.email else self.username


# =============================================================================
# SAAS PLATFORM MODELS
# =============================================================================

class PlanCategory(models.Model):
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20)
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'plancategory'


class SubscriptionPlan(models.Model):
    category = models.ForeignKey(PlanCategory, on_delete=models.CASCADE, related_name='plans')
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    monthly_price = models.DecimalField(max_digits=15, decimal_places=2)
    annual_price = models.DecimalField(max_digits=15, decimal_places=2)
    modules = models.JSONField(default=list)       # List of module codes included
    features = models.JSONField(default=dict)      # {module_code: [active_feature_codes]}
    limits = models.JSONField(default=dict)        # {"max_users": 5, "max_sites": 1, ...}
    is_active = models.BooleanField(default=True)
    is_public = models.BooleanField(default=True, help_text="Public plans show on landing/pricing page. Private plans are org-specific.")
    sort_order = models.IntegerField(default=0, help_text="Display order on pricing pages (lower = first)")
    trial_days = models.IntegerField(default=0, help_text="Free trial duration in days. 0 = no trial.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscriptionplan'
        ordering = ['sort_order', 'monthly_price']

    def __str__(self):
        return f"{self.name} (${self.monthly_price}/mo)"


class SubscriptionPayment(models.Model):
    TYPE_CHOICES = (
        ('PURCHASE', 'Purchase Invoice'),
        ('CREDIT_NOTE', 'Credit Note'),
        ('RENEWAL', 'Renewal'),
    )
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name='payments')
    previous_plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True, blank=True, related_name='upgrade_payments', help_text="Plan before the switch (for audit)")
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    billing_cycle = models.CharField(max_length=20, default='MONTHLY', blank=True, help_text="MONTHLY, ANNUAL, ONE_TIME")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='PURCHASE')
    status = models.CharField(max_length=20, default='PENDING')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'subscriptionpayment'

    def __str__(self):
        return f"{self.organization.name} — {self.type} — ${self.amount}"


class PlanAddon(models.Model):
    ADDON_TYPES = [
        ('users', 'Extra Users'),
        ('sites', 'Extra Sites'),
        ('storage', 'Extra Storage (GB)'),
        ('products', 'Extra Products'),
        ('invoices', 'Extra Invoices/Month'),
        ('customers', 'Extra Customers'),
    ]
    name = models.CharField(max_length=255)
    addon_type = models.CharField(max_length=20, choices=ADDON_TYPES)
    quantity = models.IntegerField(help_text="How much this add-on provides (e.g. 10 users, 50 GB)")
    monthly_price = models.DecimalField(max_digits=15, decimal_places=2)
    annual_price = models.DecimalField(max_digits=15, decimal_places=2)
    is_active = models.BooleanField(default=True)
    plans = models.ManyToManyField(SubscriptionPlan, related_name='addons', blank=True, help_text="Plans that can use this add-on. Empty = available to all.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'planaddon'
        ordering = ['addon_type', 'monthly_price']

    def __str__(self):
        return f"{self.name} (+{self.quantity} {self.addon_type}) ${self.monthly_price}/mo"


# =============================================================================
# PACKAGE STORAGE & DEPLOYMENT CENTER
# =============================================================================

class PackageUpload(models.Model):
    PACKAGE_TYPES = (
        ('kernel', 'Backend Kernel'),
        ('frontend', 'Frontend Kernel'),
        ('module', 'Module'),
    )
    STATUS_CHOICES = (
        ('uploading', 'Uploading'),
        ('ready', 'Ready'),
        ('scheduled', 'Scheduled'),
        ('applying', 'Applying'),
        ('applied', 'Applied'),
        ('failed', 'Failed'),
        ('rolled_back', 'Rolled Back'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    package_type = models.CharField(max_length=20, choices=PACKAGE_TYPES)
    name = models.CharField(max_length=100)
    version = models.CharField(max_length=50)
    
    file = models.FileField(upload_to='packages/', null=True, blank=True)
    file_size = models.BigIntegerField(default=0)
    upload_progress = models.IntegerField(default=0)
    checksum = models.CharField(max_length=64, null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='uploading')
    changelog = models.TextField(blank=True)
    error_message = models.TextField(null=True, blank=True)
    
    uploaded_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, related_name='uploaded_packages')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    applied_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='applied_packages')
    
    manifest = models.JSONField(default=dict, blank=True)
    backup_path = models.CharField(max_length=500, null=True, blank=True)
    
    class Meta:
        db_table = 'PackageUpload'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.name} v{self.version} ({self.get_package_type_display()})"


# =============================================================================
# BACKWARD-COMPATIBLE RE-EXPORTS
# Business models now live in their respective module directories.
# These re-exports ensure existing code continues to work during transition.
# Each is gated — kernel boots even if a module is removed.
# =============================================================================

# Finance Module
try:
    from apps.finance.models import (  # noqa: E402, F401
        ChartOfAccount, FinancialAccount, FiscalYear, FiscalPeriod,
        JournalEntry, JournalEntryLine, Transaction, TransactionSequence,
        BarcodeSettings, Loan, LoanInstallment, FinancialEvent
    )
except ImportError:
    pass

# Inventory Module
try:
    from apps.inventory.models import (  # noqa: E402, F401
        Product, Unit, Category, Brand, Parfum, ProductGroup,
        Warehouse, Inventory, InventoryMovement
    )
except ImportError:
    pass

# POS Module
try:
    from apps.pos.models import Order, OrderLine  # noqa: E402, F401
except ImportError:
    pass

# CRM Module
try:
    from apps.crm.models import Contact  # noqa: E402, F401
except ImportError:
    pass

# HR Module
try:
    from apps.hr.models import Employee  # noqa: E402, F401
except ImportError:
    pass