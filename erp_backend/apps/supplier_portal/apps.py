"""Supplier Portal — App Configuration"""
from django.apps import AppConfig


class SupplierPortalConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.supplier_portal'
    verbose_name = 'Supplier Portal'

    def ready(self):
        import apps.supplier_portal.signals  # noqa: F401
