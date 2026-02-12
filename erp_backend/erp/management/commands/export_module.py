
import os
import shutil
import zipfile
import json
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

class Command(BaseCommand):
    help = 'Exports a module to a .modpkg.zip installer'

    def add_arguments(self, parser):
        parser.add_argument('module_name', type=str, help='Name of the module to export (or "all")')
        parser.add_argument('--output', type=str, default='dist', help='Output directory for the zip file')

    def handle(self, *args, **options):
        module_name = options['module_name']
        output_dir = os.path.join(settings.BASE_DIR, options['output'])
        apps_dir = os.path.join(settings.BASE_DIR, 'apps')

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        if module_name == 'all':
            modules_to_export = [
                m for m in os.listdir(apps_dir) 
                if os.path.isdir(os.path.join(apps_dir, m)) and m != 'core'
            ]
        else:
            modules_to_export = [module_name]

        self.stdout.write(f"📦 Exporting to {output_dir}...")

        for mod in modules_to_export:
            self._export_module(mod, apps_dir, output_dir)

    def _export_module(self, module_name, apps_dir, output_dir):
        # SEARCH LOCATIONS
        search_paths = [
            os.path.join(settings.BASE_DIR, 'apps', module_name),
            os.path.join(settings.BASE_DIR, 'erp', 'modules', module_name)
        ]
        
        module_path = next((p for p in search_paths if os.path.exists(p)), None)
        
        if not module_path:
            self.stdout.write(self.style.ERROR(f"❌ Module '{module_name}' not found locally."))
            return

        manifest_path = os.path.join(module_path, 'manifest.json')
        if not os.path.exists(manifest_path):
            self.stdout.write(self.style.WARNING(f"⚠️ Skipping {module_name}: manifest.json missing"))
            return

        try:
            with open(manifest_path, 'r') as f:
                manifest = json.load(f)
                version = manifest.get('version', '1.0.0')

            zip_filename = f"{module_name}_{version}.modpkg.zip"
            zip_path = os.path.join(output_dir, zip_filename)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 1. Export Backend Files
                for root, dirs, files in os.walk(module_path):
                    for file in files:
                        if '__pycache__' in root or '.git' in root or file.endswith('.pyc'):
                            continue
                        
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, module_path).replace('\\', '/')
                        zipf.write(file_path, arcname)

                # 2. Export Frontend Files (from src/modules/)
                frontend_source = os.path.join(settings.BASE_DIR, '..', 'src', 'modules', module_name)
                if os.path.exists(frontend_source):
                    self.stdout.write(f"🎨 Including frontend from src/modules/{module_name}...")
                    for root, dirs, files in os.walk(frontend_source):
                        # Skip __pycache__, node_modules
                        dirs[:] = [d for d in dirs if d not in ['__pycache__', 'node_modules', '.next']]
                        for file in files:
                            file_path = os.path.join(root, file)
                            # Put under 'frontend/' prefix in zip
                            arcname = os.path.join('frontend', os.path.relpath(file_path, frontend_source)).replace('\\', '/')
                            zipf.write(file_path, arcname)

            self.stdout.write(self.style.SUCCESS(f"✅ Exported: {zip_filename}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Failed to export {module_name}: {str(e)}"))
