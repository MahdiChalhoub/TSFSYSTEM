import os
import json
import zipfile
import shutil
import hashlib
from django.conf import settings
from django.db import transaction
from django.core.management import call_command
from .models import SystemModule, SystemModuleLog, OrganizationModule, Organization, User
from django.core.exceptions import ValidationError

class ModuleManager:
    MODULES_DIR = os.path.join(settings.BASE_DIR, 'apps') # New standard
    LEGACY_MODULES_DIR = os.path.join(settings.BASE_DIR, 'erp', 'modules')
    LOCK_FILE = os.path.join(settings.BASE_DIR, 'tmp', 'module_operation.lock')

    @staticmethod
    def acquire_lock():
        if os.path.exists(ModuleManager.LOCK_FILE):
            raise ValidationError("Another module operation is in progress. Please wait.")
        os.makedirs(os.path.dirname(ModuleManager.LOCK_FILE), exist_ok=True)
        with open(ModuleManager.LOCK_FILE, 'w') as f:
            f.write("LOCKED")

    @staticmethod
    def release_lock():
        if os.path.exists(ModuleManager.LOCK_FILE):
            os.remove(ModuleManager.LOCK_FILE)

    @staticmethod
    def get_checksum(file_path):
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    @staticmethod
    def validate_manifest(manifest):
        required_keys = ['name', 'version', 'code']
        for key in required_keys:
            if key not in manifest:
                raise ValidationError(f"Manifest missing required key: {key}")
        return True

    @staticmethod
    def discover():
        """
        Scans apps/ and erp/modules/ for manifest.json files.
        """
        discovered = []
        search_paths = [ModuleManager.MODULES_DIR, ModuleManager.LEGACY_MODULES_DIR]
        
        for base_path in search_paths:
            if not os.path.exists(base_path):
                continue
                
            for module_dir in os.listdir(base_path):
                path = os.path.join(base_path, module_dir)
                if not os.path.isdir(path):
                    continue
                    
                manifest_path = os.path.join(path, 'manifest.json')
                if os.path.exists(manifest_path):
                    try:
                        with open(manifest_path, 'r') as f:
                            manifest = json.load(f)
                            manifest['_path'] = path
                            discovered.append(manifest)
                    except Exception as e:
                        print(f"Error loading manifest for {module_dir}: {str(e)}")
        return discovered

    @staticmethod
    def check_dependencies(manifest):
        """
        Verifies that all required modules are installed and meet version requirements.
        """
        requires = manifest.get('requires', {})
        for req_name, version_req in requires.items():
            try:
                # Use name from manifest
                installed_mod = SystemModule.objects.get(name=req_name)
                # Simple version check for now
                if installed_mod.version < version_req.replace('>=', ''):
                    raise ValidationError(f"Dependency {req_name} version {installed_mod.version} is incompatible. Required: {version_req}")
            except SystemModule.DoesNotExist:
                raise ValidationError(f"Missing dependency: {req_name} (Required: {version_req})")

    @staticmethod
    def sync():
        """
        Syncs local filesystem modules with SystemModule registry.
        This is used for local development or initial deployment.
        """
        manifests = ModuleManager.discover()
        synced_names = []
        
        for manifest in manifests:
            name = manifest.get('code') # Use code as identifier consistently
            display_name = manifest.get('name')
            version = manifest.get('version')
            
            SystemModule.objects.update_or_create(
                name=name,
                defaults={
                    'version': version,
                    'status': 'INSTALLED',
                    'manifest': manifest,
                    'checksum': 'LOCAL_DEV' # Development bypass
                }
            )
            synced_names.append(name)
            
        return synced_names

    @staticmethod
    @transaction.atomic
    def upgrade(module_name, package_path, user=None):
        """
        Safely upgrades a module from a .modpkg.zip file.
        """
        ModuleManager.acquire_lock()
        try:
            print(f"🚀 Starting upgrade for {module_name}...")
            
            # 1. Validation
            if not zipfile.is_zipfile(package_path):
                raise ValidationError("Invalid module package: Not a ZIP file.")
                
            checksum = ModuleManager.get_checksum(package_path)
            
            # Extract to temporary location to read manifest
            temp_extract = os.path.join(settings.BASE_DIR, 'tmp', f"upgrade_{module_name}")
            if os.path.exists(temp_extract):
                shutil.rmtree(temp_extract)
            
            with zipfile.ZipFile(package_path, 'r') as zip_ref:
                zip_ref.extractall(temp_extract)
                
            # ZIP should contain a folder named after the module code/name
            # Or files directly. We expect a folder to be neat.
            source_inner_dir = os.path.join(temp_extract, module_name)
            if not os.path.exists(source_inner_dir):
                 # Fallback: check if manifest is in root of zip
                 if os.path.exists(os.path.join(temp_extract, 'manifest.json')):
                      source_inner_dir = temp_extract
                 else:
                      raise ValidationError("Invalid package structure: module folder not found.")

            manifest_path = os.path.join(source_inner_dir, 'manifest.json')
            if not os.path.exists(manifest_path):
                raise ValidationError("Invalid module package: manifest.json missing.")
                
            with open(manifest_path, 'r') as f:
                new_manifest = json.load(f)
                
            # 2. Compatibility Checks
            ModuleManager.validate_manifest(new_manifest)
            
            old_module = SystemModule.objects.filter(name=module_name).first()
            old_version = old_module.version if old_module else "0.0.0"
            new_version = new_manifest.get('version')
            
            if new_version <= old_version:
                raise ValidationError(f"Downgrade blocked: Current {old_version} >= New {new_version}")
                
            ModuleManager.check_dependencies(new_manifest)
            
            # 3. Execution
            # Set state to UPGRADING
            if old_module:
                old_module.status = 'UPGRADING'
                old_module.save()
            
            # Copy files to apps/ (The live zone)
            target_path = os.path.join(ModuleManager.MODULES_DIR, module_name)
            
            # Create backup
            backup_path = os.path.join(settings.BASE_DIR, 'backups', f"{module_name}_{old_version}")
            if os.path.exists(target_path):
                if not os.path.exists(os.path.dirname(backup_path)): os.makedirs(os.path.dirname(backup_path))
                shutil.copytree(target_path, backup_path, dirs_exist_ok=True)

            shutil.copytree(source_inner_dir, target_path, dirs_exist_ok=True)
            
            # Run Migrations
            print(f"⚙️ Applying migrations for {module_name}...")
            call_command('migrate', no_input=True)
            
            # Update Registry
            SystemModule.objects.update_or_create(
                name=module_name,
                defaults={
                    'version': new_version,
                    'status': 'INSTALLED',
                    'manifest': new_manifest,
                    'checksum': checksum
                }
            )
            
            # Log Success
            SystemModuleLog.objects.create(
                module_name=module_name,
                from_version=old_version,
                to_version=new_version,
                action='UPGRADE' if old_module else 'INSTALL',
                status='SUCCESS',
                logs="Upgrade completed successfully.",
                performed_by=user
            )
            
            print(f"✅ Module {module_name} upgraded to {new_version}")
            
        except Exception as e:
            # Failure Handling
            print(f"❌ Upgrade failed: {str(e)}")
            if old_module:
                old_module.status = 'FAILED'
                old_module.save()
                
            SystemModuleLog.objects.create(
                module_name=module_name,
                from_version=old_version if 'old_version' in locals() else "N/A",
                to_version=new_version if 'new_version' in locals() else "N/A",
                action='UPGRADE',
                status='FAILURE',
                logs=str(e),
                performed_by=user
            )
            raise e
        finally:
            ModuleManager.release_lock()
            if 'temp_extract' in locals() and os.path.exists(temp_extract):
                shutil.rmtree(temp_extract)

    @staticmethod
    def is_enabled(module_name, organization_id):
        """
        Checks if a module is enabled for an organization.
        Core modules (if defined in manifest as required) are always enabled.
        """
        # Core Platform is ALWAYS enabled if it exists
        if module_name == 'core':
             return SystemModule.objects.filter(name='core', status='INSTALLED').exists()

        # 1. System-wide check
        try:
            mod = SystemModule.objects.get(name=module_name)
            if mod.status != 'INSTALLED':
                return False
            
            # If manifest says it's required, it's globally enabled
            if mod.manifest.get('required', False):
                return True
        except SystemModule.DoesNotExist:
            return False
            
        # 2. Org-specific check
        return OrganizationModule.objects.filter(
            organization_id=organization_id,
            module_name=module_name,
            is_enabled=True
        ).exists()

    @staticmethod
    def grant_access(module_name, organization_id):
        """
        Enables a module for a tenant.
        """
        # Ensure it exists system-wide first
        if not SystemModule.objects.filter(name=module_name, status='INSTALLED').exists():
            raise ValidationError(f"Module {module_name} is not installed on this system.")
            
        OrganizationModule.objects.update_or_create(
            organization_id=organization_id,
            module_name=module_name,
            defaults={'is_enabled': True}
        )
        return True

    @staticmethod
    def install_for_all(module_name):
        """
        Grants access to a specific module for all organizations.
        """
        if not SystemModule.objects.filter(name=module_name, status='INSTALLED').exists():
             raise ValidationError(f"Module {module_name} is not installed system-wide.")
             
        orgs = Organization.objects.all()
        count = 0
        for org in orgs:
            OrganizationModule.objects.update_or_create(
                organization=org,
                module_name=module_name,
                defaults={'is_enabled': True}
            )
            count += 1
        return count

    @staticmethod
    def revoke_all(module_name):
        """
        Revokes access to a specific module from all organizations.
        """
        if module_name == 'core':
            raise ValidationError("Cannot revoke access to Core module.")
            
        return OrganizationModule.objects.filter(module_name=module_name).update(is_enabled=False)

    @staticmethod
    @transaction.atomic
    def delete(module_name):
        """
        Completely removes a module from the registry and filesystem.
        """
        if module_name == 'core':
            raise ValidationError("Cannot delete the Core module.")

        # 1. Check if other modules depend on this
        dependents = []
        all_mods = SystemModule.objects.exclude(name=module_name)
        for mod in all_mods:
            requires = mod.manifest.get('dependencies', [])
            if module_name in requires:
                dependents.append(mod.name)
        
        if dependents:
            raise ValidationError(f"Cannot delete {module_name}. Other modules depend on it: {', '.join(dependents)}")

        # 2. Registry Removal
        SystemModule.objects.filter(name=module_name).delete()
        OrganizationModule.objects.filter(module_name=module_name).delete()

        # 3. File Removal
        target_path = os.path.join(ModuleManager.MODULES_DIR, module_name)
        if os.path.exists(target_path):
            shutil.rmtree(target_path)
            
        SystemModuleLog.objects.create(
            module_name=module_name,
            from_version="N/A",
            to_version="N/A",
            action='DELETE',
            status='SUCCESS',
            logs=f"Module {module_name} wiped from system."
        )
        return True
    @staticmethod
    def list_backups(module_name):
        """
        Lists available backups for a module.
        """
        backups_dir = os.path.join(settings.BASE_DIR, 'backups')
        if not os.path.exists(backups_dir):
            return []
            
        params = []
        for d in os.listdir(backups_dir):
            if d.startswith(f"{module_name}_"):
                version = d.replace(f"{module_name}_", "")
                timestamp = os.path.getmtime(os.path.join(backups_dir, d))
                from datetime import datetime
                params.append({
                    'version': version,
                    'date': datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
                })
        # Sort by latest
        return sorted(params, key=lambda x: x['date'], reverse=True)

    @staticmethod
    @transaction.atomic
    def rollback(module_name, target_version):
        """
        Restores a specific backup version.
        WARNING: This does NOT automatically unapply migrations (Django restriction).
        """
        ModuleManager.acquire_lock()
        try:
            backup_path = os.path.join(settings.BASE_DIR, 'backups', f"{module_name}_{target_version}")
            if not os.path.exists(backup_path):
                raise ValidationError(f"Backup for version {target_version} not found.")

            target_path = os.path.join(ModuleManager.MODULES_DIR, module_name)
            
            # 1. Wipe current
            if os.path.exists(target_path):
                shutil.rmtree(target_path)
            
            # 2. Restore backup
            shutil.copytree(backup_path, target_path, dirs_exist_ok=True)
            
            # 3. Read restored manifest
            with open(os.path.join(target_path, 'manifest.json'), 'r') as f:
                manifest = json.load(f)
                
            # 4. Update Registry
            SystemModule.objects.update_or_create(
                name=module_name,
                defaults={
                    'version': target_version,
                    'status': 'INSTALLED',
                    'manifest': manifest,
                    'checksum': 'RESTORED_BACKUP'
                }
            )
            
            SystemModuleLog.objects.create(
                module_name=module_name,
                from_version='CURRENT',
                to_version=target_version,
                action='ROLLBACK',
                status='SUCCESS',
                logs=f"Rolled back to version {target_version}"
            )
            
        except Exception as e:
            raise e
        finally:
            ModuleManager.release_lock()
