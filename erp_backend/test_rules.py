import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp.settings')
django.setup()
from erp.services import ConfigurationService
from apps.finance.models import ChartOfAccount
from erp.models import Organization

org = Organization.objects.get(slug='saas')
rules = ConfigurationService.get_posting_rules(org)
print(rules)

def check_account(name, acc_id):
    if not acc_id:
        return
    try:
        ChartOfAccount.objects.get(id=acc_id)
        print(f"OK: {name} ({acc_id})")
    except ChartOfAccount.DoesNotExist:
        print(f"FAIL: {name} ({acc_id}) does not exist!")

check_account("sales.revenue", rules.get('sales', {}).get('revenue'))
check_account("sales.inventory", rules.get('sales', {}).get('inventory'))
check_account("sales.cogs", rules.get('sales', {}).get('cogs'))
check_account("sales.receivable", rules.get('sales', {}).get('receivable'))
check_account("sales.discount", rules.get('sales', {}).get('discount'))
check_account("purchases.tax", rules.get('purchases', {}).get('tax'))
