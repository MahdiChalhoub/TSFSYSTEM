"""
Management command to fix migration inconsistencies.
Removes fake migration records and lets them run properly.
Usage: python manage.py fix_migrations
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone


class Command(BaseCommand):
    help = 'Fix migration inconsistencies'

    def add_arguments(self, parser):
        parser.add_argument('--fix', action='store_true', help='Actually fix (delete and re-record)')
        parser.add_argument('--check-tables', action='store_true', help='Check which pos/finance tables exist')

    def handle(self, *args, **options):
        cursor = connection.cursor()
        do_fix = options.get('fix', False)
        check_tables = options.get('check_tables', False)

        if check_tables:
            self.stdout.write('\n=== CHECKING TABLES IN DATABASE ===')
            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema='public' AND table_name LIKE 'pos_%'
                ORDER BY table_name
            """)
            pos_tables = [r[0] for r in cursor.fetchall()]
            self.stdout.write(f'POS tables ({len(pos_tables)}):')
            for t in pos_tables:
                self.stdout.write(f'  {t}')

            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema='public' AND table_name LIKE 'finance_%'
                ORDER BY table_name
            """)
            fin_tables = [r[0] for r in cursor.fetchall()]
            self.stdout.write(f'\nFinance tables ({len(fin_tables)}):')
            for t in fin_tables:
                self.stdout.write(f'  {t}')

            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema='public' AND table_name LIKE 'crm_%'
                ORDER BY table_name
            """)
            crm_tables = [r[0] for r in cursor.fetchall()]
            self.stdout.write(f'\nCRM tables ({len(crm_tables)}):')
            for t in crm_tables:
                self.stdout.write(f'  {t}')
            return

        # Show currently applied per app
        for app in ['erp', 'pos', 'crm', 'finance', 'inventory']:
            cursor.execute(
                "SELECT name FROM django_migrations WHERE app = %s ORDER BY id", [app]
            )
            rows = [r[0] for r in cursor.fetchall()]
            self.stdout.write(f'\n=== {app.upper()} ({len(rows)} applied) ===')
            for r in rows[-5:]:
                self.stdout.write(f'  [X] {r}')
            if len(rows) > 5:
                self.stdout.write(f'  ... and {len(rows)-5} more')

        if do_fix:
            self.stdout.write('\n\n=== APPLYING FIX ===')
            
            # Delete fake POS migration records for migrations whose tables don't exist
            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema='public' AND table_name = 'pos_order'
            """)
            pos_order_exists = cursor.fetchone()
            
            if not pos_order_exists:
                self.stdout.write('pos_order table does NOT exist.')
                self.stdout.write('Removing ALL pos migration records so they can run fresh...')
                cursor.execute("DELETE FROM django_migrations WHERE app = 'pos'")
                self.stdout.write('  -> Deleted all POS migration records')
                
                # Also need to remove erp migrations that were fake-applied
                # if their tables don't exist
                cursor.execute("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema='public' AND table_name LIKE 'erp_%'
                    ORDER BY table_name
                """)
                erp_tables = [r[0] for r in cursor.fetchall()]
                self.stdout.write(f'\nExisting erp tables: {len(erp_tables)}')

            # Check finance tables
            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema='public' AND table_name = 'finance_payment'
            """)
            payment_exists = cursor.fetchone()
            if not payment_exists:
                self.stdout.write('\nfinance_payment table does NOT exist.')
                self.stdout.write('Checking which finance migrations need to be unapplied...')
                # Keep initial migrations that created existing tables, remove later ones
                cursor.execute("""
                    SELECT name FROM django_migrations WHERE app = 'finance' ORDER BY id
                """)
                applied = [r[0] for r in cursor.fetchall()]
                self.stdout.write(f'  Currently applied: {applied}')
                
                # Delete finance migrations that reference non-existent tables
                # Keep 0001-0004 (basic setup), delete 0005+ (they reference pos/erp tables)
                migrations_to_remove = [m for m in applied if m >= '0005']
                if migrations_to_remove:
                    for m in migrations_to_remove:
                        cursor.execute(
                            "DELETE FROM django_migrations WHERE app = 'finance' AND name = %s", [m]
                        )
                        self.stdout.write(f'    -> Removed finance.{m}')
            
            self.stdout.write('\n=== FIX APPLIED. Try "python manage.py migrate" now ===')
        else:
            self.stdout.write('\n\nRun with --fix to apply changes')
            self.stdout.write('Run with --check-tables to see which tables exist')
