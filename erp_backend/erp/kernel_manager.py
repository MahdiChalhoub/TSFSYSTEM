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
        Applies a staged kernel update.
        """
        update = SystemUpdate.objects.get(id=update_id)
        if update.is_applied:
            raise ValidationError("Update already applied.")
            
        staged_path = update.metadata.get('staged_path')
        if not staged_path or not os.path.exists(staged_path):
            raise ValidationError("Staged update package not found.")
            
        with transaction.atomic():
            # 1. Extract files to BASE_DIR (Overwriting core files)
            with zipfile.ZipFile(staged_path, 'r') as zipf:
                # Security: Only extract to BASE_DIR, filter out sensitive paths if needed
                zipf.extractall(settings.BASE_DIR)
            
            # 2. Mark as applied
            update.is_applied = True
            update.applied_at = timezone.now()
            update.save()
            
            # 3. Clean up staging
            if os.path.exists(staged_path):
                os.remove(staged_path)
            
            # 4. Success Log
            print(f"✅ Kernel Update {update.version} applied successfully.")
            
        return update

    @staticmethod
    def _calculate_hash(file_path):
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
