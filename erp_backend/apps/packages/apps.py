"""
Package Storage Center - Django App Configuration
"""
from django.apps import AppConfig


class PackagesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.packages'
    verbose_name = 'Package Storage Center'

    def ready(self):
        # Register model connector if needed
        try:
            from erp.connectors import ModelRegistry
            from .models import PackageUpload
            ModelRegistry.register('packages.PackageUpload', PackageUpload)
        except ImportError:
            pass
