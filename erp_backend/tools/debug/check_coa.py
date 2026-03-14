import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp.settings')
django.setup()

from apps.finance.models import ChartOfAccount
for c in ChartOfAccount.objects.all()[:5]:
    print(f"ID: {c.id} Code: {c.code} Name: {c.name} is_active: {c.is_active} parent_id: {c.parent_id}")
