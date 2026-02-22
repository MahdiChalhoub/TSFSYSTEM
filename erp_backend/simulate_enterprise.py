import os
import django
import random
import uuid
from datetime import datetime, timedelta, date, time
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.apps import apps
from django.db import models, reset_queries
from django.contrib.auth import get_user_model
from django.utils import timezone
import gc

def get_model(app_label, model_name):
    return apps.get_model(app_label, model_name)

# Core Models
Organization = get_model('erp', 'Organization')
Site = get_model('erp', 'Site')
Role = get_model('erp', 'Role')
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
JournalEntry = get_model('finance', 'JournalEntry')
JournalEntryLine = get_model('finance', 'JournalEntryLine')
TransactionSequence = get_model('finance', 'TransactionSequence')

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
    # Find the demo org and purge simulation-specific data, not the whole org
    try:
        org = Organization.objects.get(slug='demo')
    except Organization.DoesNotExist:
        org = Organization.objects.create(slug='demo', name='Enterprise ERP (Demo)', is_active=True)

    # Purge generated data (keep seed data)
    Order.objects.filter(organization=org).delete()
    InventoryMovement.objects.filter(organization=org).delete()
    Inventory.objects.filter(organization=org).delete()
    JournalEntry.objects.filter(organization=org).delete()
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
    Site.objects.filter(organization=org).delete()
    print("🗑️ Existing simulation data purged.")

    # ── PHASE 1: FOUNDATION (Categories, Units, Products, HR) ──

    # --- Sites ---
    sites_data = [
        {'code': 'HQ-LEB', 'name': 'HQ - Beirut', 'address': 'Downtown Beirut'},
        {'code': 'WH-ALPHA', 'name': 'Warehouse Alpha', 'address': 'Industrial Zone A'},
        {'code': 'WH-BETA', 'name': 'Warehouse Beta', 'address': 'Industrial Zone B'},
        {'code': 'STORE-1', 'name': 'Retail Store 1', 'address': 'Mall Level 1'},
        {'code': 'STORE-2', 'name': 'Retail Store 2', 'address': 'High Street 42'},
    ]
    sites = []
    for s in sites_data:
        site = Site.objects.create(
            code=s['code'], organization=org,
            name=s['name'], address=s['address'], is_active=True
        )
        sites.append(site)
    print(f"📍 Sites: {len(sites)} created.")

    # --- Warehouses ---
    whs = []
    for site in sites:
        wh = Warehouse.objects.create(
            site=site, organization=org, name=f"Main Store - {site.code}",
            type='STORE' if 'STORE' in site.code else 'GENERAL'
        )
        whs.append(wh)

    # --- Units (Tree Structure) ---
    # Root units
    unit_pc = Unit.objects.create(code='PC', organization=org, name='Piece', short_name='pc', type='UNIT')
    unit_kg = Unit.objects.create(code='KG', organization=org, name='Kilogram', short_name='kg', type='WEIGHT')
    unit_l = Unit.objects.create(code='LTR', organization=org, name='Liter', short_name='L', type='VOLUME')
    unit_m = Unit.objects.create(code='MTR', organization=org, name='Meter', short_name='m', type='LENGTH')

    # Derived units (children)
    unit_g = Unit.objects.create(code='G', organization=org, name='Gram', short_name='g', type='WEIGHT',
                                  base_unit=unit_kg, conversion_factor=Decimal('0.001'))
    unit_ml = Unit.objects.create(code='ML', organization=org, name='Milliliter', short_name='ml', type='VOLUME',
                                   base_unit=unit_l, conversion_factor=Decimal('0.001'))
    unit_cm = Unit.objects.create(code='CM', organization=org, name='Centimeter', short_name='cm', type='LENGTH',
                                   base_unit=unit_m, conversion_factor=Decimal('0.01'))
    unit_box = Unit.objects.create(code='BOX', organization=org, name='Box', short_name='box', type='UNIT',
                                    base_unit=unit_pc, conversion_factor=Decimal('12'))
    unit_pack = Unit.objects.create(code='PACK', organization=org, name='Pack', short_name='pack', type='UNIT',
                                     base_unit=unit_pc, conversion_factor=Decimal('6'))
    unit_dozen = Unit.objects.create(code='DZN', organization=org, name='Dozen', short_name='dz', type='UNIT',
                                      base_unit=unit_pc, conversion_factor=Decimal('12'))
    all_units = [unit_pc, unit_kg, unit_l, unit_m, unit_g, unit_ml, unit_cm, unit_box, unit_pack, unit_dozen]
    print(f"📏 Units: {len(all_units)} created (4 root + 6 derived).")

    # --- Categories (Tree Structure) ---
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
    all_cats = root_cats + leaf_cats
    print(f"📂 Categories: {len(all_cats)} created ({len(root_cats)} root + {len(leaf_cats)} leaf).")

    # --- Brands ---
    brand_names = [
        'TechGiant', 'HomeMaster', 'LuxLiving', 'EverWear', 'DailyChoice',
        'SmartLife', 'PureBliss', 'NatureFresh', 'ProElite', 'GlobalEdge',
    ]
    brands = [Brand.objects.create(name=b, organization=org) for b in brand_names]
    print(f"🏷️ Brands: {len(brands)} created.")

    # --- Products (100 STANDARD + 10 COMBO) ---
    products = []
    product_unit_map = {}  # Map unit types to categories
    for i in range(1, 101):
        cat = random.choice(leaf_cats)
        brand = random.choice(brands)
        # Choose appropriate unit based on category parent
        parent_name = cat.parent.name if cat.parent else cat.name
        if parent_name == 'FMCG':
            unit = random.choice([unit_pc, unit_kg, unit_g, unit_l, unit_ml])
        elif parent_name in ('Furniture', 'Electronics'):
            unit = unit_pc
        else:
            unit = random.choice([unit_pc, unit_box, unit_pack])

        cost = Decimal(random.uniform(5.0, 500.0)).quantize(Decimal('0.01'))
        selling = (cost * Decimal(random.uniform(1.3, 2.0))).quantize(Decimal('0.01'))
        tva = Decimal('11.00')  # 11% VAT

        prod = Product.objects.create(
            sku=f"PRD-{i:04d}", organization=org,
            name=f"Premium {cat.name} Item {i}",
            product_type='STANDARD',
            category=cat, brand=brand, unit=unit,
            cost_price=cost, cost_price_ht=cost,
            cost_price_ttc=(cost * Decimal('1.11')).quantize(Decimal('0.01')),
            selling_price_ht=selling,
            selling_price_ttc=(selling * Decimal('1.11')).quantize(Decimal('0.01')),
            tva_rate=tva,
            min_stock_level=random.randint(5, 50),
            max_stock_level=random.randint(200, 1000),
            reorder_point=Decimal(random.randint(10, 30)),
            reorder_quantity=Decimal(random.randint(50, 200)),
            is_active=True
        )
        products.append(prod)

    # --- Combo Products (10) ---
    combo_products = []
    combo_names = [
        'Starter Tech Bundle', 'Home Office Kit', 'Kitchen Essentials Pack',
        'Fitness Bundle', 'Back to School Set', 'Gift Box Premium',
        'Weekend Getaway Kit', 'Family Movie Pack', 'Party Essentials',
        'Ultimate Cleaning Set',
    ]
    for i, cname in enumerate(combo_names, start=101):
        cat = random.choice(leaf_cats)
        components = random.sample(products, random.randint(2, 5))
        total_cost = sum(p.cost_price for p in components)
        bundle_price = (total_cost * Decimal('0.85')).quantize(Decimal('0.01'))  # 15% discount

        combo = Product.objects.create(
            sku=f"CMB-{i:04d}", organization=org,
            name=cname, product_type='COMBO',
            category=cat, brand=random.choice(brands), unit=unit_pc,
            cost_price=total_cost,
            selling_price_ttc=bundle_price,
            selling_price_ht=(bundle_price / Decimal('1.11')).quantize(Decimal('0.01')),
            tva_rate=Decimal('11.00'),
            is_active=True
        )
        combo_products.append(combo)
        for j, comp in enumerate(components):
            ComboComponent.objects.create(
                organization=org,
                combo_product=combo,
                component_product=comp,
                quantity=random.randint(1, 3),
                sort_order=j
            )

    all_products = products + combo_products
    print(f"📦 Products: {len(products)} standard + {len(combo_products)} combos.")

    # --- Contacts (Suppliers & Customers) ---
    suppliers = []
    for i in range(1, 11):
        sup = Contact.objects.create(
            name=f"Supplier {brands[i % len(brands)].name} {i}", organization=org,
            type='SUPPLIER', company_name=f"Corp {i}",
            supplier_category=random.choice(['DOMESTIC', 'INTERNATIONAL', 'RAW_MATERIAL']),
        )
        suppliers.append(sup)

    customers = []
    for i in range(1, 101):
        cust = Contact.objects.create(
            name=f"Customer {i}", organization=org,
            type='CUSTOMER', phone=f"+961 70 {i:06d}",
            customer_tier=random.choice(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']),
        )
        customers.append(cust)
    print(f"👥 Contacts: {len(suppliers)} Suppliers, {len(customers)} Customers.")

    # --- HR: Departments, Shifts, Employees ---
    dept_tree = {
        'Executive': ['Strategy'],
        'Operations': ['Warehouse Ops', 'Logistics'],
        'Sales': ['Retail', 'Wholesale'],
        'Finance': ['Accounting', 'Payroll'],
        'HR': ['Recruitment', 'Training'],
    }
    all_depts = []
    leaf_depts = []
    for parent_name, children in dept_tree.items():
        parent_dept = Department.objects.create(name=parent_name, organization=org, code=parent_name[:3].upper())
        all_depts.append(parent_dept)
        for child_name in children:
            child_dept = Department.objects.create(
                name=child_name, organization=org, parent=parent_dept,
                code=f"{parent_name[:2].upper()}-{child_name[:3].upper()}"
            )
            all_depts.append(child_dept)
            leaf_depts.append(child_dept)

    # Shifts
    shifts = [
        Shift.objects.create(organization=org, name='Morning', code='AM',
                              start_time=time(8, 0), end_time=time(16, 0), break_minutes=60,
                              site=sites[0]),
        Shift.objects.create(organization=org, name='Evening', code='PM',
                              start_time=time(14, 0), end_time=time(22, 0), break_minutes=60,
                              site=sites[0]),
        Shift.objects.create(organization=org, name='Night', code='NT',
                              start_time=time(22, 0), end_time=time(6, 0), break_minutes=45,
                              site=sites[0]),
    ]

    # Employees (25)
    job_titles = ['Manager', 'Supervisor', 'Associate', 'Specialist', 'Analyst',
                  'Coordinator', 'Team Lead', 'Assistant', 'Officer', 'Director']
    first_names = ['Ahmad', 'Fatima', 'Omar', 'Layla', 'Hassan', 'Nour', 'Youssef',
                   'Rima', 'Karim', 'Sara', 'Ali', 'Maya', 'Tarek', 'Dana', 'Walid',
                   'Hana', 'Sami', 'Zeina', 'Fadi', 'Lina', 'Mohamad', 'Rana',
                   'Bilal', 'Mona', 'Chadi']
    last_names = ['Khalil', 'Haddad', 'Nassif', 'Karam', 'Saleh', 'Farah', 'Mourad',
                  'Harb', 'Jaber', 'Saade', 'Awad', 'Mansour', 'Daher', 'Tabet',
                  'Issa', 'Rizk', 'Sarkis', 'Bitar', 'Chehab', 'Khoury', 'Gemayel',
                  'Badr', 'Zein', 'Hajj', 'Obeid']

    employees = []
    for i in range(25):
        emp = Employee.objects.create(
            organization=org,
            employee_id=f"EMP-{i+1:04d}",
            first_name=first_names[i],
            last_name=last_names[i],
            phone=f"+961 71 {random.randint(100000, 999999)}",
            email=f"{first_names[i].lower()}.{last_names[i].lower()}@enterprise.com",
            job_title=random.choice(job_titles),
            employee_type=random.choice(['EMPLOYEE', 'EMPLOYEE', 'EMPLOYEE', 'PARTNER']),
            salary=Decimal(random.randint(1500, 8000)),
            home_site=random.choice(sites),
            date_of_birth=date(random.randint(1975, 2000), random.randint(1, 12), random.randint(1, 28)),
            nationality=random.choice(['Lebanese', 'Syrian', 'Palestinian', 'Egyptian', 'Jordanian']),
        )
        employees.append(emp)
    print(f"👔 HR: {len(all_depts)} departments, {len(shifts)} shifts, {len(employees)} employees.")

    # ── PHASE 2: HISTORICAL LOOP ──────────────────────────────

    start_date = timezone.make_aware(datetime.now() - timedelta(days=540))
    current_time = start_date
    end_date = timezone.now()

    print("⏳ Simulating 1.5 Years of activity...")

    while current_time < end_date:
        reset_queries()
        gc.collect()

        cur_date = current_time.date()

        # ─── 1. DAILY: Attendance for all employees (weekdays) ───
        if cur_date.weekday() < 5:  # Mon-Fri
            att_batch = []
            for emp in employees:
                shift = random.choice(shifts)
                status = random.choices(
                    ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY'],
                    weights=[80, 10, 5, 5], k=1
                )[0]
                check_in = None
                check_out = None
                if status in ('PRESENT', 'LATE', 'HALF_DAY'):
                    # Generate check-in/out based on shift
                    ci_hour = shift.start_time.hour + (1 if status == 'LATE' else 0)
                    check_in = timezone.make_aware(datetime.combine(cur_date, time(ci_hour, random.randint(0, 59))))
                    co_hour = shift.end_time.hour if shift.end_time.hour > shift.start_time.hour else shift.end_time.hour + 24
                    if status == 'HALF_DAY':
                        co_hour = ci_hour + 4
                    actual_co_hour = co_hour if co_hour < 24 else co_hour - 24
                    check_out = timezone.make_aware(datetime.combine(
                        cur_date if co_hour < 24 else cur_date + timedelta(days=1),
                        time(actual_co_hour, random.randint(0, 59))
                    ))

                att_batch.append(Attendance(
                    organization=org, employee=emp, date=cur_date,
                    status=status, shift=shift,
                    check_in=check_in, check_out=check_out,
                ))
            Attendance.objects.bulk_create(att_batch, ignore_conflicts=True)

        # ─── 2. DAILY: Sales Orders ───────────────────────────────
        for store_wh in [w for w in whs if w.type == 'STORE']:
            daily_orders_count = random.randint(5, 12)
            orders_to_create = []
            lines_to_create = []
            movements_to_create = []

            batch_refs = get_ref_batch(org, 'ORD', daily_orders_count)

            for i in range(daily_orders_count):
                cust = random.choice(customers)
                ref = batch_refs[i]
                random_time = time(random.randint(8, 18), random.randint(0, 59))
                order_time = timezone.make_aware(datetime.combine(cur_date, random_time))

                order = Order(
                    organization=org, type='SALE', status='COMPLETED',
                    ref_code=ref, contact=cust, site=store_wh.site,
                    total_amount=0, created_at=order_time
                )
                orders_to_create.append(order)

            created_orders = Order.objects.bulk_create(orders_to_create)

            for order in created_orders:
                total = 0
                for _ in range(random.randint(1, 3)):
                    p = random.choice(products)
                    qty = random.randint(1, 2)

                    inv, _ = Inventory.objects.get_or_create(warehouse=store_wh, product=p, organization=org)
                    inv.quantity = Decimal(str(inv.quantity)) - Decimal(qty)
                    inv.save()

                    line = OrderLine(
                        organization=org, order=order, product=p,
                        quantity=qty, unit_price=p.selling_price_ttc,
                        total=qty * p.selling_price_ttc
                    )
                    lines_to_create.append(line)
                    total += line.total

                    movements_to_create.append(InventoryMovement(
                        organization=org, product=p, warehouse=store_wh,
                        type='OUT', quantity=qty, reference=order.ref_code,
                        cost_price=p.cost_price, created_at=order.created_at
                    ))
                order.total_amount = total
                Order.objects.filter(id=order.id).update(created_at=order.created_at)

            OrderLine.objects.bulk_create(lines_to_create)
            InventoryMovement.objects.bulk_create(movements_to_create)
            Order.objects.bulk_update(created_orders, ['total_amount'])

        # ─── 3. WEEKLY: Purchase Restocks (Mondays) ───────────────
        if cur_date.weekday() == 0:
            for wh in [w for w in whs if w.type == 'GENERAL']:
                batch_refs = get_ref_batch(org, 'PO', 5)
                for ref in batch_refs:
                    sup = random.choice(suppliers)
                    order = Order.objects.create(
                        organization=org, type='PURCHASE', status='DRAFT',
                        ref_code=ref, contact=sup, site=wh.site,
                        total_amount=0, created_at=current_time
                    )
                    order.created_at = current_time
                    order.save(force_audit_bypass=True)

                    total = 0
                    lines = []
                    movements = []
                    for _ in range(random.randint(5, 15)):
                        p = random.choice(products)
                        qty = random.randint(50, 200)
                        line = OrderLine(
                            organization=org, order=order, product=p,
                            quantity=qty, unit_price=p.cost_price,
                            total=qty * p.cost_price
                        )
                        total += line.total
                        lines.append(line)

                        inv, _ = Inventory.objects.get_or_create(warehouse=wh, product=p, organization=org)
                        inv.quantity = Decimal(str(inv.quantity)) + Decimal(qty)
                        inv.save()

                        movements.append(InventoryMovement(
                            organization=org, product=p, warehouse=wh,
                            type='IN', quantity=qty, reference=ref,
                            cost_price=p.cost_price, created_at=current_time
                        ))
                    OrderLine.objects.bulk_create(lines)
                    InventoryMovement.objects.bulk_create(movements)
                    order.total_amount = total
                    order.status = 'COMPLETED'
                    order.save(force_audit_bypass=True)
                    Order.objects.filter(id=order.id).update(created_at=order.created_at)

        # ─── 4. WEEKLY: Stock Transfers (Fridays) ─────────────────
        if cur_date.weekday() == 4:
            gen_whs = [w for w in whs if w.type == 'GENERAL']
            store_whs = [w for w in whs if w.type == 'STORE']
            for src in gen_whs:
                for dest in store_whs:
                    trf_ref = get_ref_batch(org, 'TRF', 1)[0]
                    trf_order = StockTransferOrder.objects.create(
                        organization=org, reference=trf_ref, date=cur_date,
                        from_warehouse=src, to_warehouse=dest,
                        reason='Weekly replenishment', is_posted=True,
                        lifecycle_status='CONFIRMED'
                    )
                    total_qty = 0
                    for _ in range(random.randint(5, 10)):
                        p = random.choice(products)
                        qty = random.randint(10, 30)

                        inv_src, _ = Inventory.objects.get_or_create(warehouse=src, product=p, organization=org)
                        if Decimal(str(inv_src.quantity)) >= Decimal(qty):
                            inv_src.quantity = Decimal(str(inv_src.quantity)) - Decimal(qty)
                            inv_src.save()
                            inv_dest, _ = Inventory.objects.get_or_create(warehouse=dest, product=p, organization=org)
                            inv_dest.quantity = Decimal(str(inv_dest.quantity)) + Decimal(qty)
                            inv_dest.save()

                            StockTransferLine.objects.create(
                                order=trf_order, product=p,
                                qty_transferred=qty,
                                from_warehouse=src, to_warehouse=dest,
                            )
                            total_qty += qty

                            InventoryMovement.objects.create(
                                organization=org, product=p, warehouse=src,
                                type='TRANSFER', quantity=-qty, reference=trf_ref, created_at=current_time
                            )
                            InventoryMovement.objects.create(
                                organization=org, product=p, warehouse=dest,
                                type='TRANSFER', quantity=qty, reference=trf_ref, created_at=current_time
                            )
                    StockTransferOrder.objects.filter(id=trf_order.id).update(
                        total_qty_transferred=total_qty, created_at=current_time
                    )

        # ─── 5. BI-WEEKLY: Stock Adjustments (15th and 30th) ─────
        if cur_date.day in (15, 28):
            adj_wh = random.choice(whs)
            adj_ref = get_ref_batch(org, 'ADJ', 1)[0]
            adj_order = StockAdjustmentOrder.objects.create(
                organization=org, reference=adj_ref, date=cur_date,
                warehouse=adj_wh, reason='Cycle count adjustment',
                is_posted=True, lifecycle_status='CONFIRMED'
            )
            total_adj = 0
            for _ in range(random.randint(3, 8)):
                p = random.choice(products)
                qty_adj = random.randint(-5, 10)  # Can be loss or gain
                StockAdjustmentLine.objects.create(
                    order=adj_order, product=p,
                    qty_adjustment=qty_adj, warehouse=adj_wh,
                    reason=random.choice(['Cycle count variance', 'Damage write-off', 'Found stock']),
                )
                inv, _ = Inventory.objects.get_or_create(warehouse=adj_wh, product=p, organization=org)
                inv.quantity = Decimal(str(inv.quantity)) + Decimal(qty_adj)
                inv.save()
                total_adj += qty_adj
            StockAdjustmentOrder.objects.filter(id=adj_order.id).update(
                total_qty_adjustment=total_adj, created_at=current_time
            )

        # ─── 6. WEEKLY: Operational Requests (Wednesdays) ─────────
        if cur_date.weekday() == 2:
            for _ in range(random.randint(1, 3)):
                req_ref = get_ref_batch(org, 'REQ', 1)[0]
                req_type = random.choice(['PURCHASE_ORDER', 'STOCK_ADJUSTMENT', 'STOCK_TRANSFER'])
                status = random.choices(
                    ['PENDING', 'APPROVED', 'CONVERTED', 'REJECTED'],
                    weights=[30, 30, 30, 10], k=1
                )[0]
                OperationalRequest.objects.create(
                    organization=org, reference=req_ref,
                    request_type=req_type, date=cur_date,
                    priority=random.choice(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
                    status=status,
                    description=f"Auto-generated {req_type.replace('_', ' ').lower()} request",
                )

        # ─── 7. MONTHLY: Payroll Journal + Leave Requests ─────────
        if cur_date.day == 1:
            # Payroll
            je = JournalEntry.objects.create(
                organization=org, transaction_date=current_time,
                description=f"Monthly Payroll - {current_time.strftime('%B %Y')}",
                status='POSTED',
                reference=f"PAY-{current_time.strftime('%Y%m')}",
                site=random.choice(sites)
            )

            total_salary = sum(e.salary for e in employees)
            salary_exp = ChartOfAccount.objects.filter(organization=org, code__startswith='6').first()
            cash_acc = ChartOfAccount.objects.filter(organization=org, sub_type='CASH').first()

            if salary_exp and cash_acc:
                JournalEntryLine.objects.create(
                    journal_entry=je, organization=org, account=salary_exp,
                    debit=total_salary, credit=0, description="Monthly Salaries"
                )
                JournalEntryLine.objects.create(
                    journal_entry=je, organization=org, account=cash_acc,
                    debit=0, credit=total_salary, description="Payroll Disbursement"
                )

            # Leave Requests (2-4 per month)
            for _ in range(random.randint(2, 4)):
                emp = random.choice(employees)
                leave_start = cur_date + timedelta(days=random.randint(1, 25))
                leave_days = random.randint(1, 5)
                leave_type = random.choices(
                    ['ANNUAL', 'SICK', 'UNPAID', 'COMPENSATORY', 'OTHER'],
                    weights=[40, 30, 10, 10, 10], k=1
                )[0]
                Leave.objects.create(
                    organization=org, employee=emp,
                    leave_type=leave_type,
                    start_date=leave_start,
                    end_date=leave_start + timedelta(days=leave_days),
                    reason=f"{leave_type.title()} leave for personal matters",
                    status=random.choice(['PENDING', 'APPROVED', 'APPROVED', 'APPROVED']),
                )

        # ─── Advance Day ─────────────────────────────────────────
        current_time += timedelta(days=1)
        if current_time.day == 1:
            print(f"📅 Progress: {current_time.strftime('%B %Y')} complete.")

    print("✅ Simulation complete across all modules!")

if __name__ == '__main__':
    simulate()
