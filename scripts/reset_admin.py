import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
from erp.models import Organization

org = Organization.objects.filter(slug="saas").first()
print(f"SaaS org: {org}")

# List existing users in saas org
users = User.objects.filter(organization=org)
for u in users:
    print(f"  User: {u.username} active={u.is_active} staff={u.is_staff} super={u.is_superuser}")

# Reset or create admin user
admin = User.objects.filter(username="admin", organization=org).first()
if not admin:
    admin = User.objects.filter(username="commander", organization=org).first()
    if admin:
        admin.username = "admin"
        print("Renamed commander -> admin")
    else:
        admin = User(username="admin", organization=org)
        print("Created new admin user")
else:
    print("Found existing admin user")

admin.set_password("admin")
admin.is_superuser = True
admin.is_staff = True
admin.is_active = True
admin.email = "admin@tsf.saas"
admin.save()
print(f"Done! Admin user id={admin.pk} username={admin.username}")
print(f"Password verify: {admin.check_password('admin')}")
