import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import PlanCategory, SubscriptionPayment, SubscriptionPlan

def verify_access():
    print(f"Current DB: {os.environ.get('DB_NAME')}")
    try:
        count = PlanCategory.objects.count()
        print(f"PlanCategory count: {count}")
    except Exception as e:
        print(f"PlanCategory ORM error: {e}")

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM plancategory")
            count = cursor.fetchone()[0]
            print(f"PlanCategory SQL count: {count}")
    except Exception as e:
        print(f"PlanCategory SQL error: {e}")

    try:
        count = SubscriptionPayment.objects.count()
        print(f"SubscriptionPayment count: {count}")
    except Exception as e:
        print(f"SubscriptionPayment ORM error: {e}")

if __name__ == "__main__":
    verify_access()
