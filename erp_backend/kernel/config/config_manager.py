"""
Config Manager

Core configuration management functions.
"""

from typing import Any, Optional
from django.core.cache import cache
from .models import TenantConfig, FeatureFlag, ConfigHistory
from kernel.tenancy.middleware import get_current_tenant
import logging

logger = logging.getLogger(__name__)


class ConfigManager:
    """
    Configuration Manager

    Provides caching and type-safe access to tenant configs.
    """

    CACHE_PREFIX = 'tenant_config'
    CACHE_TTL = 300  # 5 minutes

    @classmethod
    def _get_cache_key(cls, tenant_id: int, key: str) -> str:
        """Generate cache key."""
        return f"{cls.CACHE_PREFIX}:{tenant_id}:{key}"

    @classmethod
    def get(cls, key: str, default: Any = None, tenant=None) -> Any:
        """
        Get configuration value.

        Args:
            key: Config key
            default: Default value if not found
            tenant: Tenant (defaults to current tenant)

        Returns:
            Config value or default

        Example:
            tax_rate = ConfigManager.get('default_tax_rate', default=0.15)
        """
        if tenant is None:
            tenant = get_current_tenant()

        if not tenant:
            logger.warning("No tenant context, returning default value")
            return default

        # Try cache first
        cache_key = cls._get_cache_key(tenant.id, key)
        cached_value = cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        # Query database
        try:
            config = TenantConfig.objects.get(tenant=tenant, key=key)
            value = config.value

            # Cache the value
            cache.set(cache_key, value, cls.CACHE_TTL)

            return value

        except TenantConfig.DoesNotExist:
            return default

    @classmethod
    def set(
        cls,
        key: str,
        value: Any,
        value_type: str = 'string',
        description: str = '',
        is_system: bool = False,
        is_sensitive: bool = False,
        user=None,
        tenant=None
    ) -> TenantConfig:
        """
        Set configuration value.

        Args:
            key: Config key
            value: Config value
            value_type: Value type (string, number, boolean, json)
            description: Config description
            is_system: Is system config (cannot be deleted)
            is_sensitive: Is sensitive value
            user: User making the change
            tenant: Tenant (defaults to current tenant)

        Returns:
            TenantConfig instance

        Example:
            ConfigManager.set('invoice_prefix', 'INV-', value_type='string')
        """
        if tenant is None:
            tenant = get_current_tenant()

        if not tenant:
            raise ValueError("Cannot set config without tenant context")

        # Get existing config or create new
        config, created = TenantConfig.objects.get_or_create(
            tenant=tenant,
            key=key,
            defaults={
                'value': value,
                'value_type': value_type,
                'description': description,
                'is_system': is_system,
                'is_sensitive': is_sensitive,
                'created_by': user
            }
        )

        if not created:
            # Update existing config
            old_value = config.value

            config.value = value
            config.value_type = value_type
            config.description = description or config.description
            config.updated_by = user
            config.save()

            # Record history
            ConfigHistory.objects.create(
                tenant=tenant,
                config=config,
                old_value=old_value,
                new_value=value,
                changed_by=user
            )

        # Invalidate cache
        cache_key = cls._get_cache_key(tenant.id, key)
        cache.delete(cache_key)

        logger.info(f"Config set: {key} = {value} (tenant: {tenant.slug})")

        return config

    @classmethod
    def delete(cls, key: str, tenant=None):
        """
        Delete configuration value.

        Args:
            key: Config key
            tenant: Tenant (defaults to current tenant)
        """
        if tenant is None:
            tenant = get_current_tenant()

        if not tenant:
            raise ValueError("Cannot delete config without tenant context")

        try:
            config = TenantConfig.objects.get(tenant=tenant, key=key)

            if config.is_system:
                raise ValueError(f"Cannot delete system config: {key}")

            config.delete()

            # Invalidate cache
            cache_key = cls._get_cache_key(tenant.id, key)
            cache.delete(cache_key)

            logger.info(f"Config deleted: {key} (tenant: {tenant.slug})")

        except TenantConfig.DoesNotExist:
            logger.warning(f"Config not found: {key}")


# Module-level convenience functions

def get_config(key: str, default: Any = None, tenant=None) -> Any:
    """
    Get configuration value.

    Convenience wrapper for ConfigManager.get()

    Example:
        from kernel.config import get_config

        tax_rate = get_config('default_tax_rate', default=0.15)
    """
    return ConfigManager.get(key, default, tenant)


def set_config(
    key: str,
    value: Any,
    value_type: str = 'string',
    description: str = '',
    user=None,
    tenant=None
) -> TenantConfig:
    """
    Set configuration value.

    Convenience wrapper for ConfigManager.set()

    Example:
        from kernel.config import set_config

        set_config('invoice_prefix', 'INV-', value_type='string')
    """
    return ConfigManager.set(key, value, value_type, description, user=user, tenant=tenant)


def is_feature_enabled(feature_key: str, user=None, tenant=None) -> bool:
    """
    Check if feature flag is enabled.

    Args:
        feature_key: Feature flag key
        user: User (for user-specific targeting)
        tenant: Tenant (defaults to current tenant)

    Returns:
        bool

    Example:
        from kernel.config import is_feature_enabled

        if is_feature_enabled('new_invoice_ui', user=request.user):
            # Use new UI
            pass
    """
    if tenant is None:
        tenant = get_current_tenant()

    if not tenant:
        logger.warning("No tenant context, feature disabled by default")
        return False

    try:
        flag = FeatureFlag.objects.get(tenant=tenant, key=feature_key)

        if user:
            return flag.is_enabled_for_user(user)
        else:
            return flag.is_active()

    except FeatureFlag.DoesNotExist:
        # Feature flag not found = disabled by default
        return False


def enable_feature(
    feature_key: str,
    rollout_percentage: int = 100,
    tenant=None
) -> FeatureFlag:
    """
    Enable a feature flag.

    Args:
        feature_key: Feature flag key
        rollout_percentage: Rollout percentage (0-100)
        tenant: Tenant (defaults to current tenant)

    Returns:
        FeatureFlag instance

    Example:
        from kernel.config import enable_feature

        # Enable for 50% of users
        enable_feature('new_invoice_ui', rollout_percentage=50)
    """
    if tenant is None:
        tenant = get_current_tenant()

    if not tenant:
        raise ValueError("Cannot enable feature without tenant context")

    flag, _ = FeatureFlag.objects.update_or_create(
        tenant=tenant,
        key=feature_key,
        defaults={
            'is_enabled': True,
            'rollout_percentage': rollout_percentage
        }
    )

    logger.info(f"Feature enabled: {feature_key} ({rollout_percentage}%) (tenant: {tenant.slug})")

    return flag


def disable_feature(feature_key: str, tenant=None) -> FeatureFlag:
    """
    Disable a feature flag.

    Args:
        feature_key: Feature flag key
        tenant: Tenant (defaults to current tenant)

    Returns:
        FeatureFlag instance

    Example:
        from kernel.config import disable_feature

        disable_feature('new_invoice_ui')
    """
    if tenant is None:
        tenant = get_current_tenant()

    if not tenant:
        raise ValueError("Cannot disable feature without tenant context")

    flag, _ = FeatureFlag.objects.update_or_create(
        tenant=tenant,
        key=feature_key,
        defaults={'is_enabled': False}
    )

    logger.info(f"Feature disabled: {feature_key} (tenant: {tenant.slug})")

    return flag
