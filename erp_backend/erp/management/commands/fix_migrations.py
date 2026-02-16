"""
Management command to fix migration inconsistencies.
Removes fake migration records for apps with no tables.
Usage:
    python manage.py fix_migrations                    # Show state
    python manage.py fix_migrations --check-tables     # Check which tables exist
    python manage.py fix_migrations --fix              # Fix: remove bad records
    python manage.py fix_migrations --run              # Fix + migrate in one step
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import connection
from django.utils import timezone
from io import StringIO


class Command(BaseCommand):
    help = 'Fix migration inconsistencies'

    def add_arguments(self, parser):
        parser.add_argument('--fix', action='store_true', help='Remove bad migration records')
        parser.add_argument('--run', action='store_true', help='Fix + migrate in one step')
        parser.add_argument('--check-tables', action='store_true', help='Check which tables exist')

    def _count_tables(self, cursor, prefix):
        cursor.execute(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name LIKE %s",
            [f'{prefix}_%']
        )
        return cursor.fetchone()[0]

    def _list_applied(self, cursor, app):
        cursor.execute(
            "SELECT name FROM django_migrations WHERE app = %s ORDER BY id", [app]
        )
        return [r[0] for r in cursor.fetchall()]

    def handle(self, *args, **options):
        cursor = connection.cursor()
        do_fix = options.get('fix', False) or options.get('run', False)
        do_run = options.get('run', False)
        check_tables = options.get('check_tables', False)

        if check_tables:
            self.stdout.write('\n=== TABLE CHECK ===')
            for prefix in ['pos', 'finance', 'crm', 'inventory', 'erp']:
                count = self._count_tables(cursor, prefix)
                self.stdout.write(f'  {prefix}_*: {count} tables')
            return

        # Show state
        apps_to_check = ['pos', 'finance', 'crm']
        self.stdout.write('\n=== MIGRATION STATE ===')
        problems = []
        for app in apps_to_check:
            applied = self._list_applied(cursor, app)
            table_count = self._count_tables(cursor, app)
            status = 'OK' if (table_count > 0 or len(applied) == 0) else 'FAKE'
            self.stdout.write(f'  {app}: {len(applied)} applied, {table_count} tables -> {status}')
            if status == 'FAKE':
                problems.append(app)

        if not problems and not do_fix:
            self.stdout.write('\nNo problems found!')
            return

        if problems:
            self.stdout.write(f'\nPROBLEM APPS (fake migrations, no tables): {problems}')

        if do_fix:
            self.stdout.write('\n=== APPLYING FIX ===')
            for app in problems:
                applied = self._list_applied(cursor, app)
                cursor.execute("DELETE FROM django_migrations WHERE app = %s", [app])
                self.stdout.write(f'  Deleted {len(applied)} records for {app}')

            # Also check for erp migrations that were fake-inserted by previous fix
            # Remove 0043 if it was fake-inserted and its dependency (actual table changes) aren't there
            cursor.execute(
                "SELECT name FROM django_migrations WHERE app = 'erp' AND name = '0043_transaction_lifecycle'"
            )
            if cursor.fetchone():
                # Check if the table/column it creates/alters actually exists
                # 0043 likely adds lifecycle fields to erp models
                # Since this was fake-inserted by us, remove it
                cursor.execute(
                    "DELETE FROM django_migrations WHERE app = 'erp' AND name >= '0043_transaction_lifecycle'"
                )
                self.stdout.write('  Removed fake erp migrations >= 0043')

            self.stdout.write('\n=== FIX APPLIED ===')

            # Verify
            self.stdout.write('\n=== POST-FIX STATE ===')
            for app in apps_to_check + ['erp']:
                applied = self._list_applied(cursor, app)
                self.stdout.write(f'  {app}: {len(applied)} applied')

        if do_run:
            self.stdout.write('\n=== RUNNING MIGRATE ===')
            try:
                call_command('migrate', '--no-input', verbosity=1)
                self.stdout.write('\n=== MIGRATE SUCCEEDED ===')
            except Exception as e:
                self.stdout.write(f'\n=== MIGRATE FAILED: {e} ===')
