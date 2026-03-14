"""
seed_reference — Management command to seed all global reference master data.

Usage:
    python manage.py seed_reference
    python manage.py seed_reference --currencies-only
    python manage.py seed_reference --countries-only
    python manage.py seed_reference --mappings-only

Idempotent: safe to run multiple times (uses get_or_create).
"""
from django.core.management.base import BaseCommand
from apps.reference.models import Currency, Country, CountryCurrencyMap
from apps.reference.seeders.currencies import CURRENCIES
from apps.reference.seeders.countries import COUNTRIES


class Command(BaseCommand):
    help = 'Seeds global reference master data: currencies, countries, and country-currency mappings'

    def add_arguments(self, parser):
        parser.add_argument('--currencies-only', action='store_true', help='Seed only currencies')
        parser.add_argument('--countries-only', action='store_true', help='Seed only countries')
        parser.add_argument('--mappings-only', action='store_true', help='Seed only country-currency mappings')

    def handle(self, *args, **options):
        currencies_only = options.get('currencies_only', False)
        countries_only = options.get('countries_only', False)
        mappings_only = options.get('mappings_only', False)

        # If no flag specified, seed everything
        seed_all = not (currencies_only or countries_only or mappings_only)

        if seed_all or currencies_only:
            self._seed_currencies()

        if seed_all or countries_only:
            self._seed_countries()

        if seed_all or mappings_only:
            self._seed_mappings()

        self.stdout.write(self.style.SUCCESS('✅ Reference data seeding complete!'))

    def _seed_currencies(self):
        """Seed all ISO 4217 currencies."""
        self.stdout.write('💰 Seeding currencies...')
        created_count = 0
        updated_count = 0

        for code, numeric_code, name, symbol, minor_unit in CURRENCIES:
            currency, created = Currency.objects.get_or_create(
                code=code,
                defaults={
                    'numeric_code': numeric_code,
                    'name': name,
                    'symbol': symbol,
                    'minor_unit': minor_unit,
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
            else:
                # Update existing records with any new data
                changed = False
                if currency.numeric_code != numeric_code:
                    currency.numeric_code = numeric_code
                    changed = True
                if currency.name != name:
                    currency.name = name
                    changed = True
                if not currency.symbol and symbol:
                    currency.symbol = symbol
                    changed = True
                if currency.minor_unit != minor_unit:
                    currency.minor_unit = minor_unit
                    changed = True
                if changed:
                    currency.save()
                    updated_count += 1

        self.stdout.write(
            f'   💰 Currencies: {created_count} created, {updated_count} updated, '
            f'{len(CURRENCIES)} total in seed'
        )

    def _seed_countries(self):
        """Seed all ISO 3166-1 countries."""
        self.stdout.write('🌍 Seeding countries...')
        created_count = 0
        updated_count = 0

        # Build currency lookup by code
        currency_map = {c.code: c for c in Currency.objects.all()}

        for iso2, iso3, numeric, name, official, phone, region, subregion, cur_code in COUNTRIES:
            default_currency = currency_map.get(cur_code)

            country, created = Country.objects.get_or_create(
                iso2=iso2,
                defaults={
                    'iso3': iso3,
                    'numeric_code': numeric,
                    'name': name,
                    'official_name': official,
                    'phone_code': phone,
                    'region': region,
                    'subregion': subregion,
                    'default_currency': default_currency,
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
            else:
                # Update existing records with enriched data
                changed = False
                for field, value in [
                    ('iso3', iso3),
                    ('numeric_code', numeric),
                    ('name', name),
                    ('official_name', official),
                    ('phone_code', phone),
                    ('region', region),
                    ('subregion', subregion),
                ]:
                    if getattr(country, field) != value:
                        setattr(country, field, value)
                        changed = True
                # Update default_currency FK if not set
                if not country.default_currency and default_currency:
                    country.default_currency = default_currency
                    changed = True
                if changed:
                    country.save()
                    updated_count += 1

        self.stdout.write(
            f'   🌍 Countries: {created_count} created, {updated_count} updated, '
            f'{len(COUNTRIES)} total in seed'
        )

    def _seed_mappings(self):
        """Seed primary country-currency mappings from default_currency FK."""
        self.stdout.write('🔗 Seeding country-currency mappings...')
        created_count = 0

        countries = Country.objects.select_related('default_currency').filter(
            default_currency__isnull=False
        )

        for country in countries:
            _, created = CountryCurrencyMap.objects.get_or_create(
                country=country,
                currency=country.default_currency,
                defaults={
                    'is_primary': True,
                    'is_active': True,
                }
            )
            if created:
                created_count += 1

        self.stdout.write(f'   🔗 Mappings: {created_count} created')
