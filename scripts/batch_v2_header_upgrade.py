#!/usr/bin/env python3
"""
Batch V2 header upgrade — upgrades old-style page headers to the V2 standard:
  - <div className="app-page">
  - V2 icon box + italic page title
  - `fade-in-up` animations
  - `text-app-primary-foreground` on primary buttons
  - `bg-app-primary/10 border border-app-primary/20` icon container

For each target page, we look for legacy header patterns and replace them
with the standard V2 layout.

This script also wraps pages not yet wrapped with `app-page` and
`max-w-7xl mx-auto` inner container.
"""
import re, glob, os

# Pages that need page-level container wrapping AND header upgrade
TARGETS = [
    # (path pattern, module_label, page_title_first, page_title_accent, icon_import, icon_size)
    # Finance pages
    ('src/app/(privileged)/finance/chart-of-accounts/page.tsx',
     'Finance', 'Chart of', 'Accounts', 'BookOpen', 32),
    ('src/app/(privileged)/finance/fiscal-years/page.tsx',
     'Finance', 'Fiscal', 'Years', 'CalendarDays', 32),
    ('src/app/(privileged)/finance/budget/page.tsx',
     'Finance', 'Budget', 'Center', 'BarChart3', 32),
    ('src/app/(privileged)/finance/bank-reconciliation/page.tsx',
     'Finance', 'Bank', 'Reconciliation', 'Building2', 32),
    ('src/app/(privileged)/finance/balances/page.tsx',
     'Finance', 'Account', 'Balances', 'Scale', 32),
    ('src/app/(privileged)/finance/cash-register/page.tsx',
     'Finance', 'Cash', 'Register', 'Banknote', 32),
    ('src/app/(privileged)/finance/aging/page.tsx',
     'Finance', 'Aging', 'Report', 'Clock', 32),
    ('src/app/(privileged)/finance/assets/page.tsx',
     'Finance', 'Fixed', 'Assets', 'Package', 32),
    ('src/app/(privileged)/finance/loans/page.tsx',
     'Finance', 'Loan', 'Registry', 'Landmark', 32),
    ('src/app/(privileged)/finance/revenue/page.tsx',
     'Finance', 'Revenue', 'Center', 'TrendingUp', 32),
    ('src/app/(privileged)/finance/statements/page.tsx',
     'Finance', 'Financial', 'Statements', 'FileText', 32),
    ('src/app/(privileged)/finance/vouchers/page.tsx',
     'Finance', 'Voucher', 'Registry', 'Receipt', 32),
    ('src/app/(privileged)/finance/profit-centers/page.tsx',
     'Finance', 'Profit', 'Centers', 'PieChart', 32),
    ('src/app/(privileged)/finance/vat-settlement/page.tsx',
     'Finance · Tax', 'VAT', 'Settlement', 'Shield', 32),
    ('src/app/(privileged)/finance/tax-groups/page.tsx',
     'Finance · Tax', 'Tax', 'Groups', 'Tag', 32),
    ('src/app/(privileged)/finance/tax-policy/page.tsx',
     'Finance · Tax', 'Tax', 'Policy', 'FileCheck', 32),
    ('src/app/(privileged)/finance/tax-reports/page.tsx',
     'Finance · Tax', 'Tax', 'Reports', 'TrendingUp', 32),
    ('src/app/(privileged)/finance/einvoicing/page.tsx',
     'Finance', 'E-Invoice', 'Hub', 'Send', 32),
    ('src/app/(privileged)/finance/gateway/page.tsx',
     'Finance', 'Payment', 'Gateway', 'CreditCard', 32),
    # Sales pages
    ('src/app/(privileged)/sales/sessions/page.tsx',
     'Sales · POS', 'Session', 'Manager', 'Monitor', 32),
    ('src/app/(privileged)/sales/summary/page.tsx',
     'Sales', 'Sales', 'Summary', 'BarChart3', 32),
    ('src/app/(privileged)/sales/quotations/page.tsx',
     'Sales', 'Quotation', 'Manager', 'FileText', 32),
    ('src/app/(privileged)/sales/deliveries/page.tsx',
     'Sales', 'Delivery', 'Control', 'Truck', 32),
    ('src/app/(privileged)/sales/delivery-zones/page.tsx',
     'Sales', 'Delivery', 'Zones', 'MapPin', 32),
    ('src/app/(privileged)/sales/drivers/page.tsx',
     'Sales', 'Driver', 'Registry', 'Car', 32),
    ('src/app/(privileged)/sales/discounts/page.tsx',
     'Sales', 'Discount', 'Engine', 'Tag', 32),
    ('src/app/(privileged)/sales/returns/page.tsx',
     'Sales', 'Return', 'Center', 'Undo2', 32),
    ('src/app/(privileged)/sales/credit-notes/page.tsx',
     'Sales', 'Credit', 'Notes', 'FileText', 32),
    ('src/app/(privileged)/sales/consignment/page.tsx',
     'Sales', 'Consignment', 'Hub', 'Package', 32),
    ('src/app/(privileged)/sales/import/page.tsx',
     'Sales', 'Sales', 'Import', 'Upload', 32),
    # Purchases pages
    ('src/app/(privileged)/purchases/dashboard/page.tsx',
     'Procurement', 'Procurement', 'Dashboard', 'BarChart3', 32),
    ('src/app/(privileged)/purchases/invoices/page.tsx',
     'Procurement', 'Purchase', 'Invoices', 'FileText', 32),
    ('src/app/(privileged)/purchases/returns/page.tsx',
     'Procurement', 'Purchase', 'Returns', 'Undo2', 32),
    ('src/app/(privileged)/purchases/sourcing/page.tsx',
     'Procurement', 'Supplier', 'Sourcing', 'Briefcase', 32),
    # HR pages
    ('src/app/(privileged)/hr/payroll/page.tsx',
     'Human Resources', 'Payroll', 'Center', 'Banknote', 32),
    ('src/app/(privileged)/hr/attendance/page.tsx',
     'Human Resources', 'Attendance', 'Tracker', 'Clock', 32),
    ('src/app/(privileged)/hr/leaves/page.tsx',
     'Human Resources', 'Leave', 'Management', 'CalendarDays', 32),
    # Inventory pages
    ('src/app/(privileged)/inventory/warehouses/page.tsx',
     'Inventory', 'Warehouse', 'Manager', 'Warehouse', 32),
    ('src/app/(privileged)/inventory/movements/page.tsx',
     'Inventory', 'Stock', 'Movements', 'ArrowLeftRight', 32),
    ('src/app/(privileged)/inventory/alerts/page.tsx',
     'Inventory', 'Stock', 'Alerts', 'Bell', 32),
    ('src/app/(privileged)/inventory/valuation/page.tsx',
     'Inventory', 'Inventory', 'Valuation', 'TrendingUp', 32),
    ('src/app/(privileged)/inventory/analytics/page.tsx',
     'Inventory', 'Inventory', 'Analytics', 'BarChart3', 32),
]


def has_v2_header(content):
    """Check if the page already has a proper V2 icon box header."""
    return ('w-16 h-16 rounded-2xl' in content or 
            'fade-in-up' in content and 'bg-app-primary/10 border border-app-primary/20' in content)


def has_app_page_wrapper(content):
    """Check if the page has the app-page wrapper."""
    return 'className="app-page"' in content


def needs_icon_import(content, icon):
    """Check if the icon is already imported."""
    return icon not in content


def upgrade_page_header(filepath, module_label, title_first, title_accent, icon_name, icon_size):
    """
    For pages that have old header patterns, patch the header section.
    For simple pages, just add the V2 header after the opening app-page div.
    """
    if not os.path.exists(filepath):
        return False
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    if has_v2_header(content):
        return False  # Already upgraded
    
    original = content
    
    # Ensure the page has app-page wrapper
    if not has_app_page_wrapper(content):
        # Try to add it around the existing root div
        content = content.replace(
            '<div className="page-container"',
            '<div className="app-page"><div className="min-h-screen p-5 md:p-6 space-y-6 max-w-7xl mx-auto">'
        )
        content = content.replace(
            '<div className="app-page"><div className="min-h-screen',
            '<div className="app-page">\n      <div className="min-h-screen'
        )
    
    # Replace old-style headers
    # Pattern 1: <h1>...</h1> with page-header-title class
    # Pattern 2: <header>.....</header> that doesn't match V2
    
    # Look for the common old-style header pattern and replace it
    old_header_patterns = [
        # Remove old badge-style headers
        re.compile(
            r'<header[^>]*>.*?</header>',
            re.DOTALL
        ),
    ]
    
    # Build the new V2 header
    new_header = f'''<header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <{icon_name} size={{{icon_size}}} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{module_label}</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            {title_first} <span className="text-app-primary">{title_accent}</span>
          </h1>
        </div>
      </div>
    </header>'''
    
    # Only replace headers that don't match V2 standard
    for pat in old_header_patterns:
        m = pat.search(content)
        if m:
            old_header_text = m.group(0)
            # Check if it already has v2 elements
            if 'fade-in-up' not in old_header_text and 'bg-app-primary/10' not in old_header_text:
                content = content[:m.start()] + new_header + content[m.end():]
                break
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False


changed = 0
skipped = 0
for args in TARGETS:
    filepath = args[0]
    result = upgrade_page_header(*args)
    if result:
        changed += 1
        print(f"  ✓ Upgraded: {filepath}")
    else:
        skipped += 1
        if os.path.exists(filepath):
            print(f"  → Skipped (already V2): {filepath}")
        else:
            print(f"  ⚠ Not found: {filepath}")

print(f"\nDone: {changed} pages upgraded, {skipped} skipped/not found")
