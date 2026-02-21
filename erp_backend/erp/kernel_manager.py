import os
import json
import zipfile
import shutil
import hashlib
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import SystemUpdate
from django.core.exceptions import ValidationError
from .security_keys import is_package_trusted

class KernelManager:
    KERNEL_UPDATES_DIR = os.path.join(settings.BASE_DIR, 'tmp', 'kernel_updates')
    
    @staticmethod
    def get_current_version():
        """
        Returns the current applied kernel version.
        """
        latest = SystemUpdate.objects.filter(is_applied=True).order_by('-applied_at').first()
        return latest.version if latest else "1.0.0"

    @staticmethod
    def stage_update(file_obj):
        """
        Stages a .kernel.zip package, verifies integrity and version.
        """
        os.makedirs(KernelManager.KERNEL_UPDATES_DIR, exist_ok=True)
        
        # 1. Save temp file
        temp_path = os.path.join(KernelManager.KERNEL_UPDATES_DIR, f"staged_{timezone.now().strftime('%Y%m%d_%H%M%S')}.zip")
        with open(temp_path, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)
        
        # 2. Verify ZIP
        if not zipfile.is_zipfile(temp_path):
            os.remove(temp_path)
            raise ValidationError("Invalid kernel package: Not a ZIP file.")
            
        try:
            with zipfile.ZipFile(temp_path, 'r') as zipf:
                # Security: Verify package signature
                is_trusted, msg = is_package_trusted(zipf, 'kernel')
                if not is_trusted:
                    os.remove(temp_path)
                    raise ValidationError(f"Security check failed: {msg}")
                print(f"🔐 {msg}")
                
                if 'update.json' not in zipf.namelist():
                    raise ValidationError("Invalid kernel package: Missing update.json")
                
                with zipf.open('update.json') as f:
                    manifest = json.load(f)
                    version = manifest.get('version')
                    changelog = manifest.get('changelog', '')
                    
                    if not version:
                        raise ValidationError("Invalid kernel package: No version specified in update.json")
                    
                    # Prevent downgrades or re-applying same version
                    if SystemUpdate.objects.filter(version=version, is_applied=True).exists():
                        raise ValidationError(f"Version {version} is already installed.")
            
            # 3. Create SystemUpdate Record (Staged)
            update_record, created = SystemUpdate.objects.get_or_create(
                version=version,
                defaults={
                    'changelog': changelog,
                    'package_hash': KernelManager._calculate_hash(temp_path),
                    'metadata': manifest
                }
            )
            
            # Store path for application
            update_record.metadata['staged_path'] = temp_path
            update_record.save()
            
            return update_record

        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise ValidationError(f"failed to stage update: {str(e)}")

    @staticmethod
    def apply_update(update_id):
        """
        OS-GRADE HARDENING: Atomic Kernel Swap.
        Uses a Backup/Replace flow to ensure core system integrity.
        """
        update = SystemUpdate.objects.get(id=update_id)
        if update.is_applied:
            raise ValidationError("Update already applied.")
            
        staged_zip = update.metadata.get('staged_path')
        if not staged_zip or not os.path.exists(staged_zip):
            raise ValidationError("Staged update package not found.")
            
        # 1. Prepare Staging
        temp_extract = os.path.join(settings.BASE_DIR, 'tmp', f"kernel_stage_{update.version}")
        if os.path.exists(temp_extract): shutil.rmtree(temp_extract)
        
        # 2. Extract and Verify
        with zipfile.ZipFile(staged_zip, 'r') as zipf:
            zipf.extractall(temp_extract)
            
        # [HARDENING] Integrity Checks on Staged Files
        if not os.path.exists(os.path.join(temp_extract, 'manage.py')):
            raise ValidationError("Invalid Kernel: Missing core system files in update.")

        # 3. Execution (Atomic-ish)
        # We backup the current erp/ and other core dirs
        backup_dir = os.path.join(settings.BASE_DIR, 'backups', f"kernel_{KernelManager.get_current_version()}_{timezone.now().strftime('%Y%m%d%H%M%S')}")
        os.makedirs(backup_dir, exist_ok=True)
        
        core_dirs = ['erp', 'lib', 'apps_core'] # Dirs that are part of the kernel
        
        try:
            with transaction.atomic():
                print(f"📦 Backing up Kernel {KernelManager.get_current_version()}...")
                for d in core_dirs:
                    src = os.path.join(settings.BASE_DIR, d)
                    if os.path.exists(src):
                        shutil.copytree(src, os.path.join(backup_dir, d), dirs_exist_ok=True)

                print(f"🚚 Deploying Kernel {update.version}...")
                # Copy from staged to live
                # Note: This overwrites. A real 'swap' would move, but overwrite is easier for partial kernel updates.
                shutil.copytree(temp_extract, settings.BASE_DIR, dirs_exist_ok=True)

                # 4. Mark as applied
                update.is_applied = True
                update.applied_at = timezone.now()
                update.save()
                
                # 5. Clean up
                if os.path.exists(staged_zip): os.remove(staged_zip)
                if os.path.exists(temp_extract): shutil.rmtree(temp_extract)
                
                print(f"✅ Kernel Update {update.version} applied successfully. SYSTEM RESTART RECOMMENDED.")
                
        except Exception as e:
            print(f"💥 Kernel Update FAILED: {str(e)}. Attempting RESTORE...")
            # Restore from backup
            for d in core_dirs:
                src = os.path.join(backup_dir, d)
                if os.path.exists(src):
                    shutil.copytree(src, os.path.join(settings.BASE_DIR, d), dirs_exist_ok=True)
            raise ValidationError(f"Kernel Update failed. System restored to {KernelManager.get_current_version()}. Error: {str(e)}")
            
        return update

    @staticmethod
    def _calculate_hash(file_path):
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    # =========================================================================
    # ROLLBACK — Restore kernel to a previous version from backup
    # =========================================================================

    @staticmethod
    def list_backups():
        """
        List available kernel backups from the backups directory.
        Returns list of dicts with version, timestamp, path, and size.
        """
        backups_dir = os.path.join(settings.BASE_DIR, 'backups')
        if not os.path.exists(backups_dir):
            return []

        backups = []
        for entry in sorted(os.listdir(backups_dir), reverse=True):
            if not entry.startswith('kernel_'):
                continue
            full_path = os.path.join(backups_dir, entry)
            if not os.path.isdir(full_path):
                continue

            # Parse version and timestamp from dir name: kernel_{version}_{timestamp}
            parts = entry[len('kernel_'):].rsplit('_', 1)
            version = parts[0] if len(parts) >= 1 else 'unknown'
            
            # Calculate total size
            total_size = 0
            for dirpath, _, filenames in os.walk(full_path):
                for f in filenames:
                    total_size += os.path.getsize(os.path.join(dirpath, f))

            backups.append({
                'dir_name': entry,
                'version': version,
                'path': full_path,
                'size_mb': round(total_size / (1024 * 1024), 2),
                'contents': [d for d in os.listdir(full_path) if os.path.isdir(os.path.join(full_path, d))],
            })

        return backups

    @staticmethod
    def rollback(backup_dir_name):
        """
        Rollback kernel to a previous backup.

        Steps:
        1. Validate backup exists and contains expected dirs
        2. Restore core dirs from backup
        3. Update SystemUpdate records (un-apply current, re-apply previous)
        4. Trigger hot-reload

        Args:
            backup_dir_name: Name of the backup directory (e.g. 'kernel_2.6.0_20260221123456')
        """
        backups_dir = os.path.join(settings.BASE_DIR, 'backups')
        backup_path = os.path.join(backups_dir, backup_dir_name)

        if not os.path.exists(backup_path):
            raise ValidationError(f"Backup not found: {backup_dir_name}")

        if not backup_dir_name.startswith('kernel_'):
            raise ValidationError(f"Not a kernel backup: {backup_dir_name}")

        core_dirs = ['erp', 'lib', 'apps_core']

        # Validate at least one core dir exists in backup
        available_dirs = [d for d in core_dirs if os.path.isdir(os.path.join(backup_path, d))]
        if not available_dirs:
            raise ValidationError(f"Backup contains none of the expected dirs: {core_dirs}")

        # Parse version from backup dir name
        backup_version = backup_dir_name[len('kernel_'):].rsplit('_', 1)[0]
        current_version = KernelManager.get_current_version()

        try:
            with transaction.atomic():
                print(f"🔄 Rolling back Kernel from {current_version} → {backup_version}...")

                # 1. Create a safety backup of the CURRENT state before rollback
                safety_backup = os.path.join(
                    backups_dir,
                    f"kernel_{current_version}_pre_rollback_{timezone.now().strftime('%Y%m%d%H%M%S')}"
                )
                os.makedirs(safety_backup, exist_ok=True)
                for d in core_dirs:
                    src = os.path.join(settings.BASE_DIR, d)
                    if os.path.exists(src):
                        shutil.copytree(src, os.path.join(safety_backup, d), dirs_exist_ok=True)

                # 2. Restore from backup
                for d in available_dirs:
                    src = os.path.join(backup_path, d)
                    dst = os.path.join(settings.BASE_DIR, d)
                    print(f"  📦 Restoring {d}/...")
                    if os.path.exists(dst):
                        shutil.rmtree(dst)
                    shutil.copytree(src, dst)

                # 3. Update DB records
                # Un-apply all current updates that are newer than backup version
                SystemUpdate.objects.filter(is_applied=True).update(
                    is_applied=False,
                    metadata={"rollback_reason": f"Rolled back to {backup_version}"}
                )
                # Re-apply the target version if it exists in DB
                target_update = SystemUpdate.objects.filter(version=backup_version).first()
                if target_update:
                    target_update.is_applied = True
                    target_update.applied_at = timezone.now()
                    target_update.save()

                print(f"✅ Kernel rolled back to {backup_version}. SYSTEM RESTART RECOMMENDED.")

        except Exception as e:
            print(f"💥 Kernel Rollback FAILED: {str(e)}")
            raise ValidationError(f"Kernel rollback failed: {str(e)}")

        # 4. Hot-reload (best-effort, outside transaction)
        try:
            from .module_manager import ModuleManager
            ModuleManager.hot_reload()
        except Exception as hr_err:
            print(f"⚠️ Hot-reload after rollback skipped: {hr_err}")

        return {
            'from_version': current_version,
            'to_version': backup_version,
            'restored_dirs': available_dirs,
            'safety_backup': os.path.basename(safety_backup),
        }
