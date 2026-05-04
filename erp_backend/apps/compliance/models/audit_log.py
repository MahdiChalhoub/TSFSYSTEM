"""
RegulationAuditLog Model
========================
Immutable audit trail for government compliance inspections.

Records EVERY price-related action on regulated products:
- Violations detected
- Auto-corrections applied
- Manual overrides by managers
- Regulation enrollment/removal
- POS blocks and price clamping

CRITICAL: Records in this table must NEVER be modified or deleted.
          They serve as legal evidence during government audits.

Design decisions:
  - Key fields (product_sku, product_name, regulation_code, regulation_version)
    are denormalized so the audit log remains readable even if the
    source product or regulation is deleted.
  - Currency is stored per-record for multi-currency traceability.
  - NOT tenant-scoped via TenantOwnedModel to avoid auto-filtering
    (auditors may need cross-org access). Uses plain ForeignKey instead.
"""
from django.db import models


class RegulationAuditLog(models.Model):
    """Immutable audit trail for price regulation compliance."""

    ACTION_CHOICES = (
        ('VIOLATION_DETECTED', 'Violation detected'),
        ('AUTO_FIX', 'Auto-corrected to regulated price'),
        ('MANUAL_FIX', 'Manually fixed by user'),
        ('MANUAL_OVERRIDE', 'Manager override (with PIN)'),
        ('REGULATION_APPLIED', 'Regulation first applied to product'),
        ('REGULATION_REMOVED', 'Regulation removed from product'),
        ('REGULATION_UPDATED', 'Regulation price changed (new version)'),
        ('COMPLIANCE_ACHIEVED', 'Product now compliant'),
        ('POS_BLOCKED', 'POS sale blocked due to violation'),
        ('POS_CLAMPED', 'POS sale price auto-clamped'),
        ('SAVE_BLOCKED', 'Product save blocked due to violation'),
        ('SAVE_WARNING', 'Product saved with warning'),
        ('EXEMPTION_GRANTED', 'Product exempted from regulation'),
        ('BULK_FIX', 'Bulk fix — price corrected by batch operation'),
    )

    SOURCE_CHOICES = (
        ('pos', 'POS Terminal'),
        ('product_save', 'Product Editor'),
        ('bulk_import', 'Bulk Import'),
        ('group_sync', 'Group Price Sync'),
        ('compliance_check', 'Scheduled Compliance Check'),
        ('manual', 'Manual Action'),
    )

    # ── Organization (explicit FK, not TenantOwnedModel) ───────────
    organization = models.ForeignKey(
        'erp.Organization', on_delete=models.CASCADE,
        related_name='compliance_audit_logs', db_index=True,
    db_column='tenant_id',
    )

    # ── What happened ───────────────────────────────────────────────
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, db_index=True)

    # ── Who ─────────────────────────────────────────────────────────
    user = models.ForeignKey(
        'erp.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )

    # ── What product (denormalized for audit permanence) ────────────
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
        help_text='FK may be null if product was deleted'
    )
    product_sku = models.CharField(max_length=100, blank=True, default='')
    product_name = models.CharField(max_length=300, blank=True, default='')

    # ── What regulation (denormalized for audit permanence) ─────────
    regulation = models.ForeignKey(
        'compliance.PriceRegulation', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
        help_text='FK may be null if regulation was deleted'
    )
    regulation_code = models.CharField(max_length=50, blank=True, default='')
    regulation_version = models.PositiveIntegerField(default=1)

    # ── Price details ───────────────────────────────────────────────
    old_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Price before action'
    )
    new_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Price after action'
    )
    regulated_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='What the regulation dictates the price should be'
    )
    violation_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='How much over/under the regulation (+50 = 50 over max)'
    )

    # ── Currency (per-record for traceability) ──────────────────────
    currency = models.ForeignKey(
        'reference.Currency', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )

    # ── Context ─────────────────────────────────────────────────────
    source = models.CharField(
        max_length=20, choices=SOURCE_CHOICES, default='manual',
        help_text='Where the action originated'
    )
    scope = models.CharField(
        max_length=10, blank=True, default='',
        help_text='OFFICIAL, INTERNAL, or BOTH'
    )
    override_reason = models.TextField(
        blank=True, default='',
        help_text='Justification if manager overrode regulation'
    )
    details = models.JSONField(
        default=dict, blank=True,
        help_text='Additional structured metadata for the audit entry'
    )

    # ── Immutable timestamp ─────────────────────────────────────────
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        app_label = 'compliance'
        db_table = 'compliance_regulation_audit_log'
        ordering = ['-timestamp']
        indexes = [
            models.Index(
                fields=['organization', 'product', '-timestamp'],
                name='audit_product_time_idx'
            ),
            models.Index(
                fields=['organization', 'action', '-timestamp'],
                name='audit_action_time_idx'
            ),
            models.Index(
                fields=['organization', 'regulation', '-timestamp'],
                name='audit_regulation_time_idx'
            ),
        ]

    def __str__(self):
        return (
            f'{self.get_action_display()} — '
            f'{self.product_name or self.product_sku or "?"} — '
            f'{self.regulation_code or "?"} @ {self.timestamp}'
        )

    @classmethod
    def log(cls, *, organization, action, product=None, regulation=None,
            old_price=None, new_price=None, regulated_price=None,
            violation_amount=None, currency=None, source='manual',
            scope='', user=None, override_reason='', details=None):
        """
        Factory method for creating audit log entries.
        Automatically denormalizes product/regulation fields.
        """
        return cls.objects.create(
            organization=organization,
            action=action,
            user=user,
            # Product (denormalized)
            product=product,
            product_sku=getattr(product, 'sku', '') or '',
            product_name=getattr(product, 'name', '') or '',
            # Regulation (denormalized)
            regulation=regulation,
            regulation_code=getattr(regulation, 'code', '') or '',
            regulation_version=getattr(regulation, 'version', 1),
            # Prices
            old_price=old_price,
            new_price=new_price,
            regulated_price=regulated_price,
            violation_amount=violation_amount,
            currency=currency or getattr(regulation, 'currency', None),
            # Context
            source=source,
            scope=scope,
            override_reason=override_reason,
            details=details or {},
        )
