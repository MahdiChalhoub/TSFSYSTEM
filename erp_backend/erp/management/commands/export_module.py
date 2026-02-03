import os
import zipfile
import hashlib
import json
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

class Command(BaseCommand):
    help = 'Packages a module from apps/ into a .modpkg.zip for distribution'

    def add_arguments(self, parser):
        parser.add_argument('module_name', type=str, help='Name of the module to export')

    def handle(self, *args, **options):
        module_name = options['module_name']
        apps_dir = os.path.join(settings.BASE_DIR, 'apps')
        module_path = os.path.join(apps_dir, module_name)

        if not os.path.exists(module_path):
            raise CommandError(f"Module '{module_name}' not found in apps/")

        manifest_path = os.path.join(module_path, 'manifest.json')
        if not os.path.exists(manifest_path):
            raise CommandError(f"Module '{module_name}' is missing manifest.json")

        self.stdout.write(f"📦 Exporting module: {module_name}...")

        # 1. Load manifest and verify
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        version = manifest.get('version', '0.0.0')
        export_filename = f"{module_name}_{version}.modpkg.zip"
        export_path = os.path.join(settings.BASE_DIR, 'exports', export_filename)

        if not os.path.exists(os.path.dirname(export_path)):
            os.makedirs(os.path.dirname(export_path))

        # 2. Create Zip
        self.stdout.write("   - Creating archive...")
        sha256_hash = hashlib.sha256()
        
        with zipfile.ZipFile(export_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(module_path):
                # Skip __pycache__
                if '__pycache__' in dirs:
                    dirs.remove('__pycache__')
                
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, module_path)
                    zipf.write(file_path, arcname)
                    
                    # Update hash
                    with open(file_path, "rb") as f:
                        for byte_block in iter(lambda: f.read(4096), b""):
                            sha256_hash.update(byte_block)

        checksum = sha256_hash.hexdigest()
        
        # 3. Save Checksum file
        checksum_path = export_path + ".sha256"
        with open(checksum_path, 'w') as f:
            f.write(checksum)

        self.stdout.write(self.style.SUCCESS(f"✅ Successfully exported to {export_path}"))
        self.stdout.write(self.style.SUCCESS(f"Checksum: {checksum}"))
