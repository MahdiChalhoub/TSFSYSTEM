"""
Management Command: seed_org_tax_policy
==========================================
Seeds a default OrgTaxPolicy for all organizations that don't have one yet,
derived from their existing companyType setting.

companyType mapping:
    REAL   → vat_output_enabled=True,  vat_input_recoverability=1.0, airsi=RECOVER
    MIXED  → vat_output_enabled=True,  vat_input_recoverability=1.0, airsi=CAPITALIZE
    MICRO  → vat_output_enabled=False, vat_input_recoverability=0.0, airsi=EXPENSE
    REGULAR→ vat_output_enabled=False, vat_input_recoverability=0.0, airsi=CAPITALIZE

Run:
    python manage.py seed_org_tax_policy
    python manage.py seed_org_tax_policy --org-id 3 --dry-run
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction


COMPANY_TYPE_TO_POLICY = {
    'REAL': {
        'vat_output_enabled': True,
        'vat_input_recoverability': Decimal('1.000'),
        'airsi_treatment': 'RECOVER',
        'internal_cost_mode': 'SAME_AS_OFFICIAL',
        'purchase_tax_rate': Decimal('0.0000'),
        'purchase_tax_mode': 'CAPITALIZE',
        'sales_tax_rate': Decimal('0.0000'),
        'sales_tax_trigger': 'NONE',
        'periodic_amount': Decimal('0.00'),
        'periodic_interval': 'NONE',
        'profit_tax_mode': 'NONE',
    },
    'MIXED': {
        'vat_output_enabled': True,
        'vat_input_recoverability': Decimal('1.000'),
        'airsi_treatment': 'CAPITALIZE',
        'internal_cost_mode': 'TTC_ALWAYS',
        'purchase_tax_rate': Decimal('0.0000'),
        'purchase_tax_mode': 'CAPITALIZE',
        'sales_tax_rate': Decimal('0.0000'),
        'sales_tax_trigger': 'NONE',
        'periodic_amount': Decimal('0.00'),
        'periodic_interval': 'NONE',
        'profit_tax_mode': 'NONE',
    },
    'MICRO': {
        'vat_output_enabled': False,
        'vat_input_recoverability': Decimal('0.000'),
        'airsi_treatment': 'EXPENSE',
        'internal_cost_mode': 'TTC_ALWAYS',
        'purchase_tax_rate': Decimal('0.0000'),
        'purchase_tax_mode': 'CAPITALIZE',
        'sales_tax_rate': Decimal('0.0200'),  # micro forfait 2%
        'sales_tax_trigger': 'ON_TURNOVER',
        'periodic_amount': Decimal('0.00'),
        'periodic_interval': 'MONTHLY',
        'profit_tax_mode': 'NONE',
    },
    'REGULAR': {
        'vat_output_enabled': False,
        'vat_input_recoverability': Decimal('0.000'),
        'airsi_treatment': 'CAPITALIZE',
        'internal_cost_mode': 'TTC_ALWAYS',
        'purchase_tax_rate': Decimal('0.0000'),
        'purchase_tax_mode': 'CAPITALIZE',
        'sales_tax_rate': Decimal('0.0000'),
        'sales_tax_trigger': 'NONE',
        'periodic_amount': Decimal('0.00'),
        'periodic_interval': 'NONE',
        'profit_tax_mode': 'NONE',
    },
}


class Command(BaseCommand):
    help = 'Seed a default OrgTaxPolicy for organizations that lack one'

    def add_arguments(self, parser):
        parser.add_argument('--org-id', type=int, default=None)
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        from erp.models import Organization
        from erp.services import ConfigurationService
        from apps.finance.models import OrgTaxPolicy

        org_id = options.get('org_id')
        dry_run = options.get('dry_run', False)

        orgs = Organization.objects.all()
        if org_id:
            orgs = orgs.filter(id=org_id)

        created = skipped = 0

        for org in orgs:
            has_policy = OrgTaxPolicy.objects.filter(organization=org).exists()
            if has_policy:
                skipped += 1
                self.stdout.write(f'  SKIP (has policy): [{org.id}] {org.name}')
                continue

            try:
                settings = ConfigurationService.get_global_settings(org)
                company_type = settings.get('companyType', 'REGULAR')
            except Exception:
                company_type = 'REGULAR'

            policy_defaults = COMPANY_TYPE_TO_POLICY.get(company_type, COMPANY_TYPE_TO_POLICY['REGULAR'])
            name = f'{org.name} — Policy ({company_type})'

            verb = 'WOULD CREATE' if dry_run else 'CREATED'
            self.stdout.write(self.style.SUCCESS(f'  {verb}: [{org.id}] {org.name} → {company_type}'))

            if not dry_run:
                with transaction.atomic():
                    OrgTaxPolicy.objects.create(
                        organization=org,
                        name=name,
                        is_default=True,
                        **policy_defaults,
                    )
            created += 1

        self.stdout.write(
            self.style.SUCCESS(f'\nDone. Created: {created} | Skipped (already had policy): {skipped}')
        )
