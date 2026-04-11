from django.db import models
from erp.models import TenantModel

class Department(TenantModel):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, null=True, blank=True)
    manager = models.ForeignKey(
        'hr.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_departments'
    )
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sub_departments'
    )
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'department'

    def __str__(self):
        return f"{self.code or ''} {self.name}".strip()
