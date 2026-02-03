from django.core.management.base import BaseCommand
from erp.module_manager import ModuleManager

class Command(BaseCommand):
    help = 'Scans the modules directory and syncs global Module table'

    def handle(self, *args, **options):
        self.stdout.write("🔍 Scanning for modules...")
        codes = ModuleManager.sync()
        if codes:
            for code in codes:
                self.stdout.write(self.style.SUCCESS(f"✅ Synced module: {code}"))
            self.stdout.write(self.style.SUCCESS(f"Total synced: {len(codes)}"))
        else:
            self.stdout.write(self.style.WARNING("No modules found."))
