
import os
import shutil
import sys
import django
from django.db import connection

# Setup Django environment
sys.path.append('c:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp.settings')
django.setup()

from erp.models import SystemModule, OrganizationModule
from django.conf import settings

def reset_modules():
    print("WARNING: This will wipe ALL non-core modules and their registry entries.")
    print("Core module will be preserved.")
    
    # 1. Wipe Registry (Except Core)
    print(" Cleaning Registry...")
    SystemModule.objects.exclude(name='core').delete()
    OrganizationModule.objects.exclude(module_name='core').delete()
    
    # 2. Wipe Filesystem (Except Core)
    apps_dir = os.path.join(settings.BASE_DIR, 'apps')
    for item in os.listdir(apps_dir):
        if item == 'core':
            continue
            
        path = os.path.join(apps_dir, item)
        if os.path.isdir(path):
            print(f" Removing {item}...")
            shutil.rmtree(path)
            
    print("✅ System Reset Complete. Only Core remains.")

if __name__ == '__main__':
    reset_modules()
