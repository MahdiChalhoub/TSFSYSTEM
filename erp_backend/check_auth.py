import django, os, sys
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from erp.models import User, Organization

# Find admin and reset password
admin = User.objects.get(username='admin')
admin.set_password('admin123')

# Also assign to 'saas' org if exists and admin has no org
saas_org = Organization.objects.filter(slug='saas').first()
if saas_org and admin.organization_id is None:
    admin.organization = saas_org
    print(f"Assigned admin to saas org (id={saas_org.id})")

admin.save()
print(f"Password reset for admin (id={admin.id})")
print(f"check_password('admin123') = {admin.check_password('admin123')}")
