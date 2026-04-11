#!/usr/bin/env python3
"""Final pass: replace remaining bg-{color}-50 with bg-{color}-500/10"""
import os

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

REPLACEMENTS = {
    "bg-blue-50": "bg-blue-500/10",
    "bg-amber-50": "bg-amber-500/10",
    "bg-emerald-50": "bg-emerald-500/10",
    "bg-indigo-50": "bg-indigo-500/10",
    "bg-orange-50": "bg-orange-500/10",
    "bg-rose-50": "bg-rose-500/10",
    "bg-purple-50": "bg-purple-500/10",
    "bg-teal-50": "bg-teal-500/10",
    "bg-cyan-50": "bg-cyan-500/10",
}

for fn in FILES:
    path = os.path.join(BASE, fn)
    if not os.path.exists(path):
        continue
    with open(path) as f:
        content = f.read()
    orig = content
    for old, new in REPLACEMENTS.items():
        content = content.replace(old, new)
    if content != orig:
        with open(path, "w") as f:
            f.write(content)
        print(f"  fixed: {fn}")
    else:
        print(f"  ok: {fn}")

print("Done")
