"""
HR Module Models
Extracted from Kernel (erp/models.py) → Module Layer (apps/hr/models.py)
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User


class Employee(TenantModel):
    employee_id = models.CharField(max_length=100, unique=True)
    first_name = models.CharField(max_length=255, null=True, blank=True)
    last_name = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    job_title = models.CharField(max_length=255, null=True, blank=True)
    salary = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    linked_account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL, null=True, blank=True
    )
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, db_column='user_id')
    home_site = models.ForeignKey('erp.Site', on_delete=models.SET_NULL, null=True, blank=True)
    address_line = models.TextField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'employee'

    def __str__(self):
        return f"{self.first_name or ''} {self.last_name or ''}".strip() or self.employee_id

