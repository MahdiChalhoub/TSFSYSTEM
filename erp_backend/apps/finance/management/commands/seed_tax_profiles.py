"""
Management Command: seed_tax_profiles
======================================
Seeds the standard CounterpartyTaxProfile presets for all organizations
(or a single org via --org-id).

Run:
    python manage.py seed_tax_profiles
    python manage.py seed_tax_profiles --org-id 3 --dry-run
"""
from django.core.management.base import BaseCommand
from django.db import transaction


# Names match the PRESET_* constants in counterparty_tax_profile.py
PRESETS = [
    {
        'name': 'Assujetti TVA',
        'vat_registered': True,
        'reverse_charge': False,
        'airsi_subject': False,
        'allowed_scopes': ['OFFICIAL', 'INTERNAL'],
        'country_code': 'CI',
        'is_system_preset': True,
    },
    {
        'name': 'Non-Assujetti',
        'vat_registered': False,
        'reverse_charge': False,
        'airsi_subject': False,
        'allowed_scopes': ['OFFICIAL', 'INTERNAL'],
        'country_code': 'CI',
        'is_system_preset': True,
    },
    {
        'name': 'Foreign B2B (Reverse Charge)',
        'vat_registered': False,
        'reverse_charge': True,
        'airsi_subject': False,
        'allowed_scopes': ['OFFICIAL'],
        'country_code': '',
        'is_system_preset': True,
    },
    {
        'name': 'AIRSI Subject',
        'vat_registered': False,
        'reverse_charge': False,
        'airsi_subject': True,
        'allowed_scopes': ['OFFICIAL', 'INTERNAL'],
        'country_code': 'CI',
        'is_system_preset': True,
    },
    {
        'name': 'Export Client',
        'vat_registered': True,
        'reverse_charge': False,
        'airsi_subject': False,
        'allowed_scopes': ['OFFICIAL'],
        'country_code': '',
        'is_system_preset': True,
    },
]


class Command(BaseCommand):
    help = 'Seed standard CounterpartyTaxProfile presets for all organizations'

    def add_arguments(self, parser):
        parser.add_argument('--org-id', type=int, default=None,
                            help='Limit seeding to a specific organization ID')
        parser.add_argument('--dry-run', action='store_true',
                            help='Print what would be created without writing to DB')

    def handle(self, *args, **options):
        from erp.models import Organization
        from apps.finance.models import CounterpartyTaxProfile

        org_id  = options.get('org_id')
        dry_run = options.get('dry_run', False)

        orgs = Organization.objects.all()
        if org_id:
            orgs = orgs.filter(id=org_id)

        if not orgs.exists():
            self.stdout.write(self.style.ERROR('No organizations found.'))
            return

        total_created  = 0
        total_existing = 0

        for org in orgs:
            self.stdout.write(f'\n[{org.id}] {org.name}')
            with transaction.atomic():
                for preset in PRESETS:
                    exists = CounterpartyTaxProfile.objects.filter(
                        organization=org,
                        name=preset['name'],
                    ).exists()

                    if exists:
                        total_existing += 1
                        if dry_run:
                            self.stdout.write(f'  SKIP (exists): {preset["name"]}')
                    else:
                        if not dry_run:
                            CounterpartyTaxProfile.objects.create(
                                organization=org,
                                **preset,
                            )
                        total_created += 1
                        verb = 'WOULD CREATE' if dry_run else 'CREATED'
                        self.stdout.write(self.style.SUCCESS(f'  {verb}: {preset["name"]}'))

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone. Created: {total_created} | Already existed: {total_existing}'
            )
        )
