import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from datetime import date
from apps.finance.models.fiscal_models import FiscalYear, FiscalPeriod
from erp.models import Organization

org = Organization.objects.first()
print(f"Org: {org.name}")

# Check existing fiscal years
existing = FiscalYear.objects.filter(organization=org)
print(f"Existing fiscal years: {existing.count()}")
for fy in existing:
    print(f"  {fy.name}: {fy.start_date} → {fy.end_date} (status: {fy.status})")

# Create 2026 fiscal year if missing
fy2026, created = FiscalYear.objects.get_or_create(
    organization=org,
    name='FY 2026',
    defaults={
        'start_date': date(2026, 1, 1),
        'end_date': date(2026, 12, 31),
        'status': 'OPEN',
    }
)
if created:
    print(f"✅ Created FY 2026")
else:
    print(f"FY 2026 already exists (status: {fy2026.status})")
    if fy2026.status != 'OPEN':
        fy2026.status = 'OPEN'
        fy2026.save(update_fields=['status'])
        print(f"  → Reopened FY 2026")

# Create monthly periods
import calendar
for month in range(1, 13):
    last_day = calendar.monthrange(2026, month)[1]
    period_name = f"{calendar.month_name[month]} 2026"
    period, pcreated = FiscalPeriod.objects.get_or_create(
        organization=org,
        fiscal_year=fy2026,
        name=period_name,
        defaults={
            'start_date': date(2026, month, 1),
            'end_date': date(2026, month, last_day),
            'status': 'OPEN',
        }
    )
    if pcreated:
        print(f"  ✅ Created period: {period_name}")

print(f"\nTotal periods for FY 2026: {FiscalPeriod.objects.filter(fiscal_year=fy2026).count()}")
print("Done!")
