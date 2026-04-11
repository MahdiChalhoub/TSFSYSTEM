"""
Label Governance Models — policy, records, reprint tracking, and printing sessions.

Governs:
- Which label template applies per product/packaging
- Print/reprint history with reason tracking
- Invalidation after barcode or price change
- Mandatory relabeling workflow
- Print session queue management (enterprise lifecycle)
- Label layout templates (versioned, validated)
- Printer hardware configuration & capability tracking
"""
from django.db import models
from django.conf import settings
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class LabelPolicy(AuditLogMixin, TenantOwnedModel):
    """
    Organization-level label printing policy.
    Singleton per org — governs label lifecycle.
    """
    INVALIDATION_CHOICES = (
        ('BARCODE_CHANGE', 'Invalidate on barcode change'),
        ('PRICE_CHANGE', 'Invalidate on price change'),
        ('BOTH', 'Invalidate on barcode or price change'),
        ('MANUAL', 'Manual invalidation only'),
    )

    auto_invalidate_on = models.CharField(
        max_length=15, choices=INVALIDATION_CHOICES, default='BOTH',
        help_text='When existing labels should be marked as invalid')
    require_reprint_after_price_change = models.BooleanField(default=True,
        help_text='Auto-create PRINT_LABEL task after price change')
    require_reprint_after_barcode_change = models.BooleanField(default=True,
        help_text='Auto-create PRINT_LABEL task after barcode change')
    default_shelf_template = models.CharField(max_length=50, blank=True, default='shelf_standard',
        help_text='Default template for shelf labels')
    default_packaging_template = models.CharField(max_length=50, blank=True, default='packaging_standard',
        help_text='Default template for packaging/barcode labels')
    default_fresh_template = models.CharField(max_length=50, blank=True, default='fresh_weight',
        help_text='Default template for fresh/variable-weight labels')
    retention_days = models.IntegerField(default=365,
        help_text='How many days to keep label print history')

    # Approval policy
    require_approval_before_print = models.BooleanField(default=False,
        help_text='Require manager approval before sessions can be printed')
    auto_approve_for_roles = models.JSONField(default=list, blank=True,
        help_text='List of role names that auto-approve print sessions')

    class Meta:
        db_table = 'label_policy'
        constraints = [
            models.UniqueConstraint(fields=['organization'], name='unique_label_policy_per_org'),
        ]

    def __str__(self):
        return f'LabelPolicy (invalidate={self.auto_invalidate_on}) for org {self.organization_id}'


class LabelRecord(AuditLogMixin, TenantOwnedModel):
    """
    Immutable record of a label print/reprint event.
    Tracks what was printed, when, by whom, and why.
    """
    TYPE_CHOICES = (
        ('SHELF', 'Shelf label'),
        ('BARCODE', 'Barcode label'),
        ('PACKAGING', 'Packaging label'),
        ('FRESH', 'Fresh/weight label'),
        ('CUSTOM', 'Custom label'),
    )
    STATUS_CHOICES = (
        ('VALID', 'Currently valid'),
        ('INVALIDATED', 'Invalidated by data change'),
        ('REPRINTED', 'Superseded by reprint'),
    )
    REASON_CHOICES = (
        ('INITIAL', 'Initial print (product creation)'),
        ('PRICE_CHANGE', 'Price changed'),
        ('BARCODE_CHANGE', 'Barcode changed'),
        ('RESTOCK', 'Restocking / shelf refresh'),
        ('DAMAGED', 'Previous label damaged'),
        ('CORRECTION', 'Data correction'),
        ('MANUAL', 'Manual reprint request'),
    )

    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE,
        related_name='label_records',
    )
    packaging = models.ForeignKey(
        'inventory.ProductPackaging', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='label_records',
        help_text='If set, label for a specific packaging level'
    )

    label_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='SHELF')
    template_name = models.CharField(max_length=50, default='shelf_standard',
        help_text='Label template used for printing')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='VALID')
    reason = models.CharField(max_length=15, choices=REASON_CHOICES, default='INITIAL')

    # Snapshot — frozen label data at print time
    printed_name = models.CharField(max_length=255,
        help_text='Product/package name as printed')
    printed_barcode = models.CharField(max_length=100, null=True, blank=True,
        help_text='Barcode as printed')
    printed_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Price as printed (TTC)')
    printed_unit = models.CharField(max_length=50, null=True, blank=True,
        help_text='Unit of measure as printed')

    # Tracking
    version = models.PositiveIntegerField(default=1,
        help_text='Label version number (increments on reprint)')
    printed_at = models.DateTimeField(auto_now_add=True)
    printed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='printed_labels',
    )
    invalidated_at = models.DateTimeField(null=True, blank=True)
    invalidated_reason = models.CharField(max_length=255, blank=True, default='')

    # Reprint governance
    reprint_reason_detail = models.TextField(blank=True, default='',
        help_text='Detailed explanation for why reprint was needed')
    old_labels_invalidated = models.BooleanField(default=False,
        help_text='Whether previous labels were formally invalidated')
    shelf_relabel_pending = models.BooleanField(default=False,
        help_text='Physical shelf replacement still needed')

    class Meta:
        db_table = 'label_record'
        ordering = ['-printed_at']
        indexes = [
            models.Index(fields=['product', 'status'], name='lr_product_status_idx'),
            models.Index(fields=['organization', 'printed_at'], name='lr_org_printed_idx'),
        ]

    def __str__(self):
        return f'{self.label_type} v{self.version}: {self.printed_name} ({self.status})'

    def invalidate(self, reason=''):
        """Mark this label as invalidated."""
        from django.utils import timezone
        self.status = 'INVALIDATED'
        self.invalidated_at = timezone.now()
        self.invalidated_reason = reason
        self.save(update_fields=['status', 'invalidated_at', 'invalidated_reason'])


# ═══════════════════════════════════════════════════════════════════════════════
#  PRINTING CENTER — ENTERPRISE MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class LabelTemplate(AuditLogMixin, TenantOwnedModel):
    """
    Versioned label layout template with HTML+CSS content, paper/size config,
    variable schema, and thermal-print-aware dimensions.

    Variables: {name}, {price}, {barcode}, {sku}, {unit}, {category}, {supplier},
               {packaging_name}, {date}, {note}, {variant}, {lot}, {weight}
    """
    LABEL_TYPE_CHOICES = (
        ('SHELF', 'Shelf price label'),
        ('BARCODE', 'Barcode sticker'),
        ('PACKAGING', 'Packaging label'),
        ('FRESH', 'Fresh/weight label'),
        ('CUSTOM', 'Custom template'),
    )
    ORIENTATION_CHOICES = (
        ('PORTRAIT', 'Portrait'),
        ('LANDSCAPE', 'Landscape'),
    )

    name = models.CharField(max_length=100, help_text='Template display name')
    label_type = models.CharField(max_length=10, choices=LABEL_TYPE_CHOICES, default='SHELF')
    description = models.TextField(blank=True, default='')

    # Template content (separated HTML + CSS for safety)
    html_template = models.TextField(blank=True, default='',
        help_text='HTML structure with variable placeholders')
    css_template = models.TextField(blank=True, default='',
        help_text='CSS styling for the label layout')
    variables_schema = models.JSONField(default=list, blank=True,
        help_text='List of allowed variable names for this template')

    # Versioning & governance
    version = models.PositiveIntegerField(default=1,
        help_text='Template version (increments on edit)')
    template_schema_version = models.CharField(max_length=10, default='1.0',
        help_text='Schema version for template format compatibility')
    is_system = models.BooleanField(default=False,
        help_text='System template — cannot be deleted, only cloned')
    is_default = models.BooleanField(default=False,
        help_text='Default template for its label type')
    is_active = models.BooleanField(default=True)

    # Label dimensions (explicit for thermal printing)
    label_width_mm = models.DecimalField(max_digits=8, decimal_places=2, default=50,
        help_text='Label width in millimeters')
    label_height_mm = models.DecimalField(max_digits=8, decimal_places=2, default=30,
        help_text='Label height in millimeters')
    orientation = models.CharField(max_length=10, choices=ORIENTATION_CHOICES, default='LANDSCAPE')
    dpi = models.PositiveIntegerField(default=203,
        help_text='Target print resolution')

    # Page layout (for sheet printing)
    columns = models.PositiveIntegerField(default=3,
        help_text='Number of labels per row')
    rows = models.PositiveIntegerField(default=10,
        help_text='Number of label rows per page')
    gap_horizontal_mm = models.DecimalField(max_digits=6, decimal_places=2, default=2,
        help_text='Horizontal gap between labels')
    gap_vertical_mm = models.DecimalField(max_digits=6, decimal_places=2, default=2,
        help_text='Vertical gap between labels')
    margin_top_mm = models.DecimalField(max_digits=6, decimal_places=2, default=5)
    margin_right_mm = models.DecimalField(max_digits=6, decimal_places=2, default=5)
    margin_bottom_mm = models.DecimalField(max_digits=6, decimal_places=2, default=5)
    margin_left_mm = models.DecimalField(max_digits=6, decimal_places=2, default=5)

    # Capabilities
    supports_barcode = models.BooleanField(default=True)
    supports_qr = models.BooleanField(default=False)
    default_font_size = models.PositiveIntegerField(default=12)
    preview_image = models.CharField(max_length=500, blank=True, default='',
        help_text='Path to preview thumbnail image')

    class Meta:
        db_table = 'label_template'
        ordering = ['label_type', 'name']
        indexes = [
            models.Index(fields=['organization', 'label_type'], name='lt_org_type_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'name', 'label_type'],
                name='unique_template_name_per_org_type'),
        ]

    def __str__(self):
        return f'{self.name} v{self.version} ({self.label_type})'


class PrinterConfig(AuditLogMixin, TenantOwnedModel):
    """
    Printer hardware configuration with runtime capability tracking.
    Separates: identity → capabilities → operational state → assignment.
    """
    PRINTER_TYPE_CHOICES = (
        ('THERMAL', 'Thermal printer'),
        ('INKJET', 'Inkjet printer'),
        ('LASER', 'Laser printer'),
    )
    CONNECTION_CHOICES = (
        ('USB', 'USB direct'),
        ('NETWORK', 'Network / IP'),
        ('BLUETOOTH', 'Bluetooth'),
    )

    # Identity
    name = models.CharField(max_length=100, help_text='Printer display name')
    device_identifier = models.CharField(max_length=200, blank=True, default='',
        help_text='Unique device ID (serial number, MAC, etc.)')
    model_name = models.CharField(max_length=100, blank=True, default='',
        help_text='Printer model (e.g. Zebra ZD421, Brother QL-820)')
    location = models.CharField(max_length=200, blank=True, default='',
        help_text='Physical location (e.g. Warehouse A, Reception Desk)')

    # Connection
    printer_type = models.CharField(max_length=10, choices=PRINTER_TYPE_CHOICES, default='THERMAL')
    connection_type = models.CharField(max_length=10, choices=CONNECTION_CHOICES, default='NETWORK')
    address = models.CharField(max_length=255, blank=True, default='',
        help_text='IP address, USB port, or Bluetooth address')

    # Capabilities
    dpi = models.PositiveIntegerField(default=203, help_text='Print resolution (dots per inch)')
    paper_width_mm = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True,
        help_text='Max paper width in mm')
    driver_name = models.CharField(max_length=100, blank=True, default='',
        help_text='Driver name (e.g. ZPL, EPL, ESC/POS, PDF)')
    supports_pdf = models.BooleanField(default=True)
    supports_zpl = models.BooleanField(default=False, help_text='Zebra ZPL support')
    supports_epl = models.BooleanField(default=False, help_text='Eltron EPL support')
    supports_escpos = models.BooleanField(default=False, help_text='ESC/POS support')
    supported_label_types = models.JSONField(default=list, blank=True,
        help_text='List of label types this printer handles (SHELF, BARCODE, etc.)')

    # Assignment
    is_default = models.BooleanField(default=False)
    default_label_type = models.CharField(max_length=10, blank=True, default='',
        help_text='Default label type for this printer (auto-assign)')
    is_active = models.BooleanField(default=True)

    # Operational state
    last_seen_at = models.DateTimeField(null=True, blank=True,
        help_text='Last time printer was online/responsive')
    last_tested_at = models.DateTimeField(null=True, blank=True)
    test_status = models.CharField(max_length=20, blank=True, default='',
        help_text='PASS, FAIL, UNKNOWN')
    test_message = models.TextField(blank=True, default='',
        help_text='Detailed test result message')

    class Meta:
        db_table = 'printer_config'
        ordering = ['-is_default', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'name'],
                name='unique_printer_name_per_org'),
        ]

    def __str__(self):
        return f'{self.name} ({self.printer_type}/{self.connection_type})'


class PrintSession(AuditLogMixin, TenantOwnedModel):
    """
    Enterprise print session — auditable lifecycle from Draft to Completed.

    Lifecycle: DRAFT -> APPROVED -> QUEUED -> PRINTING -> COMPLETED / FAILED
    Auto-creation triggers: PURCHASE, TRANSFER, PRICE_CHANGE, BARCODE_GEN, NEW_PRODUCT
    """
    STATUS_CHOICES = (
        ('DRAFT', 'Draft - selecting products'),
        ('APPROVED', 'Approved - awaiting queue'),
        ('QUEUED', 'Queued - ready to print'),
        ('PRINTING', 'Printing in progress'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    )
    LABEL_TYPE_CHOICES = (
        ('SHELF', 'Shelf price labels'),
        ('BARCODE', 'Barcode stickers'),
        ('PACKAGING', 'Packaging labels'),
        ('FRESH', 'Fresh/weight labels'),
        ('CUSTOM', 'Custom labels'),
    )
    OUTPUT_METHOD_CHOICES = (
        ('PDF', 'PDF export'),
        ('THERMAL', 'Direct to thermal printer'),
        ('BROWSER', 'Browser print dialog'),
    )
    TRIGGER_CHOICES = (
        ('MANUAL', 'Manually created'),
        ('PURCHASE', 'Auto - product purchased'),
        ('TRANSFER', 'Auto - stock transfer'),
        ('PRICE_CHANGE', 'Auto - price changed'),
        ('BARCODE_GEN', 'Auto - barcode generated'),
        ('NEW_PRODUCT', 'Auto - new product created'),
    )
    SOURCE_CONTEXT_CHOICES = (
        ('PRODUCT_LIST', 'Product listing / manual selection'),
        ('RECEIVING', 'Goods receiving / purchase receipt'),
        ('STOCK_COUNT', 'Stock count results'),
        ('STOCK_TRANSFER', 'Stock transfer'),
        ('PACKAGING', 'Packaging change'),
        ('PRICE_UPDATE', 'Price update / batch'),
        ('BARCODE_GEN', 'Barcode generation'),
        ('SCHEDULER', 'Scheduled / automated'),
    )
    REPRINT_MODE_CHOICES = (
        ('EXACT', 'Exact reprint from snapshot'),
        ('REGENERATE', 'Regenerate from live product data'),
    )

    # Identity
    session_code = models.CharField(max_length=30, editable=False,
        help_text='Auto-generated: LBL-YYYYMMDD-NNNNNN')
    title = models.CharField(max_length=200, blank=True, default='')
    label_type = models.CharField(max_length=10, choices=LABEL_TYPE_CHOICES, default='SHELF')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='DRAFT')
    trigger = models.CharField(max_length=15, choices=TRIGGER_CHOICES, default='MANUAL')
    source_context = models.CharField(max_length=20, choices=SOURCE_CONTEXT_CHOICES,
        default='PRODUCT_LIST', help_text='What operation spawned this session')

    # Template & output
    template = models.ForeignKey(
        LabelTemplate, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='print_sessions')
    output_method = models.CharField(max_length=10, choices=OUTPUT_METHOD_CHOICES, default='PDF')
    printer = models.ForeignKey(
        PrinterConfig, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='print_sessions')
    copies = models.PositiveIntegerField(default=1, help_text='Number of copies per label')

    # Reprint tracking
    is_reprint = models.BooleanField(default=False)
    reprint_mode = models.CharField(max_length=12, choices=REPRINT_MODE_CHOICES,
        blank=True, default='')
    original_session = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reprints',
        help_text='Original session if this is a reprint')

    # Assignment & workflow
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_print_sessions')
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_print_sessions')
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_print_sessions')
    approved_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cancelled_print_sessions')
    cancelled_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    queued_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')

    # Output artifact (immutable after completion)
    output_path = models.CharField(max_length=500, blank=True, default='',
        help_text='Path to rendered output file (PDF, etc.)')
    output_checksum = models.CharField(max_length=64, blank=True, default='',
        help_text='SHA-256 of the rendered output')
    page_count = models.PositiveIntegerField(default=0)
    render_context_hash = models.CharField(max_length=64, blank=True, default='',
        help_text='Hash of the data used for rendering — detects if reprint would differ')
    job_reference = models.CharField(max_length=100, blank=True, default='',
        help_text='External job/spool ID for printer tracking')

    # Aggregates (denormalized)
    total_products = models.PositiveIntegerField(default=0)
    total_labels = models.PositiveIntegerField(default=0)

    # Timestamps (required by Meta.ordering and Meta.indexes)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'print_session'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status'], name='ps_org_status_idx'),
            models.Index(fields=['organization', 'created_at'], name='ps_org_created_idx'),
            models.Index(fields=['assigned_to', 'status'], name='ps_assigned_status_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'session_code'],
                name='unique_session_code_per_org'),
        ]

    def __str__(self):
        return f'{self.session_code} ({self.status}) - {self.total_labels} labels'

    def save(self, *args, **kwargs):
        if not self.session_code:
            self.session_code = self._generate_code()
        super().save(*args, **kwargs)

    def _generate_code(self):
        """Generate tenant-scoped, date-prefixed session code: LBL-20260317-000001"""
        from django.utils import timezone
        today = timezone.now().strftime('%Y%m%d')
        prefix = f'LBL-{today}-'
        last = PrintSession.objects.filter(
            organization=self.organization,
            session_code__startswith=prefix,
        ).order_by('-session_code').values_list('session_code', flat=True).first()
        if last:
            try:
                num = int(last.split('-')[-1]) + 1
            except (ValueError, IndexError):
                num = 1
        else:
            num = 1
        return f'{prefix}{num:06d}'

    def recalculate_totals(self):
        """Recalculate denormalized totals from items."""
        from django.db.models import Sum, Count
        agg = self.items.aggregate(
            product_count=Count('id'),
            label_sum=Sum('quantity'),
        )
        self.total_products = agg['product_count'] or 0
        self.total_labels = agg['label_sum'] or 0
        self.save(update_fields=['total_products', 'total_labels'])


class PrintSessionItem(TenantOwnedModel):
    """
    A product/packaging in a print session queue.
    Stores a FULL immutable snapshot for reliable reprinting.
    Product FK is nullable to survive product deletion/archival.
    """
    session = models.ForeignKey(
        PrintSession, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='print_queue_items',
        help_text='Nullable — snapshot survives product deletion')

    quantity = models.PositiveIntegerField(default=1,
        help_text='Number of labels to print')

    # Full snapshot (frozen at queue time)
    snapshot_name = models.CharField(max_length=255, blank=True, default='')
    snapshot_sku = models.CharField(max_length=100, blank=True, default='')
    snapshot_barcode = models.CharField(max_length=100, blank=True, default='')
    snapshot_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    snapshot_category = models.CharField(max_length=200, blank=True, default='')
    snapshot_supplier = models.CharField(max_length=200, blank=True, default='')
    snapshot_unit = models.CharField(max_length=50, blank=True, default='')
    snapshot_currency = models.CharField(max_length=10, blank=True, default='')
    snapshot_product_ref = models.CharField(max_length=100, blank=True, default='',
        help_text='Internal product reference code')
    snapshot_tax_mode = models.CharField(max_length=5, blank=True, default='TTC',
        help_text='HT or TTC — price display mode at print time')

    # Packaging snapshot (if label is for a specific packaging level)
    snapshot_packaging_name = models.CharField(max_length=200, blank=True, default='')
    snapshot_packaging_barcode = models.CharField(max_length=100, blank=True, default='')
    snapshot_packaging_ratio = models.DecimalField(max_digits=10, decimal_places=4,
        null=True, blank=True, help_text='Units per packaging')

    # Variant / lot info
    snapshot_variant_summary = models.CharField(max_length=300, blank=True, default='',
        help_text='e.g. "Color: Red, Size: XL"')
    snapshot_template_version = models.PositiveIntegerField(default=1,
        help_text='Template version used at render time')

    # Per-item status
    is_printed = models.BooleanField(default=False)
    printed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'print_session_item'
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(
                fields=['session', 'product'],
                condition=models.Q(product__isnull=False),
                name='unique_product_per_session',
            ),
        ]

    def __str__(self):
        return f'{self.snapshot_name} x{self.quantity} (session={self.session_id})'
