"""
AI scope-suggester config + review cache.

The deterministic suggester in services/scope_suggester.py produces
candidate scopes from observed product usage. This module sits on top
of that, letting the operator opt-in to AI ranking — the LLM evaluates
each suggestion for commonsense business plausibility (e.g. "BBQ flavor
suggested for chips category" makes sense; "BBQ flavor suggested for
juice category" does not), assigns an independent confidence score,
and emits a one-line rationale the wizard surfaces inline.

AIScopeSuggesterConfig
    One-to-one with Organization. Off by default (opt-in).
    Holds the daily token cap so a stuck job can't drain budget.

AIScopeReview
    Cache row keyed by (value_id, input_hash). Re-running the wizard
    after no underlying signal change re-uses the cached verdict
    rather than burning tokens. Hash includes value name, current
    scope, suggested scope, and product sample.
"""
from __future__ import annotations

from django.db import models


class AIScopeSuggesterConfig(models.Model):
    """Per-tenant opt-in for AI ranking of scope suggestions."""
    organization = models.OneToOneField(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='ai_scope_suggester_config',
        db_column='tenant_id',
    )
    # Master switch. Off until the operator turns it on in Settings.
    enabled = models.BooleanField(default=False)

    # Optional explicit provider override. NULL → use the org's default
    # MCP provider (whichever has is_default=True). Useful when an org
    # wants to use a cheaper model for ranking than for chat.
    provider = models.ForeignKey(
        'mcp.MCPProvider',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )

    # Hard guard: stop calling the LLM once this many input+output tokens
    # have been billed today. Defaults to 100k tokens which is enough for
    # ~300 suggestions/day at the haiku-4.5 price. Reset is per-day at
    # the org's local midnight (here we just use UTC midnight).
    daily_token_cap = models.IntegerField(default=100_000)
    tokens_used_today = models.IntegerField(default=0)
    tokens_reset_at = models.DateTimeField(null=True, blank=True)

    # Apply-AI-confidence threshold. Any suggestion the LLM scores
    # BELOW this is auto-skipped in the wizard (still visible, but
    # de-emphasised). 0.0 means "show everything", 1.0 means "show
    # only certain accepts". 0.6 is a reasonable default — the LLM
    # rejects clearly-wrong scopes outright.
    min_ai_confidence = models.FloatField(default=0.6)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventory_ai_scope_config'

    def __str__(self):
        return f'AI scope ranker for {self.organization} ({"on" if self.enabled else "off"})'


class AIScopeReview(models.Model):
    """
    Cached LLM review for a (value, suggestion-input) pair.

    `input_hash` is sha256 over the suggestion payload sent to the LLM.
    If the same hash is asked for again within the cache window, the
    review is served from this row instead of calling the provider.
    """
    VERDICT_CHOICES = [
        ('accept',  'Accept'),
        ('partial', 'Partial — some axes are wrong'),
        ('reject',  'Reject'),
        ('error',   'LLM error / unparseable'),
    ]
    organization = models.ForeignKey(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='+',
        db_column='tenant_id',
    )
    value = models.ForeignKey(
        'inventory.ProductAttribute',
        on_delete=models.CASCADE,
        related_name='ai_scope_reviews',
    )
    input_hash = models.CharField(max_length=64, db_index=True)

    verdict = models.CharField(max_length=10, choices=VERDICT_CHOICES)
    confidence = models.FloatField(default=0.0)
    rationale = models.TextField(blank=True)

    # Per-axis verdict in case "partial". JSON of {categories: bool, countries: bool, brands: bool}
    # where True = LLM agrees with the deterministic suggestion on that axis.
    axis_verdicts = models.JSONField(default=dict, blank=True)

    # Bookkeeping for the rate-limit + cost reporting.
    provider_name = models.CharField(max_length=50, blank=True)
    model_name    = models.CharField(max_length=100, blank=True)
    input_tokens  = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inventory_ai_scope_review'
        indexes = [
            models.Index(fields=['organization', 'value', 'input_hash']),
            models.Index(fields=['created_at']),
        ]
        # The same (value, input_hash) re-uses the row rather than creating
        # duplicates — letting us treat this table as a cache.
        unique_together = [('value', 'input_hash')]

    def __str__(self):
        return f'AI review {self.value_id}/{self.input_hash[:8]} = {self.verdict}'
