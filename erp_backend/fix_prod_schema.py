import os, sys, django
sys.path.insert(0, '/root/TSFSYSTEM/erp_backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()

from django.db import connection

cursor = connection.cursor()

print("=== FIXING PRODUCTION SCHEMA ===\n")

# 1. Add missing columns to 'user' table
user_fixes = [
    ("override_pin", "ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS override_pin VARCHAR(128) NULL"),
    ("two_factor_secret", "ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(64) NULL"),
    ("two_factor_enabled", "ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE NOT NULL"),
]

for col_name, sql in user_fixes:
    try:
        cursor.execute(sql)
        print(f"  [OK] user.{col_name}")
    except Exception as e:
        print(f"  [SKIP] user.{col_name}: {e}")

# 2. Create manageroverridelog table
try:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS manageroverridelog (
            id BIGSERIAL PRIMARY KEY,
            action VARCHAR(100) NOT NULL,
            reason TEXT DEFAULT '' NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            performed_by_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
            order_id BIGINT NULL,
            organization_id BIGINT REFERENCES organization(id) ON DELETE CASCADE
        )
    """)
    print("  [OK] manageroverridelog table created")
except Exception as e:
    print(f"  [SKIP] manageroverridelog: {e}")

# 3. Create notification table
try:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notification (
            id BIGSERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            message TEXT DEFAULT '' NOT NULL,
            notification_type VARCHAR(50) DEFAULT 'info' NOT NULL,
            is_read BOOLEAN DEFAULT FALSE NOT NULL,
            link VARCHAR(500) NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            user_id BIGINT REFERENCES "user"(id) ON DELETE CASCADE NOT NULL
        )
    """)
    print("  [OK] notification table created")
except Exception as e:
    print(f"  [SKIP] notification: {e}")

# 4. Create udlesavedview table
try:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS udlesavedview (
            id BIGSERIAL PRIMARY KEY,
            model_name VARCHAR(100) NOT NULL,
            name VARCHAR(100) NOT NULL,
            config JSONB DEFAULT '{}' NOT NULL,
            is_default BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            user_id BIGINT REFERENCES "user"(id) ON DELETE CASCADE NOT NULL,
            organization_id BIGINT REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
            UNIQUE(user_id, model_name, name)
        )
    """)
    print("  [OK] udlesavedview table created")
except Exception as e:
    print(f"  [SKIP] udlesavedview: {e}")

# 5. Create transactionstatuslog table if missing
try:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactionstatuslog (
            id BIGSERIAL PRIMARY KEY,
            transaction_type VARCHAR(50) NOT NULL,
            transaction_id BIGINT NOT NULL,
            from_status VARCHAR(50) DEFAULT '' NOT NULL,
            to_status VARCHAR(50) NOT NULL,
            notes TEXT DEFAULT '' NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            performed_by_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL
        )
    """)
    print("  [OK] transactionstatuslog table created")
except Exception as e:
    print(f"  [SKIP] transactionstatuslog: {e}")

# 6. Create transactionverificationconfig table if missing
try:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactionverificationconfig (
            id BIGSERIAL PRIMARY KEY,
            transaction_type VARCHAR(50) NOT NULL,
            required_levels INTEGER DEFAULT 1 NOT NULL,
            is_active BOOLEAN DEFAULT TRUE NOT NULL,
            organization_id BIGINT REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
            UNIQUE(organization_id, transaction_type)
        )
    """)
    print("  [OK] transactionverificationconfig table created")
except Exception as e:
    print(f"  [SKIP] transactionverificationconfig: {e}")

connection.connection.commit()
print("\n=== SCHEMA FIX COMPLETE ===")
