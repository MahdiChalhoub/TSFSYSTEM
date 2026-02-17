"""Apply migration 0002 manually — adds business selector + sync mode fields."""
import django, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()

from django.db import connection

c = connection.cursor()

# Check existing columns
c.execute(
    "SELECT column_name FROM information_schema.columns "
    "WHERE table_name = %s", ['data_migration_migrationjob']
)
cols = [r[0] for r in c.fetchall()]
print('Current columns:', cols)

added = []
if 'source_business_id' not in cols:
    c.execute('ALTER TABLE data_migration_migrationjob ADD COLUMN source_business_id INTEGER NULL')
    added.append('source_business_id')

if 'source_business_name' not in cols:
    c.execute('ALTER TABLE data_migration_migrationjob ADD COLUMN source_business_name VARCHAR(255) NULL')
    added.append('source_business_name')

if 'migration_mode' not in cols:
    c.execute("ALTER TABLE data_migration_migrationjob ADD COLUMN migration_mode VARCHAR(10) NOT NULL DEFAULT 'FULL'")
    added.append('migration_mode')

if added:
    print('Added columns:', added)
else:
    print('All columns already exist')

# Mark migration as applied
c.execute(
    "SELECT count(*) FROM django_migrations "
    "WHERE app = %s AND name = %s",
    ['data_migration', '0002_add_business_selection_and_sync_mode']
)
if c.fetchone()[0] == 0:
    c.execute(
        "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, NOW())",
        ['data_migration', '0002_add_business_selection_and_sync_mode']
    )
    print('Migration record inserted')
else:
    print('Migration already recorded')

# Final check
c.execute(
    "SELECT column_name FROM information_schema.columns "
    "WHERE table_name = %s ORDER BY column_name",
    ['data_migration_migrationjob']
)
print('Final columns:', [r[0] for r in c.fetchall()])
print('DONE')
