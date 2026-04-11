import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import BusinessType, GlobalCurrency

def seed():
    # Seed Business Types
    types = ['Retail', 'Service', 'Manufacturing', 'Wholesale', 'Other']
    for t in types:
        BusinessType.objects.get_or_create(name=t, slug=t.lower())
    
    # Seed Currencies
    currencies = [
        ('US Dollar', 'USD', '$'),
        ('Euro', 'EUR', '€'),
        ('Lebanese Lira', 'LBP', 'L.L.')
    ]
    for name, code, sym in currencies:
        GlobalCurrency.objects.get_or_create(name=name, code=code, symbol=sym)
        
    print("Seeding Complete")

if __name__ == "__main__":
    seed()
