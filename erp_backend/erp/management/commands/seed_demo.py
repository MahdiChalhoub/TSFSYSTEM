"""
Management command to seed demo data for a Demo organization.
Creates 10+ entries in all major tables so no pages are empty.
Usage: python manage.py seed_demo
"""
import random
from decimal import Decimal
from datetime import timedelta, date
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Seed demo data: Demo organization with 10+ rows in every major table'

    def handle(self, *args, **options):
        from erp.models import Organization, User
        from apps.inventory.models import (
            Unit, Category, Brand, Product, Warehouse, Inventory as InventoryModel
        )
        from apps.crm.models import Contact
        from apps.hr.models import Employee
        from apps.pos.models import Order as POSOrder, OrderLine
        from apps.finance.invoice_models import Invoice, InvoiceLine
        from apps.finance.models import FinancialAccount

        self.stdout.write('🌱 Seeding demo data...')

        # ── 1. Demo Organization ──
        org, _ = Organization.objects.get_or_create(
            slug='demo',
            defaults={
                'name': 'Demo Organization',
                'business_email': 'demo@tsf.ci',
                'phone': '+1-555-000-0000',
                'address': '123 Demo Street',
                'city': 'San Francisco',
                'country': 'US',
                'zip_code': '94102',
                'timezone': 'America/Los_Angeles',
                'website': 'https://demo.tsf.ci',
            }
        )
        self.stdout.write(f'  ✅ Organization: {org.name}')

        # Also activate all modules for demo org
        try:
            from erp.models import SystemModule, OrganizationModule
            for sm in SystemModule.objects.all():
                OrganizationModule.objects.get_or_create(
                    organization=org, module_name=sm.name,
                    defaults={'is_enabled': True}
                )
            self.stdout.write(f'  ✅ All modules activated for demo org')
        except Exception as e:
            self.stdout.write(f'  ⚠️  Modules: {e}')

        # ── 2. Users ──
        users = []
        user_data = [
            ('demo_admin', 'Demo', 'Admin', 'admin@demo.tsf.ci', True, True),
            ('demo_manager', 'Sarah', 'Manager', 'sarah@demo.tsf.ci', True, False),
            ('demo_cashier1', 'Alice', 'Johnson', 'alice@demo.tsf.ci', False, False),
            ('demo_cashier2', 'Bob', 'Smith', 'bob@demo.tsf.ci', False, False),
            ('demo_cashier3', 'Carol', 'White', 'carol@demo.tsf.ci', False, False),
            ('demo_sales1', 'David', 'Brown', 'david@demo.tsf.ci', False, False),
            ('demo_sales2', 'Eve', 'Davis', 'eve@demo.tsf.ci', False, False),
            ('demo_warehouse', 'Frank', 'Wilson', 'frank@demo.tsf.ci', False, False),
            ('demo_accountant', 'Grace', 'Lee', 'grace@demo.tsf.ci', False, False),
            ('demo_hr', 'Hank', 'Miller', 'hank@demo.tsf.ci', False, False),
        ]
        for uname, first, last, email, is_staff, is_super in user_data:
            u, created = User.objects.get_or_create(
                username=uname, organization=org,
                defaults={
                    'email': email, 'first_name': first, 'last_name': last,
                    'is_staff': is_staff, 'is_superuser': is_super,
                }
            )
            if created:
                u.set_password('demo123')
                u.save()
            users.append(u)
        self.stdout.write(f'  ✅ Users: {len(users)}')

        # ── 3. Units ──
        units = []
        unit_data = [
            ('PCS', 'Piece', 'Pcs', False), ('BOX', 'Box', 'Box', False),
            ('KG', 'Kilogram', 'Kg', True), ('LTR', 'Liter', 'Ltr', True),
            ('MTR', 'Meter', 'Mtr', True), ('PCK', 'Pack', 'Pck', False),
            ('DZN', 'Dozen', 'Dzn', False), ('CTN', 'Carton', 'Ctn', False),
            ('RLL', 'Roll', 'Rll', False), ('PR', 'Pair', 'Pr', False),
        ]
        for code, name, short, frac in unit_data:
            u, _ = Unit.objects.get_or_create(
                code=code, organization=org,
                defaults={'name': name, 'short_name': short, 'allow_fraction': frac}
            )
            units.append(u)
        self.stdout.write(f'  ✅ Units: {len(units)}')

        # ── 4. Categories ──
        categories = []
        cat_names = [
            'Electronics', 'Beverages', 'Snacks', 'Dairy', 'Bakery',
            'Household', 'Personal Care', 'Frozen Food', 'Stationery',
            'Clothing', 'Toys', 'Fresh Produce'
        ]
        for i, name in enumerate(cat_names):
            c, _ = Category.objects.get_or_create(
                name=name, organization=org,
                defaults={'code': name[:3].upper()}
            )
            categories.append(c)
        self.stdout.write(f'  ✅ Categories: {len(categories)}')

        # ── 5. Brands ──
        brands = []
        brand_names = [
            'Apple', 'Samsung', 'Coca-Cola', 'Nestlé', 'Unilever',
            'P&G', 'Nike', 'Sony', 'LG', 'Pepsi', 'Danone', 'Mars'
        ]
        for name in brand_names:
            b, _ = Brand.objects.get_or_create(
                name=name, organization=org,
                defaults={'short_name': name[:4].upper()}
            )
            brands.append(b)
        self.stdout.write(f'  ✅ Brands: {len(brands)}')

        # ── 6. Products ──
        products = []
        pcs = units[0]  # PCS
        product_data = [
            ('iPhone 15 Pro', 'ELE-001', '999.99', '850.00', 0, 0),
            ('Samsung Galaxy S24', 'ELE-002', '899.99', '750.00', 0, 1),
            ('Sony WH-1000XM5', 'ELE-003', '349.99', '280.00', 0, 7),
            ('Coca-Cola 330ml', 'BEV-001', '1.50', '0.80', 1, 2),
            ('Pepsi 330ml', 'BEV-002', '1.50', '0.80', 1, 9),
            ('Evian Water 500ml', 'BEV-003', '2.00', '1.00', 1, 2),
            ("Lay's Classic Chips", 'SNK-001', '3.49', '2.00', 2, 11),
            ('Oreo Cookies', 'SNK-002', '4.29', '2.50', 2, 11),
            ('Whole Milk 1L', 'DAI-001', '3.99', '2.50', 3, 3),
            ('Greek Yogurt 500g', 'DAI-002', '5.49', '3.50', 3, 10),
            ('Sourdough Bread', 'BAK-001', '4.99', '2.80', 4, 3),
            ('Croissant', 'BAK-002', '2.49', '1.20', 4, 3),
            ('Dish Soap 1L', 'HOU-001', '3.99', '2.00', 5, 4),
            ('Paper Towels 6pk', 'HOU-002', '8.99', '5.50', 5, 4),
            ('Shampoo 400ml', 'PER-001', '7.99', '4.50', 6, 4),
            ('Toothpaste 100ml', 'PER-002', '3.49', '1.80', 6, 4),
            ('Frozen Pizza', 'FRO-001', '6.99', '4.00', 7, 3),
            ('Ice Cream 1L', 'FRO-002', '5.99', '3.50', 7, 10),
            ('A4 Paper Ream', 'STA-001', '9.99', '6.00', 8, 11),
            ('Ballpoint Pens 10pk', 'STA-002', '4.99', '2.50', 8, 11),
        ]
        for name, sku, sell_price, cost_price, cat_idx, brand_idx in product_data:
            p, _ = Product.objects.get_or_create(
                sku=sku, organization=org,
                defaults={
                    'name': name,
                    'selling_price_ttc': Decimal(sell_price),
                    'selling_price_ht': Decimal(sell_price) / Decimal('1.18'),
                    'cost_price': Decimal(cost_price),
                    'cost_price_ht': Decimal(cost_price) / Decimal('1.18'),
                    'cost_price_ttc': Decimal(cost_price),
                    'tva_rate': Decimal('18.00'),
                    'category': categories[cat_idx],
                    'brand': brands[brand_idx],
                    'unit': pcs,
                    'min_stock_level': random.randint(5, 20),
                    'max_stock_level': random.randint(50, 200),
                }
            )
            products.append(p)
        self.stdout.write(f'  ✅ Products: {len(products)}')

        # ── 7. Contacts (Customers & Suppliers) ──
        contacts = []
        contact_data = [
            ('CUSTOMER', 'John Doe', 'john@example.com', '+1-555-0101'),
            ('CUSTOMER', 'Jane Smith', 'jane@example.com', '+1-555-0102'),
            ('CUSTOMER', 'Acme Corp', 'orders@acme.com', '+1-555-0201'),
            ('CUSTOMER', 'TechStart Inc', 'buy@techstart.io', '+1-555-0202'),
            ('CUSTOMER', 'Fresh Foods LLC', 'info@freshfoods.com', '+1-555-0203'),
            ('CUSTOMER', 'Metro Retail', 'purchasing@metroretail.com', '+1-555-0204'),
            ('CUSTOMER', 'Corner Store', 'owner@cornerstore.com', '+1-555-0205'),
            ('SUPPLIER', 'Global Supplies', 'sales@globalsupplies.com', '+1-555-0301'),
            ('SUPPLIER', 'Pacific Trading', 'orders@pacifictrading.com', '+1-555-0302'),
            ('SUPPLIER', 'Euro Wholesale', 'contact@eurowholesale.eu', '+44-20-0001'),
            ('SUPPLIER', 'Asia Direct', 'hello@asiadirect.hk', '+852-0001'),
            ('SUPPLIER', 'National Dist.', 'orders@nationaldist.com', '+1-555-0305'),
        ]
        for ctype, name, email, phone in contact_data:
            c, _ = Contact.objects.get_or_create(
                email=email, organization=org,
                defaults={
                    'name': name,
                    'phone': phone,
                    'type': ctype,
                    'address': f'{random.randint(1,999)} {random.choice(["Main","Oak","Elm","Pine","Cedar"])} St, {random.choice(["New York","LA","Chicago","Houston","Phoenix"])}',
                }
            )
            contacts.append(c)
        customers = [c for c in contacts if c.type == 'CUSTOMER']
        suppliers = [c for c in contacts if c.type == 'SUPPLIER']
        self.stdout.write(f'  ✅ Contacts: {len(contacts)} ({len(customers)} customers, {len(suppliers)} suppliers)')

        # ── 8. Employees ──
        employees = []
        emp_data = [
            ('EMP-001', 'Alice', 'Johnson', 'Manager', 75000),
            ('EMP-002', 'Bob', 'Smith', 'Cashier', 35000),
            ('EMP-003', 'Carol', 'White', 'Cashier', 35000),
            ('EMP-004', 'David', 'Brown', 'Sales Rep', 45000),
            ('EMP-005', 'Eve', 'Davis', 'Sales Rep', 45000),
            ('EMP-006', 'Frank', 'Wilson', 'Warehouse Mgr', 50000),
            ('EMP-007', 'Grace', 'Lee', 'Accountant', 55000),
            ('EMP-008', 'Hank', 'Miller', 'HR Manager', 52000),
            ('EMP-009', 'Ivy', 'Taylor', 'Driver', 38000),
            ('EMP-010', 'Jack', 'Anderson', 'IT Support', 48000),
            ('EMP-011', 'Karen', 'Thomas', 'Marketing Mgr', 46000),
            ('EMP-012', 'Leo', 'Martinez', 'Quality Control', 42000),
        ]
        for emp_id, first, last, position, salary in emp_data:
            e, _ = Employee.objects.get_or_create(
                employee_id=emp_id, organization=org,
                defaults={
                    'first_name': first, 'last_name': last,
                    'email': f'{first.lower()}.{last.lower()}@demo.tsf.ci',
                    'phone': f'+1-555-{random.randint(1000,9999)}',
                    'job_title': position,
                    'salary': Decimal(str(salary)),
                }
            )
            employees.append(e)
        self.stdout.write(f'  ✅ Employees: {len(employees)}')

        # ── 9. Warehouses ──
        warehouses = []
        wh_data = [
            ('Main Warehouse', 'WH-MAIN', '100 Industrial Blvd'),
            ('Cold Storage', 'WH-COLD', '200 Refrigeration Ave'),
            ('Overflow Storage', 'WH-OVER', '300 Expansion Rd'),
        ]
        for name, code, addr in wh_data:
            try:
                w, _ = Warehouse.objects.get_or_create(
                    code=code, organization=org,
                    defaults={'name': name, 'address': addr, 'is_active': True}
                )
                warehouses.append(w)
            except Exception as e:
                self.stdout.write(f'  ⚠️  Warehouse {name}: {e}')
        self.stdout.write(f'  ✅ Warehouses: {len(warehouses)}')

        # ── 10. Inventory Records ──
        inv_records = []
        if warehouses:
            for prod in products:
                try:
                    ir, _ = InventoryModel.objects.get_or_create(
                        product=prod, warehouse=warehouses[0], organization=org,
                        defaults={'quantity': Decimal(str(random.randint(10, 200)))}
                    )
                    inv_records.append(ir)
                except Exception as e:
                    self.stdout.write(f'  ⚠️  Inventory {prod.sku}: {e}')
        self.stdout.write(f'  ✅ Inventory records: {len(inv_records)}')

        # ── 11. Financial Accounts ──
        fin_accounts = []
        fin_data = [
            ('Main Cash Register', 'cash', Decimal('5000.00')),
            ('Business Checking', 'bank', Decimal('25000.00')),
            ('Savings Account', 'bank', Decimal('50000.00')),
            ('Petty Cash', 'cash', Decimal('500.00')),
            ('Mobile Money', 'mobile_money', Decimal('3000.00')),
            ('Credit Card Terminal', 'bank', Decimal('0.00')),
        ]
        for name, acct_type, balance in fin_data:
            try:
                fa, _ = FinancialAccount.objects.get_or_create(
                    name=name, organization=org,
                    defaults={'type': acct_type, 'balance': balance, 'is_active': True}
                )
                fin_accounts.append(fa)
            except Exception as e:
                self.stdout.write(f'  ⚠️  FinAccount {name}: {e}')
        self.stdout.write(f'  ✅ Financial Accounts: {len(fin_accounts)}')

        # ── 12. POS Orders ──
        orders = []
        now = timezone.now()
        for i in range(15):
            order_date = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
            customer = random.choice(customers) if random.random() > 0.3 else None
            try:
                o, created = POSOrder.objects.get_or_create(
                    ref_code=f'ORD-2025-{str(i+1).zfill(4)}',
                    organization=org,
                    defaults={
                        'type': 'SALE',
                        'contact': customer,
                        'status': random.choice(['COMPLETED', 'COMPLETED', 'COMPLETED', 'PENDING', 'DRAFT']),
                        'user': random.choice(users[:5]),
                        'payment_method': random.choice(['CASH', 'CARD', 'MOBILE_MONEY']),
                    }
                )
                if created:
                    total = Decimal('0.00')
                    for j in range(random.randint(1, 5)):
                        prod = random.choice(products)
                        qty = random.randint(1, 5)
                        line_total = prod.selling_price_ttc * qty
                        total += line_total
                        OrderLine.objects.create(
                            order=o, product=prod, quantity=qty,
                            unit_price=prod.selling_price_ttc, total=line_total,
                            organization=org,
                        )
                    o.total_amount = total
                    o.save(force_audit_bypass=True)
                orders.append(o)
            except Exception as e:
                self.stdout.write(f'  ⚠️  Order {i+1}: {e}')
        self.stdout.write(f'  ✅ POS Orders: {len(orders)}')

        # ── 13. Invoices ──
        invoices = []
        for i in range(12):
            inv_date = (now - timedelta(days=random.randint(0, 60))).date()
            due_date = inv_date + timedelta(days=30)
            customer = random.choice(customers)
            status = random.choice(['DRAFT', 'SENT', 'PAID', 'PAID', 'OVERDUE'])
            try:
                inv, created = Invoice.objects.get_or_create(
                    invoice_number=f'INV-2025-{str(i+1).zfill(4)}',
                    organization=org,
                    defaults={
                        'type': 'SALES',
                        'contact': customer,
                        'contact_name': customer.name,
                        'status': status,
                        'issue_date': inv_date,
                        'due_date': due_date,
                    }
                )
                if created:
                    total_ht = Decimal('0.00')
                    total_tax = Decimal('0.00')
                    total_ttc = Decimal('0.00')
                    for j in range(random.randint(1, 4)):
                        prod = random.choice(products)
                        qty = random.randint(1, 10)
                        line = InvoiceLine(
                            invoice=inv, product=prod,
                            description=prod.name,
                            quantity=qty,
                            unit_price=prod.selling_price_ttc,
                            tax_rate=Decimal('18.00'),
                            organization=org,
                        )
                        line.save()
                        total_ht += line.line_total_ht
                        total_tax += line.tax_amount
                        total_ttc += line.line_total_ttc
                    inv.subtotal_ht = total_ht
                    inv.tax_amount = total_tax
                    inv.total_amount = total_ttc
                    if status == 'PAID':
                        inv.paid_amount = total_ttc
                        inv.balance_due = Decimal('0.00')
                    else:
                        inv.balance_due = total_ttc
                    inv.save()
                invoices.append(inv)
            except Exception as e:
                self.stdout.write(f'  ⚠️  Invoice {i+1}: {e}')
        self.stdout.write(f'  ✅ Invoices: {len(invoices)}')

        # ── 14. CRM Leads ──
        try:
            from apps.crm.models import Lead, Pipeline, PipelineStage
            pipeline, _ = Pipeline.objects.get_or_create(
                name='Sales Pipeline', organization=org,
                defaults={'is_default': True}
            )
            stages_data = [
                ('New Lead', 0, False, False), ('Contacted', 1, False, False),
                ('Qualified', 2, False, False), ('Proposal', 3, False, False),
                ('Negotiation', 4, False, False), ('Won', 5, True, False),
                ('Lost', 6, False, True),
            ]
            stage_objs = []
            for name, order, is_won, is_lost in stages_data:
                s, _ = PipelineStage.objects.get_or_create(
                    name=name, pipeline=pipeline,
                    defaults={'order': order, 'is_won': is_won, 'is_lost': is_lost}
                )
                stage_objs.append(s)

            lead_data = [
                ('Website Redesign', 15000), ('ERP Implementation', 50000),
                ('Cloud Migration', 25000), ('Security Audit', 12000),
                ('Mobile App Dev', 35000), ('Data Analytics', 20000),
                ('IT Consulting', 8000), ('Network Setup', 10000),
                ('SaaS Subscription', 5000), ('Training Program', 7000),
                ('Hardware Upgrade', 30000), ('API Integration', 18000),
            ]
            for title, value in lead_data:
                Lead.objects.get_or_create(
                    title=title, organization=org,
                    defaults={
                        'contact': random.choice(customers),
                        'stage': random.choice(stage_objs[:5]),
                        'value': Decimal(str(value)),
                        'assigned_to': random.choice(users[:5]),
                    }
                )
            self.stdout.write(f'  ✅ CRM: 1 pipeline, {len(stages_data)} stages, {len(lead_data)} leads')
        except Exception as e:
            self.stdout.write(f'  ⚠️  CRM: {e}')

        # ── 15. HR Attendance ──
        try:
            from apps.hr.models import Attendance
            from datetime import datetime
            today = date.today()
            count = 0
            for emp in employees[:10]:
                for day_offset in range(10):
                    d = today - timedelta(days=day_offset)
                    if d.weekday() < 5:
                        _, created = Attendance.objects.get_or_create(
                            employee=emp, date=d, organization=org,
                            defaults={
                                'check_in': timezone.make_aware(datetime(d.year, d.month, d.day, 8, random.randint(0, 30))),
                                'check_out': timezone.make_aware(datetime(d.year, d.month, d.day, 17, random.randint(0, 30))),
                                'status': 'present',
                            }
                        )
                        if created:
                            count += 1
            self.stdout.write(f'  ✅ Attendance: {count} records')
        except Exception as e:
            self.stdout.write(f'  ⚠️  Attendance: {e}')

        # ── 16. Tax Groups ──
        try:
            from erp.models import TaxGroup
            tax_data = [
                ('Standard VAT 18%', Decimal('18.00')), ('Reduced VAT 9%', Decimal('9.00')),
                ('Zero Rate', Decimal('0.00')), ('Luxury Tax 25%', Decimal('25.00')),
            ]
            for name, rate in tax_data:
                TaxGroup.objects.get_or_create(
                    name=name, organization=org,
                    defaults={'rate': rate, 'is_active': True}
                )
            self.stdout.write(f'  ✅ Tax Groups: {len(tax_data)}')
        except Exception as e:
            self.stdout.write(f'  ⚠️  Tax Groups: {e}')

        # ── 17. Fiscal Year ──
        try:
            from erp.models import FiscalYear, FiscalPeriod
            fy, _ = FiscalYear.objects.get_or_create(
                year=2025, organization=org,
                defaults={'start_date': date(2025, 1, 1), 'end_date': date(2025, 12, 31), 'is_closed': False}
            )
            months = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December']
            for i, name in enumerate(months):
                m = i + 1
                start = date(2025, m, 1)
                end = date(2025, m, 28) if m == 2 else date(2025, m, 30) if m in (4,6,9,11) else date(2025, m, 31)
                FiscalPeriod.objects.get_or_create(
                    fiscal_year=fy, month=m, organization=org,
                    defaults={'name': name, 'start_date': start, 'end_date': end, 'is_closed': False}
                )
            self.stdout.write(f'  ✅ Fiscal Year 2025 + 12 periods')
        except Exception as e:
            self.stdout.write(f'  ⚠️  Fiscal Year: {e}')

        self.stdout.write(self.style.SUCCESS('\n🎉 Demo data seeding complete!'))
