"""
Management Command: assign_contact_tax_profiles
================================================
Backfills `tax_profile_id` on existing Contacts based on their
`is_airsi_subject` flag and `client_type` column
(note: supplier_vat_regime was never migrated to this DB).

Must be run AFTER `seed_tax_profiles`.

Mapping:
    is_airsi_subject=True  → 'AIRSI Subject'
    client_type='B2B'      → 'Assujetti TVA'
    client_type='B2C'      → 'Non-Assujetti'
    default                → 'Assujetti TVA'

Contacts that already have a tax_profile_id are skipped (idempotent).

Run:
    python manage.py assign_contact_tax_profiles
    python manage.py assign_contact_tax_profiles --org-id 3 --dry-run
"""
from django.core.management.base import BaseCommand
from django.db import transaction


COMMERCIAL_CATEGORY_MAP = {
    'AIRSI Subject':            'NORMAL',
    'Assujetti TVA':            'CORPORATE',
    'Non-Assujetti':            'RETAIL',
    'Foreign B2B (Reverse Charge)': 'NORMAL',
    'Export Client':            'NORMAL',
}


class Command(BaseCommand):
    help = 'Backfill tax_profile_id on Contacts from is_airsi_subject / client_type'

    def add_arguments(self, parser):
        parser.add_argument('--org-id', type=int, default=None)
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        from erp.models import Organization
        from erp.connector_registry import connector
        Contact = connector.require('crm.contacts.get_model', org_id=0, source='finance')
        if not Contact:
            self.stderr.write(self.style.ERROR('CRM module is required for this command.'))
            return
        from apps.finance.models import CounterpartyTaxProfile

        org_id  = options.get('org_id')
        dry_run = options.get('dry_run', False)

        orgs = Organization.objects.all()
        if org_id:
            orgs = orgs.filter(id=org_id)

        total_assigned = 0
        total_skipped  = 0
        total_no_match = 0

        for org in orgs:
            self.stdout.write(f'\n[{org.id}] {org.name}')

            # Build preset map for this org keyed by name
            presets = {
                p.name: p
                for p in CounterpartyTaxProfile.objects.filter(organization=org)
            }

            if not presets:
                self.stdout.write(
                    self.style.WARNING('  ! No presets found. Run seed_tax_profiles first.')
                )
                continue

            # Use .values() on only existing columns to avoid querying non-migrated fields
            contacts_qs = Contact.objects.filter(organization=org).values(
                'id', 'name', 'is_airsi_subject', 'client_type', 'tax_profile_id'
            )

            for contact_data in contacts_qs:
                if contact_data['tax_profile_id']:
                    total_skipped += 1
                    continue

                is_airsi    = contact_data['is_airsi_subject'] or False
                client_type = contact_data['client_type'] or ''

                if is_airsi:
                    target_preset_name = 'AIRSI Subject'
                elif client_type == 'B2C':
                    target_preset_name = 'Non-Assujetti'
                else:
                    # B2B, supplier, or unknown → business default
                    target_preset_name = 'Assujetti TVA'

                preset = presets.get(target_preset_name)
                if not preset:
                    total_no_match += 1
                    self.stdout.write(self.style.WARNING(
                        f'  PRESET NOT FOUND: {target_preset_name!r} for {contact_data["name"]}'
                    ))
                    continue

                commercial_cat = COMMERCIAL_CATEGORY_MAP.get(target_preset_name, 'NORMAL')
                verb = 'WOULD ASSIGN' if dry_run else 'ASSIGNED'
                self.stdout.write(self.style.SUCCESS(
                    f'  {verb}: {contact_data["name"]} → {preset.name} [{commercial_cat}]'
                ))

                if not dry_run:
                    with transaction.atomic():
                        Contact.objects.filter(id=contact_data['id']).update(
                            tax_profile_id=preset.id,
                            commercial_category=commercial_cat,
                        )
                total_assigned += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone. Assigned: {total_assigned} | Already had profile: {total_skipped} | No preset: {total_no_match}'
            )
        )
