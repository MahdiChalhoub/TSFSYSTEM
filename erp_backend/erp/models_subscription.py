from django.db import models
from .middleware import get_current_tenant_id

class PlanCategory(models.Model):
    CATEGORY_TYPES = (
        ('PUBLIC', 'Public (Landing Page)'),
        ('ORGANIZATION', 'Organization Specific'),
        ('INTERNAL', 'Internal / Legacy'),
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=CATEGORY_TYPES)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    country = models.ForeignKey('erp.Country', on_delete=models.SET_NULL, null=True, blank=True)
    allowed_organizations = models.ManyToManyField('erp.Organization', blank=True, related_name='available_plan_categories')

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
    organization = models.ForeignKey('erp.Organization', on_delete=models.CASCADE, related_name='subscription_payments')
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
