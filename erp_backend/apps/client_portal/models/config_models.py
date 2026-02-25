from decimal import Decimal
from django.db import models
from erp.models import TenantModel

class ClientPortalConfig(TenantModel):
    STORE_MODES = (
        ('B2C', 'B2C eCommerce — standard retail prices'),
        ('B2B', 'B2B Order Portal — tier/negotiated prices'),
        ('CATALOG_QUOTE', 'Catalog + Quote — browse and request quotes'),
        ('HYBRID', 'Hybrid — B2C interface, B2B pricing for wholesale/retail clients'),
    )

    STOREFRONT_TYPES = (
        ('PRODUCT_STORE', 'Product Store — full e-commerce with cart and checkout'),
        ('CATALOGUE', 'Catalogue — browse products, request quotes, no direct checkout'),
        ('SUBSCRIPTION', 'Subscription Store — recurring plans and pricing tiers'),
        ('LANDING_PAGE', 'Landing Page — company website with hero, about, and contact'),
        ('PORTFOLIO', 'Portfolio — showcase projects, case studies, and inquiries'),
    )

    store_mode = models.CharField(max_length=20, choices=STORE_MODES, default='HYBRID')
    show_stock_levels = models.BooleanField(default=False)
    allow_guest_browsing = models.BooleanField(default=True)
    require_approval_for_orders = models.BooleanField(default=False)
    storefront_title = models.CharField(max_length=255, blank=True, default='')
    storefront_tagline = models.CharField(max_length=500, blank=True, default='')
    storefront_theme = models.CharField(max_length=50, default='midnight')
    storefront_type = models.CharField(max_length=30, choices=STOREFRONT_TYPES, default='PRODUCT_STORE')

    seo_title = models.CharField(max_length=255, blank=True, default='')
    seo_description = models.TextField(blank=True, default='')
    seo_keywords = models.CharField(max_length=500, blank=True, default='')
    og_image_url = models.URLField(blank=True, default='')

    logo_url = models.URLField(blank=True, default='')
    primary_color = models.CharField(max_length=20, default='#10b981')
    secondary_color = models.CharField(max_length=20, default='#0f172a')
    custom_css = models.TextField(blank=True, default='')

    loyalty_enabled = models.BooleanField(default=True)
    loyalty_earn_rate = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal('1.0000'))
    loyalty_redemption_ratio = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal('100.0000'))
    loyalty_min_redeem = models.IntegerField(default=100)
    loyalty_max_redeem_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('50.00'))

    wallet_enabled = models.BooleanField(default=True)
    wallet_currency = models.CharField(max_length=10, default='USD')
    wallet_auto_create = models.BooleanField(default=True)
    wallet_max_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('999999.00'))

    default_delivery_fee = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    free_delivery_threshold = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    tickets_enabled = models.BooleanField(default=True)
    enabled_ticket_types = models.JSONField(default=list, blank=True)
    auto_assign_tickets = models.BooleanField(default=False)
    default_ticket_assignee = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )

    ecommerce_enabled = models.BooleanField(default=True)
    min_order_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    allow_wallet_payment = models.BooleanField(default=True)

    INVENTORY_CHECK_MODES = (
        ('STRICT', 'Strict — Prevent order if stock is insufficient'),
        ('ALLOW_OVERSALE', 'Allow Oversale — Proceed even if stock is low (goes negative)'),
        ('DISABLED', 'Disabled — Do not check or reduce stock during checkout'),
    )
    inventory_check_mode = models.CharField(max_length=20, choices=INVENTORY_CHECK_MODES, default='STRICT')

    layout = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'client_portal_config'
        verbose_name = 'Client Portal Configuration'
        verbose_name_plural = 'Client Portal Configurations'

    def __str__(self):
        return f"ClientPortalConfig: {self.organization}"

    @classmethod
    def get_config(cls, organization):
        config = cls.objects.filter(organization=organization).first()
        if not config:
            try:
                config = cls.objects.create(organization=organization)
            except Exception:
                config = cls.objects.filter(organization=organization).first()
        return config

    def get_loyalty_value(self, points):
        if self.loyalty_redemption_ratio <= 0: return Decimal('0.00')
        return Decimal(str(points)) / self.loyalty_redemption_ratio

    def get_points_for_amount(self, currency_amount):
        return int(Decimal(str(currency_amount)) * self.loyalty_earn_rate)

    def get_delivery_fee(self, order_subtotal):
        if self.free_delivery_threshold > 0 and order_subtotal >= self.free_delivery_threshold:
            return Decimal('0.00')
        return self.default_delivery_fee
