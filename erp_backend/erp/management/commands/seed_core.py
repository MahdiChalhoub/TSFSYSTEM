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

        # 2. SaaS Organization (The Root "0" Entity)
        # We allow it to be created first so it likely gets ID 1 (Standard for Root)
        saas_org, _ = Organization.objects.get_or_create(
            slug='saas',
            defaults={
                'name': 'SAAS',
                'is_active': True
            }
        )
        self.stdout.write(f"🏢 SaaS Root Organization Created: {saas_org.name} (Slug: saas)")

        # 3. Auto-Link Existing Superusers (The Fix)
        # If the user created a superuser manually, we find them and bind them to SaaS
        from django.contrib.auth import get_user_model
        User = get_user_model()
        superusers = User.objects.filter(is_superuser=True, organization__isnull=True)
        
        count = 0
        for su in superusers:
            su.organization = saas_org
            su.save()
            count += 1
            
        if count > 0:
            self.stdout.write(f"🔗 Auto-Linked {count} Superuser(s) to SaaS Organization")

        self.stdout.write(self.style.SUCCESS("✅ Seed Complete! Engine is Blank (with SaaS Root)."))
