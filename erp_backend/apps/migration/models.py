"""
Migration Module Models
Tracks migration jobs and old_id → new_id mappings for idempotency.
"""
from django.db import models
from erp.models import TenantModel


class MigrationJob(TenantModel):
    """Tracks a single migration run from UltimatePOS."""
    SOURCE_TYPES = (
        ('SQL_DUMP', 'SQL Dump File'),
        ('DIRECT_DB', 'Direct MySQL Connection'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PARSING', 'Parsing Source'),
        ('RUNNING', 'Running Migration'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('STALLED', 'Stalled / Crashed'),
        ('ROLLED_BACK', 'Rolled Back'),
    )

    name = models.CharField(max_length=255, default='UltimatePOS Migration')
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPES, default='SQL_DUMP')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    # Link to universal storage
    stored_file = models.ForeignKey(
        'storage.StoredFile', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='migration_jobs'
    )
    file_path = models.CharField(max_length=500, null=True, blank=True, help_text='Legacy local path fallback')

    # Direct DB connection params (encrypted at rest ideally)
    db_host = models.CharField(max_length=255, null=True, blank=True)
    db_port = models.IntegerField(null=True, blank=True, default=3306)
    db_name = models.CharField(max_length=255, null=True, blank=True)
    db_user = models.CharField(max_length=255, null=True, blank=True)
    db_password_encrypted = models.TextField(null=True, blank=True, help_text='Encrypted direct DB password')

    def set_db_password(self, raw_password: str):
        """Encrypt and store the DB password."""
        from erp.encryption import encrypt_value
        self.db_password_encrypted = encrypt_value(raw_password)

    def get_db_password(self) -> str | None:
        """Decrypt and return the DB password."""
        from erp.encryption import decrypt_value
        if not self.db_password_encrypted:
            return None
        return decrypt_value(self.db_password_encrypted)

    # Business selection — which UPOS business to migrate
    source_business_id = models.IntegerField(
        null=True, blank=True,
        help_text='UltimatePOS business_id to migrate. NULL = all businesses.'
    )
    source_business_name = models.CharField(max_length=255, null=True, blank=True)

    # Migration mode
    MIGRATION_MODES = (
        ('FULL', 'Full Import'),
        ('SYNC', 'Sync (only new records)'),
    )
    migration_mode = models.CharField(
        max_length=10, choices=MIGRATION_MODES, default='FULL',
        help_text='FULL = import all, SYNC = skip records already imported'
    )

    # Statistics
    total_units = models.IntegerField(default=0)
    total_categories = models.IntegerField(default=0)
    total_brands = models.IntegerField(default=0)
    total_products = models.IntegerField(default=0)
    total_contacts = models.IntegerField(default=0)
    total_transactions = models.IntegerField(default=0)
    total_accounts = models.IntegerField(default=0)
    total_inventory = models.IntegerField(default=0)
    total_errors = models.IntegerField(default=0)
    
    # Audit Counters
    total_verified = models.IntegerField(default=0, help_text='Total entities verified by auditing')
    total_flagged = models.IntegerField(default=0, help_text='Total entities flagged for review')

    # Discovered metadata for preview/selection
    discovered_data = models.JSONField(
        null=True, blank=True,
        help_text='JSON result of source analysis (businesses, table counts)'
    )

    # Progress tracking (0-100)
    progress = models.IntegerField(default=0)
    current_step = models.CharField(max_length=100, null=True, blank=True)
    current_step_detail = models.CharField(
        max_length=200, null=True, blank=True,
        help_text='Sub-step progress detail e.g. "35,000/53,752 transactions"'
    )
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    
    error_summary = models.JSONField(
        null=True, blank=True,
        help_text='Counts of errors by type'
    )
    completed_steps = models.JSONField(
        null=True, blank=True, default=list,
        help_text='List of step names that completed successfully'
    )

    error_log = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'migration_job'
        ordering = ['-created_at']

    def __str__(self):
        return f"Migration #{self.id} ({self.status})"


class MigrationMapping(models.Model):
    """
    Stores old_id → new_id mapping for each entity type.
    Enables idempotency (skip already-imported records) and rollback.
    """
    ENTITY_TYPES = (
        ('UNIT', 'Unit'),
        ('CATEGORY', 'Category'),
        ('BRAND', 'Brand'),
        ('PRODUCT', 'Product'),
        ('CONTACT', 'Contact'),
        ('TRANSACTION', 'Transaction'),
        ('ORDER_LINE', 'Order Line'),
        ('ACCOUNT', 'Account'),
        ('INVENTORY', 'Inventory'),
        ('SITE', 'Site'),
        ('TAX_GROUP', 'Tax Group'),
        ('PAYMENT', 'Payment'),
        ('EXPENSE', 'Expense'),
        ('COMBO_LINK', 'Combo Component Link'),
        ('USER', 'User'),
        ('JOURNAL_ENTRY', 'Journal Entry'),
    )

    job = models.ForeignKey(MigrationJob, on_delete=models.CASCADE, related_name='mappings')
    entity_type = models.CharField(max_length=20, choices=ENTITY_TYPES)
    source_id = models.IntegerField(help_text='Original ID from UltimatePOS')
    target_id = models.IntegerField(help_text='New ID in TSF system')
    source_table = models.CharField(max_length=100, help_text='Original table name')
    extra_data = models.JSONField(
        null=True, blank=True,
        help_text='Any unmapped fields stored for reference'
    )
    
    # Audit Fields
    AUDIT_STATUS = (
        ('PENDING', 'Pending Review'),
        ('VERIFIED', 'Verified / Approved'),
        ('FLAGGED', 'Flagged / Needs Fix'),
    )
    audit_status = models.CharField(max_length=20, choices=AUDIT_STATUS, default='PENDING')
    audit_notes = models.TextField(null=True, blank=True)
    audit_at = models.DateTimeField(null=True, blank=True)
    audited_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audited_mappings'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'migration_mapping'
        unique_together = ('job', 'entity_type', 'source_id')
        indexes = [
            models.Index(fields=['job', 'entity_type']),
            models.Index(fields=['entity_type', 'source_id']),
        ]

    def __str__(self):
        return f"{self.entity_type} {self.source_id} → {self.target_id}"
