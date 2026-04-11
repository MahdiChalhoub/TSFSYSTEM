"""
Inject test ledger vouchers to create COA balances for migration testing.
Run inside Django context: python3 manage.py shell < scripts/inject_test_data.py
"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from apps.finance.models.coa_models import ChartOfAccount
from apps.finance.models.ledger_models import JournalEntry, JournalEntryLine
from erp.models import User, Organization

def inject():
    org = Organization.objects.first()
    if not org:
        print("ERROR: No organization found"); return

    admin = User.objects.filter(is_superuser=True).first()
    if not admin:
        admin = User.objects.first()

    print(f"Organization: {org.name} (ID: {org.id})")
    print(f"User: {admin.email if admin else 'None'}")

    # ── Discover existing posting-enabled accounts ──
    accts = ChartOfAccount.objects.filter(organization=org, allow_posting=True, is_active=True)
    print(f"Total posting-enabled accounts: {accts.count()}")

    # ── Get accounts by type for balanced entries ──
    assets = list(accts.filter(type='ASSET')[:5])
    liabilities = list(accts.filter(type='LIABILITY')[:3])
    equity = list(accts.filter(type='EQUITY')[:3])
    income = list(accts.filter(type='INCOME')[:3])
    expenses = list(accts.filter(type='EXPENSE')[:3])

    print(f"  Assets: {len(assets)}, Liabilities: {len(liabilities)}, Equity: {len(equity)}")
    print(f"  Income: {len(income)}, Expenses: {len(expenses)}")

    if not assets or not (liabilities or equity):
        print("ERROR: Need at least 1 asset + 1 liability/equity account. Aborting.")
        return

    # ── Define test vouchers ──
    vouchers = []

    # 1. Opening Balances — Equity injection
    if equity:
        vouchers.append({
            'desc': 'Opening Balance: Owner Capital Injection',
            'type': 'OPENING',
            'lines': [
                (assets[0], Decimal('50000.00'), Decimal('0.00'), 'Cash injection from owner'),
                (equity[0], Decimal('0.00'), Decimal('50000.00'), 'Owner capital contribution'),
            ]
        })

    # 2. Sales Revenue  
    if income and assets:
        vouchers.append({
            'desc': 'Sales Invoice #INV-001 — Product Sales',
            'type': 'SALES',
            'lines': [
                (assets[0], Decimal('12500.00'), Decimal('0.00'), 'AR from customer sale'),
                (income[0], Decimal('0.00'), Decimal('12500.00'), 'Revenue recognition'),
            ]
        })

    # 3. Purchase expense
    if expenses and liabilities:
        vouchers.append({
            'desc': 'Purchase Invoice #PO-001 — Office Supplies',
            'type': 'PURCHASE',
            'lines': [
                (expenses[0], Decimal('3200.00'), Decimal('0.00'), 'Office supplies expense'),
                (liabilities[0], Decimal('0.00'), Decimal('3200.00'), 'AP to supplier'),
            ]
        })

    # 4. Payment received
    if len(assets) >= 2 and income:
        vouchers.append({
            'desc': 'Payment Received — Customer Payment on INV-001',
            'type': 'CASH',
            'lines': [
                (assets[0] if len(assets) < 2 else assets[1], Decimal('8000.00'), Decimal('0.00'), 'Cash received'),
                (assets[0], Decimal('0.00'), Decimal('8000.00'), 'AR reduction from payment'),
            ]
        })

    # 5. Inventory purchase
    if len(assets) >= 2 and liabilities:
        inv_acct = next((a for a in assets if 'inventory' in a.name.lower() or 'stock' in a.name.lower()), assets[1])
        vouchers.append({
            'desc': 'Inventory Purchase — Raw Materials',
            'type': 'PURCHASE',
            'lines': [
                (inv_acct, Decimal('15000.00'), Decimal('0.00'), 'Inventory asset increase'),
                (liabilities[0], Decimal('0.00'), Decimal('15000.00'), 'AP for inventory purchase'),
            ]
        })

    # 6. Salary expense
    if len(expenses) >= 2 and liabilities:
        vouchers.append({
            'desc': 'Payroll — March 2026 Salaries',
            'type': 'GENERAL',
            'lines': [
                (expenses[1] if len(expenses) >= 2 else expenses[0], Decimal('22000.00'), Decimal('0.00'), 'Salary expense'),
                (liabilities[0], Decimal('0.00'), Decimal('22000.00'), 'Salary payable'),
            ]
        })

    # 7. Loan received
    if liabilities and assets:
        vouchers.append({
            'desc': 'Bank Loan Received — Working Capital',
            'type': 'BANK',
            'lines': [
                (assets[0], Decimal('100000.00'), Decimal('0.00'), 'Bank deposit from loan'),
                (liabilities[-1], Decimal('0.00'), Decimal('100000.00'), 'Long-term loan liability'),
            ]
        })

    # 8. Depreciation
    if len(expenses) >= 2 and len(assets) >= 2:
        vouchers.append({
            'desc': 'Monthly Depreciation — Fixed Assets',
            'type': 'ADJUSTMENT',
            'lines': [
                (expenses[-1], Decimal('1500.00'), Decimal('0.00'), 'Depreciation expense'),
                (assets[-1], Decimal('0.00'), Decimal('1500.00'), 'Accumulated depreciation'),
            ]
        })

    print(f"\n── Injecting {len(vouchers)} vouchers ──")

    with transaction.atomic():
        for i, v in enumerate(vouchers, 1):
            total = sum(l[1] for l in v['lines'])  # sum of debits
            
            je = JournalEntry(
                organization=org,
                transaction_date=timezone.now(),
                description=v['desc'],
                status='DRAFT',
                journal_type=v['type'],
                created_by=admin,
                total_debit=total,
                total_credit=total,
                scope='OFFICIAL',
            )
            je.save()

            for acct, debit, credit, desc in v['lines']:
                JournalEntryLine(
                    organization=org,
                    journal_entry=je,
                    account=acct,
                    debit=debit,
                    credit=credit,
                    description=desc,
                ).save()

            # Post it
            je.status = 'POSTED'
            je.posted_at = timezone.now()
            je.posted_by = admin
            je.save(force_audit_bypass=True)

            # Update denormalized balances
            for acct, debit, credit, _ in v['lines']:
                acct.balance += (debit - credit)
                acct.balance_official += (debit - credit)
                acct.save(update_fields=['balance', 'balance_official'])

            print(f"  [{i}/{len(vouchers)}] JE-{je.id}: {v['desc']} (${total})")

    print(f"\n✅ Successfully injected {len(vouchers)} journal entries.")
    
    # Summary
    print("\n── Balance Summary ──")
    affected = set()
    for v in vouchers:
        for acct, _, _, _ in v['lines']:
            affected.add(acct.id)
    
    for acct in ChartOfAccount.objects.filter(id__in=affected):
        print(f"  {acct.code} | {acct.name} | Balance: {acct.balance}")

inject()
