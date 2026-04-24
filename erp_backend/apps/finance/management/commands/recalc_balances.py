from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Recalculate all account balances from posted JE lines'
    
    def handle(self, *args, **options):
        c = connection.cursor()
        
        # Recalculate balance from posted, non-superseded JE lines.
        # Superseded rows are historical versions (e.g. an OPENING JE
        # replaced by a fresh close-generated one) — summing them would
        # double-count.
        c.execute("""
            UPDATE chartofaccount SET
                balance = COALESCE((
                    SELECT SUM(jl.debit) - SUM(jl.credit)
                    FROM journalentryline jl
                    JOIN journalentry je ON jl.journal_entry_id = je.id
                    WHERE jl.account_id = chartofaccount.id
                      AND je.status = 'POSTED'
                      AND je.is_superseded = FALSE
                ), 0),
                balance_official = COALESCE((
                    SELECT SUM(jl.debit) - SUM(jl.credit)
                    FROM journalentryline jl
                    JOIN journalentry je ON jl.journal_entry_id = je.id
                    WHERE jl.account_id = chartofaccount.id
                      AND je.status = 'POSTED'
                      AND je.is_superseded = FALSE
                      AND je.scope = 'OFFICIAL'
                ), 0)
        """)
        self.stdout.write(f'Recalculated balances for {c.rowcount} accounts')
        
        # Show accounts with balances
        c.execute("SELECT code, name, balance, balance_official FROM chartofaccount WHERE ABS(balance) > 0.01 ORDER BY code")
        rows = c.fetchall()
        self.stdout.write(f'\nAccounts with balances: {len(rows)}')
        for r in rows:
            self.stdout.write(f'  {r[0]:12s} {r[1][:35]:35s} bal={float(r[2]):>12,.2f}  off={float(r[3]):>12,.2f}')
        
        # Total check
        c.execute("SELECT SUM(balance) FROM chartofaccount")
        total = c.fetchone()[0]
        self.stdout.write(f'\nTotal balance (should be ~0): {float(total or 0):.2f}')
