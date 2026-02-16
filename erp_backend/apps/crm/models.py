"""
CRM Module Models
Extracted from Kernel (erp/models.py) → Module Layer (apps/crm/models.py)
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, Site


class Contact(TenantModel):
    TYPES = (
        ('SUPPLIER', 'Supplier'),
        ('CUSTOMER', 'Customer'),
        ('LEAD', 'Lead'),
        ('PARTNER', 'Partner'),
        ('CREDITOR', 'Creditor'),
        ('DEBTOR', 'Debtor'),
    )
    SUPPLIER_CATEGORIES = (
        ('REGULAR', 'Regular'),
        ('DEPOT_VENTE', 'Depot Vente (Consignment)'),
        ('MIXED', 'Mixed'),
    )
    CUSTOMER_TIERS = (
        ('STANDARD', 'Standard'),
        ('VIP', 'VIP'),
        ('WHOLESALE', 'Wholesale'),
        ('RETAIL', 'Retail'),
    )
    type = models.CharField(max_length=20, choices=TYPES)
    name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    vat_id = models.CharField(max_length=100, null=True, blank=True)
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    # Decoupled from finance module — uses IntegerField to avoid hard dependency
    linked_account_id = models.IntegerField(null=True, blank=True, db_column='linked_account_id')
    home_site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True)

    # Supplier-specific fields
    supplier_category = models.CharField(
        max_length=20, choices=SUPPLIER_CATEGORIES, default='REGULAR',
        null=True, blank=True,
        help_text='Supplier sourcing strategy: Regular, Consignment (Depot Vente), or Mixed'
    )

    # Customer-specific fields
    customer_type = models.CharField(max_length=50, null=True, blank=True)
    customer_tier = models.CharField(
        max_length=20, choices=CUSTOMER_TIERS, default='STANDARD',
        null=True, blank=True,
        help_text='Client pricing tier: Standard, VIP, Wholesale, Retail'
    )
    loyalty_points = models.IntegerField(default=0, help_text='Accumulated loyalty points')

    # Financial / Payment
    payment_terms_days = models.IntegerField(
        default=0, help_text='Default payment terms in days (0 = immediate)'
    )
    preferred_payment_method = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='Preferred method: CASH, BANK, CHECK, MOBILE_MONEY, etc.'
    )

    # Tax
    airsi_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    is_airsi_subject = models.BooleanField(default=False)

    # Metadata
    notes = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True, help_text='Deactivate to hide without deleting')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'contact'

    def __str__(self):
        return f"{self.name} ({self.type})"

