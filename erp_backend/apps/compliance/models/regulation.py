"""
PriceRegulation Model
=====================
Represents a government price regulation decree.
Versioned for legal traceability — old versions are preserved
when regulations are updated. Each version is immutable once
applied to products.

Architecture:
  - Tenant-scoped via TenantOwnedModel
  - Audit-logged via AuditLogMixin
  - Country/Region scoped for multi-jurisdiction operations
  - Currency-explicit for multi-currency compliance
  - Tolerance-aware to prevent false violations from rounding
"""
from decimal import Decimal
from django.db import models
from kernel.tenancy.models import TenantOwnedModel
from erp.mixins import AuditLogMixin


class PriceRegulation(AuditLogMixin, TenantOwnedModel):
    """A government price regulation decree with full versioning."""

    # ── Choices ──────────────────────────────────────────────────────
    REGULATION_TYPES = (
        ('FIXED', 'Fixed Price — cannot sell above or below'),
        ('MAX', 'Maximum Price — ceiling, cannot exceed'),
        ('MIN', 'Minimum Price — floor, cannot go below'),
        ('RANGE', 'Price Range — must stay within band'),
    )

    STATUS_CHOICES = (
        ('DRAFT', 'Draft — not yet active'),
        ('ACTIVE', 'Active — currently enforced'),
        ('EXPIRED', 'Expired — past expiry date'),
        ('SUSPENDED', 'Suspended — temporarily not enforced'),
    )

    SEVERITY_CHOICES = (
        ('BLOCKING', 'Blocking — cannot sell if violated'),
        ('WARNING', 'Warning — allow but log violation'),
    )

    SCOPE_CHOICES = (
        ('OFFICIAL', 'Official scope only'),
        ('INTERNAL', 'Internal scope only'),
        ('BOTH', 'Both official and internal'),
    )

    # ── Identity ────────────────────────────────────────────────────
    name = models.CharField(max_length=200, help_text='Human-readable name')
    code = models.CharField(
        max_length=50, db_index=True,
        help_text='Regulation code (e.g., REG-CI-2026-042)'
    )
    description = models.TextField(blank=True, default='')

    # ── Regulation Type & Prices ────────────────────────────────────
    regulation_type = models.CharField(
        max_length=5, choices=REGULATION_TYPES,
        help_text='How the price is controlled'
    )
    fixed_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Government-set fixed price (for FIXED type)'
    )
    max_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Maximum allowed selling price (for MAX or RANGE type)'
    )
    min_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Minimum allowed selling price (for MIN or RANGE type)'
    )

    # ── Currency (MANDATORY — no implicit assumptions) ──────────────
    currency = models.ForeignKey(
        'reference.Currency', on_delete=models.PROTECT,
        related_name='price_regulations',
        help_text='Currency for regulated prices (must match at comparison time)'
    )

    # ── Tolerance / Rounding protection ─────────────────────────────
    tolerance = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        help_text='Allowed deviation before flagging violation '
                  '(e.g., MAX 800 + tolerance 5 = allow up to 805)'
    )

    # ── Scope (Official vs Internal) ────────────────────────────────
    scope = models.CharField(
        max_length=8, choices=SCOPE_CHOICES, default='BOTH',
        help_text='Which pricing scope this regulation applies to'
    )

    # ── Severity ────────────────────────────────────────────────────
    severity = models.CharField(
        max_length=8, choices=SEVERITY_CHOICES, default='BLOCKING',
        help_text='BLOCKING = hard block at POS/save, WARNING = allow + log'
    )

    # ── Override Policy ─────────────────────────────────────────────
    allow_override = models.BooleanField(
        default=False,
        help_text='Whether a manager can override this regulation at POS'
    )
    override_requires_approval = models.BooleanField(
        default=True,
        help_text='If override allowed, whether it requires compliance approval'
    )

    # ── Auto-correction ─────────────────────────────────────────────
    auto_correct = models.BooleanField(
        default=False,
        help_text='If True: FIXED → force price, MAX → clamp, MIN → clamp'
    )

    # ── Legal Reference ─────────────────────────────────────────────
    reference = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Official decree/law reference (e.g., Decree #2026-042)'
    )
    authority = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Issuing body (e.g., Ministry of Commerce)'
    )
    effective_date = models.DateField(
        help_text='When the regulation takes effect'
    )
    expiry_date = models.DateField(
        null=True, blank=True,
        help_text='When the regulation expires (null = indefinite)'
    )

    # ── Jurisdiction Scoping ────────────────────────────────────────
    jurisdiction_country = models.ForeignKey(
        'reference.Country', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='price_regulations',
        help_text='Country where this regulation applies (null = all countries)'
    )
    jurisdiction_region = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Sub-country region (e.g., Abidjan, Zone CEMAC). Empty = whole country'
    )

    # ── Versioning ──────────────────────────────────────────────────
    version = models.PositiveIntegerField(
        default=1,
        help_text='Version number — increments when regulation price changes'
    )
    is_current = models.BooleanField(
        default=True, db_index=True,
        help_text='Only the current version is enforced'
    )
    previous_version = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='next_versions',
        help_text='Link to the version this replaces'
    )

    # ── Status ──────────────────────────────────────────────────────
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default='DRAFT',
        db_index=True,
        help_text='Lifecycle status of this regulation'
    )

    # ── Notes ───────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'compliance'
        db_table = 'compliance_price_regulation'
        ordering = ['-is_current', '-version', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'code', 'version'],
                name='unique_regulation_code_version_tenant'
            ),
        ]
        indexes = [
            models.Index(
                fields=['organization', 'status', 'is_current'],
                name='reg_active_current_idx'
            ),
            models.Index(
                fields=['organization', 'jurisdiction_country'],
                name='reg_country_idx'
            ),
        ]

    def __str__(self):
        v = f' v{self.version}' if self.version > 1 else ''
        return f'{self.code}{v} — {self.name} ({self.get_regulation_type_display()})'

    @property
    def effective_max(self):
        """Maximum price including tolerance."""
        if self.max_price is not None:
            return self.max_price + self.tolerance
        return None

    @property
    def effective_min(self):
        """Minimum price including tolerance."""
        if self.min_price is not None:
            return self.min_price - self.tolerance
        return None

    def create_new_version(self, **updated_fields):
        """
        Create a new version of this regulation.
        The current version is marked as not-current.
        Returns the new version instance (unsaved).
        """
        self.is_current = False
        self.save(update_fields=['is_current'])

        new = PriceRegulation(
            organization=self.organization,
            name=self.name,
            code=self.code,
            description=self.description,
            regulation_type=self.regulation_type,
            fixed_price=self.fixed_price,
            max_price=self.max_price,
            min_price=self.min_price,
            currency=self.currency,
            tolerance=self.tolerance,
            scope=self.scope,
            severity=self.severity,
            allow_override=self.allow_override,
            override_requires_approval=self.override_requires_approval,
            auto_correct=self.auto_correct,
            reference=self.reference,
            authority=self.authority,
            effective_date=self.effective_date,
            expiry_date=self.expiry_date,
            jurisdiction_country=self.jurisdiction_country,
            jurisdiction_region=self.jurisdiction_region,
            version=self.version + 1,
            is_current=True,
            previous_version=self,
            status='ACTIVE',
            notes=self.notes,
        )

        # Apply any updated fields
        for field, value in updated_fields.items():
            setattr(new, field, value)

        return new
