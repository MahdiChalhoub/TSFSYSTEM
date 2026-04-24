from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from erp.models import TenantModel


class FiscalYear(TenantModel):
    # `status` is the source of truth. `is_closed` and `is_hard_locked` are
    # kept as columns for backwards compatibility and auto-synced in save().
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('CLOSED', 'Closed'),
        ('FINALIZED', 'Finalized'),
    ]
    name = models.CharField(max_length=100)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    is_hard_locked = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')

    # Closing audit
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='closed_fiscal_years'
    )
    closing_journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.PROTECT, null=True, blank=True,
        related_name='closed_fiscal_year',
        help_text='OFFICIAL-scope year-end closing JE (audit-trail anchor). '
                  'PROTECT prevents accidental deletion.'
    )
    internal_closing_journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.PROTECT, null=True, blank=True,
        related_name='internal_closed_fiscal_year',
        help_text='INTERNAL-scope year-end closing JE (management book). '
                  'PROTECT prevents accidental deletion.'
    )

    class Meta:
        db_table = 'fiscalyear'
        unique_together = ('name', 'organization')

    def __str__(self):
        return self.name

    @property
    def is_posting_allowed(self):
        """Quick check: can any posting happen in this year?"""
        return self.status == 'OPEN'

    def clean(self):
        super().clean()
        if self.start_date is None or self.end_date is None:
            raise ValidationError("Fiscal year requires both start_date and end_date.")
        if self.start_date >= self.end_date:
            raise ValidationError("start_date must be before end_date.")

    def _sync_flags_from_status(self):
        """Keep legacy boolean flags consistent with `status` (source of truth)."""
        self.is_closed = self.status in ('CLOSED', 'FINALIZED')
        self.is_hard_locked = self.status == 'FINALIZED'

    def save(self, *args, **kwargs):
        self._sync_flags_from_status()
        self.full_clean(exclude=['organization'])
        super().save(*args, **kwargs)

    def transition_to(self, new_status, user=None):
        """
        Canonical state transition. Enforces the allowed lattice
        OPEN → CLOSED → FINALIZED and records closed_at / closed_by.
        Callers should prefer this over direct field writes.
        """
        allowed = {
            'OPEN':      {'CLOSED'},
            'CLOSED':    {'OPEN', 'FINALIZED'},  # reopen permitted (superuser policy lives in service)
            'FINALIZED': set(),                   # terminal
        }
        if new_status not in dict(self.STATUS_CHOICES):
            raise ValueError(f"Unknown fiscal-year status: {new_status}")
        if new_status != self.status and new_status not in allowed.get(self.status, set()):
            raise ValueError(f"Illegal transition {self.status} → {new_status}")
        self.status = new_status
        if new_status in ('CLOSED', 'FINALIZED'):
            if not self.closed_at:
                self.closed_at = timezone.now()
            if user and not self.closed_by_id:
                self.closed_by = user
        elif new_status == 'OPEN':
            self.closed_at = None
            self.closed_by = None
        self.save()
        return self


class FiscalPeriod(TenantModel):
    PERIOD_STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('SOFT_LOCKED', 'Soft Locked'),
        ('HARD_LOCKED', 'Hard Locked'),
        ('CLOSED', 'Closed'),
        ('FUTURE', 'Future'),
    ]
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.CASCADE, related_name='periods')
    name = models.CharField(max_length=100)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=PERIOD_STATUS_CHOICES, default='OPEN')
    is_adjustment_period = models.BooleanField(
        default=False,
        help_text='13th period for year-end audit adjustments'
    )

    # Closing audit
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='closed_fiscal_periods'
    )

    class Meta:
        db_table = 'fiscalperiod'
        unique_together = ('name', 'fiscal_year')
        ordering = ['start_date']

    def __str__(self):
        return f"{self.name} ({self.fiscal_year.name})"

    def can_post(self, role='user'):
        """
        Single source of truth for "can this role post to this period?".
          - role='user'       → only when OPEN
          - role='supervisor' → OPEN or SOFT_LOCKED
        Other statuses (HARD_LOCKED, CLOSED, FUTURE) reject everyone.
        """
        if role == 'supervisor':
            return self.status in ('OPEN', 'SOFT_LOCKED')
        return self.status == 'OPEN'

    @property
    def is_posting_allowed(self):
        """Back-compat shim — prefer can_post('user')."""
        return self.can_post('user')

    @property
    def is_supervisor_posting_allowed(self):
        """Back-compat shim — prefer can_post('supervisor')."""
        return self.can_post('supervisor')

    def clean(self):
        super().clean()
        if self.start_date is None or self.end_date is None:
            raise ValidationError("Fiscal period requires both start_date and end_date.")
        if self.start_date > self.end_date:
            raise ValidationError("start_date must not be after end_date.")
        # Period dates must fall within the parent fiscal year window.
        fy = self.fiscal_year
        if fy and fy.start_date and fy.end_date:
            if self.start_date < fy.start_date or self.end_date > fy.end_date:
                raise ValidationError(
                    f"Period ({self.start_date} → {self.end_date}) must be within "
                    f"fiscal year {fy.name} ({fy.start_date} → {fy.end_date})."
                )

    def _sync_flags_from_status(self):
        """Keep legacy `is_closed` flag consistent with `status` (source of truth)."""
        self.is_closed = self.status == 'CLOSED'

    def save(self, *args, **kwargs):
        self._sync_flags_from_status()
        self.full_clean(exclude=['organization', 'fiscal_year'])
        super().save(*args, **kwargs)

    def transition_to(self, new_status, user=None):
        """
        Canonical period state transition. Enforces:
          OPEN ↔ SOFT_LOCKED → HARD_LOCKED → CLOSED (reopen via reopen_period in service)
        """
        allowed = {
            'FUTURE':      {'OPEN'},
            'OPEN':        {'SOFT_LOCKED', 'HARD_LOCKED', 'CLOSED'},
            'SOFT_LOCKED': {'OPEN', 'HARD_LOCKED', 'CLOSED'},
            'HARD_LOCKED': {'OPEN', 'CLOSED'},
            'CLOSED':      {'OPEN'},  # reopen; policy gate in service
        }
        if new_status not in dict(self.PERIOD_STATUS_CHOICES):
            raise ValueError(f"Unknown period status: {new_status}")
        if new_status != self.status and new_status not in allowed.get(self.status, set()):
            raise ValueError(f"Illegal transition {self.status} → {new_status}")
        self.status = new_status
        if new_status == 'CLOSED':
            if not self.closed_at:
                self.closed_at = timezone.now()
            if user and not self.closed_by_id:
                self.closed_by = user
        elif new_status == 'OPEN':
            self.closed_at = None
            self.closed_by = None
        self.save()
        return self


class FiscalYearCloseSnapshot(TenantModel):
    """Immutable snapshot of the books at the moment a fiscal year is
    finalized. Written once by `ClosingService.close_fiscal_year` after
    the integrity gate passes, never modified. Provides a fast, append-
    only audit record that survives:
      - denormalized balance drift
      - OB↔JE dual-write corrections
      - Chart of Accounts renames / restructures after the fact

    One row per (fiscal_year, scope) pair. Two rows per year close
    (OFFICIAL + INTERNAL). Structure of `trial_balance` is a list of
    dicts so it's safe to restore even if the COA is later reshaped:
      [
        {"account_id": 12, "code": "1000", "name": "Cash", "type": "ASSET",
         "debit": "1000.00", "credit": "0.00", "net": "1000.00"},
        ...
      ]
    """
    fiscal_year = models.ForeignKey(
        'finance.FiscalYear', on_delete=models.CASCADE,
        related_name='close_snapshots',
    )
    SCOPE_CHOICES = (('OFFICIAL', 'Official'), ('INTERNAL', 'Internal'))
    scope = models.CharField(max_length=10, choices=SCOPE_CHOICES)

    closing_journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='close_snapshots_closing',
    )
    opening_journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='close_snapshots_opening',
    )

    total_assets = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_liabilities = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_equity = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    net_income = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    retained_earnings = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    trial_balance = models.JSONField(default=list)

    captured_at = models.DateTimeField(auto_now_add=True)
    captured_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='fy_close_snapshots_captured',
    )

    # Anti-tamper hash chain. content_hash is SHA-256 over a
    # deterministic serialization of this snapshot's financial payload
    # (excluding captured_at / captured_by, which are audit metadata).
    # prev_hash points to the content_hash of the chronologically
    # previous snapshot for this organization, forming a chain: editing
    # any historical snapshot invalidates every snapshot that came after
    # it. Both fields are populated in save() and verified by
    # `ClosingService.verify_snapshot_chain(org)`.
    content_hash = models.CharField(
        max_length=64, null=True, blank=True, db_index=True,
        help_text='SHA-256 of canonical payload — changes if snapshot is tampered with.',
    )
    prev_hash = models.CharField(
        max_length=64, null=True, blank=True,
        help_text='content_hash of the prior snapshot in chronological order (per org). Null for the first row.',
    )

    class Meta:
        db_table = 'finance_fy_close_snapshot'
        constraints = [
            models.UniqueConstraint(
                fields=['fiscal_year', 'scope'],
                name='fy_close_snapshot_uniq_year_scope',
            ),
        ]
        indexes = [
            models.Index(fields=['organization', 'fiscal_year']),
            models.Index(fields=['fiscal_year', 'scope']),
        ]

    def __str__(self):
        return f"CloseSnapshot({self.fiscal_year_id}, {self.scope})"

    # ── Hash chain ────────────────────────────────────────────
    def canonical_payload(self) -> dict:
        """Deterministic dict used as the hash input. Any field that
        should be tamper-protected goes here; audit-metadata (captured_at
        / captured_by / the hash fields themselves) is excluded so
        recomputing is stable across rehydrations.
        """
        # Sort trial_balance for determinism — Python dict iteration is
        # insertion-ordered but relying on that across re-saves is fragile.
        tb_sorted = sorted(
            self.trial_balance or [],
            key=lambda x: (str(x.get('code', '')), x.get('account_id', 0)),
        )
        return {
            'organization_id': str(self.organization_id),
            'fiscal_year_id': self.fiscal_year_id,
            'scope': self.scope,
            'closing_journal_entry_id': self.closing_journal_entry_id,
            'opening_journal_entry_id': self.opening_journal_entry_id,
            'total_assets': str(self.total_assets),
            'total_liabilities': str(self.total_liabilities),
            'total_equity': str(self.total_equity),
            'net_income': str(self.net_income),
            'retained_earnings': str(self.retained_earnings),
            'trial_balance': tb_sorted,
            'prev_hash': self.prev_hash,
        }

    def compute_content_hash(self) -> str:
        import hashlib, json
        payload = json.dumps(
            self.canonical_payload(),
            sort_keys=True, default=str, separators=(',', ':'),
        )
        return hashlib.sha256(payload.encode('utf-8')).hexdigest()

    def save(self, *args, **kwargs):
        # On first save, resolve prev_hash by looking up the most
        # recent snapshot for this org (any year/scope). On re-save
        # (update_or_create after a close redo), re-anchor to whatever
        # the latest OTHER snapshot is at save time — we must exclude
        # ourselves so we don't point at our own prior hash and form a
        # self-loop.
        if self.organization_id:
            latest_other = (
                FiscalYearCloseSnapshot.objects
                .filter(organization_id=self.organization_id)
                .exclude(pk=self.pk) if self.pk else
                FiscalYearCloseSnapshot.objects
                .filter(organization_id=self.organization_id)
            )
            prev = latest_other.order_by('-captured_at', '-id').first()
            self.prev_hash = prev.content_hash if prev else None
        # Compute hash LAST so it reflects the finalized field values
        # including the just-resolved prev_hash.
        self.content_hash = self.compute_content_hash()
        super().save(*args, **kwargs)
