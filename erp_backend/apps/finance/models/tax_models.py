from django.db import models
from django.core.exceptions import ValidationError
from erp.models import TenantModel

class TaxGroup(TenantModel):
    """
    Named tax rate groups that can be linked to products.

    Security: Both name AND rate must be unique per organization.
    - name uniqueness: enforced by unique_together ('name', 'organization')
    - rate uniqueness: enforced by clean() validation
    """
    TAX_TYPE_CHOICES = [
        ('STANDARD', 'Standard'),
        ('REDUCED', 'Reduced'),
        ('ZERO', 'Zero Rate'),
        ('EXEMPT', 'Exempt'),
        ('REVERSE_CHARGE', 'Reverse Charge'),
    ]
    name = models.CharField(max_length=100)
    rate = models.DecimalField(max_digits=5, decimal_places=2)
    tax_type = models.CharField(
        max_length=20, choices=TAX_TYPE_CHOICES, default='STANDARD',
        help_text='Classification: STANDARD, REDUCED, ZERO, EXEMPT, REVERSE_CHARGE')
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    class Meta:
        db_table = 'taxgroup'
        unique_together = ('name', 'organization')
        ordering = ['-is_default', 'name']

    def clean(self):
        """Block duplicate rates within the same organization (used by admin/forms)."""
        if self.organization_id and self.rate is not None:
            qs = TaxGroup.objects.filter(
                organization_id=self.organization_id,
                rate=self.rate,
            )
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                existing = qs.first()
                raise ValidationError(
                    f'A tax group with rate {self.rate}% already exists: '
                    f'"{existing.name}". Each rate must be unique per organization.'
                )

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
