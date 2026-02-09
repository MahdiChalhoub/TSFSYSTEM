"""
Package Storage Center - Models
"""
import uuid
from django.db import models
from django.conf import settings


class PackageUpload(models.Model):
    """
    Tracks uploaded packages (kernel, frontend, module) for deployment.
    Supports chunked uploads, progress tracking, and scheduled deployment.
    """
    PACKAGE_TYPES = (
        ('kernel', 'Backend Kernel'),
        ('frontend', 'Frontend Kernel'),
        ('module', 'Module'),
    )
    STATUS_CHOICES = (
        ('uploading', 'Uploading'),
        ('ready', 'Ready'),
        ('scheduled', 'Scheduled'),
        ('applying', 'Applying'),
        ('applied', 'Applied'),
        ('failed', 'Failed'),
        ('rolled_back', 'Rolled Back'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    package_type = models.CharField(max_length=20, choices=PACKAGE_TYPES)
    name = models.CharField(max_length=100)
    version = models.CharField(max_length=50)
    
    # File storage
    file = models.FileField(upload_to='packages/', null=True, blank=True)
    file_size = models.BigIntegerField(default=0)
    upload_progress = models.IntegerField(default=0)  # 0-100%
    checksum = models.CharField(max_length=64, null=True, blank=True)  # SHA-256
    
    # Status and metadata
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='uploading')
    changelog = models.TextField(blank=True)
    error_message = models.TextField(null=True, blank=True)
    
    # Deployment tracking
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='pkg_uploaded_packages'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    applied_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='pkg_applied_packages'
    )
    
    # Package manifest
    manifest = models.JSONField(default=dict, blank=True)
    
    # Backup reference for rollback
    backup_path = models.CharField(max_length=500, null=True, blank=True)
    
    class Meta:
        db_table = 'packageupload'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.name} v{self.version} ({self.get_package_type_display()})"
