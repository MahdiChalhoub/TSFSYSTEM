
import os
import django
import uuid

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.apps import apps
from django.contrib.auth import get_user_model

def reset():
    print("🧹 System Reset and Core Seeding Starting...")
    
    Organization = apps.get_model('erp', 'Organization')
    Module = apps.get_model('erp', 'Module')
    User = get_user_model()
    
    # 1. Create SAAS Organization
    # This is the "First Organization" as requested by user.
    saas_org, created = Organization.objects.get_or_create(
        slug='saas',
        defaults={
            'name': 'SAAS Platform',
            'is_active': True
        }
    )
    print(f"🏢 SaaS Organization created: {saas_org.name}")
    
    # 2. Create Superuser (Commander)
    admin_email = 'commander@tsf.saas'
    admin_username = 'commander'
    admin_password = os.environ.get('COMMANDER_PASSWORD', 'password123')
    if admin_password == 'password123':
        print("⚠️  WARNING: Using default password. Set COMMANDER_PASSWORD env var in production.")
    
    user = User.objects.filter(username=admin_username).first()
    if not user:
        user = User.objects.create_superuser(
            username=admin_username,
            email=admin_email,
            password=admin_password
        )
        print(f"👤 System Commander Created: {admin_email}")
    else:
        print(f"👤 Commander '{admin_username}' already exists, resetting credentials...")
        user.set_password(admin_password) # Explicitly reset password
    
    # Ensure Commander is linked to management ORG and has full permissions
    user.name = 'System Commander'
    user.is_active = True
    user.is_staff = True
    user.is_superuser = True
    user.organization = saas_org # CRITICAL: Link to SaaS org for TenantAuthBackend
    
    # Create a Default Site for the SaaS Org
    Site = apps.get_model('erp', 'Site')
    hq_site, _ = Site.objects.get_or_create(
        organization=saas_org,
        code='HQ-SAAS',
        defaults={'name': 'SaaS Command Center', 'is_active': True}
    )
    user.home_site = hq_site
    user.save()
    
    print(f"✅ Commander Verified: User '{admin_username}' / '{admin_password}'")
    print(f"📍 Primary Uplink: {hq_site.name}")

    # 3. Sync Modules from Filesystem
    from erp.module_manager import ModuleManager
    codes = ModuleManager.sync()
    print(f"📦 Modules Synced: {len(codes)} modules found")
    
    # 4. Auto-install Core modules for SaaS org if needed
    for m_code in codes:
        try:
            ModuleManager.install(m_code, saas_org.id)
            print(f"✅ Pre-installed {m_code} for SaaS Panel")
        except Exception as e:
            print(f"⚠️ Failed to auto-install {m_code}: {e}")

    print("✨ System Reset Complete. Database is fresh with SaaS Org and Commander User.")

if __name__ == '__main__':
    reset()
