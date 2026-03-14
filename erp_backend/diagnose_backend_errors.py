#!/usr/bin/env python
"""
Backend Endpoint Diagnostic Script
===================================
Tests the three failing endpoints to identify root causes:
1. inventory/brands/ → 500 error
2. inventory/categories/ → 500 error
3. client-portal/shipping-rates/ → 404 error
"""
import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'erp_backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db.models import Count
from apps.inventory.models import Brand, Category
from apps.client_portal.models import ShippingRate
from erp.models import Organization

def test_brands():
    """Test Brand model and endpoint"""
    print("\n" + "="*60)
    print("TEST 1: INVENTORY BRANDS")
    print("="*60)

    # Test 1: Can we query Brand at all?
    try:
        brands = Brand.objects.all()
        print(f"✓ Brand.objects.all() works: {brands.count()} brands found")
    except Exception as e:
        print(f"✗ Brand.objects.all() FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return

    # Test 2: Can we filter by organization?
    try:
        org = Organization.objects.first()
        if org:
            tenant_brands = Brand.objects.filter(organization=org)
            print(f"✓ Tenant filter works: {tenant_brands.count()} brands for organization '{org.name}'")
        else:
            print("⚠ No organizations found in database")
    except Exception as e:
        print(f"✗ Tenant filter FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")

    # Test 3: Check for duplicate brand names (constraint violation)
    try:
        duplicates = Brand.objects.values('name', 'organization').annotate(count=Count('id')).filter(count__gt=1)
        if duplicates:
            print(f"⚠ CONSTRAINT VIOLATION: Found {len(duplicates)} duplicate brand names")
            for dup in list(duplicates)[:5]:
                print(f"  - Brand '{dup['name']}' has {dup['count']} entries for same organization")
        else:
            print("✓ No duplicate brands found (constraint is valid)")
    except Exception as e:
        print(f"✗ Duplicate check FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")

    # Test 4: Check for brands without organization (NULL organization)
    try:
        no_tenant = Brand.objects.filter(tenant__isnull=True)
        if no_tenant.exists():
            print(f"⚠ TENANT ISSUE: Found {no_tenant.count()} brands with NULL organization")
        else:
            print("✓ All brands have valid organization")
    except Exception as e:
        print(f"✗ NULL organization check FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")

    # Test 5: Try to access serializer
    try:
        from apps.inventory.serializers import BrandSerializer
        if brands.exists():
            serializer = BrandSerializer(brands.first())
            print(f"✓ BrandSerializer works")
        else:
            print("⚠ No brands to test serializer with")
    except Exception as e:
        print(f"✗ BrandSerializer FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")

def test_categories():
    """Test Category model and endpoint"""
    print("\n" + "="*60)
    print("TEST 2: INVENTORY CATEGORIES")
    print("="*60)

    # Test 1: Can we query Category at all?
    try:
        categories = Category.objects.all()
        print(f"✓ Category.objects.all() works: {categories.count()} categories found")
    except Exception as e:
        print(f"✗ Category.objects.all() FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return

    # Test 2: Can we filter by organization?
    try:
        org = Organization.objects.first()
        if org:
            tenant_categories = Category.objects.filter(organization=org)
            print(f"✓ Tenant filter works: {tenant_categories.count()} categories for organization '{org.name}'")
        else:
            print("⚠ No organizations found in database")
    except Exception as e:
        print(f"✗ Tenant filter FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")

    # Test 3: Check for duplicate category names (constraint violation)
    try:
        duplicates = Category.objects.values('name', 'organization').annotate(count=Count('id')).filter(count__gt=1)
        if duplicates:
            print(f"⚠ CONSTRAINT VIOLATION: Found {len(duplicates)} duplicate category names")
            for dup in list(duplicates)[:5]:
                print(f"  - Category '{dup['name']}' has {dup['count']} entries for same organization")
        else:
            print("✓ No duplicate categories found (constraint is valid)")
    except Exception as e:
        print(f"✗ Duplicate check FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")

    # Test 4: Check for categories without organization (NULL organization)
    try:
        no_tenant = Category.objects.filter(tenant__isnull=True)
        if no_tenant.exists():
            print(f"⚠ TENANT ISSUE: Found {no_tenant.count()} categories with NULL organization")
        else:
            print("✓ All categories have valid organization")
    except Exception as e:
        print(f"✗ NULL organization check FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")

    # Test 5: Try to access serializer
    try:
        from apps.inventory.serializers import CategorySerializer
        if categories.exists():
            serializer = CategorySerializer(categories.first())
            print(f"✓ CategorySerializer works")
        else:
            print("⚠ No categories to test serializer with")
    except Exception as e:
        print(f"✗ CategorySerializer FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")

def test_shipping_rates():
    """Test ShippingRate model and endpoint"""
    print("\n" + "="*60)
    print("TEST 3: CLIENT PORTAL SHIPPING RATES")
    print("="*60)

    # Test 1: Does the model exist?
    try:
        rates = ShippingRate.objects.all()
        print(f"✓ ShippingRate.objects.all() works: {rates.count()} rates found")
    except Exception as e:
        print(f"✗ ShippingRate.objects.all() FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return

    # Test 2: Check ViewSet registration
    try:
        from apps.client_portal import views
        if hasattr(views, 'ShippingRateViewSet'):
            print(f"✓ ShippingRateViewSet exists in views module")
        else:
            print(f"✗ ShippingRateViewSet NOT FOUND in views module")
            print(f"  Available ViewSets: {[x for x in dir(views) if 'ViewSet' in x]}")
    except Exception as e:
        print(f"✗ ViewSet check FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")

    # Test 3: Check URL registration
    try:
        from django.urls import get_resolver
        resolver = get_resolver()
        url_patterns = [p.pattern._route for p in resolver.url_patterns if hasattr(p.pattern, '_route')]

        # Check if shipping-rates is in the URL patterns
        shipping_found = any('shipping-rates' in str(p) for p in url_patterns)
        if shipping_found:
            print(f"✓ 'shipping-rates' route found in URL patterns")
        else:
            print(f"✗ 'shipping-rates' route NOT FOUND in URL patterns")
    except Exception as e:
        print(f"✗ URL check FAILED:")
        print(f"  Error: {type(e).__name__}: {e}")

def main():
    print("\n" + "#"*60)
    print("# BACKEND ENDPOINT DIAGNOSTIC REPORT")
    print("# Testing 3 failing endpoints")
    print("#"*60)

    test_brands()
    test_categories()
    test_shipping_rates()

    print("\n" + "#"*60)
    print("# DIAGNOSTIC COMPLETE")
    print("#"*60)
    print("\nNext Steps:")
    print("1. If constraint violations found → Fix duplicate data")
    print("2. If organization issues found → Run data migration")
    print("3. If ViewSet/URL issues → Check imports and registration")
    print("4. If serializer issues → Check field definitions")

if __name__ == '__main__':
    main()
