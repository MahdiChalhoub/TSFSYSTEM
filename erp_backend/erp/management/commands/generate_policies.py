"""
Management command to auto-generate Connector Policies.
Creates default routing policies for all system modules.

Run with: python manage.py generate_policies
"""

from django.core.management.base import BaseCommand
from erp.models import SystemModule
from erp.connector_models import ConnectorPolicy, ModuleContract

# Default policy settings per module type
DEFAULT_POLICIES = {
    # Core modules - never should be unavailable
    'core': {
        'when_missing_read': 'error',  # Core missing = critical error
        'when_missing_write': 'error',
        'when_disabled_read': 'error',
        'when_disabled_write': 'error',
        'when_unauthorized_read': 'error',
        'when_unauthorized_write': 'error',
    },
    # Standard business modules
    'standard': {
        'when_missing_read': 'empty',
        'when_missing_write': 'buffer',
        'when_disabled_read': 'empty',
        'when_disabled_write': 'drop',
        'when_unauthorized_read': 'empty',
        'when_unauthorized_write': 'drop',
    }
}


class Command(BaseCommand):
    help = 'Generate Connector Policies for all installed system modules'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Overwrite existing policies',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without saving',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)
        dry_run = options.get('dry_run', False)

        self.stdout.write(self.style.NOTICE('🔍 Scanning installed modules...'))

        # Get all installed system modules
        modules = SystemModule.objects.filter(status='INSTALLED')
        
        if not modules.exists():
            self.stdout.write(self.style.WARNING('⚠️ No installed modules found'))
            return

        created_count = 0
        skipped_count = 0

        for module in modules:
            module_code = module.name.lower()
            
            # Check if policy exists
            existing = ConnectorPolicy.objects.filter(
                target_module=module_code,
                target_endpoint='*',
                source_module='*'
            ).first()

            if existing and not force:
                skipped_count += 1
                self.stdout.write(f'  ⏭️ {module_code}: Skipped (policy exists)')
                continue

            # Determine policy type
            is_core = module.manifest.get('is_core', False) or module_code == 'core'
            policy_template = DEFAULT_POLICIES['core'] if is_core else DEFAULT_POLICIES['standard']

            if dry_run:
                self.stdout.write(f'  🔹 {module_code}: Would create {"(core)" if is_core else "(standard)"}')
                continue

            # Create the policy
            policy, created = ConnectorPolicy.objects.update_or_create(
                source_module='*',
                target_module=module_code,
                target_endpoint='*',
                defaults={
                    **policy_template,
                    'cache_ttl_seconds': 300,
                    'buffer_ttl_seconds': 86400,
                    'max_buffer_size': 100,
                    'priority': 100 if is_core else 0,
                    'is_active': True
                }
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(
                    f'  ✅ {module_code}: Created {"(core - error on unavailable)" if is_core else "(standard - graceful fallback)"}'
                ))
            else:
                self.stdout.write(self.style.SUCCESS(f'  🔄 {module_code}: Updated'))

        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('📋 Policy Generation Complete'))
        self.stdout.write(f'   Created: {created_count}')
        self.stdout.write(f'   Skipped: {skipped_count}')
        self.stdout.write(self.style.SUCCESS('=' * 50))
