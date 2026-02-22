import os
import django
import random
import uuid
import calendar
from datetime import datetime, timedelta, date, time
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.apps import apps
from django.db import models, reset_queries
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import close_old_connections
import gc

def get_model(app_label, model_name):
    return apps.get_model(app_label, model_name)

# Core Models
Organization = get_model('erp', 'Organization')
Site = get_model('erp', 'Site')
Country = get_model('erp', 'Country')
User = get_user_model()

# Inventory Models
Category = get_model('inventory', 'Category')
Brand = get_model('inventory', 'Brand')
Product = get_model('inventory', 'Product')
Unit = get_model('inventory', 'Unit')
Warehouse = get_model('inventory', 'Warehouse')
Inventory = get_model('inventory', 'Inventory')
InventoryMovement = get_model('inventory', 'InventoryMovement')
ComboComponent = get_model('inventory', 'ComboComponent')
StockAdjustmentOrder = get_model('inventory', 'StockAdjustmentOrder')
StockAdjustmentLine = get_model('inventory', 'StockAdjustmentLine')
StockTransferOrder = get_model('inventory', 'StockTransferOrder')
StockTransferLine = get_model('inventory', 'StockTransferLine')
OperationalRequest = get_model('inventory', 'OperationalRequest')

# CRM Models
Contact = get_model('crm', 'Contact')

# Finance Models
ChartOfAccount = get_model('finance', 'ChartOfAccount')
FinancialAccount = get_model('finance', 'FinancialAccount')
FiscalYear = get_model('finance', 'FiscalYear')
FiscalPeriod = get_model('finance', 'FiscalPeriod')
JournalEntry = get_model('finance', 'JournalEntry')
JournalEntryLine = get_model('finance', 'JournalEntryLine')
Transaction = get_model('finance', 'Transaction')
TransactionSequence = get_model('finance', 'TransactionSequence')
DirectExpense = get_model('finance', 'DirectExpense')
DeferredExpense = get_model('finance', 'DeferredExpense')
Asset = get_model('finance', 'Asset')
Voucher = get_model('finance', 'Voucher')
Invoice = get_model('finance', 'Invoice')
InvoiceLine = get_model('finance', 'InvoiceLine')
Payment = get_model('finance', 'Payment')

# POS Models
Order = get_model('pos', 'Order')
OrderLine = get_model('pos', 'OrderLine')

# HR Models
Employee = get_model('hr', 'Employee')
Department = get_model('hr', 'Department')
Shift = get_model('hr', 'Shift')
Attendance = get_model('hr', 'Attendance')
Leave = get_model('hr', 'Leave')

# ── Helpers ────────────────────────────────────────────────────

def get_ref_batch(org, prefix, count):
    seq, _ = TransactionSequence.objects.get_or_create(
        organization=org, type=prefix,
        defaults={'prefix': f"{prefix}-", 'next_number': 1, 'padding': 6}
    )
    current = seq.next_number
    TransactionSequence.objects.filter(id=seq.id).update(next_number=models.F('next_number') + count)
    return [f"{seq.prefix}{str(current+i).zfill(seq.padding)}" for i in range(count)]


def simulate():
    print("🚀 Starting Enterprise Data Simulation (1.5 Years)...")

    # ── PHASE 0: CLEANUP ──────────────────────────────────────
    try:
        org = Organization.objects.get(slug='demo')
    except Organization.DoesNotExist:
        org = Organization.objects.create(slug='demo', name='Enterprise ERP (Demo)', is_active=True)

    # Purge ALL generated data
    Payment.objects.filter(organization=org).delete()
    Invoice.objects.filter(organization=org).delete()
    Order.objects.filter(organization=org).delete()
    InventoryMovement.objects.filter(organization=org).delete()
    Inventory.objects.filter(organization=org).delete()
    JournalEntry.objects.filter(organization=org).delete()
    Transaction.objects.filter(organization=org).delete()
    DirectExpense.objects.filter(organization=org).delete()
    DeferredExpense.objects.filter(organization=org).delete()
    Voucher.objects.filter(organization=org).delete()
    Asset.objects.filter(organization=org).delete()
    StockAdjustmentOrder.objects.filter(organization=org).delete()
    StockTransferOrder.objects.filter(organization=org).delete()
    OperationalRequest.objects.filter(organization=org).delete()
    Attendance.objects.filter(organization=org).delete()
    Leave.objects.filter(organization=org).delete()
    Employee.objects.filter(organization=org).delete()
    Department.objects.filter(organization=org).delete()
    Shift.objects.filter(organization=org).delete()
    ComboComponent.objects.filter(organization=org).delete()
    Product.objects.filter(organization=org).delete()
    Category.objects.filter(organization=org).delete()
    Unit.objects.filter(organization=org).delete()
    Brand.objects.filter(organization=org).delete()
    Contact.objects.filter(organization=org).delete()
    FinancialAccount.objects.filter(organization=org).delete()
    ChartOfAccount.objects.filter(organization=org).delete()
    FiscalPeriod.objects.filter(organization=org).delete()
    FiscalYear.objects.filter(organization=org).delete()
    TransactionSequence.objects.filter(organization=org).delete()
    Site.objects.filter(organization=org).delete()
    print("🗑️ Existing simulation data purged.")

    # ══════════════════════════════════════════════════════════════
    # PHASE 1: FOUNDATION
    # ══════════════════════════════════════════════════════════════

    # --- Sites ---
    sites_data = [
        {'code': 'HQ-LEB', 'name': 'HQ - Beirut', 'address': 'Downtown Beirut'},
        {'code': 'WH-ALPHA', 'name': 'Warehouse Alpha', 'address': 'Industrial Zone A'},
        {'code': 'WH-BETA', 'name': 'Warehouse Beta', 'address': 'Industrial Zone B'},
        {'code': 'STORE-1', 'name': 'Retail Store 1', 'address': 'Mall Level 1'},
        {'code': 'STORE-2', 'name': 'Retail Store 2', 'address': 'High Street 42'},
    ]
    sites = [Site.objects.create(code=s['code'], organization=org, name=s['name'], address=s['address'], is_active=True) for s in sites_data]
    hq_site = sites[0]
    print(f"📍 Sites: {len(sites)}")

    # --- Warehouses ---
    whs = [Warehouse.objects.create(site=site, organization=org, name=f"Main Store - {site.code}",
           type='STORE' if 'STORE' in site.code else 'GENERAL') for site in sites]

    # ── CHART OF ACCOUNTS (Full SYSCOHADA Tree) ───────────────
    def coa(code, name, type, parent=None, sub_type=None):
        return ChartOfAccount.objects.create(code=code, organization=org, name=name, type=type, parent=parent, sub_type=sub_type)

    # Root accounts
    coa_assets = coa('1000', 'ASSETS', 'ASSET')
    coa_liab = coa('2000', 'LIABILITIES', 'LIABILITY')
    coa_equity = coa('3000', 'EQUITY', 'EQUITY')
    coa_revenue = coa('4000', 'REVENUE', 'INCOME')
    coa_cogs = coa('5000', 'COST OF GOODS SOLD', 'EXPENSE')
    coa_opex = coa('6000', 'OPERATING EXPENSES', 'EXPENSE')

    # Assets detail
    curr_assets = coa('1100', 'Current Assets', 'ASSET', coa_assets)
    coa_ar = coa('1110', 'Accounts Receivable', 'ASSET', curr_assets)
    coa_inventory = coa('1120', 'Inventory', 'ASSET', curr_assets)
    coa_cash_root = coa('5700', 'Cash Accounts', 'ASSET', curr_assets, 'CASH')
    coa_bank_root = coa('5120', 'Bank Accounts', 'ASSET', curr_assets, 'BANK')
    fixed_assets = coa('1200', 'Fixed Assets', 'ASSET', coa_assets)
    coa_equip = coa('1201', 'Equipment', 'ASSET', fixed_assets)
    coa_vehicles = coa('1202', 'Vehicles', 'ASSET', fixed_assets)
    coa_it = coa('1203', 'IT Equipment', 'ASSET', fixed_assets)
    coa_accum_depr = coa('1210', 'Accumulated Depreciation', 'ASSET', coa_assets)
    coa_prepaid = coa('1300', 'Prepaid Expenses', 'ASSET', curr_assets)

    # Liabilities detail
    curr_liab = coa('2100', 'Current Liabilities', 'LIABILITY', coa_liab)
    coa_ap = coa('2101', 'Accounts Payable', 'LIABILITY', curr_liab)
    coa_vat = coa('2111', 'VAT Payable', 'LIABILITY', curr_liab)
    coa_payroll = coa('2121', 'Salaries Payable', 'LIABILITY', curr_liab)
    coa_accrued = coa('2130', 'Accrued Expenses', 'LIABILITY', curr_liab)

    # Equity detail
    coa_capital = coa('3100', 'Share Capital', 'EQUITY', coa_equity)
    coa_retained = coa('3200', 'Retained Earnings', 'EQUITY', coa_equity)

    # Revenue detail
    coa_sales = coa('4100', 'Sales Revenue', 'INCOME', coa_revenue)
    coa_sales_retail = coa('4110', 'Retail Sales', 'INCOME', coa_sales)
    coa_sales_wholesale = coa('4120', 'Wholesale Sales', 'INCOME', coa_sales)
    coa_other_income = coa('4200', 'Other Income', 'INCOME', coa_revenue)
    coa_discounts = coa('4500', 'Discounts Given', 'INCOME', coa_revenue)

    # COGS detail
    coa_cost_sales = coa('5100', 'Cost of Sales', 'EXPENSE', coa_cogs)
    coa_inv_adj = coa('5104', 'Inventory Adjustment', 'EXPENSE', coa_cogs)

    # Operating Expenses detail
    coa_salaries = coa('6100', 'Salaries & Wages', 'EXPENSE', coa_opex)
    coa_rent = coa('6200', 'Rent Expense', 'EXPENSE', coa_opex)
    coa_utilities = coa('6210', 'Utilities', 'EXPENSE', coa_opex)
    coa_telecom = coa('6220', 'Telecom', 'EXPENSE', coa_opex)
    coa_maintenance = coa('6230', 'Maintenance', 'EXPENSE', coa_opex)
    coa_transport = coa('6240', 'Transport', 'EXPENSE', coa_opex)
    coa_marketing = coa('6250', 'Marketing', 'EXPENSE', coa_opex)
    coa_insurance = coa('6260', 'Insurance', 'EXPENSE', coa_opex)
    coa_office = coa('6270', 'Office Supplies', 'EXPENSE', coa_opex)
    coa_prof_fees = coa('6280', 'Professional Fees', 'EXPENSE', coa_opex)
    coa_depr_exp = coa('6303', 'Depreciation Expense', 'EXPENSE', coa_opex)
    coa_misc = coa('6400', 'Miscellaneous', 'EXPENSE', coa_opex)
    coa_taxes = coa('6500', 'Taxes & Fees', 'EXPENSE', coa_opex)

    total_coa = ChartOfAccount.objects.filter(organization=org).count()
    print(f"📊 Chart of Accounts: {total_coa} accounts created (full tree).")

    # Save Posting Rules
    org.settings = org.settings or {}
    org.settings['finance_posting_rules'] = {
        'sales': {'receivable': coa_ar.id, 'revenue': coa_sales.id, 'cogs': coa_cost_sales.id, 'inventory': coa_inventory.id},
        'purchases': {'payable': coa_ap.id, 'inventory': coa_inventory.id, 'tax': coa_vat.id},
        'inventory': {'adjustment': coa_inv_adj.id, 'transfer': coa_inventory.id},
        'automation': {'customerRoot': coa_ar.id, 'supplierRoot': coa_ap.id, 'payrollRoot': coa_payroll.id},
    }
    org.save(update_fields=['settings'])

    # ── FINANCIAL ACCOUNTS ────────────────────────────────────
    fa_cash = FinancialAccount.objects.create(organization=org, name='Main Cash Drawer', type='CASH', currency='USD', site=hq_site, linked_coa=coa_cash_root, balance=Decimal('50000.00'))
    fa_bank = FinancialAccount.objects.create(organization=org, name='Main Bank Account', type='BANK', currency='USD', site=hq_site, linked_coa=coa_bank_root, balance=Decimal('250000.00'))
    fa_petty = FinancialAccount.objects.create(organization=org, name='Petty Cash', type='PETTY_CASH', currency='USD', site=hq_site, linked_coa=coa_cash_root, balance=Decimal('5000.00'))
    fa_store1 = FinancialAccount.objects.create(organization=org, name='Store 1 Cash', type='CASH', currency='USD', site=sites[3], linked_coa=coa_cash_root, balance=Decimal('10000.00'))
    fa_store2 = FinancialAccount.objects.create(organization=org, name='Store 2 Cash', type='CASH', currency='USD', site=sites[4], linked_coa=coa_cash_root, balance=Decimal('10000.00'))
    financial_accounts = [fa_cash, fa_bank, fa_petty, fa_store1, fa_store2]
    print(f"💳 Financial Accounts: {len(financial_accounts)}")

    # ── FISCAL YEARS & PERIODS ────────────────────────────────
    for yr in [2024, 2025, 2026]:
        fy, _ = FiscalYear.objects.get_or_create(
            name=f"FY-{yr}", organization=org,
            defaults={'start_date': date(yr, 1, 1), 'end_date': date(yr, 12, 31)}
        )
        for month in range(1, 13):
            last_day = calendar.monthrange(yr, month)[1]
            FiscalPeriod.objects.get_or_create(
                fiscal_year=fy, organization=org, name=f"P{month:02d}-{yr}",
                defaults={'start_date': date(yr, month, 1), 'end_date': date(yr, month, last_day), 'status': 'OPEN'}
            )
    print("📅 Fiscal Years & Periods: 3 years × 12 periods.")

    # ── UNITS (Tree) ──────────────────────────────────────────
    unit_pc = Unit.objects.create(code='PC', organization=org, name='Piece', short_name='pc', type='UNIT')
    unit_kg = Unit.objects.create(code='KG', organization=org, name='Kilogram', short_name='kg', type='WEIGHT')
    unit_l = Unit.objects.create(code='LTR', organization=org, name='Liter', short_name='L', type='VOLUME')
    unit_m = Unit.objects.create(code='MTR', organization=org, name='Meter', short_name='m', type='LENGTH')
    unit_g = Unit.objects.create(code='G', organization=org, name='Gram', short_name='g', type='WEIGHT', base_unit=unit_kg, conversion_factor=Decimal('0.001'))
    unit_ml = Unit.objects.create(code='ML', organization=org, name='Milliliter', short_name='ml', type='VOLUME', base_unit=unit_l, conversion_factor=Decimal('0.001'))
    unit_cm = Unit.objects.create(code='CM', organization=org, name='Centimeter', short_name='cm', type='LENGTH', base_unit=unit_m, conversion_factor=Decimal('0.01'))
    unit_box = Unit.objects.create(code='BOX', organization=org, name='Box', short_name='box', type='UNIT', base_unit=unit_pc, conversion_factor=Decimal('12'))
    unit_pack = Unit.objects.create(code='PACK', organization=org, name='Pack', short_name='pack', type='UNIT', base_unit=unit_pc, conversion_factor=Decimal('6'))
    unit_dozen = Unit.objects.create(code='DZN', organization=org, name='Dozen', short_name='dz', type='UNIT', base_unit=unit_pc, conversion_factor=Decimal('12'))
    print("📏 Units: 10 (4 root + 6 derived).")

    # ── CATEGORIES (Tree) ─────────────────────────────────────
    cat_tree = {
        'Electronics': ['Phones', 'Laptops', 'Tablets', 'Accessories', 'Audio'],
        'Home Appliances': ['Kitchen', 'Laundry', 'Climate Control', 'Cleaning'],
        'Furniture': ['Living Room', 'Bedroom', 'Office', 'Outdoor'],
        'Apparel': ['Men', 'Women', 'Kids', 'Sportswear'],
        'FMCG': ['Beverages', 'Snacks', 'Personal Care', 'Household'],
    }
    leaf_cats = []
    root_cats = []
    for parent_name, children in cat_tree.items():
        parent_cat = Category.objects.create(name=parent_name, organization=org, code=parent_name[:3].upper())
        root_cats.append(parent_cat)
        for child_name in children:
            child_cat = Category.objects.create(
                name=child_name, organization=org, parent=parent_cat,
                code=f"{parent_name[:2].upper()}-{child_name[:3].upper()}"
            )
            leaf_cats.append(child_cat)
    print(f"📂 Categories: {len(root_cats)} root + {len(leaf_cats)} leaf.")

    # ── BRANDS ────────────────────────────────────────────────
    brand_names = ['TechGiant', 'HomeMaster', 'LuxLiving', 'EverWear', 'DailyChoice',
                   'SmartLife', 'PureBliss', 'NatureFresh', 'ProElite', 'GlobalEdge']
    brands = [Brand.objects.create(name=b, organization=org) for b in brand_names]

    # ── PRODUCTS (100 Standard + 10 Combos) ───────────────────
    vat_rate = Decimal('11.00')
    vat_mult = Decimal('1.11')

    products = []
    for i in range(1, 101):
        cat = random.choice(leaf_cats)
        brand = random.choice(brands)
        parent_name = cat.parent.name if cat.parent else cat.name
        if parent_name == 'FMCG':
            unit = random.choice([unit_pc, unit_kg, unit_g, unit_l, unit_ml])
        elif parent_name in ('Furniture', 'Electronics'):
            unit = unit_pc
        else:
            unit = random.choice([unit_pc, unit_box, unit_pack])

        cost_ht = Decimal(random.uniform(5.0, 500.0)).quantize(Decimal('0.01'))
        selling_ht = (cost_ht * Decimal(random.uniform(1.3, 2.0))).quantize(Decimal('0.01'))
        cost_ttc = (cost_ht * vat_mult).quantize(Decimal('0.01'))
        selling_ttc = (selling_ht * vat_mult).quantize(Decimal('0.01'))

        prod = Product.objects.create(
            sku=f"PRD-{i:04d}", organization=org,
            name=f"Premium {cat.name} Item {i}",
            product_type='STANDARD',
            category=cat, brand=brand, unit=unit,
            cost_price=cost_ht,
            cost_price_ht=cost_ht,
            cost_price_ttc=cost_ttc,
            selling_price_ht=selling_ht,
            selling_price_ttc=selling_ttc,
            tva_rate=vat_rate,
            min_stock_level=random.randint(5, 50),
            max_stock_level=random.randint(200, 1000),
            reorder_point=Decimal(random.randint(10, 30)),
            reorder_quantity=Decimal(random.randint(50, 200)),
            is_active=True
        )
        products.append(prod)

    # Combos
    combo_products = []
    combo_names = ['Starter Tech Bundle', 'Home Office Kit', 'Kitchen Essentials Pack',
                   'Fitness Bundle', 'Back to School Set', 'Gift Box Premium',
                   'Weekend Getaway Kit', 'Family Movie Pack', 'Party Essentials',
                   'Ultimate Cleaning Set']
    for i, cname in enumerate(combo_names, start=101):
        components = random.sample(products, random.randint(2, 5))
        total_cost = sum(p.cost_price for p in components)
        bundle_sell = (total_cost * Decimal('1.4')).quantize(Decimal('0.01'))
        combo = Product.objects.create(
            sku=f"CMB-{i:04d}", organization=org,
            name=cname, product_type='COMBO',
            category=random.choice(leaf_cats), brand=random.choice(brands), unit=unit_pc,
            cost_price=total_cost, cost_price_ht=total_cost,
            cost_price_ttc=(total_cost * vat_mult).quantize(Decimal('0.01')),
            selling_price_ht=bundle_sell,
            selling_price_ttc=(bundle_sell * vat_mult).quantize(Decimal('0.01')),
            tva_rate=vat_rate, is_active=True
        )
        combo_products.append(combo)
        for j, comp in enumerate(components):
            ComboComponent.objects.create(organization=org, combo_product=combo,
                component_product=comp, quantity=random.randint(1, 3), sort_order=j)
    all_products = products + combo_products
    print(f"📦 Products: {len(products)} standard + {len(combo_products)} combos (all with HT+TTC prices).")

    # ── CONTACTS ──────────────────────────────────────────────
    suppliers = []
    for i in range(1, 11):
        sup = Contact.objects.create(name=f"Supplier {brands[i % len(brands)].name} {i}", organization=org,
            type='SUPPLIER', company_name=f"Corp {i}")
        suppliers.append(sup)

    customers = []
    for i in range(1, 101):
        cust = Contact.objects.create(name=f"Customer {i}", organization=org,
            type='CUSTOMER', phone=f"+961 70 {i:06d}",
            customer_tier=random.choice(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']))
        customers.append(cust)
    print(f"👥 Contacts: {len(suppliers)} suppliers + {len(customers)} customers.")

    # ── ASSETS (Fixed) ────────────────────────────────────────
    asset_data = [
        ('Delivery Van', 'VEHICLE', Decimal('35000'), 7, coa_vehicles),
        ('POS System', 'IT', Decimal('5000'), 5, coa_it),
        ('Server Rack', 'IT', Decimal('12000'), 5, coa_it),
        ('Forklift', 'EQUIPMENT', Decimal('20000'), 10, coa_equip),
        ('Office Desks (Set)', 'FURNITURE', Decimal('8000'), 10, coa_equip),
        ('AC System', 'EQUIPMENT', Decimal('15000'), 8, coa_equip),
    ]
    assets_list = []
    for name, cat_key, value, life, acc in asset_data:
        ast = Asset.objects.create(
            organization=org, name=name, category=cat_key,
            purchase_value=value, purchase_date=date(2024, 7, 1),
            useful_life_years=life, depreciation_method='LINEAR',
            book_value=value, asset_coa=acc,
            depreciation_expense_coa=coa_depr_exp,
            accumulated_depreciation_coa=coa_accum_depr,
            source_account=fa_bank, status='ACTIVE'
        )
        assets_list.append(ast)
    print(f"🏗️ Assets: {len(assets_list)}.")

    # ── HR: Departments, Shifts, Employees ────────────────────
    dept_tree = {
        'Executive': ['Strategy'],
        'Operations': ['Warehouse Ops', 'Logistics'],
        'Sales': ['Retail', 'Wholesale'],
        'Finance': ['Accounting', 'Payroll'],
        'HR': ['Recruitment', 'Training'],
    }
    all_depts = []
    leaf_depts = []
    for pname, children in dept_tree.items():
        pdept = Department.objects.create(name=pname, organization=org, code=pname[:3].upper())
        all_depts.append(pdept)
        for cname in children:
            cdept = Department.objects.create(name=cname, organization=org, parent=pdept, code=f"{pname[:2].upper()}-{cname[:3].upper()}")
            all_depts.append(cdept)
            leaf_depts.append(cdept)

    shifts = [
        Shift.objects.create(organization=org, name='Morning', code='AM', start_time=time(8, 0), end_time=time(16, 0), break_minutes=60, site=hq_site),
        Shift.objects.create(organization=org, name='Evening', code='PM', start_time=time(14, 0), end_time=time(22, 0), break_minutes=60, site=hq_site),
        Shift.objects.create(organization=org, name='Night', code='NT', start_time=time(22, 0), end_time=time(6, 0), break_minutes=45, site=hq_site),
    ]

    first_names = ['Ahmad', 'Fatima', 'Omar', 'Layla', 'Hassan', 'Nour', 'Youssef',
                   'Rima', 'Karim', 'Sara', 'Ali', 'Maya', 'Tarek', 'Dana', 'Walid',
                   'Hana', 'Sami', 'Zeina', 'Fadi', 'Lina', 'Mohamad', 'Rana',
                   'Bilal', 'Mona', 'Chadi']
    last_names = ['Khalil', 'Haddad', 'Nassif', 'Karam', 'Saleh', 'Farah', 'Mourad',
                  'Harb', 'Jaber', 'Saade', 'Awad', 'Mansour', 'Daher', 'Tabet',
                  'Issa', 'Rizk', 'Sarkis', 'Bitar', 'Chehab', 'Khoury', 'Gemayel',
                  'Badr', 'Zein', 'Hajj', 'Obeid']
    job_titles = ['Manager', 'Supervisor', 'Associate', 'Specialist', 'Analyst',
                  'Coordinator', 'Team Lead', 'Assistant', 'Officer', 'Director']

    employees = []
    for i in range(25):
        emp = Employee.objects.create(
            organization=org, employee_id=f"EMP-{i+1:04d}",
            first_name=first_names[i], last_name=last_names[i],
            phone=f"+961 71 {random.randint(100000, 999999)}",
            email=f"{first_names[i].lower()}.{last_names[i].lower()}@enterprise.com",
            job_title=random.choice(job_titles),
            employee_type='EMPLOYEE',
            salary=Decimal(random.randint(1500, 8000)),
            home_site=random.choice(sites),
            date_of_birth=date(random.randint(1975, 2000), random.randint(1, 12), random.randint(1, 28)),
            nationality=random.choice(['Lebanese', 'Syrian', 'Palestinian', 'Egyptian', 'Jordanian']),
        )
        employees.append(emp)
    print(f"👔 HR: {len(all_depts)} departments, {len(shifts)} shifts, {len(employees)} employees.")

    # ══════════════════════════════════════════════════════════════
    # PHASE 2: HISTORICAL LOOP (18 months)
    # ══════════════════════════════════════════════════════════════

    start_date = timezone.make_aware(datetime.now() - timedelta(days=540))
    current_time = start_date
    end_date = timezone.now()

    # Mapping for expenses
    expense_categories = ['RENT', 'UTILITIES', 'OFFICE_SUPPLIES', 'MAINTENANCE', 'TRANSPORT', 'TELECOM', 'MARKETING', 'PROFESSIONAL_FEES', 'TAXES_FEES']
    expense_coa_map = {
        'RENT': coa_rent, 'UTILITIES': coa_utilities, 'OFFICE_SUPPLIES': coa_office,
        'MAINTENANCE': coa_maintenance, 'TRANSPORT': coa_transport, 'TELECOM': coa_telecom,
        'MARKETING': coa_marketing, 'PROFESSIONAL_FEES': coa_prof_fees, 'TAXES_FEES': coa_taxes,
    }

    print("⏳ Simulating 1.5 Years of activity...")

    while current_time < end_date:
        reset_queries()
        gc.collect()
        close_old_connections()

        cur_date = current_time.date()

        # ─── 1. DAILY: Attendance (weekdays) ─────────────────────
        if cur_date.weekday() < 5:
            att_batch = []
            for emp in employees:
                shift = random.choice(shifts)
                status = random.choices(['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY'], weights=[80, 10, 5, 5], k=1)[0]
                check_in = check_out = None
                if status in ('PRESENT', 'LATE', 'HALF_DAY'):
                    ci_hour = shift.start_time.hour + (1 if status == 'LATE' else 0)
                    check_in = timezone.make_aware(datetime.combine(cur_date, time(min(ci_hour, 23), random.randint(0, 59))))
                    co_hour = shift.end_time.hour if shift.end_time.hour > shift.start_time.hour else shift.end_time.hour + 24
                    if status == 'HALF_DAY':
                        co_hour = ci_hour + 4
                    actual_co = co_hour if co_hour < 24 else co_hour - 24
                    check_out = timezone.make_aware(datetime.combine(
                        cur_date if co_hour < 24 else cur_date + timedelta(days=1),
                        time(actual_co, random.randint(0, 59))))
                att_batch.append(Attendance(organization=org, employee=emp, date=cur_date, status=status, shift=shift, check_in=check_in, check_out=check_out))
            Attendance.objects.bulk_create(att_batch, ignore_conflicts=True)

        # ─── 2. DAILY: Sales Orders + Invoices + Payments ────────
        store_whs = [w for w in whs if w.type == 'STORE']
        active_store = store_whs[cur_date.toordinal() % len(store_whs)]
        for store_wh in [active_store]:
            daily_count = random.randint(2, 3)
            batch_refs = get_ref_batch(org, 'ORD', daily_count)
            inv_refs = get_ref_batch(org, 'INV', daily_count)
            pay_refs = get_ref_batch(org, 'PAY', daily_count)
            store_fa = fa_store1 if 'STORE-1' in store_wh.site.code else fa_store2

            for idx in range(daily_count):
                cust = random.choice(customers)
                ref = batch_refs[idx]
                random_t = time(random.randint(8, 18), random.randint(0, 59))
                order_time = timezone.make_aware(datetime.combine(cur_date, random_t))

                # Create Sale Order
                order = Order.objects.create(
                    organization=org, type='SALE', status='COMPLETED',
                    ref_code=ref, contact=cust, site=store_wh.site,
                    total_amount=0, created_at=order_time
                )
                Order.objects.filter(id=order.id).update(created_at=order_time)

                total_ht = Decimal('0')
                total_ttc = Decimal('0')
                lines_batch = []
                moves_batch = []
                inv_lines_data = []

                for _ in range(random.randint(1, 3)):
                    p = random.choice(products)
                    qty = random.randint(1, 3)

                    inv_rec, _ = Inventory.objects.get_or_create(warehouse=store_wh, product=p, organization=org)
                    inv_rec.quantity = Decimal(str(inv_rec.quantity)) - Decimal(qty)
                    inv_rec.save()

                    line_total = qty * p.selling_price_ttc
                    lines_batch.append(OrderLine(
                        organization=org, order=order, product=p,
                        quantity=qty, unit_price=p.selling_price_ttc, total=line_total))
                    total_ttc += line_total
                    total_ht += qty * p.selling_price_ht

                    moves_batch.append(InventoryMovement(
                        organization=org, product=p, warehouse=store_wh,
                        type='OUT', quantity=qty, reference=ref,
                        cost_price=p.cost_price, created_at=order_time))

                    inv_lines_data.append({'product': p, 'qty': qty})

                OrderLine.objects.bulk_create(lines_batch)
                InventoryMovement.objects.bulk_create(moves_batch)
                Order.objects.filter(id=order.id).update(total_amount=total_ttc)

                # Create Sales Invoice
                tax_amt = total_ttc - total_ht
                invoice = Invoice.objects.create(
                    organization=org, type='SALES', sub_type='RETAIL',
                    invoice_number=inv_refs[idx],
                    contact=cust, contact_name=cust.name,
                    site=store_wh.site, source_order=order,
                    issue_date=cur_date, due_date=cur_date,
                    payment_terms='IMMEDIATE', payment_terms_days=0,
                    subtotal_ht=total_ht, tax_amount=tax_amt,
                    total_amount=total_ttc, paid_amount=total_ttc,
                    balance_due=Decimal('0'), display_mode='TTC',
                    status='PAID', paid_at=order_time
                )
                for j, ild in enumerate(inv_lines_data):
                    p = ild['product']
                    q = ild['qty']
                    InvoiceLine.objects.create(
                        organization=org, invoice=invoice, product=p,
                        description=p.name, quantity=q,
                        unit_price=p.selling_price_ttc, tax_rate=vat_rate,
                        line_total_ht=q * p.selling_price_ht,
                        tax_amount=q * (p.selling_price_ttc - p.selling_price_ht),
                        line_total_ttc=q * p.selling_price_ttc,
                        unit_cost=p.cost_price, sort_order=j
                    )

                # Create Payment
                Payment.objects.create(
                    organization=org, type='CUSTOMER_RECEIPT',
                    contact=cust, amount=total_ttc,
                    payment_date=cur_date,
                    method=random.choice(['CASH', 'CARD', 'CASH']),
                    reference=pay_refs[idx],
                    description=f"Payment for {ref}",
                    sales_order=order, invoice=invoice,
                    payment_account=store_fa,
                    status='POSTED'
                )

                # Cash Transaction
                Transaction.objects.create(
                    organization=org, account=store_fa,
                    amount=total_ttc, type='IN',
                    description=f"Sale {ref}",
                    reference=ref, site=store_wh.site
                )

        # ─── 3. BI-WEEKLY: Purchase Restocks + Purchase Invoices ──
        if cur_date.weekday() == 0 and cur_date.day <= 14:
            gen_whs_list = [w for w in whs if w.type == 'GENERAL']
            wh = gen_whs_list[cur_date.month % len(gen_whs_list)]
            for k in range(1):
                    ref = get_ref_batch(org, 'PO', 1)[0]
                    pinv_ref = get_ref_batch(org, 'PINV', 1)[0]
                    ppay_ref = get_ref_batch(org, 'PPAY', 1)[0]
                    sup = random.choice(suppliers)
                    order = Order.objects.create(
                        organization=org, type='PURCHASE', status='DRAFT',
                        ref_code=ref, contact=sup, site=wh.site,
                        total_amount=0, created_at=current_time
                    )
                    order.created_at = current_time
                    order.save(force_audit_bypass=True)

                    total_ht = Decimal('0')
                    total_ttc = Decimal('0')
                    lines = []
                    movements = []
                    pinv_lines_data = []
                    for _ in range(random.randint(3, 6)):
                        p = random.choice(products)
                        qty = random.randint(20, 80)
                        line_total = qty * p.cost_price
                        line = OrderLine(organization=org, order=order, product=p,
                            quantity=qty, unit_price=p.cost_price, total=line_total)
                        total_ht += line_total
                        total_ttc += qty * p.cost_price_ttc
                        lines.append(line)
                        pinv_lines_data.append({'product': p, 'qty': qty})

                        inv_rec, _ = Inventory.objects.get_or_create(warehouse=wh, product=p, organization=org)
                        inv_rec.quantity = Decimal(str(inv_rec.quantity)) + Decimal(qty)
                        inv_rec.save()

                        movements.append(InventoryMovement(
                            organization=org, product=p, warehouse=wh,
                            type='IN', quantity=qty, reference=ref,
                            cost_price=p.cost_price, created_at=current_time))
                    OrderLine.objects.bulk_create(lines)
                    InventoryMovement.objects.bulk_create(movements)
                    order.total_amount = total_ttc
                    order.status = 'COMPLETED'
                    order.save(force_audit_bypass=True)
                    Order.objects.filter(id=order.id).update(created_at=current_time)

                    # Purchase Invoice
                    tax_amt = total_ttc - total_ht
                    pinv = Invoice.objects.create(
                        organization=org, type='PURCHASE',
                        invoice_number=pinv_ref,
                        contact=sup, contact_name=sup.name,
                        site=wh.site, source_order=order,
                        issue_date=cur_date, due_date=cur_date + timedelta(days=30),
                        payment_terms='NET_30', payment_terms_days=30,
                        subtotal_ht=total_ht, tax_amount=tax_amt,
                        total_amount=total_ttc,
                        paid_amount=total_ttc,
                        balance_due=Decimal('0'),
                        display_mode='HT', status='PAID'
                    )
                    for j, pld in enumerate(pinv_lines_data):
                        p = pld['product']
                        q = pld['qty']
                        InvoiceLine.objects.create(
                            organization=org, invoice=pinv, product=p,
                            description=p.name, quantity=q,
                            unit_price=p.cost_price, tax_rate=vat_rate,
                            line_total_ht=q * p.cost_price,
                            tax_amount=q * (p.cost_price_ttc - p.cost_price),
                            line_total_ttc=q * p.cost_price_ttc,
                            unit_cost=p.cost_price, sort_order=j
                        )

                    # Supplier Payment
                    Payment.objects.create(
                        organization=org, type='SUPPLIER_PAYMENT',
                        contact=sup, amount=total_ttc,
                        payment_date=cur_date + timedelta(days=random.randint(7, 30)),
                        method=random.choice(['BANK', 'CHECK']),
                        reference=ppay_ref,
                        description=f"Payment for {ref}",
                        supplier_invoice=order, invoice=pinv,
                        payment_account=fa_bank,
                        status='POSTED'
                    )

        # ─── 4. BI-WEEKLY: Stock Transfers (1st & 3rd Fridays) ────
        if cur_date.weekday() == 4 and cur_date.day <= 14:
            gen_whs_list2 = [w for w in whs if w.type == 'GENERAL']
            store_whs_list2 = [w for w in whs if w.type == 'STORE']
            src = random.choice(gen_whs_list2)
            dest = random.choice(store_whs_list2)
            trf_ref = get_ref_batch(org, 'TRF', 1)[0]
            trf_order = StockTransferOrder.objects.create(
                organization=org, reference=trf_ref, date=cur_date,
                from_warehouse=src, to_warehouse=dest,
                reason='Replenishment', is_posted=True,
                lifecycle_status='CONFIRMED')
            total_qty = 0
            for _ in range(random.randint(2, 3)):
                p = random.choice(products)
                qty = random.randint(10, 20)
                inv_src, _ = Inventory.objects.get_or_create(warehouse=src, product=p, organization=org)
                if Decimal(str(inv_src.quantity)) >= Decimal(qty):
                    inv_src.quantity = Decimal(str(inv_src.quantity)) - Decimal(qty)
                    inv_src.save()
                    inv_dest, _ = Inventory.objects.get_or_create(warehouse=dest, product=p, organization=org)
                    inv_dest.quantity = Decimal(str(inv_dest.quantity)) + Decimal(qty)
                    inv_dest.save()
                    StockTransferLine.objects.create(order=trf_order, product=p, qty_transferred=qty, from_warehouse=src, to_warehouse=dest)
                    total_qty += qty
            StockTransferOrder.objects.filter(id=trf_order.id).update(total_qty_transferred=total_qty, created_at=current_time)

        # ─── 5. BI-WEEKLY: Stock Adjustments ─────────────────────
        if cur_date.day in (15, 28):
            adj_wh = random.choice(whs)
            adj_ref = get_ref_batch(org, 'ADJ', 1)[0]
            adj_order = StockAdjustmentOrder.objects.create(
                organization=org, reference=adj_ref, date=cur_date,
                warehouse=adj_wh, reason='Cycle count adjustment',
                is_posted=True, lifecycle_status='CONFIRMED')
            total_adj = 0
            for _ in range(random.randint(2, 5)):
                p = random.choice(products)
                qty_adj = random.randint(-5, 10)
                StockAdjustmentLine.objects.create(order=adj_order, product=p, qty_adjustment=qty_adj, warehouse=adj_wh,
                    reason=random.choice(['Cycle count variance', 'Damage write-off', 'Found stock']))
                inv_rec, _ = Inventory.objects.get_or_create(warehouse=adj_wh, product=p, organization=org)
                inv_rec.quantity = Decimal(str(inv_rec.quantity)) + Decimal(qty_adj)
                inv_rec.save()
                total_adj += qty_adj
            StockAdjustmentOrder.objects.filter(id=adj_order.id).update(total_qty_adjustment=total_adj, created_at=current_time)

        # ─── 6. WEEKLY: Operational Requests (Wednesdays) ────────
        if cur_date.weekday() == 2:
            for _ in range(random.randint(1, 3)):
                req_ref = get_ref_batch(org, 'REQ', 1)[0]
                OperationalRequest.objects.create(
                    organization=org, reference=req_ref,
                    request_type=random.choice(['PURCHASE_ORDER', 'STOCK_ADJUSTMENT', 'STOCK_TRANSFER']),
                    date=cur_date,
                    priority=random.choice(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
                    status=random.choices(['PENDING', 'APPROVED', 'CONVERTED', 'REJECTED'], weights=[30, 30, 30, 10], k=1)[0],
                    description=f"Auto-generated operational request")

        # ─── 7. MONTHLY: Payroll + Expenses + Leave + Journal ────
        if cur_date.day == 1:
            # === Payroll Journal Entry ===
            total_salary = sum(e.salary for e in employees)
            je_ref = f"PAY-{current_time.strftime('%Y%m')}"
            je = JournalEntry.objects.create(
                organization=org, transaction_date=current_time,
                description=f"Monthly Payroll - {current_time.strftime('%B %Y')}",
                status='POSTED', reference=je_ref, site=hq_site)
            JournalEntryLine.objects.create(journal_entry=je, organization=org, account=coa_salaries, debit=total_salary, credit=0, description="Salary Expense")
            JournalEntryLine.objects.create(journal_entry=je, organization=org, account=coa_cash_root, debit=0, credit=total_salary, description="Cash Disbursement")

            # Bank transaction for payroll
            Transaction.objects.create(organization=org, account=fa_bank, amount=-total_salary, type='OUT',
                description=f"Payroll {current_time.strftime('%B %Y')}", reference=je_ref, site=hq_site)

            # === Direct Expenses (3-5 per month) ===
            for _ in range(random.randint(3, 5)):
                exp_cat = random.choice(expense_categories)
                exp_amt = Decimal(random.uniform(200, 5000)).quantize(Decimal('0.01'))
                exp_ref = get_ref_batch(org, 'EXP', 1)[0]

                # Journal Entry for expense
                exp_je = JournalEntry.objects.create(
                    organization=org, transaction_date=current_time,
                    description=f"{exp_cat.replace('_', ' ').title()} Expense",
                    status='POSTED', reference=exp_ref, site=hq_site)
                JournalEntryLine.objects.create(journal_entry=exp_je, organization=org,
                    account=expense_coa_map.get(exp_cat, coa_misc), debit=exp_amt, credit=0, description=exp_cat)
                JournalEntryLine.objects.create(journal_entry=exp_je, organization=org,
                    account=coa_cash_root, debit=0, credit=exp_amt, description="Payment")

                DirectExpense.objects.create(
                    organization=org, name=f"{exp_cat.replace('_', ' ').title()} - {cur_date.strftime('%b %Y')}",
                    category=exp_cat, amount=exp_amt, date=cur_date,
                    reference=exp_ref, source_account=random.choice([fa_cash, fa_bank, fa_petty]),
                    expense_coa=expense_coa_map.get(exp_cat, coa_misc),
                    journal_entry=exp_je, status='POSTED')

                Transaction.objects.create(organization=org, account=fa_cash, amount=-exp_amt, type='OUT',
                    description=f"Expense: {exp_cat}", reference=exp_ref, site=hq_site)

            # === Deferred Expenses (annual subscriptions - quarterly check) ===
            if cur_date.month in (1, 4, 7, 10):
                deferred_items = [
                    ('Annual Software License', 'SUBSCRIPTION', Decimal('6000'), 12),
                    ('Office Renovation', 'RENOVATION', Decimal('24000'), 12),
                    ('Annual Insurance', 'INSURANCE', Decimal('12000'), 12),
                ]
                for dname, dcat, dtotal, months in deferred_items:
                    DeferredExpense.objects.create(
                        organization=org, name=f"{dname} - Q{(cur_date.month-1)//3 + 1} {cur_date.year}",
                        category=dcat, total_amount=dtotal, duration_months=months,
                        start_date=cur_date,
                        remaining_amount=dtotal, status='ACTIVE',
                        expense_coa=coa_prepaid, source_account=fa_bank
                    )

            # === Leave Requests (2-4 per month) ===
            for _ in range(random.randint(2, 4)):
                emp = random.choice(employees)
                leave_start = cur_date + timedelta(days=random.randint(1, 25))
                leave_days = random.randint(1, 5)
                Leave.objects.create(
                    organization=org, employee=emp,
                    leave_type=random.choices(['ANNUAL', 'SICK', 'UNPAID', 'COMPENSATORY'], weights=[40, 30, 20, 10], k=1)[0],
                    start_date=leave_start, end_date=leave_start + timedelta(days=leave_days),
                    reason="Personal matters",
                    status=random.choice(['PENDING', 'APPROVED', 'APPROVED', 'APPROVED']))

            # === Vouchers (2-3 per month: Transfers between accounts) ===
            for _ in range(random.randint(2, 3)):
                v_ref = get_ref_batch(org, 'VCH', 1)[0]
                v_amt = Decimal(random.uniform(500, 10000)).quantize(Decimal('0.01'))
                src, dst = random.sample(financial_accounts, 2)
                Voucher.objects.create(
                    organization=org, voucher_type='TRANSFER',
                    amount=v_amt, date=cur_date,
                    reference=v_ref, description=f"Internal Fund Transfer",
                    source_account=src, destination_account=dst,
                    is_posted=True, lifecycle_status='CONFIRMED',
                )

        # ─── Advance Day ─────────────────────────────────────────
        current_time += timedelta(days=1)
        if current_time.day == 1:
            print(f"📅 Progress: {current_time.strftime('%B %Y')} complete.")

    print("✅ Simulation complete across ALL modules!")

if __name__ == '__main__':
    simulate()
