#!/usr/bin/env python3
"""Fix the dialog closings in vouchers/page.tsx by inserting </div>)} before each next dialog"""

filepath = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/finance/vouchers/page.tsx"

with open(filepath) as f:
    lines = f.readlines()

# Find and fix each dialog transition
markers = [
    '{/* ─── Delete Confirmation Dialog',
    '{/* ─── Unlock Comment Dialog',
    '{/* ─── History Dialog',
    '{/* Dashboard Statistics',
]

result = []
for i, line in enumerate(lines):
    stripped = line.strip()
    for marker in markers:
        if stripped.startswith(marker):
            # Check if previous non-empty line is just </div>
            # We need to add </div>)} before this line
            # Remove the previous </div> and replace with </div></div>)}
            if result and result[-1].strip() == '</div>':
                result[-1] = result[-1].rstrip('\n').rstrip() + '</div>)}\n'
            break
    result.append(line)

with open(filepath, 'w') as f:
    f.writelines(result)

print("✓ Fixed dialog closings")
