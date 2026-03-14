import os
import django
import sys

# Setup settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection
from django.core.management import call_command
from django.conf import settings

print("🛠️ Forcing table creation (bypassing migrations)...")

class DisableMigrations:
    def __contains__(self, item): return True
    def __getitem__(self, item): return None

settings.MIGRATION_MODULES = DisableMigrations()

try:
    call_command('migrate', run_syncdb=True, interactive=False)
except Exception as e:
    print(f"❌ Error during migrate: {e}")

print("✅ Force creation complete.")
