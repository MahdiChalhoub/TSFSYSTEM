#!/usr/bin/env python3
"""
Fix broken Dialog patterns in vouchers/page.tsx.
Replace the broken <div data-dialog open={...} onOpenChange={...}> patterns 
with proper conditional rendering: {condition && <div className="fixed...">...}
"""

filepath = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/finance/vouchers/page.tsx"

with open(filepath) as f:
    content = f.read()

# ── Fix 1: Create/Edit Dialog ──
content = content.replace(
    '<div data-dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true) }}>',
    '{dialogOpen && (<div className="fixed inset-0 z-50"><div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closeDialog} />'
)

# ── Fix 2: Delete Confirmation Dialog ──  
content = content.replace(
    '<div data-dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>',
    '{deleteConfirm !== null && (<div className="fixed inset-0 z-50"><div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />'
)

# ── Fix 3: Unlock Comment Dialog ──
content = content.replace(
    '<div data-dialog open={commentDialog !== null} onOpenChange={(open) => { if (!open) setCommentDialog(null) }}>',
    '{commentDialog !== null && (<div className="fixed inset-0 z-50"><div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCommentDialog(null)} />'
)

# ── Fix 4: History Dialog ──
content = content.replace(
    '<div data-dialog open={historyDialog !== null} onOpenChange={(open) => { if (!open) setHistoryDialog(null) }}>',
    '{historyDialog !== null && (<div className="fixed inset-0 z-50"><div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setHistoryDialog(null)} />'
)

# ── Fix dialog content wrappers ──
# The old <div className="sm:max-w-lg"> should become centered modal panels
content = content.replace(
    '<div className="sm:max-w-lg">',
    '<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-app-surface border border-app-border rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>'
)
content = content.replace(
    '<div className="sm:max-w-sm">',
    '<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>'
)
content = content.replace(
    '<div className="sm:max-w-md">',
    '<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>'
)

# ── Fix closing </div> matching ──
# Each dialog section originally had: </DialogContent></Dialog>
# This became: </div></div>
# Now we need: </div></div>)} 
# We need to close the conditional and the overlay div
# 
# The pattern "  </div>\n  </div>\n" at the end of each dialog needs to add ")}"
# Let me find and fix the specific patterns by looking for the comment markers

# Fix 1: End of Create/Edit dialog (before Delete Confirmation comment)
content = content.replace(
    '  </div>\n  {/* ─── Delete Confirmation Dialog',
    '  </div></div>)}\n  {/* ─── Delete Confirmation Dialog'
)

# Fix 2: End of Delete dialog (before Unlock Comment comment) 
content = content.replace(
    '  </div>\n  {/* ─── Unlock Comment Dialog',
    '  </div></div>)}\n  {/* ─── Unlock Comment Dialog'
)

# Fix 3: End of Unlock dialog (before History Dialog comment)
content = content.replace(
    '  </div>\n  {/* ─── History Dialog',
    '  </div></div>)}\n  {/* ─── History Dialog'
)

# Fix 4: End of History dialog (before Dashboard Statistics comment)
content = content.replace(
    '  </div>\n  {/* Dashboard Statistics',
    '  </div></div>)}\n  {/* Dashboard Statistics'
)

# ── Fix forms that had <input> within dialogs using old Input component classes ──
# Add proper V2 input classes to bare inputs inside modals
import re
content = re.sub(
    r'className="rounded-xl"(\s*defaultValue)',
    r'className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-surface text-sm text-app-foreground focus:outline-none focus:ring-1 focus:ring-app-primary/30"\1',
    content
)

# ── Fix buttons that lost proper styling ──
# "Cancel" button pattern
content = content.replace(
    'className="rounded-xl">Cancel</button>',
    'className="px-4 py-2 rounded-xl text-sm font-bold text-app-muted-foreground hover:bg-app-muted/10 transition-all">Cancel</button>'
)

# Fix remaining <input that need V2 classes
content = content.replace(
    'className="rounded-xl" defaultValue',
    'className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-surface text-sm text-app-foreground focus:outline-none focus:ring-1 focus:ring-app-primary/30" defaultValue'
)

with open(filepath, 'w') as f:
    f.write(content)

print("✓ Fixed vouchers/page.tsx dialog patterns")
