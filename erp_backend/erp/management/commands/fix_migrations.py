"""
Fix migration inconsistencies by removing fake records for apps with no tables.
Usage:
    python manage.py fix_migrations --fix          # Remove fake records
    python manage.py fix_migrations --check-tables # Check tables
"""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Fix migration inconsistencies'

    def add_arguments(self, parser):
        parser.add_argument('--fix', action='store_true')
        parser.add_argument('--check-tables', action='store_true')

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            if options.get('check_tables'):
                for prefix in ['pos', 'finance', 'crm', 'inventory', 'erp']:
                    cursor.execute(
                        "SELECT COUNT(*) FROM information_schema.tables "
                        "WHERE table_schema='public' AND table_name LIKE %s",
                        [f'{prefix}_%']
                    )
                    self.stdout.write(f'  {prefix}_*: {cursor.fetchone()[0]} tables')
                
                # List all migration records
                for app in ['pos', 'finance', 'crm']:
                    cursor.execute("SELECT name FROM django_migrations WHERE app=%s ORDER BY id", [app])
                    rows = cursor.fetchall()
                    self.stdout.write(f'\n  {app} migration records ({len(rows)}):')
                    for r in rows:
                        self.stdout.write(f'    {r[0]}')
                return

            if options.get('fix'):
                self.stdout.write('Removing fake records...')
                
                # Delete ALL migration records for apps with 0 tables
                for app in ['pos', 'finance', 'crm']:
                    cursor.execute(
                        "SELECT COUNT(*) FROM information_schema.tables "
                        "WHERE table_schema='public' AND table_name LIKE %s",
                        [f'{app}_%']
                    )
                    table_count = cursor.fetchone()[0]
                    if table_count == 0:
                        cursor.execute("DELETE FROM django_migrations WHERE app=%s", [app])
                        self.stdout.write(f'  DELETED all {app} records (0 tables exist)')
                    else:
                        self.stdout.write(f'  SKIPPED {app} ({table_count} tables exist)')

                # Remove fake erp >= 0043
                cursor.execute(
                    "DELETE FROM django_migrations WHERE app='erp' AND name >= '0043_transaction_lifecycle'"
                )
                if cursor.rowcount:
                    self.stdout.write(f'  DELETED {cursor.rowcount} fake erp >= 0043 records')

        # Force commit outside the cursor context
        connection.ensure_connection()
        if connection.connection:
            connection.connection.commit()
            self.stdout.write('COMMITTED to database.')
        
        # Verify
        with connection.cursor() as cursor:
            for app in ['pos', 'finance', 'crm']:
                cursor.execute("SELECT COUNT(*) FROM django_migrations WHERE app=%s", [app])
                self.stdout.write(f'  {app}: {cursor.fetchone()[0]} records remaining')
        
        self.stdout.write('DONE. Run: python manage.py migrate --no-input')
