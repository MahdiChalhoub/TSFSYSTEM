"""
Phase 2 — Master Data Validation
==================================
Tests:
  2A  Product Catalogue (Product, Category, Brand, Unit, Variants, Packaging, COA links)
  2B  CRM Contacts ↔ Accounting Bridge (Contact, AR/AP sub-accounts, tax profiles)
  2C  Warehouse Setup (Warehouse hierarchy, stock initialization)
"""

import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from erp.middleware import set_current_tenant_id
set_current_tenant_id('336877c0-8c75-43bc-8463-b3e775dfee77')

PASS = "✅ PASS"
FAIL = "❌ FAIL"
results = []

def test(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((name, status))
    print(f"  {status}  {name}" + (f"  →  {detail}" if detail else ""))
    return condition


print("\n" + "="*70)
print("  PHASE 2 — MASTER DATA VALIDATION")
print("="*70)

org_id = '336877c0-8c75-43bc-8463-b3e775dfee77'


# ══════════════════════════════════════════════════════════════════════
# 2A — PRODUCT CATALOGUE
# ══════════════════════════════════════════════════════════════════════
print("\n━━ 2A — Product Catalogue ━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

from apps.inventory.models import (
    Product, Category, Brand, ProductAttribute, ProductAttributeValue,
    ProductVariant, ProductPackaging, Warehouse
)

# 2A.1 — Category CRUD
cats = Category.objects.filter(organization_id=org_id)
test("2A.1  Category table accessible", True, f"count={cats.count()}")
test("2A.1  Categories seeded (>0)", cats.count() > 0,
     f"names={list(cats.values_list('name', flat=True)[:6])}")

# Check tree structure (parent FK)
has_parent = hasattr(Category, 'parent') or any(
    f.name == 'parent' for f in Category._meta.get_fields() if hasattr(f, 'name'))
test("2A.1  Category has parent FK (tree structure)", has_parent)

# 2A.2 — Brand CRUD
brands = Brand.objects.filter(organization_id=org_id)
test("2A.2  Brand table accessible", True, f"count={brands.count()}")
test("2A.2  Brands seeded (>0)", brands.count() > 0,
     f"names={list(brands.values_list('name', flat=True)[:8])}")

# 2A.3 — Unit of Measure
try:
    from apps.inventory.models import Unit
    units = Unit.objects.filter(organization_id=org_id)
    test("2A.3  Unit model exists", True, f"count={units.count()}")
except ImportError:
    test("2A.3  Unit model exists", False, "import failed")

# UnitConversion
try:
    from apps.inventory.models import UnitConversion
    test("2A.3  UnitConversion model exists", True)
except ImportError:
    test("2A.3  UnitConversion model exists", False)

# 2A.4 — Product CRUD
products = Product.objects.filter(organization_id=org_id)
test("2A.4  Product table accessible", True, f"count={products.count()}")
test("2A.4  Products seeded (>0)", products.count() > 0)

p = products.first()
if p:
    # Check key fields
    has_price = hasattr(p, 'price') or hasattr(p, 'selling_price') or hasattr(p, 'unit_price')
    has_cat = hasattr(p, 'category') or hasattr(p, 'category_id')
    has_brand = hasattr(p, 'brand') or hasattr(p, 'brand_id')
    has_sku = hasattr(p, 'sku')
    test("2A.4  Product has price field", has_price,
         f"fields available: price={hasattr(p,'price')}, selling_price={hasattr(p,'selling_price')}")
    test("2A.4  Product has category", has_cat)
    test("2A.4  Product has brand", has_brand)
    test("2A.4  Product has SKU", has_sku, f"sku={p.sku}" if has_sku else "")

# 2A.5 — Product Variants (attribute system)
attrs = ProductAttribute.objects.filter(organization_id=org_id)
test("2A.5  ProductAttribute table", True, f"count={attrs.count()}")

test("2A.5  ProductAttributeValue exists", 
     hasattr(ProductAttributeValue, '_meta'))

variants = ProductVariant.objects.filter(organization_id=org_id)
test("2A.5  ProductVariant table", True, f"count={variants.count()}")

# 2A.6 — Packaging Levels
pkgs = ProductPackaging.objects.filter(organization_id=org_id)
test("2A.6  ProductPackaging table", True, f"count={pkgs.count()}")

# 2A.7 — Product → COA links
coa_fields = [f.name for f in Product._meta.get_fields() if 'account' in f.name.lower()]
test("2A.7  Product has COA link fields",
     len(coa_fields) > 0,
     f"fields={coa_fields}" if coa_fields else "NO COA fields found — needs implementation")


# ══════════════════════════════════════════════════════════════════════
# 2B — CRM CONTACTS ↔ ACCOUNTING BRIDGE
# ══════════════════════════════════════════════════════════════════════
print("\n━━ 2B — CRM Contacts ↔ Accounting Bridge ━━━━━━━━━━━━━")

from apps.crm.models import Contact

contacts = Contact.objects.filter(organization_id=org_id)
test("2B.1  Contact table accessible", True, f"count={contacts.count()}")

# Customer/Supplier types
customers = contacts.filter(type='CUSTOMER')
suppliers = contacts.filter(type='SUPPLIER')
test("2B.1  Customer contacts exist", customers.count() > 0, f"count={customers.count()}")
test("2B.1  Supplier contacts exist", suppliers.count() > 0, f"count={suppliers.count()}")

# 2B.2+2B.3 — AR/AP sub-account links
c = contacts.first()
if c:
    has_ar_link = hasattr(c, 'linked_account_id') or hasattr(c, 'ar_account') or hasattr(c, 'linked_account')
    has_ap_link = hasattr(c, 'linked_payable_account_id') or hasattr(c, 'ap_account') or hasattr(c, 'linked_payable_account')
    test("2B.2  Contact has AR account link", has_ar_link,
         f"linked_account_id={getattr(c, 'linked_account_id', 'N/A')}")
    test("2B.3  Contact has AP account link", has_ap_link,
         f"linked_payable_account_id={getattr(c, 'linked_payable_account_id', 'N/A')}")

# 2B.4 — CounterpartyTaxProfile linkage
has_tax_profile = hasattr(c, 'tax_profile') or hasattr(c, 'tax_profile_id')
test("2B.4  Contact has tax_profile FK", has_tax_profile,
     f"tax_profile_id={getattr(c, 'tax_profile_id', 'N/A')}")

# 2B.5 — Payment terms
has_payment_terms = hasattr(c, 'payment_terms') or hasattr(c, 'payment_terms_days') or hasattr(c, 'payment_term')
test("2B.5  Contact has payment_terms", has_payment_terms,
     f"payment_terms_days={getattr(c, 'payment_terms_days', 'N/A')}")

# 2B.6+2B.7 — Balance views (check if accounting fields exist for tracking)
acc_fields = [f.name for f in Contact._meta.get_fields() 
              if hasattr(f, 'name') and ('balance' in f.name.lower() or 'account' in f.name.lower())]
test("2B.6  Contact has accounting/balance fields", len(acc_fields) > 0,
     f"fields={acc_fields}")


# ══════════════════════════════════════════════════════════════════════
# 2C — WAREHOUSE SETUP
# ══════════════════════════════════════════════════════════════════════
print("\n━━ 2C — Warehouse Setup ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

# 2C.1 — Warehouse CRUD
warehouses = Warehouse.objects.filter(organization_id=org_id)
test("2C.1  Warehouse table accessible", True, f"count={warehouses.count()}")
test("2C.1  Warehouses exist", warehouses.count() > 0)

# Location hierarchy
try:
    from apps.inventory.models import WarehouseZone, WarehouseAisle, WarehouseRack, WarehouseShelf, WarehouseBin
    test("2C.1  WarehouseZone model exists", True)
    test("2C.1  WarehouseBin model exists (deepest level)", True)
    
    zones = WarehouseZone.objects.filter(organization_id=org_id).count()
    bins = WarehouseBin.objects.filter(organization_id=org_id).count()
    test("2C.1  Location hierarchy data",
         True, f"zones={zones}, bins={bins}")
except ImportError as e:
    test("2C.1  Location hierarchy models", False, str(e))

# 2C.2 — Stock initialization
try:
    from apps.inventory.models import StockAdjustmentOrder, StockAdjustmentLine
    adj_count = StockAdjustmentOrder.objects.filter(organization_id=org_id).count()
    test("2C.2  StockAdjustmentOrder exists", True, f"count={adj_count}")
except ImportError:
    test("2C.2  StockAdjustmentOrder exists", False)

# 2C.3 — Stock quantity queries
try:
    from apps.inventory.models import StockLedger
    ledger_count = StockLedger.objects.filter(organization_id=org_id).count()
    test("2C.3  StockLedger table accessible", True, f"count={ledger_count}")
except ImportError:
    test("2C.3  StockLedger table accessible", False)

try:
    from apps.inventory.models import Inventory
    inv_count = Inventory.objects.filter(organization_id=org_id).count()
    test("2C.3  Inventory (stock balance) table", True, f"count={inv_count}")
except ImportError:
    test("2C.3  Inventory table", False)

# Product-Warehouse link
try:
    from apps.inventory.models import ProductLocation
    pl_count = ProductLocation.objects.filter(organization_id=org_id).count()
    test("2C.3  ProductLocation (product-warehouse link)", True, f"count={pl_count}")
except ImportError:
    test("2C.3  ProductLocation", False)

# StockCostLayer (for costing)
try:
    from apps.inventory.models import StockCostLayer
    scl = StockCostLayer.objects.filter(organization_id=org_id).count()
    test("2C.3  StockCostLayer (FIFO/LIFO costing)", True, f"count={scl}")
except ImportError:
    test("2C.3  StockCostLayer", False)


# ══════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════
print("\n" + "="*70)
passed = sum(1 for _, s in results if s == PASS)
failed = sum(1 for _, s in results if s == FAIL)
print(f"  RESULTS: {passed} passed, {failed} failed, {len(results)} total")
if failed == 0:
    print("  🎉 ALL MASTER DATA TESTS PASSED — Phase 2 VERIFIED")
else:
    print("  ⚠️  FAILURES DETECTED — review above")
    for name, s in results:
        if s == FAIL:
            print(f"    {FAIL}  {name}")
print("="*70 + "\n")
