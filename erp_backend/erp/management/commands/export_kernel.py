import os
import zipfile
import json
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone

class Command(BaseCommand):
    help = 'Exports the platform kernel as a .kernel.zip package'

    def add_arguments(self, parser):
        parser.add_argument('version', type=str, help='The new kernel version (e.g. 1.1.0)')
        parser.add_argument('--changelog', type=str, default='Platform stability and security improvements.', help='Description of the update')
        parser.add_argument('--output', type=str, default='dist', help='Output directory')

    def handle(self, *args, **options):
        version = options['version']
        changelog = options['changelog']
        output_dir = os.path.join(settings.BASE_DIR, options['output'])
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        zip_filename = f"kernel_{version}.kernel.zip"
        zip_path = os.path.join(output_dir, zip_filename)

        self.stdout.write(f"🚀 Preparing Kernel Export v{version}...")

        # Create update.json manifest
        manifest = {
            "version": version,
            "changelog": changelog,
            "type": "kernel",
            "exported_at": timezone.now().isoformat(),
            "target_platform": "Dajingo-Core"
        }

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 1. Add manifest
            zipf.writestr('update.json', json.dumps(manifest, indent=4))

            # 2. Package Backend Core (erp directory)
            erp_dir = os.path.join(settings.BASE_DIR, 'erp')
            for root, dirs, files in os.walk(erp_dir):
                for file in files:
                    if '__pycache__' in root or '.git' in root or file.endswith('.pyc'):
                        continue
                    file_path = os.path.join(root, file)
                    arcname = os.path.join('erp', os.path.relpath(file_path, erp_dir))
                    zipf.write(file_path, arcname)

            # 3. Add root config files (optional but typical for kernel)
            root_files = ['manage.py', 'requirements.txt']
            for rf in root_files:
                rf_path = os.path.join(settings.BASE_DIR, rf)
                if os.path.exists(rf_path):
                    zipf.write(rf_path, rf)

        self.stdout.write(self.style.SUCCESS(f"✅ Kernel package generated: {zip_path}"))
        self.stdout.write(self.style.WARNING("⚠️ IMPORTANT: This package will OVERWRITE core platform files on target systems."))
