"""
Management Command: seed_org_tax_policy
==========================================
Seeds a default OrgTaxPolicy for all organizations that don't have one yet.

Resolution order:
  1. CountryTaxTemplate for the org's country → TaxTemplateService.apply_country_template()
  2. Legacy companyType mapping → simple COMPANY_TYPE_TO_POLICY map (backward compat)
  3. REGULAR defaults (safe no-VAT policy)

Run:
    python manage.py seed_org_tax_policy
    python manage.py seed_org_tax_policy --org-id 3 --dry-run
    python manage.py seed_org_tax_policy --org-id 3 --country-code CI
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
        'sales_tax_trigger': 'ON_TURNOVER',
        'periodic_amount': Decimal('0.00'),
        'periodic_interval': 'ANNUAL',
        'profit_tax_mode': 'STANDARD',
    },
    'MIXED': {
        'vat_output_enabled': True,
        'vat_input_recoverability': Decimal('0.000'),
        'airsi_treatment': 'CAPITALIZE',
        'internal_cost_mode': 'TTC_ALWAYS',
        'purchase_tax_rate': Decimal('0.0000'),
        'purchase_tax_mode': 'CAPITALIZE',
        'sales_tax_rate': Decimal('0.0000'),
        'sales_tax_trigger': 'ON_TURNOVER',
        'periodic_amount': Decimal('0.00'),
        'periodic_interval': 'ANNUAL',
        'profit_tax_mode': 'STANDARD',
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
        'profit_tax_mode': 'FORFAIT',
    },
    'REGULAR': {
        'vat_output_enabled': False,
        'vat_input_recoverability': Decimal('0.000'),
        'airsi_treatment': 'CAPITALIZE',
        'internal_cost_mode': 'TTC_ALWAYS',
        'purchase_tax_rate': Decimal('0.0000'),
        'purchase_tax_mode': 'CAPITALIZE',
        'sales_tax_rate': Decimal('0.0000'),
        'sales_tax_trigger': 'ON_TURNOVER',
        'periodic_amount': Decimal('0.00'),
        'periodic_interval': 'ANNUAL',
        'profit_tax_mode': 'EXEMPT',
    },
}


class Command(BaseCommand):
    help = 'Seed a default OrgTaxPolicy for organizations that lack one'

    def add_arguments(self, parser):
        parser.add_argument('--org-id', type=int, default=None)
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument(
            '--country-code', default=None,
            help='Force a specific ISO-2 country code for template lookup (e.g. CI, FR, US)'
        )

    def handle(self, *args, **options):
        from erp.models import Organization
        from erp.services import ConfigurationService
        from apps.finance.models import OrgTaxPolicy
        from apps.finance.services.tax_template_service import TaxTemplateService

        org_id = options.get('org_id')
        dry_run = options.get('dry_run', False)
        forced_country = (options.get('country_code') or '').strip().upper() or None

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

            # ── Step 1: Try CountryTaxTemplate approach ────────────────────
            country_code = forced_country or TaxTemplateService._resolve_country_code(org)

            if country_code:
                from apps.finance.models.country_tax_template import CountryTaxTemplate
                template_exists = CountryTaxTemplate.objects.filter(
                    country_code=country_code, is_active=True
                ).exists()

                if template_exists:
                    verb = 'WOULD APPLY TEMPLATE' if dry_run else 'APPLIED TEMPLATE'
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  {verb}: [{org.id}] {org.name} → template={country_code}'
                        )
                    )
                    if not dry_run:
                        result = TaxTemplateService.apply_country_template(org, country_code)
                        if result.get('errors'):
                            self.stdout.write(
                                self.style.WARNING(f'    Warnings: {result["errors"]}')
                            )
                        else:
                            self.stdout.write(
                                f'    Created: {len(result["policies_created"])} policies, '
                                f'{len(result["profiles_created"])} profiles, '
                                f'{len(result["tax_groups_created"])} tax groups'
                            )
                    created += 1
                    continue

            # ── Step 2: Legacy companyType fallback ────────────────────────
            try:
                settings = ConfigurationService.get_global_settings(org)
                company_type = settings.get('companyType', 'REGULAR')
            except Exception:
                company_type = 'REGULAR'

            policy_defaults = COMPANY_TYPE_TO_POLICY.get(
                company_type, COMPANY_TYPE_TO_POLICY['REGULAR']
            )
            name = f'{org.name} — Policy ({company_type})'

            verb = 'WOULD CREATE' if dry_run else 'CREATED (legacy)'
            self.stdout.write(
                self.style.SUCCESS(f'  {verb}: [{org.id}] {org.name} → {company_type}')
            )

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
            self.style.SUCCESS(
                f'\nDone. Created: {created} | Skipped (already had policy): {skipped}'
            )
        )
