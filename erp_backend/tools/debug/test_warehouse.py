import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "erp.settings")
django.setup()

from apps.inventory.models import Warehouse
from erp.models import Organization, Site
from apps.finance.models import TransactionSequence

org = Organization.objects.first()
site = Site.objects.filter(organization=org).first()

code = TransactionSequence.next_value(org, 'WAREHOUSE')
print(f"Generated code: {code}")

try:
    wh = Warehouse.objects.create(
        organization=org,
        site=site,
        name="Test Auto Warehouse 3",
        code=code,
        can_sell=True,
        type="PHYSICAL",
        is_active=True
    )
    print(f"Success! Created warehouse: {wh.name} with code: {wh.code}")
    wh.delete()
except Exception as e:
    print(f"Failed: {e}")
