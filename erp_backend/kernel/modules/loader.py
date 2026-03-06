"""
Module Loader

Manages module registration, installation, and enablement.
"""

from typing import List, Optional, Dict, Any
from django.db import transaction
from django.utils import timezone
from .models import KernelModule, OrgModule, ModuleMigration, ModuleState, ModuleDependency
from .manifest import parse_manifest, ModuleManifest
from kernel.tenancy.middleware import get_current_tenant
import os
import logging

logger = logging.getLogger(__name__)


class ModuleLoader:
    """
    Module Loader - manages module lifecycle.

    Responsibilities:
    - Register modules from manifest files
    - Install modules for tenants
    - Enable/disable modules
    - Dependency resolution
    - Version management
    """

    @classmethod
    def register_from_file(cls, manifest_path: str) -> KernelModule:
        """
        Register a module from its module.json file.

        Args:
            manifest_path: Path to module.json file

        Returns:
            KernelModule instance

        Example:
            module = ModuleLoader.register_from_file('apps/inventory/module.json')
        """
        # Parse manifest
        manifest = parse_manifest(manifest_path)

        # Get module path (directory containing module.json)
        module_path = os.path.dirname(manifest_path)

        return cls.register_from_manifest(manifest, module_path)

    @classmethod
    def register_from_manifest(cls, manifest: ModuleManifest, module_path: str) -> KernelModule:
        """
        Register a module from a parsed manifest.

        Args:
            manifest: Parsed ModuleManifest
            module_path: Path to module directory

        Returns:
            KernelModule instance
        """
        # Create or update module
        module, created = KernelModule.objects.update_or_create(
            name=manifest.name,
            defaults={
                'display_name': manifest.display_name,
                'version': manifest.version,
                'description': manifest.description,
                'author': manifest.author,
                'license': manifest.license,
                'manifest': manifest.to_dict(),
                'depends_on': manifest.depends_on,
                'module_path': module_path,
                'category': manifest.category,
            }
        )

        if created:
            logger.info(f"Module registered: {manifest.name} v{manifest.version}")
        else:
            logger.info(f"Module updated: {manifest.name} v{manifest.version}")

        # Register dependencies
        cls._register_dependencies(module, manifest.depends_on)

        return module

    @classmethod
    def _register_dependencies(cls, module: KernelModule, depends_on: List[str]):
        """Register module dependencies."""
        # Clear existing dependencies
        ModuleDependency.objects.filter(module=module).delete()

        # Create new dependencies
        for dep_name in depends_on:
            try:
                dep_module = KernelModule.objects.get(name=dep_name)
                ModuleDependency.objects.create(
                    module=module,
                    depends_on=dep_module,
                    is_required=True
                )
            except KernelModule.DoesNotExist:
                logger.warning(f"Dependency not found: {dep_name} (required by {module.name})")

    @classmethod
    @transaction.atomic
    def install_for_tenant(
        cls,
        tenant,
        module_name: str,
        user=None,
        auto_enable: bool = True
    ) -> OrgModule:
        """
        Install module for a tenant.

        Steps:
        1. Check if module exists
        2. Check dependencies
        3. Create OrgModule record
        4. Run migrations (future)
        5. Register permissions (future)
        6. Enable if auto_enable=True

        Args:
            tenant: Tenant instance
            module_name: Module name
            user: User performing installation
            auto_enable: Auto-enable after installation

        Returns:
            OrgModule instance

        Example:
            org_module = ModuleLoader.install_for_tenant(
                tenant=tenant,
                module_name='inventory',
                user=request.user
            )
        """
        # Get module
        try:
            module = KernelModule.objects.get(name=module_name)
        except KernelModule.DoesNotExist:
            raise ValueError(f"Module not found: {module_name}")

        # Check if already installed
        org_module = OrgModule.objects.filter(
            tenant=tenant,
            module=module
        ).first()

        if org_module:
            if org_module.status == ModuleState.ENABLED:
                logger.info(f"Module already enabled: {module_name} for {tenant.name}")
                return org_module
            elif org_module.status == ModuleState.DISABLED:
                # Re-enable
                org_module.enable(user=user)
                logger.info(f"Module re-enabled: {module_name} for {tenant.name}")
                return org_module

        # Check dependencies
        missing_deps = cls._check_dependencies(tenant, module)
        if missing_deps:
            raise ValueError(
                f"Missing dependencies for {module_name}: {', '.join(missing_deps)}"
            )

        # Create OrgModule
        org_module = OrgModule.objects.create(
            tenant=tenant,
            module=module,
            status=ModuleState.INSTALLED,
            installed_version=module.version,
            installed_at=timezone.now(),
            installed_by=user
        )

        logger.info(f"Module installed: {module_name} v{module.version} for {tenant.name}")

        # Auto-enable
        if auto_enable:
            org_module.enable(user=user)
            logger.info(f"Module auto-enabled: {module_name} for {tenant.name}")

        return org_module

    @classmethod
    def _check_dependencies(cls, tenant, module: KernelModule) -> List[str]:
        """
        Check if all dependencies are met.

        Returns:
            List of missing dependency names
        """
        missing = []

        for dep_name in module.depends_on:
            # Check if dependency module exists
            try:
                dep_module = KernelModule.objects.get(name=dep_name)

                # Check if dependency is enabled for this tenant
                dep_org_module = OrgModule.objects.filter(
                    tenant=tenant,
                    module=dep_module,
                    status=ModuleState.ENABLED
                ).first()

                if not dep_org_module:
                    missing.append(dep_name)

            except KernelModule.DoesNotExist:
                missing.append(dep_name)

        return missing

    @classmethod
    def enable_for_tenant(cls, tenant, module_name: str, user=None) -> OrgModule:
        """
        Enable module for tenant.

        Args:
            tenant: Tenant instance
            module_name: Module name
            user: User performing action

        Returns:
            OrgModule instance

        Example:
            ModuleLoader.enable_for_tenant(tenant, 'inventory')
        """
        try:
            module = KernelModule.objects.get(name=module_name)
        except KernelModule.DoesNotExist:
            raise ValueError(f"Module not found: {module_name}")

        # Get or install module
        org_module = OrgModule.objects.filter(
            tenant=tenant,
            module=module
        ).first()

        if not org_module:
            # Install first
            return cls.install_for_tenant(tenant, module_name, user, auto_enable=True)

        # Enable
        org_module.enable(user=user)
        logger.info(f"Module enabled: {module_name} for {tenant.name}")

        return org_module

    @classmethod
    def disable_for_tenant(cls, tenant, module_name: str, user=None):
        """
        Disable module for tenant (soft delete).

        Args:
            tenant: Tenant instance
            module_name: Module name
            user: User performing action

        Example:
            ModuleLoader.disable_for_tenant(tenant, 'inventory')
        """
        try:
            module = KernelModule.objects.get(name=module_name)
        except KernelModule.DoesNotExist:
            raise ValueError(f"Module not found: {module_name}")

        # Check if system module
        if module.is_system_module:
            raise ValueError(f"Cannot disable system module: {module_name}")

        org_module = OrgModule.objects.filter(
            tenant=tenant,
            module=module
        ).first()

        if not org_module:
            logger.warning(f"Module not installed: {module_name} for {tenant.name}")
            return

        org_module.disable(user=user)
        logger.info(f"Module disabled: {module_name} for {tenant.name}")

    @classmethod
    def get_enabled_modules(cls, tenant) -> List[KernelModule]:
        """
        Get all enabled modules for tenant.

        Args:
            tenant: Tenant instance

        Returns:
            List of KernelModule instances

        Example:
            modules = ModuleLoader.get_enabled_modules(tenant)
            for module in modules:
                print(module.name, module.version)
        """
        org_modules = OrgModule.objects.filter(
            tenant=tenant,
            status=ModuleState.ENABLED
        ).select_related('module')

        return [org_module.module for org_module in org_modules]

    @classmethod
    def is_module_enabled(cls, tenant, module_name: str) -> bool:
        """
        Check if module is enabled for tenant.

        Args:
            tenant: Tenant instance
            module_name: Module name

        Returns:
            bool

        Example:
            if ModuleLoader.is_module_enabled(tenant, 'inventory'):
                # Module is enabled
                pass
        """
        try:
            module = KernelModule.objects.get(name=module_name)
            org_module = OrgModule.objects.filter(
                tenant=tenant,
                module=module,
                status=ModuleState.ENABLED
            ).exists()

            return org_module

        except KernelModule.DoesNotExist:
            return False

    @classmethod
    def get_module_config(cls, tenant, module_name: str) -> Dict[str, Any]:
        """
        Get module configuration for tenant.

        Args:
            tenant: Tenant instance
            module_name: Module name

        Returns:
            Configuration dict

        Example:
            config = ModuleLoader.get_module_config(tenant, 'inventory')
            allow_negative = config.get('allow_negative_stock', False)
        """
        try:
            module = KernelModule.objects.get(name=module_name)
            org_module = OrgModule.objects.get(
                tenant=tenant,
                module=module
            )
            return org_module.config

        except (KernelModule.DoesNotExist, OrgModule.DoesNotExist):
            return {}

    @classmethod
    def set_module_config(
        cls,
        tenant,
        module_name: str,
        config: Dict[str, Any]
    ):
        """
        Set module configuration for tenant.

        Args:
            tenant: Tenant instance
            module_name: Module name
            config: Configuration dict

        Example:
            ModuleLoader.set_module_config(
                tenant,
                'inventory',
                {'allow_negative_stock': True}
            )
        """
        try:
            module = KernelModule.objects.get(name=module_name)
            org_module = OrgModule.objects.get(
                tenant=tenant,
                module=module
            )

            # Validate config against schema (future enhancement)
            # For now, just save it
            org_module.config = config
            org_module.save()

            logger.info(f"Module config updated: {module_name} for {tenant.name}")

        except (KernelModule.DoesNotExist, OrgModule.DoesNotExist):
            raise ValueError(f"Module not found or not installed: {module_name}")


# Module-level convenience functions

def is_module_enabled(tenant, module_name: str) -> bool:
    """
    Check if module is enabled (convenience wrapper).

    Example:
        from kernel.modules import is_module_enabled

        if is_module_enabled(request.tenant, 'inventory'):
            # Show inventory features
            pass
    """
    if tenant is None:
        tenant = get_current_tenant()

    if not tenant:
        return False

    return ModuleLoader.is_module_enabled(tenant, module_name)


def get_enabled_modules(tenant=None) -> List[KernelModule]:
    """
    Get enabled modules (convenience wrapper).

    Example:
        from kernel.modules import get_enabled_modules

        modules = get_enabled_modules(request.tenant)
        module_names = [m.name for m in modules]
    """
    if tenant is None:
        tenant = get_current_tenant()

    if not tenant:
        return []

    return ModuleLoader.get_enabled_modules(tenant)
