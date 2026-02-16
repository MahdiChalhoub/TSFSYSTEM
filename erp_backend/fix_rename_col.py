import os, sys, django
sys.path.insert(0, '/root/TSFSYSTEM/erp_backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()

from django.db import connection

cursor = connection.cursor()

# Rename the wrongly-named column
try:
    cursor.execute('ALTER TABLE "user" RENAME COLUMN two_factor_enabled TO is_2fa_enabled')
    print("[OK] Renamed two_factor_enabled -> is_2fa_enabled")
except Exception as e:
    print(f"[SKIP] Rename: {e}")

connection.connection.commit()
print("DONE")
