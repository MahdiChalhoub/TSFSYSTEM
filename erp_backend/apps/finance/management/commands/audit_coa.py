from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Audit chart of accounts and JEs'
    
    def handle(self, *args, **options):
        c = connection.cursor()
        
        c.execute('SELECT template_origin, is_active, COUNT(*) FROM chartofaccount GROUP BY template_origin, is_active ORDER BY template_origin')
        self.stdout.write('=== Account State ===')
        for r in c.fetchall():
            self.stdout.write(f'  template={r[0]:20s} active={str(r[1]):5s} count={r[2]}')
        
        c.execute("SELECT code, name, balance FROM chartofaccount WHERE ABS(balance) > 0.01 AND is_active = true ORDER BY code")
        rows = c.fetchall()
        self.stdout.write(f'\nActive with balances: {len(rows)}')
        for r in rows:
            self.stdout.write(f'  {r[0]:12s} {r[1][:35]:35s} bal={float(r[2]):>12,.2f}')
        
        c.execute("SELECT COUNT(*) FROM journalentry")
        self.stdout.write(f'\nTotal JEs: {c.fetchone()[0]}')
        c.execute("SELECT COUNT(*) FROM journalentry WHERE status = 'POSTED'")
        self.stdout.write(f'Posted JEs: {c.fetchone()[0]}')
