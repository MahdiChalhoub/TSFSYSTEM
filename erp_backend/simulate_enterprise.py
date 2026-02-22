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
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

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

# CRM Models
Contact = get_model('crm', 'Contact')

# Finance Models
FinancialAccount = get_model('finance', 'FinancialAccount')
ChartOfAccount = get_model('finance', 'ChartOfAccount')
FiscalYear = get_model('finance', 'FiscalYear')
FiscalPeriod = get_model('finance', 'FiscalPeriod')
JournalEntry = get_model('finance', 'JournalEntry')
JournalEntryLine = get_model('finance', 'JournalEntryLine')
Transaction = get_model('finance', 'Transaction')
TransactionSequence = get_model('finance', 'TransactionSequence')

# POS Models
Order = get_model('pos', 'Order')
OrderLine = get_model('pos', 'OrderLine')

# HR Models
Employee = get_model('hr', 'Employee')

def simulate():
    print("🚀 Starting Enterprise Data Simulation (1.5 Years)...")
    
    # --- PHASE 0: CLEANUP ---
    Organization.objects.filter(slug='enterprise-erp').delete()
    print("🗑️ Existing 'enterprise-erp' data purged.")

    # --- PHASE 1: FOUNDATION ---
    org, _ = Organization.objects.get_or_create(
        slug='enterprise-erp',
        defaults={'name': 'Enterprise Global Solutions', 'is_active': True}
    )
    print(f"🏢 Organization: {org.name}")

    # Seed Sites
    sites_data = [
        {'code': 'HQ-LEB', 'name': 'HQ - Beirut', 'address': 'Downtown Beirut'},
        {'code': 'WH-ALPHA', 'name': 'Warehouse Alpha', 'address': 'Industrial Zone A'},
        {'code': 'WH-BETA', 'name': 'Warehouse Beta', 'address': 'Industrial Zone B'},
        {'code': 'STORE-1', 'name': 'Retail Store 1', 'address': 'Mall Level 1'},
        {'code': 'STORE-2', 'name': 'Retail Store 2', 'address': 'High Street 42'},
    ]
    sites = []
    for s in sites_data:
        site, _ = Site.objects.get_or_create(
            code=s['code'], organization=org,
            defaults={'name': s['name'], 'address': s['address'], 'is_active': True}
        )
        sites.append(site)
    print(f"📍 Sites: {len(sites)} created.")

    # Seed Warehouses
    whs = []
    for site in sites:
        wh, _ = Warehouse.objects.get_or_create(
            site=site, organization=org, name=f"Main Store - {site.code}",
            defaults={'type': 'STORE' if 'STORE' in site.code else 'GENERAL'}
        )
        whs.append(wh)

    # Seed Units
    pc, _ = Unit.objects.get_or_create(code='PC', organization=org, defaults={'name': 'Piece'})

    # Seed Categories & Brands
    cats = []
    for c_name in ['Electronics', 'Home Appliances', 'Furniture', 'Apparel', 'FMCG']:
        cat, _ = Category.objects.get_or_create(name=c_name, organization=org)
        cats.append(cat)
    
    brands = []
    for b_name in ['TechGiant', 'HomeMaster', 'LuxLiving', 'EverWear', 'DailyChoice']:
        brand, _ = Brand.objects.get_or_create(name=b_name, organization=org)
        brands.append(brand)

    # Seed Products (100 products)
    products = []
    for i in range(1, 101):
        cat = random.choice(cats)
        brand = random.choice(brands)
        cost = Decimal(random.uniform(5.0, 500.0)).quantize(Decimal('0.01'))
        price = (cost * Decimal('1.5')).quantize(Decimal('0.01'))
        
        prod, _ = Product.objects.get_or_create(
            sku=f"PRD-{i:04d}", organization=org,
            defaults={
                'name': f"Premium {cat.name} Item {i}",
                'category': cat,
                'brand': brand,
                'unit': pc,
                'cost_price': cost,
                'selling_price_ttc': price,
                'is_active': True
            }
        )
        products.append(prod)
    print(f"📦 Products: {len(products)} seeded.")

    # Seed Suppliers & Customers
    suppliers = []
    for i in range(1, 11):
        sup, _ = Contact.objects.get_or_create(
            name=f"Supplier {brands[i % 5].name} {i}", organization=org,
            defaults={'type': 'SUPPLIER', 'company_name': f"Corp {i}"}
        )
        suppliers.append(sup)
    
    customers = []
    for i in range(1, 101):
        cust, _ = Contact.objects.get_or_create(
            name=f"Customer {i}", organization=org,
            defaults={'type': 'CUSTOMER', 'phone': f"+961 70 {i:06d}"}
        )
        customers.append(cust)
    print(f"👥 Contacts: {len(suppliers)} Suppliers, {len(customers)} Customers.")

    # Sequence Caching
    def get_ref_batch(prefix, count):
        seq, _ = TransactionSequence.objects.get_or_create(
            organization=org, type=prefix,
            defaults={'prefix': f"{prefix}-", 'next_number': 1, 'padding': 6}
        )
        current = seq.next_number
        TransactionSequence.objects.filter(id=seq.id).update(next_number=models.F('next_number') + count)
        return [f"{seq.prefix}{str(current+i).zfill(seq.padding)}" for i in range(count)]

    # --- PHASE 2: HISTORICAL LOOP ---
    from django.db import reset_queries
    import gc

    start_date = timezone.make_aware(datetime.now() - timedelta(days=540))
    current_time = start_date
    end_date = timezone.now()
    
    print("⏳ Simulating 1.5 Years of activity (optimized sequence & memory)...")
    
    while current_time < end_date:
        # Clear memory
        reset_queries()
        gc.collect()

        # 1. Weekly Restocks (Mondays)
        if current_time.weekday() == 0:
            for wh in whs:
                if wh.type == 'GENERAL': # Main warehouses get stock
                    batch_refs = get_ref_batch('PO', 5)
                    for ref in batch_refs:
                        sup = random.choice(suppliers)
                        # Create Order (Purchase)
                        order = Order.objects.create(
                            organization=org, type='PURCHASE', status='DRAFT',
                            ref_code=ref, contact=sup, site=wh.site,
                            total_amount=0, # Computed
                            created_at=current_time
                        )
                        order.created_at = current_time # Force backdate
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
                            
                            # Update Inventory
                            inv, _ = Inventory.objects.get_or_create(
                                warehouse=wh, product=p, organization=org
                            )
                            inv.quantity = Decimal(str(inv.quantity)) + Decimal(qty)
                            inv.save()
                            
                            # Movement
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

        # 2. Daily Sales (Every day)
        for store_wh in [w for w in whs if w.type == 'STORE']:
            daily_orders_count = random.randint(5, 12) # Reduced for stability
            orders_to_create = []
            lines_to_create = []
            movements_to_create = []
            
            batch_refs = get_ref_batch('ORD', daily_orders_count)
            
            for i in range(daily_orders_count):
                cust = random.choice(customers)
                ref = batch_refs[i]
                random_time = time(random.randint(8, 18), random.randint(0, 59))
                order_time = timezone.make_aware(datetime.combine(current_time.date(), random_time))
                
                order = Order(
                    organization=org, type='SALE', status='COMPLETED',
                    ref_code=ref, contact=cust, site=store_wh.site,
                    total_amount=0, created_at=order_time
                )
                orders_to_create.append(order)

            # Bulk create orders to get IDs
            created_orders = Order.objects.bulk_create(orders_to_create)
            
            # Post-processing to force backdate (bypass auto_now_add)
            for order in created_orders:
                total = 0
                for _ in range(random.randint(1, 3)): # Reduced for stability
                    p = random.choice(products)
                    qty = random.randint(1, 2)
                    
                    # Update Inventory (limited atomicity during simulation)
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
                # Use update() to force the created_at even if auto_now_add is present
                Order.objects.filter(id=order.id).update(created_at=order.created_at)
            
            # Bulk create lines and movements
            OrderLine.objects.bulk_create(lines_to_create)
            InventoryMovement.objects.bulk_create(movements_to_create)
            
            # Update order totals (unfortunately bulk_update is needed or individual saves)
            Order.objects.bulk_update(created_orders, ['total_amount'])

        # 3. Stock Transfers (Fridays)
        if current_time.weekday() == 4:
            # Transfer from GENERAL to STORE
            gen_whs = [w for w in whs if w.type == 'GENERAL']
            store_whs = [w for w in whs if w.type == 'STORE']
            if gen_whs and store_whs:
                for src in gen_whs:
                    for dest in store_whs:
                        ref = TransactionSequence.next_value(org, 'TRF')
                        for _ in range(random.randint(5, 10)):
                            p = random.choice(products)
                            qty = random.randint(10, 30)
                            
                            # Deduct from src
                            inv_src, _ = Inventory.objects.get_or_create(warehouse=src, product=p, organization=org)
                            if Decimal(str(inv_src.quantity)) >= Decimal(qty):
                                inv_src.quantity = Decimal(str(inv_src.quantity)) - Decimal(qty)
                                inv_src.save()
                                
                                # Add to dest
                                inv_dest, _ = Inventory.objects.get_or_create(warehouse=dest, product=p, organization=org)
                                inv_dest.quantity = Decimal(str(inv_dest.quantity)) + Decimal(qty)
                                inv_dest.save()
                                
                                # Movement Records
                                InventoryMovement.objects.create(
                                    organization=org, product=p, warehouse=src,
                                    type='TRANSFER', quantity=-qty, reference=ref, created_at=current_time
                                )
                                InventoryMovement.objects.create(
                                    organization=org, product=p, warehouse=dest,
                                    type='TRANSFER', quantity=qty, reference=ref, created_at=current_time
                                )

        # 4. Payroll (1st of each month)
        if current_time.day == 1:
            # Simulate salary journal entries for 10 employees
            je = JournalEntry.objects.create(
                organization=org,
                transaction_date=current_time,
                description=f"Monthly Payroll - {current_time.strftime('%B %Y')}",
                status='POSTED',
                reference=f"PAY-{current_time.strftime('%Y%m')}",
                site=random.choice(sites)
            )
            
            total_salary = Decimal('25000.00')
            # Debit Salaries Expense, Credit Cash
            lines = []
            # Find appropriate accounts:
            # In seed_core, 6000 is OPEX, we'll try to find or use placeholders if not exist
            # For simulation, we'll use IDs from the org's COA if possible
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

        current_time += timedelta(days=1)
        if current_time.day == 1:
            print(f"📅 Progress: {current_time.strftime('%B %Y')} complete.")

    print("✅ Simulation complete across all modules!")

if __name__ == '__main__':
    simulate()
