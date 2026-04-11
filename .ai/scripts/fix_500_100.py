#!/usr/bin/env python3
"""Fix 500/100 corruption - final cleanup."""
import os, re

BASE = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/purchases"
FILES = ["page.tsx","PurchasesRegistryClient.tsx","dashboard/page.tsx","purchase-orders/page-client.tsx","invoices/page-client.tsx","receipts/page-client.tsx","quotations/page.tsx","returns/page.tsx","credit-notes/page.tsx","sourcing/page.tsx"]

for fn in FILES:
    path = os.path.join(BASE, fn)
    if not os.path.exists(path):
        continue
    with open(path) as f:
        content = f.read()
    orig = content
    # Fix bg-{color}-500/100 → bg-{color}-500 (the /10 in /100 should not be there)
    content = re.sub(r'bg-(\w+)-500/100(?!\d)', r'bg-\1-500', content)
    # Fix hover:bg-{color}-500/100/15 → hover:bg-{color}-500/15
    content = re.sub(r'bg-(\w+)-500/100/(\d+)', r'bg-\1-500/\2', content)
    if content != orig:
        with open(path, 'w') as f:
            f.write(content)
        print("fixed:", fn)
    else:
        print("ok:", fn)
print("Done")
