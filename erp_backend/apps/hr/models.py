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
    name = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    position = models.CharField(max_length=255, null=True, blank=True)
    department = models.CharField(max_length=255, null=True, blank=True)
    linked_account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL, null=True, blank=True
    )
    linked_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    salary = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    hire_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Employee'

    def __str__(self):
        return self.name
