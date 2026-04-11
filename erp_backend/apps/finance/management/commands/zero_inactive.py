from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Zero out balances on deactivated accounts (orphaned from deleted JEs)'
    
    def handle(self, *args, **options):
        c = connection.cursor()
        
        # Show current state
        c.execute("SELECT is_active, COUNT(*), SUM(balance) FROM chartofaccount GROUP BY is_active")
        self.stdout.write('=== Before ===')
        for r in c.fetchall():
            self.stdout.write(f'  active={str(r[0]):5s} count={r[1]} sum_balance={float(r[2] or 0):>12,.2f}')
        
        # Zero out balances on inactive accounts
        c.execute("UPDATE chartofaccount SET balance = 0, balance_official = 0 WHERE is_active = false AND (ABS(balance) > 0.01 OR ABS(balance_official) > 0.01)")
        self.stdout.write(f'\nZeroed {c.rowcount} inactive accounts')
        
        # Show after state
        c.execute("SELECT is_active, COUNT(*), SUM(balance) FROM chartofaccount GROUP BY is_active")
        self.stdout.write('\n=== After ===')
        for r in c.fetchall():
            self.stdout.write(f'  active={str(r[0]):5s} count={r[1]} sum_balance={float(r[2] or 0):>12,.2f}')
        
        # Show active accounts with balances
        c.execute("SELECT code, name, balance FROM chartofaccount WHERE is_active = true AND ABS(balance) > 0.01 ORDER BY code")
        rows = c.fetchall()
        self.stdout.write(f'\nActive with balances: {len(rows)}')
        for r in rows:
            self.stdout.write(f'  {r[0]:12s} {r[1][:35]:35s} bal={float(r[2]):>12,.2f}')
        
        c.execute("SELECT SUM(balance) FROM chartofaccount WHERE is_active = true")
        total = float(c.fetchone()[0] or 0)
        self.stdout.write(f'\nActive total balance: {total:.2f}')
