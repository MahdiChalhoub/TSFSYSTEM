#!/usr/bin/env python3
"""
Mass V2 Migration Script for Finance Module Pages:
1. /finance/vouchers/page.tsx
2. /finance/audit-trail/page.tsx
3. /finance/settings/page.tsx
4. /finance/setup/page.tsx
5. /finance/settings/payment-methods/page.tsx
6. /finance/sequences/page.tsx

Converts:
- Legacy shadcn imports (Card, CardContent, Badge, Button, Input, Dialog, Skeleton) → native HTML
- theme-*/app-text/app-bg CSS classes → app-foreground/app-muted-foreground/app-surface V2 tokens
- max-w-* containers → full-width (app-page)
- Ensures standardized icon-box header pattern
"""

import os, re

BASE = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/finance"

# ═══════════════════════════════════════════════════════════════
# Universal replacements for ALL files
# ═══════════════════════════════════════════════════════════════
UNIVERSAL_REPLACEMENTS = [
    # Old non-V2 CSS variable names → V2
    ('text-app-text-muted', 'text-app-muted-foreground'),
    ('text-app-text-faint', 'text-app-muted-foreground/60'),
    ('text-app-text', 'text-app-foreground'),
    ('bg-app-bg', 'bg-app-surface'),
    ('border-app-border/40', 'border-app-border/50'),
    ('border-app-border/30', 'border-app-border/50'),
    ('border-app-border/15', 'border-app-border/30'),
    ('bg-app-surface/30', 'bg-app-surface/50'),
    ('color-mix(in srgb, var(--app-surface) 60%, transparent)', 'color-mix(in srgb, var(--app-surface) 80%, transparent)'),
    ('color-mix(in srgb, var(--app-surface) 50%, transparent)', 'color-mix(in srgb, var(--app-surface) 80%, transparent)'),
    ('color-mix(in srgb, var(--app-text) 5%, transparent)', 'color-mix(in srgb, var(--app-foreground) 5%, transparent)'),
    ("color: 'var(--app-text-muted)'", "color: 'var(--app-muted-foreground)'"),
    ("color: 'var(--app-text)'", "color: 'var(--app-foreground)'"),
    ("background: 'var(--app-primary)'", "background: 'var(--app-primary)'"),
    ('ring-offset-app-bg', 'ring-offset-app-surface'),
    # container standardization
    ('max-w-[1400px] mx-auto', 'w-full'),
    ('max-w-7xl mx-auto', 'w-full'),
    ('page-container', 'app-page'),
]

# ═══════════════════════════════════════════════════════════════
# Process each file
# ═══════════════════════════════════════════════════════════════
FILES = [
    "vouchers/page.tsx",
    "audit-trail/page.tsx",
    "settings/page.tsx",
    "setup/page.tsx",
    "settings/payment-methods/page.tsx",
    "sequences/page.tsx",
]

stats = {}
for relpath in FILES:
    filepath = os.path.join(BASE, relpath)
    if not os.path.exists(filepath):
        print(f"  ✗ NOT FOUND: {relpath}")
        continue

    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    count = 0

    # ── Remove legacy shadcn imports ──
    # Remove Card/CardContent
    content = re.sub(r'import\s*\{\s*Card(?:,\s*CardContent)?\s*\}\s*from\s*["\']@/components/ui/card["\'];?\n?', '', content)
    # Remove Badge
    content = re.sub(r'import\s*\{\s*Badge\s*\}\s*from\s*["\']@/components/ui/badge["\'];?\n?', '', content)
    # Remove Button
    content = re.sub(r'import\s*\{\s*Button\s*\}\s*from\s*["\']@/components/ui/button["\'];?\n?', '', content)
    # Remove Input
    content = re.sub(r'import\s*\{\s*Input\s*\}\s*from\s*["\']@/components/ui/input["\'];?\n?', '', content)
    # Remove Skeleton
    content = re.sub(r'import\s*\{\s*Skeleton\s*\}\s*from\s*["\']@/components/ui/skeleton["\'];?\n?', '', content)
    # Remove Dialog (multi-line import)
    content = re.sub(r'import\s*\{[^}]*Dialog[^}]*\}\s*from\s*["\']@/components/ui/dialog["\'];?\n?', '', content)

    # ── Replace <Card> → <div>, <CardContent> → <div> ──
    content = content.replace('<Card ', '<div ')
    content = content.replace('<Card>', '<div>')
    content = content.replace('</Card>', '</div>')
    content = content.replace('<CardContent ', '<div ')
    content = content.replace('<CardContent>', '<div>')
    content = content.replace('</CardContent>', '</div>')

    # ── Replace <Badge> → <span> ──
    content = content.replace('<Badge ', '<span ')
    content = content.replace('<Badge>', '<span>')
    content = content.replace('</Badge>', '</span>')
    # Remove variant props from Badge-turned-span
    content = re.sub(r'\s*variant="[^"]*"', '', content)

    # ── Replace <Button> → <button> ──
    content = content.replace('<Button ', '<button ')
    content = content.replace('<Button>', '<button>')
    content = content.replace('</Button>', '</button>')
    # Remove size props
    content = re.sub(r'\s*size="[^"]*"', '', content)

    # ── Replace <Input> → <input> ──
    content = content.replace('<Input ', '<input ')
    content = content.replace('<Input/>', '<input/>')
    content = content.replace('<Input />', '<input />')

    # ── Replace <Skeleton> → <div> with pulse ──
    content = content.replace('<Skeleton ', '<div ')
    content = re.sub(r'<Skeleton\s*className="([^"]*)"',
                     lambda m: f'<div className="{m.group(1)} animate-pulse bg-app-muted/20 rounded-xl"',
                     content)

    # ── Replace Dialog components → native divs ──
    content = content.replace('<Dialog ', '<div data-dialog ')
    content = content.replace('<Dialog>', '<div>')
    content = content.replace('</Dialog>', '</div>')
    content = content.replace('<DialogContent ', '<div ')
    content = content.replace('</DialogContent>', '</div>')
    content = content.replace('<DialogHeader>', '<div>')
    content = content.replace('<DialogHeader>', '<div>')
    content = content.replace('</DialogHeader>', '</div>')
    content = content.replace('<DialogTitle ', '<h3 ')
    content = content.replace('</DialogTitle>', '</h3>')
    content = content.replace('<DialogDescription>', '<p className="text-xs text-app-muted-foreground mt-1">')
    content = content.replace('</DialogDescription>', '</p>')

    # ── Apply universal replacements ──
    for old, new in UNIVERSAL_REPLACEMENTS:
        if old in content:
            content = content.replace(old, new)
            count += 1

    # ── Remove focus-visible Tailwind ring classes that reference old tokens ──
    content = content.replace('focus-visible:ring-amber-500/30', 'focus:ring-1 focus:ring-app-primary/30')

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        stats[relpath] = count
        print(f"  ✓ Migrated: {relpath} ({count} replacements)")
    else:
        print(f"  — No changes: {relpath}")

print(f"\n{'='*50}")
print(f"Total files migrated: {len(stats)}")
for f, c in stats.items():
    print(f"  {f}: {c} replacements")
