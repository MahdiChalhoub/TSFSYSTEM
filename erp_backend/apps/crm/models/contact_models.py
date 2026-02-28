"""
CRM Module Models
Extracted from Kernel (erp/models.py) → Module Layer (apps/crm/models.py)
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


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
    home_site = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True)

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
    home_zone = models.ForeignKey(
        'pos.DeliveryZone',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='clients',
        help_text='Default delivery zone for this client (auto-selected in POS)'
    )
    wallet_balance = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Customer wallet balance from stored change or top-ups'
    )

    # ── Customer Analytics (auto-computed) ─────────────────────
    first_purchase_date = models.DateTimeField(null=True, blank=True)
    last_purchase_date = models.DateTimeField(null=True, blank=True)
    total_orders = models.IntegerField(default=0, help_text='Total completed orders')
    lifetime_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total revenue from this customer'
    )
    average_order_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Average order value'
    )

    # ── Supplier Performance ───────────────────────────────────
    overall_rating = models.DecimalField(
        max_digits=3, decimal_places=1, default=Decimal('0.0'),
        help_text='Weighted average rating (1-5)'
    )
    quality_rating = models.DecimalField(max_digits=3, decimal_places=1, default=Decimal('0.0'))
    delivery_rating = models.DecimalField(max_digits=3, decimal_places=1, default=Decimal('0.0'))
    pricing_rating = models.DecimalField(max_digits=3, decimal_places=1, default=Decimal('0.0'))
    service_rating = models.DecimalField(max_digits=3, decimal_places=1, default=Decimal('0.0'))
    total_ratings = models.IntegerField(default=0, help_text='Number of ratings submitted')
    supplier_total_orders = models.IntegerField(default=0)
    on_time_deliveries = models.IntegerField(default=0)
    late_deliveries = models.IntegerField(default=0)
    total_purchase_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total value of POs placed with this supplier'
    )
    avg_lead_time_days = models.DecimalField(
        max_digits=6, decimal_places=1, default=Decimal('0.0'),
        help_text='Average days from PO to delivery'
    )

    # ── EU Compliance ──────────────────────────────────────────
    is_eu_supplier = models.BooleanField(default=False)
    vat_number_eu = models.CharField(max_length=50, null=True, blank=True)
    country_code = models.CharField(max_length=3, null=True, blank=True, help_text='ISO 3166-1 alpha-2')

    # ── Financial Extended ─────────────────────────────────────
    opening_balance = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Starting balance when contact was created'
    )
    current_balance = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Current running balance (auto-computed)'
    )
    DEFAULT_COST_BASES = (('HT', 'Hors Taxe'), ('TTC', 'Toutes Taxes Comprises'))
    default_cost_basis = models.CharField(
        max_length=3, choices=DEFAULT_COST_BASES, default='HT',
        null=True, blank=True,
        help_text='Default pricing basis for this supplier'
    )

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

    def recalculate_analytics(self):
        """Recalculate customer analytics from order history."""
        if self.total_orders > 0:
            self.average_order_value = self.lifetime_value / self.total_orders
        else:
            self.average_order_value = Decimal('0.00')

    def recalculate_supplier_rating(self):
        """Recalculate overall supplier rating from individual ratings."""
        ratings = [self.quality_rating, self.delivery_rating, self.pricing_rating, self.service_rating]
        non_zero = [r for r in ratings if r > 0]
        if non_zero:
            self.overall_rating = sum(non_zero) / len(non_zero)
        else:
            self.overall_rating = Decimal('0.0')

