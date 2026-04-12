#!/usr/bin/env python3
"""
TSFSYSTEM — Bulk V2 Dajingo Pro Design Migration
Replaces hardcoded Tailwind stone/gray/white colors with app-* theme tokens.

Run from project root:
  python3 scripts/migrate-to-v2-design.py

Safe to run multiple times (idempotent).
"""

import os
import re
import sys

BASE = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)"

# ─── Color replacement map ──────────────────────────────────────
# Order matters — more specific patterns first.
# Only replaces structural/neutral colors; preserves semantic colors
# (emerald/green=success, red=error, blue=info, amber/yellow=warning, purple=special)

REPLACEMENTS = [
    # ── Backgrounds ───────────────────────────────────────────
    ("bg-white ",                   "bg-app-surface "),
    ("bg-white\n",                  "bg-app-surface\n"),
    ("bg-white/",                   "bg-app-surface/"),
    ("bg-white\"",                  "bg-app-surface\""),
    ("bg-white'",                   "bg-app-surface'"),
    ("bg-stone-950",                "bg-app-bg"),
    ("bg-stone-900",                "bg-app-bg"),
    ("bg-stone-800",                "bg-app-surface"),
    ("bg-stone-700",                "bg-app-surface"),
    ("bg-stone-600",                "bg-app-surface-2"),
    ("bg-stone-500",                "bg-app-surface-2"),
    ("bg-stone-200",                "bg-app-surface-2"),
    ("bg-stone-100",                "bg-app-surface-2"),
    ("bg-stone-50",                 "bg-app-surface"),
    ("bg-gray-950",                 "bg-app-bg"),
    ("bg-gray-900",                 "bg-app-bg"),
    ("bg-gray-800",                 "bg-app-surface"),
    ("bg-gray-700",                 "bg-app-surface"),
    ("bg-gray-600",                 "bg-app-surface-2"),
    ("bg-gray-500",                 "bg-app-surface-2"),
    ("bg-gray-200",                 "bg-app-surface-2"),
    ("bg-gray-100",                 "bg-app-surface-2"),
    ("bg-gray-50",                  "bg-app-surface"),
    ("bg-slate-50",                 "bg-app-surface"),
    ("bg-slate-100",                "bg-app-surface-2"),

    # ── Text ──────────────────────────────────────────────────
    ("text-stone-950",              "text-app-foreground"),
    ("text-stone-900",              "text-app-foreground"),
    ("text-stone-800",              "text-app-foreground"),
    ("text-stone-700",              "text-app-foreground"),
    ("text-stone-600",              "text-app-muted-foreground"),
    ("text-stone-500",              "text-app-muted-foreground"),
    ("text-stone-400",              "text-app-muted-foreground"),
    ("text-stone-300",              "text-app-faint"),
    ("text-gray-950",               "text-app-foreground"),
    ("text-gray-900",               "text-app-foreground"),
    ("text-gray-800",               "text-app-foreground"),
    ("text-gray-700",               "text-app-foreground"),
    ("text-gray-600",               "text-app-muted-foreground"),
    ("text-gray-500",               "text-app-muted-foreground"),
    ("text-gray-400",               "text-app-muted-foreground"),
    ("text-gray-300",               "text-app-faint"),
    ("text-slate-900",              "text-app-foreground"),
    ("text-slate-700",              "text-app-foreground"),
    ("text-slate-600",              "text-app-muted-foreground"),
    ("text-slate-500",              "text-app-muted-foreground"),
    ("text-slate-400",              "text-app-muted-foreground"),

    # ── Borders ───────────────────────────────────────────────
    ("border-stone-300",            "border-app-border"),
    ("border-stone-200",            "border-app-border"),
    ("border-stone-100",            "border-app-border"),
    ("border-gray-300",             "border-app-border"),
    ("border-gray-200",             "border-app-border"),
    ("border-gray-100",             "border-app-border"),
    ("border-slate-200",            "border-app-border"),
    ("border-slate-300",            "border-app-border"),

    # ── Hover ─────────────────────────────────────────────────
    ("hover:bg-stone-50",           "hover:bg-app-surface-hover"),
    ("hover:bg-stone-100",          "hover:bg-app-surface-hover"),
    ("hover:bg-stone-200",          "hover:bg-app-surface-2"),
    ("hover:bg-gray-50",            "hover:bg-app-surface-hover"),
    ("hover:bg-gray-100",           "hover:bg-app-surface-hover"),
    ("hover:bg-gray-200",           "hover:bg-app-surface-2"),
    ("hover:bg-white",              "hover:bg-app-surface"),
    ("hover:text-stone-900",        "hover:text-app-foreground"),
    ("hover:text-stone-700",        "hover:text-app-foreground"),
    ("hover:text-gray-900",         "hover:text-app-foreground"),
    ("hover:text-gray-700",         "hover:text-app-foreground"),
    ("hover:border-stone-300",      "hover:border-app-border-strong"),
    ("hover:border-gray-300",       "hover:border-app-border-strong"),

    # ── Focus ─────────────────────────────────────────────────
    ("focus:bg-white",              "focus:bg-app-surface"),
    ("focus:border-stone-300",      "focus:border-app-border-strong"),
    ("focus:border-gray-300",       "focus:border-app-border-strong"),

    # ── Dark mode overrides (remove — app theme handles dark) ─
    # These are left alone intentionally; they override theme engine

    # ── Divide ────────────────────────────────────────────────
    ("divide-stone-100",            "divide-app-border"),
    ("divide-stone-200",            "divide-app-border"),
    ("divide-gray-100",             "divide-app-border"),
    ("divide-gray-200",             "divide-app-border"),

    # ── Ring ──────────────────────────────────────────────────
    ("ring-stone-200",              "ring-app-border"),
    ("ring-gray-200",               "ring-app-border"),

    # ── Placeholder ───────────────────────────────────────────
    ("placeholder-stone-400",       "placeholder-app-muted-foreground"),
    ("placeholder-gray-400",        "placeholder-app-muted-foreground"),
    ("placeholder:text-stone-400",  "placeholder:text-app-muted-foreground"),
    ("placeholder:text-gray-400",   "placeholder:text-app-muted-foreground"),
    ("placeholder:text-stone-500",  "placeholder:text-app-muted-foreground"),
    ("placeholder:text-gray-500",   "placeholder:text-app-muted-foreground"),

    # ── Black buttons → app-primary or foreground ─────────────
    # bg-black used for primary action buttons
    ("bg-black ",                   "bg-app-foreground "),
    ("bg-black\"",                  "bg-app-foreground\""),
    ("bg-black'",                   "bg-app-foreground'"),
    ("hover:bg-black",              "hover:bg-app-foreground"),
    ("hover:bg-stone-900",          "hover:bg-app-foreground"),
    ("hover:bg-stone-800",          "hover:bg-app-surface"),
    ("hover:bg-gray-900",           "hover:bg-app-foreground"),
]

# ─── Files to skip ────────────────────────────────────────────
SKIP_PATTERNS = [
    "node_modules",
    ".next",
    "__pycache__",
    ".git",
    "page-original",       # archived pages
    "_disabled",
]

def should_skip(path: str) -> bool:
    return any(p in path for p in SKIP_PATTERNS)

def migrate_file(path: str) -> bool:
    try:
        with open(path, "r", encoding="utf-8") as f:
            original = f.read()
    except Exception:
        return False

    content = original
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)

    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    return False

def main():
    changed = []
    skipped = []
    total = 0

    for root, dirs, files in os.walk(BASE):
        # Prune skip dirs in-place
        dirs[:] = [d for d in dirs if not should_skip(os.path.join(root, d))]

        for filename in files:
            if not filename.endswith((".tsx", ".ts", ".jsx", ".js")):
                continue
            filepath = os.path.join(root, filename)
            if should_skip(filepath):
                continue

            total += 1
            if migrate_file(filepath):
                rel = filepath.replace(BASE + "/", "")
                changed.append(rel)

    print(f"\n{'='*60}")
    print(f"  V2 Design Migration Complete")
    print(f"{'='*60}")
    print(f"  Total files scanned : {total}")
    print(f"  Files updated       : {len(changed)}")
    print(f"  Files unchanged     : {total - len(changed)}")
    if changed:
        print(f"\n  Updated files:")
        for f in sorted(changed):
            print(f"    ✓ {f}")
    print()

if __name__ == "__main__":
    main()
