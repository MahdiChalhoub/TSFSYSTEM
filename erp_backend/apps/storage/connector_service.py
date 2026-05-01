"""
Storage Connector Service
==========================
Declares all capabilities that the Storage module exposes to other modules.

Other modules call:
    connector.require('storage.files.get_model', org_id=X)
    connector.require('storage.files.get_serializer', org_id=X)

Auto-discovered by the CapabilityRegistry.
"""

import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by CapabilityRegistry during auto-discovery."""

    # ─── STORED FILES ────────────────────────────────────────────────

    @_cap(registry, 'storage.files.get_model',
          description='Get StoredFile model class',
          cacheable=False, critical=False)
    def get_stored_file_model(org_id=0, **kw):
        from apps.storage.models.storage_models import StoredFile
        return StoredFile

    @_cap(registry, 'storage.files.get_serializer',
          description='Get StoredFileSerializer class',
          cacheable=False, critical=False)
    def get_stored_file_serializer(org_id=0, **kw):
        from apps.storage.serializers.storage_serializers import StoredFileSerializer
        return StoredFileSerializer

    @_cap(registry, 'storage.providers.get_model',
          description='Get StorageProvider model class',
          cacheable=False, critical=False)
    def get_storage_provider_model(org_id=0, **kw):
        from apps.storage.models.storage_models import StorageProvider
        return StorageProvider


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
