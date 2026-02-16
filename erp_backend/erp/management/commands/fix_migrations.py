"""
Temporary management command to check and fix migration state.
Usage: python manage.py fix_migrations
"""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Check migration state and fix inconsistencies'

    def handle(self, *args, **options):
        cursor = connection.cursor()
        
        # Show applied finance migrations
        cursor.execute(
            "SELECT app, name FROM django_migrations WHERE app = 'finance' ORDER BY id"
        )
        self.stdout.write('\n=== APPLIED FINANCE MIGRATIONS ===')
        applied = []
        for row in cursor.fetchall():
            self.stdout.write(f'  [X] {row[1]}')
            applied.append(row[1])

        # Show applied inventory migrations  
        cursor.execute(
            "SELECT app, name FROM django_migrations WHERE app = 'inventory' ORDER BY id"
        )
        self.stdout.write('\n=== APPLIED INVENTORY MIGRATIONS ===')
        for row in cursor.fetchall():
            self.stdout.write(f'  [X] {row[1]}')

        # Show all migration files on disk for finance
        import os
        finance_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', '..', 'apps', 'finance', 'migrations')
        finance_dir = os.path.normpath(finance_dir)
        self.stdout.write(f'\n=== FINANCE MIGRATION FILES ON DISK ({finance_dir}) ===')
        if os.path.exists(finance_dir):
            for f in sorted(os.listdir(finance_dir)):
                if f.endswith('.py') and f != '__init__.py':
                    marker = '[X]' if f.replace('.py', '') in applied else '[ ]'
                    self.stdout.write(f'  {marker} {f}')
        else:
            self.stdout.write(f'  Directory not found!')

        # Try to run migrate --plan to see what's pending
        self.stdout.write('\n=== MIGRATION PLAN ===')
        try:
            from django.core.management import call_command
            from io import StringIO
            out = StringIO()
            call_command('migrate', '--plan', stdout=out, stderr=out)
            self.stdout.write(out.getvalue())
        except Exception as e:
            self.stdout.write(f'  ERROR: {e}')
            # The error message itself tells us what's wrong
            error_str = str(e)
            self.stdout.write(f'\n=== FULL ERROR ===\n{error_str}')
