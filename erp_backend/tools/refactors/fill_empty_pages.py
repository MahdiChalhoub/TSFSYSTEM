"""
Fill Empty Pages — Populates all empty tables so no UI pages are blank.
Run: docker exec tsf_backend python manage.py shell < fill_empty_pages.py
"""
import os, sys, gc, random, uuid
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp.settings')

import django
django.setup()

from datetime import datetime, timedelta
from decimal import Decimal
from django.utils import timezone
from django.db import close_old_connections

from erp.models import Organization, User, Site, Notification

org = Organization.objects.first()
user = User.objects.first()
sites = list(Site.objects.filter(organization=org))
site = sites[0] if sites else None

from apps.crm.models import Contact
from apps.inventory.models import Product, Category, Brand, Warehouse, Inventory, Parfum, ProductGroup
from apps.pos.models import Order, OrderLine
from apps.pos.returns_models import SalesReturn, SalesReturnLine, CreditNote, PurchaseReturn, PurchaseReturnLine
from apps.pos.quotation_models import Quotation, QuotationLine
from apps.pos.delivery_models import DeliveryZone, DeliveryOrder
from apps.pos.discount_models import DiscountRule, DiscountUsageLog
from apps.pos.consignment_models import ConsignmentSettlement, ConsignmentSettlementLine
from apps.pos.sourcing_models import ProductSupplier, SupplierPriceHistory
from apps.pos.purchase_order_models import PurchaseOrder, PurchaseOrderLine
from apps.finance.models import (
    Loan, LoanInstallment, FinancialEvent, TaxGroup, FinancialAccount, Transaction,
    ChartOfAccount, JournalEntry, JournalEntryLine
)
from apps.finance.payment_models import CustomerBalance, SupplierBalance
from apps.client_portal.models import (
    ClientWallet, WalletTransaction, ClientOrder, ClientOrderLine,
    ClientTicket, QuoteRequest, QuoteItem
)
from apps.supplier_portal.models import (
    SupplierProforma, ProformaLine, PriceChangeRequest, SupplierPortalAccess
)
from apps.workspace.models import (
    TaskCategory, Task, TaskComment, ChecklistTemplate, ChecklistTemplateItem,
    ChecklistInstance, ChecklistItemResponse, EmployeePerformance,
    Questionnaire, QuestionnaireQuestion, QuestionnaireResponse, QuestionnaireAnswer
)
from apps.inventory.location_models import (
    WarehouseZone, WarehouseAisle, WarehouseRack, WarehouseShelf, WarehouseBin, ProductLocation
)
from apps.inventory.counting_models import InventorySession, InventorySessionLine
from apps.inventory.alert_models import StockAlert

products = list(Product.objects.filter(organization=org)[:100])
customers = list(Contact.objects.filter(organization=org, type='CUSTOMER')[:50])
suppliers = list(Contact.objects.filter(organization=org, type='SUPPLIER')[:10])
categories = list(Category.objects.filter(organization=org))
brands = list(Brand.objects.filter(organization=org))
warehouses = list(Warehouse.objects.filter(organization=org))
fin_accounts = list(FinancialAccount.objects.filter(organization=org))
sale_orders = list(Order.objects.filter(organization=org, type='SALE')[:200])
purchase_orders_old = list(Order.objects.filter(organization=org, type='PURCHASE')[:50])

now = timezone.now()
start_date = now - timedelta(days=540)

def rand_date(months_ago_max=18):
    d = now - timedelta(days=random.randint(1, months_ago_max * 30))
    return timezone.make_aware(datetime(d.year, d.month, d.day, random.randint(8, 18), random.randint(0, 59)))

def rand_past_date():
    return rand_date().date()

print("═" * 60)
print("  PHASE 1: SALES MODULE")
print("═" * 60)

# ── Delivery Zones ──
if not DeliveryZone.objects.filter(organization=org).exists():
    zones_data = [
        ('Abidjan Centre', Decimal('2000.00'), 1),
        ('Abidjan Banlieue', Decimal('3500.00'), 2),
        ('Hors Abidjan', Decimal('8000.00'), 4),
        ('Express (Same Day)', Decimal('5000.00'), 0),
        ('International', Decimal('25000.00'), 7),
    ]
    dzones = []
    for name, fee, days in zones_data:
        dz = DeliveryZone.objects.create(
            organization=org, name=name, base_fee=fee, estimated_days=days
        )
        dzones.append(dz)
    print(f"  ✅ {len(dzones)} Delivery Zones")
else:
    dzones = list(DeliveryZone.objects.filter(organization=org))
    print(f"  ⏭ Delivery Zones exist ({len(dzones)})")

# ── Delivery Orders ──
if not DeliveryOrder.objects.filter(organization=org).exists():
    del_orders = []
    for i in range(40):
        order = random.choice(sale_orders) if sale_orders else None
        if not order:
            break
        cust = random.choice(customers) if customers else None
        dz = random.choice(dzones)
        status = random.choice(['PENDING', 'PREPARING', 'IN_TRANSIT', 'DELIVERED', 'DELIVERED', 'DELIVERED'])
        dt = rand_date()
        do = DeliveryOrder(
            organization=org, order=order, zone=dz, status=status,
            recipient_name=cust.name if cust else 'Walk-in',
            address_line1=f'{random.randint(1,200)} Rue {random.choice(["Commerce","Liberté","Nation"])}',
            city='Abidjan', phone=f'+225 0{random.randint(1,9)}{random.randint(10000000,99999999)}',
            delivery_fee=dz.base_fee, tracking_code=f'TRK-{uuid.uuid4().hex[:8].upper()}',
            scheduled_date=dt, driver=user,
        )
        if status == 'DELIVERED':
            do.delivered_at = dt + timedelta(hours=random.randint(2, 48))
        del_orders.append(do)
    DeliveryOrder.objects.bulk_create(del_orders)
    print(f"  ✅ {len(del_orders)} Delivery Orders")
else:
    print("  ⏭ Delivery Orders exist")

# ── Sales Returns ──
if not SalesReturn.objects.filter(organization=org).exists():
    for i in range(30):
        order = random.choice(sale_orders) if sale_orders else None
        if not order:
            break
        lines = list(order.lines.all()[:3])
        if not lines:
            continue
        sr = SalesReturn.objects.create(
            organization=org, original_order=order,
            return_date=rand_past_date(),
            reason=random.choice(['Defective product', 'Wrong item shipped', 'Customer changed mind', 'Quality issue']),
            status=random.choice(['PENDING', 'APPROVED', 'COMPLETED']),
            reference=f'RET-{i+1:04d}', processed_by=user,
        )
        for line in lines[:random.randint(1, 2)]:
            qty = min(line.quantity, Decimal(str(random.randint(1, 3))))
            SalesReturnLine.objects.create(
                organization=org, return_order=sr, original_line=line,
                product=line.product, quantity_returned=qty,
                unit_price=line.unit_price, refund_amount=qty * line.unit_price,
                restocked=random.choice([True, False]),
            )
    print(f"  ✅ {SalesReturn.objects.filter(organization=org).count()} Sales Returns")
else:
    print("  ⏭ Sales Returns exist")

# ── Credit Notes ──
if not CreditNote.objects.filter(organization=org).exists():
    returns = SalesReturn.objects.filter(organization=org, status__in=['APPROVED', 'COMPLETED'])[:15]
    for i, ret in enumerate(returns):
        total = sum(l.refund_amount for l in ret.lines.all())
        CreditNote.objects.create(
            organization=org, credit_number=f'CN-{i+1:04d}',
            customer=ret.original_order.contact, date=ret.return_date,
            amount=total, total_amount=total, status='ISSUED',
        )
    print(f"  ✅ {CreditNote.objects.filter(organization=org).count()} Credit Notes")
else:
    print("  ⏭ Credit Notes exist")

# ── Quotations ──
if not Quotation.objects.filter(organization=org).exists():
    for i in range(50):
        cust = random.choice(customers) if customers else None
        dt = rand_date()
        q = Quotation.objects.create(
            organization=org, reference=f'QUO-{i+1:04d}',
            contact=cust, user=user, site=site,
            status=random.choice(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED']),
            valid_until=(dt + timedelta(days=30)).date(),
            notes=f'Quotation for {cust.name if cust else "Walk-in"}',
        )
        total_ht = Decimal('0')
        for _ in range(random.randint(1, 4)):
            prod = random.choice(products) if products else None
            if not prod:
                break
            qty = Decimal(str(random.randint(1, 10)))
            price_ht = prod.selling_price_ht or prod.cost_price
            tax = price_ht * qty * Decimal('0.11')
            line_ht = price_ht * qty
            line_ttc = line_ht + tax
            QuotationLine.objects.create(
                organization=org, quotation=q, product=prod,
                quantity=qty, unit_price_ht=price_ht,
                unit_price_ttc=price_ht * Decimal('1.11'),
                tax_rate=Decimal('11.00'), tax_amount=tax,
                total_ht=line_ht, total_ttc=line_ttc,
            )
            total_ht += line_ht
        q.total_ht = total_ht
        q.total_tax = total_ht * Decimal('0.11')
        q.total_ttc = total_ht * Decimal('1.11')
        q.save(update_fields=['total_ht', 'total_tax', 'total_ttc'])
    print(f"  ✅ {Quotation.objects.filter(organization=org).count()} Quotations")
else:
    print("  ⏭ Quotations exist")

# ── Discount Rules ──
if not DiscountRule.objects.filter(organization=org).exists():
    rules = [
        ('Summer Sale 10%', 'PERCENTAGE', 'ORDER', Decimal('10.00'), 'SUMMER10'),
        ('New Customer 5%', 'PERCENTAGE', 'ORDER', Decimal('5.00'), 'NEW5'),
        ('VIP 15%', 'PERCENTAGE', 'ORDER', Decimal('15.00'), 'VIP15'),
        ('Flash Sale 2000 OFF', 'FIXED', 'ORDER', Decimal('2000.00'), 'FLASH2K'),
        ('Buy 3 Get 1', 'BUY_X_GET_Y', 'ORDER', Decimal('3.00'), 'B3G1'),
        ('Category Promo', 'PERCENTAGE', 'CATEGORY', Decimal('8.00'), 'CAT8'),
        ('Brand Special', 'PERCENTAGE', 'BRAND', Decimal('12.00'), 'BRAND12'),
        ('Weekend Deal', 'FIXED', 'ORDER', Decimal('1500.00'), 'WKND'),
        ('Loyalty Reward', 'PERCENTAGE', 'ORDER', Decimal('7.00'), 'LOYAL7'),
        ('Clearance 25%', 'PERCENTAGE', 'ORDER', Decimal('25.00'), 'CLEAR25'),
    ]
    for name, dtype, scope, val, code in rules:
        cat = random.choice(categories) if categories and scope == 'CATEGORY' else None
        brand = random.choice(brands) if brands and scope == 'BRAND' else None
        DiscountRule.objects.create(
            organization=org, name=name, code=code,
            discount_type=dtype, scope=scope, value=val,
            category=cat, brand=brand,
            is_active=True, auto_apply=random.choice([True, False]),
            start_date=rand_past_date(),
            end_date=(now + timedelta(days=random.randint(30, 180))).date(),
            usage_limit=random.randint(50, 500), times_used=random.randint(0, 30),
            created_by=user,
        )
    # Usage logs
    rules_db = list(DiscountRule.objects.filter(organization=org))
    for _ in range(40):
        rule = random.choice(rules_db)
        order = random.choice(sale_orders) if sale_orders else None
        if order:
            DiscountUsageLog.objects.create(
                organization=org, rule=rule, order=order,
                discount_amount=Decimal(str(random.randint(500, 5000))),
                applied_by=user,
            )
    print(f"  ✅ {len(rules)} Discount Rules + usage logs")
else:
    print("  ⏭ Discount Rules exist")

# ── Consignment Settlements ──
if not ConsignmentSettlement.objects.filter(organization=org).exists():
    for i in range(10):
        sup = random.choice(suppliers) if suppliers else None
        if not sup:
            break
        cs = ConsignmentSettlement.objects.create(
            organization=org, reference=f'SETTLE-{i+1:04d}',
            supplier=sup, total_amount=Decimal(str(random.randint(50000, 500000))),
            status=random.choice(['PENDING', 'PARTIAL', 'PAID']),
            performed_by=user,
        )
    print(f"  ✅ {ConsignmentSettlement.objects.filter(organization=org).count()} Consignment Settlements")
else:
    print("  ⏭ Consignment Settlements exist")

close_old_connections()
gc.collect()

print("\n" + "═" * 60)
print("  PHASE 2: PURCHASES MODULE")
print("═" * 60)

# ── Purchase Orders ──
if not PurchaseOrder.objects.filter(organization=org).exists():
    for i in range(30):
        sup = random.choice(suppliers) if suppliers else None
        if not sup:
            break
        wh = random.choice(warehouses) if warehouses else None
        dt = rand_date()
        status = random.choice(['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'RECEIVED', 'COMPLETED'])
        po = PurchaseOrder(
            organization=org, po_number=f'PO-{i+1:06d}',
            status=status, supplier=sup, supplier_name=sup.name,
            site=site, warehouse=wh,
            order_date=dt.date() if status not in ['DRAFT'] else None,
            expected_date=(dt + timedelta(days=random.randint(7, 30))).date(),
            currency='XOF', created_by=user,
            priority=random.choice(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
        )
        if status in ['RECEIVED', 'COMPLETED']:
            po.received_date = (dt + timedelta(days=random.randint(7, 21))).date()
        po.save()
        subtotal = Decimal('0')
        for j in range(random.randint(2, 6)):
            prod = random.choice(products) if products else None
            if not prod:
                break
            qty = Decimal(str(random.randint(5, 50)))
            price = prod.cost_price or Decimal('1000')
            pol = PurchaseOrderLine(
                organization=org, order=po, product=prod,
                quantity=qty, unit_price=price, tax_rate=Decimal('11.00'),
            )
            if status in ['RECEIVED', 'COMPLETED']:
                pol.qty_received = qty
            pol.save()
            subtotal += pol.line_total
        po.subtotal = subtotal
        po.tax_amount = subtotal * Decimal('0.11')
        po.total_amount = subtotal * Decimal('1.11')
        po.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])
    print(f"  ✅ {PurchaseOrder.objects.filter(organization=org).count()} Purchase Orders")
else:
    print("  ⏭ Purchase Orders exist")

# ── Purchase Returns ──
if not PurchaseReturn.objects.filter(organization=org).exists():
    for i in range(15):
        order = random.choice(purchase_orders_old) if purchase_orders_old else None
        if not order:
            break
        lines = list(order.lines.all()[:3])
        if not lines:
            continue
        pr = PurchaseReturn.objects.create(
            organization=org, original_order=order,
            supplier=order.contact, return_date=rand_past_date(),
            reason=random.choice(['Defective batch', 'Wrong specs', 'Overstock', 'Quality fail']),
            status=random.choice(['PENDING', 'APPROVED', 'COMPLETED']),
            reference=f'PRET-{i+1:04d}', processed_by=user,
        )
        for line in lines[:random.randint(1, 2)]:
            qty = min(line.quantity, Decimal(str(random.randint(1, 5))))
            PurchaseReturnLine.objects.create(
                organization=org, return_order=pr, original_line=line,
                product=line.product, quantity_returned=qty,
                unit_cost=line.unit_price, total_amount=qty * line.unit_price,
            )
    print(f"  ✅ {PurchaseReturn.objects.filter(organization=org).count()} Purchase Returns")
else:
    print("  ⏭ Purchase Returns exist")

# ── Product Suppliers (Sourcing) ──
if not ProductSupplier.objects.filter(organization=org).exists():
    count = 0
    for sup in suppliers[:5]:
        assigned = random.sample(products, min(15, len(products)))
        for prod in assigned:
            ProductSupplier.objects.create(
                organization=org, product=prod, supplier=sup,
                supplier_sku=f'SUP-{sup.id}-{prod.id}',
                lead_time_days=random.randint(3, 21),
                min_order_qty=Decimal(str(random.randint(5, 50))),
                is_preferred=random.choice([True, False]),
                last_purchased_price=prod.cost_price,
                last_purchased_date=rand_date(),
            )
            count += 1
            # Price history
            for _ in range(random.randint(1, 3)):
                SupplierPriceHistory.objects.create(
                    organization=org, product=prod, supplier=sup,
                    price=prod.cost_price * Decimal(str(random.uniform(0.9, 1.1))),
                    currency='XOF',
                )
    print(f"  ✅ {count} Product-Supplier links + price history")
else:
    print("  ⏭ Product Suppliers exist")

close_old_connections()
gc.collect()

print("\n" + "═" * 60)
print("  PHASE 3: FINANCE MODULE")
print("═" * 60)

# ── Tax Groups ──
if not TaxGroup.objects.filter(organization=org).exists():
    tax_groups = [
        ('TVA Standard 11%', Decimal('11.00'), True),
        ('TVA Réduite 5.5%', Decimal('5.50'), False),
        ('Exonéré 0%', Decimal('0.00'), False),
        ('TVA Luxe 18%', Decimal('18.00'), False),
        ('AIRSI 7.5%', Decimal('7.50'), False),
    ]
    for name, rate, is_default in tax_groups:
        TaxGroup.objects.create(organization=org, name=name, rate=rate, is_default=is_default)
    print(f"  ✅ {len(tax_groups)} Tax Groups")
else:
    print("  ⏭ Tax Groups exist")

# ── Loans ──
if not Loan.objects.filter(organization=org).exists():
    loans_data = [
        ('Equipment Lease', Decimal('15000000'), Decimal('8.50'), 36),
        ('Working Capital', Decimal('5000000'), Decimal('12.00'), 12),
        ('Vehicle Loan', Decimal('8000000'), Decimal('9.00'), 48),
        ('Expansion Loan', Decimal('25000000'), Decimal('7.50'), 60),
        ('Short-term Bridge', Decimal('3000000'), Decimal('15.00'), 6),
    ]
    for name, principal, rate, months in loans_data:
        contact = random.choice(suppliers + customers)
        loan = Loan.objects.create(
            organization=org, contract_number=f'LOAN-{uuid.uuid4().hex[:6].upper()}',
            contact=contact, principal_amount=principal,
            interest_rate=rate, term_months=months,
            start_date=rand_past_date(), status='ACTIVE',
            created_by=user,
        )
        # Installments
        monthly = principal / months
        interest_monthly = (principal * rate / Decimal('100')) / 12
        for m in range(months):
            due = loan.start_date + timedelta(days=30 * (m + 1))
            is_past = due < now.date()
            LoanInstallment.objects.create(
                organization=org, loan=loan, due_date=due,
                total_amount=monthly + interest_monthly,
                principal_amount=monthly, interest_amount=interest_monthly,
                paid_amount=monthly + interest_monthly if is_past else Decimal('0'),
                is_paid=is_past, status='PAID' if is_past else 'PENDING',
            )
    print(f"  ✅ {Loan.objects.filter(organization=org).count()} Loans with installments")
else:
    print("  ⏭ Loans exist")

# ── Financial Events ──
if not FinancialEvent.objects.filter(organization=org).exists():
    fa = fin_accounts[0] if fin_accounts else None
    events_data = [
        ('CAPITAL_INJECTION', Decimal('50000000'), 'Initial capital injection'),
        ('PARTNER_INJECTION', Decimal('10000000'), 'Partner capital boost Q1'),
        ('PARTNER_WITHDRAWAL', Decimal('2000000'), 'Partner dividend Q2'),
        ('LOAN_DISBURSEMENT', Decimal('15000000'), 'Equipment lease disbursement'),
        ('LOAN_REPAYMENT', Decimal('1500000'), 'Monthly repayment Jan'),
        ('SALARY_PAYMENT', Decimal('8000000'), 'Monthly payroll Dec'),
        ('SALARY_PAYMENT', Decimal('8200000'), 'Monthly payroll Jan'),
        ('EXPENSE', Decimal('500000'), 'Office renovation'),
        ('ASSET_ACQUISITION', Decimal('3000000'), 'New delivery vehicle'),
        ('ASSET_DEPRECIATION', Decimal('250000'), 'Monthly depreciation'),
        ('DEFERRED_EXPENSE_CREATION', Decimal('6000000'), 'Annual insurance premium'),
        ('DEFERRED_EXPENSE_RECOGNITION', Decimal('500000'), 'Insurance amortization Jan'),
        ('PARTNER_LOAN', Decimal('5000000'), 'Partner short-term loan'),
        ('LOAN_REPAYMENT', Decimal('1500000'), 'Monthly repayment Feb'),
        ('SALARY_PAYMENT', Decimal('8500000'), 'Monthly payroll Feb'),
        ('EXPENSE', Decimal('350000'), 'Marketing campaign'),
        ('PARTNER_INJECTION', Decimal('3000000'), 'Partner cash injection'),
        ('ASSET_DISPOSAL', Decimal('800000'), 'Old equipment sale'),
        ('EXPENSE', Decimal('1200000'), 'Warehouse maintenance'),
        ('SALARY_PAYMENT', Decimal('8300000'), 'Monthly payroll Mar'),
    ]
    for etype, amount, note in events_data:
        FinancialEvent.objects.create(
            organization=org, event_type=etype, amount=amount,
            financial_account=fa, date=rand_date(),
            reference=f'EVT-{uuid.uuid4().hex[:6].upper()}',
            notes=note, status='COMPLETED',
        )
    print(f"  ✅ {len(events_data)} Financial Events")
else:
    print("  ⏭ Financial Events exist")

# ── Customer Balances ──
if not CustomerBalance.objects.filter(organization=org).exists():
    for cust in customers:
        bal = Decimal(str(random.randint(0, 500000)))
        try:
            CustomerBalance.objects.create(
                organization=org, contact=cust,
                current_balance=bal,
                credit_limit=Decimal(str(random.randint(100000, 2000000))),
                last_payment_date=rand_past_date(),
                last_invoice_date=rand_past_date(),
            )
        except Exception:
            pass
    print(f"  ✅ {CustomerBalance.objects.filter(organization=org).count()} Customer Balances")
else:
    print("  ⏭ Customer Balances exist")

close_old_connections()
gc.collect()

print("\n" + "═" * 60)
print("  PHASE 4: INVENTORY MODULE")
print("═" * 60)

# ── Warehouse Locations ──
if not WarehouseZone.objects.filter(organization=org).exists():
    wh_site = sites[0] if sites else None
    if wh_site:
        zone_configs = [
            ('A', 'Zone A - General Storage', 'STORAGE'),
            ('B', 'Zone B - Receiving', 'RECEIVING'),
            ('C', 'Zone C - Shipping', 'SHIPPING'),
            ('D', 'Zone D - Cold Storage', 'FROZEN'),
            ('E', 'Zone E - Returns', 'RETURNS'),
        ]
        all_bins = []
        for zcode, zname, ztype in zone_configs:
            zone = WarehouseZone.objects.create(
                organization=org, warehouse=wh_site, code=zcode,
                name=zname, zone_type=ztype, capacity_sqm=Decimal('200')
            )
            for ai in range(1, 3):
                aisle = WarehouseAisle.objects.create(
                    organization=org, zone=zone, code=f'{ai:02d}', name=f'Aisle {ai}'
                )
                for ri in range(1, 3):
                    rack = WarehouseRack.objects.create(
                        organization=org, aisle=aisle, code=f'R{ri:02d}',
                        max_weight_kg=Decimal('500')
                    )
                    for si in range(1, 3):
                        shelf = WarehouseShelf.objects.create(
                            organization=org, rack=rack, code=f'S{si:02d}'
                        )
                        for bi in range(1, 3):
                            bin_obj = WarehouseBin.objects.create(
                                organization=org, shelf=shelf, code=f'B{bi:02d}'
                            )
                            all_bins.append(bin_obj)
        # Product Locations
        for prod in products[:40]:
            b = random.choice(all_bins)
            ProductLocation.objects.create(
                organization=org, product=prod, bin=b,
                quantity=Decimal(str(random.randint(5, 100))),
                min_quantity=Decimal('5'), max_quantity=Decimal('200'),
            )
        print(f"  ✅ Warehouse locations: {len(zone_configs)} zones, {len(all_bins)} bins, {min(40, len(products))} product locations")
else:
    print("  ⏭ Warehouse Locations exist")

# ── Stock Alerts ──
if not StockAlert.objects.filter(organization=org).exists():
    wh = warehouses[0] if warehouses else None
    alert_types = ['LOW_STOCK', 'OUT_OF_STOCK', 'OVERSTOCK', 'REORDER']
    for i in range(30):
        prod = random.choice(products) if products else None
        if not prod:
            break
        atype = random.choice(alert_types)
        stock = Decimal(str(random.randint(0, 5))) if atype in ['LOW_STOCK', 'OUT_OF_STOCK'] else Decimal(str(random.randint(200, 500)))
        StockAlert.objects.create(
            organization=org, product=prod, warehouse=wh,
            alert_type=atype,
            severity=random.choice(['INFO', 'WARNING', 'CRITICAL']),
            status=random.choice(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']),
            current_stock=stock, threshold=Decimal(str(prod.min_stock_level)),
            reorder_qty=Decimal(str(prod.min_stock_level * 2)),
            message=f'{atype}: {prod.name} at {stock} units',
        )
    print(f"  ✅ {StockAlert.objects.filter(organization=org).count()} Stock Alerts")
else:
    print("  ⏭ Stock Alerts exist")

# ── Inventory Counting Sessions ──
if not InventorySession.objects.filter(organization=org).exists():
    wh = warehouses[0] if warehouses else None
    for i in range(10):
        session = InventorySession.objects.create(
            organization=org, reference=f'COUNT-{i+1:04d}',
            location=wh.name if wh else 'Main Warehouse',
            warehouse=wh, session_date=rand_past_date(),
            status=random.choice(['IN_PROGRESS', 'WAITING_VERIFICATION', 'VERIFIED', 'ADJUSTED']),
            person1_name='Ahmad K.', person2_name='Fatou D.',
            created_by=user,
        )
        for prod in random.sample(products, min(10, len(products))):
            sys_qty = Decimal(str(random.randint(10, 100)))
            p1 = sys_qty + Decimal(str(random.randint(-5, 5)))
            p2 = sys_qty + Decimal(str(random.randint(-5, 5)))
            line = InventorySessionLine(
                session=session, product=prod, system_qty=sys_qty,
                physical_qty_person1=p1, physical_qty_person2=p2,
            )
            line.compute_differences()
            line.save()
    print(f"  ✅ {InventorySession.objects.filter(organization=org).count()} Inventory Sessions")
else:
    print("  ⏭ Inventory Sessions exist")

close_old_connections()
gc.collect()

print("\n" + "═" * 60)
print("  PHASE 5: PRODUCTS MODULE")
print("═" * 60)

# ── Parfums ──
if not Parfum.objects.filter(organization=org).exists():
    parfum_names = ['Rose', 'Lavande', 'Vanille', 'Citron', 'Menthe',
                     'Jasmin', 'Musc', 'Ambre', 'Coco', 'Bois de Santal']
    for pname in parfum_names:
        p = Parfum.objects.create(organization=org, name=pname, short_name=pname[:3].upper())
        if categories:
            p.categories.add(random.choice(categories))
    print(f"  ✅ {len(parfum_names)} Parfums")
else:
    print("  ⏭ Parfums exist")

# ── Product Groups ──
if not ProductGroup.objects.filter(organization=org).exists():
    parfums = list(Parfum.objects.filter(organization=org))
    group_names = ['Premium Collection', 'Budget Line', 'Seasonal', 'Import Special',
                    'Local Favorites', 'New Arrivals', 'Best Sellers', 'Clearance']
    for gname in group_names:
        ProductGroup.objects.create(
            organization=org, name=gname,
            brand=random.choice(brands) if brands else None,
            parfum=random.choice(parfums) if parfums else None,
            category=random.choice(categories) if categories else None,
            description=f'{gname} product collection',
        )
    print(f"  ✅ {len(group_names)} Product Groups")
else:
    print("  ⏭ Product Groups exist")

close_old_connections()
gc.collect()

print("\n" + "═" * 60)
print("  PHASE 6: WORKSPACE MODULE")
print("═" * 60)

# ── Task Categories ──
if not TaskCategory.objects.filter(organization=org).exists():
    cats = [
        ('Inventory', '#22c55e', 'Package'), ('Finance', '#6366f1', 'DollarSign'),
        ('HR', '#f59e0b', 'Users'), ('Sales', '#ec4899', 'ShoppingCart'),
        ('Maintenance', '#94a3b8', 'Wrench'), ('Customer Service', '#14b8a6', 'Headphones'),
    ]
    task_cats = []
    for name, color, icon in cats:
        tc = TaskCategory.objects.create(organization=org, name=name, color=color, icon=icon)
        task_cats.append(tc)
    print(f"  ✅ {len(task_cats)} Task Categories")
else:
    task_cats = list(TaskCategory.objects.filter(organization=org))
    print(f"  ⏭ Task Categories exist ({len(task_cats)})")

# ── Tasks ──
if not Task.objects.filter(organization=org).exists():
    task_templates = [
        'Restock shelf display', 'Update price labels', 'Count inventory section',
        'Process customer return', 'Follow up on PO delivery', 'Review supplier invoice',
        'Clean storage area', 'Update product photos', 'Prepare sales report',
        'Check expiring products', 'Organize cold storage', 'Update CRM contacts',
        'Process discount claims', 'Review low stock items', 'Audit cash register',
        'Update employee schedules', 'Prepare monthly financials', 'Check warranty claims',
        'Arrange new product display', 'Review quotation responses',
        'Check delivery status', 'Verify bank reconciliation', 'Update tax filings',
        'Schedule maintenance', 'Prepare staff training', 'Review loyalty program',
        'Organize clearance section', 'Process returns batch', 'Plan seasonal promotion',
        'Review KPI dashboard', 'Update warehouse layout', 'Check product quality',
        'Process payroll', 'Review purchase forecasts', 'Optimize stock levels',
        'Prepare compliance reports', 'Schedule equipment service',
        'Update digital catalog', 'Review supplier contracts', 'Audit inventory accuracy',
    ]
    statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED', 'CANCELLED']
    priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
    for i, title in enumerate(task_templates):
        cat = random.choice(task_cats) if task_cats else None
        status = random.choice(statuses)
        dt = rand_date(12)
        t = Task.objects.create(
            organization=org, title=title,
            description=f'Task: {title}. Please complete as outlined.',
            status=status, priority=random.choice(priorities),
            source=random.choice(['MANUAL', 'SYSTEM']),
            category=cat, assigned_by=user, assigned_to=user,
            points=random.randint(1, 10), estimated_minutes=random.randint(15, 120),
            due_date=dt + timedelta(days=random.randint(1, 14)),
        )
        if status == 'COMPLETED':
            t.completed_at = dt + timedelta(days=random.randint(1, 7))
            t.save(update_fields=['completed_at'])
        # Comments
        for _ in range(random.randint(0, 3)):
            TaskComment.objects.create(
                organization=org, task=t, author=user,
                content=random.choice([
                    'Working on this now.', 'Need more info.', 'Done!',
                    'Waiting for supplies.', 'Escalated to manager.',
                ]),
            )
    print(f"  ✅ {len(task_templates)} Tasks with comments")
else:
    print("  ⏭ Tasks exist")

# ── Checklists ──
if not ChecklistTemplate.objects.filter(organization=org).exists():
    templates = [
        ('Start of Shift', 'SHIFT_START', ['Open cash register', 'Check product displays',
            'Review daily targets', 'Verify cold storage temperature']),
        ('End of Shift', 'SHIFT_END', ['Close cash register', 'Count cash drawer',
            'Lock storage areas', 'Submit daily report']),
        ('Weekly Inventory', 'WEEKLY', ['Count high-value items', 'Check expiry dates',
            'Review stock alerts', 'Update reorder list', 'Photograph damaged goods']),
        ('Monthly Audit', 'CUSTOM', ['Full inventory count', 'Reconcile POS records',
            'Review supplier balances', 'Check compliance docs',
            'Update product pricing', 'Review employee performance']),
        ('Daily Cleaning', 'DAILY', ['Clean displays', 'Mop floors',
            'Sanitize checkout area', 'Empty trash bins']),
    ]
    for tpl_name, trigger, items in templates:
        tpl = ChecklistTemplate.objects.create(
            organization=org, name=tpl_name, trigger=trigger, points=len(items) * 2
        )
        for idx, label in enumerate(items):
            ChecklistTemplateItem.objects.create(
                organization=org, template=tpl, label=label, order=idx + 1
            )
        # Create instances
        for _ in range(random.randint(3, 8)):
            inst = ChecklistInstance.objects.create(
                organization=org, template=tpl, assigned_to=user,
                date=rand_past_date(),
                status=random.choice(['PENDING', 'COMPLETED']),
            )
            for item in tpl.items.all():
                checked = random.choice([True, True, True, False])
                ChecklistItemResponse.objects.create(
                    organization=org, instance=inst, template_item=item,
                    is_checked=checked,
                    checked_at=rand_date() if checked else None,
                )
    print(f"  ✅ {len(templates)} Checklist Templates with instances")
else:
    print("  ⏭ Checklists exist")

# ── Questionnaires & Performance ──
if not Questionnaire.objects.filter(organization=org).exists():
    q = Questionnaire.objects.create(
        organization=org, name='Monthly Employee Evaluation',
        description='Standard monthly performance review', frequency='MONTHLY'
    )
    questions = [
        'Punctuality and attendance', 'Quality of work',
        'Customer interaction', 'Teamwork', 'Initiative',
    ]
    for idx, qt in enumerate(questions):
        QuestionnaireQuestion.objects.create(
            organization=org, questionnaire=q,
            question_text=qt, question_type='RATING',
            max_score=5, order=idx + 1,
        )
    # Responses
    for _ in range(15):
        resp = QuestionnaireResponse.objects.create(
            organization=org, questionnaire=q,
            employee=user, evaluator=user,
            period_label=f'2025-{random.randint(1,12):02d}',
        )
        total = Decimal('0')
        for qq in q.questions.all():
            score = Decimal(str(random.randint(2, 5)))
            QuestionnaireAnswer.objects.create(
                organization=org, response=resp, question=qq, score=score,
            )
            total += score
        resp.total_score = total
        resp.max_possible_score = Decimal('25')
        resp.score_percentage = (total / Decimal('25')) * 100
        resp.save(update_fields=['total_score', 'max_possible_score', 'score_percentage'])
    print(f"  ✅ Questionnaire + 15 responses")
else:
    print("  ⏭ Questionnaires exist")

# ── Employee Performance ──
if not EmployeePerformance.objects.filter(organization=org).exists():
    for m in range(1, 13):
        score = Decimal(str(random.randint(40, 98)))
        perf = EmployeePerformance.objects.create(
            organization=org, employee=user,
            period_label=f'2025-{m:02d}', overall_score=score,
        )
        perf.calculate_tier()
    print(f"  ✅ 12 months Employee Performance")
else:
    print("  ⏭ Employee Performance exist")

close_old_connections()
gc.collect()

print("\n" + "═" * 60)
print("  PHASE 7: CRM & PORTALS")
print("═" * 60)

# ── Client Orders ──
if not ClientOrder.objects.filter(organization=org).exists():
    for i in range(15):
        cust = random.choice(customers) if customers else None
        if not cust:
            break
        co = ClientOrder.objects.create(
            organization=org, contact=cust,
            status=random.choice(['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']),
            payment_status=random.choice(['PAID', 'UNPAID', 'PARTIAL']),
            delivery_address=f'{random.randint(1,200)} Rue Commerce, Abidjan',
            delivery_phone=f'+225 0{random.randint(1,9)}{random.randint(10000000,99999999)}',
            currency='XOF',
        )
        subtotal = Decimal('0')
        for _ in range(random.randint(1, 4)):
            prod = random.choice(products) if products else None
            if not prod:
                break
            qty = Decimal(str(random.randint(1, 5)))
            price = prod.selling_price_ttc or Decimal('5000')
            col = ClientOrderLine(
                organization=org, order=co, product=prod,
                product_name=prod.name, quantity=qty,
                unit_price=price, tax_rate=Decimal('11.00'),
            )
            col.save()
            subtotal += col.line_total
        co.subtotal = subtotal
        co.total_amount = subtotal
        co.save(update_fields=['subtotal', 'total_amount'])
    print(f"  ✅ {ClientOrder.objects.filter(organization=org).count()} Client Orders")
else:
    print("  ⏭ Client Orders exist")

# ── Client Tickets ──
if not ClientTicket.objects.filter(organization=org).exists():
    ticket_subjects = [
        'Wrong product received', 'Late delivery', 'Damaged packaging',
        'Request for refund', 'Product quality complaint', 'Missing items',
        'Price discrepancy', 'Account inquiry', 'Loyalty points issue',
        'General feedback', 'Suggestion for new products', 'Warranty claim',
        'Bulk order inquiry', 'Payment processing issue', 'Address change request',
        'Product availability', 'Exchange request', 'Invoice correction needed',
        'Delivery tracking issue', 'Store feedback',
    ]
    for subj in ticket_subjects:
        ClientTicket.objects.create(
            organization=org,
            contact=random.choice(customers) if customers else None,
            ticket_type=random.choice(['GENERAL', 'ORDER_ISSUE', 'DELIVERY_PROBLEM', 'COMPLAINT', 'SUGGESTION']),
            status=random.choice(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
            priority=random.choice(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
            subject=subj, description=f'Customer reported: {subj}.',
            assigned_to=user,
        )
    print(f"  ✅ {len(ticket_subjects)} Client Tickets")
else:
    print("  ⏭ Client Tickets exist")

# ── Quote Requests ──
if not QuoteRequest.objects.filter(organization=org).exists():
    for i in range(10):
        cust = random.choice(customers) if customers else None
        qr = QuoteRequest.objects.create(
            organization=org,
            contact=cust, full_name=cust.name if cust else f'Guest {i}',
            email=cust.email or f'guest{i}@example.com',
            phone=cust.phone or '', message=f'Request for bulk pricing on multiple products.',
            status=random.choice(['PENDING', 'REPLIED', 'CONVERTED', 'DECLINED']),
        )
        for _ in range(random.randint(1, 3)):
            prod = random.choice(products) if products else None
            if prod:
                QuoteItem.objects.create(
                    organization=org, quote_request=qr, product=prod,
                    product_name=prod.name, quantity=Decimal(str(random.randint(10, 100))),
                )
    print(f"  ✅ {QuoteRequest.objects.filter(organization=org).count()} Quote Requests")
else:
    print("  ⏭ Quote Requests exist")

# ── Client Wallets ──
if not ClientWallet.objects.filter(organization=org).exists():
    for cust in customers[:20]:
        wallet = ClientWallet.objects.create(
            organization=org, contact=cust,
            balance=Decimal(str(random.randint(0, 50000))),
            loyalty_points=random.randint(0, 500),
        )
        for _ in range(random.randint(1, 4)):
            amt = Decimal(str(random.randint(500, 10000)))
            WalletTransaction.objects.create(
                organization=org, wallet=wallet,
                transaction_type=random.choice(['CREDIT', 'DEBIT']),
                amount=amt,
                balance_after=wallet.balance,
                reason=random.choice(['POS Change', 'Loyalty Redemption', 'Refund Credit', 'Manual Top-up']),
            )
    print(f"  ✅ {ClientWallet.objects.filter(organization=org).count()} Client Wallets")
else:
    print("  ⏭ Client Wallets exist")

# ── Supplier Proformas ──
if not SupplierProforma.objects.filter(organization=org).exists():
    for i in range(10):
        sup = random.choice(suppliers) if suppliers else None
        if not sup:
            break
        sp = SupplierProforma(
            organization=org, supplier=sup,
            status=random.choice(['DRAFT', 'SUBMITTED', 'APPROVED']),
            supplier_notes=f'Proforma invoice from {sup.name}',
            currency='XOF',
        )
        sp.save()
        subtotal = Decimal('0')
        for _ in range(random.randint(2, 5)):
            prod = random.choice(products) if products else None
            if not prod:
                break
            qty = Decimal(str(random.randint(5, 30)))
            price = prod.cost_price or Decimal('1000')
            line_total = qty * price
            ProformaLine.objects.create(
                organization=org, proforma=sp, product=prod,
                description=prod.name, quantity=qty, unit_price=price, line_total=line_total
            )
            subtotal += line_total
        sp.subtotal = subtotal
        sp.tax_amount = subtotal * Decimal('0.11')
        sp.total_amount = subtotal * Decimal('1.11')
        sp.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])
    print(f"  ✅ {SupplierProforma.objects.filter(organization=org).count()} Supplier Proformas")
else:
    print("  ⏭ Supplier Proformas exist")

# ── Price Change Requests ──
if not PriceChangeRequest.objects.filter(organization=org).exists():
    for i in range(10):
        sup = random.choice(suppliers) if suppliers else None
        prod = random.choice(products) if products else None
        if not sup or not prod:
            break
        old_price = prod.cost_price or Decimal('1000')
        new_price = old_price * Decimal(str(random.uniform(1.05, 1.20)))
        PriceChangeRequest.objects.create(
            organization=org, supplier=sup, product=prod,
            request_type=random.choice(['SELLING', 'PURCHASE']),
            current_price=old_price, proposed_price=new_price.quantize(Decimal('0.01')),
            reason=random.choice(['Raw material increase', 'Currency fluctuation', 'Market adjustment']),
            status=random.choice(['PENDING', 'APPROVED', 'REJECTED']),
        )
    print(f"  ✅ {PriceChangeRequest.objects.filter(organization=org).count()} Price Change Requests")
else:
    print("  ⏭ Price Change Requests exist")

close_old_connections()
gc.collect()

print("\n" + "═" * 60)
print("  PHASE 8: NOTIFICATIONS")
print("═" * 60)

if not Notification.objects.filter(user=user).exists():
    notif_data = [
        ('INFO', 'New purchase order received', 'PO-000001 from Supplier A'),
        ('SUCCESS', 'Payment processed', 'Customer receipt of 250,000 XOF confirmed'),
        ('WARNING', 'Low stock alert', 'PRD-0015 below minimum stock level'),
        ('ERROR', 'Payment failed', 'Bank transfer for Invoice INV-0042 rejected'),
        ('INFO', 'New employee joined', 'Ahmad K. added to Sales department'),
        ('SUCCESS', 'Inventory count completed', 'COUNT-0003 verified successfully'),
        ('WARNING', 'Expiry approaching', '5 products expiring within 30 days'),
        ('INFO', 'Quotation accepted', 'QUO-0012 converted to sale order'),
        ('SUCCESS', 'Monthly payroll processed', 'Feb 2026 payroll completed'),
        ('WARNING', 'Overdue invoice', 'INV-0089 is 15 days overdue'),
        ('INFO', 'New delivery zone added', 'Hors Abidjan zone configured'),
        ('SUCCESS', 'Return processed', 'RET-0005 refund issued to customer'),
        ('WARNING', 'Budget threshold reached', '85% of Q1 marketing budget used'),
        ('INFO', 'Task assigned', 'Review supplier contracts due in 3 days'),
        ('SUCCESS', 'Loan installment paid', 'Equipment lease payment processed'),
        ('ERROR', 'Sync failure', 'POS terminal 2 offline for 30 minutes'),
        ('INFO', 'Price update applied', '12 products updated with new pricing'),
        ('SUCCESS', 'Delivery completed', 'DEL-0023 delivered to customer'),
        ('WARNING', 'Supplier rating low', 'Supplier B quality rating dropped to 2.5'),
        ('INFO', 'Report generated', 'Monthly P&L report ready for review'),
    ]
    for ntype, title, msg in notif_data:
        Notification.objects.create(
            user=user, title=title, message=msg, type=ntype,
        )
    # Mark some as read
    recent = Notification.objects.filter(user=user).order_by('-created_at')[:10]
    for n in recent[:5]:
        n.mark_as_read()
    print(f"  ✅ {len(notif_data)} Notifications")
else:
    print("  ⏭ Notifications exist")

print("\n" + "═" * 60)
print("  ✅ ALL PHASES COMPLETE — Every page should now have data!")
print("═" * 60)
