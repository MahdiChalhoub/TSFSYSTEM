"""
Seed Cities — populate ref_cities with major cities for commonly used countries.
Only creates cities that don't already exist (idempotent).

Usage:
    python3 manage.py seed_cities
"""
from django.core.management.base import BaseCommand
from apps.reference.models import Country, City


# Major cities by ISO2 code — only countries commonly used in TSFSYSTEM tenants
CITY_DATA = {
    'LB': [
        ('Beirut', 'Beirut', True),
        ('Tripoli', 'North Lebanon', False),
        ('Sidon', 'South Lebanon', False),
        ('Jounieh', 'Mount Lebanon', False),
        ('Byblos', 'Mount Lebanon', False),
        ('Baalbek', 'Beqaa', False),
        ('Zahle', 'Beqaa', False),
        ('Tyre', 'South Lebanon', False),
        ('Nabatieh', 'Nabatieh', False),
        ('Aley', 'Mount Lebanon', False),
    ],
    'CI': [
        ('Abidjan', 'Abidjan', True),
        ('Yamoussoukro', 'Lacs', False),
        ('Bouaké', 'Vallée du Bandama', False),
        ('Daloa', 'Haut-Sassandra', False),
        ('San-Pédro', 'Bas-Sassandra', False),
        ('Korhogo', 'Savanes', False),
        ('Man', 'Montagnes', False),
        ('Gagnoa', 'Fromager', False),
    ],
    'FR': [
        ('Paris', 'Île-de-France', True),
        ('Marseille', "Provence-Alpes-Côte d'Azur", False),
        ('Lyon', 'Auvergne-Rhône-Alpes', False),
        ('Toulouse', 'Occitanie', False),
        ('Nice', "Provence-Alpes-Côte d'Azur", False),
        ('Nantes', 'Pays de la Loire', False),
        ('Strasbourg', 'Grand Est', False),
        ('Bordeaux', 'Nouvelle-Aquitaine', False),
        ('Lille', 'Hauts-de-France', False),
    ],
    'AE': [
        ('Dubai', 'Dubai', False),
        ('Abu Dhabi', 'Abu Dhabi', True),
        ('Sharjah', 'Sharjah', False),
        ('Ajman', 'Ajman', False),
        ('Ras Al Khaimah', 'Ras Al Khaimah', False),
        ('Fujairah', 'Fujairah', False),
    ],
    'SA': [
        ('Riyadh', 'Riyadh Region', True),
        ('Jeddah', 'Makkah Region', False),
        ('Dammam', 'Eastern Province', False),
        ('Makkah', 'Makkah Region', False),
        ('Madinah', 'Madinah Region', False),
        ('Khobar', 'Eastern Province', False),
    ],
    'US': [
        ('Washington, D.C.', 'District of Columbia', True),
        ('New York', 'New York', False),
        ('Los Angeles', 'California', False),
        ('Chicago', 'Illinois', False),
        ('Houston', 'Texas', False),
        ('Miami', 'Florida', False),
        ('San Francisco', 'California', False),
        ('Atlanta', 'Georgia', False),
    ],
    'GB': [
        ('London', 'England', True),
        ('Manchester', 'England', False),
        ('Birmingham', 'England', False),
        ('Edinburgh', 'Scotland', False),
        ('Glasgow', 'Scotland', False),
        ('Liverpool', 'England', False),
    ],
    'AD': [
        ('Andorra la Vella', 'Andorra la Vella', True),
        ('Escaldes-Engordany', 'Escaldes-Engordany', False),
        ('Encamp', 'Encamp', False),
        ('Sant Julià de Lòria', 'Sant Julià de Lòria', False),
    ],
    'SN': [
        ('Dakar', 'Dakar', True),
        ('Thiès', 'Thiès', False),
        ('Saint-Louis', 'Saint-Louis', False),
        ('Ziguinchor', 'Ziguinchor', False),
        ('Kaolack', 'Kaolack', False),
    ],
    'CM': [
        ('Yaoundé', 'Centre', True),
        ('Douala', 'Littoral', False),
        ('Bamenda', 'Northwest', False),
        ('Bafoussam', 'West', False),
        ('Garoua', 'North', False),
    ],
}


class Command(BaseCommand):
    help = 'Seed major cities for commonly used countries into ref_cities'

    def handle(self, *args, **options):
        total_created = 0
        total_skipped = 0

        for iso2, cities in CITY_DATA.items():
            try:
                country = Country.objects.get(iso2=iso2)
            except Country.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'  ⚠ Country {iso2} not found, skipping'))
                continue

            for name, state_province, is_capital in cities:
                _, created = City.objects.get_or_create(
                    country=country,
                    name=name,
                    defaults={
                        'state_province': state_province,
                        'is_capital': is_capital,
                        'is_active': True,
                    }
                )
                if created:
                    total_created += 1
                else:
                    total_skipped += 1

            self.stdout.write(self.style.SUCCESS(f'  ✅ {iso2}: {len(cities)} cities processed'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Done! Created: {total_created}, Skipped (existing): {total_skipped}'))
