"""
seed_payment_terms — Seed default payment terms for all organizations.

Provides universal commercial payment terms that any org needs:
  - COD (Cash on Delivery)
  - Net 15, Net 30, Net 45, Net 60, Net 90
  - 2/10 Net 30 (2% discount if paid within 10 days)
  - Immediate

Usage:
    python manage.py seed_payment_terms                    # All orgs
    python manage.py seed_payment_terms --org-id=5         # Specific org

Idempotent: uses get_or_create keyed on (organization, code).
"""
from django.core.management.base import BaseCommand
from apps.pos.models.payment_terms_models import PaymentTerm
from erp.models import Organization

DEFAULT_TERMS = [
    {'code': 'IMMEDIATE',   'name': 'Immediate',         'days': 0,  'discount_percent': 0, 'discount_days': 0, 'sort_order': 0, 'is_default': True},
    {'code': 'COD',         'name': 'Cash on Delivery',   'days': 0,  'discount_percent': 0, 'discount_days': 0, 'sort_order': 1, 'is_default': False},
    {'code': 'NET_15',      'name': 'Net 15 Days',        'days': 15, 'discount_percent': 0, 'discount_days': 0, 'sort_order': 2, 'is_default': False},
    {'code': 'NET_30',      'name': 'Net 30 Days',        'days': 30, 'discount_percent': 0, 'discount_days': 0, 'sort_order': 3, 'is_default': False},
    {'code': 'NET_45',      'name': 'Net 45 Days',        'days': 45, 'discount_percent': 0, 'discount_days': 0, 'sort_order': 4, 'is_default': False},
    {'code': 'NET_60',      'name': 'Net 60 Days',        'days': 60, 'discount_percent': 0, 'discount_days': 0, 'sort_order': 5, 'is_default': False},
    {'code': 'NET_90',      'name': 'Net 90 Days',        'days': 90, 'discount_percent': 0, 'discount_days': 0, 'sort_order': 6, 'is_default': False},
    {'code': '2_10_NET_30', 'name': '2/10 Net 30',        'days': 30, 'discount_percent': 2, 'discount_days': 10, 'sort_order': 7, 'is_default': False,
     'description': '2% discount if paid within 10 days, otherwise net 30 days'},
]


class Command(BaseCommand):
    help = 'Seeds default payment terms for organizations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--org-id', type=int, default=None,
            help='Seed for a specific organization ID only',
        )

    def handle(self, *args, **options):
        org_id = options.get('org_id')

        if org_id:
            orgs = Organization.objects.filter(id=org_id)
        else:
            orgs = Organization.objects.filter(is_active=True)

        total_created = 0
        for org in orgs:
            created = 0
            for term in DEFAULT_TERMS:
                _, was_created = PaymentTerm.objects.get_or_create(
                    organization=org,
                    code=term['code'],
                    defaults={
                        'name': term['name'],
                        'days': term['days'],
                        'discount_percent': term['discount_percent'],
                        'discount_days': term['discount_days'],
                        'sort_order': term['sort_order'],
                        'is_default': term.get('is_default', False),
                        'description': term.get('description', ''),
                        'is_active': True,
                    }
                )
                if was_created:
                    created += 1
            if created:
                self.stdout.write(f'  📋 {org.name}: {created} payment terms created')
            total_created += created

        self.stdout.write(self.style.SUCCESS(
            f'✅ Payment terms: {total_created} created across {orgs.count()} org(s)'
        ))
