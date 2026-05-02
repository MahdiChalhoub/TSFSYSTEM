# Generated manually on 2026-03-07
"""
Data migration to fix NULL organization issue in Brand and Category models.
Migration 0012 changed organization → organization but didn't populate existing data.
"""
from django.db import migrations


def populate_organization_from_organization(apps, schema_editor):
    """
    Set organization = first organization for all records with NULL organization.
    This ensures existing data survives the constraint migration.
    """
    Organization = apps.get_model('erp', 'Organization')
    Brand = apps.get_model('inventory', 'Brand')
    Category = apps.get_model('inventory', 'Category')
    Parfum = apps.get_model('inventory', 'Parfum')
    Unit = apps.get_model('inventory', 'Unit')

    # Get the first organization (default organization)
    try:
        default_org = Organization.objects.first()
        if not default_org:
            print("⚠ No organization found - cannot fix NULL tenants")
            return

        # Fix Brands with NULL organization
        brands_updated = Brand.objects.filter(tenant__isnull=True).update(organization=default_org)
        print(f"✓ Fixed {brands_updated} brands with NULL organization")

        # Fix Categories with NULL organization
        categories_updated = Category.objects.filter(tenant__isnull=True).update(organization=default_org)
        print(f"✓ Fixed {categories_updated} categories with NULL organization")

        # Fix Parfums with NULL organization
        parfums_updated = Parfum.objects.filter(tenant__isnull=True).update(organization=default_org)
        print(f"✓ Fixed {parfums_updated} parfums with NULL organization")

        # Fix Units with NULL organization — handle duplicate codes
        null_units = list(Unit.objects.filter(tenant__isnull=True))
        units_fixed = 0
        units_skipped = 0
        for unit in null_units:
            # Check if a unit with this code + organization already exists
            exists = Unit.objects.filter(code=unit.code, organization=default_org).exists()
            if exists:
                unit.delete()
                units_skipped += 1
            else:
                unit_organization = default_org
                unit.save(update_fields=['organization'])
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
        migrations.RunPython(populate_organization_from_organization, reverse_code=migrations.RunPython.noop),
    ]
