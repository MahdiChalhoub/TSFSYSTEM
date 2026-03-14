import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.pos.services.pos_service import POSService
from apps.inventory.models import Product, Warehouse
from apps.organizations.models import Organization
from django.contrib.auth import get_user_model

try:
    User = get_user_model()
    # Assuming user 1 and org 1 exist
    org = Organization.objects.first()
    user = User.objects.filter(organizations=org).first()
    warehouse = Warehouse.objects.filter(organization=org).first()
    product = Product.objects.filter(organization=org, stock__gt=0).first()

    if not all([org, user, warehouse, product]):
        print("Missing prerequisites for checkout test.")
    else:
        # Mock payment account id
        from apps.finance.models import FinancialAccount
        payment_acc = FinancialAccount.objects.filter(organization=org).first()
        payment_acc_id = payment_acc.id if payment_acc else 1

        print(f"Testing checkout with product: {product.name} at price {product.selling_price_ttc}")

        result = POSService.checkout(
            organization=org,
            user=user,
            warehouse=warehouse,
            payment_account_id=payment_acc_id,
            items=[{
                'product_id': product.id,
                'quantity': '1',
                'unit_price': str(product.selling_price_ttc or 100),
                'discount_rate': '15' # 15% discount
            }],
            total_amount=float(product.selling_price_ttc or 100) * 0.85, # 15% off
            scope='OFFICIAL'
        )
        print("Checkout Result:", result)

except Exception as e:
    import traceback
    traceback.print_exc()

