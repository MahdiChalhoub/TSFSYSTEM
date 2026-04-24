"""
Period-close checklist — standard pre-close task gate per fiscal period
or fiscal year. Mirrors the month-end / year-end checklist workflow in
NetSuite and SAP: before anyone can hit "finalize", a set of required
tasks (bank rec, accruals posted, FX reval run, inventory count, tax
calc, intercompany recs, etc.) must be ticked off by someone
authorised.

Three models:

  CloseChecklistTemplate  — reusable per-org template of standard
    required tasks. One template per org, extendable per deployment.

  CloseChecklistItem      — individual task on the template. Can be
    marked `is_required=True` to hard-block close, or False to be
    advisory-only.

  CloseChecklistRun       — instance per (fiscal_period | fiscal_year).
    Copies items from template at creation; each item tracks completion
    state with timestamps and user attribution.

The close-fiscal-year gate queries the run for the target year and
refuses to finalize if any required item is not marked complete.
"""
from django.db import models
from django.utils import timezone
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class CloseChecklistTemplate(AuditLogMixin, TenantOwnedModel):
    """A per-organisation library of close-task templates.

    Only one template per org is the typical pattern, but allowing
    multiple means deployments can A/B test or version their checklist
    (e.g. a "Q4 year-end" template vs a "monthly" template).
    """
    SCOPE_CHOICES = (
        ('FISCAL_PERIOD', 'Per fiscal period (monthly / quarterly close)'),
        ('FISCAL_YEAR', 'Per fiscal year (year-end close)'),
    )

    name = models.CharField(max_length=200)
    scope = models.CharField(
        max_length=20, choices=SCOPE_CHOICES, default='FISCAL_YEAR',
    )
    is_default = models.BooleanField(
        default=False,
        help_text='Auto-applied when a new close run is initiated',
    )
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_close_checklist_template'
        indexes = [
            models.Index(fields=['organization', 'scope', 'is_default']),
        ]

    def __str__(self):
        return f"{self.name} ({self.scope})"


class CloseChecklistItem(TenantOwnedModel):
    """A single required (or advisory) task on a template."""
    CATEGORY_CHOICES = (
        ('RECONCILIATION', 'Reconciliation (bank, AR, AP, IC)'),
        ('ACCRUALS', 'Accruals & deferrals posted'),
        ('INVENTORY', 'Inventory count + valuation'),
        ('FX', 'FX revaluation run'),
        ('TAX', 'Tax calculation & filing'),
        ('DEPRECIATION', 'Depreciation posted'),
        ('REVIEW', 'Management review / approval'),
        ('OTHER', 'Other'),
    )

    template = models.ForeignKey(
        CloseChecklistTemplate, on_delete=models.CASCADE,
        related_name='items',
    )
    order = models.PositiveIntegerField(default=0)
    name = models.CharField(max_length=250)
    description = models.TextField(blank=True, default='')
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default='OTHER',
    )
    is_required = models.BooleanField(
        default=True,
        help_text='If False, item is advisory — close proceeds even if unchecked',
    )
    # Optional hook to auto-mark an item complete when the system detects
    # the underlying action happened. Values are interpreted by the
    # service layer (e.g. "fx_revaluation_completed",
    # "all_bank_reconciled", "no_draft_journals").
    auto_check_signal = models.CharField(
        max_length=60, blank=True, default='',
        help_text='Optional machine signal to auto-mark done',
    )

    class Meta:
        db_table = 'finance_close_checklist_item'
        ordering = ['template', 'order', 'id']
        indexes = [
            models.Index(fields=['organization', 'template', 'order']),
        ]

    def __str__(self):
        flag = '*' if self.is_required else ''
        return f"[{self.category}] {self.name}{flag}"


class CloseChecklistRun(AuditLogMixin, TenantOwnedModel):
    """One close-run per (fiscal_period OR fiscal_year).

    Created explicitly (`ClosingService.start_close_checklist`) or
    auto-created by the close-gate on demand. Items start ununmarked;
    the operator (or auto-check signals) marks them done one by one.
    `is_ready_to_close` returns True only when all required items are
    marked.
    """
    template = models.ForeignKey(
        CloseChecklistTemplate, on_delete=models.PROTECT,
        related_name='runs',
    )
    fiscal_period = models.ForeignKey(
        'finance.FiscalPeriod', on_delete=models.CASCADE,
        null=True, blank=True, related_name='close_checklist_runs',
    )
    fiscal_year = models.ForeignKey(
        'finance.FiscalYear', on_delete=models.CASCADE,
        null=True, blank=True, related_name='close_checklist_runs',
    )
    STATUS_CHOICES = (
        ('OPEN', 'Open — items being completed'),
        ('READY', 'Ready — all required items done, awaiting close'),
        ('CLOSED', 'Closed — fiscal close completed'),
        ('CANCELLED', 'Cancelled'),
    )
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='OPEN')

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='close_checklists_created',
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'finance_close_checklist_run'
        constraints = [
            # A given (period, template) or (year, template) can have
            # only one active run — prevents duplicate checklist rows
            # from confusing operators.
            models.UniqueConstraint(
                fields=['fiscal_period', 'template'],
                condition=models.Q(status__in=['OPEN', 'READY']),
                name='close_checklist_one_active_per_period',
            ),
            models.UniqueConstraint(
                fields=['fiscal_year', 'template'],
                condition=models.Q(status__in=['OPEN', 'READY']),
                name='close_checklist_one_active_per_year',
            ),
        ]

    def is_ready_to_close(self):
        """True iff every required item has been marked complete."""
        missing = self.item_states.filter(
            item__is_required=True, is_complete=False,
        ).count()
        return missing == 0


class CloseChecklistItemState(TenantOwnedModel):
    """Completion state for one item on one run. Created in bulk when
    the run is initiated (one state per template item), then updated
    as items get ticked off."""
    run = models.ForeignKey(
        CloseChecklistRun, on_delete=models.CASCADE,
        related_name='item_states',
    )
    item = models.ForeignKey(
        CloseChecklistItem, on_delete=models.PROTECT,
        related_name='states',
    )
    is_complete = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='close_checklist_items_completed',
    )
    notes = models.TextField(blank=True, default='')
    # Was this item auto-marked by the system (via auto_check_signal)
    # vs ticked by a human? Matters for audit trails.
    auto_checked = models.BooleanField(default=False)

    class Meta:
        db_table = 'finance_close_checklist_item_state'
        constraints = [
            models.UniqueConstraint(
                fields=['run', 'item'], name='close_checklist_state_uniq_run_item',
            ),
        ]
        indexes = [
            models.Index(fields=['organization', 'run', 'is_complete']),
        ]
