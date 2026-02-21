"""
Client Portal — Models
======================
ClientPortalAccess, ClientWallet, WalletTransaction,
ClientOrder, ClientOrderLine, ClientTicket
"""
import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from erp.models import TenantModel


# =============================================================================
# PER-ORGANIZATION CONFIGURATION
# =============================================================================

class ClientPortalConfig(TenantModel):
    """
    Per-organization settings for the Client Portal.
    Controls store mode, loyalty rates, wallet behavior, delivery fees, and ticket types.
    Each organization can customize their own portal experience.
    """

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

    # ── Store Mode ────────────────────────────────────────────────────────────
    store_mode = models.CharField(
        max_length=20, choices=STORE_MODES, default='HYBRID',
        help_text='Controls pricing logic and checkout behavior'
    )
    show_stock_levels = models.BooleanField(
        default=False, help_text='Show exact stock quantities (vs just In Stock / Out of Stock)'
    )
    allow_guest_browsing = models.BooleanField(
        default=True, help_text='Allow unauthenticated users to browse the catalog'
    )
    require_approval_for_orders = models.BooleanField(
        default=False, help_text='Orders require admin approval before processing (B2B mode)'
    )
    storefront_title = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Custom title for the storefront (blank = org name)'
    )
    storefront_tagline = models.CharField(
        max_length=500, blank=True, default='',
        help_text='Tagline shown on the storefront landing page'
    )
    storefront_theme = models.CharField(
        max_length=50, default='midnight',
        help_text='Active theme ID for the storefront (e.g. midnight, boutique)'
    )
    storefront_type = models.CharField(
        max_length=30, choices=STOREFRONT_TYPES, default='PRODUCT_STORE',
        help_text='Type of storefront layout (product store, catalogue, subscription, landing page, portfolio)'
    )

    # ── SEO Settings ──────────────────────────────────────────────────────────
    seo_title = models.CharField(max_length=255, blank=True, default='', help_text='SEO Meta Title')
    seo_description = models.TextField(blank=True, default='', help_text='SEO Meta Description')
    seo_keywords = models.CharField(max_length=500, blank=True, default='', help_text='SEO Keywords')
    og_image_url = models.URLField(blank=True, default='', help_text='Social Share Image (OG Image) URL')

    # ── Theme Settings ────────────────────────────────────────────────────────
    logo_url = models.URLField(blank=True, default='', help_text='Organization Logo URL')
    primary_color = models.CharField(max_length=20, default='#10b981', help_text='Primary Brand Color')
    secondary_color = models.CharField(max_length=20, default='#0f172a', help_text='Secondary Brand Color')
    custom_css = models.TextField(blank=True, default='', help_text='Custom CSS for the storefront')

    # ── Loyalty Settings ──────────────────────────────────────────────────────
    loyalty_enabled = models.BooleanField(default=True, help_text='Enable loyalty points system')
    loyalty_earn_rate = models.DecimalField(
        max_digits=10, decimal_places=4, default=Decimal('1.0000'),
        help_text='Points earned per 1 currency unit spent (e.g. 1.0 = 1 pt/$1, 2.5 = 2.5 pt/$1)'
    )
    loyalty_redemption_ratio = models.DecimalField(
        max_digits=10, decimal_places=4, default=Decimal('100.0000'),
        help_text='Points needed for 1 currency unit (e.g. 100 = 100 pts = $1, 50 = 50 pts = $1)'
    )
    loyalty_min_redeem = models.IntegerField(
        default=100, help_text='Minimum points required before redemption is allowed'
    )
    loyalty_max_redeem_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('50.00'),
        help_text='Max % of order total payable with loyalty (e.g. 50 = up to 50%)'
    )

    # ── Wallet Settings ───────────────────────────────────────────────────────
    wallet_enabled = models.BooleanField(default=True, help_text='Enable digital wallet')
    wallet_currency = models.CharField(max_length=10, default='USD', help_text='Wallet currency code')
    wallet_auto_create = models.BooleanField(
        default=True, help_text='Auto-create wallet when client access is activated'
    )
    wallet_max_balance = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('999999.00'),
        help_text='Maximum wallet balance (0 = unlimited)'
    )

    # ── Delivery Settings ─────────────────────────────────────────────────────
    default_delivery_fee = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Default delivery fee for eCommerce orders'
    )
    free_delivery_threshold = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Order amount above which delivery is free (0 = never free)'
    )

    # ── Ticket Settings ───────────────────────────────────────────────────────
    tickets_enabled = models.BooleanField(default=True, help_text='Enable support ticket system')
    enabled_ticket_types = models.JSONField(
        default=list, blank=True,
        help_text='List of enabled ticket type codes. Empty = all enabled.'
    )
    auto_assign_tickets = models.BooleanField(
        default=False, help_text='Auto-assign new tickets to a default agent'
    )
    default_ticket_assignee = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+', help_text='Default agent for auto-assigned tickets'
    )

    # ── eCommerce Settings ────────────────────────────────────────────────────
    ecommerce_enabled = models.BooleanField(default=True, help_text='Allow clients to place orders')
    min_order_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Minimum order subtotal'
    )
    allow_wallet_payment = models.BooleanField(default=True, help_text='Allow paying with wallet balance')

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
        """Get or create config for organization with sensible defaults."""
        config, _ = cls.objects.get_or_create(organization=organization)
        return config

    def get_loyalty_value(self, points):
        """Convert points to currency value using this org's ratio."""
        if self.loyalty_redemption_ratio <= 0:
            return Decimal('0.00')
        return Decimal(str(points)) / self.loyalty_redemption_ratio

    def get_points_for_amount(self, currency_amount):
        """Calculate points earned for a given spend amount."""
        return int(Decimal(str(currency_amount)) * self.loyalty_earn_rate)

    def get_delivery_fee(self, order_subtotal):
        """Calculate delivery fee (may be waived above threshold)."""
        if self.free_delivery_threshold > 0 and order_subtotal >= self.free_delivery_threshold:
            return Decimal('0.00')
        return self.default_delivery_fee


# =============================================================================
# CLIENT PORTAL ACCESS
# =============================================================================

class ClientPortalAccess(TenantModel):
    """Links a CRM Contact (CUSTOMER) to a User account with portal permissions."""

    PERMISSION_CHOICES = (
        ('VIEW_ORDER_HISTORY', 'View Order History'),
        ('PLACE_ORDERS', 'Place eCommerce Orders'),
        ('VIEW_WALLET', 'View Wallet & Loyalty'),
        ('REDEEM_LOYALTY', 'Redeem Loyalty Points'),
        ('SUBMIT_TICKETS', 'Submit Support Tickets'),
        ('VIEW_CATALOG', 'Browse Product Catalog'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending Verification'),
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('REVOKED', 'Revoked'),
    )

    contact = models.OneToOneField(
        'crm.Contact', on_delete=models.CASCADE,
        related_name='client_portal_access',
        limit_choices_to={'type': 'CUSTOMER'},
    )
    user = models.OneToOneField(
        'erp.User', on_delete=models.CASCADE,
        related_name='client_access',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    permissions = models.JSONField(default=list, blank=True, help_text='List of permission codes')
    granted_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='client_accesses_granted',
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)

    # Client barcode for POS identification
    barcode = models.CharField(max_length=50, unique=True, null=True, blank=True,
                                help_text='Scannable barcode for POS identification')

    class Meta:
        db_table = 'client_portal_access'
        verbose_name_plural = 'Client Portal Accesses'

    def __str__(self):
        return f"ClientAccess: {self.contact} → {self.user}"

    def has_permission(self, perm_code):
        return perm_code in (self.permissions or [])

    def generate_barcode(self):
        """Auto-generate a unique barcode for POS scanning."""
        if not self.barcode:
            self.barcode = f"CLT-{uuid.uuid4().hex[:10].upper()}"
            self.save(update_fields=['barcode'])
        return self.barcode


# =============================================================================
# DIGITAL WALLET
# =============================================================================

class ClientWallet(TenantModel):
    """Digital coin wallet — stores POS change, loyalty redemptions, credits."""

    contact = models.OneToOneField(
        'crm.Contact', on_delete=models.CASCADE,
        related_name='wallet',
        limit_choices_to={'type': 'CUSTOMER'},
    )
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    loyalty_points = models.IntegerField(default=0, help_text='Current redeemable loyalty points')
    lifetime_points = models.IntegerField(default=0, help_text='Total points ever earned')
    currency = models.CharField(max_length=10, default='USD')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'client_wallet'

    def __str__(self):
        return f"Wallet: {self.contact} — {self.currency} {self.balance}"

    def credit(self, amount, reason='', reference_type='', reference_id=None):
        """Add funds to wallet."""
        self.balance += Decimal(str(amount))
        self.save(update_fields=['balance', 'updated_at'])
        return WalletTransaction.objects.create(
            organization=self.organization,
            wallet=self,
            transaction_type='CREDIT',
            amount=Decimal(str(amount)),
            balance_after=self.balance,
            reason=reason,
            reference_type=reference_type,
            reference_id=reference_id,
        )

    def debit(self, amount, reason='', reference_type='', reference_id=None):
        """Deduct funds from wallet."""
        amount = Decimal(str(amount))
        if amount > self.balance:
            raise ValueError(f"Insufficient wallet balance: {self.balance} < {amount}")
        self.balance -= amount
        self.save(update_fields=['balance', 'updated_at'])
        return WalletTransaction.objects.create(
            organization=self.organization,
            wallet=self,
            transaction_type='DEBIT',
            amount=amount,
            balance_after=self.balance,
            reason=reason,
            reference_type=reference_type,
            reference_id=reference_id,
        )

    def add_loyalty_points(self, points):
        """Add loyalty points (usually from a sale)."""
        self.loyalty_points += points
        self.lifetime_points += points
        self.save(update_fields=['loyalty_points', 'lifetime_points', 'updated_at'])

    def redeem_loyalty_points(self, points, discount_amount):
        """Burn points and credit wallet with equivalent discount."""
        if points > self.loyalty_points:
            raise ValueError(f"Insufficient points: {self.loyalty_points} < {points}")
        self.loyalty_points -= points
        self.save(update_fields=['loyalty_points', 'updated_at'])
        return self.credit(discount_amount, reason=f'Loyalty redemption ({points} points)',
                           reference_type='LoyaltyRedemption')


class WalletTransaction(TenantModel):
    """Audit log of all wallet credits/debits."""

    TRANSACTION_TYPES = (
        ('CREDIT', 'Credit'),
        ('DEBIT', 'Debit'),
    )

    wallet = models.ForeignKey(ClientWallet, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    balance_after = models.DecimalField(max_digits=15, decimal_places=2)
    reason = models.CharField(max_length=255, blank=True, default='')
    reference_type = models.CharField(max_length=50, blank=True, default='',
                                       help_text='e.g. ClientOrder, LoyaltyRedemption, POSChange')
    reference_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wallet_transaction'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.transaction_type} {self.amount} → {self.wallet.contact}"


# =============================================================================
# eCOMMERCE ORDERS
# =============================================================================

class ClientOrder(TenantModel):
    """eCommerce order placed by a client through the portal."""

    STATUS_CHOICES = (
        ('CART', 'In Cart'),
        ('PLACED', 'Order Placed'),
        ('CONFIRMED', 'Confirmed'),
        ('PROCESSING', 'Processing'),
        ('SHIPPED', 'Shipped'),
        ('DELIVERED', 'Delivered'),
        ('CANCELLED', 'Cancelled'),
        ('RETURNED', 'Returned'),
    )
    PAYMENT_STATUS = (
        ('UNPAID', 'Unpaid'),
        ('PAID', 'Paid'),
        ('PARTIAL', 'Partially Paid'),
        ('REFUNDED', 'Refunded'),
    )

    order_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='client_orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CART')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='UNPAID')
    payment_method = models.CharField(max_length=50, default='WALLET',
                                       help_text='WALLET, CASH, CARD, MOBILE_MONEY')

    # Delivery
    delivery_address = models.TextField(blank=True, default='')
    delivery_phone = models.CharField(max_length=50, blank=True, default='')
    delivery_notes = models.TextField(blank=True, default='')
    estimated_delivery = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    delivery_rating = models.IntegerField(null=True, blank=True, help_text='1-5 star rating')
    delivery_feedback = models.TextField(blank=True, default='')

    # Totals
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    delivery_fee = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    wallet_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                                         help_text='Amount paid from wallet')
    loyalty_points_used = models.IntegerField(default=0)

    currency = models.CharField(max_length=10, default='USD')
    notes = models.TextField(blank=True, default='')

    # Linked POS order (when converted)
    pos_order = models.ForeignKey('pos.Order', on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='client_orders')

    placed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'client_order'
        ordering = ['-created_at']

    def __str__(self):
        return self.order_number or f"CLO-{self.id}"

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = f"CLO-{timezone.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        from django.db.models import Sum
        agg = self.lines.aggregate(
            total=Sum('line_total'),
            tax=Sum('tax_amount'),
        )
        self.subtotal = agg['total'] or Decimal('0.00')
        self.tax_amount = agg['tax'] or Decimal('0.00')
        self.total_amount = self.subtotal + self.tax_amount + self.delivery_fee - self.discount_amount
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount', 'updated_at'])


class ClientOrderLine(TenantModel):
    """Line item for a client eCommerce order."""

    order = models.ForeignKey(ClientOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=255, help_text='Snapshot at time of order')
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    line_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'client_order_line'

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"

    def save(self, *args, **kwargs):
        subtotal = self.quantity * self.unit_price
        discount = subtotal * (self.discount_percent / 100)
        after_discount = subtotal - discount
        self.tax_amount = after_discount * (self.tax_rate / 100)
        self.line_total = after_discount + self.tax_amount
        super().save(*args, **kwargs)


# =============================================================================
# SUPPORT TICKETS
# =============================================================================

class ClientTicket(TenantModel):
    """Support ticket / complaint from a client."""

    TICKET_TYPES = (
        ('GENERAL', 'General Inquiry'),
        ('ORDER_ISSUE', 'Order Issue'),
        ('DELIVERY_PROBLEM', 'Delivery Problem'),
        ('RETURN_REQUEST', 'Return Request'),
        ('PRODUCT_FEEDBACK', 'Product Feedback'),
        ('COMPLAINT', 'Complaint'),
        ('SUGGESTION', 'Suggestion'),
    )
    STATUS_CHOICES = (
        ('OPEN', 'Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('WAITING_CLIENT', 'Waiting for Client'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
    )
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )

    ticket_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='support_tickets')
    ticket_type = models.CharField(max_length=20, choices=TICKET_TYPES, default='GENERAL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')
    subject = models.CharField(max_length=255)
    description = models.TextField()

    # Related order (if applicable)
    related_order = models.ForeignKey(ClientOrder, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='tickets')

    # Resolution
    assigned_to = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='assigned_tickets')
    resolution_notes = models.TextField(blank=True, default='')
    resolved_at = models.DateTimeField(null=True, blank=True)

    # Client satisfaction
    satisfaction_rating = models.IntegerField(null=True, blank=True, help_text='1-5 star rating')
    satisfaction_feedback = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'client_ticket'
        ordering = ['-created_at']

    def __str__(self):
        return self.ticket_number or f"TKT-{self.id}"

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = f"TKT-{timezone.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)


# =============================================================================
# QUOTE REQUESTS (CATALOGUE MODE)
# =============================================================================

class QuoteRequest(TenantModel):
    """
    Leads/Inquiries from the Catalogue storefront.
    Allows guests and registered clients to request quotes for specific products.
    """
    STATUS_CHOICES = (
        ('PENDING', 'Pending Assessment'),
        ('REPLIED', 'Proposal Sent'),
        ('CONVERTED', 'Converted to Order'),
        ('DECLINED', 'Declined'),
        ('EXPIRED', 'Expired'),
    )

    quote_number = models.CharField(max_length=50, unique=True, null=True, blank=True)

    # Customer Info (Can be Guest or Registered)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='quote_requests')

    # Guest details (if no contact)
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True, default='')
    company_name = models.CharField(max_length=255, blank=True, default='')

    # Message / Requirements
    message = models.TextField(help_text='Customer requirements or questions')
    internal_notes = models.TextField(blank=True, default='')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    # Tracking
    source_url = models.URLField(blank=True, default='', help_text='The page where the quote was requested')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'client_quote_request'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.quote_number} — {self.full_name}"

    def save(self, *args, **kwargs):
        if not self.quote_number:
            self.quote_number = f"QT-{timezone.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)


class QuoteItem(TenantModel):
    """
    Individual items within a quote request.
    """
    quote_request = models.ForeignKey(QuoteRequest, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=255, help_text='Snapshot of product name')
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=1)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'client_quote_item'

    def __str__(self):
        return f"{self.product_name} x {self.quantity}"
