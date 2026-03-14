import os
import re

files = [
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutIntelligence.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutModern.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutCompact.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutClassic.tsx'
]

replacements = [
    (r'text-gray-900', 'text-white'), # Restore the buttons that we accidentally broke
    (r'text-white', 'text-slate-900'), # Invert the main text to dark
    (r'bg-white', 'bg-slate-50'), # Base backgrounds to light slate
    (r'bg-slate-900', 'bg-white'), # Make old dark backgrounds white
    (r'bg-slate-950', 'bg-slate-50'), 
    (r'bg-slate-800', 'bg-slate-100'),
    (r'text-slate-200', 'text-slate-800'),
    (r'text-slate-300', 'text-slate-700'),
    (r'text-slate-400', 'text-slate-500'),
    (r'border-white/5', 'border-slate-200'),
    (r'border-white/10', 'border-slate-200'),
    (r'border-white/20', 'border-slate-300'),
    (r'ring-white/5', 'ring-slate-100'),
]

for filepath in files:
    if os.path.exists(filepath):
        # We've messed up the files quite a bit. Let's reset them using git first.
        pass

print("Git checkout to restore original state, then run the proper conversion script.")
