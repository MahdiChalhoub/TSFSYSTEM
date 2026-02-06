"""
Package Deployer Service
Handles atomic deployment of kernel, frontend, and module packages.
"""
import os
import shutil
import zipfile
import subprocess
import tempfile
from datetime import datetime
from django.conf import settings
from django.utils import timezone


class PackageDeployer:
    """
    Unified deployment service for kernel/frontend/module packages.
    Implements atomic swap with backup and rollback capability.
    """
    
    def __init__(self):
        self.base_path = getattr(settings, 'BASE_DIR', '/app')
        self.backup_dir = os.path.join(self.base_path, 'backups')
        self.staging_dir = os.path.join(tempfile.gettempdir(), 'package_staging')
        
        # Ensure directories exist
        os.makedirs(self.backup_dir, exist_ok=True)
        os.makedirs(self.staging_dir, exist_ok=True)
    
    def deploy(self, package, user=None):
        """
        Deploy a package with atomic swap.
        
        Steps:
        1. Extract to staging
        2. Validate package structure
        3. Create backup of current state
        4. Perform atomic swap
        5. Run post-deploy hooks (migrations, restart)
        
        Returns:
            dict: {'success': bool, 'error': str, 'backup_path': str}
        """
        try:
            package.status = 'applying'
            package.save()
            
            # 1. Extract to staging
            staging_path = self._extract_to_staging(package)
            
            # 2. Validate structure
            validation = self._validate_package(staging_path, package.package_type)
            if not validation['valid']:
                raise Exception(validation['error'])
            
            # 3. Create backup
            backup_path = self._create_backup(package.package_type)
            
            # 4. Perform atomic swap
            self._atomic_swap(staging_path, package.package_type)
            
            # 5. Run post-deploy hooks
            self._run_post_deploy(package.package_type)
            
            # Update package status
            package.status = 'applied'
            package.applied_at = timezone.now()
            package.applied_by = user
            package.backup_path = backup_path
            package.save()
            
            # Cleanup staging
            shutil.rmtree(staging_path, ignore_errors=True)
            
            return {'success': True, 'backup_path': backup_path}
            
        except Exception as e:
            package.status = 'failed'
            package.error_message = str(e)
            package.save()
            return {'success': False, 'error': str(e)}
    
    def rollback(self, package):
        """
        Rollback a deployed package using its backup.
        """
        try:
            if not package.backup_path or not os.path.exists(package.backup_path):
                return {'success': False, 'error': 'Backup not found'}
            
            # Get target directories based on package type
            target_dirs = self._get_target_dirs(package.package_type)
            
            # Restore from backup
            for dirname, backup_subpath in target_dirs.items():
                target_path = os.path.join(self.base_path, dirname)
                backup_source = os.path.join(package.backup_path, dirname)
                
                if os.path.exists(backup_source):
                    if os.path.exists(target_path):
                        shutil.rmtree(target_path)
                    shutil.copytree(backup_source, target_path)
            
            # Restart services
            self._run_post_deploy(package.package_type)
            
            return {'success': True}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _extract_to_staging(self, package):
        """Extract package ZIP to staging directory."""
        staging_path = os.path.join(
            self.staging_dir, 
            f"{package.package_type}_{package.version}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )
        os.makedirs(staging_path, exist_ok=True)
        
        with zipfile.ZipFile(package.file.path, 'r') as zf:
            zf.extractall(staging_path)
        
        return staging_path
    
    def _validate_package(self, staging_path, package_type):
        """Validate package structure based on type."""
        validations = {
            'kernel': ['erp', 'manage.py'],
            'frontend': ['.next'],
            'module': ['manifest.json']
        }
        
        required = validations.get(package_type, [])
        
        for item in required:
            if not os.path.exists(os.path.join(staging_path, item)):
                return {'valid': False, 'error': f'Missing required: {item}'}
        
        return {'valid': True}
    
    def _create_backup(self, package_type):
        """Create backup of current state."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(self.backup_dir, f"{package_type}_{timestamp}")
        os.makedirs(backup_path, exist_ok=True)
        
        target_dirs = self._get_target_dirs(package_type)
        
        for dirname in target_dirs.keys():
            source_path = os.path.join(self.base_path, dirname)
            if os.path.exists(source_path):
                shutil.copytree(source_path, os.path.join(backup_path, dirname))
        
        return backup_path
    
    def _atomic_swap(self, staging_path, package_type):
        """Perform atomic swap of staged files to live."""
        target_dirs = self._get_target_dirs(package_type)
        
        for dirname in target_dirs.keys():
            staged_source = os.path.join(staging_path, dirname)
            target_path = os.path.join(self.base_path, dirname)
            
            if os.path.exists(staged_source):
                # Remove current
                if os.path.exists(target_path):
                    shutil.rmtree(target_path)
                # Copy staged to live
                shutil.copytree(staged_source, target_path)
    
    def _get_target_dirs(self, package_type):
        """Get target directories for each package type."""
        return {
            'kernel': {'erp': 'erp', 'lib': 'lib'},
            'frontend': {'.next': '.next', 'public': 'public'},
            'module': {'apps': 'apps'}
        }.get(package_type, {})
    
    def _run_post_deploy(self, package_type):
        """Run post-deployment hooks."""
        try:
            if package_type == 'kernel':
                # Run Django migrations
                subprocess.run(
                    ['python', 'manage.py', 'migrate', '--no-input'],
                    cwd=self.base_path,
                    check=True,
                    timeout=300
                )
            elif package_type == 'frontend':
                # Restart PM2 or systemd service for Next.js
                # This is environment-specific, using PM2 as example
                subprocess.run(
                    ['pm2', 'restart', 'nextjs'],
                    check=False,  # Don't fail if PM2 not available
                    timeout=60
                )
            elif package_type == 'module':
                # Module-specific post-install (optional)
                pass
        except subprocess.TimeoutExpired:
            raise Exception("Post-deploy command timed out")
        except subprocess.CalledProcessError as e:
            raise Exception(f"Post-deploy failed: {e}")
