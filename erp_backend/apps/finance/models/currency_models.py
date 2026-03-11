"""
Multi-Currency Models — Currency registry + exchange rate history.

Used by:
  - JournalEntry (transaction currency)
  - JournalEntryLine (line-level currency)
  - ChartOfAccount (account currency restriction)
  - Revaluation engine
  - Reporting (converted statements)
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class Currency(TenantModel):
    """
    Supported currencies per organization.
    One currency per org is marked as base (functional) currency.
    """
    code = models.CharField(max_length=10, help_text='ISO 4217 code, e.g. USD, EUR, XOF')
    name = models.CharField(max_length=100, help_text='Currency name, e.g. US Dollar')
    symbol = models.CharField(max_length=10, default='$')
    decimal_places = models.PositiveSmallIntegerField(default=2)
    is_base = models.BooleanField(
        default=False,
        help_text='Functional/base currency for this organization'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_currency'
        unique_together = ('organization', 'code')
        ordering = ['-is_base', 'code']

    def __str__(self):
        return f"{self.code} ({self.name})"


class ExchangeRate(TenantModel):
    """
    Daily exchange rates. Rate = 1 unit of `from_currency` in `to_currency`.

    For reporting: we always store rates relative to the org's base currency.
    Example: if base=XOF, then EUR→XOF rate=655.957
    """
    RATE_TYPES = [
        ('SPOT', 'Spot Rate'),
        ('AVERAGE', 'Monthly Average'),
        ('CLOSING', 'Period Closing Rate'),
        ('BUDGET', 'Budget Rate'),
    ]

    from_currency = models.ForeignKey(
        Currency, on_delete=models.CASCADE, related_name='rates_from'
    )
    to_currency = models.ForeignKey(
        Currency, on_delete=models.CASCADE, related_name='rates_to'
    )
    rate = models.DecimalField(
        max_digits=18, decimal_places=10,
        help_text='1 unit of from_currency = rate units of to_currency'
    )
    rate_type = models.CharField(
        max_length=20, choices=RATE_TYPES, default='SPOT'
    )
    effective_date = models.DateField(db_index=True)
    source = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='Rate source: MANUAL, ECB, BCEAO, IMPORT'
    )

    class Meta:
        db_table = 'finance_exchange_rate'
        unique_together = ('organization', 'from_currency', 'to_currency', 'effective_date', 'rate_type')
        ordering = ['-effective_date']
        indexes = [
            models.Index(fields=['organization', 'from_currency', 'to_currency', 'effective_date']),
        ]

    def __str__(self):
        return f"{self.from_currency.code}→{self.to_currency.code} = {self.rate} ({self.effective_date})"

    @property
    def inverse_rate(self):
        """Inverse rate for reverse conversion."""
        if self.rate and self.rate != Decimal('0'):
            return Decimal('1') / self.rate
        return Decimal('0')


class CurrencyRevaluation(TenantModel):
    """
    Records a foreign currency revaluation run.
    At period-end, unrealized FX gains/losses are computed by
    revaluing foreign-currency denominated balances at closing rates.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('POSTED', 'Posted'),
        ('REVERSED', 'Reversed'),
    ]

    fiscal_period = models.ForeignKey(
        'finance.FiscalPeriod', on_delete=models.PROTECT,
        related_name='revaluations'
    )
    revaluation_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    scope = models.CharField(max_length=20, default='OFFICIAL')

    # Totals
    total_gain = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_loss = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    net_impact = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    accounts_processed = models.PositiveIntegerField(default=0)

    # Link to generated JE
    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='revaluation_source'
    )

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='currency_revaluations'
    )

    class Meta:
        db_table = 'finance_currency_revaluation'
        ordering = ['-revaluation_date']
        indexes = [
            models.Index(fields=['organization', 'fiscal_period']),
        ]

    def __str__(self):
        return f"Revaluation {self.revaluation_date} ({self.status})"


class CurrencyRevaluationLine(TenantModel):
    """Per-account detail of a revaluation run."""
    revaluation = models.ForeignKey(
        CurrencyRevaluation, on_delete=models.CASCADE, related_name='lines'
    )
    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.PROTECT
    )
    currency = models.ForeignKey(
        Currency, on_delete=models.PROTECT,
        help_text='Foreign currency of this account'
    )
    balance_in_currency = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='Account balance in foreign currency'
    )
    old_rate = models.DecimalField(
        max_digits=18, decimal_places=10,
        help_text='Rate at which the balance was originally booked (average)'
    )
    new_rate = models.DecimalField(
        max_digits=18, decimal_places=10,
        help_text='Period-end closing rate'
    )
    old_base_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='Balance in base currency at old rate'
    )
    new_base_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='Balance in base currency at new rate'
    )
    difference = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='Unrealized gain (+) or loss (-) in base currency'
    )

    class Meta:
        db_table = 'finance_currency_revaluation_line'

    def __str__(self):
        return f"Reval {self.account.code} {self.currency.code}: {self.difference}"
