"""
Force-reset SaaS admin credentials to admin/admin.
This is a one-time data migration that ensures the admin user exists
with the correct password, regardless of previous state.
"""
from django.db import migrations


def force_reset_admin(apps, schema_editor):
    Organization = apps.get_model('erp', 'Organization')
    User = apps.get_model('erp', 'User')

    # Get or create the SaaS org
    org = Organization.objects.filter(slug='saas').first()
    if not org:
        print("⚠️  No SaaS organization found, skipping admin reset")
        return

    # Find or create admin user in the saas org
    admin = User.objects.filter(username='admin', organization=org).first()
    
    if not admin:
        # Also check for the old 'commander' user and rename it
        commander = User.objects.filter(username='commander', organization=org).first()
        if commander:
            commander.username = 'admin'
            commander.email = 'admin@tsf.saas'
            admin = commander
        else:
            # Create brand new admin user
            admin = User(
                username='admin',
                email='admin@tsf.saas',
                organization=org,
            )

    # Force set all fields
    admin.is_superuser = True
    admin.is_staff = True
    admin.is_active = True
    admin.organization = org

    # set_password hashes properly via Django's AbstractBaseUser
    admin.set_password('admin')
    admin.save()
    print(f"✅ Admin user 'admin' credentials force-reset (org: {org.slug})")


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(force_reset_admin, migrations.RunPython.noop),
    ]
