# Generated manually on 2026-03-07
"""
Data migration to fix NULL tenant issue in Brand and Category models.
Migration 0012 changed organization → tenant but didn't populate existing data.
"""
from django.db import migrations


def populate_tenant_from_organization(apps, schema_editor):
    """
    Set tenant = first organization for all records with NULL tenant.
    This ensures existing data survives the constraint migration.
    """
    Organization = apps.get_model('erp', 'Organization')
    Brand = apps.get_model('inventory', 'Brand')
    Category = apps.get_model('inventory', 'Category')
    Parfum = apps.get_model('inventory', 'Parfum')
    Unit = apps.get_model('inventory', 'Unit')

    # Get the first organization (default tenant)
    try:
        default_org = Organization.objects.first()
        if not default_org:
            print("⚠ No organization found - cannot fix NULL tenants")
            return

        # Fix Brands with NULL tenant
        brands_updated = Brand.objects.filter(tenant__isnull=True).update(tenant=default_org)
        print(f"✓ Fixed {brands_updated} brands with NULL tenant")

        # Fix Categories with NULL tenant
        categories_updated = Category.objects.filter(tenant__isnull=True).update(tenant=default_org)
        print(f"✓ Fixed {categories_updated} categories with NULL tenant")

        # Fix Parfums with NULL tenant
        parfums_updated = Parfum.objects.filter(tenant__isnull=True).update(tenant=default_org)
        print(f"✓ Fixed {parfums_updated} parfums with NULL tenant")

        # Fix Units with NULL tenant — handle duplicate codes
        null_units = list(Unit.objects.filter(tenant__isnull=True))
        units_fixed = 0
        units_skipped = 0
        for unit in null_units:
            # Check if a unit with this code + tenant already exists
            exists = Unit.objects.filter(code=unit.code, tenant=default_org).exists()
            if exists:
                unit.delete()
                units_skipped += 1
            else:
                unit.tenant = default_org
                unit.save(update_fields=['tenant'])
                units_fixed += 1
        print(f"✓ Fixed {units_fixed} units, skipped {units_skipped} duplicates")

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0012_remove_brand_unique_brand_name_org_and_more'),
        ('erp', '0012_transactionstatuslog_meta_transactiontype_and_more'),
    ]

    operations = [
        migrations.RunPython(populate_tenant_from_organization, reverse_code=migrations.RunPython.noop),
    ]
