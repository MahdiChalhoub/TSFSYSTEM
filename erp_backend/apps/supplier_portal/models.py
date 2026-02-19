"""
Supplier Portal — Models
========================
Portal access, proforma workflow, price change requests, and notifications
for supplier-facing portal functionality.

Integration:
  - crm.Contact (type=SUPPLIER) — supplier identity
  - pos.PurchaseOrder — proforma → PO conversion
  - inventory.Product — stock visibility
  - finance.SupplierBalance — statement access
"""
from django.db import models
from django.utils import timezone
from decimal import Decimal
from erp.models import TenantModel


# =============================================================================
# SUPPLIER PORTAL CONFIGURATION
# =============================================================================

class SupplierPortalConfig(TenantModel):
    """
    Per-organization configuration for the Supplier Portal module.
    Allows customizing proforma workflows, currencies, and status labels.
    """
    # Proforma Workflow
    proforma_auto_approve_threshold = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Auto-approve proformas below this amount (0 = manual only)'
    )
    require_negotiation_notes = models.BooleanField(default=True)
    default_currency = models.CharField(max_length=3, default='USD')

    # Portal Feature Toggles
    enable_price_requests = models.BooleanField(default=True)
    enable_stock_visibility = models.BooleanField(default=True)
    enable_statement_view = models.BooleanField(default=True)

    # Status labels: CODE -> { label, color }
    proforma_status_config = models.JSONField(
        default=dict, blank=True,
        help_text='JSON: {"DRAFT": {"label": "Draft", "color": "#94a3b8"}, ...}'
    )

    class Meta:
        db_table = 'supplier_portal_config'
        verbose_name = 'Supplier Portal Configuration'
        verbose_name_plural = 'Supplier Portal Configurations'

    @classmethod
    def get_config(cls, organization):
        config, created = cls.objects.get_or_create(organization=organization)
        if created:
            # Seed with default proforma status config
            config.proforma_status_config = {
                'DRAFT': {'label': 'Draft', 'color': '#94a3b8'},
                'SUBMITTED': {'label': 'Submitted', 'color': '#6366f1'},
                'UNDER_REVIEW': {'label': 'Under Review', 'color': '#f59e0b'},
                'NEGOTIATING': {'label': 'Negotiating', 'color': '#8b5cf6'},
                'APPROVED': {'label': 'Approved', 'color': '#22c55e'},
                'REJECTED': {'label': 'Rejected', 'color': '#ef4444'},
                'CONVERTED': {'label': 'Converted to PO', 'color': '#10b981'},
                'CANCELLED': {'label': 'Cancelled', 'color': '#64748b'},
            }
            config.save()
        return config


# =============================================================================
# SUPPLIER PORTAL ACCESS
# =============================================================================

class SupplierPortalAccess(TenantModel):
    """
    Links a CRM Contact (supplier) to a User account for portal login.
    Stores granted permissions and access status.
    """
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('REVOKED', 'Revoked'),
        ('PENDING', 'Pending Activation'),
    )

    PERMISSION_CHOICES = (
        ('VIEW_OWN_ORDERS', 'View Own Orders'),
        ('VIEW_OWN_STOCK', 'View Own Stock Levels'),
        ('VIEW_OWN_STATEMENT', 'View Own Financial Statement'),
        ('CREATE_PROFORMA', 'Create Proforma Invoices'),
        ('REQUEST_PRICE_CHANGE', 'Request Price Changes'),
        ('VIEW_PRODUCT_PERFORMANCE', 'View Product Performance Metrics'),
    )

    contact = models.OneToOneField(
        'crm.Contact', on_delete=models.CASCADE, related_name='portal_access',
        help_text='The supplier Contact this portal access is linked to'
    )
    user = models.OneToOneField(
        'erp.User', on_delete=models.CASCADE, related_name='supplier_access',
        help_text='The User account used for portal login'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    # Permissions stored as comma-separated string for simplicity
    permissions = models.JSONField(
        default=list, blank=True,
        help_text='List of granted permission codes, e.g. ["VIEW_OWN_ORDERS", "CREATE_PROFORMA"]'
    )

    # Metadata
    granted_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='granted_supplier_accesses'
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'supplier_portal_access'
        verbose_name_plural = 'Supplier Portal Accesses'

    def __str__(self):
        return f"{self.contact.name} → {self.user.email} ({self.status})"

    def has_permission(self, perm_code):
        """Check if this supplier has a specific portal permission."""
        return perm_code in (self.permissions or [])

    def grant_permission(self, perm_code):
        """Add a permission if not already granted."""
        if perm_code not in (self.permissions or []):
            perms = list(self.permissions or [])
            perms.append(perm_code)
            self.permissions = perms
            self.save(update_fields=['permissions'])

    def revoke_permission(self, perm_code):
        """Remove a permission."""
        if perm_code in (self.permissions or []):
            perms = list(self.permissions or [])
            perms.remove(perm_code)
            self.permissions = perms
            self.save(update_fields=['permissions'])


class SupplierProforma(TenantModel):
    """
    A proforma invoice created by a supplier and submitted for approval.

    Workflow:
        DRAFT → SUBMITTED → APPROVED / REJECTED / NEGOTIATING
        APPROVED → auto-creates PurchaseOrder
        NEGOTIATING → SUBMITTED (resubmit with changes)
    """
    VALID_TRANSITIONS = {
        'DRAFT': {'SUBMITTED', 'CANCELLED'},
        'SUBMITTED': {'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'NEGOTIATING', 'CANCELLED'},
        'UNDER_REVIEW': {'APPROVED', 'REJECTED', 'NEGOTIATING'},
        'NEGOTIATING': {'SUBMITTED', 'CANCELLED'},
        'APPROVED': {'CONVERTED'},
        'REJECTED': {'DRAFT'},
        'CONVERTED': set(),
        'CANCELLED': set(),
    }

    # Reference
    proforma_number = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    status = models.CharField(max_length=20, default='DRAFT', help_text='Internal status code')

    # Supplier
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.PROTECT, related_name='supplier_proformas',
        help_text='The supplier who created this proforma'
    )
    created_by_supplier = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_proformas',
        help_text='Supplier portal user who created this'
    )

    # Delivery details
    expected_delivery_date = models.DateField(null=True, blank=True)
    delivery_terms = models.CharField(max_length=255, null=True, blank=True)

    # Financials
    currency = models.CharField(max_length=3, default='USD')
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Validity
    valid_until = models.DateField(null=True, blank=True, help_text='Proforma validity expiration')

    # Notes & communication
    supplier_notes = models.TextField(null=True, blank=True, help_text='Notes from supplier')
    internal_notes = models.TextField(null=True, blank=True, help_text='Internal review notes')
    rejection_reason = models.TextField(null=True, blank=True)
    negotiation_notes = models.TextField(null=True, blank=True, help_text='Counter-proposal details')

    # Approval tracking
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_proformas'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # Linked PO (after approval + conversion)
    purchase_order = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='source_proforma'
    )

    # Audit
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'supplier_proforma'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.proforma_number or f'PRO-{self.pk}'} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.proforma_number:
            # Auto-generate on first save
            from apps.finance.models import TransactionSequence
            try:
                self.proforma_number = TransactionSequence.next_value(
                    self.organization, 'SUPPLIER_PROFORMA'
                )
            except Exception:
                pass
        super().save(*args, **kwargs)

    def transition_to(self, new_status, user=None, reason=None):
        """Validate and execute status transition."""
        from django.core.exceptions import ValidationError
        allowed = self.VALID_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise ValidationError(
                f"Cannot transition from '{self.status}' to '{new_status}'. "
                f"Allowed: {', '.join(allowed) if allowed else 'none (terminal)'}"
            )

        if new_status == 'SUBMITTED':
            self.submitted_at = timezone.now()
            # Check for auto-approval threshold
            config = SupplierPortalConfig.get_config(self.organization)
            threshold = config.proforma_auto_approve_threshold
            if threshold > 0 and self.total_amount <= threshold:
                new_status = 'APPROVED'
                self.reviewed_at = timezone.now()
                self.internal_notes = f"Auto-approved (Total {self.total_amount} <= Threshold {threshold})"

        if new_status in ('APPROVED', 'REJECTED', 'NEGOTIATING'):
            self.reviewed_by = user
            self.reviewed_at = timezone.now()
            if new_status == 'REJECTED':
                self.rejection_reason = reason
            elif new_status == 'NEGOTIATING':
                self.negotiation_notes = reason

        self.status = new_status
        self.save()

    def recalculate_totals(self):
        """Recalculate proforma totals from line items."""
        # Use default currency from config if not set
        if not self.currency:
            config = SupplierPortalConfig.get_config(self.organization)
            self.currency = config.default_currency

        lines = self.lines.all()
        self.subtotal = sum(l.line_total for l in lines)
        self.tax_amount = sum(l.tax_amount for l in lines)
        total = self.subtotal + self.tax_amount - self.discount_amount
        self.total_amount = max(total, Decimal('0.00'))
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount', 'currency'])


class ProformaLine(TenantModel):
    """Individual line item on a supplier proforma."""
    proforma = models.ForeignKey(SupplierProforma, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    description = models.TextField(null=True, blank=True)

    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('1.00'))
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    line_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'supplier_proforma_line'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.product} × {self.quantity}"

    def save(self, *args, **kwargs):
        base = self.quantity * self.unit_price
        discount = base * (self.discount_percent / Decimal('100'))
        net = base - discount
        self.tax_amount = net * (self.tax_rate / Decimal('100'))
        self.line_total = net
        super().save(*args, **kwargs)


# =============================================================================
# PRICE CHANGE REQUEST
# =============================================================================

class PriceChangeRequest(TenantModel):
    """
    Supplier-initiated price change request.
    Can be for selling price (retail) or purchase price (wholesale).
    """
    TYPE_CHOICES = (
        ('SELLING', 'Selling Price Adjustment'),
        ('PURCHASE', 'Purchase Price Proposal'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('COUNTER', 'Counter-Proposal Sent'),
        ('ACCEPTED', 'Accepted by Supplier'),
    )

    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.PROTECT, related_name='price_change_requests'
    )
    requested_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='price_change_requests'
    )
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)

    request_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    current_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    proposed_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    counter_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Counter-proposal price from admin'
    )

    reason = models.TextField(null=True, blank=True, help_text='Supplier justification')
    review_notes = models.TextField(null=True, blank=True, help_text='Admin review notes')
    effective_date = models.DateField(null=True, blank=True, help_text='When the new price should take effect')

    # Approval tracking
    reviewed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_price_changes'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'supplier_price_change_request'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.supplier.name}: {self.product} {self.request_type} ({self.status})"

    @property
    def price_change_percent(self):
        if self.current_price and self.current_price != 0:
            return round(
                ((self.proposed_price - self.current_price) / self.current_price) * 100, 2
            )
        return 0


# =============================================================================
# SUPPLIER NOTIFICATION
# =============================================================================

class SupplierNotification(TenantModel):
    """In-portal notifications for supplier events."""
    TYPE_CHOICES = (
        ('ORDER_UPDATE', 'Order Status Update'),
        ('PROFORMA_STATUS', 'Proforma Status Change'),
        ('PRICE_RESPONSE', 'Price Request Response'),
        ('STOCK_ALERT', 'Low Stock Alert'),
        ('GENERAL', 'General Notification'),
    )

    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.CASCADE, related_name='portal_notifications'
    )
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    # Optional link to related object
    related_object_type = models.CharField(max_length=100, null=True, blank=True)
    related_object_id = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'supplier_notification'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] {self.title}"

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
