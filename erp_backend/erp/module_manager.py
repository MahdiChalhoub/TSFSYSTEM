import os
import json
from django.conf import settings
from .models import Module, OrganizationModule, Organization
from django.core.exceptions import ValidationError

class ModuleManager:
    MODULES_DIR = os.path.join(settings.BASE_DIR, 'erp', 'modules')

    @staticmethod
    def discover():
        """
        Scans the modules directory for manifest.json files.
        """
        discovered = []
        if not os.path.exists(ModuleManager.MODULES_DIR):
            os.makedirs(ModuleManager.MODULES_DIR)
            
        for module_dir in os.listdir(ModuleManager.MODULES_DIR):
            manifest_path = os.path.join(ModuleManager.MODULES_DIR, module_dir, 'manifest.json')
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path, 'r') as f:
                        manifest = json.load(f)
                        discovered.append(manifest)
                except Exception as e:
                    print(f"Error loading manifest for {module_dir}: {str(e)}")
        return discovered

    @staticmethod
    def sync():
        """
        Syncs discovered modules with the global Module table.
        """
        manifests = ModuleManager.discover()
        synced_codes = []
        
        for manifest in manifests:
            code = manifest.get('code')
            name = manifest.get('name')
            version = manifest.get('version', '1.0.0')
            description = manifest.get('description', '')
            dependencies = manifest.get('dependencies', [])
            is_core = manifest.get('required', False)

            Module.objects.update_or_create(
                code=code,
                defaults={
                    'name': name,
                    'version': version,
                    'description': description,
                    'dependencies': dependencies,
                    'is_core': is_core
                }
            )
            synced_codes.append(code)
            
        return synced_codes

    @staticmethod
    def install(module_code, organization_id):
        """
        Installs/Enables a module for an organization.
        """
        module = Module.objects.get(code=module_code)
        
        # Check dependencies
        for dep_code in module.dependencies:
            dep_enabled = OrganizationModule.objects.filter(
                organization_id=organization_id,
                module__code=dep_code,
                status='INSTALLED'
            ).exists()
            if not dep_enabled:
                raise ValidationError(f"Dependency missing: {dep_code} must be installed first.")

        org_module, created = OrganizationModule.objects.update_or_create(
            organization_id=organization_id,
            module=module,
            defaults={'status': 'INSTALLED'}
        )
        return org_module

    @staticmethod
    def disable(module_code, organization_id):
        """
        Soft-disables a module for an organization.
        """
        module = Module.objects.get(code=module_code)
        
        if module.is_core:
            raise ValidationError("Core modules cannot be disabled.")

        # Check if other installed modules depend on this one
        dependents = Module.objects.filter(dependencies__contains=module_code)
        for dep_module in dependents:
            is_installed = OrganizationModule.objects.filter(
                organization_id=organization_id,
                module=dep_module,
                status='INSTALLED'
            ).exists()
            if is_installed:
                raise ValidationError(f"Cannot disable: Module '{dep_module.name}' depends on this module.")

        OrganizationModule.objects.filter(
            organization_id=organization_id,
            module=module
        ).update(status='DISABLED')
        
        return True

    @staticmethod
    def is_enabled(module_code, organization_id):
        """
        Checks if a module is enabled for an organization.
        Core modules are always enabled if they exist in the registry.
        """
        # If it's a core module, we just need to know it's registered
        module = Module.objects.filter(code=module_code).first()
        if not module:
            return False
            
        if module.is_core:
            return True
            
        return OrganizationModule.objects.filter(
            organization_id=organization_id,
            module=module,
            status='INSTALLED'
        ).exists()

    @staticmethod
    def install_for_all(module_code):
        """
        Enables a module for all organizations in the system.
        """
        module = Module.objects.get(code=module_code)
        orgs = Organization.objects.all()
        
        installed_count = 0
        for org in orgs:
            try:
                OrganizationModule.objects.update_or_create(
                    organization=org,
                    module=module,
                    defaults={'status': 'INSTALLED'}
                )
                installed_count += 1
            except Exception as e:
                print(f"Failed to install for org {org.slug}: {str(e)}")
        
        return installed_count
