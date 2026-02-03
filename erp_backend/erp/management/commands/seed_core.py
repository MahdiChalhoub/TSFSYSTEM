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

        self.stdout.write(self.style.SUCCESS("✅ Seed Complete! Engine is Blank."))
