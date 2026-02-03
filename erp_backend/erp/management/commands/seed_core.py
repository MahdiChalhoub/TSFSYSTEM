from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from erp.models import (
    Organization, Site, Role, Country, Unit, Warehouse,
    FinancialAccount, ChartOfAccount, SystemSettings, Product, FiscalYear
)
import json
from datetime import date
from decimal import Decimal

class Command(BaseCommand):
    help = 'Seeds the core engine with default data'

    def handle(self, *args, **options):
        self.stdout.write("🌱 Starting Django Seed (Truly Blank)...")

        # 1. Countries (Safe Global Data)
        countries = [
            {'code': 'LB', 'name': 'Lebanon'},
            {'code': 'US', 'name': 'United States'},
            {'code': 'FR', 'name': 'France'},
            {'code': 'TR', 'name': 'Turkey'},
            {'code': 'CN', 'name': 'China'},
        ]
        for c in countries:
            Country.objects.get_or_create(
                code=c['code'],
                defaults={'name': c['name']}
            )
        self.stdout.write(f"🌍 Seeded {len(countries)} countries")

        # 2. Superuser (No Organization - "Float Admin")
        User = get_user_model()
        admin_email = 'admin@tsfci.com'
        if not User.objects.filter(email=admin_email).exists():
            user = User.objects.create_user(
                username='admin_erp',
                email=admin_email,
                password='admin' # default simple password for first login
            )
            user.first_name = 'Super'
            user.last_name = 'Admin'
            user.is_active = True
            user.is_staff = True
            user.is_superuser = True
            # organization, role, and home_site are deliberately NULL
            user.save()
            self.stdout.write(f"👤 Super Admin Created: {admin_email} (Pass: admin)")
        else:
            self.stdout.write("👤 Super Admin already exists")

        self.stdout.write(self.style.SUCCESS("✅ Seed Complete! Engine is Blank."))
