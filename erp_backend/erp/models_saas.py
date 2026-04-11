"""
SaaS Platform Models — erp/models_saas.py
SaaSClient, Subscription plans, payments, add-ons, and organization billing.
Extracted from erp/models.py to keep the kernel under 500 lines.
"""
from django.db import models
from decimal import Decimal
import uuid


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
            from erp.models import Organization
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
                    # Removed balance and credit_limit from defaults to prevent resets
                    'airsi_tax_rate': Decimal('0.00'),
                    'is_airsi_subject': False,
                }
            )
            return contact
        except Exception:
            return None

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.sync_to_crm_contact()

class PlanCategory(models.Model):
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20)
    country = models.ForeignKey('Country', on_delete=models.SET_NULL, null=True, blank=True)
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
    business_types = models.ManyToManyField('BusinessType', blank=True, related_name='plans',
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
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, db_column='tenant_id')
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
        ('dual_view', 'Dual View — Internal Scope Access'),
        ('multi_currency', 'Multi-Currency Support'),
        ('multi_country', 'Multi-Country Branches'),
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
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='purchased_addons')
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
