import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

with connection.cursor() as cursor:
    try:
        cursor.execute("ALTER TABLE pos_order RENAME COLUMN discount TO discount_amount;")
        print("Renamed discount to discount_amount")
    except Exception as e:
        print(f"Rename failed (maybe already done?): {e}")

    try:
        cursor.execute("ALTER TABLE pos_order ADD COLUMN extra_fees JSONB DEFAULT '[]';")
        print("Added extra_fees column")
    except Exception as e:
        print(f"Add extra_fees failed: {e}")

    # Also need to fake the migration so Django doesn't complain next time
    try:
        cursor.execute("INSERT INTO django_migrations (app, name, applied) VALUES ('pos', '0001_initial', CURRENT_TIMESTAMP);")
        print("Faked pos.0001")
    except Exception as e:
        print(f"Fake pos.0001 failed: {e}")

    try:
        cursor.execute("INSERT INTO django_migrations (app, name, applied) VALUES ('pos', '0002_rename_discount_order_discount_amount_and_more', CURRENT_TIMESTAMP);")
        print("Faked pos.0002")
    except Exception as e:
        print(f"Fake pos.0002 failed: {e}")

    # Try to fix contenttypes too
    try:
        cursor.execute("INSERT INTO django_migrations (app, name, applied) VALUES ('contenttypes', '0002_remove_content_type_name', CURRENT_TIMESTAMP);")
        print("fixed contenttypes.0002 record")
    except Exception as e:
        print(f"contenttypes fix failed: {e}")
