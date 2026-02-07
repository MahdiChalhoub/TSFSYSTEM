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
    )
    type = models.CharField(max_length=20, choices=TYPES)
    name = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    linked_account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)
    is_airsi_subject = models.BooleanField(default=False)
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Contact'

    def __str__(self):
        return f"{self.name} ({self.type})"
