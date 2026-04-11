"""
Product Governance Models — PriceChangeRequest and ProductAuditLog.
"""
from django.db import models
from django.conf import settings
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class PriceChangeRequest(AuditLogMixin, TenantOwnedModel):
    """
    Formal approval workflow for product price changes.
    Flow: PENDING → APPROVED/REJECTED → (auto-applied if APPROVED)
    """
    STATUS_CHOICES = (
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('APPLIED', 'Applied'),
        ('VERIFIED', 'Verified'),
        ('CANCELLED', 'Cancelled'),
        ('AUTO_APPROVED', 'Auto-Approved'),
    )

    SCOPE_CHOICES = (
        ('PRODUCT', 'Single Product'),
        ('GROUP', 'Price Group (all members)'),
    )

    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='price_change_requests',
        help_text='Target product (null if scope=GROUP)'
    )
    price_group = models.ForeignKey(
        'inventory.ProductGroup', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='price_change_requests',
        help_text='Target price group (for GROUP scope changes)'
    )
    change_scope = models.CharField(
        max_length=10, choices=SCOPE_CHOICES, default='PRODUCT',
        help_text='Whether this change targets one product or an entire group'
    )

    # Price change details
    current_price_ht = models.DecimalField(max_digits=15, decimal_places=2,
        help_text='Current HT price at time of request')
    current_price_ttc = models.DecimalField(max_digits=15, decimal_places=2,
        help_text='Current TTC price at time of request')
    proposed_price_ht = models.DecimalField(max_digits=15, decimal_places=2,
        help_text='Proposed new HT price')
    proposed_price_ttc = models.DecimalField(max_digits=15, decimal_places=2,
        help_text='Proposed new TTC price')
    tva_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0,
        help_text='TVA rate used for HT/TTC conversion')

    # Justification
    reason = models.TextField(blank=True, default='',
        help_text='Business justification for the price change')
    change_type = models.CharField(max_length=20, default='MANUAL', choices=(
        ('MANUAL', 'Manual Adjustment'),
        ('COST_UPDATE', 'Cost Price Update'),
        ('PROMOTION', 'Promotional Pricing'),
        ('MARKET', 'Market Realignment'),
        ('SUPPLIER', 'Supplier Price Change'),
    ))

    # Workflow
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='price_change_requests_made',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='price_change_requests_reviewed',
    )
    review_notes = models.TextField(blank=True, default='',
        help_text='Notes from the reviewer (approve/reject rationale)')
    effective_date = models.DateField(null=True, blank=True,
        help_text='When the price change should take effect (null=immediately)')
    is_auto_approved = models.BooleanField(
        default=False,
        help_text='True if this was auto-approved by policy (role/threshold)'
    )
    auto_approval_reason = models.CharField(
        max_length=200, null=True, blank=True,
        help_text='Why auto-approval was granted (e.g. "trusted role", "delta < 2%")'
    )

    # Verification (post-application check)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='price_changes_verified',
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    affected_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of products affected by this change (for GROUP scope)'
    )

    class Meta:
        db_table = 'product_price_change_request'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['organization', 'status'], name='pcr_org_status_idx'),
            models.Index(fields=['product', 'status'], name='pcr_product_status_idx'),
        ]

    def __str__(self):
        return f'PCR-{self.pk}: {self.product.sku} {self.current_price_ttc}→{self.proposed_price_ttc} ({self.status})'

    @property
    def price_change_pct(self):
        """Percentage change from current to proposed TTC price."""
        if self.current_price_ttc and self.current_price_ttc > 0:
            return round(
                ((self.proposed_price_ttc - self.current_price_ttc) / self.current_price_ttc) * 100,
                2
            )
        return 0

    def apply_price(self):
        """Apply the approved price change to the product."""
        if self.status != 'APPROVED':
            raise ValueError('Can only apply APPROVED price changes')
        from django.utils import timezone
        product = self.product
        product.selling_price_ht = self.proposed_price_ht
        product.selling_price_ttc = self.proposed_price_ttc
        product.save(update_fields=['selling_price_ht', 'selling_price_ttc', 'updated_at'])
        self.status = 'APPLIED'
        self.applied_at = timezone.now()
        self.save(update_fields=['status', 'applied_at'])


class ProductAuditTrail(TenantOwnedModel):
    """
    Governance audit trail — tracks verification, completeness changes,
    and price change events for regulatory compliance.
    """
    EVENT_TYPES = (
        ('VERIFIED', 'Product Verified'),
        ('UNVERIFIED', 'Verification Removed'),
        ('LEVEL_CHANGE', 'Completeness Level Changed'),
        ('PRICE_REQUEST', 'Price Change Requested'),
        ('PRICE_APPROVED', 'Price Change Approved'),
        ('PRICE_REJECTED', 'Price Change Rejected'),
        ('PRICE_APPLIED', 'Price Change Applied'),
        ('FIELD_UPDATE', 'Product Field Updated'),
        # v3 — Barcode governance
        ('BARCODE_GENERATED', 'Barcode Generated'),
        ('BARCODE_CHANGED', 'Barcode Changed'),
        # v3 — Packaging governance
        ('PKG_CREATED', 'Packaging Created'),
        ('PKG_UPDATED', 'Packaging Updated'),
        ('PKG_DELETED', 'Packaging Deleted'),
        ('PKG_VERIFIED', 'Packaging Verified'),
        # v3 — Supplier & label
        ('SUPPLIER_LINKED', 'Supplier Linked'),
        ('SUPPLIER_REMOVED', 'Supplier Removed'),
        ('LABEL_PRINTED', 'Label Printed'),
        # v4 — Group governance
        ('GROUP_SYNC', 'Group Price Synced'),
        ('GROUP_BROKEN', 'Group Price Broken'),
        ('GROUP_RESTORED', 'Group Price Restored'),
        ('GROUP_OVERRIDE', 'Local Price Override'),
    )

    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE,
        related_name='audit_trail',
    )
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True,
        help_text='Structured event data (old/new values, etc.)')

    class Meta:
        db_table = 'product_audit_trail'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['product', 'event_type'], name='pat_product_event_idx'),
            models.Index(fields=['organization', 'timestamp'], name='pat_org_ts_idx'),
        ]

    def __str__(self):
        return f'{self.event_type} on {self.product.sku} at {self.timestamp}'


class PriceApprovalPolicy(TenantOwnedModel):
    """
    Role/threshold-based auto-approval policy for price changes.
    Defines who can auto-approve, under what conditions.

    Example rules:
    - Pricing Manager: auto-approve if delta < 10%
    - Owner: auto-approve unlimited
    - Cashier: never auto-approve
    - System: auto-approve if delta < 2% AND margin stays above floor
    """
    name = models.CharField(max_length=100, help_text='Policy name, e.g. "Manager Auto-Approve"')
    is_active = models.BooleanField(default=True)
    priority = models.PositiveIntegerField(
        default=10,
        help_text='Lower = evaluated first. First matching policy wins.'
    )

    # Who does this policy apply to?
    applies_to_role = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='User role this applies to (e.g. "manager", "owner", "cashier")'
    )
    applies_to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='price_approval_policies',
        help_text='Specific user this applies to (overrides role)'
    )

    # Conditions
    max_delta_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Max allowed price change % for auto-approval (null=unlimited)'
    )
    min_margin_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Minimum margin % that must be maintained after change'
    )
    max_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Max absolute price change amount for auto-approval'
    )
    allow_group_changes = models.BooleanField(
        default=False,
        help_text='Can this policy auto-approve group-level price changes?'
    )

    # Actions
    AUTO_APPROVAL_ACTIONS = (
        ('AUTO_APPROVE', 'Auto-approve and apply'),
        ('AUTO_APPROVE_PENDING_VERIFY', 'Auto-approve, apply, but require verification'),
        ('BLOCK', 'Block — must have manual approval'),
    )
    action = models.CharField(
        max_length=30, choices=AUTO_APPROVAL_ACTIONS, default='BLOCK'
    )

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'price_approval_policy'
        ordering = ['priority']
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'organization'],
                name='unique_price_policy_name_tenant'
            )
        ]

    def __str__(self):
        return f'{self.name} (priority={self.priority})'
