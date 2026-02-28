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
    installed_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

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
    timestamp = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'systemmodulelog'


class SystemUpdate(models.Model):
    version = models.CharField(max_length=50, unique=True)
    changelog = models.TextField(null=True, blank=True)
    release_date = models.DateTimeField(null=True, blank=True)
    is_applied = models.BooleanField(default=False)
    applied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
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
        db_table = 'globalcurrency'

    def __str__(self):
        return f"{self.name} ({self.code})"


class Country(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=255)
    
    class Meta:
        db_table = 'country'

    def __str__(self):
        return self.name


# =============================================================================
# SAAS CLIENT (extracted to erp/models_saas.py)
# =============================================================================
from .models_saas import SaaSClient  # noqa: E402, F401


# =============================================================================
# ORGANIZATION & MULTI-TENANCY INFRASTRUCTURE
# =============================================================================

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    is_read_only = models.BooleanField(default=False)  # Middleware blocks writes when True (expired subscription)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    
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

    # AES-256 Encryption Add-on
    encryption_key = models.CharField(max_length=64, null=True, blank=True, help_text='Base64-encoded AES-256 key (per-org)')
    encryption_enabled = models.BooleanField(default=False, help_text='Whether field-level encryption is active')

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



# =============================================================================
# TRANSACTION LIFECYCLE INFRASTRUCTURE
# Multi-level verification system: OPEN → LOCKED → VERIFIED → CONFIRMED
# =============================================================================

TRANSACTION_TYPES = (
    ('JOURNAL_ENTRY', 'Journal Entry'),
    ('VOUCHER', 'Voucher'),
    ('SALES_INVOICE', 'Sales Invoice'),
    ('PURCHASE_INVOICE', 'Purchase Invoice'),
    ('PAYMENT_IN', 'Payment Incoming'),
    ('PAYMENT_OUT', 'Payment Outgoing'),
    ('REFUND', 'Refund'),
    ('STOCK_ADJUSTMENT', 'Stock Adjustment'),
    ('STOCK_TRANSFER', 'Stock Transfer'),
    ('REGISTER_SESSION', 'Register Session'),
)

LIFECYCLE_STATUS_CHOICES = (
    ('OPEN', 'Open'),
    ('LOCKED', 'Locked'),
    ('VERIFIED', 'Verified'),
    ('CONFIRMED', 'Confirmed'),
)

LIFECYCLE_ACTION_CHOICES = (
    ('LOCK', 'Lock'),
    ('UNLOCK', 'Unlock'),
    ('VERIFY', 'Verify'),
    ('UNVERIFY', 'Unverify'),
    ('CONFIRM', 'Confirm'),
)


class TransactionVerificationConfig(TenantModel):
    """
    Per-organization settings for how many verification levels each
    transaction type requires. Supports optional amount-based thresholds.
    """
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPES)
    required_levels = models.IntegerField(default=1, help_text='Default verification levels required')
    amount_threshold = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='If transaction amount exceeds this, use threshold_levels instead'
    )
    threshold_levels = models.IntegerField(
        null=True, blank=True,
        help_text='Verification levels for high-value transactions'
    )

    class Meta:
        db_table = 'transaction_verification_config'
        unique_together = ('organization', 'transaction_type')

    def get_required_levels(self, amount=None):
        """Returns the number of verification levels needed for the given amount."""
        if amount and self.amount_threshold and amount > self.amount_threshold and self.threshold_levels:
            return self.threshold_levels
        return self.required_levels

    def __str__(self):
        return f"{self.transaction_type} → {self.required_levels} levels"


class TransactionStatusLog(models.Model):
    """
    Immutable audit trail for every lifecycle action on any transaction.
    Stores who did what, when, and why.
    """
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPES, db_index=True)
    transaction_id = models.IntegerField(db_index=True)
    action = models.CharField(max_length=20, choices=LIFECYCLE_ACTION_CHOICES)
    level = models.IntegerField(default=0, help_text='Verification level (1, 2, 3...)')
    performed_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)
    performed_at = models.DateTimeField(auto_now_add=True)
    comment = models.TextField(null=True, blank=True, help_text='Mandatory for UNLOCK and UNVERIFY')
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'transaction_status_log'
        ordering = ['-performed_at']
        indexes = [
            models.Index(fields=['transaction_type', 'transaction_id']),
        ]

    def __str__(self):
        return f"{self.action} L{self.level} on {self.transaction_type}#{self.transaction_id}"


class VerifiableModel(TenantModel):
    """
    Abstract mixin for models that support the transaction lifecycle.
    Inherit from this instead of TenantModel to gain:
      - lifecycle_status (OPEN/LOCKED/VERIFIED/CONFIRMED)
      - locked_by, locked_at
      - current_verification_level
    """
    lifecycle_status = models.CharField(
        max_length=20, choices=LIFECYCLE_STATUS_CHOICES, default='OPEN',
        help_text='Current lifecycle stage'
    )
    locked_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+'
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    current_verification_level = models.IntegerField(
        default=0,
        help_text='How many verification levels have been completed'
    )

    class Meta:
        abstract = True

    @property
    def is_editable(self):
        return self.lifecycle_status == 'OPEN'

    @property
    def is_locked(self):
        return self.lifecycle_status in ('LOCKED', 'VERIFIED', 'CONFIRMED')


class OrganizationModule(models.Model):
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='enabled_modules')
    module_name = models.CharField(max_length=100, default='legacy')
    is_enabled = models.BooleanField(default=True)
    active_features = models.JSONField(default=list, blank=True)
    granted_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

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
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

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
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'permission'


class Role(TenantModel):
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    permissions = models.ManyToManyField(Permission, related_name='roles')
    is_public_requestable = models.BooleanField(default=False, help_text="Can users self-request this role during registration")
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

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
    
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='users')
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    home_site = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True, related_name='home_users')
    # cash_register FK — uses IntegerField to avoid hard dependency on finance module
    cash_register_id = models.IntegerField(null=True, blank=True, db_column='cash_register_id')
    is_active_account = models.BooleanField(default=True)
    
    registration_status = models.CharField(max_length=50, default='PENDING')
    correction_notes = models.TextField(null=True, blank=True)

    # Scope Access Control — hashed PINs for dual-view scope switching
    scope_pin_official = models.CharField(max_length=128, null=True, blank=True,
        help_text='Hashed PIN required to access Official scope. Null = free access.')
    scope_pin_internal = models.CharField(max_length=128, null=True, blank=True,
        help_text='Hashed PIN required to access Internal scope. Null = free access.')

    # Manager Override PIN — for authorizing sensitive POS operations
    override_pin = models.CharField(max_length=128, null=True, blank=True,
        help_text='Hashed PIN for manager-level overrides (void, refund, discount override)')

    # POS Cashier PIN — for quick login at registers
    pos_pin = models.CharField(max_length=128, null=True, blank=True,
        help_text='Hashed 4-6 digit PIN for POS cashier login and user switching')

    # User Category Tags — role-independent markers for specific functions
    is_driver = models.BooleanField(default=False,
        help_text='Tag: this user is a delivery driver. Used to filter the driver list in POS delivery.')

    # 2FA (Advanced Security)
    two_factor_secret = models.CharField(max_length=32, null=True, blank=True)
    is_2fa_enabled = models.BooleanField(default=False)

    def set_scope_pin(self, scope: str, raw_pin: str | None):
        """Set or clear a scope PIN. scope must be 'official' or 'internal'."""
        from django.contrib.auth.hashers import make_password
        field = f'scope_pin_{scope}'
        if raw_pin:
            setattr(self, field, make_password(raw_pin))
        else:
            setattr(self, field, None)

    def check_scope_pin(self, scope: str, raw_pin: str) -> bool:
        """Verify a scope PIN. Returns True if correct or no PIN is set."""
        from django.contrib.auth.hashers import check_password
        field = f'scope_pin_{scope}'
        stored = getattr(self, field, None)
        if not stored:
            return True  # No PIN set = free access
        return check_password(raw_pin, stored)

    def set_override_pin(self, raw_pin: str | None):
        """Set or clear the manager override PIN."""
        from django.contrib.auth.hashers import make_password
        self.override_pin = make_password(raw_pin) if raw_pin else None

    def check_override_pin(self, raw_pin: str) -> bool:
        """Verify override PIN. Returns False if no PIN is set (not authorized)."""
        from django.contrib.auth.hashers import check_password
        if not self.override_pin:
            return False  # No override PIN = not a manager
        return check_password(raw_pin, self.override_pin)

    def set_pos_pin(self, raw_pin: str | None):
        """Set or clear the POS cashier PIN."""
        from django.contrib.auth.hashers import make_password
        self.pos_pin = make_password(raw_pin) if raw_pin else None

    def check_pos_pin(self, raw_pin: str) -> bool:
        """Verify POS cashier PIN."""
        from django.contrib.auth.hashers import check_password
        if not self.pos_pin:
            return False  # No PIN = cannot authenticate via PIN
        return check_password(raw_pin, self.pos_pin)

    def __str__(self):
        return self.email if self.email else self.username


class ManagerOverrideLog(TenantModel):
    """Audit trail for manager override PIN usage."""
    ACTION_CHOICES = (
        ('VOID_ORDER', 'Void Order'),
        ('APPLY_DISCOUNT', 'Apply Manual Discount'),
        ('PRICE_OVERRIDE', 'Price Override'),
        ('REFUND', 'Process Refund'),
        ('DELETE_LINE', 'Delete Order Line'),
        ('REOPEN_ORDER', 'Reopen Closed Order'),
        ('OTHER', 'Other Override'),
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='override_logs')
    order = models.ForeignKey('pos.Order', on_delete=models.SET_NULL, null=True, blank=True)
    details = models.TextField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    performed_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'manager_override_log'
        ordering = ['-performed_at']

    def __str__(self):
        return f"{self.get_action_display()} by {self.manager} at {self.performed_at}"


# =============================================================================
# SAAS PLATFORM MODELS (extracted to erp/models_saas.py)
# =============================================================================
from .models_saas import (  # noqa: E402, F401
    SaaSClient, PlanCategory, SubscriptionPlan, SubscriptionPayment,
    PlanAddon, OrganizationAddon,
)


# =============================================================================
# PACKAGE STORAGE & DEPLOYMENT CENTER
# =============================================================================

# PackageUpload is now managed in apps.packages.models
try:
    from apps.packages.models import PackageUpload  # noqa: F401
except ImportError:
    pass


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
        JournalEntry, JournalEntryLine, Transaction,
        BarcodeSettings, Loan, LoanInstallment, FinancialEvent
    )
    # TransactionSequence may not exist in all finance versions
    try:
        from apps.finance.models import TransactionSequence  # noqa: F401
    except ImportError:
        pass
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
# Connector Infrastructure
try:
    from .connector_models import (
        ModuleContract, ConnectorPolicy, BufferedRequest,
        ConnectorCache, ConnectorLog
    )
except ImportError:
    pass

# List Preferences
from .list_preferences import OrgListDefault, UserListPreference  # noqa: E402, F401


# =============================================================================
# UI MODELS (extracted to erp/models_ui.py)
# =============================================================================
from .models_ui import Notification, UDLESavedView  # noqa: E402, F401

# Import domain models so Django discovers them for migrations
from .models_domains import CustomDomain  # noqa: E402, F401

