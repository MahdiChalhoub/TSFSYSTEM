#!/usr/bin/env python3
"""
V2 Header Upgrade — Batch 2
Covers: Settings, CRM, Workspace/B2B, eCommerce, remaining Finance + Inventory pages
"""
import re, os, glob

TARGETS = [
    # (path, module_label, title_first, title_accent, icon_name, icon_size)

    # Settings
    ('src/app/(privileged)/settings/appearance/page.tsx',
     'Settings', 'Appearance', '& Themes', 'Palette', 32),
    ('src/app/(privileged)/settings/domains/page.tsx',
     'Settings', 'Domains', '& DNS', 'Globe', 32),
    ('src/app/(privileged)/settings/notifications/page.tsx',
     'Settings', 'Notification', 'Center', 'Bell', 32),
    ('src/app/(privileged)/settings/pos-settings/page.tsx',
     'Settings · POS', 'POS', 'Settings', 'Monitor', 32),
    ('src/app/(privileged)/settings/roles/page.tsx',
     'Settings · Security', 'Roles', '& Permissions', 'Shield', 32),
    ('src/app/(privileged)/settings/security/page.tsx',
     'Settings', 'Security', 'Center', 'Lock', 32),
    ('src/app/(privileged)/settings/whatsapp/page.tsx',
     'Settings', 'WhatsApp', 'Alerts', 'MessageCircle', 32),

    # CRM
    ('src/app/(privileged)/crm/contacts/page.tsx',
     'CRM', 'Contact', 'Registry', 'Users', 32),
    ('src/app/(privileged)/crm/insights/page.tsx',
     'CRM', 'Customer', 'Insights', 'BarChart3', 32),
    ('src/app/(privileged)/crm/pricing/page.tsx',
     'CRM', 'Pricing', 'Tiers', 'Tag', 32),
    ('src/app/(privileged)/crm/supplier-gate-preview/page.tsx',
     'CRM', 'Supplier', 'Gate', 'Briefcase', 32),
    ('src/app/(privileged)/crm/supplier-performance/page.tsx',
     'CRM', 'Supplier', 'Performance', 'TrendingUp', 32),

    # Workspace / B2B
    ('src/app/(privileged)/workspace/tasks/page.tsx',
     'Workspace', 'Task', 'Manager', 'CheckSquare', 32),
    ('src/app/(privileged)/workspace/performance/page.tsx',
     'Workspace', 'Performance', 'Hub', 'TrendingUp', 32),
    ('src/app/(privileged)/workspace/checklists/page.tsx',
     'Workspace', 'Checklist', 'Manager', 'ClipboardList', 32),
    ('src/app/(privileged)/workspace/auto-task-rules/page.tsx',
     'Workspace', 'Auto-Task', 'Rules', 'Zap', 32),
    ('src/app/(privileged)/workspace/auto-task-settings/page.tsx',
     'Workspace', 'Auto-Task', 'Settings', 'Settings2', 32),
    ('src/app/(privileged)/workspace/client-portal/page.tsx',
     'Workspace · B2B', 'Client', 'Portal', 'Globe', 32),
    ('src/app/(privileged)/workspace/client-access/page.tsx',
     'Workspace · B2B', 'Client', 'Access', 'Key', 32),
    ('src/app/(privileged)/workspace/client-orders/page.tsx',
     'Workspace · B2B', 'Client', 'Orders', 'ShoppingBag', 32),
    ('src/app/(privileged)/workspace/client-tickets/page.tsx',
     'Workspace · Support', 'Client', 'Tickets', 'MessageSquare', 32),
    ('src/app/(privileged)/workspace/supplier-portal/page.tsx',
     'Workspace · B2B', 'Supplier', 'Portal', 'Truck', 32),
    ('src/app/(privileged)/workspace/supplier-access/page.tsx',
     'Workspace · B2B', 'Supplier', 'Access', 'Key', 32),
    ('src/app/(privileged)/workspace/proformas/page.tsx',
     'Workspace', 'Proforma', 'Registry', 'FileText', 32),
    ('src/app/(privileged)/workspace/tenders/page.tsx',
     'Workspace', 'Tender', 'Hub', 'Briefcase', 32),
    ('src/app/(privileged)/workspace/quote-inbox/page.tsx',
     'Workspace', 'Quote', 'Inbox', 'Inbox', 32),
    ('src/app/(privileged)/workspace/price-requests/page.tsx',
     'Workspace', 'Price', 'Requests', 'DollarSign', 32),
    ('src/app/(privileged)/workspace/portal-config/page.tsx',
     'Workspace · B2B', 'Portal', 'Config', 'Settings2', 32),

    # Remaining Finance
    ('src/app/(privileged)/finance/fiscal-years/page.tsx',
     'Finance', 'Fiscal', 'Years', 'CalendarDays', 32),
    ('src/app/(privileged)/finance/balances/page.tsx',
     'Finance', 'Account', 'Balances', 'Scale', 32),
    ('src/app/(privileged)/finance/assets/page.tsx',
     'Finance', 'Fixed', 'Assets', 'Package', 32),
    ('src/app/(privileged)/finance/tax-groups/page.tsx',
     'Finance · Tax', 'Tax', 'Groups', 'Tag', 32),

    # Remaining Inventory
    ('src/app/(privileged)/inventory/categories/page.tsx',
     'Inventory', 'Category', 'Manager', 'FolderOpen', 32),
    ('src/app/(privileged)/inventory/brands/page.tsx',
     'Inventory', 'Brand', 'Registry', 'Star', 32),
    ('src/app/(privileged)/inventory/units/page.tsx',
     'Inventory', 'Unit', 'Manager', 'Ruler', 32),
    ('src/app/(privileged)/inventory/attributes/page.tsx',
     'Inventory', 'Product', 'Attributes', 'Tag', 32),
    ('src/app/(privileged)/inventory/combo/page.tsx',
     'Inventory', 'Combo', 'Products', 'Package', 32),
    ('src/app/(privileged)/inventory/stock-count/page.tsx',
     'Inventory', 'Stock', 'Count', 'ClipboardList', 32),
    ('src/app/(privileged)/inventory/transfer-orders/page.tsx',
     'Inventory', 'Transfer', 'Orders', 'ArrowLeftRight', 32),
    ('src/app/(privileged)/inventory/transfers/page.tsx',
     'Inventory', 'Stock', 'Transfers', 'Truck', 32),
    ('src/app/(privileged)/inventory/serials/page.tsx',
     'Inventory', 'Serial', 'Numbers', 'Hash', 32),
    ('src/app/(privileged)/inventory/requests/page.tsx',
     'Inventory', 'Stock', 'Requests', 'Inbox', 32),
    ('src/app/(privileged)/inventory/barcode/page.tsx',
     'Inventory', 'Barcode', 'Printer', 'Scan', 32),
    ('src/app/(privileged)/inventory/labels/page.tsx',
     'Inventory', 'Label', 'Printer', 'Printer', 32),
    ('src/app/(privileged)/inventory/low-stock/page.tsx',
     'Inventory', 'Low-Stock', 'Alerts', 'AlertTriangle', 32),
    ('src/app/(privileged)/inventory/expiry-alerts/page.tsx',
     'Inventory', 'Expiry', 'Alerts', 'Clock', 32),
    ('src/app/(privileged)/inventory/pos-settings/page.tsx',
     'Inventory · POS', 'POS', 'Settings', 'Monitor', 32),
    ('src/app/(privileged)/inventory/countries/page.tsx',
     'Inventory', 'Country', 'Registry', 'Globe', 32),
    ('src/app/(privileged)/inventory/maintenance/page.tsx',
     'Inventory', 'Data', 'Maintenance', 'Wrench', 32),

    # eCommerce
    ('src/app/(privileged)/ecommerce/dashboard/page.tsx',
     'eCommerce', 'Store', 'Dashboard', 'ShoppingCart', 32),
    ('src/app/(privileged)/ecommerce/orders/page.tsx',
     'eCommerce', 'Online', 'Orders', 'ShoppingBag', 32),

    # System
    ('src/app/(privileged)/storage/page.tsx',
     'System', 'File', 'Storage', 'HardDrive', 32),
    ('src/app/(privileged)/users/approvals/page.tsx',
     'System', 'User', 'Approvals', 'UserCheck', 32),
    ('src/app/(privileged)/migration/page.tsx',
     'System', 'Data', 'Migration', 'ArrowRightLeft', 32),

    # HR remaining
    ('src/app/(privileged)/hr/overview/page.tsx',
     'Human Resources', 'HR', 'Overview', 'Users', 32),
    ('src/app/(privileged)/hr/employees/page.tsx',
     'Human Resources', 'Employee', 'Registry', 'UserCircle', 32),
    ('src/app/(privileged)/hr/departments/page.tsx',
     'Human Resources', 'Department', 'Manager', 'Building2', 32),

    # Products remaining
    ('src/app/(privileged)/products/new/page.tsx',
     'Products', 'New', 'Product', 'Plus', 28),
    ('src/app/(privileged)/products/legacy/page.tsx',
     'Products', 'Legacy', 'Registry', 'Archive', 32),
]


def has_v2_header(content):
    return ('w-16 h-16 rounded-2xl' in content or
            ('fade-in-up' in content and 'bg-app-primary/10 border border-app-primary/20' in content))


def upgrade_page_header(filepath, module_label, title_first, title_accent, icon_name, icon_size):
    if not os.path.exists(filepath):
        return False
    with open(filepath, 'r') as f:
        content = f.read()
    if has_v2_header(content):
        return False
    original = content
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
    # Replace old header blocks
    pat = re.compile(r'<header[^>]*>.*?</header>', re.DOTALL)
    m = pat.search(content)
    if m:
        old = m.group(0)
        if 'fade-in-up' not in old and 'bg-app-primary/10' not in old:
            content = content[:m.start()] + new_header + content[m.end():]
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False


changed = skipped = missing = 0
for args in TARGETS:
    fp = args[0]
    if not os.path.exists(fp):
        missing += 1
        print(f"  ⚠ Not found: {fp}")
        continue
    if upgrade_page_header(*args):
        changed += 1
        print(f"  ✓ Upgraded: {fp}")
    else:
        skipped += 1
        print(f"  → Skipped (already V2): {fp}")

print(f"\nDone: {changed} upgraded, {skipped} skipped, {missing} missing")
