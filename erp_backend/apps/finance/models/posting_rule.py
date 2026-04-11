"""
PostingRule Model
=================
Maps a business event code to a GL account within an organization.
Replaces the schemaless JSON blob in Organization.settings['finance_posting_rules'].

Each organization has at most ONE PostingRule per event_code (unique_together constraint).
The source field tracks how the rule was created (auto-detected, manual, seeded).

Audit: Every change auto-creates a PostingRuleHistory record.
"""
import logging
from django.db import models
from erp.models import TenantModel

logger = logging.getLogger(__name__)


class PostingRule(TenantModel):
    """
    Maps a business event to a GL account.

    Examples:
        event_code='sales.invoice.receivable'  → account=411
        event_code='purchases.invoice.payable' → account=401
        event_code='tax.vat.output'            → account=4457
    """

    MODULE_CHOICES = [
        ('sales', 'Sales'),
        ('purchases', 'Purchases'),
        ('inventory', 'Inventory'),
        ('payments', 'Payments'),
        ('tax', 'Tax Engine'),
        ('treasury', 'Finance / Treasury'),
        ('assets', 'Fixed Assets'),
        ('equity', 'Equity & Capital'),
        ('adjustment', 'Adjustments'),
        # Legacy modules (backward compat)
        ('automation', 'Automation'),
        ('suspense', 'Suspense'),
        ('partners', 'Partners'),
        ('fixedAssets', 'Fixed Assets (legacy)'),
        ('fx', 'FX / Revaluation (legacy)'),
        ('payroll', 'Payroll'),
    ]

    SOURCE_CHOICES = [
        ('AUTO', 'Auto-detected from COA'),
        ('MANUAL', 'Manual configuration'),
        ('SEED', 'Seeded from template'),
        ('MIGRATION', 'Migrated from legacy JSON'),
    ]

    event_code = models.CharField(
        max_length=80, db_index=True,
        help_text='Dotted event code, e.g. sales.invoice.receivable'
    )
    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.PROTECT,
        related_name='posting_rules',
        help_text='GL account mapped to this event'
    )
    module = models.CharField(
        max_length=20, choices=MODULE_CHOICES, default='sales',
        help_text='Module this rule belongs to (derived from event_code prefix)'
    )
    source = models.CharField(
        max_length=20, choices=SOURCE_CHOICES, default='AUTO',
        help_text='How this rule was created'
    )
    description = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Human-readable description of what this event maps'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Inactive rules are skipped during resolution'
    )

    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_posting_rule'
        unique_together = ('organization', 'event_code')
        ordering = ['module', 'event_code']
        indexes = [
            models.Index(fields=['organization', 'is_active'], name='pr_org_active_idx'),
        ]

    def __str__(self):
        return f"{self.event_code} → {self.account} ({self.source})"

    def save(self, *args, **kwargs):
        # Auto-derive module from event_code prefix
        if self.event_code and '.' in self.event_code:
            prefix = self.event_code.split('.', 1)[0]
            valid_modules = [c[0] for c in self.MODULE_CHOICES]
            if prefix in valid_modules:
                self.module = prefix

        # ── Audit Trail: record history ──
        is_new = self.pk is None
        old_account = None
        old_account_code = ''
        if not is_new:
            try:
                original = PostingRule.original_objects.get(pk=self.pk)
                old_account = original.account
                old_account_code = original.account.code if original.account else ''
            except PostingRule.DoesNotExist:
                is_new = True

        super().save(*args, **kwargs)

        # Create history record
        try:
            from apps.finance.models.posting_event import PostingRuleHistory
            new_account_code = self.account.code if self.account else ''
            if is_new:
                PostingRuleHistory.objects.create(
                    organization=self.organization,
                    event_code=self.event_code,
                    change_type='CREATE',
                    new_account=self.account,
                    new_account_code=new_account_code,
                    source=self.source,
                )
            elif old_account != self.account:
                PostingRuleHistory.objects.create(
                    organization=self.organization,
                    event_code=self.event_code,
                    change_type='UPDATE',
                    old_account=old_account,
                    old_account_code=old_account_code,
                    new_account=self.account,
                    new_account_code=new_account_code,
                    source=self.source,
                )
        except Exception as exc:
            logger.warning("Could not record PostingRuleHistory: %s", exc)
