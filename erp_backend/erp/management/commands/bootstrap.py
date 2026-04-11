"""
bootstrap — Master bootstrap command for fresh TSFSYSTEM installations.

Orchestrates ALL required seeders in dependency order:

    1. seed_reference    → ISO currencies, countries, country-currency mappings
    2. seed_core         → Business types, plans, SaaS org, modules, legacy currencies/countries
    3. seed_coa_templates → COA templates (IFRS, Lebanese PCN, French PCG, SYSCOHADA)
    4. seed_themes       → Theme presets
    5. seed_feature_flags → Feature flag defaults
    6. seed_permissions  → Core permission tuples
    7. seed_scope_permission → Module scope permissions

Usage:
    python manage.py bootstrap
    python manage.py bootstrap --skip=seed_themes,seed_feature_flags

Idempotent: safe to run multiple times.
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command


# Ordered list of seeders — dependencies first
SEEDERS = [
    # Layer 0: Global reference data (no dependencies)
    ('seed_reference', 'ISO Currencies, Countries, Country-Currency mappings'),
    # Layer 1: Core platform data (depends on reference)
    ('seed_core', 'Business types, Plans, SaaS Org, Modules'),
    # Layer 2: Finance templates (depends on core)
    ('seed_coa_templates', 'COA Templates (IFRS, PCN, PCG, SYSCOHADA)'),
    # Layer 2b: Per-org commercial defaults
    ('seed_payment_terms', 'Default payment terms (Immediate, COD, Net 15/30/45/60/90, 2/10 Net 30)'),
    # Layer 3: UI/UX defaults
    ('seed_themes', 'Theme presets'),
    ('seed_feature_flags', 'Feature flag defaults'),
    # Layer 4: Permissions
    ('seed_permissions', 'Core permission tuples'),
    ('seed_scope_permission', 'Module scope permissions'),
]


class Command(BaseCommand):
    help = (
        'Master bootstrap for fresh TSFSYSTEM installations. '
        'Runs all seeders in dependency order (idempotent).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip',
            type=str,
            default='',
            help='Comma-separated list of seeder names to skip (e.g. --skip=seed_themes,seed_feature_flags)',
        )
        parser.add_argument(
            '--only',
            type=str,
            default='',
            help='Comma-separated list of seeder names to run exclusively (e.g. --only=seed_reference,seed_core)',
        )

    def handle(self, *args, **options):
        skip = set(filter(None, options['skip'].split(',')))
        only = set(filter(None, options['only'].split(',')))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('╔══════════════════════════════════════════════╗'))
        self.stdout.write(self.style.SUCCESS('║      🚀 TSFSYSTEM BOOTSTRAP                 ║'))
        self.stdout.write(self.style.SUCCESS('╚══════════════════════════════════════════════╝'))
        self.stdout.write('')

        success_count = 0
        skip_count = 0
        fail_count = 0

        for name, description in SEEDERS:
            # Apply filters
            if only and name not in only:
                continue
            if name in skip:
                self.stdout.write(f'  ⏭️  {name:30s} — skipped')
                skip_count += 1
                continue

            self.stdout.write(f'  ▶  {name:30s} — {description}')
            try:
                call_command(name)
                success_count += 1
                self.stdout.write(f'  ✅ {name:30s} — done')
            except Exception as e:
                fail_count += 1
                self.stdout.write(
                    self.style.ERROR(f'  ❌ {name:30s} — FAILED: {e}')
                )

        self.stdout.write('')
        self.stdout.write('─' * 50)
        status = f'✅ {success_count} succeeded'
        if skip_count:
            status += f'  ⏭️ {skip_count} skipped'
        if fail_count:
            status += f'  ❌ {fail_count} failed'
        self.stdout.write(f'  {status}')
        self.stdout.write('─' * 50)

        if fail_count:
            self.stdout.write(
                self.style.ERROR('⚠️  Some seeders failed. Fix errors and re-run: python manage.py bootstrap')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS('🎉 Bootstrap complete! System is ready.')
            )
        self.stdout.write('')
