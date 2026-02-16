"""
Management command to fix migration inconsistencies.
Usage:
    python manage.py fix_migrations                # Show state
    python manage.py fix_migrations --check-tables # Show which tables exist
    python manage.py fix_migrations --fix          # Remove all fake records
    python manage.py fix_migrations --run          # Fix + migrate
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import connection


class Command(BaseCommand):
    help = 'Fix migration inconsistencies'

    def add_arguments(self, parser):
        parser.add_argument('--fix', action='store_true')
        parser.add_argument('--run', action='store_true')
        parser.add_argument('--check-tables', action='store_true')

    def _count_tables(self, cursor, prefix):
        cursor.execute(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name LIKE %s",
            [f'{prefix}_%']
        )
        return cursor.fetchone()[0]

    def handle(self, *args, **options):
        cursor = connection.cursor()
        do_fix = options.get('fix') or options.get('run')
        do_run = options.get('run')

        if options.get('check_tables'):
            for prefix in ['pos', 'finance', 'crm', 'inventory', 'erp']:
                self.stdout.write(f'  {prefix}_*: {self._count_tables(cursor, prefix)} tables')
            return

        # Show state
        apps = ['pos', 'finance', 'crm']
        for app in apps:
            cursor.execute("SELECT COUNT(*) FROM django_migrations WHERE app=%s", [app])
            records = cursor.fetchone()[0]
            tables = self._count_tables(cursor, app)
            self.stdout.write(f'  {app}: {records} migration records, {tables} DB tables')

        if do_fix:
            self.stdout.write('\n=== FIXING ===')
            # Remove ALL records for apps with 0 tables
            for app in apps:
                if self._count_tables(cursor, app) == 0:
                    cursor.execute("DELETE FROM django_migrations WHERE app=%s", [app])
                    self.stdout.write(f'  Deleted ALL {app} migration records (0 tables in DB)')

            # Remove fake-inserted erp >= 0043
            cursor.execute(
                "DELETE FROM django_migrations WHERE app='erp' AND name >= '0043_transaction_lifecycle'"
            )
            deleted = cursor.rowcount
            if deleted:
                self.stdout.write(f'  Deleted {deleted} fake erp migration records >= 0043')

            self.stdout.write('  FIX COMPLETE')

        if do_run:
            self.stdout.write('\n=== RUNNING MIGRATE ===')
            try:
                call_command('migrate', '--no-input', verbosity=1)
                self.stdout.write('\nMIGRATE SUCCEEDED')
            except Exception as e:
                self.stdout.write(f'\nMIGRATE FAILED: {e}')
