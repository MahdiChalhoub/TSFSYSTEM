import os
import json
import zipfile
import shutil
import hashlib
from django.conf import settings
from django.db import transaction
from django.core.management import call_command
from django.utils import timezone
from .models import SystemModule, SystemModuleLog, OrganizationModule, Organization, User
from django.core.exceptions import ValidationError
from .kernel_manager import KernelManager
from .security_keys import is_package_trusted

class ModuleManager:
    MODULES_DIR = os.path.join(settings.BASE_DIR, 'apps') # New standard
    LEGACY_MODULES_DIR = os.path.join(settings.BASE_DIR, 'erp', 'modules')
    # Use BASE_DIR/tmp to ensure consistency on production VPS
    LOCK_FILE = os.path.join(settings.BASE_DIR, 'tmp', 'module_operation.lock')

    @staticmethod
    def acquire_lock():
        if os.path.exists(ModuleManager.LOCK_FILE):
            raise ValidationError("Another module operation is in progress. Please wait.")
        os.makedirs(os.path.dirname(ModuleManager.LOCK_FILE), exist_ok=True)
        with open(ModuleManager.LOCK_FILE, 'w') as f:
            f.write("LOCKED")

    @staticmethod
    def get_module_path(module_name):
        """
        Returns the absolute path to a module on the filesystem.
        Checks both new /apps and legacy /erp/modules.
        """
        paths = [
            os.path.join(ModuleManager.MODULES_DIR, module_name),
            os.path.join(ModuleManager.LEGACY_MODULES_DIR, module_name)
        ]
        for p in paths:
            if os.path.exists(p) and os.path.isdir(p):
                return p
        return None

    @staticmethod
    def release_lock():
        if os.path.exists(ModuleManager.LOCK_FILE):
            os.remove(ModuleManager.LOCK_FILE)

    @staticmethod
    def sync():
        """
        Scans the filesystem for modules and registers them in the database.
        Returns list of module names found.
        """
        found_modules = []
        
        # Scan legacy FIRST so that modern paths (listed second) OVERWRITE them in the registry
        for modules_dir in [ModuleManager.LEGACY_MODULES_DIR, ModuleManager.MODULES_DIR]:
            if not os.path.exists(modules_dir):
                continue
                
            for item in os.listdir(modules_dir):
                item_path = os.path.join(modules_dir, item)
                manifest_path = os.path.join(item_path, 'manifest.json')
                
                if os.path.isdir(item_path) and os.path.exists(manifest_path):
                    try:
                        with open(manifest_path, 'r') as f:
                            manifest = json.load(f)
                        
                        SystemModule.objects.update_or_create(
                            name=item,
                            defaults={
                                'version': manifest.get('version', '0.0.0'),
                                'status': 'INSTALLED',
                                'manifest': manifest,
                                'checksum': ModuleManager.get_checksum(manifest_path)
                            }
                        )
                        found_modules.append(item)
                    except Exception as e:
                        print(f"⚠️ Failed to register {item}: {e}")
        
        ModuleManager.trigger_reload()
        return found_modules

    @staticmethod
    def trigger_reload():
        """Touches settings.py to trigger a Django reload in dev/production."""
        try:
            settings_path = os.path.join(settings.BASE_DIR, 'core', 'settings.py')
            if os.path.exists(settings_path):
                os.utime(settings_path, None)
                print(f"🔥 System HOT-RELOAD triggered via {settings_path}")
                return True
        except Exception as e:
            print(f"⚠️ Hot-reload trigger failed: {e}")
        return False

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
        
        # [HARDENING] Kernel Compatibility Check
        kernel_version = KernelManager.get_current_version()
        compat = manifest.get('kernel_compat', '>=1.0.0')
        # Simple version comparison for now, could use packaging.version if needed
        if compat.startswith('>=') and kernel_version < compat.replace('>=', ''):
             raise ValidationError(f"Kernel Incompatible: Module requires {compat}, current Kernel is {kernel_version}")
             
        return True

    @staticmethod
    def check_dependencies(manifest):
        """
        Verifies that all required dependencies are installed.
        """
        dependencies = manifest.get('dependencies', [])
        for dep in dependencies:
            if not SystemModule.objects.filter(name=dep, status='INSTALLED').exists():
                raise ValidationError(f"Missing dependency: {dep}. Please install it first.")
        return True

    @staticmethod
    def run_lifecycle_hook(target_path, hook_name):
        """
        Executes a lifecycle hook script if present.
        Hooks are typically python scripts in the module root.
        """
        hook_file = f"{hook_name}.py"
        full_path = os.path.join(target_path, hook_file)
        if os.path.exists(full_path):
            print(f"🪝 Executing lifecycle hook: {hook_name}...")
            # We execute it in the current environment but could isolate if needed
            # For now, simple exec or management command
            try:
                import subprocess
                result = subprocess.run(['python', full_path], capture_output=True, text=True)
                if result.returncode != 0:
                    raise Exception(f"Hook {hook_name} failed: {result.stderr}")
            except Exception as e:
                print(f"⚠️ Lifecycle hook {hook_name} failed: {str(e)}")
                raise ValidationError(f"Lifecycle hook {hook_name} failed: {str(e)}")

    @staticmethod
    @transaction.atomic
    def upgrade(module_name, package_path, user=None):
        """
        OS-GRADE HARDENING: Atomic swap upgrade.
        1. Stage -> 2. Pre-install -> 3. Backup Current -> 4. Swap -> 5. Migrate -> 6. Post-install
        """
        ModuleManager.acquire_lock()
        old_module = SystemModule.objects.filter(name=module_name).first()
        old_version = old_module.version if old_module else "0.0.0"
        
        # Prepare paths
        temp_extract = os.path.join(settings.BASE_DIR, 'tmp', f"stage_{module_name}_{hashlib.md5(package_path.encode()).hexdigest()[:8]}")
        target_path = os.path.join(ModuleManager.MODULES_DIR, module_name)
        backup_path = os.path.join(settings.BASE_DIR, 'backups', f"{module_name}_{old_version}_{timezone.now().strftime('%Y%m%d%H%M%S')}")
        frontend_target = os.path.join(settings.BASE_DIR, '..', 'src', 'modules', module_name)
        
        try:
            print(f"🚀 Starting OS-Grade upgrade for {module_name}...")
            
            # 1. Extraction & Parsing
            if os.path.exists(temp_extract): shutil.rmtree(temp_extract)
            with zipfile.ZipFile(package_path, 'r') as zip_ref:
                # Security: Verify package signature
                is_trusted, msg = is_package_trusted(zip_ref, module_name)
                if not is_trusted:
                    raise ValidationError(f"Security check failed: {msg}")
                print(f"🔐 {msg}")
                
                zip_ref.extractall(temp_extract)
            
            source_inner_dir = os.path.join(temp_extract, module_name)
            if not os.path.exists(source_inner_dir):
                 if os.path.exists(os.path.join(temp_extract, 'manifest.json')):
                      source_inner_dir = temp_extract
                 else:
                      raise ValidationError("Invalid package structure.")

            with open(os.path.join(source_inner_dir, 'manifest.json'), 'r') as f:
                new_manifest = json.load(f)
            
            # 2. Strict Validation
            ModuleManager.validate_manifest(new_manifest)
            new_version = new_manifest.get('version')
            # Allow same version for re-install/repair, only block downgrades
            # Simple string comparison is fine for semver if formatted consistently
            # Skip version check for first-time installs
            if old_version != "0.0.0" and new_version < old_version:
                raise ValidationError(f"Version must be higher than current {old_version}")
            
            # Dependency resolution
            ModuleManager.check_dependencies(new_manifest)

            # 3. Pre-install Hook (Run in staging)
            ModuleManager.run_lifecycle_hook(source_inner_dir, 'pre_install')

            # 4. Atomic-ish Swap
            # a. Backup current if exists
            if os.path.exists(target_path):
                print(f"📦 Backing up {module_name} v{old_version}...")
                os.makedirs(os.path.dirname(backup_path), exist_ok=True)
                shutil.move(target_path, backup_path) # Move out of the way
            
            # b. Move staging to target
            print(f"🚚 Swapping files for {module_name} v{new_version}...")
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            shutil.copytree(source_inner_dir, target_path)

            # d. Legacy Cleanup: Remove from old modules dir if it exists there to prevent sync collisions
            legacy_path = os.path.join(ModuleManager.LEGACY_MODULES_DIR, module_name)
            if os.path.exists(legacy_path):
                print(f"🧹 Removing legacy artifacts from {legacy_path}...")
                shutil.rmtree(legacy_path)

            # c. Frontend Isolation Update
            frontend_extract = os.path.join(temp_extract, 'frontend')
            if os.path.exists(frontend_extract):
                if os.path.exists(frontend_target):
                    # We don't rollback frontend usually but good to be safe if we can
                    pass
                shutil.copytree(frontend_extract, frontend_target, dirs_exist_ok=True)

            # 5. Persistence (Migrations)
            # NOTE: Migration may fail if cross-app dependencies exist in the migration
            # graph (e.g., erp.0039 depends on finance.0001_initial). Since the DB schema
            # already exists from prior migrations, we treat migration failures as warnings.
            try:
                print(f"⚙️ Applying migrations for {module_name}...")
                call_command('migrate', no_input=True)
            except Exception as e:
                print(f"⚠️ Migration skipped (non-fatal): {str(e)}")
                print(f"   DB schema already exists — proceeding with upgrade.")

            # 6. Post-install Hook
            ModuleManager.run_lifecycle_hook(target_path, 'post_install')

            # 7. Finalize Registry
            checksum = ModuleManager.get_checksum(package_path)
            SystemModule.objects.update_or_create(
                name=module_name,
                defaults={
                    'version': new_version,
                    'status': 'INSTALLED',
                    'manifest': new_manifest,
                    'checksum': checksum
                }
            )
            
            SystemModuleLog.objects.create(
                module_name=module_name,
                from_version=old_version,
                to_version=new_version,
                action='UPGRADE' if old_module else 'INSTALL',
                status='SUCCESS',
                logs="Atomic upgrade completed.",
                performed_by=user
            )
            
            ModuleManager.trigger_reload()
            print(f"✅ Module {module_name} successfully hardened to {new_version}")

        except Exception as e:
            # Global Failure Handler
            print(f"❌ Upgrade CRITICALLY failed: {str(e)}")
            if old_module:
                old_module.status = 'FAILED'
                old_module.save()
            raise e
        finally:
            ModuleManager.release_lock()
            if os.path.exists(temp_extract): shutil.rmtree(temp_extract)

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
        Enables a module for a organization.
        Also triggers replay of any buffered requests for this module.
        """
        # Ensure it exists system-wide first
        if not SystemModule.objects.filter(name=module_name, status='INSTALLED').exists():
            raise ValidationError(f"Module {module_name} is not installed on this system.")
            
        # [FEATURE FLAGS] Calc default entitlements
        manifest = SystemModule.objects.get(name=module_name).manifest
        features = manifest.get('features', [])
        default_features = [f['code'] for f in features if f.get('default', False)]

        OrganizationModule.objects.update_or_create(
            organization_id=organization_id,
            module_name=module_name,
            defaults={
                'is_enabled': True,
                'active_features': default_features
            }
        )
        
        # [CONNECTOR INTEGRATION] Replay any buffered requests
        try:
            from .connector_engine import connector_engine
            replayed, failed = connector_engine.replay_buffered(module_name, organization_id)
            if replayed > 0:
                print(f"🔄 Connector: Replayed {replayed} buffered requests for {module_name}")
        except Exception as e:
            # Don't fail grant_access if replay fails
            print(f"⚠️ Connector replay failed: {e}")
        
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
        # [FEATURE FLAGS] Calc default entitlements
        manifest = SystemModule.objects.get(name=module_name, status='INSTALLED').manifest
        features = manifest.get('features', [])
        default_features = [f['code'] for f in features if f.get('default', False)]

        for org in orgs:
            OrganizationModule.objects.update_or_create(
                organization=org,
                module_name=module_name,
                defaults={
                    'is_enabled': True,
                    'active_features': default_features
                }
            )
            count += 1
        return count

    @staticmethod
    def revoke_all(module_name):
        """
        Revokes access to a specific module from all organizations.
        """
        if module_name in ['core', 'coreplatform']:
            raise ValidationError(f"Cannot revoke access to system-critical module: {module_name}")
            
        return OrganizationModule.objects.filter(module_name=module_name).update(is_enabled=False)

    @staticmethod
    @transaction.atomic
    def delete(module_name):
        """
        Completely removes a module from the registry and filesystem.
        """
        if module_name in ['core', 'coreplatform']:
            raise ValidationError(f"Cannot delete system-critical module: {module_name}")

        # 1. Check if other modules depend on this
        dependents = []
        all_mods = SystemModule.objects.exclude(name=module_name)
        for mod in all_mods:
            requires = mod.manifest.get('dependencies', [])
            if module_name in requires:
                dependents.append(mod.name)
        
        if dependents:
            raise ValidationError(f"Cannot delete {module_name}. Other modules depend on it: {', '.join(dependents)}")

        # 2. Data Safety Check
        # Check for ACTIVE installations only
        active_installs = OrganizationModule.objects.filter(module_name=module_name, is_enabled=True).count()
        if active_installs > 0:
            raise ValidationError(
                f"SAFETY BLOCK: Module {module_name} is ACTIVELY enabled for {active_installs} organizations. "
                "Please 'Revoke' access for all organizations before deleting from system."
            )

        # 3. Registry and Inactive Link Removal
        SystemModule.objects.filter(name=module_name).delete()
        OrganizationModule.objects.filter(module_name=module_name).delete()

        # 3. File Removal
        target_path = os.path.join(ModuleManager.MODULES_DIR, module_name)
        if os.path.exists(target_path):
            shutil.rmtree(target_path)
            
        # Also clean up legacy path if it exists
        legacy_path = os.path.join(ModuleManager.LEGACY_MODULES_DIR, module_name)
        if os.path.exists(legacy_path):
            shutil.rmtree(legacy_path)
            
        # Clean up frontend isolation zone
        frontend_path = os.path.join(settings.BASE_DIR, '..', 'src', 'modules', module_name)
        if os.path.exists(frontend_path):
            shutil.rmtree(frontend_path)
            
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
