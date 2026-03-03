#!/usr/bin/env python3
"""
Mass migration script: replace all hardcoded Tailwind color utilities and
inline style color values with semantic V2 theme tokens (var(--app-*)).

Rules:
  - bg-gray-*   -> bg-app-surface / bg-app-surface-2 based on shade
  - text-gray-* -> text-app-muted-foreground or text-app-foreground
  - border-gray-* -> border-app-border
  - rgba(...)   -> appropriate var(--app-*) token
  - color: '#xxx' -> replaced with className-based token where possible
  - hardcoded bg-white / bg-black -> bg-app-surface / bg-app-background
  - bg-red/text-red -> app-error token equivalents
  - bg-blue/text-blue -> app-info token equivalents
  - bg-green/bg-emerald/text-green/text-emerald -> app-success token equivalents
  - bg-indigo/text-indigo -> app-primary token equivalents
  - bg-yellow/bg-amber/text-yellow/text-amber -> app-warning token equivalents
  - bg-purple/text-purple -> use app-primary or keep (purple is used for some accents)
  - bg-stone -> bg-app-surface-2
  - bg-zinc -> bg-app-surface-2
  - style={{ fontFamily... }} -> remove (handled by CSS)
  - style={{ color: 'var(--app-text)' }} -> className="text-app-foreground"
  - style={{ color: 'var(--app-text-muted)' }} -> className="text-app-muted-foreground"
  - bg-app-bg -> bg-app-background (token rename)
"""
import re
import os
import glob

# ─── Replacement mapping (regex -> replacement) ─────────────────────────────

# Simple class-name replacements
CLASSNAME_REPLACEMENTS = [
    # ── Grays ──────────────────────────────────────────────────────────────
    (r'\bbg-gray-50\b', 'bg-app-surface'),
    (r'\bbg-gray-100\b', 'bg-app-surface-2'),
    (r'\bbg-gray-200\b', 'bg-app-surface-2'),
    (r'\bbg-gray-300\b', 'bg-app-surface-hover'),
    (r'\bbg-gray-400\b', 'bg-app-border'),
    (r'\bbg-gray-500\b', 'bg-app-muted'),
    (r'\bbg-gray-[6-9]00\b', 'bg-app-surface'),
    (r'\bbg-slate-50\b', 'bg-app-surface'),
    (r'\bbg-slate-100\b', 'bg-app-surface-2'),
    (r'\bbg-slate-200\b', 'bg-app-surface-2'),
    (r'\bbg-slate-[3-9]00\b', 'bg-app-surface'),
    (r'\bbg-zinc-50\b', 'bg-app-surface'),
    (r'\bbg-zinc-100\b', 'bg-app-surface-2'),
    (r'\bbg-zinc-[2-9]00\b', 'bg-app-surface-2'),
    (r'\bbg-stone-50\b', 'bg-app-surface'),
    (r'\bbg-stone-100\b', 'bg-app-surface-2'),
    (r'\bbg-stone-[2-9]00\b', 'bg-app-surface-2'),
    (r'\bbg-neutral-50\b', 'bg-app-surface'),
    (r'\bbg-neutral-100\b', 'bg-app-surface-2'),
    (r'\bbg-neutral-[2-9]00\b', 'bg-app-surface-2'),
    (r'\bbg-white\b', 'bg-app-surface'),
    (r'\bbg-black\b', 'bg-app-background'),

    # ── text grays ──────────────────────────────────────────────────────────
    (r'\btext-gray-[3-5]00\b', 'text-app-muted-foreground'),
    (r'\btext-gray-[6-9]00\b', 'text-app-foreground'),
    (r'\btext-gray-[12]00\b', 'text-app-foreground'),
    (r'\btext-slate-[3-5]00\b', 'text-app-muted-foreground'),
    (r'\btext-slate-[6-9]00\b', 'text-app-foreground'),
    (r'\btext-slate-[12]00\b', 'text-app-foreground'),
    (r'\btext-zinc-[3-5]00\b', 'text-app-muted-foreground'),
    (r'\btext-zinc-[6-9]00\b', 'text-app-foreground'),
    (r'\btext-stone-[3-5]00\b', 'text-app-muted-foreground'),
    (r'\btext-stone-[6-9]00\b', 'text-app-foreground'),
    (r'\btext-neutral-[3-5]00\b', 'text-app-muted-foreground'),
    (r'\btext-neutral-[6-9]00\b', 'text-app-foreground'),
    (r'\btext-white\b', 'text-app-primary-foreground'),
    (r'\btext-black\b', 'text-app-foreground'),

    # ── border grays ────────────────────────────────────────────────────────
    (r'\bborder-gray-[12]00\b', 'border-app-border'),
    (r'\bborder-gray-[3-5]00\b', 'border-app-border'),
    (r'\bborder-gray-[6-9]00\b', 'border-app-border'),
    (r'\bborder-slate-[1-9]00\b', 'border-app-border'),
    (r'\bborder-stone-[1-9]00\b', 'border-app-border'),
    (r'\bborder-zinc-[1-9]00\b', 'border-app-border'),
    (r'\bborder-neutral-[1-9]00\b', 'border-app-border'),

    # ── Reds -> error ───────────────────────────────────────────────────────
    (r'\bbg-red-[5-9]00\b', 'bg-app-error'),
    (r'\bbg-red-[1-4]00\b', 'bg-app-error/10'),
    (r'\bbg-red-50\b', 'bg-app-error/5'),
    (r'\btext-red-[4-9]00\b', 'text-app-error'),
    (r'\btext-red-[1-3]00\b', 'text-app-error'),
    (r'\bborder-red-[1-9]00\b', 'border-app-error/30'),

    # ── Blues -> info ───────────────────────────────────────────────────────
    (r'\bbg-blue-[5-9]00\b', 'bg-app-info'),
    (r'\bbg-blue-[1-4]00\b', 'bg-app-info/10'),
    (r'\bbg-blue-50\b', 'bg-app-info/5'),
    (r'\btext-blue-[4-9]00\b', 'text-app-info'),
    (r'\btext-blue-[1-3]00\b', 'text-app-info'),
    (r'\bborder-blue-[1-9]00\b', 'border-app-info/30'),

    # ── Greens/Emeralds -> success ──────────────────────────────────────────
    (r'\bbg-green-[5-9]00\b', 'bg-app-success'),
    (r'\bbg-green-[1-4]00\b', 'bg-app-success/10'),
    (r'\bbg-green-50\b', 'bg-app-success/5'),
    (r'\bbg-emerald-[5-9]00\b', 'bg-app-success'),
    (r'\bbg-emerald-[1-4]00\b', 'bg-app-success/10'),
    (r'\bbg-emerald-50\b', 'bg-app-success/5'),
    (r'\btext-green-[4-9]00\b', 'text-app-success'),
    (r'\btext-green-[1-3]00\b', 'text-app-success'),
    (r'\btext-emerald-[4-9]00\b', 'text-app-success'),
    (r'\btext-emerald-[1-3]00\b', 'text-app-success'),
    (r'\bborder-green-[1-9]00\b', 'border-app-success/30'),
    (r'\bborder-emerald-[1-9]00\b', 'border-app-success/30'),

    # ── Indigos/Violets -> primary ──────────────────────────────────────────
    (r'\bbg-indigo-[5-9]00\b', 'bg-app-primary'),
    (r'\bbg-indigo-[1-4]00\b', 'bg-app-primary/10'),
    (r'\bbg-indigo-50\b', 'bg-app-primary/5'),
    (r'\btext-indigo-[4-9]00\b', 'text-app-primary'),
    (r'\btext-indigo-[1-3]00\b', 'text-app-primary'),
    (r'\bborder-indigo-[1-9]00\b', 'border-app-primary/30'),
    (r'\bbg-violet-[5-9]00\b', 'bg-app-primary'),
    (r'\bbg-violet-[1-4]00\b', 'bg-app-primary/10'),
    (r'\btext-violet-[4-9]00\b', 'text-app-primary'),
    
    # ── Yellows/Ambers -> warning ───────────────────────────────────────────
    (r'\bbg-yellow-[5-9]00\b', 'bg-app-warning'),
    (r'\bbg-yellow-[1-4]00\b', 'bg-app-warning/10'),
    (r'\bbg-yellow-50\b', 'bg-app-warning/5'),
    (r'\bbg-amber-[5-9]00\b', 'bg-app-warning'),
    (r'\bbg-amber-[1-4]00\b', 'bg-app-warning/10'),
    (r'\bbg-amber-50\b', 'bg-app-warning/5'),
    (r'\btext-yellow-[4-9]00\b', 'text-app-warning'),
    (r'\btext-amber-[4-9]00\b', 'text-app-warning'),
    (r'\bborder-yellow-[1-9]00\b', 'border-app-warning/30'),
    (r'\bborder-amber-[1-9]00\b', 'border-app-warning/30'),

    # ── bg-app-bg -> bg-app-background (token rename) ──────────────────────
    (r'\bbg-app-bg\b', 'bg-app-background'),
    
    # ── text-app-text -> text-app-foreground ───────────────────────────────
    (r'\btext-app-text\b(?!-)', 'text-app-foreground'),
    (r'\btext-app-text-muted\b', 'text-app-muted-foreground'),
    (r'\btext-app-text-faint\b', 'text-app-muted-foreground'),

    # ── ring-indigo ─────────────────────────────────────────────────────────
    (r'\bring-indigo-[1-9]00(?:/\d+)?\b', 'ring-app-primary'),
    (r'\bfocus-visible:ring-indigo-[1-9]00(?:/\d+)?\b', 'focus-visible:ring-app-primary/30'),

    # ── focus:ring/border ───────────────────────────────────────────────────
    (r'\bfocus:border-indigo-[1-9]00\b', 'focus:border-app-primary'),
    (r'\bfocus:ring-indigo-[1-9]00\b', 'focus:ring-app-primary'),
]

# Inline style replacements (operating on the full line)
STYLE_REPLACEMENTS = [
    # rgba  
    (r"rgba\(239\s*,\s*68\s*,\s*68\s*,\s*([0-9.]+)\)", lambda m: f'color-mix(in srgb, var(--app-error) {int(float(m.group(1))*100)}%, transparent)'),
    (r"rgba\(239\s*,\s*68\s*,\s*68\s*,\s*([0-9.]+)\)", lambda m: f'var(--app-error)'),  # fallback
    (r"rgba\(59\s*,\s*130\s*,\s*246\s*,\s*([0-9.]+)\)", lambda m: f'var(--app-info)'),
    (r"rgba\(245\s*,\s*158\s*,\s*11\s*,\s*([0-9.]+)\)", lambda m: f'var(--app-warning)'),
    (r"rgba\(16\s*,\s*185\s*,\s*129\s*,\s*([0-9.]+)\)", lambda m: f'var(--app-success)'),
    (r"rgba\(99\s*,\s*102\s*,\s*241\s*,\s*([0-9.]+)\)", lambda m: f'var(--app-primary)'),
    (r"rgba\(0\s*,\s*0\s*,\s*0\s*,\s*([0-9.]+)\)", lambda m: f'var(--app-border)'),
    (r"rgba\(255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\)", lambda m: f'var(--app-surface)'),
    # Legacy var aliases
    (r"var\(--app-text\)", "var(--app-foreground)"),
    (r"var\(--app-text-muted\)", "var(--app-muted-foreground)"),
    (r"var\(--app-text-faint\)", "var(--app-muted-foreground)"),
    (r"var\(--app-bg\)", "var(--app-background)"),
    (r"var\(--app-primary-light\)", "var(--app-primary)/10"),
    # Hex colors for text
    (r'color:\s*["\']#fff["\']', 'className="text-app-primary-foreground"'),
    (r'color:\s*["\']#ffffff["\']', 'className="text-app-primary-foreground"'),
    (r'color:\s*["\']white["\']', 'className="text-app-primary-foreground"'),
    # fontFamily inline style
    (r",?\s*fontFamily:\s*['\"]var\(--app-font[^)]*\)['\"]", ""),
    (r",?\s*fontFamily:\s*['\"]var\(--app-font-display[^)]*\)['\"]", ""),
]


def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Apply className replacements
    for pattern, replacement in CLASSNAME_REPLACEMENTS:
        content = re.sub(pattern, replacement, content)
    
    # Apply style replacements (simpler string replacements)
    for pattern, replacement in STYLE_REPLACEMENTS:
        if callable(replacement):
            content = re.sub(pattern, replacement, content)
        else:
            content = re.sub(pattern, replacement, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


# Process all TSX files in (privileged)
files = glob.glob('src/app/(privileged)/**/*.tsx', recursive=True)
changed = 0
for fp in sorted(files):
    if process_file(fp):
        changed += 1

print(f"Processed {len(files)} files, modified {changed} files")
