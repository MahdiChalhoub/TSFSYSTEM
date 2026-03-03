#!/usr/bin/env python3
"""
Secondary pass — fixes remaining edge cases not caught by the first pass.
"""
import re
import glob

SECONDARY = [
    # rgba green (34,197,94) -> app-success
    (r"rgba\(34\s*,\s*197\s*,\s*94\s*,\s*([0-9.]+)\)", "color-mix(in srgb, var(--app-success) {pct}%, transparent)"),
    # rgba purple (139,92,246) -> app-primary
    (r"rgba\(139\s*,\s*92\s*,\s*246\s*,\s*([0-9.]+)\)", "color-mix(in srgb, var(--app-primary) {pct}%, transparent)"),
    # rgba slate (148,163,184) -> app-muted  
    (r"rgba\(148\s*,\s*163\s*,\s*184\s*,\s*([0-9.]+)\)", "color-mix(in srgb, var(--app-muted-foreground) {pct}%, transparent)"),
    # rgba (100,116,139) slate-500 -> app-muted
    (r"rgba\(100\s*,\s*116\s*,\s*139\s*,\s*([0-9.]+)\)", "color-mix(in srgb, var(--app-muted-foreground) {pct}%, transparent)"),
    # hex colors for various greens  
    (r'#4ade80|#22c55e', 'var(--app-success)'),
    (r'#94a3b8|#64748b', 'var(--app-muted-foreground)'),
    # border-gray-50 / border-slate-50 are very light borders
    (r'\bborder-gray-50\b', 'border-app-border'),
    (r'\bborder-slate-50\b', 'border-app-border'),
    # shadow-gray-*
    (r'\bshadow-gray-[0-9]+(?:/[0-9]+)?\b', 'shadow-app-border/20'),
    (r'\bshadow-slate-[0-9]+(?:/[0-9]+)?\b', 'shadow-app-border/20'),
    # bg-emerald-gradient -> use a CSS variable based gradient  
    (r'\bbg-emerald-gradient\b', 'bg-app-success'),
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    for pattern, replacement in SECONDARY:
        if callable(replacement):
            content = re.sub(pattern, replacement, content)
        elif '{pct}' in replacement:
            def make_sub(repl_template):
                def sub(m):
                    pct = int(float(m.group(1)) * 100)
                    return repl_template.replace('{pct}', str(pct))
                return sub
            content = re.sub(pattern, make_sub(replacement), content)
        else:
            content = re.sub(pattern, replacement, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


files = glob.glob('src/app/(privileged)/**/*.tsx', recursive=True)
changed = 0
for fp in sorted(files):
    if process_file(fp):
        changed += 1

print(f"Secondary pass: modified {changed} files")
