from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal
from erp.models import TenantModel, User

class Order(TenantModel):
    TYPES = (('SALE', 'Sale'), ('PURCHASE', 'Purchase'), ('RETURN', 'Return'))
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'), ('PENDING', 'Pending'), ('AUTHORIZED', 'Authorized'),
        ('RECEIVED', 'Received'), ('INVOICED', 'Invoiced'), ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled')
    )
    type = models.CharField(max_length=20, choices=TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
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

class OrderLine(TenantModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='order_lines')
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    airsi_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
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
