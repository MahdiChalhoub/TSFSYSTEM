
import os
import django
import json
from datetime import date
from decimal import Decimal

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.apps import apps
from django.contrib.auth import get_user_model

def get_model(name):
    return apps.get_model('erp', name)

Organization = get_model('Organization')
Site = get_model('Site')
# User handled separately
Role = get_model('Role')
Country = get_model('Country')
Unit = get_model('Unit')
Warehouse = get_model('Warehouse')
FinancialAccount = get_model('FinancialAccount')

FiscalYear = get_model('FiscalYear')
ChartOfAccount = get_model('ChartOfAccount')
SystemSettings = get_model('SystemSettings')
Product = get_model('Product')
SystemModule = get_model('SystemModule')

def run_seed():
    print("🌱 Starting Django Seed...")

    # 0. SaaS Platform Organization (REQUIRED - All superusers belong here)
    saas_org, created = Organization.objects.get_or_create(
        slug='saas',
        defaults={
            'name': 'SaaS Platform',
            'is_active': True,
        }
    )
    print(f"🔧 SaaS Platform Org: {'Created' if created else 'Exists'} (ID: {saas_org.id})")

    # 1. Demo Business Organization
    org, created = Organization.objects.get_or_create(
        slug='tsf-global',
        defaults={'name': 'TSF Global', 'is_active': True}
    )
    print(f"🏢 Business Organization: {org.name}")

    # 2. Roles
    roles_data = [
        {'name': 'ADMIN', 'description': 'Total System Control'},
        {'name': 'MANAGER', 'description': 'Branch & Stock Management'},
        {'name': 'CASHIER', 'description': 'POS & Basic Sales'},
    ]
    for r in roles_data:
        Role.objects.get_or_create(
            name=r['name'], organization=org,
            defaults={'description': r['description']}
        )

    # 3. Site
    site, created = Site.objects.get_or_create(
        code='HQ-BEIRUT', organization=org,
        defaults={
            'name': 'HQ - Beirut Central',
            'address': 'Downtown, Beirut',
            'phone': '+961 1 000 000',
            'is_active': True
        }
    )
    print(f"📍 Site: {site.name}")

    # 4. Users (Admin - belongs to SaaS Platform org)
    User = get_user_model()
    admin_email = 'admin@tsfci.com'
    if not User.objects.filter(email=admin_email).exists():
        admin_role = Role.objects.get(name='ADMIN', organization=org)
        user = User.objects.create_user(
            username='admin_erp',
            email=admin_email,
            password='hashed_password_123'
        )
        user.name = 'Admin User'
        user.role = admin_role
        user.home_site = site
        user.organization = saas_org  # SaaS admin belongs to platform org
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.save()
        print(f"👤 Admin User Created: {admin_email} (SaaS Platform)")
    else:
        print("👤 Admin User already exists")

    # Link ALL existing superusers to SaaS org (idempotent fix)
    updated_count = User.objects.filter(is_superuser=True, organization__isnull=True).update(organization=saas_org)
    if updated_count:
        print(f"🔗 Linked {updated_count} orphan superuser(s) to SaaS Platform")

    # 5. Countries
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
    print(f"🌍 Seeded {len(countries)} countries")

    # 6. Units
    pc, _ = Unit.objects.get_or_create(
        code='PC', organization=org,
        defaults={'name': 'Piece', 'conversion_factor': 1}
    )
    
    kg, _ = Unit.objects.get_or_create(
        code='KG', organization=org,
        defaults={'name': 'Kilogram', 'conversion_factor': 1}
    )

    pack, _ = Unit.objects.get_or_create(
        code='PACK', organization=org,
        defaults={'name': 'Pack', 'base_unit': pc, 'conversion_factor': 6}
    )

    box, _ = Unit.objects.get_or_create(
        code='BOX', organization=org,
        defaults={'name': 'Box', 'base_unit': pc, 'conversion_factor': 12}
    )
    print("📏 Units Seeded")

    # 7. Warehouses
    warehouses = [
        {'name': 'Main Store', 'type': 'STORE'},
        {'name': 'Backroom', 'type': 'PHYSICAL'},
        {'name': 'Damaged Goods', 'type': 'VIRTUAL'},
    ]
    for w in warehouses:
        Warehouse.objects.get_or_create(
            name=w['name'], organization=org,
            defaults={'type': w['type'], 'site': site}
        )
    print("🏭 Warehouses Seeded")

    # 8. Financial Settings (Stored in SystemSettings)
    financial_config = {
        'company_type': 'MIXED',
        'currency': 'USD',
        'default_tax_rate': 0.11,
        'works_in_ttc': True,
        'allow_ht_entry_for_ttc': False,
        'dual_view': True
    }
    SystemSettings.objects.get_or_create(
        key='financial_settings', organization=org,
        defaults={'value': json.dumps(financial_config)}
    )

    # 9. Fiscal Year
    fy, _ = FiscalYear.objects.get_or_create(
        name='FY 2026', organization=org,
        defaults={
            'start_date': date(2026, 1, 1),
            'end_date': date(2026, 12, 31),
            'is_closed': False
        }
    )
    print("📅 Fiscal Year 2026 Seeded")

    # 10. Chart of Accounts
    def upsert_account(code, name, type, parent=None, sub_type=None):
        acc, _ = ChartOfAccount.objects.get_or_create(
            code=code, organization=org,
            defaults={
                'name': name, 'type': type, 
                'parent': parent, 'sub_type': sub_type
            }
        )
        return acc

    assets = upsert_account('1000', 'ASSETS', 'ASSET')
    liabilities = upsert_account('2000', 'LIABILITIES', 'LIABILITY')
    equity = upsert_account('3000', 'EQUITY', 'EQUITY')
    revenue = upsert_account('4000', 'REVENUE', 'INCOME')
    expenses = upsert_account('5000', 'COST OF GOODS SOLD (COGS)', 'EXPENSE')
    opex = upsert_account('6000', 'OPERATING EXPENSES', 'EXPENSE')

    # Detailed
    # Assets
    curr_assets = upsert_account('1100', 'Current Assets', 'ASSET', assets)
    ar = upsert_account('1110', 'Accounts Receivable', 'ASSET', curr_assets)
    inventory = upsert_account('1120', 'Inventory', 'ASSET', curr_assets)
    
    # Cash / Bank Roots
    cash_root = upsert_account('5700', 'Cash Accounts', 'ASSET', curr_assets, 'CASH')
    bank_root = upsert_account('5120', 'Bank Accounts', 'ASSET', curr_assets, 'BANK')

    # Liabilities
    curr_liab = upsert_account('2100', 'Current Liabilities', 'LIABILITY', liabilities)
    ap = upsert_account('2101', 'Accounts Payable', 'LIABILITY', curr_liab)
    vat = upsert_account('2111', 'VAT Payable', 'LIABILITY', curr_liab)
    payroll = upsert_account('2121', 'Salaries Payable', 'LIABILITY', curr_liab)

    # Income/Expense
    sales = upsert_account('4100', 'Sales Revenue', 'INCOME', revenue)
    cogs = upsert_account('5100', 'Cost of Sales', 'EXPENSE', expenses)
    inv_adj = upsert_account('5104', 'Inventory Adjustment', 'EXPENSE', expenses)

    depr_exp = upsert_account('6303', 'Depreciation Expense', 'EXPENSE', opex)
    accum_depr = upsert_account('1210', 'Accumulated Depreciation', 'ASSET', assets)

    print("📊 Chart of Accounts Seeded")

    # 11. Posting Rules
    rules = {
        'sales': {
            'receivable': ar.id, 'revenue': sales.id, 'cogs': cogs.id, 'inventory': inventory.id
        },
        'purchases': {
            'payable': ap.id, 'inventory': inventory.id, 'tax': vat.id
        },
        'inventory': {
            'adjustment': inv_adj.id, 'transfer': inventory.id
        },
        'automation': {
            'customerRoot': ar.id, 'supplierRoot': ap.id, 'payrollRoot': payroll.id
        }
    }
    
    SystemSettings.objects.get_or_create(
        key='finance_posting_rules', organization=org,
        defaults={'value': json.dumps(rules)}
    )

    # 12. Financial Accounts
    accounts = [
        {'name': 'Main Cash Drawer', 'type': 'CASH', 'currency': 'USD'},
        {'name': 'Main Bank Account', 'type': 'BANK', 'currency': 'USD'},
        {'name': 'Petty Cash', 'type': 'CASH', 'currency': 'LBP'},
    ]
    for acc in accounts:
        FinancialAccount.objects.get_or_create(
            name=acc['name'], organization=org,
            defaults={'type': acc['type'], 'currency': acc['currency'], 'site': site}
        )

    # 13. Core Modules (Global Registry)
    core_modules = [
        {
            'name': 'core',
            'version': '2.1.0',
            'manifest': {
                'name': 'Core Platform',
                'description': 'The Spine of the system. Handles platform integrity, security, and multi-tenant infrastructure.',
                'is_core': True,
                'required': True,
                'dependencies': [],
                'sidebar_items': []
            }
        },
        {
            'name': 'coreplatform',
            'version': '2.1.0',
            'manifest': {
                'name': 'Platform Engine',
                'description': 'Central orchestration engine. Manages modular injection and request routing.',
                'is_core': True,
                'required': True,
                'dependencies': ['core'],
                'sidebar_items': []
            }
        },
    ]
    
    for mod in core_modules:
        SystemModule.objects.get_or_create(
            name=mod['name'],
            defaults={
                'version': mod['version'],
                'status': 'INSTALLED',
                'manifest': mod['manifest'],
                'checksum': 'KERNEL_EMBEDDED'
            }
        )
    print(f"📦 Seeded {len(core_modules)} core modules to Global Registry")

    # ── Finance Account Type Permissions ──────────────────────────────
    Permission = get_model('Permission')
    account_perms = [
        ('finance.account.cash', 'Access Cash Drawers'),
        ('finance.account.bank', 'Access Bank Accounts'),
        ('finance.account.mobile', 'Access Mobile Wallets'),
        ('finance.account.petty_cash', 'Access Petty Cash'),
        ('finance.account.savings', 'Access Savings Accounts'),
        ('finance.account.foreign', 'Access Foreign Currency'),
        ('finance.account.escrow', 'Access Escrow Accounts'),
        ('finance.account.investment', 'Access Investment Accounts'),
        ('finance.account.all', 'Access All Account Types'),
        ('finance.account.manage', 'Create/Delete Accounts'),
    ]
    for code, name in account_perms:
        Permission.objects.get_or_create(code=code, defaults={'name': name})
    print(f"🔐 Seeded {len(account_perms)} finance account permissions")

    print("✅ Seed Complete!")

if __name__ == '__main__':
    run_seed()
