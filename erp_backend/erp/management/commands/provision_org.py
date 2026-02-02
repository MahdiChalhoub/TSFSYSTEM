from django.core.management.base import BaseCommand
from erp.services import ProvisioningService

class Command(BaseCommand):
    help = 'Provisions a new organization with a full operational skeleton'

    def add_arguments(self, parser):
        parser.add_argument('name', type=str, help='Name of the organization')
        parser.add_argument('slug', type=str, help='Slug for the organization')

    def handle(self, *args, **options):
        name = options['name']
        slug = options['slug']
        
        self.stdout.write(f"🚀 Provisioning organization: {name} ({slug})...")
        
        try:
            org = ProvisioningService.provision_organization(name, slug)
            self.stdout.write(self.style.SUCCESS(f"✅ Successfully provisioned: {org.name} (UUID: {org.id})"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Failed to provision organization: {str(e)}"))
