#!/usr/bin/env python3
"""Fix corrupted color classes caused by cascading replacements."""
import os, re

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

# Fix pattern: bg-{color}-500/10{0/10}+ → bg-{color}-500/10
COLORS = ['blue', 'amber', 'emerald', 'indigo', 'orange', 'rose', 'purple', 'teal', 'cyan']

for fn in FILES:
    path = os.path.join(BASE, fn)
    if not os.path.exists(path):
        continue
    with open(path) as f:
        content = f.read()
    orig = content
    for color in COLORS:
        # Fix cascaded: bg-{color}-500/10{0/10}+ → bg-{color}-500/10
        pattern = f'bg-{color}-500/10(?:0/10)+'
        replacement = f'bg-{color}-500/10'
        content = re.sub(pattern, replacement, content)
        
        # Also fix bg-{color}-500/15 variants that got corrupted 
        pattern = f'bg-{color}-500/15(?:0/10)+'
        replacement = f'bg-{color}-500/15'
        content = re.sub(pattern, replacement, content)
    
    # Fix app-muted similar corruption
    content = re.sub(r'bg-app-muted/10(?:0/10)+', 'bg-app-muted/10', content)
    
    if content != orig:
        with open(path, "w") as f:
            f.write(content)
        print(f"  fixed: {fn}")
    else:
        print(f"  ok: {fn}")

print("Done")
