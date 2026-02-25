from django.db import models
from erp.models import TenantModel, User

class ProfitDistribution(TenantModel):
    STATUS_CHOICES = (('DRAFT', 'Draft'), ('APPROVED', 'Approved'), ('POSTED', 'Posted'))
    fiscal_year = models.ForeignKey('finance.FiscalYear', on_delete=models.CASCADE, related_name='profit_distributions')
    net_profit = models.DecimalField(max_digits=15, decimal_places=2)
    distribution_date = models.DateField()
    allocations = models.JSONField(default=dict)
    notes = models.TextField(null=True, blank=True)
    journal_entry = models.ForeignKey('finance.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    class Meta:
        db_table = 'profitdistribution'

class ForensicAuditLog(TenantModel):
    CHANGE_TYPES = (('CREATE', 'Create'), ('UPDATE', 'Update'), ('DELETE', 'Delete'), ('POST', 'Post'), ('REVERSE', 'Reverse'))
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100)
    change_type = models.CharField(max_length=20, choices=CHANGE_TYPES)
    payload = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'forensicauditlog'
        ordering = ['-timestamp']
        indexes = [models.Index(fields=['organization', 'model_name', 'object_id']), models.Index(fields=['organization', 'timestamp'])]
