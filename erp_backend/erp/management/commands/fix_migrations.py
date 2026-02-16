"""
Management command to fix migration inconsistencies.
Directly inserts missing migration records into django_migrations table.
Usage: python manage.py fix_migrations
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone


class Command(BaseCommand):
    help = 'Fix migration inconsistencies by inserting missing dependency records'

    def handle(self, *args, **options):
        cursor = connection.cursor()

        # Step 1: Show current state
        cursor.execute(
            "SELECT app, name FROM django_migrations WHERE app = 'finance' ORDER BY id"
        )
        applied_finance = [row[1] for row in cursor.fetchall()]
        self.stdout.write('\n=== APPLIED FINANCE MIGRATIONS ===')
        for m in applied_finance:
            self.stdout.write(f'  [X] {m}')

        cursor.execute(
            "SELECT app, name FROM django_migrations WHERE app = 'erp' AND name LIKE '%043%' ORDER BY id"
        )
        erp_43 = cursor.fetchall()
        self.stdout.write(f'\n=== ERP 0043 STATE ===')
        if erp_43:
            self.stdout.write(f'  [X] Already applied: {erp_43}')
        else:
            self.stdout.write(f'  [ ] NOT applied — this is the problem')

        # Step 2: Check what erp migrations ARE applied (up to and around 43)
        cursor.execute(
            "SELECT name FROM django_migrations WHERE app = 'erp' ORDER BY id"
        )
        applied_erp = [row[0] for row in cursor.fetchall()]
        self.stdout.write(f'\n=== APPLIED ERP MIGRATIONS (last 10) ===')
        for m in applied_erp[-10:]:
            self.stdout.write(f'  [X] {m}')
        self.stdout.write(f'  Total: {len(applied_erp)} migrations applied')

        # Step 3: Fix — insert erp 0043 if missing
        if not erp_43:
            self.stdout.write('\n=== FIXING: Inserting erp.0043_transaction_lifecycle ===')
            
            # First, check which erp migrations exist prior to 0043
            # We need to fake-insert all unapplied erp migrations up to and including 0043
            import os
            erp_migration_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                'migrations'
            )
            self.stdout.write(f'  Looking for erp migrations in: {erp_migration_dir}')
            
            # Get all migration file names
            if os.path.exists(erp_migration_dir):
                all_erp_files = sorted([
                    f.replace('.py', '') for f in os.listdir(erp_migration_dir)
                    if f.endswith('.py') and f != '__init__.py'
                ])
                self.stdout.write(f'  Found {len(all_erp_files)} migration files on disk')
                
                # Find unapplied migrations up to and including 0043
                unapplied = [m for m in all_erp_files if m not in applied_erp and m <= '0043_transaction_lifecycle']
                self.stdout.write(f'  Unapplied up to 0043: {len(unapplied)}')
                for m in unapplied:
                    self.stdout.write(f'    [ ] {m}')
                
                # Insert all unapplied ones
                now = timezone.now()
                for m in unapplied:
                    cursor.execute(
                        "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, %s)",
                        ['erp', m, now]
                    )
                    self.stdout.write(f'    -> Inserted erp.{m}')
                
                self.stdout.write(f'\n  Done! Inserted {len(unapplied)} migration records.')
            else:
                # Fallback: just insert 0043 directly
                self.stdout.write(f'  Migration dir not found, inserting 0043 directly')
                cursor.execute(
                    "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, %s)",
                    ['erp', '0043_transaction_lifecycle', timezone.now()]
                )
                self.stdout.write('  -> Inserted erp.0043_transaction_lifecycle')

        # Step 4: Verify
        cursor.execute(
            "SELECT app, name FROM django_migrations WHERE app = 'erp' AND name LIKE '%043%'"
        )
        check = cursor.fetchall()
        self.stdout.write(f'\n=== VERIFICATION ===')
        self.stdout.write(f'  erp.0043 now applied: {bool(check)}')

        # Step 5: Try migrate plan
        self.stdout.write('\n=== TESTING MIGRATE --PLAN ===')
        try:
            from django.core.management import call_command
            from io import StringIO
            out = StringIO()
            call_command('migrate', '--plan', stdout=out, stderr=out)
            plan = out.getvalue()
            self.stdout.write(plan[:1000] if plan else '  (empty plan — all up to date)')
        except Exception as e:
            self.stdout.write(f'  Still has error: {e}')
