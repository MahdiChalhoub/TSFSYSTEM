#!/usr/bin/env python
"""
Seed Local Development Database
Creates: saas org (admin panel) + demo org (tenant) with sample data.
Run: cd erp_backend && python manage.py shell < ../scripts/seed_local_dev.py
"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# ── Make apps importable ──
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'erp_backend'))
django.setup()

from decimal import Decimal
from django.utils import timezone
from erp.models import (
    Organization, User, BusinessType, SystemModule, GlobalCurrency,
    Country, OrganizationModule, Site, Role, Permission,
    SaaSClient, SubscriptionPlan, PlanCategory,
)

print("🌱 Seeding Local Development Database...")

# ═════════════════════════════════════════════════════════════════
# 1. GLOBAL DATA (Business Types, Currencies, Countries, Modules)
# ═════════════════════════════════════════════════════════════════
print("📦 Creating global data...")

# Business Types
bt_retail, _ = BusinessType.objects.get_or_create(slug='retail', defaults={'name': 'Retail', 'description': 'Retail and e-commerce businesses'})
bt_wholesale, _ = BusinessType.objects.get_or_create(slug='wholesale', defaults={'name': 'Wholesale', 'description': 'Wholesale distribution'})
bt_services, _ = BusinessType.objects.get_or_create(slug='services', defaults={'name': 'Services', 'description': 'Service-based businesses'})
bt_manufacturing, _ = BusinessType.objects.get_or_create(slug='manufacturing', defaults={'name': 'Manufacturing', 'description': 'Manufacturing and production'})

# Currencies
usd, _ = GlobalCurrency.objects.get_or_create(code='USD', defaults={'name': 'US Dollar', 'symbol': '$'})
eur, _ = GlobalCurrency.objects.get_or_create(code='EUR', defaults={'name': 'Euro', 'symbol': '€'})
xof, _ = GlobalCurrency.objects.get_or_create(code='XOF', defaults={'name': 'West African CFA Franc', 'symbol': 'CFA'})
gbp, _ = GlobalCurrency.objects.get_or_create(code='GBP', defaults={'name': 'British Pound', 'symbol': '£'})
sar, _ = GlobalCurrency.objects.get_or_create(code='SAR', defaults={'name': 'Saudi Riyal', 'symbol': 'ر.س'})

# Countries
ci, _ = Country.objects.get_or_create(code='CI', defaults={'name': "Côte d'Ivoire"})
us, _ = Country.objects.get_or_create(code='US', defaults={'name': 'United States'})
fr, _ = Country.objects.get_or_create(code='FR', defaults={'name': 'France'})
sa, _ = Country.objects.get_or_create(code='SA', defaults={'name': 'Saudi Arabia'})
gb, _ = Country.objects.get_or_create(code='GB', defaults={'name': 'United Kingdom'})

# System Modules
modules_data = [
    ('POS', '2.9.2', 'shopping-cart', 'Point of Sale system with multi-payment, receipts, and register management'),
    ('Finance', '2.9.2', 'bar-chart', 'Full double-entry accounting with journal entries, fiscal years, and financial reports'),
    ('Inventory', '2.9.2', 'package', 'Warehouse management, stock tracking, transfers, and barcode support'),
    ('CRM', '2.9.2', 'users', 'Customer relationship management with contacts, leads, and communication tracking'),
    ('HR', '2.9.2', 'briefcase', 'Human resources management with employees, contracts, and payroll'),
    ('E-Commerce', '2.9.2', 'globe', 'Online storefront with themes, product catalog, and order management'),
    ('Storage', '2.9.2', 'hard-drive', 'Cloud file storage with R2/S3 integration'),
    ('Migration', '2.9.2', 'upload', 'Data migration tools for importing from other systems'),
]

for name, version, icon, desc in modules_data:
    SystemModule.objects.get_or_create(
        name=name,
        defaults={
            'version': version,
            'status': 'INSTALLED',
            'visibility': 'public',
            'description': desc,
            'icon': icon,
            'checksum': 'local-dev',
        }
    )

# ═════════════════════════════════════════════════════════════════
# 2. SAAS ORGANIZATION (admin panel at saas.localhost:3000)
# ═════════════════════════════════════════════════════════════════
print("🏢 Creating SaaS organization...")

saas_org, _ = Organization.objects.get_or_create(
    slug='saas',
    defaults={
        'name': 'SAAS',
        'is_active': True,
        'business_email': 'admin@tsf.ci',
        'base_currency': xof,
        'country': "Côte d'Ivoire",
        'city': 'Abidjan',
        'timezone': 'Africa/Abidjan',
    }
)

# Enable all modules for SaaS org
for mod in SystemModule.objects.all():
    OrganizationModule.objects.get_or_create(
        organization=saas_org,
        module_name=mod.name,
        defaults={'is_enabled': True}
    )

# SaaS Admin User (superuser)
saas_admin, created = User.objects.get_or_create(
    username='admin',
    organization=saas_org,
    defaults={
        'email': 'admin@tsf.ci',
        'first_name': 'Mahdi',
        'last_name': 'Chalhoub',
        'is_superuser': True,
        'is_staff': True,
        'is_active': True,
        'registration_status': 'ACTIVE',
    }
)
if created:
    saas_admin.set_password('admin123')
    saas_admin.save()
    print("   👤 SaaS admin created: admin / admin123")

# ═════════════════════════════════════════════════════════════════
# 3. DEMO ORGANIZATION (tenant at demo.localhost:3000)
# ═════════════════════════════════════════════════════════════════
print("🏪 Creating Demo organization...")

# SaaS Client for demo
demo_client, _ = SaaSClient.objects.get_or_create(
    email='demo@tsf.ci',
    defaults={
        'first_name': 'Demo',
        'last_name': 'User',
        'company_name': 'TSF Global Demo',
        'phone': '+225 07 00 00 00',
        'country': "Côte d'Ivoire",
        'city': 'Abidjan',
    }
)

demo_org, _ = Organization.objects.get_or_create(
    slug='demo',
    defaults={
        'name': 'TSF Global Demo',
        'is_active': True,
        'client': demo_client,
        'business_type': bt_retail,
        'base_currency': xof,
        'business_email': 'demo@tsf.ci',
        'phone': '+225 07 00 00 00',
        'country': "Côte d'Ivoire",
        'city': 'Abidjan',
        'timezone': 'Africa/Abidjan',
        'address': '123 Boulevard de la République, Plateau',
    }
)

# Enable all modules for demo
for mod in SystemModule.objects.all():
    OrganizationModule.objects.get_or_create(
        organization=demo_org,
        module_name=mod.name,
        defaults={'is_enabled': True}
    )

# ── Permissions & Roles ──
demo_perms = []
perm_codes = [
    ('pos.access', 'Access POS'),
    ('pos.manage', 'Manage POS Settings'),
    ('finance.access', 'Access Finance'),
    ('finance.manage', 'Manage Finance'),
    ('inventory.access', 'Access Inventory'),
    ('inventory.manage', 'Manage Inventory'),
    ('crm.access', 'Access CRM'),
    ('crm.manage', 'Manage CRM'),
    ('hr.access', 'Access HR'),
    ('hr.manage', 'Manage HR'),
    ('settings.access', 'Access Settings'),
    ('settings.manage', 'Manage Settings'),
    ('users.manage', 'Manage Users'),
    ('reports.access', 'Access Reports'),
]
for code, name in perm_codes:
    p, _ = Permission.objects.get_or_create(code=code, defaults={'name': name})
    demo_perms.append(p)

# Admin role
admin_role, _ = Role.objects.get_or_create(
    name='Administrator',
    organization=demo_org,
    defaults={'description': 'Full access to all modules'}
)
admin_role.permissions.set(demo_perms)

# Cashier role
cashier_perms = [p for p in demo_perms if p.code.startswith('pos.')]
cashier_role, _ = Role.objects.get_or_create(
    name='Cashier',
    organization=demo_org,
    defaults={'description': 'POS access only'}
)
cashier_role.permissions.set(cashier_perms)

# ── Demo Users ──
demo_admin, created = User.objects.get_or_create(
    username='manager',
    organization=demo_org,
    defaults={
        'email': 'manager@demo.tsf.ci',
        'first_name': 'Demo',
        'last_name': 'Manager',
        'is_staff': True,
        'is_active': True,
        'role': admin_role,
        'registration_status': 'ACTIVE',
    }
)
if created:
    demo_admin.set_password('demo123')
    demo_admin.save()
    print("   👤 Demo manager: manager / demo123")

demo_cashier, created = User.objects.get_or_create(
    username='cashier',
    organization=demo_org,
    defaults={
        'email': 'cashier@demo.tsf.ci',
        'first_name': 'Aïcha',
        'last_name': 'Koné',
        'is_active': True,
        'role': cashier_role,
        'registration_status': 'ACTIVE',
    }
)
if created:
    demo_cashier.set_password('demo123')
    demo_cashier.save()
    print("   👤 Demo cashier: cashier / demo123")

# ── Sites ──
site_main, _ = Site.objects.get_or_create(
    code='HQ',
    organization=demo_org,
    defaults={
        'name': 'Siège Principal - Plateau',
        'address': '123 Boulevard de la République, Plateau, Abidjan',
        'city': 'Abidjan',
        'phone': '+225 07 00 00 00',
    }
)
site_branch, _ = Site.objects.get_or_create(
    code='YOP',
    organization=demo_org,
    defaults={
        'name': 'Magasin Yopougon',
        'address': 'Rue des 3 frères, Yopougon, Abidjan',
        'city': 'Abidjan',
        'phone': '+225 07 11 11 11',
    }
)

# ═════════════════════════════════════════════════════════════════
# 4. FINANCE DATA (Chart of Accounts, Cash Account, Fiscal Year)
# ═════════════════════════════════════════════════════════════════
print("💰 Creating finance data...")

try:
    from apps.finance.models import ChartOfAccount, FinancialAccount, FiscalYear, FiscalPeriod
    from datetime import date

    # Chart of Accounts (field is 'type' not 'account_type')
    coa_data = [
        ('1000', 'Cash', 'ASSET'),
        ('1100', 'Bank Account', 'ASSET'),
        ('1200', 'Accounts Receivable', 'ASSET'),
        ('2000', 'Accounts Payable', 'LIABILITY'),
        ('2100', 'Sales Tax Payable', 'LIABILITY'),
        ('3000', 'Owner Equity', 'EQUITY'),
        ('3100', 'Retained Earnings', 'EQUITY'),
        ('4000', 'Sales Revenue', 'REVENUE'),
        ('4100', 'Service Revenue', 'REVENUE'),
        ('5000', 'Cost of Goods Sold', 'EXPENSE'),
        ('5100', 'Purchase Costs', 'EXPENSE'),
        ('6000', 'Salaries Expense', 'EXPENSE'),
        ('6100', 'Rent Expense', 'EXPENSE'),
        ('6200', 'Utilities Expense', 'EXPENSE'),
    ]
    for code, name, acct_type in coa_data:
        ChartOfAccount.objects.get_or_create(
            code=code,
            organization=demo_org,
            defaults={
                'name': name,
                'type': acct_type,
                'is_active': True,
            }
        )

    # Financial Accounts (field is 'type' and 'linked_coa')
    cash_coa = ChartOfAccount.objects.filter(code='1000', organization=demo_org).first()
    if cash_coa:
        cash_account, _ = FinancialAccount.objects.get_or_create(
            name='Caisse Principale',
            organization=demo_org,
            defaults={
                'type': 'CASH',
                'linked_coa': cash_coa,
                'balance': Decimal('500000.00'),
            }
        )
        cash_account2, _ = FinancialAccount.objects.get_or_create(
            name='Caisse Yopougon',
            organization=demo_org,
            defaults={
                'type': 'CASH',
                'linked_coa': cash_coa,
                'balance': Decimal('200000.00'),
            }
        )

    bank_coa = ChartOfAccount.objects.filter(code='1100', organization=demo_org).first()
    if bank_coa:
        FinancialAccount.objects.get_or_create(
            name='Banque SIB',
            organization=demo_org,
            defaults={
                'type': 'BANK',
                'linked_coa': bank_coa,
                'balance': Decimal('5000000.00'),
            }
        )

    # Fiscal Year 2026
    fy, _ = FiscalYear.objects.get_or_create(
        name='FY 2026',
        organization=demo_org,
        defaults={
            'start_date': date(2026, 1, 1),
            'end_date': date(2026, 12, 31),
            'is_active': True,
        }
    )
    print("   ✅ Chart of accounts, cash accounts, fiscal year created")
except ImportError as e:
    print(f"   ⚠️  Finance module not available: {e}")
except Exception as e:
    print(f"   ⚠️  Finance seed error: {e}")

# ═════════════════════════════════════════════════════════════════
# 5. INVENTORY DATA (Warehouses, Categories, Products)
# ═════════════════════════════════════════════════════════════════
print("📦 Creating inventory data...")

try:
    from apps.inventory.models import Warehouse, Category, Brand, Product, Unit, Inventory

    # Units (requires 'code' field, uses 'short_name' not 'abbreviation')
    unit_pcs, _ = Unit.objects.get_or_create(code='PCS', organization=demo_org, defaults={'name': 'Piece', 'short_name': 'pcs'})
    unit_kg, _ = Unit.objects.get_or_create(code='KG', organization=demo_org, defaults={'name': 'Kilogram', 'short_name': 'kg'})
    unit_l, _ = Unit.objects.get_or_create(code='L', organization=demo_org, defaults={'name': 'Litre', 'short_name': 'L'})
    unit_box, _ = Unit.objects.get_or_create(code='BOX', organization=demo_org, defaults={'name': 'Box', 'short_name': 'box'})

    # Warehouses
    wh_main, _ = Warehouse.objects.get_or_create(
        name='Entrepôt Principal',
        organization=demo_org,
        defaults={'code': 'WH-HQ', 'is_active': True}
    )
    wh_branch, _ = Warehouse.objects.get_or_create(
        name='Entrepôt Yopougon',
        organization=demo_org,
        defaults={'code': 'WH-YOP', 'is_active': True}
    )

    # Categories
    cat_electronics, _ = Category.objects.get_or_create(name='Électronique', organization=demo_org)
    cat_food, _ = Category.objects.get_or_create(name='Alimentation', organization=demo_org)
    cat_cosmetics, _ = Category.objects.get_or_create(name='Cosmétiques', organization=demo_org)
    cat_clothing, _ = Category.objects.get_or_create(name='Habillement', organization=demo_org)

    # Brands
    brand_samsung, _ = Brand.objects.get_or_create(name='Samsung', organization=demo_org)
    brand_apple, _ = Brand.objects.get_or_create(name='Apple', organization=demo_org)
    brand_nike, _ = Brand.objects.get_or_create(name='Nike', organization=demo_org)
    brand_local, _ = Brand.objects.get_or_create(name='Produit Local', organization=demo_org)

    # Products
    products_data = [
        ('Samsung Galaxy A15', 'SKU-0001', cat_electronics, brand_samsung, Decimal('95000'), Decimal('135000'), unit_pcs, 50),
        ('iPhone 15 Pro', 'SKU-0002', cat_electronics, brand_apple, Decimal('650000'), Decimal('850000'), unit_pcs, 20),
        ('AirPods Pro', 'SKU-0003', cat_electronics, brand_apple, Decimal('120000'), Decimal('175000'), unit_pcs, 35),
        ('Riz Parfumé 25kg', 'SKU-0004', cat_food, brand_local, Decimal('12000'), Decimal('15000'), unit_kg, 200),
        ('Huile de Palme 5L', 'SKU-0005', cat_food, brand_local, Decimal('5000'), Decimal('7500'), unit_l, 100),
        ('Beurre de Karité', 'SKU-0006', cat_cosmetics, brand_local, Decimal('3500'), Decimal('5000'), unit_pcs, 80),
        ('Nike Air Force 1', 'SKU-0007', cat_clothing, brand_nike, Decimal('65000'), Decimal('95000'), unit_pcs, 25),
        ('T-Shirt Wax', 'SKU-0008', cat_clothing, brand_local, Decimal('5000'), Decimal('8500'), unit_pcs, 150),
        ('Chargeur USB-C', 'SKU-0009', cat_electronics, brand_samsung, Decimal('5000'), Decimal('8000'), unit_pcs, 100),
        ('Écouteurs Bluetooth', 'SKU-0010', cat_electronics, brand_samsung, Decimal('15000'), Decimal('25000'), unit_pcs, 60),
    ]

    for name, sku, category, brand, cost, selling, unit, qty in products_data:
        prod, created = Product.objects.get_or_create(
            sku=sku,
            organization=demo_org,
            defaults={
                'name': name,
                'category': category,
                'brand': brand,
                'cost_price': cost,
                'selling_price_ht': selling,
                'selling_price_ttc': selling,
                'unit': unit,
                'is_active': True,
            }
        )
        if created:
            # Add inventory in main warehouse
            Inventory.objects.get_or_create(
                product=prod,
                warehouse=wh_main,
                organization=demo_org,
                defaults={'quantity': qty}
            )
            # Add some inventory in branch too
            if qty > 20:
                Inventory.objects.get_or_create(
                    product=prod,
                    warehouse=wh_branch,
                    organization=demo_org,
                    defaults={'quantity': qty // 3}
                )

    print(f"   ✅ {len(products_data)} products created with inventory")
except ImportError as e:
    print(f"   ⚠️  Inventory module not available: {e}")
except Exception as e:
    print(f"   ⚠️  Inventory seed error: {e}")

# ═════════════════════════════════════════════════════════════════
# 6. CRM DATA (Contacts/Customers)
# ═════════════════════════════════════════════════════════════════
print("👥 Creating CRM data...")

try:
    from apps.crm.models import Contact

    contacts_data = [
        ('Kouadio Jean', 'CUSTOMER', 'jean@example.ci', '+225 07 22 33 44'),
        ('Bamba Fatou', 'CUSTOMER', 'fatou@example.ci', '+225 05 11 22 33'),
        ('Traoré Moussa', 'CUSTOMER', 'moussa@example.ci', '+225 01 44 55 66'),
        ('Société ABC SARL', 'CUSTOMER', 'contact@abc-sarl.ci', '+225 27 20 00 00'),
        ('Fournisseur Tech CI', 'SUPPLIER', 'tech@fournisseur.ci', '+225 27 21 00 00'),
        ('Import Export Abidjan', 'SUPPLIER', 'import@abidjan.ci', '+225 27 22 00 00'),
    ]

    for name, contact_type, email, phone in contacts_data:
        Contact.objects.get_or_create(
            email=email,
            organization=demo_org,
            defaults={
                'name': name,
                'type': contact_type,
                'phone': phone,
                'balance': Decimal('0.00'),
                'credit_limit': Decimal('1000000.00') if contact_type == 'CUSTOMER' else Decimal('0.00'),
            }
        )

    print(f"   ✅ {len(contacts_data)} contacts created")
except ImportError as e:
    print(f"   ⚠️  CRM module not available: {e}")
except Exception as e:
    print(f"   ⚠️  CRM seed error: {e}")

# ═════════════════════════════════════════════════════════════════
# 7. SUBSCRIPTION PLANS
# ═════════════════════════════════════════════════════════════════
print("📋 Creating subscription plans...")

try:
    plan_cat, _ = PlanCategory.objects.get_or_create(
        name='Standard Plans',
        defaults={'type': 'STANDARD', 'country': ci}
    )

    plans = [
        ('Starter', Decimal('9900'), Decimal('99000'), ['POS', 'Inventory'], {'max_users': 3, 'max_sites': 1, 'max_products': 500}),
        ('Business', Decimal('29900'), Decimal('299000'), ['POS', 'Inventory', 'Finance', 'CRM'], {'max_users': 10, 'max_sites': 3, 'max_products': 5000}),
        ('Enterprise', Decimal('79900'), Decimal('799000'), ['POS', 'Inventory', 'Finance', 'CRM', 'HR', 'E-Commerce'], {'max_users': 50, 'max_sites': 10, 'max_products': 50000}),
    ]

    for i, (name, monthly, annual, modules, limits) in enumerate(plans):
        SubscriptionPlan.objects.get_or_create(
            name=name,
            category=plan_cat,
            defaults={
                'monthly_price': monthly,
                'annual_price': annual,
                'modules': modules,
                'limits': limits,
                'sort_order': i,
                'is_active': True,
                'is_public': True,
                'trial_days': 14,
            }
        )

    print("   ✅ 3 subscription plans created")
except Exception as e:
    print(f"   ⚠️  Plans seed error: {e}")


# ═════════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("✅ LOCAL DEVELOPMENT DATABASE SEEDED SUCCESSFULLY!")
print("=" * 60)
print()
print("🏢 Organizations:")
print(f"   • saas     → SaaS Admin Panel (saas.localhost:3000)")
print(f"   • demo     → Demo Tenant     (demo.localhost:3000)")
print()
print("👤 Login Credentials:")
print(f"   SaaS Admin : admin / admin123  (superuser)")
print(f"   Demo Mgr   : manager / demo123")
print(f"   Demo Cashier: cashier / demo123")
print()
print("💡 To start the local dev environment:")
print(f"   ./scripts/local_dev.sh")
print("=" * 60)
