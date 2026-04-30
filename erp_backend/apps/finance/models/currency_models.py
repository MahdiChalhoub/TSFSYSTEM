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
    # Bid / Ask / Mid distinguishes the "side" of an FX quote — banks always
    # quote two sides, and a transactional system needs both:
    #   MID = official mid-market quote (what most accounting posts against)
    #   BID = price the operator pays YOU (you sell to operator) — lower
    #   ASK = price the operator charges YOU (you buy from operator) — higher
    # A policy with non-zero bid_spread_pct / ask_spread_pct writes a triple
    # (MID + BID + ASK) per sync; a flat-spread policy writes only MID.
    RATE_SIDES = [
        ('MID', 'Mid-market'),
        ('BID', 'Bid (operator buys)'),
        ('ASK', 'Ask (operator sells)'),
    ]
    rate_side = models.CharField(
        max_length=4, choices=RATE_SIDES, default='MID',
        help_text='MID = mid-market; BID/ASK = the buy/sell sides of a quote.',
    )
    effective_date = models.DateField(db_index=True)
    source = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='Rate source: MANUAL, ECB, BCEAO, IMPORT'
    )

    class Meta:
        db_table = 'finance_exchange_rate'
        unique_together = ('organization', 'from_currency', 'to_currency', 'effective_date', 'rate_type', 'rate_side')
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
    # PENDING_APPROVAL = the run was computed but the JE hasn't been posted
    # because the materiality threshold was tripped. A user with permission
    # must explicitly approve/reject. Reject keeps the audit lines but never
    # posts; approve flips to POSTED and generates the JE.
    STATUS_CHOICES = [
        ('DRAFT',             'Draft'),
        ('PENDING_APPROVAL',  'Pending approval'),
        ('POSTED',            'Posted'),
        ('REVERSED',          'Reversed'),
        ('REJECTED',          'Rejected'),
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

    # Materiality — net_impact / abs(total revalued base) at run time. UI uses
    # this to flag the run for review when it exceeds the org-configured
    # threshold (default 0.5%). Stored so the dashboard can show historicals.
    materiality_pct = models.DecimalField(
        max_digits=8, decimal_places=4, default=Decimal('0.0000'),
        help_text='Net impact as % of revalued base. Drives approval gate.',
    )

    # Excluded accounts (per-run opt-out). Stored as a list of COA ids so the
    # audit row tells the full story even if the COA changes later.
    excluded_account_ids = models.JSONField(
        default=list, blank=True,
        help_text='COA ids that the operator explicitly skipped on this run.',
    )

    # Auto-reversal — when True, the engine auto-posts a reversing JE on the
    # first day of the next fiscal period. Standard practice for unrealized
    # FX so the next period reval works from the original cost basis.
    auto_reverse_at_period_start = models.BooleanField(
        default=True,
        help_text='Auto-post a reversing JE on day 1 of the next fiscal period.',
    )
    reversal_journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='revaluation_reversed_source',
        help_text='The auto-posted reversing JE on day 1 of next period.',
    )

    # Link to generated JE
    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='revaluation_source'
    )

    # Approval audit
    approved_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='currency_revaluation_approvals',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')

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


class CurrencyRatePolicy(TenantModel):
    """
    Per-pair rate-sync configuration.

    Bridges an external rate feed (ECB, Fixer, OpenExchangeRates, …) to the
    org's ExchangeRate history, with two operator levers:

      - `multiplier`   — Decimal applied to the fetched rate before save.
                         Captures the spread between an official quote and
                         the rate the business actually uses (e.g. official
                         USD/MAD = 9.85, but the bank charges 1.03×, so the
                         operational rate stored is 10.15).
      - `markup_pct`   — alternative way to express the same thing in %.
                         Applied AFTER multiplier. Both default to 1× / 0%.

    `last_synced_at` tracks freshness so the UI can show "synced 3h ago".
    """
    PROVIDER_CHOICES = [
        ('MANUAL', 'Manual entry only'),
        ('ECB', 'European Central Bank (free, daily, EUR-base)'),
        ('FRANKFURTER', 'Frankfurter (free, JSON wrapper over ECB)'),
        ('EXCHANGERATE_HOST', 'exchangerate.host (free tier, 170+ currencies, API key)'),
        ('FIXER', 'Fixer.io (API key required)'),
        ('OPENEXCHANGERATES', 'OpenExchangeRates.org (API key required)'),
    ]
    RATE_TYPE_CHOICES = [
        ('SPOT', 'Spot Rate'),
        ('AVERAGE', 'Monthly Average'),
        ('CLOSING', 'Period Closing Rate'),
    ]

    from_currency = models.ForeignKey(
        Currency, on_delete=models.CASCADE, related_name='rate_policies_from',
    )
    to_currency = models.ForeignKey(
        Currency, on_delete=models.CASCADE, related_name='rate_policies_to',
    )
    rate_type = models.CharField(max_length=20, choices=RATE_TYPE_CHOICES, default='SPOT')

    provider = models.CharField(max_length=30, choices=PROVIDER_CHOICES, default='MANUAL')
    provider_config = models.JSONField(
        default=dict, blank=True,
        help_text='Provider-specific config (e.g. api_key, endpoint override).',
    )
    auto_sync = models.BooleanField(
        default=False,
        help_text='If True, the daily cron sync command writes a fresh rate '
                  'each run. False = manual / on-demand only.',
    )
    SYNC_FREQUENCY_CHOICES = [
        ('ON_TRANSACTION', 'Per transaction (sync just-in-time before posting)'),
        ('DAILY', 'Daily (refresh once per day)'),
        ('WEEKLY', 'Weekly (refresh every 7 days)'),
        ('MONTHLY', 'Monthly (refresh every 30 days)'),
    ]
    sync_frequency = models.CharField(
        max_length=20, choices=SYNC_FREQUENCY_CHOICES, default='DAILY',
        help_text='How often the cron / on-demand sync engine refreshes this '
                  'policy. ON_TRANSACTION means rates are pulled the moment '
                  'an FX-using transaction is about to post. DAILY / WEEKLY / '
                  'MONTHLY skip the cron run if the last sync is fresher than '
                  'the configured interval.',
    )
    multiplier = models.DecimalField(
        max_digits=10, decimal_places=6, default=Decimal('1.000000'),
        help_text='Multiply the fetched provider rate by this factor before '
                  'saving. Example: 1.03 for a 3% spread above official.',
    )
    markup_pct = models.DecimalField(
        max_digits=6, decimal_places=4, default=Decimal('0.0000'),
        help_text='Additional percentage adjustment applied after multiplier '
                  '(0.5 = +0.5%). Useful when bank charges a fixed % spread.',
    )
    # Bid / Ask spreads — when EITHER is non-zero, the sync writes a triple
    # (MID, BID, ASK) per (date, pair, rate_type) instead of one MID row.
    # BID = mid × (1 - bid_spread_pct/100)  → what operator pays customers
    # ASK = mid × (1 + ask_spread_pct/100)  → what operator charges customers
    # Both default to 0 → backwards-compatible single-MID behavior.
    bid_spread_pct = models.DecimalField(
        max_digits=6, decimal_places=4, default=Decimal('0.0000'),
        help_text='BID-side spread % below mid. 0 = no separate BID row.',
    )
    ask_spread_pct = models.DecimalField(
        max_digits=6, decimal_places=4, default=Decimal('0.0000'),
        help_text='ASK-side spread % above mid. 0 = no separate ASK row.',
    )

    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_sync_status = models.CharField(max_length=20, null=True, blank=True,
                                        help_text='OK / FAIL / SKIPPED — see last_sync_error for detail.')
    last_sync_error = models.TextField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_currency_rate_policy'
        unique_together = ('organization', 'from_currency', 'to_currency', 'rate_type')
        indexes = [
            models.Index(fields=['organization', 'auto_sync']),
        ]

    def __str__(self):
        return f"{self.from_currency.code}→{self.to_currency.code} via {self.provider}"

    def adjusted_rate(self, raw_rate: Decimal) -> Decimal:
        """Apply multiplier + markup_pct to a freshly-fetched provider rate."""
        rate = Decimal(raw_rate) * (self.multiplier or Decimal('1'))
        if self.markup_pct:
            rate = rate * (Decimal('1') + self.markup_pct / Decimal('100'))
        # 6 decimal places matches ExchangeRate.rate precision tail.
        return rate.quantize(Decimal('0.000001'))


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
    # Which rate type was used for this account. Stored so the audit row
    # explains *why* the rate was 12.345 — e.g., CLOSING for AR, AVERAGE for
    # P&L, HISTORICAL when classification was non-monetary (no revaluation).
    RATE_TYPE_USED_CHOICES = [
        ('CLOSING',     'Closing'),
        ('AVERAGE',     'Average'),
        ('SPOT',        'Spot (fallback)'),
        ('HISTORICAL',  'Historical (skipped)'),
    ]
    rate_type_used = models.CharField(
        max_length=20, choices=RATE_TYPE_USED_CHOICES, default='CLOSING',
    )
    classification = models.CharField(
        max_length=20, default='MONETARY',
        help_text='Snapshot of account.monetary_classification at run time.',
    )

    class Meta:
        db_table = 'finance_currency_revaluation_line'

    def __str__(self):
        return f"Reval {self.account.code} {self.currency.code}: {self.difference}"
