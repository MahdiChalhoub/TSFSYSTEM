from django.db import models
from django.core.exceptions import ValidationError
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.lifecycle.models import PostableMixin
from apps.finance.models.coa_models import FinancialAccount
from apps.finance.models.ledger_models import JournalEntry
from apps.finance.models.loan_models import FinancialEvent

class Voucher(AuditLogMixin, TenantOwnedModel, PostableMixin):
    lifecycle_txn_type = 'VOUCHER'

    VOUCHER_TYPES = (
        ('TRANSFER', 'Transfer Voucher'),
        ('RECEIPT', 'Receipt Voucher'),
        ('PAYMENT', 'Payment Voucher'),
    )
    voucher_type = models.CharField(max_length=20, choices=VOUCHER_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    date = models.DateField()
    reference = models.CharField(max_length=100, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    source_account = models.ForeignKey(FinancialAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='vouchers_out')
    destination_account = models.ForeignKey(FinancialAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='vouchers_in')
    financial_event = models.ForeignKey(FinancialEvent, on_delete=models.SET_NULL, null=True, blank=True, related_name='vouchers')
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    class Meta:
        db_table = 'voucher'
    def clean(self):
        if self.voucher_type in ('RECEIPT', 'PAYMENT') and not self.financial_event_id:
            raise ValidationError('Receipt and Payment vouchers must be linked to a financial event.')
        if self.voucher_type == 'TRANSFER' and (not self.source_account_id or not self.destination_account_id):
            raise ValidationError('Transfer vouchers require both source and destination accounts.')
