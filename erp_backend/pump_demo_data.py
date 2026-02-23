import os
import django
import random
from datetime import datetime, timedelta, date, time
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.apps import apps
from django.db import models
from django.utils import timezone

Organization = apps.get_model('erp', 'Organization')
Site = apps.get_model('erp', 'Site')
Contact = apps.get_model('crm', 'Contact')
Product = apps.get_model('inventory', 'Product')
Invoice = apps.get_model('finance', 'Invoice')
InvoiceLine = apps.get_model('finance', 'InvoiceLine')
Order = apps.get_model('pos', 'Order')
OrderLine = apps.get_model('pos', 'OrderLine')
FinancialAccount = apps.get_model('finance', 'FinancialAccount')
Payment = apps.get_model('finance', 'Payment')

def pump_data():
    try:
        org = Organization.objects.get(slug='tsf-global') # Changed to tsf-global based on previous interactions
    except Organization.DoesNotExist:
        try:
            org = Organization.objects.get(slug='demo')
        except Organization.DoesNotExist:
            print("Demo org not found.")
            return

    print("🚀 PUMPING DEMO DATA FOR MAXIMUM POWER...")
    
    # 1. CRM: Loyalty & Wallet Balances
    customers = list(Contact.objects.filter(organization=org, type='CUSTOMER'))
    for cust in customers:
        cust.loyalty_points = Decimal(random.randint(500, 50000))
        cust.wallet_balance = Decimal(random.uniform(5.0, 500.0)).quantize(Decimal('0.01'))
    Contact.objects.bulk_update(customers, ['loyalty_points', 'wallet_balance'])
    print(f"💎 Upgraded {len(customers)} customers with Loyalty Points and Wallet Balances.")

    # 2. Add Pending & Overdue Invoices
    # Take 10 recent paid invoices and make them PENDING/OVERDUE to populate AR charts
    recent_invoices = list(Invoice.objects.filter(organization=org, type='SALES', status='PAID').order_by('-issue_date')[:20])
    now = timezone.now().date()
    for i, inv in enumerate(recent_invoices):
        inv.status = 'PENDING' if i % 2 == 0 else 'OVERDUE'
        inv.paid_amount = Decimal('0')
        inv.balance_due = inv.total_amount
        if inv.status == 'OVERDUE':
            inv.due_date = now - timedelta(days=random.randint(5, 30))
        else:
            inv.due_date = now + timedelta(days=random.randint(5, 30))
        
        # Remove associated payments to avoid accounting mismatches
        Payment.objects.filter(invoice=inv).delete()
    
    Invoice.objects.bulk_update(recent_invoices, ['status', 'paid_amount', 'balance_due', 'due_date'])
    print(f"⚠️ Created {len(recent_invoices)} Pending/Overdue invoices for Accounts Receivable tracking.")

    # 3. Massive B2B Wholesale Deals!
    print("📈 Injecting massive B2B wholesale deals...")
    hq_site = Site.objects.filter(organization=org).first()
    products = list(Product.objects.filter(organization=org))
    for month_offset in range(12):
        deal_date = timezone.now() - timedelta(days=30 * month_offset + random.randint(1, 15))
        cust = random.choice(customers)
        
        order = Order.objects.create(
            organization=org, type='SALE', status='COMPLETED',
            ref_code=f"B2B-WHOLESALE-{month_offset}", contact=cust, site=hq_site,
            total_amount=0, created_at=deal_date
        )
        Order.objects.filter(id=order.id).update(created_at=deal_date)
        
        total_ht = Decimal('0')
        total_ttc = Decimal('0')
        lines = []
        # Buy 5-10 products in huge quantities
        for _ in range(random.randint(5, 10)):
            p = random.choice(products)
            qty = random.randint(100, 500)
            # 20% B2B Discount
            unit_price_ht = (p.selling_price_ht * Decimal('0.8')).quantize(Decimal('0.01'))
            unit_price_ttc = (p.selling_price_ttc * Decimal('0.8')).quantize(Decimal('0.01'))
            line_ttc = qty * unit_price_ttc
            
            lines.append(OrderLine(
                organization=org, order=order, product=p,
                quantity=qty, unit_price=unit_price_ttc, total=line_ttc))
            
            total_ht += qty * unit_price_ht
            total_ttc += line_ttc
            
        OrderLine.objects.bulk_create(lines)
        Order.objects.filter(id=order.id).update(total_amount=total_ttc)
        
        # Big Invoice
        inv = Invoice.objects.create(
            organization=org, type='SALES', sub_type='WHOLESALE',
            invoice_number=f"INV-B2B-{month_offset}",
            contact=cust, contact_name=cust.name,
            site=hq_site, source_order=order,
            issue_date=deal_date.date(), due_date=deal_date.date() + timedelta(days=60),
            payment_terms='NET_60', payment_terms_days=60,
            subtotal_ht=total_ht, tax_amount=total_ttc - total_ht,
            total_amount=total_ttc, paid_amount=total_ttc,
            balance_due=Decimal('0'), display_mode='TTC',
            status='PAID', paid_at=deal_date
        )
        
        for j, l in enumerate(lines):
            InvoiceLine.objects.create(
                organization=org, invoice=inv, product=l.product,
                description=l.product.name, quantity=l.quantity,
                unit_price=l.unit_price, tax_rate=l.product.tva_rate,
                line_total_ht=l.quantity * (l.unit_price / Decimal('1.11')), # Approx ht
                tax_amount=l.total - (l.quantity * (l.unit_price / Decimal('1.11'))),
                line_total_ttc=l.total,
                unit_cost=l.product.cost_price, sort_order=j
            )
            
    # Skip POS Sessions since the model doesn't exist

    print("✅ PUMP COMPLETE! The demo is now extremely powerful.")

if __name__ == '__main__':
    pump_data()
