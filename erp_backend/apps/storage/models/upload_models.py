"""
Storage Module — upload_session.py
Chunked/resumable upload session model.
"""
import uuid
import os
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from erp.models import Organization


class UploadSession(models.Model):
    """Tracks a chunked upload session for resume support.

    Two upload modes:
    - `upload_type='file'` — tenant-scoped: organization is REQUIRED. Used for
      org-owned attachments, linked-model files, etc. Access is filtered by
      organization in the views.
    - `upload_type='package'` — system-level: organization MUST be NULL. Used
      for SaaS-platform package uploads (kernel/frontend/module). Access is
      restricted to superusers in the views.

    The type↔org invariant is enforced at three layers:
    1. Model `clean()` — surfaces invariant violations on save() in code paths
       that call full_clean().
    2. DB-level CheckConstraint — last line of defense against bypassed clean.
    3. View-layer queryset filtering — the actual tenant isolation boundary
       (a non-superuser user never sees another tenant's file sessions, and
       can never reach package sessions at all).

    This pattern was chosen over splitting into two separate models because:
    (a) the upload pipeline (chunked init/chunk/status/complete/abort) is
    identical for both modes — only the finalize step branches; (b) splitting
    would require a data backfill migration and refactoring 6 query sites to
    dispatch by type. The hybrid approach gets the same security guarantees
    with a single check constraint + view-layer filtering.
    """
    STATUS_CHOICES = (
        ('uploading', 'Uploading'),
        ('complete', 'Complete'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    filename = models.CharField(max_length=500)
    content_type = models.CharField(max_length=200, default='application/octet-stream')
    total_size = models.BigIntegerField(help_text='Expected total file size in bytes')
    bytes_received = models.BigIntegerField(default=0)
    chunk_count = models.IntegerField(default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='uploading')
    checksum_expected = models.CharField(
        max_length=64, blank=True, default='',
        help_text='Client-provided SHA-256 for final verification'
    )

    # Where chunks are being assembled
    temp_path = models.CharField(max_length=1000, blank=True, default='')

    # Context: what is being uploaded (file or package)
    upload_type = models.CharField(
        max_length=20, default='file',
        choices=(('file', 'Organization File'), ('package', 'System Package')),
    )
    # For file uploads
    category = models.CharField(max_length=20, default='ATTACHMENT')
    linked_model = models.CharField(max_length=100, blank=True, default='')
    linked_id = models.CharField(max_length=100, null=True, blank=True, help_text='ID of the linked model (UUID as string or Int)')
    # For package uploads
    package_type = models.CharField(max_length=20, blank=True, default='')

    # Ownership
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        null=True, blank=True, related_name='upload_sessions',
    db_column='tenant_id',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='upload_sessions',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(
        help_text='Session expires after this time (default 24h)'
    )

    class Meta:
        db_table = 'upload_session'
        ordering = ['-created_at']
        constraints = [
            # File uploads MUST have an organization; package uploads MUST NOT.
            # See class docstring for rationale.
            models.CheckConstraint(
                condition=(
                    models.Q(upload_type='file', organization__isnull=False)
                    | models.Q(upload_type='package', organization__isnull=True)
                ),
                name='upload_session_type_org_invariant',
            ),
        ]

    def __str__(self):
        pct = int((self.bytes_received / self.total_size) * 100) if self.total_size else 0
        return f"{self.filename} ({pct}% — {self.status})"

    def clean(self):
        """Enforce the type↔org invariant at the application layer.

        Code paths that call full_clean() get a ValidationError before save;
        paths that bypass clean still hit the DB CheckConstraint above.
        """
        super().clean()
        if self.upload_type == 'file' and self.organization_id is None:
            raise ValidationError(
                {'organization': "File uploads require an organization."}
            )
        if self.upload_type == 'package' and self.organization_id is not None:
            raise ValidationError(
                {'organization': "Package uploads must not have an organization (system-level)."}
            )

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        if not self.temp_path:
            upload_tmp = os.path.join(settings.BASE_DIR, 'tmp', 'chunked_uploads')
            os.makedirs(upload_tmp, exist_ok=True)
            self.temp_path = os.path.join(upload_tmp, f"{self.id}.part")
        super().save(*args, **kwargs)

    @property
    def progress(self):
        """Upload progress as 0-100 integer."""
        if self.total_size <= 0:
            return 0
        return min(100, int((self.bytes_received / self.total_size) * 100))

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_complete(self):
        return self.bytes_received >= self.total_size
