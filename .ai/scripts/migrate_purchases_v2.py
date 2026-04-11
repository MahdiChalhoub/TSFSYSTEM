#!/usr/bin/env python3
"""
Mass V2 migration script for Purchasing module.
Replaces legacy theme-* classes, Card/Button/Input components, 
and hardcoded Tailwind dark mode colors with Dajingo Pro V2 tokens.
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

# ── Color mappings from Tailwind → CSS variable color-mix ──
COLOR_MAP = {
    # Blue
    "bg-blue-50 dark:bg-blue-900/30": "V2_BG_BLUE",
    "bg-blue-50": "V2_BG_BLUE",
    # Indigo
    "bg-indigo-50 dark:bg-indigo-900/30": "V2_BG_INDIGO",
    "bg-indigo-50": "V2_BG_INDIGO", 
    # Emerald
    "bg-emerald-50 dark:bg-emerald-900/30": "V2_BG_EMERALD",
    "bg-emerald-50": "V2_BG_EMERALD",
    # Amber
    "bg-amber-50 dark:bg-amber-900/30": "V2_BG_AMBER",
    "bg-amber-50": "V2_BG_AMBER",
    # Orange
    "bg-orange-50 dark:bg-orange-900/30": "V2_BG_ORANGE",
    "bg-orange-50": "V2_BG_ORANGE",
    # Rose
    "bg-rose-50 dark:bg-rose-900/30": "V2_BG_ROSE",
    "bg-rose-50": "V2_BG_ROSE",
    # Purple
    "bg-purple-50 dark:bg-purple-900/30": "V2_BG_PURPLE",
    "bg-purple-50": "V2_BG_PURPLE",
    # Teal
    "bg-teal-50 dark:bg-teal-900/30": "V2_BG_TEAL",
    "bg-teal-50": "V2_BG_TEAL",
    # Gray
    "bg-gray-100 dark:bg-gray-800": "V2_BG_GRAY",
    "bg-gray-100": "V2_BG_GRAY",
    # Cyan
    "bg-cyan-50 dark:bg-cyan-900/30": "V2_BG_CYAN",
    "bg-cyan-50": "V2_BG_CYAN",
}

# Simple text replacements
REPLACEMENTS = [
    # ── Remove component imports ──
    ("import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'\n", ""),
    ("import { Card, CardContent, CardHeader, CardTitle } from \"@/components/ui/card\"\n", ""),
    ("import { Badge } from '@/components/ui/badge'\n", ""),
    ("import { Badge } from \"@/components/ui/badge\"\n", ""),
    ("import { Button } from '@/components/ui/button'\n", ""),
    ("import { Button } from \"@/components/ui/button\"\n", ""),
    ("import { Input } from '@/components/ui/input'\n", ""),
    ("import { Input } from \"@/components/ui/input\"\n", ""),
    ("import { Label } from '@/components/ui/label'\n", ""),
    ("import { Label } from \"@/components/ui/label\"\n", ""),
    
    # ── Layout ──
    ("layout-container-padding max-w-[1600px] mx-auto", "px-4 md:px-6 py-5"),
    ("layout-container-padding max-w-[1400px] mx-auto", "px-4 md:px-6 py-5"),
    ("layout-container-padding", "px-4 md:px-6 py-5"),
    ("max-w-[1600px] mx-auto ", ""),
    ("max-w-[1400px] mx-auto ", ""),
    
    # ── Theme classes → V2 classes ──
    ("theme-text-muted", "text-app-muted-foreground"),
    ("theme-text", "text-app-foreground"),
    ("theme-surface", "bg-app-surface"),
    ("theme-bg", "bg-app-bg"),
    
    # ── Border variable ──
    ("var(--theme-border)", "var(--app-border)"),
    
    # ── Layout spacing ──
    ("space-y-[var(--layout-section-spacing)]", "space-y-5"),
    ("gap-[var(--layout-element-gap)]", "gap-3"),
    ("md:gap-[var(--layout-element-gap)]", "md:gap-3"),
    
    # ── Progress bars ──
    ("bg-gray-100 dark:bg-gray-800", "bg-app-bg"),
    ("bg-gray-200", "bg-app-bg"),
    ("dark:bg-gray-800", ""),
    ("dark:bg-gray-900/20", ""),
    ("dark:bg-gray-900/30", ""),
    
    # ── Hover states ──
    ("hover:bg-gray-50 dark:hover:bg-gray-900/20", "hover:bg-app-surface/50"),
    ("hover:bg-gray-50", "hover:bg-app-surface/50"),
    ("dark:hover:border-gray-700", ""),
    
    # ── Dark mode overrides (now handled by CSS variables) ──
    (" dark:text-gray-300", ""),
    (" dark:text-gray-400", ""),
    (" dark:text-blue-400", ""),
    (" dark:text-indigo-400", ""),
    (" dark:text-teal-400", ""),    
    (" dark:text-emerald-400", ""),
    (" dark:text-amber-400", ""),
    (" dark:text-orange-400", ""),
    (" dark:text-rose-400", ""),
    (" dark:text-purple-400", ""),
    (" dark:text-cyan-400", ""),
    (" dark:border-blue-700", ""),
    (" dark:border-amber-700", ""),
    (" dark:border-emerald-700", ""),
    (" dark:border-indigo-700", ""),
    (" dark:border-gray-700", ""),
    (" dark:bg-blue-900/30", ""),
    (" dark:bg-emerald-900/30", ""),
    (" dark:bg-indigo-900/30", ""),
    (" dark:bg-amber-900/30", ""),
    (" dark:bg-orange-900/30", ""),
    (" dark:bg-teal-900/30", ""),
    (" dark:bg-emerald-900/30", ""),
    (" dark:bg-purple-900/30", ""),
    (" dark:bg-rose-900/30", ""),
    (" dark:bg-cyan-900/30", ""),
]

# ── Component tag replacements ──
TAG_REPLACEMENTS = [
    # Cards → divs
    ("<Card ", "<div "),
    ("<Card>", "<div>"),
    ("</Card>", "</div>"),
    ("<CardContent ", "<div "),
    ("<CardContent>", "<div>"),
    ("</CardContent>", "</div>"),
    ("<CardHeader ", "<div "),
    ("<CardHeader>", "<div>"),
    ("</CardHeader>", "</div>"),
    ("<CardTitle ", "<span "),
    ("<CardTitle>", "<span>"),
    ("</CardTitle>", "</span>"),
    
    # Input → native input  
    ("<Input ", "<input "),
    
    # Label → native label
    ("<Label ", "<label "),
    ("</Label>", "</label>"),
    
    # Button → button (only simple ones, not component Buttons with variant props)
    # This is tricky - we'll handle Button separately
]

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"  SKIP (not found): {filepath}")
        return
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Apply simple text replacements
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)
    
    # Apply tag replacements
    for old, new in TAG_REPLACEMENTS:
        content = content.replace(old, new)
    
    # Replace Button components with native buttons
    # <Button variant="outline" size="sm" onClick={...} className="...">
    # → <button onClick={...} className="...">
    # Remove variant and size props
    content = re.sub(r'<Button\s+variant="[^"]*"\s+size="[^"]*"\s+', '<button ', content)
    content = re.sub(r'<Button\s+size="[^"]*"\s+variant="[^"]*"\s+', '<button ', content)
    content = re.sub(r'<Button\s+variant="[^"]*"\s+', '<button ', content)
    content = re.sub(r'<Button\s+size="[^"]*"\s+', '<button ', content)
    content = re.sub(r'<Button\s+', '<button ', content)
    content = content.replace('</Button>', '</button>')
    content = content.replace('<Button>', '<button>')
    
    # Clean up doubled spaces
    content = re.sub(r'  +', ' ', content)
    # Clean up empty className parts from removed dark: classes
    content = re.sub(r'\s+(?=`)', '', content)
    
    # Fix any remaining bg-white dark:bg-gray-900
    content = content.replace("bg-white dark:bg-gray-900", "bg-app-surface")
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  ✓ Migrated: {os.path.basename(filepath)}")
    else:
        print(f"  · No changes: {os.path.basename(filepath)}")

print("═══ Purchasing Module V2 Migration ═══\n")
for file in FILES:
    path = os.path.join(BASE, file)
    process_file(path)
print("\n═══ Done ═══")
