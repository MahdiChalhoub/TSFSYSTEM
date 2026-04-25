from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from erp.models import TenantModel, User, VerifiableModel
from apps.finance.models.coa_models import ChartOfAccount
from apps.finance.models.fiscal_models import FiscalYear, FiscalPeriod

class JournalEntry(VerifiableModel):
    # ── Core ───────────────────────────────────────────────────────
    transaction_date = models.DateTimeField(null=True, blank=True)
    description = models.TextField()
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.PROTECT, null=True, blank=True)
    fiscal_period = models.ForeignKey(FiscalPeriod, on_delete=models.PROTECT, null=True, blank=True, related_name='journal_entries')
    status = models.CharField(max_length=20, default='DRAFT')
    reference = models.CharField(max_length=100, null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    site = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True)

    # ── Journal Type ───────────────────────────────────────────────
    JOURNAL_TYPES = [
        ('GENERAL', 'General Journal'),
        ('SALES', 'Sales Journal'),
        ('PURCHASE', 'Purchase Journal'),
        ('CASH', 'Cash Journal'),
        ('BANK', 'Bank Journal'),
        ('INVENTORY', 'Inventory Journal'),
        ('PAYROLL', 'Payroll Journal'),
        ('TAX', 'Tax Journal'),
        ('CLOSING', 'Closing Journal'),
        ('OPENING', 'Opening Balance Journal'),
        ('ADJUSTMENT', 'Adjustment Journal'),
    ]
    journal_type = models.CharField(
        max_length=20, choices=JOURNAL_TYPES, default='GENERAL',
        help_text='Classifies the journal for filtering and reporting'
    )

    # ── Source Document Tracking (prevents double-posting) ─────────
    source_module = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='Module that generated this JE (e.g., sales, purchases, inventory, pos)'
    )
    source_model = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Model class that generated this JE (e.g., Invoice, Order, StockMove)'
    )
    source_id = models.IntegerField(
        null=True, blank=True,
        help_text='PK of the source document — prevents duplicate posting'
    )

    # ── Multi-Currency ─────────────────────────────────────────────
    currency = models.CharField(
        max_length=10, null=True, blank=True,
        help_text='Transaction currency (null = org default)'
    )
    exchange_rate = models.DecimalField(
        max_digits=12, decimal_places=6, null=True, blank=True,
        help_text='Rate to convert from transaction currency to org base currency'
    )

    # ── Fast Totals (denormalized for performance) ─────────────────
    total_debit = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Sum of all line debits — updated on post'
    )
    total_credit = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Sum of all line credits — updated on post'
    )

    # ── Status & Audit ─────────────────────────────────────────────
    is_locked = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    # Supersede semantics (migration 0060). When a system-regeneratable
    # JE is replaced (e.g. OPENING JE regenerated after a close rerun),
    # the old row stays POSTED but flips is_superseded=True and
    # superseded_by -> new row. Balance aggregations must filter
    # is_superseded=False.
    is_superseded = models.BooleanField(
        default=False, db_index=True,
        help_text='True when this JE has been replaced by a newer system-generated one',
    )
    superseded_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='supersedes', help_text='Newer JE that replaced this one',
    )
    superseded_at = models.DateTimeField(null=True, blank=True)
    # Ownership axis, orthogonal to journal_type. journal_type says WHAT
    # the JE is (OPENING / CLOSING / GENERAL / …). journal_role says WHO
    # owns it and drives edit-lock rules. User-created capital-injection
    # entries can still have journal_type='OPENING' with journal_role=
    # 'USER_GENERAL' — the partial unique constraint only enforces
    # uniqueness across SYSTEM_OPENING.
    JOURNAL_ROLES = [
        ('USER_GENERAL', 'User General'),
        ('SYSTEM_OPENING', 'System Opening'),
        ('SYSTEM_CLOSING', 'System Closing'),
        ('SYSTEM_ADJUSTMENT', 'System Adjustment'),
    ]
    journal_role = models.CharField(
        max_length=30, choices=JOURNAL_ROLES, default='USER_GENERAL',
        db_index=True,
        help_text='Ownership axis — separate from journal_type; drives edit-lock rules',
    )
    posted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_journal_entries')
    posted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='posted_journal_entries')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    entry_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    previous_hash = models.CharField(max_length=64, null=True, blank=True)

    # ── Posting Snapshot (Phase A: immutable audit trail) ──────────
    posting_snapshot = models.JSONField(
        null=True, blank=True,
        help_text='Frozen snapshot of resolved posting rules at posting time. '
                  'Records: event_code, account_id, account_code, account_name, rule_source.'
    )

    def calculate_hash(self):
        from apps.finance.cryptography import LedgerCryptography
        lines_data = []
        # Enforce deterministic order (account_id, debit, credit)
        sorted_lines = sorted(self.lines.all(), key=lambda l: (str(l.account_id), l.debit, l.credit))
        for line in sorted_lines:
            lines_data.append({"account_id": str(line.account_id), "debit": str(line.debit), "credit": str(line.credit)})
        
        entry_meta = {
            "id": self.id, 
            "organization_id": str(self.organization_id), 
            "scope": self.scope,
            "transaction_date": self.transaction_date.isoformat() if self.transaction_date else None, 
            "reference": self.reference, 
            "lines": lines_data
        }
        return LedgerCryptography.calculate_entry_hash(entry_meta, self.previous_hash)

    def clean(self):
        super().clean()
        if self.status == 'POSTED' and self.pk:
            lines = list(self.lines.all())
            if len(lines) < 2:
                raise ValidationError("Immutable Ledger: 'POSTED' entry must have at least 2 lines.")
            total_debit = sum(line.debit for line in lines)
            total_credit = sum(line.credit for line in lines)
            if abs(total_debit - total_credit) > Decimal('0.001'):
                raise ValidationError(f"Immutable Ledger: 'POSTED' entry is out of balance (Dr: {total_debit}, Cr: {total_credit}).")

    def save(self, *args, **kwargs):
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.pk:
            original = JournalEntry.objects.get(pk=self.pk)
            
            # ── Enterprise Finance Lock Trigger ──
            if original.status == 'DRAFT' and self.status == 'POSTED':
                if hasattr(self.organization, 'finance_hard_locked_at') and not self.organization.finance_hard_locked_at:
                    self.organization.finance_hard_locked_at = timezone.now()
                    self.organization.finance_hard_locked_by = self.posted_by
                    self.organization.save(update_fields=['finance_hard_locked_at', 'finance_hard_locked_by'])

            if original.status == 'POSTED' and self.status == 'POSTED' and not bypass:
                raise ValidationError("Immutable Ledger: 'POSTED' entries cannot be modified. Use reversals instead.")
        if not bypass:
            self.clean()
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
            models.Index(fields=['organization', 'is_superseded']),
            models.Index(fields=['organization', 'journal_role']),
        ]
        constraints = [
            # DB-level defense-in-depth: only one active system-generated
            # OPENING JE per (fiscal_year, scope, organization). User-
            # created entries with journal_type='OPENING' but journal_role=
            # 'USER_GENERAL' (e.g. capital injections) are NOT covered —
            # they're not the system's carry-forward artefact.
            models.UniqueConstraint(
                fields=['fiscal_year', 'scope', 'organization'],
                condition=models.Q(
                    journal_type='OPENING',
                    status='POSTED',
                    is_superseded=False,
                    journal_role='SYSTEM_OPENING',
                ),
                name='unique_active_opening_je_per_fy_scope',
            ),
        ]

    def __str__(self):
        return f"JE-{self.id}: {self.description[:50]}"

class JournalEntryLine(TenantModel):
    # ── Core ───────────────────────────────────────────────────────
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True)
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    description = models.CharField(max_length=255, null=True, blank=True)

    # ── Subledger / Partner Tracking ───────────────────────────────
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_lines')
    employee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_lines_employee')
    partner_type = models.CharField(
        max_length=20, null=True, blank=True,
        help_text='CUSTOMER, SUPPLIER, EMPLOYEE, PARTNER — for subledger reporting'
    )
    partner_id = models.IntegerField(
        null=True, blank=True,
        help_text='FK to the partner entity (Contact.id or User.id)'
    )

    # ── Multi-Currency ─────────────────────────────────────────────
    currency = models.CharField(
        max_length=10, null=True, blank=True,
        help_text='Line-level currency (if different from JE header)'
    )
    exchange_rate = models.DecimalField(
        max_digits=12, decimal_places=6, null=True, blank=True
    )
    amount_currency = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Amount in foreign currency (debit-credit in that currency)'
    )

    # ── Dimensional Analysis ───────────────────────────────────────
    financial_account = models.ForeignKey(
        'finance.FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='journal_lines',
        help_text='Physical bank/cash account (for cash flow tracking)'
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='journal_lines',
        help_text='Product linked to this line (for COGS/inventory analysis)'
    )
    cost_center = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='Cost center / department code for management accounting'
    )
    tax_line = models.ForeignKey(
        'finance.TaxGroup', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='journal_lines',
        help_text='Tax code applied to this line'
    )

    # ── Reconciliation Status ──────────────────────────────────────
    is_reconciled = models.BooleanField(
        default=False,
        help_text='Set to True when this line is fully matched in reconciliation'
    )
    reconciled_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='How much of this line has been reconciled so far'
    )

    class Meta:
        db_table = 'journalentryline'
        indexes = [
            models.Index(fields=['organization', 'account']),
            models.Index(fields=['journal_entry']),
            models.Index(fields=['organization', 'debit', 'credit']),
        ]

    def clean(self):
        if not self.account:
            raise ValidationError("A Journal Entry Line must be linked to a Chart of Account.")
        # Parent / header accounts must not accept direct postings — their
        # balance is defined as the sum of their children. Two independent
        # checks so a stale flag or a stale tree shape each fail loudly.
        # This is enforced at the model level (not just the service layer)
        # because many code paths call `JournalEntryLine.objects.create`
        # directly, bypassing the ledger_core guard.
        acc = self.account
        if not acc.allow_posting:
            raise ValidationError(
                f"Account '{acc.code} — {acc.name}' is a header account "
                f"(allow_posting=False). Post to a leaf (child) account — "
                f"the parent's balance is derived from its descendants."
            )
        # Belt-and-suspenders: if the flag is stale but the tree shape
        # says it has ACTIVE children, refuse anyway. Inactive/archived
        # children don't count — they're ghosts from template imports
        # that never got used; their existence shouldn't block posting
        # to the code that currently acts as a functional leaf.
        if acc.children.filter(is_active=True).exists():
            raise ValidationError(
                f"Account '{acc.code} — {acc.name}' has active child accounts, "
                f"so it is a header node. Post to one of its children "
                f"instead — parent balances are pure aggregations."
            )
        # Internal-only accounts cannot receive OFFICIAL postings. Enforced at
        # the model layer so admin tools (COA migration engine, debug scripts)
        # that call .objects.create() directly can't bypass it.
        if (
            acc.is_internal
            and self.journal_entry_id
            and self.journal_entry.scope == 'OFFICIAL'
        ):
            raise ValidationError(
                f"Account '{acc.code} — {acc.name}' is internal-only and cannot "
                f"receive OFFICIAL journal entries. Post under INTERNAL scope, "
                f"or unmark the account as internal."
            )
        super().clean()

    def save(self, *args, **kwargs):
        self.clean()
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


class PaymentMethod(TenantModel):
    """
    Organization-scoped payment method.
    Replaces the old hardcoded keys (CASH, CARD, WAVE...) with a proper model.
    """
    name = models.CharField(max_length=100, help_text='Display name: Cash, Orange Money, Wave...')
    code = models.CharField(max_length=30, help_text='Unique code per org: CASH, OM, WAVE...')
    icon = models.CharField(max_length=50, blank=True, default='', help_text='Lucide icon name: banknote, smartphone, credit-card...')
    color = models.CharField(max_length=20, blank=True, default='', help_text='Hex color for UI badge')
    is_system = models.BooleanField(default=False, help_text='System-seeded method (cannot be deleted)')
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'finance_payment_method'
        unique_together = ('code', 'organization')
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.code} — {self.name}"

