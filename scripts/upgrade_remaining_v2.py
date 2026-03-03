"""
Upgrade remaining pages without V2 headers.
Adds a simple, consistent V2 icon-box header section to pages that still use old structural patterns.
"""
import os, re

BASE = '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)'

# V2 patterns that indicate the page already has some form of V2 design
V2_PATTERNS = [
    r'rounded-2xl.*flex items-center justify-center',
    r'rounded-\[\d+px\].*flex items-center justify-center',
    r'font-black tracking-tight',
    r'text-[3-9]\w+.*font-black',
    r'page-header-title',
    r'fade-in-up',
    r'"app-page.*space-y-[4-8]',
    r'icon-box',
    r'font-black.*tracking-tighter',
]

def has_v2(content):
    return any(re.search(p, content) for p in V2_PATTERNS)

# Map of route -> (title, subtitle, icon_import, icon_name, accent_color)
PAGE_CONFIGS = {
    # MCP pages
    '/(saas)/mcp': ('MCP', 'Model Context Protocol Hub', 'Bot', 'Bot', 'var(--app-primary)'),
    '/(saas)/mcp/agents': ('MCP Agents', 'Manage AI agent configurations', 'Bot', 'Bot', 'var(--app-primary)'),
    '/(saas)/mcp/chat': ('MCP Chat', 'Conversational AI interface', 'MessageSquare', 'MessageSquare', 'var(--app-info)'),
    '/(saas)/mcp/conversations': ('Conversations', 'History of AI conversations', 'MessageCircle', 'MessageCircle', 'var(--app-info)'),
    '/(saas)/mcp/providers': ('AI Providers', 'Configure LLM provider connections', 'Cpu', 'Cpu', 'var(--app-warning)'),
    '/(saas)/mcp/settings': ('MCP Settings', 'Model Context Protocol configuration', 'Settings', 'Settings', 'var(--app-muted-foreground)'),
    '/(saas)/mcp/tools': ('MCP Tools', 'Available AI tools and functions', 'Wrench', 'Wrench', 'var(--app-success)'),
    '/(saas)/mcp/usage': ('MCP Usage', 'Token usage and billing analytics', 'BarChart3', 'BarChart3', 'var(--app-warning)'),
    # CRM
    '/crm/client-gate-preview': ('Client Gate', 'Preview client portal access', 'Users', 'Users', 'var(--app-primary)'),
    '/crm/supplier-gate-preview': ('Supplier Gate', 'Preview supplier portal access', 'Building2', 'Building2', 'var(--app-info)'),
    # eCommerce Admin
    '/ecommerce/coupons': ('Coupons', 'Manage discount codes and promotions', 'Tag', 'Tag', 'var(--app-success)'),
    '/ecommerce/promotions': ('Promotions', 'Cart rules and promotional campaigns', 'Percent', 'Percent', 'var(--app-warning)'),
    '/ecommerce/quotes': ('Quote Requests', 'Customer quote requests and responses', 'FileText', 'FileText', 'var(--app-info)'),
    '/ecommerce/shipping': ('Shipping', 'Delivery zones and shipping rules', 'Truck', 'Truck', 'var(--app-primary)'),
    '/ecommerce/webhooks': ('Webhooks', 'Event notification endpoints', 'Webhook', 'Activity', 'var(--app-muted-foreground)'),
    # Finance
    '/finance/chart-of-accounts/[id]': ('Account Detail', 'Chart of account details and ledger', 'BookOpen', 'BookOpen', 'var(--app-primary)'),
    '/finance/chart-of-accounts/templates': ('COA Templates', 'Chart of accounts template library', 'Layout', 'LayoutTemplate', 'var(--app-info)'),
    '/finance/reports/aging': ('Aging Report', 'Accounts receivable aging analysis', 'Clock', 'Clock', 'var(--app-warning)'),
    # Inventory
    '/inventory/brands': ('Brands', 'Manage product brands and manufacturers', 'Award', 'Award', 'var(--app-primary)'),
    '/inventory/categories': ('Categories', 'Product category hierarchy', 'FolderOpen', 'FolderOpen', 'var(--app-info)'),
    '/inventory/countries': ('Countries', 'Country and region management', 'Globe', 'Globe', 'var(--app-muted-foreground)'),
    '/inventory/pos-settings': ('POS Settings', 'Point of sale configuration', 'Settings', 'Settings', 'var(--app-warning)'),
    '/inventory/transfers/new': ('New Transfer', 'Create inter-warehouse transfer', 'ArrowLeftRight', 'ArrowLeftRight', 'var(--app-primary)'),
    '/inventory/units': ('Units of Measure', 'Base and derived measurement units', 'Ruler', 'Ruler', 'var(--app-info)'),
    # Sales
    '/sales/pos-settings': ('POS Settings', 'Point of sale terminal configuration', 'Settings', 'Settings', 'var(--app-warning)'),
    '/sales/supermarche': ('Supermarché', 'Advanced POS interface', 'ShoppingCart', 'ShoppingCart', 'var(--app-primary)'),
    # Settings
    '/settings/pos-settings': ('POS Settings', 'Point of sale system configuration', 'Settings', 'Settings', 'var(--app-warning)'),
    # Workspace
    '/workspace/client-access': ('Client Access', 'Manage client portal permissions', 'UserCheck', 'UserCheck', 'var(--app-primary)'),
    '/workspace/client-orders': ('Client Orders', 'B2B client order management', 'ShoppingBag', 'ShoppingBag', 'var(--app-info)'),
    '/workspace/client-tickets': ('Support Tickets', 'Client service request tracking', 'TicketIcon', 'TicketCheck', 'var(--app-warning)'),
    '/workspace/portal-config': ('Portal Config', 'Client portal customization', 'Layout', 'LayoutDashboard', 'var(--app-primary)'),
    '/workspace/quote-inbox': ('Quote Inbox', 'Incoming B2B quote requests', 'Inbox', 'Inbox', 'var(--app-success)'),
    '/workspace/supplier-access': ('Supplier Access', 'Manage supplier portal permissions', 'Building', 'Building', 'var(--app-info)'),
    # Other
    '/migration': ('Data Migration', 'Import and migrate data', 'Database', 'Database', 'var(--app-warning)'),
    '/migration/audit': ('Migration Audit', 'Audit trail for data migrations', 'ClipboardList', 'ClipboardList', 'var(--app-muted-foreground)'),
    '/setup-wizard': ('Setup Wizard', 'Organization onboarding wizard', 'Wand2', 'Wand2', 'var(--app-primary)'),
    '/storage': ('Storage', 'File and media asset management', 'HardDrive', 'HardDrive', 'var(--app-info)'),
    '/storage/packages': ('Storage Packages', 'Subscription storage plans', 'Package', 'Package', 'var(--app-warning)'),
}

def get_page_file(route):
    """Map route to actual file path"""
    parts = route.strip('/')
    candidates = [
        os.path.join(BASE, parts, 'page.tsx'),
        os.path.join(BASE, parts, 'page-client.tsx'),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

fixed = 0
skipped = 0
not_found = 0

for route, (title, subtitle, icon_import, icon_name, color) in PAGE_CONFIGS.items():
    fp = get_page_file(route)
    if not fp:
        not_found += 1
        continue
    
    with open(fp) as f:
        content = f.read()
    
    if has_v2(content):
        skipped += 1
        print(f"  SKIP (already V2): {route}")
        continue
    
    # Strategy: find the first return ( and insert a V2 header right after the outermost div opening
    # Look for patterns like: return (\n  <div className="app-page...">
    
    # Add imports if needed
    ICON_IMPORTS = ['ChevronRight', 'BarChart2', 'BarChart3', 'Settings', 'Tag', 'Truck', 'Activity',
                    'Bot', 'MessageSquare', 'MessageCircle', 'Cpu', 'Wrench', 'FileText', 'Percent',
                    'BookOpen', 'LayoutTemplate', 'Clock', 'Award', 'FolderOpen', 'Globe', 'Ruler',
                    'ArrowLeftRight', 'ShoppingCart', 'ShoppingBag', 'TicketCheck', 'LayoutDashboard',
                    'Inbox', 'Building', 'Database', 'ClipboardList', 'Wand2', 'HardDrive', 'Package',
                    'UserCheck', 'Users', 'Building2']
    
    # Only add import if file has lucide-react import and doesn't already import this icon
    if 'lucide-react' in content and icon_name not in content:
        if "from 'lucide-react'" in content:
            content = re.sub(
                r"import \{([^}]+)\} from 'lucide-react'",
                lambda m: f"import {{{m.group(1)}, {icon_name}}} from 'lucide-react'"
                if icon_name not in m.group(1) else m.group(0),
                content, count=1
            )
        elif 'from "lucide-react"' in content:
            content = re.sub(
                r'import \{([^}]+)\} from "lucide-react"',
                lambda m: f'import {{{m.group(1)}, {icon_name}}} from "lucide-react"'
                if icon_name not in m.group(1) else m.group(0),
                content, count=1
            )
        else:
            # Add new import
            first_import = content.index('import ')
            content = content[:first_import] + f"import {{ {icon_name} }} from 'lucide-react'\n" + content[first_import:]
    elif 'lucide-react' not in content:
        # Add lucide import at top
        lines = content.split('\n')
        insert_at = 0
        for i, l in enumerate(lines):
            if l.startswith('import ') or l.startswith("'use"):
                insert_at = i + 1
        lines.insert(insert_at, f"import {{ {icon_name} }} from 'lucide-react'")
        content = '\n'.join(lines)
    
    # Find the main return's opening div and inject V2 header after it
    # Pattern: look for the first return (\n    <div className="app-page
    
    V2_HEADER_BLOCK = f"""
  {{/* V2 Header */}}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{{{ background: '{color}20', border: `1px solid ${'{color}'}40` }}}}>
        <{icon_name} size={{26}} style={{{{ color: '{color}' }}}} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">{title}</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  </header>"""
    
    # Find the first return block and the opening of the JSX root element
    # We look for: return (\n    <div...> or return <div...>
    m = re.search(r'return\s*\(\s*\n\s*<div\b[^>]*>', content)
    if m:
        insert_pos = m.end()
        content = content[:insert_pos] + V2_HEADER_BLOCK + content[insert_pos:]
        with open(fp, 'w') as f:
            f.write(content)
        fixed += 1
        print(f"  FIXED: {route}")
    else:
        # Try return without parens
        m2 = re.search(r'return\s+<div\b[^>]*>', content)
        if m2:
            insert_pos = m2.end()
            content = content[:insert_pos] + V2_HEADER_BLOCK + content[insert_pos:]
            with open(fp, 'w') as f:
                f.write(content)
            fixed += 1
            print(f"  FIXED (no-parens): {route}")
        else:
            print(f"  MANUAL NEEDED: {route} (could not find return pattern)")
            skipped += 1

print(f"\nSummary: fixed={fixed}, skipped={skipped}, not_found={not_found}")
