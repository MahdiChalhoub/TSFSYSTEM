#!/usr/bin/env python3
"""
Second-pass V2 migration for Purchasing module.
Converts remaining Tailwind bg-{color}-50 to V2 color-mix inline styles,
adds glassmorphism to card containers, and fixes button styling.
"""
import re, os

BASE = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/purchases"

FILES = [
    "page.tsx",
    "PurchasesRegistryClient.tsx", 
    "dashboard/page.tsx",
    "purchase-orders/page-client.tsx",
    "invoices/page-client.tsx",
    "receipts/page-client.tsx",
    "quotations/page.tsx",
    "returns/page.tsx",
    "credit-notes/page.tsx",
    "sourcing/page.tsx",
]

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"  SKIP: {filepath}")
        return
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content

    # ── Fix card containers: bare "border shadow-sm" → glassmorphism ──
    content = content.replace(
        'className="border shadow-sm"',
        'className="rounded-2xl bg-app-surface/80 backdrop-blur-sm border border-app-border/50"'
    )
    content = content.replace(
        'className="border shadow-sm overflow-hidden"',
        'className="rounded-2xl bg-app-surface/80 backdrop-blur-sm border border-app-border/50 overflow-hidden"'
    )
    content = content.replace(
        'className="border shadow-sm min-h-[300px]"',
        'className="rounded-2xl bg-app-surface/80 backdrop-blur-sm border border-app-border/50 min-h-[300px]"'
    )
    content = content.replace(
        'className="border shadow-sm min-h-[400px]"',
        'className="rounded-2xl bg-app-surface/80 backdrop-blur-sm border border-app-border/50 min-h-[400px]"'
    )

    # ── Fix refresh buttons: bare <button> → styled outline button ──
    content = re.sub(
        r'<button onClick=\{load\} className="min-h-\[44px\] md:min-h-\[36px\]"',
        '<button onClick={load} className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold border border-app-border/50 text-app-muted-foreground hover:text-app-foreground hover:border-app-primary/30 transition-all bg-app-surface/80"',
        content
    )
    
    # ── Fix action buttons with bg-* colors ──
    # bg-blue-500 hover:bg-blue-600 text-white → V2 primary
    content = content.replace(
        'bg-blue-500 hover:bg-blue-600 text-white',
        'bg-[var(--app-primary)] hover:bg-[var(--app-primary-hover)] text-white'
    )
    content = content.replace(
        'bg-emerald-500 hover:bg-emerald-600 text-white',
        'bg-emerald-500/90 hover:bg-emerald-500 text-white'
    )
    
    # ── Fix filter buttons with hardcoded dark: ──
    content = content.replace(
        "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700",
        "bg-[color-mix(in_srgb,var(--app-primary)_12%,transparent)] text-[var(--app-primary)] border-[var(--app-primary-border)]"
    )
    
    # ── Fix status badges: convert bg-{color}-50 text-{color}-600 → inline style ──
    # These are in STATUS_CONFIG objects and rendered as className
    status_color_map = {
        ("bg-gray-100 text-gray-600", "bg-[color-mix(in_srgb,var(--app-muted)_12%,transparent)] text-app-muted-foreground"),
        ("bg-gray-100 text-gray-500", "bg-[color-mix(in_srgb,var(--app-muted)_12%,transparent)] text-app-muted-foreground"),
        ("bg-amber-50 text-amber-600", "bg-amber-500/10 text-amber-600 dark:text-amber-400"),
        ("bg-blue-50 text-blue-600", "bg-blue-500/10 text-blue-600 dark:text-blue-400"),
        ("bg-indigo-50 text-indigo-600", "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"),
        ("bg-teal-50 text-teal-600", "bg-teal-500/10 text-teal-600 dark:text-teal-400"),
        ("bg-emerald-50 text-emerald-600", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"),
        ("bg-emerald-50 text-emerald-700", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"),
        ("bg-rose-50 text-rose-600", "bg-rose-500/10 text-rose-600 dark:text-rose-400"),
        ("bg-purple-50 text-purple-600", "bg-purple-500/10 text-purple-600 dark:text-purple-400"),
        ("bg-orange-50 text-orange-600", "bg-orange-500/10 text-orange-600 dark:text-orange-400"),
        ("bg-cyan-50 text-cyan-600", "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"),
    }
    for old, new in status_color_map:
        content = content.replace(old, new)
    
    # ── Fix selected item highlights ──
    content = content.replace(
        "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-600",
        "bg-[color-mix(in_srgb,var(--app-primary)_8%,transparent)] border-[var(--app-primary-border)]"
    )
    content = content.replace(
        "bg-purple-50 border-purple-300 dark:bg-purple-900/20 dark:border-purple-600",
        "bg-purple-500/8 border-purple-500/30"
    )
    content = content.replace(
        "bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-600",
        "bg-emerald-500/8 border-emerald-500/30"
    )
    content = content.replace(
        "bg-rose-50 border-rose-300 dark:bg-rose-900/20 dark:border-rose-600",
        "bg-rose-500/8 border-rose-500/30"
    )
    content = content.replace(
        "bg-teal-50 border-teal-300 dark:bg-teal-900/20 dark:border-teal-600",
        "bg-teal-500/8 border-teal-500/30"
    )

    # ── Fix hover text-blue-500 links ──
    content = content.replace(
        "text-blue-500 font-bold text-xs hover:underline",
        "text-[var(--app-primary)] font-bold text-xs hover:underline"
    )
    content = content.replace(
        "text-blue-500 text-sm font-bold",
        "text-[var(--app-primary)] text-sm font-bold"
    )
    
    # ── Fix "hover:theme-text" legacy (missed by first pass) ──
    content = content.replace("hover:text-app-foreground", "hover:text-app-foreground")
    
    # ── Remaining bare bg-{color}-50 on icon boxes → keep as is (these are just tint, acceptable in V2) ──
    # Actually let's upgrade icon-box backgrounds to proper color-mix
    icon_box_map = {
        "bg-blue-50 flex": "bg-blue-500/10 flex",
        "bg-indigo-50 flex": "bg-indigo-500/10 flex",
        "bg-emerald-50 flex": "bg-emerald-500/10 flex",
        "bg-amber-50 flex": "bg-amber-500/10 flex",
        "bg-orange-50 flex": "bg-orange-500/10 flex",
        "bg-rose-50 flex": "bg-rose-500/10 flex",
        "bg-purple-50 flex": "bg-purple-500/10 flex",
        "bg-teal-50 flex": "bg-teal-500/10 flex",
        "bg-gray-100 flex": "bg-app-muted/10 flex",
    }
    for old, new in icon_box_map.items():
        content = content.replace(old, new)

    # ── Fix hover:bg-emerald-50 → V2 ──
    content = content.replace("hover:bg-emerald-50", "hover:bg-emerald-500/5")
    content = content.replace("hover:bg-blue-100", "hover:bg-blue-500/15")

    # ── Clean doubled dark: leftovers ──
    content = re.sub(r'\s*dark:bg-[a-z]+-\d+(?:/\d+)?', '', content)
    content = re.sub(r'\s*dark:text-[a-z]+-\d+', '', content)
    content = re.sub(r'\s*dark:border-[a-z]+-\d+', '', content)
    
    # ── Fix PO_SUB_TYPE_CONFIG remaining hardcoded colors ──
    content = content.replace(
        "bg-gray-100 border border-gray-200 text-gray-500",
        "bg-app-muted/10 border border-app-border text-app-muted-foreground"
    )
    content = content.replace(
        "bg-amber-50 text-amber-600 border border-amber-200",
        "bg-amber-500/10 text-amber-600 border border-amber-500/20"
    )
    content = content.replace(
        "bg-emerald-50 text-emerald-600 border border-emerald-200",
        "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
    )
    
    # ── Fix button text colors that reference theme text ──
    content = content.replace("hover:border-gray-200", "hover:border-app-border")
    content = content.replace("border-transparent text-app-muted-foreground", "border-transparent text-app-muted-foreground")
    
    # ── Clean up bg-white remaining ──
    content = content.replace("bg-white", "bg-app-surface")
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  ✓ Polished: {os.path.basename(filepath)}")
    else:
        print(f"  · No changes: {os.path.basename(filepath)}")

print("═══ Purchasing Module V2 Polish Pass ═══\n")
for file in FILES:
    path = os.path.join(BASE, file)
    process_file(path)
print("\n═══ Done ═══")
