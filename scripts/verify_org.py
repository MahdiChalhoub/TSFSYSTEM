import os, sys, django
sys.path.insert(0, '/root/TSFSYSTEM/erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE','erp.settings')
django.setup()
from erp.models import Organization, User
from django.contrib.auth import authenticate

# Check SaaS org ID
saas_org = Organization.objects.get(slug='saas')
print('SAAS_ORG_ID:', saas_org.id)

# Check all users
users = User.objects.filter(organization=saas_org)
for u in users:
    print(f'USER: {u.username} | staff={u.is_staff} | super={u.is_superuser} | active={u.is_active} | org={u.organization_id}')

# Try authenticate
test_user = authenticate(username='admin', password='Mahdi@2025')
print('AUTH_RESULT:', test_user)
if test_user:
    print(f'AUTH_USER_ORG: {test_user.organization_id}')

# Check all orgs
for o in Organization.objects.all():
    user_count = User.objects.filter(organization=o).count()
    print(f'ORG: {o.name} (slug={o.slug}, id={o.id}) | users={user_count}')
