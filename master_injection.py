import os
import django
import sys
from decimal import Decimal
from django.utils import timezone
from datetime import date, timedelta

# Import Models
from erp.models import Organization, SaaSClient, SubscriptionPlan, PlanCategory, GlobalCurrency, Site, User
from apps.inventory.models import Product, Brand, Parfum, Category, Unit
from apps.finance.models import ChartOfAccount, FiscalYear, FiscalPeriod, JournalEntry, JournalEntryLine

def inject_all():
    print("🚀 Starting Master Data Injection...")

    # 1. SAAS & CORE
    usd, _ = GlobalCurrency.objects.get_or_create(code='USD', defaults={'name': 'US Dollar', 'symbol': '$'})
    
    # Client
    client, _ = SaaSClient.objects.get_or_create(
        email="demo@tsf.ci",
        defaults={
            'first_name': "Demo",
            'last_name': "User",
            'company_name': "Dajingo Demo Corp",
            'country': "Ivory Coast",
            'is_active': True
        }
    )

    # Plan Category
    cat_biz, _ = PlanCategory.objects.get_or_create(name="Business", type="SaaS")

    # Plan
    plan, _ = SubscriptionPlan.objects.get_or_create(
        name="Enterprise Demo",
        defaults={
            'category': cat_biz,
            'monthly_price': Decimal('299.00'),
            'annual_price': Decimal('2990.00'),
            'modules': ['inventory', 'finance', 'crm', 'hr', 'pos'],
            'is_active': True,
            'is_public': True
        }
    )

    # Organization
    org, _ = Organization.objects.get_or_create(
        slug="demo",
        defaults={
            'name': "Dajingo Demo",
            'client': client,
            'current_plan': plan,
            'base_currency': usd,
            'is_active': True
        }
    )

    # Site
    site, _ = Site.objects.get_or_create(
        code="WH01",
        organization=org,
        defaults={'name': "Main Warehouse", 'is_active': True}
    )

    print(f"✅ SaaS Data injected (Org: {org.slug})")

    # 2. INVENTORY
    perfumery, _ = Category.objects.get_or_create(name="Perfumery", organization=org, defaults={'code': 'PERF'})
    # FIX: Use 'parent' instead of 'parentId'
    men_perfume, _ = Category.objects.get_or_create(name="Men Perfume", parent=perfumery, organization=org)
    
    ml, _ = Unit.objects.get_or_create(name="Milliliter", short_name="ml", organization=org, defaults={'code': 'ML'})
    
    vanilla, _ = Parfum.objects.get_or_create(name="Vanilla Sky", organization=org)
    vanilla.categories.add(perfumery)

    chanel, _ = Brand.objects.get_or_create(name="Chanel", organization=org)
    chanel.categories.add(perfumery)

    p1, _ = Product.objects.get_or_create(
        sku="CH-VAN-100",
        organization=org,
        defaults={
            'name': "Chanel Vanilla 100ml",
            'category': perfumery,
            'brand': chanel,
            'unit': ml,
            'parfum': vanilla,
            'size': Decimal('100.00'),
            'size_unit': ml,
            'cost_price': Decimal('85.00'),
            'selling_price_ttc': Decimal('120.00'),
            'status': 'ACTIVE'
        }
    )
    print("✅ Inventory Data injected")

    # 3. FINANCE
    # Fiscal Year
    fy2024, _ = FiscalYear.objects.get_or_create(
        name="FY 2024",
        organization=org,
        defaults={
            'start_date': date(2024, 1, 1),
            'end_date': date(2024, 12, 31),
            'is_closed': False
        }
    )

    # Fiscal Period (Jan)
    fp01, _ = FiscalPeriod.objects.get_or_create(
        name="Jan 2024",
        fiscal_year=fy2024,
        organization=org,
        defaults={
            'start_date': date(2024, 1, 1),
            'end_date': date(2024, 1, 31),
            'status': 'OPEN'
        }
    )

    # COA
    bank, _ = ChartOfAccount.objects.get_or_create(
        code="512100",
        organization=org,
        defaults={'name': "Bank - Main Account", 'type': 'ASSET', 'sub_type': 'CASH'}
    )
    sales, _ = ChartOfAccount.objects.get_or_create(
        code="701100",
        organization=org,
        defaults={'name': "Sales of Goods", 'type': 'REVENUE'}
    )

    # Sample Journal Entry
    if not JournalEntry.objects.filter(reference="OPENING-2024", organization=org).exists():
        je = JournalEntry.objects.create(
            description="Opening Balance 2024",
            reference="OPENING-2024",
            fiscal_year=fy2024,
            fiscal_period=fp01,
            organization=org,
            transaction_date=timezone.now(),
            status="POSTED"
        )
        JournalEntryLine.objects.create(journal_entry=je, account=bank, debit=Decimal('10000.00'), organization=org)
        JournalEntryLine.objects.create(journal_entry=je, account=sales, credit=Decimal('10000.00'), organization=org)
        print("✅ Finance Data injected")

    print("🏁 Master Data Injection Complete!")

inject_all()
