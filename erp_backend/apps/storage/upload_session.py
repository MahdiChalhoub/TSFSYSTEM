"""
Storage Module — upload_session.py
Chunked/resumable upload session model.
"""
import uuid
import os
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from erp.models import Organization


class UploadSession(models.Model):
    """
    Tracks a chunked upload session for resume support.
    Large files are uploaded in chunks; if interrupted, the client
    can query the session to find out how many bytes were received
    and resume from that point.
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
        null=True, blank=True, related_name='upload_sessions'
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

    def __str__(self):
        pct = int((self.bytes_received / self.total_size) * 100) if self.total_size else 0
        return f"{self.filename} ({pct}% — {self.status})"

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
