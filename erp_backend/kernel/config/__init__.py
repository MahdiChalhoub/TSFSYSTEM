"""
Config Engine — organization-specific configuration and feature flags.

Import guide:
    from kernel.config import get_config, is_feature_enabled, set_config
    from kernel.config.models import TenantConfig, FeatureFlag  # if model access needed
"""

# NOTE: TenantConfig/FeatureFlag are concrete models — NOT imported here.
# Import from kernel.config.models directly to avoid AppRegistryNotReady.

from .config_manager import (  # noqa: F401
    get_config,
    set_config,
    is_feature_enabled,
    enable_feature,
    disable_feature,
    ConfigManager,
)
from .decorators import require_feature  # noqa: F401

__all__ = [
    'get_config',
    'set_config',
    'is_feature_enabled',
    'enable_feature',
    'disable_feature',
    'ConfigManager',
    'require_feature',
]
