import os
import sys
import django

sys.path.append('c:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

print("--- Available Users ---")
users = User.objects.all()
if not users:
    print("No users found.")
else:
    for user in users:
        print(f"Username: {user.username} | Is Superuser: {user.is_superuser}")
print("----------------------------")
