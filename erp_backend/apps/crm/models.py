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
    )
    type = models.CharField(max_length=20, choices=TYPES)
    name = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    vat_id = models.CharField(max_length=100, null=True, blank=True)
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    linked_account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL, null=True, blank=True
    )
    home_site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True)
    customer_type = models.CharField(max_length=50, null=True, blank=True)
    airsi_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    is_airsi_subject = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'contact'

    def __str__(self):
        return f"{self.name} ({self.type})"

