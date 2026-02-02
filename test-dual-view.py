import os
import django
import sys
from decimal import Decimal

# Setup Django Environment
sys.path.append('C:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import Organization, ChartOfAccount, Site
from erp.services import LedgerService, ProvisioningService

def test_dual_view_reporting():
    print("--- Testing Dual-View Reporting Logic ---")
    
    # 1. Setup Organization
    import uuid
    org_slug = f"dual-test-{uuid.uuid4().hex[:8]}"
    org = ProvisioningService.provision_organization("Dual View Corp", org_slug)
    
    # 2. Identify Accounts
    # Revenue (4100), Cash (1310), Owner Equity (3000)
    rev_acc = ChartOfAccount.objects.get(organization=org, code='4100')
    cash_acc = ChartOfAccount.objects.get(organization=org, code='1310')
    equity_acc = ChartOfAccount.objects.get(organization=org, code='3000')
    exp_acc = ChartOfAccount.objects.get(organization=org, code='5200') # Operating Expenses
    
    # 3. Post OFFICIAL Transaction (Sale: $500)
    # Debit Cash $500, Credit Revenue $500
    print("\n[Action]: Posting Official Sale of $500")
    LedgerService.create_journal_entry(
        organization=org,
        transaction_date=django.utils.timezone.now(),
        description="Official Sale",
        scope='OFFICIAL',
        status='POSTED',
        lines=[
            {"account_id": cash_acc.id, "debit": Decimal('500'), "credit": Decimal('0')},
            {"account_id": rev_acc.id, "debit": Decimal('0'), "credit": Decimal('500')}
        ]
    )
    
    # 4. Post INTERNAL Transaction (Owner Expense: $100)
    # Debit Expense $100, Credit Cash $100
    print("[Action]: Posting Internal Expense of $100")
    LedgerService.create_journal_entry(
        organization=org,
        transaction_date=django.utils.timezone.now(),
        description="Internal Lunch Expense",
        scope='INTERNAL',
        status='POSTED',
        lines=[
            {"account_id": exp_acc.id, "debit": Decimal('100'), "credit": Decimal('0')},
            {"account_id": cash_acc.id, "debit": Decimal('0'), "credit": Decimal('100')}
        ]
    )

    # 5. Verify OFFICIAL P&L
    print("\n--- OFFICIAL P&L ---")
    official_pl = LedgerService.get_profit_loss(org, scope='OFFICIAL')
    print(f"Revenue: {official_pl['revenue']}")
    print(f"Expenses: {official_pl['expenses']}")
    print(f"Net Income: {official_pl['net_income']}")
    
    assert official_pl['net_income'] == Decimal('500.00'), f"Expected 500, got {official_pl['net_income']}"
    
    # 6. Verify INTERNAL P&L
    print("\n--- INTERNAL P&L ---")
    internal_pl = LedgerService.get_profit_loss(org, scope='INTERNAL')
    print(f"Revenue: {internal_pl['revenue']}")
    print(f"Expenses: {internal_pl['expenses']}")
    print(f"Net Income: {internal_pl['net_income']}")
    
    # Net: 500 - 100 = 400
    assert internal_pl['net_income'] == Decimal('400.00'), f"Expected 400, got {internal_pl['net_income']}"

    # 7. Verify Balance Sheets
    print("\n--- OFFICIAL Balance Sheet ---")
    off_bs = LedgerService.get_balance_sheet(org, scope='OFFICIAL')
    print(f"Assets: {off_bs['assets']}")
    print(f"Balanced: {off_bs['is_balanced']}")
    assert off_bs['assets'] == Decimal('500.00')
    
    print("\n--- INTERNAL Balance Sheet ---")
    int_bs = LedgerService.get_balance_sheet(org, scope='INTERNAL')
    print(f"Assets: {int_bs['assets']}")
    print(f"Balanced: {int_bs['is_balanced']}")
    # Assets (Cash): 500 - 100 = 400
    assert int_bs['assets'] == Decimal('400.00')

    print("\n✅ Dual-View Reporting Logic verified successfully!")

if __name__ == "__main__":
    test_dual_view_reporting()
