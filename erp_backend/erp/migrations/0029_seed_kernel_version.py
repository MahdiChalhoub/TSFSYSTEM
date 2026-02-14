"""
Seed baseline kernel version for Blanc Engine.
This ensures the kernel version is tracked from the start.
"""
from django.db import migrations
from django.utils import timezone


def seed_baseline_version(apps, schema_editor):
    SystemUpdate = apps.get_model('erp', 'SystemUpdate')
    
    # Check if any version is already applied
    if not SystemUpdate.objects.filter(is_applied=True).exists():
        # Seed the baseline version with only basic fields
        SystemUpdate.objects.create(
            version='1.2.9',
            changelog='Blanc Engine v1.2.9 - Package Storage & Deployment Center',
            release_date=timezone.now(),
            is_applied=True,
            applied_at=timezone.now()
        )
        print("✅ Seeded baseline kernel version: 1.2.9")


def rollback(apps, schema_editor):
    SystemUpdate = apps.get_model('erp', 'SystemUpdate')
    SystemUpdate.objects.filter(version='1.2.9').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('erp', '0028_packageupload'),
    ]

    operations = [
        migrations.RunPython(seed_baseline_version, rollback),
    ]
