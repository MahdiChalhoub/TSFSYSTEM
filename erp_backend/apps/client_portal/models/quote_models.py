import uuid
from django.db import models
from django.utils import timezone
from erp.models import TenantModel

class QuoteRequest(TenantModel):
    STATUS_CHOICES = (
        ('PENDING', 'Pending Assessment'), ('REPLIED', 'Proposal Sent'),
        ('CONVERTED', 'Converted to Order'), ('DECLINED', 'Declined'), ('EXPIRED', 'Expired'),
    )

    quote_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='quote_requests')
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True, default='')
    company_name = models.CharField(max_length=255, blank=True, default='')
    message = models.TextField()
    internal_notes = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    source_url = models.URLField(blank=True, default='')
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
    quote_request = models.ForeignKey(QuoteRequest, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.SET_NULL, null=True, blank=True)
    variant = models.ForeignKey('inventory.ProductVariant', on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=1)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'client_quote_item'

    def __str__(self):
        return f"{self.product_name} x {self.quantity}"
