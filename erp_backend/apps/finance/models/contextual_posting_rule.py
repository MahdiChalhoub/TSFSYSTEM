"""
ContextualPostingRule Model
===========================
Contextual overrides for posting rules. When a business event occurs,
the resolver checks for a contextual rule matching the transaction
context (warehouse, product category, branch, counterparty type)
before falling back to the base PostingRule.

Example:
    Base rule:   sales.invoice.revenue → 701 (General Revenue)
    Context:     warehouse='WH-EXPORT' → 702 (Export Revenue)
    Context:     product_category='SERVICES' → 706 (Service Revenue)
"""
from django.db import models
from erp.models import TenantModel


class ContextualPostingRule(TenantModel):
    """
    Context-aware override for a base PostingRule.

    Resolution priority (highest first):
        1. Exact context match (all non-null context fields match)
        2. Partial context match (some fields match, scored by specificity)
        3. Base PostingRule (no context)
    """

    CONTEXT_TYPE_CHOICES = [
        ('WAREHOUSE', 'Per Warehouse'),
        ('BRANCH', 'Per Branch'),
        ('PRODUCT_CATEGORY', 'Per Product Category'),
        ('COUNTERPARTY_TYPE', 'Per Counterparty Type'),
        ('PAYMENT_METHOD', 'Per Payment Method'),
        ('CURRENCY', 'Per Currency'),
        ('CUSTOM', 'Custom Context'),
    ]

    # ── Link to base rule ──
    base_rule = models.ForeignKey(
        'finance.PostingRule', on_delete=models.CASCADE,
        related_name='contextual_overrides',
        help_text='The base posting rule this overrides',
    )
    event_code = models.CharField(
        max_length=80, db_index=True,
        help_text='Copied from base_rule for fast lookup',
    )

    # ── Context fields (any combination, null=ignore) ──
    context_type = models.CharField(
        max_length=20, choices=CONTEXT_TYPE_CHOICES,
        help_text='Primary context dimension',
    )
    context_value = models.CharField(
        max_length=100,
        help_text='Value to match: warehouse code, branch ID, category slug, etc.',
    )

    # ── Override target ──
    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.PROTECT,
        related_name='contextual_posting_rules',
        help_text='Override GL account for this context',
    )

    # ── Metadata ──
    priority = models.SmallIntegerField(
        default=0,
        help_text='Higher priority wins when multiple contexts match',
    )
    description = models.CharField(max_length=200, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_contextual_posting_rule'
        ordering = ['-priority', 'event_code']
        indexes = [
            models.Index(fields=['organization', 'event_code', 'is_active'], name='cpr_org_event_idx'),
            models.Index(fields=['organization', 'context_type', 'context_value'], name='cpr_ctx_idx'),
        ]

    def __str__(self):
        return f"{self.event_code} [{self.context_type}={self.context_value}] → {self.account}"

    def save(self, *args, **kwargs):
        # Sync event_code from base_rule
        if self.base_rule_id and not self.event_code:
            self.event_code = self.base_rule.event_code
        super().save(*args, **kwargs)
