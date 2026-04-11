#!/usr/bin/env python3
"""
Properly fix all dialog sections in vouchers/page.tsx.
The issue: {dialogOpen && (<div class=fixed><div overlay/><div panel>..content..</div></div>)}
We need to make sure each dialog block has exactly the right closings.
"""

filepath = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/finance/vouchers/page.tsx"

with open(filepath) as f:
    content = f.read()

# Strategy: Find each dialog block and rewrite its opening+closing properly

# ── Dialog 1: Create/Edit ──
# Opening: {dialogOpen && (<div className="fixed inset-0 z-50"><div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closeDialog} />
# Panel:   <div className="fixed top-1/2 left-1/2 ...">
# Content: ...
# Form ends at: </form>
# Should close: </div></div>)}
# Currently the closings after </form> are just </div></div> without )}

# Let me find each dialog block by its comment marker and fix the closing

# Approach: Replace from comment marker to the next comment marker, fixing the structure

import re

# Split content into segments by dialog markers
segments = re.split(r'(\{/\* ─── (?:Create / Edit|Delete Confirmation|Unlock Comment|History) Dialog)', content)

# Also find the Dashboard Statistics marker
segments2 = []
for s in segments:
    parts = re.split(r'(\{/\* Dashboard Statistics)', s)
    segments2.extend(parts)

# Now rebuild, but this approach is complex. Let me just do direct replacements.

# The file has this structure at each dialog transition:
# ...content...</div>  ← panel div close
# </div>               ← wrapper div close (BUT MISSING )} for conditional)
# {/* comment marker

# OR after the fix script:
# ...content...</div></div>)}  ← already fixed (but overcorrected)
# {/* comment marker

# Let me just do a full rewrite of the 4 dialog blocks

# First, let's extract the file as-is and see the structure around each dialog
lines = content.split('\n')

# Find key line numbers
for i, line in enumerate(lines, 1):
    s = line.strip()
    if 'Create / Edit Dialog' in s:
        print(f"Line {i}: Create/Edit dialog marker")
    if 'Delete Confirmation Dialog' in s:
        print(f"Line {i}: Delete dialog marker")
    if 'Unlock Comment Dialog' in s:
        print(f"Line {i}: Unlock dialog marker")
    if 'History Dialog' in s:
        print(f"Line {i}: History dialog marker")
    if 'Dashboard Statistics' in s:
        print(f"Line {i}: Dashboard marker")
    if '</form>' in s and i > 300:
        print(f"Line {i}: </form>")

# The fix: after each dialog's last </div> from the content panel, add </div>)}
# But instead of trying to count divs, let me use a simpler replacement approach:

# Replace the pattern: </div>\n </div></div>)}\n (overcorrected)  
# with:                 </div>\n </div></div>)}\n (keep it)

# OR replace: </div>\n </div>\n {/* (missing closure)
# with:       </div>\n </div></div>)}\n {/*

# Actually the simplest fix: find exactly the broken patterns

# Pattern 1: Line 393 ends </form>, 394 is </div>, 395 is </div></div>)} - this seems right but has parsing issues
# Let me check what's actually there

for i in [393, 394, 395, 396, 409, 410, 411, 428, 429, 430, 453, 454, 455]:
    if i <= len(lines):
        print(f"  Line {i}: [{lines[i-1].rstrip()}]")

print("\n--- Applying fix ---\n")

# The real fix: each dialog opening creates:
# <div className="fixed inset-0 z-50">  ← outer wrapper
#   <div className="..." onClick={...} />  ← overlay (self-closing)
#   <div className="fixed top-1/2...">     ← panel
#     ...content...
#   </div>  ← close panel
# </div>  ← close outer wrapper (THIS + )} is what's missing)

# So after the panel's closing </div>, we need ONE more </div> then )}
# The script put </div></div>)} which is wrong — it closes the outer wrapper TWICE

# Let me fix each block directly
# Looking at the actual content, after </form> there's:
# </div>  (close the header div wrapping the title)
# </div></div>)} (close panel + close outer + close conditional)
# But wait — the panel div also contains the header div AND the form, so after </form> we need:
# </div>  ← close the panel div content wrapper? No...

# Let me re-examine. The Create/Edit dialog has:
# Line 302: {dialogOpen && (<div wrapper><div overlay />
# Line 303: <div panel>
# Line 304: <div>  ← header group
# Line 305-310: title + description
# Line 310: </p>
# Line 311: </div>  ← close header group
# Then form inputs...
# Line 393: </form>
# Line 394: </div>  ← close panel
# Line 395: </div></div>)}  ← WRONG. Should close outer wrapper + conditional
# But </div></div>)} closes TWO divs then conditional... we only need ONE div close (outer wrapper)

# So the fix is: line 395 should be just </div>)} not </div></div>)}

content = content.replace(
    '</div></div>)}\n {/* ─── Delete Confirmation Dialog',
    '</div>)}\n {/* ─── Delete Confirmation Dialog'
)
content = content.replace(
    '</div></div>)}\n {/* ─── Unlock Comment Dialog',
    '</div>)}\n {/* ─── Unlock Comment Dialog'
)
content = content.replace(
    '</div></div>)}\n {/* ─── History Dialog',
    '</div>)}\n {/* ─── History Dialog'
)
content = content.replace(
    '</div></div>)}\n {/* Dashboard Statistics',
    '</div>)}\n {/* Dashboard Statistics'
)

with open(filepath, 'w') as f:
    f.write(content)

print("✓ Applied closing fixes")
