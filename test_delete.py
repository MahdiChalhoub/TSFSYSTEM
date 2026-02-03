from erp.module_manager import ModuleManager
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'erp_backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp_backend.settings')

import django
django.setup()

try:
    ModuleManager.delete('demo')
    print('SUCCESS')
except Exception as e:
    print(f'FAILURE: {e}')
