from django.db import models
from erp.models import TenantModel

class TaxGroup(TenantModel):
    name = models.CharField(max_length=100)
    rate = models.DecimalField(max_digits=5, decimal_places=2)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    class Meta:
        db_table = 'taxgroup'
        unique_together = ('name', 'organization')
        ordering = ['-is_default', 'name']
    def __str__(self):
        return f"{self.name} ({self.rate}%)"

class BarcodeSettings(TenantModel):
    prefix = models.CharField(max_length=10, default="200")
    next_sequence = models.IntegerField(default=1000)
    format = models.CharField(max_length=20, default='EAN13')
    is_enabled = models.BooleanField(default=True)
    length = models.IntegerField(default=13)
    class Meta:
        db_table = 'barcodesettings'
