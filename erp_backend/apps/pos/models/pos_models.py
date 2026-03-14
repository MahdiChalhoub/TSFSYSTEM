from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal
from erp.models import TenantModel, User

class Order(TenantModel):
    TYPES = (('SALE', 'Sale'), ('PURCHASE', 'Purchase'), ('RETURN', 'Return'))

    # ── Legacy flat status (kept for immutability guard & backward compat) ──
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'), ('PENDING', 'Pending'), ('AUTHORIZED', 'Authorized'),
        ('RECEIVED', 'Received'), ('INVOICED', 'Invoiced'), ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled')
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    # ── Gap 1: 4-Axis Layered Workflow Status ──────────────────────────────
    ORDER_STATUS_CHOICES = [
        ('DRAFT',      'Draft'),
        ('CONFIRMED',  'Confirmed'),
        ('PROCESSING', 'Processing'),
        ('CLOSED',     'Closed'),
        ('CANCELLED',  'Cancelled'),
    ]
    DELIVERY_STATUS_CHOICES = [
        ('PENDING',   'Pending'),
        ('PARTIAL',   'Partially Delivered'),
        ('DELIVERED', 'Delivered'),
        ('RETURNED',  'Returned'),
        ('NA',        'Not Applicable'),
    ]
    PAYMENT_STATUS_CHOICES = [
        ('UNPAID',       'Unpaid'),
        ('PARTIAL',      'Partially Paid'),
        ('PAID',         'Paid'),
        ('OVERPAID',     'Overpaid'),
        ('WRITTEN_OFF',  'Written Off'),
    ]
    INVOICE_STATUS_CHOICES = [
        ('NOT_GENERATED', 'Not Generated'),
        ('GENERATED',     'Generated'),
        ('SENT',          'Sent to Client'),
        ('DISPUTED',      'Disputed'),
    ]

    order_status    = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES,   default='CONFIRMED', db_index=True)
    delivery_status = models.CharField(max_length=20, choices=DELIVERY_STATUS_CHOICES, default='PENDING',  db_index=True)
    payment_status  = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES,  default='UNPAID',   db_index=True)
    invoice_status  = models.CharField(max_length=20, choices=INVOICE_STATUS_CHOICES,  default='NOT_GENERATED')

    # Workflow timestamps
    confirmed_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    invoiced_at  = models.DateTimeField(null=True, blank=True)
    closed_at    = models.DateTimeField(null=True, blank=True)

    type = models.CharField(max_length=20, choices=TYPES)
    ref_code = models.CharField(max_length=100, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    site = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='orders', help_text='Branch/location where this order was made')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    airsi_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    extra_fees = models.JSONField(default=list, blank=True)
    vat_recoverable = models.BooleanField(default=False)
    payment_method = models.CharField(max_length=50, default='CASH')
    invoice_price_type = models.CharField(max_length=20, default='TTC')
    is_locked = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    invoice_number = models.CharField(max_length=100, null=True, blank=True)
    # Invoice document type — auto-resolved at checkout via TaxCalculator.resolve_invoice_type()
    invoice_type = models.CharField(
        max_length=20,
        choices=[
            ('TVA_INVOICE',      'Official TVA Invoice (HT + TVA + TTC)'),
            ('RECEIPT',          'Simple Receipt (TTC only, VAT embedded)'),
            ('INTERNAL_RECEIPT', 'Internal Receipt (no VAT posted)'),
            ('SIMPLE_INVOICE',   'Simple Invoice (org not VAT-registered)'),
        ],
        default='RECEIPT',
        null=True, blank=True,
        help_text='Auto-resolved from org policy + client profile + scope at checkout.'
    )
    is_export = models.BooleanField(
        default=False,
        help_text='True = export sale → VAT rate overridden to 0'
    )

    # ── Destination-Based Tax Fields ──────────────────────────────────
    destination_country = models.CharField(
        max_length=3, null=True, blank=True,
        help_text='ISO country code of delivery destination (null = same as org origin)'
    )
    destination_region = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='State/province/region for sub-national taxes (e.g. CA, ON)'
    )
    tax_jurisdiction_code = models.CharField(
        max_length=20, null=True, blank=True,
        help_text='Resolved jurisdiction code (e.g. CI, US-CA, EU-DE) — read-only after calculation'
    )
    place_of_supply_mode = models.CharField(
        max_length=20, default='ORIGIN',
        choices=[('ORIGIN', 'Origin'), ('DESTINATION', 'Destination'), ('REVERSE_CHARGE', 'Reverse Charge')],
        help_text='How tax jurisdiction was determined'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    receipt_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    previous_hash = models.CharField(max_length=64, null=True, blank=True)

    def calculate_hash(self):
        import hashlib, json
        def serializer(obj):
            if isinstance(obj, Decimal): return str(obj)
            return str(obj)
        lines_data = [{"product_id": l.product_id, "qty": str(l.quantity), "price": str(l.unit_price)} for l in self.lines.all()]
        data = {"id": self.id, "organization_id": self.organization_id, "type": self.type, "total": str(self.total_amount), "invoice_number": self.invoice_number, "lines": lines_data, "previous_hash": self.previous_hash or "GENESIS"}
        return hashlib.sha256(json.dumps(data, sort_keys=True, default=serializer).encode('utf-8')).hexdigest()

    def save(self, *args, **kwargs):
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.pk:
            original = Order.objects.get(pk=self.pk)
            if original.status in ['COMPLETED', 'INVOICED', 'RECEIVED'] and not bypass:
                raise ValidationError(f"Immutable POS: Orders in status '{original.status}' cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status in ['COMPLETED', 'INVOICED', 'RECEIVED']:
            raise ValidationError(f"Immutable POS: Orders in status '{self.status}' cannot be deleted.")
        super().delete(*args, **kwargs)

    class Meta:
        db_table = 'pos_order'
        indexes = [
            # Gap 10 — Performance Architecture: compound indexes for common filter patterns
            models.Index(fields=['order_status', 'created_at'],     name='pos_order_status_date_idx'),
            models.Index(fields=['contact', 'payment_status'],      name='pos_order_contact_payment_idx'),
            models.Index(fields=['site', 'delivery_status'],        name='pos_order_site_delivery_idx'),
            models.Index(fields=['user', 'created_at'],             name='pos_order_cashier_date_idx'),
            models.Index(fields=['organization', 'type', 'created_at'], name='pos_order_org_type_date_idx'),
        ]

class OrderLine(TenantModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='order_lines')
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    airsi_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # ── Gap 6: Tax-Split Fields (HT / VAT / TTC) ──────────────────────────
    tax_amount_ht  = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Line amount excluding VAT (HT)')
    tax_amount_vat = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='VAT portion on this line')
    tax_amount_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total including VAT (TTC) — stored for audit')
    airsi_withheld = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='AIRSI withholding on this line (if applicable)')
    is_tax_exempt  = models.BooleanField(default=False, help_text='True = line is VAT-exempt')

    # ── Gap 2: COGS Fields ────────────────────────────────────────────────
    unit_cost_ht         = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal('0.0000'),
        help_text='Average Moving Cost at time of sale (AMC)')
    effective_cost       = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal('0.0000'),
        help_text='Effective cost used for COGS posting')
    price_override_detected = models.BooleanField(default=False,
        help_text='True if unit_price deviated >5% below base selling price')

    # Tracking Fields
    expiry_date = models.DateField(null=True, blank=True)
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    serial_number = models.CharField(max_length=200, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    
    def save(self, *args, **kwargs):
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.order and self.order.status in ['COMPLETED', 'INVOICED', 'RECEIVED'] and not bypass:
            raise ValidationError(f"Immutable POS: Lines belonging to order {self.order.id} ({self.order.status}) cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.order and self.order.status in ['COMPLETED', 'INVOICED', 'RECEIVED']:
            raise ValidationError(f"Immutable POS: Lines belonging to order {self.order.id} ({self.order.status}) cannot be deleted.")
        super().delete(*args, **kwargs)

    class Meta:
        db_table = 'pos_orderline'

class PosTicket(TenantModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pos_tickets')
    name = models.CharField(max_length=200)
    ticket_id = models.CharField(max_length=100)
    data = models.JSONField(default=dict)
    is_synced = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    class Meta:
        db_table = 'pos_ticket'
        unique_together = ('user', 'ticket_id')
    def __str__(self):
        return f"Ticket {self.name} ({self.user.username})"
