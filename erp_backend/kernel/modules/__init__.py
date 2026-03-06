"""
Module Loader — per-tenant module registration and enabling/disabling.

Import guide:
    from kernel.modules import ModuleLoader, is_module_enabled
    from kernel.modules.models import KernelModule, OrgModule  # if model access needed
"""

# NOTE: KernelModule/OrgModule/ModuleMigration are concrete models — NOT imported here.
# Import from kernel.modules.models directly to avoid AppRegistryNotReady.

from .loader import ModuleLoader, is_module_enabled, get_enabled_modules  # noqa: F401
from .manifest import ModuleManifest, parse_manifest  # noqa: F401

__all__ = [
    'ModuleLoader',
    'is_module_enabled',
    'get_enabled_modules',
    'ModuleManifest',
    'parse_manifest',
]
