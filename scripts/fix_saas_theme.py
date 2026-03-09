import os

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content

    # ── Text Colors ──
    content = content.replace("text-gray-900", "theme-text")
    content = content.replace("text-gray-400", "theme-text-muted")
    content = content.replace("text-gray-500", "theme-text-muted")
    content = content.replace("text-gray-300", "theme-text-muted")
    content = content.replace("dark:text-gray-400", "")
    
    # ── Background Colors ──
    content = content.replace("bg-gray-50", "bg-app-surface")
    content = content.replace("bg-gray-100", "bg-app-surface")
    content = content.replace("dark:bg-gray-900", "")
    content = content.replace("dark:bg-gray-800", "")
    content = content.replace("bg-white/70", "bg-app-surface/70")
    content = content.replace("bg-white/80", "bg-app-surface/80")
    # bg-white used as card/surface backgrounds → bg-app-surface
    # But careful: bg-white in some contexts is intentional (button highlights)
    # Only replace bg-white when it's a surface/container bg
    content = content.replace('bg-white border', 'bg-app-surface border')
    content = content.replace('bg-white text-', 'bg-app-surface text-')
    content = content.replace('bg-white hover:', 'bg-app-surface hover:')
    content = content.replace("hover:bg-gray-50", "hover:bg-app-surface-hover")
    content = content.replace("hover:bg-white", "hover:bg-app-surface")
    content = content.replace("focus:bg-white", "focus:bg-app-surface")
    content = content.replace("group-hover/card:bg-white", "group-hover/card:bg-app-surface-hover")
    
    # ── Border Colors ──
    content = content.replace("border-gray-200", "border-app-border")
    content = content.replace("border-gray-100", "border-app-border")
    content = content.replace("dark:border-gray-700", "")
    
    # ── Shadow Colors ──
    content = content.replace("shadow-gray-200/20", "shadow-app-border/20")
    content = content.replace("shadow-gray-200", "shadow-app-border")
    
    # ── Inline style hardcoded colors ──
    content = content.replace('style={{background:"white",color:"#111827",borderColor:"#e5e7eb",borderRadius:"1rem"}}', '')
    content = content.replace("style={{background:\"white\",color:\"#111827\",borderColor:\"#e5e7eb\",borderRadius:\"1rem\"}}", "")
    
    # ── Clean up double spaces from removed classes ──
    while '  ' in content:
        content = content.replace('  ', ' ')

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  ✅ Updated: {filepath}")
    else:
        print(f"  ⏭️  Skipped (no changes): {filepath}")

def main():
    targets = [
        'src/app/(privileged)/(saas)/organizations/page.tsx',
        'src/app/(privileged)/(saas)/saas-home/page.tsx',
    ]
    
    # Also scan all SaaS pages
    saas_dir = 'src/app/(privileged)/(saas)'
    for root, dirs, files in os.walk(saas_dir):
        for f in files:
            if f.endswith('.tsx') or f.endswith('.ts'):
                fp = os.path.join(root, f)
                if fp not in targets:
                    targets.append(fp)
    
    # Purchases invoicing (remaining bg-white)
    inv = 'src/app/(privileged)/purchases/invoicing/InvoicingScreen.tsx'
    if os.path.exists(inv):
        targets.append(inv)
    
    # Purchase detail modals
    purchase_detail = 'src/app/(privileged)/purchases/[id]/page.tsx'
    if os.path.exists(purchase_detail):
        targets.append(purchase_detail)
    
    receipts = 'src/app/(privileged)/purchases/receipts/page-client.tsx'
    if os.path.exists(receipts):
        targets.append(receipts)
    
    new_order = 'src/app/(privileged)/purchases/new-order/form.tsx'
    if os.path.exists(new_order):
        targets.append(new_order)

    print(f"🎨 Processing {len(targets)} files for V2 Theme compliance...\n")
    for t in targets:
        if os.path.exists(t):
            process_file(t)

if __name__ == '__main__':
    main()
