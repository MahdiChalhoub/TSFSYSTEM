from django.core.management.base import BaseCommand
from django.utils import timezone
from erp.models import Organization
from erp.services_subscription import SubscriptionService

class Command(BaseCommand):
    help = 'Checks for expired subscriptions and updates organization status.'

    def handle(self, *args, **options):
        self.stdout.write("Running subscription expiry check...")
        
        count = SubscriptionService.process_expiries()
        
        if count > 0:
            self.stdout.write(self.style.WARNING(f"Updated {count} organizations to READ-ONLY status due to expired plans."))
        else:
            self.stdout.write(self.style.SUCCESS("No organizations expired today."))
