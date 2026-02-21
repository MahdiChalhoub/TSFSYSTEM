"""Fix script to seed remaining data that failed in first run."""
import random
from decimal import Decimal
from datetime import timedelta, date, datetime
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Seed remaining demo data items that failed in the first run'

    def handle(self, *args, **options):
        from erp.models import Organization, User, Site
        from apps.inventory.models import Warehouse, Inventory as InventoryModel, Product
        from apps.finance.models import FinancialAccount, FiscalYear, FiscalPeriod
        from apps.hr.models import Employee, Attendance
        from apps.crm.models import Contact

        org = Organization.objects.get(slug='demo')
        self.stdout.write(f'🔧 Fixing seed data for: {org.name}')

        # ── 1. Sites ──
        sites = []
        site_data = [
            ('HQ', 'SITE-HQ', '100 Main St', 'San Francisco'),
            ('Branch 1', 'SITE-BR1', '200 Oak Ave', 'Los Angeles'),
            ('Branch 2', 'SITE-BR2', '300 Elm Blvd', 'Chicago'),
        ]
        for name, code, address, city in site_data:
            s, _ = Site.objects.get_or_create(
                code=code, organization=org,
                defaults={'name': name, 'address': address, 'city': city, 'is_active': True}
            )
            sites.append(s)
        self.stdout.write(f'  ✅ Sites: {len(sites)}')

        # ── 2. Warehouses (need Site FK) ──
        warehouses = []
        wh_data = [
            ('Main Warehouse', 'WH-MAIN', sites[0]),
            ('Cold Storage', 'WH-COLD', sites[0]),
            ('Branch 1 Storage', 'WH-BR1', sites[1]),
            ('Branch 2 Storage', 'WH-BR2', sites[2]),
        ]
        for name, code, site in wh_data:
            w, _ = Warehouse.objects.get_or_create(
                code=code, site=site, organization=org,
                defaults={'name': name, 'is_active': True}
            )
            warehouses.append(w)
        self.stdout.write(f'  ✅ Warehouses: {len(warehouses)}')

        # ── 3. Inventory records ──
        inv_count = 0
        products = list(Product.objects.filter(organization=org))
        if warehouses and products:
            for prod in products:
                try:
                    _, created = InventoryModel.objects.get_or_create(
                        product=prod, warehouse=warehouses[0], organization=org,
                        defaults={'quantity': Decimal(str(random.randint(10, 200)))}
                    )
                    if created:
                        inv_count += 1
                except Exception as e:
                    pass
        self.stdout.write(f'  ✅ Inventory records: {inv_count}')

        # ── 4. Financial Accounts (no is_active field) ──
        fin_count = 0
        fin_data = [
            ('Main Cash Register', 'CASH', Decimal('5000.00')),
            ('Business Checking', 'BANK', Decimal('25000.00')),
            ('Savings Account', 'SAVINGS', Decimal('50000.00')),
            ('Petty Cash', 'PETTY_CASH', Decimal('500.00')),
            ('Mobile Money', 'MOBILE', Decimal('3000.00')),
            ('Credit Card Account', 'BANK', Decimal('0.00')),
        ]
        for name, acct_type, balance in fin_data:
            try:
                _, created = FinancialAccount.objects.get_or_create(
                    name=name, organization=org,
                    defaults={'type': acct_type, 'balance': balance}
                )
                if created:
                    fin_count += 1
            except Exception as e:
                self.stdout.write(f'  ⚠️  FinAccount {name}: {e}')
        self.stdout.write(f'  ✅ Financial Accounts: {fin_count}')

        # ── 5. Fiscal Year (uses 'name' not 'year') ──
        try:
            fy, _ = FiscalYear.objects.get_or_create(
                name='FY 2025', organization=org,
                defaults={
                    'start_date': date(2025, 1, 1),
                    'end_date': date(2025, 12, 31),
                    'is_closed': False,
                }
            )
            months = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December']
            for i, name in enumerate(months):
                m = i + 1
                start = date(2025, m, 1)
                if m == 12:
                    end = date(2025, 12, 31)
                elif m == 2:
                    end = date(2025, 2, 28)
                elif m in (4, 6, 9, 11):
                    end = date(2025, m, 30)
                else:
                    end = date(2025, m, 31)
                FiscalPeriod.objects.get_or_create(
                    fiscal_year=fy, name=name, organization=org,
                    defaults={'start_date': start, 'end_date': end, 'is_closed': False}
                )
            self.stdout.write(f'  ✅ Fiscal Year 2025 + 12 periods')
        except Exception as e:
            self.stdout.write(f'  ⚠️  Fiscal Year: {e}')

        # ── 6. Attendance (unique_together = employee+date, no org in UNIQUE) ──
        try:
            employees = list(Employee.objects.filter(organization=org)[:10])
            today = date.today()
            att_count = 0
            for emp in employees:
                for day_offset in range(10):
                    d = today - timedelta(days=day_offset)
                    if d.weekday() < 5:
                        try:
                            _, created = Attendance.objects.get_or_create(
                                employee=emp, date=d,
                                defaults={
                                    'organization': org,
                                    'check_in': timezone.make_aware(datetime(d.year, d.month, d.day, 8, random.randint(0, 30))),
                                    'check_out': timezone.make_aware(datetime(d.year, d.month, d.day, 17, random.randint(0, 30))),
                                    'status': random.choice(['PRESENT', 'PRESENT', 'PRESENT', 'LATE']),
                                }
                            )
                            if created:
                                att_count += 1
                        except Exception:
                            pass
            self.stdout.write(f'  ✅ Attendance: {att_count} records')
        except Exception as e:
            self.stdout.write(f'  ⚠️  Attendance: {e}')

        # ── 7. CRM Leads (Contact with type='LEAD') ──
        try:
            lead_data = [
                ('Website Redesign Lead', 'lead1@example.com'),
                ('ERP Implementation Lead', 'lead2@example.com'),
                ('Cloud Migration Lead', 'lead3@example.com'),
                ('Security Audit Lead', 'lead4@example.com'),
                ('Mobile App Lead', 'lead5@example.com'),
                ('Data Analytics Lead', 'lead6@example.com'),
                ('IT Consulting Lead', 'lead7@example.com'),
                ('Network Setup Lead', 'lead8@example.com'),
                ('SaaS Subscription Lead', 'lead9@example.com'),
                ('Training Program Lead', 'lead10@example.com'),
            ]
            lead_count = 0
            for name, email in lead_data:
                _, created = Contact.objects.get_or_create(
                    email=email, organization=org,
                    defaults={
                        'name': name, 'type': 'LEAD',
                        'phone': f'+1-555-{random.randint(1000,9999)}',
                        'address': f'{random.randint(1,999)} Lead St, Demo City',
                    }
                )
                if created:
                    lead_count += 1
            self.stdout.write(f'  ✅ CRM Leads: {lead_count}')
        except Exception as e:
            self.stdout.write(f'  ⚠️  CRM Leads: {e}')

        self.stdout.write(self.style.SUCCESS('\n🎉 Fix seeding complete!'))
