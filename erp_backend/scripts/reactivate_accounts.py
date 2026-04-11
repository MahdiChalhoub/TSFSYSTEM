import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.finance.models.coa_models import ChartOfAccount
from erp.models import Organization

org = Organization.objects.first()
print(f"Org: {org.name}")

# Find deactivated accounts
inactive = ChartOfAccount.objects.filter(organization=org, is_active=False)
print(f"\nDeactivated accounts: {inactive.count()}")
for a in inactive[:20]:
    print(f"  {a.code} | {a.name} | Balance: {a.balance}")

# Reactivate all
if inactive.count() > 0:
    updated = inactive.update(is_active=True)
    print(f"\n✅ Reactivated {updated} accounts")
else:
    print("\nAll accounts are already active.")
