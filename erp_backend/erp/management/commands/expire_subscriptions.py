from django.core.management.base import BaseCommand
from erp.services_subscription import SubscriptionService

class Command(BaseCommand):
    help = 'Process subscription expiries and restrict access for expired organizations.'

    def handle(self, *args, **options):
        self.stdout.write("Processing subscription expiries...")
        count = SubscriptionService.process_expiries()
        self.stdout.write(self.style.SUCCESS(f"Successfully processed expiries. Restricted {count} organizations."))
