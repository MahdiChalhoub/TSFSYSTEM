import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from erp.models import TenantModel

class ClientOrder(TenantModel):
    STATUS_CHOICES = (
        ('CART', 'In Cart'), ('PLACED', 'Order Placed'), ('CONFIRMED', 'Confirmed'),
        ('PROCESSING', 'Processing'), ('SHIPPED', 'Shipped'), ('DELIVERED', 'Delivered'),
        ('CANCELLED', 'Cancelled'), ('RETURNED', 'Returned'),
    )
    PAYMENT_STATUS = (('UNPAID', 'Unpaid'), ('PAID', 'Paid'), ('PARTIAL', 'Partially Paid'), ('REFUNDED', 'Refunded'))

    order_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='client_orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CART')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='UNPAID')
    payment_method = models.CharField(max_length=50, default='WALLET')

    delivery_address = models.TextField(blank=True, default='')
    delivery_phone = models.CharField(max_length=50, blank=True, default='')
    delivery_notes = models.TextField(blank=True, default='')
    estimated_delivery = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    delivery_rating = models.IntegerField(null=True, blank=True)
    delivery_feedback = models.TextField(blank=True, default='')

    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    delivery_fee = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    wallet_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    loyalty_points_used = models.IntegerField(default=0)

    currency = models.CharField(max_length=10, default='USD')
    notes = models.TextField(blank=True, default='')
    invoice = models.ForeignKey('finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='client_orders')

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
        agg = self.lines.aggregate(total=Sum('line_total'), tax=Sum('tax_amount'))
        self.subtotal = agg['total'] or Decimal('0.00')
        self.tax_amount = agg['tax'] or Decimal('0.00')
        self.total_amount = self.subtotal + self.tax_amount + self.delivery_fee - self.discount_amount
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount', 'updated_at'])


class ClientOrderLine(TenantModel):
    order = models.ForeignKey(ClientOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.SET_NULL, null=True, blank=True)
    variant = models.ForeignKey('inventory.ProductVariant', on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=255)
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
