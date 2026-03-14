"""Payment Terms — dynamic, organization-scoped payment conditions."""
from django.db import models
from erp.models import TenantModel


class PaymentTerm(TenantModel):
    """Configurable payment condition for purchase orders and invoices."""
    name = models.CharField(max_length=100, help_text='Display name, e.g. "Net 30 Days"')
    code = models.CharField(max_length=30, help_text='Short code, e.g. NET_30')
    description = models.TextField(null=True, blank=True, help_text='Detailed description of the terms')
    days = models.IntegerField(default=0, help_text='Number of days until payment is due (0 = immediate)')
    discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text='Early payment discount %% (e.g. 2%% discount if paid within discount_days)')
    discount_days = models.IntegerField(
        default=0, help_text='Days within which discount applies (0 = no discount)')
    is_default = models.BooleanField(default=False, help_text='Set as default for new POs')
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0, help_text='Display order')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'payment_term'
        ordering = ['sort_order', 'name']
        unique_together = ('organization', 'code')

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Ensure only one default per org
        if self.is_default:
            PaymentTerm.objects.filter(
                organization=self.organization, is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
