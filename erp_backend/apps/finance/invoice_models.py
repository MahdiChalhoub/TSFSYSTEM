"""
Invoice Models
==============
Dedicated Invoice & InvoiceLine models with full lifecycle management,
FNE/ZATCA e-invoicing readiness, multi-currency, and payment tracking.

Integrates with:
  - Payment model (apps/finance/payment_models.py)
  - TransactionSequence for auto-numbering
  - JournalEntry for GL posting
  - Contact for customer/supplier linking
"""
from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal
from erp.models import TenantModel, User


# =============================================================================
# INVOICE
# =============================================================================

class Invoice(TenantModel):
    """
    Formal invoice document with lifecycle management.
    
    Status Flow:
        DRAFT → SENT → PARTIAL_PAID → PAID
                 ↓                      ↓
               OVERDUE              (terminal)
                 ↓
             CANCELLED / WRITTEN_OFF
    """
    INVOICE_TYPES = (
        ('SALES', 'Sales Invoice'),
        ('PURCHASE', 'Purchase Invoice'),
        ('CREDIT_NOTE', 'Credit Note'),
        ('DEBIT_NOTE', 'Debit Note'),
        ('PROFORMA', 'Pro Forma Invoice'),
    )
    SALES_SUB_TYPES = (
        ('RETAIL', 'Retail'),
        ('WHOLESALE', 'Wholesale'),
        ('CONSIGNEE', 'Consignee'),
    )
    PURCHASE_SUB_TYPES = (
        ('STANDARD', 'Standard'),
        ('WHOLESALE', 'Wholesale'),
        ('CONSIGNEE', 'Consignee'),
    )
    SUB_TYPE_CHOICES = SALES_SUB_TYPES + PURCHASE_SUB_TYPES
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('SENT', 'Sent'),
        ('PARTIAL_PAID', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
        ('CANCELLED', 'Cancelled'),
        ('WRITTEN_OFF', 'Written Off'),
    )
    PAYMENT_TERMS_CHOICES = (
        ('IMMEDIATE', 'Immediate'),
        ('NET_7', 'Net 7 Days'),
        ('NET_15', 'Net 15 Days'),
        ('NET_30', 'Net 30 Days'),
        ('NET_45', 'Net 45 Days'),
        ('NET_60', 'Net 60 Days'),
        ('NET_90', 'Net 90 Days'),
        ('CUSTOM', 'Custom'),
    )
    DISPLAY_MODES = (
        ('HT', 'Hors Taxe (Excl. Tax)'),
        ('TTC', 'Toutes Taxes Comprises (Incl. Tax)'),
    )

    # ── Identification ───────────────────────────────────────────────────────
    invoice_number = models.CharField(
        max_length=100, null=True, blank=True, db_index=True,
        help_text='Auto-generated via TransactionSequence'
    )
    type = models.CharField(max_length=20, choices=INVOICE_TYPES, default='SALES')
    sub_type = models.CharField(
        max_length=20, choices=SUB_TYPE_CHOICES, default='RETAIL', blank=True,
        help_text='Sub-classification: Retail/Wholesale/Consignee (sales) or Standard/Wholesale/Consignee (purchase)'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    # ── Contact & Site ───────────────────────────────────────────────────────
    contact = models.ForeignKey(
        'crm.Contact', on_delete=models.PROTECT, related_name='invoices',
        help_text='Customer (sales) or Supplier (purchase)'
    )
    contact_name = models.CharField(
        max_length=255, null=True, blank=True,
        help_text='Snapshot of contact name at invoice time'
    )
    contact_email = models.EmailField(null=True, blank=True)
    contact_address = models.TextField(null=True, blank=True)
    contact_vat_id = models.CharField(max_length=100, null=True, blank=True)
    site = models.ForeignKey(
        'erp.Site', on_delete=models.SET_NULL, null=True, blank=True
    )

    # ── Source Document ──────────────────────────────────────────────────────
    source_order = models.ForeignKey(
        'pos.Order', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices',
        help_text='Linked POS order that generated this invoice'
    )

    # ── Dates ────────────────────────────────────────────────────────────────
    issue_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_terms = models.CharField(
        max_length=20, choices=PAYMENT_TERMS_CHOICES, default='NET_30'
    )
    payment_terms_days = models.IntegerField(
        default=30, help_text='Actual days for due_date calculation'
    )

    # ── Financial Summary ────────────────────────────────────────────────────
    subtotal_ht = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Sum of line totals excluding tax'
    )
    tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total VAT / tax amount'
    )
    discount_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Global discount applied to invoice'
    )
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Final amount = subtotal + tax - discount'
    )
    paid_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total amount paid so far'
    )
    balance_due = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Remaining = total_amount - paid_amount'
    )

    # ── HT/TTC & Tax ────────────────────────────────────────────────────────
    display_mode = models.CharField(
        max_length=5, choices=DISPLAY_MODES, default='TTC',
        help_text='HT (excl. tax) or TTC (incl. tax) display mode'
    )
    default_tax_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('11.00'),
        help_text='Default VAT rate (11% for Lebanon)'
    )
    is_vat_recoverable = models.BooleanField(default=False)

    # ── Multi-Currency ───────────────────────────────────────────────────────
    currency = models.CharField(max_length=10, default='USD')
    exchange_rate = models.DecimalField(
        max_digits=15, decimal_places=6, default=Decimal('1.000000'),
        help_text='Conversion rate to functional currency'
    )
    total_in_functional_currency = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total in the organization functional currency'
    )

    # ── Reverse Charge (EU / Cross-Border) ───────────────────────────────────
    is_reverse_charge = models.BooleanField(
        default=False, help_text='EU/cross-border reverse charge applies'
    )
    reverse_charge_note = models.TextField(null=True, blank=True)

    # ── FNE / ZATCA E-Invoicing ──────────────────────────────────────────────
    fne_status = models.CharField(
        max_length=20, default='NONE',
        choices=(
            ('NONE', 'Not Certified'),
            ('PENDING', 'Pending Certification'),
            ('CERTIFIED', 'Certified'),
            ('FAILED', 'Certification Failed'),
            ('REFUNDED', 'Refunded / Reversed'),
        ),
        help_text='Lebanese FNE / Saudi ZATCA certification status'
    )
    fne_reference = models.CharField(max_length=255, null=True, blank=True)
    fne_token = models.TextField(null=True, blank=True)
    fne_invoice_id = models.CharField(max_length=255, null=True, blank=True)
    fne_certified_at = models.DateTimeField(null=True, blank=True)
    fne_error = models.TextField(null=True, blank=True)
    fne_raw_response = models.JSONField(null=True, blank=True)

    # ── ZATCA Phase 2: Hash Chain & Signed XML ───────────────────────────
    invoice_hash = models.CharField(
        max_length=64, null=True, blank=True,
        help_text='SHA-256 hash of this invoice for chain integrity'
    )
    previous_invoice_hash = models.CharField(
        max_length=64, null=True, blank=True,
        help_text='Hash of the preceding invoice (chain link)'
    )
    zatca_signed_xml = models.TextField(
        null=True, blank=True,
        help_text='Digitally signed UBL 2.1 XML for ZATCA submission'
    )
    zatca_clearance_id = models.CharField(
        max_length=255, null=True, blank=True,
        help_text='ZATCA clearance/reporting response ID'
    )

    # ── GL / Posting ─────────────────────────────────────────────────────────
    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices'
    )
    scope = models.CharField(max_length=20, default='OFFICIAL')

    # ── Notes ────────────────────────────────────────────────────────────────
    notes = models.TextField(null=True, blank=True)
    internal_notes = models.TextField(
        null=True, blank=True, help_text='Internal-only notes, not shown to customer'
    )

    # ── Audit ────────────────────────────────────────────────────────────────
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices_created'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'invoice'
        ordering = ['-issue_date', '-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'type']),
            models.Index(fields=['organization', 'contact']),
            models.Index(fields=['organization', 'due_date']),
            models.Index(fields=['invoice_number']),
        ]

    def __str__(self):
        return f"{self.invoice_number or f'INV-{self.id}'} ({self.status})"

    def save(self, *args, **kwargs):
        # Auto-generate invoice number on first save
        if not self.invoice_number and self.status != 'DRAFT':
            from apps.finance.models import TransactionSequence
            prefix = 'INV' if self.type == 'SALES' else 'PINV' if self.type == 'PURCHASE' else 'CN'
            self.invoice_number = TransactionSequence.next_value(
                self.organization, f'INVOICE_{self.type}'
            )

        # Recalculate balance
        self.balance_due = self.total_amount - self.paid_amount

        # Multi-currency conversion
        if self.exchange_rate and self.total_amount:
            self.total_in_functional_currency = self.total_amount * self.exchange_rate

        super().save(*args, **kwargs)

    def recalculate_totals(self):
        """Recalculate totals from line items."""
        lines = self.lines.all()
        self.subtotal_ht = sum(l.line_total_ht for l in lines)
        self.tax_amount = sum(l.tax_amount for l in lines)
        self.total_amount = self.subtotal_ht + self.tax_amount - self.discount_amount
        self.balance_due = self.total_amount - self.paid_amount
        if self.exchange_rate:
            self.total_in_functional_currency = self.total_amount * self.exchange_rate
        self.save(update_fields=[
            'subtotal_ht', 'tax_amount', 'total_amount',
            'balance_due', 'total_in_functional_currency'
        ])

    def record_payment(self, amount):
        """
        Record a payment against this invoice and update status.
        Called by PaymentService after creating a Payment record.
        """
        self.paid_amount += Decimal(str(amount))
        self.balance_due = self.total_amount - self.paid_amount

        if self.balance_due <= 0:
            self.status = 'PAID'
            from django.utils import timezone
            self.paid_at = timezone.now()
        elif self.paid_amount > 0:
            self.status = 'PARTIAL_PAID'

        self.save(update_fields=['paid_amount', 'balance_due', 'status', 'paid_at'])

    def mark_overdue(self):
        """Called by scheduled task when due_date has passed."""
        if self.status in ('SENT', 'PARTIAL_PAID'):
            from django.utils import timezone
            if self.due_date and self.due_date < timezone.now().date():
                self.status = 'OVERDUE'
                self.save(update_fields=['status'])
                return True
        return False

    def cancel(self):
        """Cancel an unpaid invoice."""
        if self.status in ('DRAFT', 'SENT', 'OVERDUE'):
            self.status = 'CANCELLED'
            self.save(update_fields=['status'])
        else:
            raise ValidationError(
                f"Cannot cancel invoice in status '{self.status}'. "
                f"Payments have been recorded."
            )


# =============================================================================
# INVOICE LINES
# =============================================================================

class InvoiceLine(TenantModel):
    """
    Individual line item on an invoice.
    Supports both HT and TTC pricing with automatic tax calculation.
    """
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='lines'
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoice_lines'
    )
    description = models.CharField(
        max_length=500, help_text='Line item description (auto-filled from product)'
    )
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('1.00'))
    unit_price = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Price per unit (in invoice display_mode: HT or TTC)'
    )
    tax_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('11.00'),
        help_text='VAT rate as percentage'
    )

    # Computed totals
    line_total_ht = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Line total excluding tax'
    )
    tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Tax amount for this line'
    )
    line_total_ttc = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Line total including tax'
    )
    discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.00'),
        help_text='Line-level discount percentage'
    )

    # Cost tracking (for margin calculation)
    unit_cost = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Cost price for margin calculation'
    )

    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'invoiceline'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"Line {self.sort_order}: {self.description[:50]}"

    def save(self, *args, **kwargs):
        """Auto-calculate line totals based on display mode."""
        display_mode = self.invoice.display_mode if self.invoice_id else 'TTC'
        rate = self.tax_rate / Decimal('100')
        discount_mult = (Decimal('100') - self.discount_percent) / Decimal('100')

        if display_mode == 'TTC':
            # unit_price is TTC → derive HT
            ttc_after_discount = self.unit_price * self.quantity * discount_mult
            self.line_total_ttc = ttc_after_discount
            self.line_total_ht = ttc_after_discount / (Decimal('1') + rate) if rate else ttc_after_discount
            self.tax_amount = self.line_total_ttc - self.line_total_ht
        else:
            # unit_price is HT → derive TTC
            ht_after_discount = self.unit_price * self.quantity * discount_mult
            self.line_total_ht = ht_after_discount
            self.tax_amount = ht_after_discount * rate
            self.line_total_ttc = ht_after_discount + self.tax_amount

        super().save(*args, **kwargs)


# =============================================================================
# PAYMENT ALLOCATION (links payments ↔ invoices, many-to-many)
# =============================================================================

class PaymentAllocation(TenantModel):
    """
    Allocates a payment (full or partial) to one or more invoices.
    Enables split payments across multiple invoices and partial payments.
    """
    payment = models.ForeignKey(
        'finance.Payment', on_delete=models.CASCADE, related_name='allocations'
    )
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='payment_allocations'
    )
    allocated_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='Amount from this payment applied to this invoice'
    )
    allocated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_allocation'

    def __str__(self):
        return f"PAY-{self.payment_id} → {self.invoice}: {self.allocated_amount}"
