import os
import django

# Set settings module before anything else
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import User, Organization

org = Organization.objects.filter(slug='saas').first()
if not org:
    org = Organization.objects.create(name='SaaS Admin', slug='saas')

if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@tsf.ci', 'admin123', organization=org)
    print("Superuser 'admin' created successfully.")
else:
    print("Superuser 'admin' already exists.")
