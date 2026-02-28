from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal
from erp.models import TenantModel, User
from apps.finance.models.coa_models import ChartOfAccount
from apps.finance.models.fiscal_models import FiscalYear, FiscalPeriod

class JournalEntry(TenantModel):
    transaction_date = models.DateTimeField(null=True, blank=True)
    description = models.TextField()
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.PROTECT, null=True, blank=True)
    fiscal_period = models.ForeignKey(FiscalPeriod, on_delete=models.PROTECT, null=True, blank=True, related_name='journal_entries')
    status = models.CharField(max_length=20, default='DRAFT')
    reference = models.CharField(max_length=100, null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    site = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True)
    is_locked = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    posted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_journal_entries')
    posted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='posted_journal_entries')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    entry_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    previous_hash = models.CharField(max_length=64, null=True, blank=True)

    def calculate_hash(self):
        from apps.finance.cryptography import LedgerCryptography
        lines_data = []
        for line in self.lines.all():
            lines_data.append({"account_id": str(line.account_id), "debit": str(line.debit), "credit": str(line.credit)})
        entry_meta = {"id": self.id, "organization_id": str(self.organization_id), "transaction_date": self.transaction_date.isoformat() if self.transaction_date else None, "reference": self.reference, "lines": lines_data}
        return LedgerCryptography.calculate_entry_hash(entry_meta, self.previous_hash)

    def save(self, *args, **kwargs):
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.pk:
            original = JournalEntry.objects.get(pk=self.pk)
            if original.status == 'POSTED' and self.status == 'POSTED' and not bypass:
                raise ValidationError("Immutable Ledger: 'POSTED' entries cannot be modified. Use reversals instead.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status == 'POSTED':
            raise ValidationError("Immutable Ledger: 'POSTED' entries cannot be deleted.")
        super().delete(*args, **kwargs)

    class Meta:
        db_table = 'journalentry'
        unique_together = ('reference', 'organization')
        indexes = [
            models.Index(fields=['organization', 'transaction_date']),
            models.Index(fields=['organization', 'scope']),
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['reference']),
        ]

    def __str__(self):
        return f"JE-{self.id}: {self.description[:50]}"

class JournalEntryLine(TenantModel):
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True)
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    description = models.CharField(max_length=255, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_lines')
    employee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_lines_employee')

    class Meta:
        db_table = 'journalentryline'
        indexes = [
            models.Index(fields=['organization', 'account']),
            models.Index(fields=['journal_entry']),
            models.Index(fields=['organization', 'debit', 'credit']),
        ]

    def save(self, *args, **kwargs):
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.journal_entry_id and not bypass:
            if self.journal_entry.status == 'POSTED':
                from django.core.exceptions import ValidationError
                raise ValidationError(f"Immutable Ledger: Cannot modify lines of a POSTED JournalEntry {self.journal_entry.reference or self.journal_entry.id}.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.journal_entry_id:
            if self.journal_entry.status == 'POSTED':
                from django.core.exceptions import ValidationError
                raise ValidationError(f"Immutable Ledger: Cannot delete lines of a POSTED JournalEntry {self.journal_entry.reference or self.journal_entry.id}.")
        super().delete(*args, **kwargs)
