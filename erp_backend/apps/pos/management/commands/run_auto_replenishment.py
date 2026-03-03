from django.core.management.base import BaseCommand
from erp.models import Organization
from apps.pos.services.replenishment_service import AutomatedReplenishmentService

class Command(BaseCommand):
    help = 'Runs the automated procurement engine (Min/Max replenishment) for all active organizations.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting Automated Replenishment Engine..."))
        
        orgs = Organization.objects.filter(is_active=True)
        total_created = 0
        
        for org in orgs:
            try:
                self.stdout.write(f"Processing organization: {org.name}")
                result = AutomatedReplenishmentService.run_auto_replenishment(org)
                
                if result['pos_created'] > 0:
                    self.stdout.write(self.style.SUCCESS(
                        f"  -> Generated {result['pos_created']} Draft POs "
                        f"(Scanned {result['products_scanned']} products)"
                    ))
                    total_created += result['pos_created']
                else:
                    self.stdout.write(f"  -> Stock levels healthy. 0 POs generated. (Scanned {result['products_scanned']} products)")
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error processing {org.name}: {str(e)}"))
                
        self.stdout.write(self.style.SUCCESS(f"Finished. Total POs created across all orgs: {total_created}"))
