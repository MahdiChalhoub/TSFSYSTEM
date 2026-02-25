"""
Storage Module — models.py
Per-organization cloud file storage (Cloudflare R2 / S3-compatible).
"""
import uuid
from django.db import models
from erp.models import TenantModel, Organization, User


PROVIDER_TYPES = (
    ('R2', 'Cloudflare R2'),
    ('S3', 'AWS S3'),
    ('MINIO', 'MinIO'),
    ('LOCAL', 'Local Server'),
)

FILE_CATEGORIES = (
    ('ATTACHMENT', 'General Attachment'),
    ('RECEIPT', 'Receipt'),
    ('INVOICE', 'Invoice Document'),
    ('PROFORMA', 'Proforma Invoice'),
    ('SIGNED_ORDER', 'Signed Order'),
    ('PURCHASE_ORDER', 'Purchase Order'),
    ('PURCHASE_RECEIPT', 'Purchase Receipt'),
    ('PURCHASE_DOC', 'Purchase Document'),
    ('TRANSFER_ORDER', 'Transfer Order'),
    ('TRANSFER', 'Transfer'),
    ('ADJUSTMENT_ORDER', 'Adjustment Order'),
    ('ADJUSTMENT', 'Adjustment'),
    ('RECEIPT_VOUCHER', 'Receipt Voucher'),
    ('PAYMENT_VOUCHER', 'Payment Voucher'),
    ('EXPENSE', 'Expense'),
    ('EMPLOYEE_DOC', 'Employee Document'),
    ('PRODUCT_IMAGE', 'Product Image'),
    ('PAYMENT_RECEIPT', 'Payment Receipt'),
    ('LOGO', 'Company Logo'),
    ('USER_ATTACHMENT', 'User Attachment'),
    ('MIGRATION', 'Migration Source File'),
    ('OTHER', 'Other'),
)

DEFAULT_ALLOWED_EXTENSIONS = [
    "pdf", "jpg", "jpeg", "png", "gif", "webp",
    "doc", "docx", "xls", "xlsx", "csv", "sql",
    "txt", "zip", "rar",
]


class StorageProvider(models.Model):
    """
    Cloud storage configuration — one per organization.
    If organization is null, this is the platform-wide default.
    """
    organization = models.OneToOneField(
        Organization, on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='storage_provider',
        help_text='Null = platform default provider'
    )
    provider_type = models.CharField(max_length=10, choices=PROVIDER_TYPES, default='R2')
    endpoint_url = models.URLField(
        max_length=500, blank=True, default='',
        help_text='S3-compatible endpoint, e.g. https://<account>.r2.cloudflarestorage.com'
    )
    bucket_name = models.CharField(max_length=200, default='tsf-files')
    access_key = models.CharField(max_length=200, blank=True, default='')
    secret_key = models.CharField(max_length=200, blank=True, default='')
    region = models.CharField(max_length=50, default='auto', help_text='Use "auto" for R2')
    path_prefix = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Auto-set to {org_slug}/ if blank'
    )
    is_active = models.BooleanField(default=True)
    max_file_size_mb = models.IntegerField(default=500, help_text='Maximum upload size in MB')
    allowed_extensions = models.JSONField(
        default=list, blank=True,
        help_text='Allowed file extensions, e.g. ["pdf","jpg","png"]'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'storage_provider'

    def __str__(self):
        org_label = self.organization.name if self.organization else 'PLATFORM DEFAULT'
        return f"{org_label} — {self.get_provider_type_display()}"

    def save(self, *args, **kwargs):
        # Auto-populate path_prefix from org slug
        if not self.path_prefix and self.organization:
            self.path_prefix = f"{self.organization.slug}/"
        # Default allowed extensions
        if not self.allowed_extensions:
            self.allowed_extensions = DEFAULT_ALLOWED_EXTENSIONS.copy()
        super().save(*args, **kwargs)

    @classmethod
    def get_for_organization(cls, organization):
        """Get the storage provider for an org, falling back to platform default."""
        provider = cls.objects.filter(organization=organization, is_active=True).first()
        if provider:
            return provider
        return cls.objects.filter(organization__isnull=True, is_active=True).first()


class StoredFile(TenantModel):
    """
    Metadata record for a file stored in cloud storage.
    The actual file lives in the configured R2/S3 bucket.
    """
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_filename = models.CharField(max_length=500)
    storage_key = models.CharField(
        max_length=1000,
        help_text='Full object key in the bucket, e.g. org-slug/invoices/2026/file.pdf'
    )
    bucket = models.CharField(max_length=200)
    content_type = models.CharField(max_length=200, default='application/octet-stream')
    file_size = models.BigIntegerField(default=0, help_text='File size in bytes')
    category = models.CharField(max_length=20, choices=FILE_CATEGORIES, default='ATTACHMENT')

    # Generic link to any model (e.g. finance.Invoice #42)
    linked_model = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Dotted model path, e.g. finance.Invoice'
    )
    linked_id = models.IntegerField(
        null=True, blank=True,
        help_text='Primary key of the linked record'
    )

    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_files'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_deleted = models.BooleanField(default=False, help_text='Soft delete flag')
    checksum = models.CharField(max_length=64, blank=True, default='', help_text='SHA-256 hash')

    class Meta:
        db_table = 'stored_file'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['linked_model', 'linked_id']),
        ]

    def __str__(self):
        return f"{self.original_filename} ({self.get_category_display()})"

    @property
    def file_size_display(self):
        """Human-readable file size."""
        size = self.file_size
        for unit in ('B', 'KB', 'MB', 'GB'):
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
# Import UploadSession here to ensure it's discovered by Django's model registry
from .upload_models import UploadSession
