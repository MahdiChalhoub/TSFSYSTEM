from django.db import models
from erp.models import TenantModel, Site
from apps.finance.models.coa_models import FinancialAccount

class Transaction(TenantModel):
    account = models.ForeignKey(FinancialAccount, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    type = models.CharField(max_length=10)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    description = models.CharField(max_length=255, null=True, blank=True)
    reference = models.CharField(max_length=100, null=True, blank=True)
    reference_id = models.CharField(max_length=100, null=True, blank=True)
    site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    class Meta:
        db_table = 'transaction'

class TransactionSequence(TenantModel):
    type = models.CharField(max_length=50)
    prefix = models.CharField(max_length=20, null=True, blank=True)
    suffix = models.CharField(max_length=20, null=True, blank=True)
    next_number = models.IntegerField(default=1)
    padding = models.IntegerField(default=6)
    class Meta:
        db_table = 'transactionsequence'
        unique_together = ('type', 'organization')
    @classmethod
    def next_value(cls, organization, seq_type):
        from django.db.models import F
        seq, created = cls.objects.get_or_create(
            organization=organization,
            type=seq_type,
            defaults={'prefix': seq_type[:3].upper() + '-', 'next_number': 1, 'padding': 6}
        )
        current = seq.next_number
        cls.objects.filter(id=seq.id).update(next_number=F('next_number') + 1)
        prefix = seq.prefix or ''
        suffix = seq.suffix or ''
        return f"{prefix}{str(current).zfill(seq.padding)}{suffix}"
