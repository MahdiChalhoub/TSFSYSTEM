"""
Account Balance Snapshot — Reporting cache for fast financial statements.
Instead of recomputing balances from JournalEntryLine every time,
snapshots store pre-computed period balances that can be refreshed.

Used by: Trial Balance, P&L, Balance Sheet, Dashboards
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class AccountBalanceSnapshot(TenantModel):
    """
    Pre-computed balance per account per fiscal period per scope.
    Refreshed at period close or on-demand via BalanceService.

    Reporting queries go:
      SELECT * FROM account_balance_snapshot
      WHERE fiscal_period_id = X AND scope = 'OFFICIAL'

    Instead of:
      SELECT account_id, SUM(debit)-SUM(credit) FROM journalentryline
      WHERE ... GROUP BY account_id  (expensive at scale)
    """

    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.CASCADE,
        related_name='balance_snapshots'
    )
    fiscal_period = models.ForeignKey(
        'finance.FiscalPeriod', on_delete=models.CASCADE,
        related_name='balance_snapshots'
    )
    scope = models.CharField(max_length=20, default='OFFICIAL')

    # Opening balances for this period (carried from prior period close)
    opening_debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    opening_credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Movement during this period
    movement_debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    movement_credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Closing = opening + movement
    closing_debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    closing_credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Transaction count (for audit/verification)
    transaction_count = models.IntegerField(default=0)

    # Freshness
    computed_at = models.DateTimeField(auto_now=True)
    is_stale = models.BooleanField(
        default=False,
        help_text='Set to True when new JEs are posted — triggers re-computation'
    )

    class Meta:
        db_table = 'account_balance_snapshot'
        unique_together = ('account', 'fiscal_period', 'scope', 'organization')
        indexes = [
            models.Index(fields=['organization', 'fiscal_period', 'scope']),
            models.Index(fields=['organization', 'account']),
            models.Index(fields=['is_stale']),
        ]

    def __str__(self):
        net = self.closing_net
        return f"Snapshot: {self.account.code} / {self.fiscal_period.name} = {net}"

    @property
    def opening_net(self):
        return self.opening_debit - self.opening_credit

    @property
    def movement_net(self):
        return self.movement_debit - self.movement_credit

    @property
    def closing_net(self):
        return self.closing_debit - self.closing_credit

    def recompute(self):
        """Recompute this snapshot from JournalEntryLine source data."""
        from django.db.models import Sum
        from apps.finance.models import JournalEntryLine

        lines = JournalEntryLine.objects.filter(
            organization=self.organization,
            account=self.account,
            journal_entry__status='POSTED',
            journal_entry__fiscal_period=self.fiscal_period,
        )
        if self.scope == 'OFFICIAL':
            lines = lines.filter(journal_entry__scope='OFFICIAL')

        agg = lines.aggregate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit'),
            count=models.Count('id'),
        )

        self.movement_debit = agg['total_debit'] or Decimal('0.00')
        self.movement_credit = agg['total_credit'] or Decimal('0.00')
        self.transaction_count = agg['count'] or 0
        self.closing_debit = self.opening_debit + self.movement_debit
        self.closing_credit = self.opening_credit + self.movement_credit
        self.is_stale = False
        self.save()
