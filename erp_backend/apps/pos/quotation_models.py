"""
Quotation / Proforma Models
Pre-sale documents that can be converted into Orders.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User


class Quotation(TenantModel):
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('SENT', 'Sent'),
        ('ACCEPTED', 'Accepted'),
        ('REJECTED', 'Rejected'),
        ('EXPIRED', 'Expired'),
        ('CONVERTED', 'Converted to Sale'),
    )
    reference = models.CharField(max_length=100, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotations')
    site = models.ForeignKey('erp.Site', on_delete=models.SET_NULL, null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    valid_until = models.DateField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    terms = models.TextField(null=True, blank=True, help_text='Terms and conditions')

    total_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_tax = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # If converted to an order, link it
    converted_order = models.ForeignKey(
        'pos.Order', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='source_quotation'
    )

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'pos_quotation'
        ordering = ['-created_at']

    def __str__(self):
        return f"QUO-{self.reference or self.id}"

    def recalculate_totals(self):
        """Recalculate totals from lines."""
        lines = self.lines.all()
        self.total_ht = sum(l.total_ht for l in lines)
        self.total_tax = sum(l.tax_amount for l in lines)
        self.total_ttc = sum(l.total_ttc for l in lines)
        self.save(update_fields=['total_ht', 'total_tax', 'total_ttc'])


class QuotationLine(TenantModel):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('1.00'))
    unit_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    unit_price_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'pos_quotation_line'
