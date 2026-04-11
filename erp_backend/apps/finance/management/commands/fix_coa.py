from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Fix: reactivate all Lebanese PCN, deactivate everything else'
    
    def add_arguments(self, parser):
        parser.add_argument('--target', type=str, default='LEBANESE_PCN', help='Template to keep active')
    
    def handle(self, *args, **options):
        target = options['target']
        c = connection.cursor()
        
        # Reactivate target template
        c.execute(f"UPDATE chartofaccount SET is_active = true WHERE template_origin = %s AND is_active = false", [target])
        self.stdout.write(f'Reactivated {target}: {c.rowcount}')
        
        # Deactivate everything else
        c.execute(f"UPDATE chartofaccount SET is_active = false WHERE template_origin != %s AND is_active = true", [target])
        self.stdout.write(f'Deactivated non-{target}: {c.rowcount}')
        
        # Summary
        c.execute('SELECT template_origin, is_active, COUNT(*) FROM chartofaccount GROUP BY template_origin, is_active ORDER BY template_origin')
        self.stdout.write('\n=== Final State ===')
        for r in c.fetchall():
            self.stdout.write(f'  template={r[0]:20s} active={str(r[1]):5s} count={r[2]}')

        c.execute("SELECT COUNT(*) FROM chartofaccount WHERE is_active = true")
        self.stdout.write(f'\nTotal active: {c.fetchone()[0]}')
