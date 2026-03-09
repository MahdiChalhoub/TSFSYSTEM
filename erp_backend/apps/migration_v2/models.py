"""
Migration v2 Models
==================
Tracks migration jobs and entity mappings with full audit trail.
"""
from django.db import models
from erp.models import TenantOwnedModel


class MigrationJob(TenantOwnedModel):
    """
    Tracks a complete migration job from UltimatePOS to TSFSYSTEM.

    Architecture:
    - Uses TenantOwnedModel for multi-tenant isolation
    - Uses AuditLogMixin for full audit trail
    - Stores posting rules snapshot to preserve migration context
    """

    name = models.CharField(max_length=255, help_text='Migration job name')

    # Source file (uploaded SQL dump)
    source_file = models.ForeignKey(
        'storage.StoredFile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='migration_jobs_v2'
    )

    # Target organization (selected by user)
    target_organization = models.ForeignKey(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='migrations_v2',
        help_text='Organization where data will be migrated'
    )

    # COA Template used
    coa_template_used = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text='COA template name (SYSCOHADA, IFRS, etc.)'
    )

    # Posting rules snapshot (capture configuration at migration time)
    posting_rules_snapshot = models.JSONField(
        null=True,
        blank=True,
        help_text='Snapshot of posting rules at the time of migration'
    )

    # Account type mappings (UltimatePOS account_type_id → TSFSYSTEM COA account_id)
    account_type_mappings = models.JSONField(
        default=dict,
        help_text='Map of UPOS account_type_id → TSF ChartOfAccount.id'
    )

    # Migration status
    STATUS_CHOICES = [
        ('DRAFT', 'Draft - Setting Up'),
        ('VALIDATING', 'Running Pre-Flight Validation'),
        ('MAPPING', 'Account Mapping in Progress'),
        ('READY', 'Ready to Execute'),
        ('RUNNING', 'Migration in Progress'),
        ('COMPLETED', 'Completed Successfully'),
        ('FAILED', 'Failed with Errors'),
        ('ROLLED_BACK', 'Rolled Back'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    # Progress tracking
    current_step = models.CharField(max_length=100, null=True, blank=True)
    current_step_detail = models.CharField(max_length=255, null=True, blank=True)
    progress_percent = models.IntegerField(default=0)

    # Statistics - Totals from source
    total_units = models.IntegerField(default=0)
    total_categories = models.IntegerField(default=0)
    total_brands = models.IntegerField(default=0)
    total_products = models.IntegerField(default=0)
    total_contacts = models.IntegerField(default=0)
    total_sales = models.IntegerField(default=0)
    total_purchases = models.IntegerField(default=0)
    total_payments = models.IntegerField(default=0)
    total_stock_records = models.IntegerField(default=0)

    # Statistics - Imported counts
    imported_units = models.IntegerField(default=0)
    imported_categories = models.IntegerField(default=0)
    imported_brands = models.IntegerField(default=0)
    imported_products = models.IntegerField(default=0)
    imported_customers = models.IntegerField(default=0)
    imported_suppliers = models.IntegerField(default=0)
    imported_sales = models.IntegerField(default=0)
    imported_purchases = models.IntegerField(default=0)
    imported_payments = models.IntegerField(default=0)
    imported_stock_records = models.IntegerField(default=0)

    # Statistics - Verification
    total_verified = models.IntegerField(default=0)
    total_flagged = models.IntegerField(default=0)

    # Errors and warnings
    errors = models.JSONField(
        default=list,
        help_text='List of error objects: [{entity_type, source_id, error}]'
    )
    warnings = models.JSONField(
        default=list,
        help_text='List of warning objects'
    )

    # Timestamps
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'migration_v2_job'
        ordering = ['-id']  # Use ID instead of created_at for now
        indexes = [
            models.Index(fields=['target_organization', 'status']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Migration v2 #{self.id} - {self.name} ({self.status})"


class MigrationMapping(models.Model):
    """
    Stores old_id → new_id mappings for traceability and rollback.

    Each imported entity gets a mapping record that tracks:
    - Source ID from UltimatePOS
    - Target ID in TSFSYSTEM
    - Verification status
    - Snapshot of original data
    """

    job = models.ForeignKey(
        MigrationJob,
        on_delete=models.CASCADE,
        related_name='mappings'
    )

    ENTITY_TYPES = [
        ('UNIT', 'Unit of Measure'),
        ('CATEGORY', 'Product Category'),
        ('BRAND', 'Brand'),
        ('TAX_RATE', 'Tax Rate'),
        ('PRODUCT', 'Product'),
        ('VARIATION', 'Product Variation'),
        ('CONTACT_CUSTOMER', 'Customer Contact'),
        ('CONTACT_SUPPLIER', 'Supplier Contact'),
        ('COA_ACCOUNT', 'Chart of Account (Auto-Created)'),
        ('TRANSACTION_SALE', 'Sale Transaction'),
        ('TRANSACTION_PURCHASE', 'Purchase Transaction'),
        ('PAYMENT', 'Payment'),
        ('JOURNAL_ENTRY', 'Journal Entry (Ledger Posting)'),
        ('STOCK', 'Stock Record'),
        ('STOCK_ADJUSTMENT', 'Stock Adjustment'),
    ]
    entity_type = models.CharField(max_length=30, choices=ENTITY_TYPES, db_index=True)

    source_id = models.IntegerField(help_text='Original ID from UltimatePOS')
    target_id = models.IntegerField(help_text='New ID in TSFSYSTEM')

    # Metadata - snapshot of original data for reference
    source_data = models.JSONField(
        null=True,
        blank=True,
        help_text='Snapshot of original record from UltimatePOS'
    )

    # Verification workflow
    VERIFY_STATUS = [
        ('PENDING', 'Pending Review'),
        ('VERIFIED', 'Verified ✓'),
        ('FLAGGED', 'Flagged for Review ⚠'),
    ]
    verify_status = models.CharField(
        max_length=20,
        choices=VERIFY_STATUS,
        default='PENDING',
        db_index=True
    )
    verify_notes = models.TextField(null=True, blank=True)
    verified_by = models.ForeignKey(
        'erp.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_migrations_v2'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'migration_v2_mapping'
        unique_together = ('job', 'entity_type', 'source_id')
        indexes = [
            models.Index(fields=['job', 'entity_type']),
            models.Index(fields=['job', 'verify_status']),
            models.Index(fields=['entity_type', 'source_id']),
        ]

    def __str__(self):
        return f"{self.entity_type} {self.source_id} → {self.target_id} ({self.verify_status})"


class MigrationValidationResult(models.Model):
    """
    Stores pre-flight validation results for audit trail.
    """
    job = models.OneToOneField(
        MigrationJob,
        on_delete=models.CASCADE,
        related_name='validation_result'
    )

    is_valid = models.BooleanField(default=False)

    # Validation checks
    has_coa = models.BooleanField(default=False)
    coa_account_count = models.IntegerField(default=0)

    has_posting_rules = models.BooleanField(default=False)
    missing_posting_rules = models.JSONField(default=list)

    customer_root_valid = models.BooleanField(default=False)
    supplier_root_valid = models.BooleanField(default=False)

    # Results
    errors = models.JSONField(default=list)
    warnings = models.JSONField(default=list)

    validated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'migration_v2_validation_result'
