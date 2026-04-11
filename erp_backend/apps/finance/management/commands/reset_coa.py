from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Reset COA to clean IFRS state (removes ALL non-IFRS accounts)'
    
    def handle(self, *args, **options):
        c = connection.cursor()
        non_ifrs_sql = "(SELECT id FROM chartofaccount WHERE template_origin != 'IFRS_COA' OR template_origin IS NULL)"
        
        # Find ALL tables that reference chartofaccount
        c.execute("""
            SELECT tc.table_name, kcu.column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'chartofaccount'
        """)
        fk_tables = c.fetchall()
        
        # Delete from all referencing tables for non-IFRS accounts
        for table, col in fk_tables:
            try:
                c.execute(f"DELETE FROM {table} WHERE {col} IN {non_ifrs_sql}")
                if c.rowcount > 0:
                    self.stdout.write(f'  Cleaned {table}.{col}: {c.rowcount} rows')
            except Exception as e:
                self.stdout.write(f'  SKIP {table}.{col}: {e}')
        
        # Delete migration JEs
        c.execute("DELETE FROM journalentryline WHERE journal_entry_id IN (SELECT id FROM journalentry WHERE reference LIKE 'MIG-%%')")
        if c.rowcount > 0: self.stdout.write(f'Deleted MIG JE lines: {c.rowcount}')
        c.execute("DELETE FROM journalentry WHERE reference LIKE 'MIG-%%'")
        if c.rowcount > 0: self.stdout.write(f'Deleted MIG JEs: {c.rowcount}')
        
        # Delete ALL non-IFRS accounts
        c.execute("DELETE FROM chartofaccount WHERE template_origin != 'IFRS_COA' OR template_origin IS NULL")
        self.stdout.write(f'Deleted non-IFRS accounts: {c.rowcount}')
        
        # Reactivate all IFRS
        c.execute("UPDATE chartofaccount SET is_active = true WHERE is_active = false")
        self.stdout.write(f'Reactivated IFRS: {c.rowcount}')
        
        # Summary
        c.execute('SELECT template_origin, is_active, COUNT(*) FROM chartofaccount GROUP BY template_origin, is_active ORDER BY template_origin')
        self.stdout.write('\n=== Final State ===')
        for r in c.fetchall():
            self.stdout.write(f'  template={r[0]:20s} active={str(r[1]):5s} count={r[2]}')
        
        c.execute("SELECT code, name, balance FROM chartofaccount WHERE ABS(balance) > 0.01 ORDER BY code")
        rows = c.fetchall()
        self.stdout.write(f'\nAccounts with balances: {len(rows)}')
        for r in rows:
            self.stdout.write(f'  {r[0]:12s} {r[1][:35]:35s} bal={float(r[2]):>12,.2f}')
