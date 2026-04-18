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
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

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

    # Finance structural lock — set by COA Setup Wizard
    finance_setup_completed = models.BooleanField(default=False, help_text='Set to True when the COA Setup Wizard is finalized')
    finance_hard_locked_at = models.DateTimeField(null=True, blank=True, help_text='Timestamp when the first journal entry was posted')
    finance_hard_locked_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='locked_organizations')

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
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column='tenant_id')
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
    home_site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name='home_users')
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

    # POS Cashier PIN — for POS login and user switching
    pos_pin = models.CharField(max_length=128, null=True, blank=True,
        help_text='Hashed 4-6 digit PIN for POS cashier login and user switching')

    # Manager Override PIN — for authorizing sensitive POS operations
    override_pin = models.CharField(max_length=128, null=True, blank=True,
        help_text='Hashed PIN for manager-level overrides (void, refund, discount override)')

    # 2FA (Advanced Security)
    two_factor_secret = models.CharField(max_length=32, null=True, blank=True)
    is_2fa_enabled = models.BooleanField(default=False)

    def set_pos_pin(self, raw_pin: str | None):
        """Set or clear the POS cashier PIN."""
        from django.contrib.auth.hashers import make_password
        self.pos_pin = make_password(raw_pin) if raw_pin else None

    def check_pos_pin(self, raw_pin: str) -> bool:
        """Verify a POS cashier PIN. Returns False if no PIN is set."""
        from django.contrib.auth.hashers import check_password
        if not self.pos_pin:
            return False
        return check_password(raw_pin, self.pos_pin)

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
# SAAS PLATFORM MODELS
# =============================================================================

class PlanCategory(models.Model):
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20)
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    # Bridge to inventory — uses IntegerField to avoid hard cross-app dependency
    linked_inventory_category = models.IntegerField(null=True, blank=True,
        help_text='FK to inventory Category.id for catalog integration')

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
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    # Filter plans by organization business type (#15)
    business_types = models.ManyToManyField(BusinessType, blank=True, related_name='plans',
        help_text='Business types this plan is available for. Empty = available to all.')

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
    # Decoupled from finance module — uses IntegerField to avoid hard dependency
    journal_entry_id = models.IntegerField(null=True, blank=True, db_column='journal_entry_id', help_text="Linked accounting journal entry")
    paid_at = models.DateTimeField(null=True, blank=True, help_text="When payment was confirmed")
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

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
        ('encryption', 'AES-256 Encryption'),
    ]
    name = models.CharField(max_length=255)
    addon_type = models.CharField(max_length=20, choices=ADDON_TYPES)
    quantity = models.IntegerField(help_text="How much this add-on provides (e.g. 10 users, 50 GB)")
    monthly_price = models.DecimalField(max_digits=15, decimal_places=2)
    annual_price = models.DecimalField(max_digits=15, decimal_places=2)
    is_active = models.BooleanField(default=True)
    plans = models.ManyToManyField(SubscriptionPlan, related_name='addons', blank=True, help_text="Plans that can use this add-on. Empty = available to all.")
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'planaddon'
        ordering = ['addon_type', 'monthly_price']

    def __str__(self):
        return f"{self.name} (+{self.quantity} {self.addon_type}) ${self.monthly_price}/mo"


class OrganizationAddon(models.Model):
    """Tracks add-ons purchased by a specific organization."""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ]
    BILLING_CYCLES = [
        ('MONTHLY', 'Monthly'),
        ('ANNUAL', 'Annual'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='purchased_addons')
    addon = models.ForeignKey(PlanAddon, on_delete=models.PROTECT, related_name='purchases')
    quantity = models.IntegerField(default=1, help_text="Number of units purchased")
    billing_cycle = models.CharField(max_length=20, choices=BILLING_CYCLES, default='MONTHLY')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    purchased_at = models.DateTimeField(auto_now_add=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'organizationaddon'
        ordering = ['-purchased_at']

    def __str__(self):
        return f"{self.organization.name} — {self.addon.name} ({self.status})"

    @property
    def effective_price(self):
        """Returns the effective price based on billing cycle."""
        if self.billing_cycle == 'ANNUAL':
            return self.addon.annual_price * self.quantity
        return self.addon.monthly_price * self.quantity


# =============================================================================
# PACKAGE STORAGE & DEPLOYMENT CENTER
# =============================================================================

# PackageUpload is now managed in apps.packages.models
try:
    from apps.packages.models import PackageUpload
except ImportError:
    pass
    
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

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('INFO', 'Information'),
        ('SUCCESS', 'Success'),
        ('WARNING', 'Warning'),
        ('ERROR', 'Error'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=10, choices=NOTIFICATION_TYPES, default='INFO')
    link = models.CharField(max_length=255, null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notification'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} for {self.user}"

    def mark_as_read(self):
        from django.utils import timezone
        self.read_at = timezone.now()
        self.save(update_fields=['read_at'])


class UDLESavedView(models.Model):
    """
    Persists user customizations for a specific model/view in UDLE.
    Stores visible columns, filters, and sorting preferences.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='udle_views')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    model_name = models.CharField(max_length=100)  # e.g., 'Product', 'InventoryMovement'
    name = models.CharField(max_length=100)
    config = models.JSONField(default=dict)  # {columns: [], filters: {}, sorting: {}}
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'udle_saved_view'
        unique_together = ('user', 'model_name', 'name')
        verbose_name = "UDLE Saved View"
        verbose_name_plural = "UDLE Saved Views"

    def __str__(self):
        return f"{self.name} ({self.model_name}) for {self.user}"
