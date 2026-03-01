import re
import os

files = [
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutIntelligence.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutModern.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutCompact.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutClassic.tsx'
]

# We need to explicitly find action buttons and make sure they look great on a light background.
# This means: "bg-emerald-600 border-emerald-600 text-white" instead of previous "text-gray-900".

replacements = [
    (r'text-slate-900', 'text-gray-900'),
    (r'text-slate-800', 'text-gray-800'),
    (r'text-slate-700', 'text-gray-700'),
    (r'text-slate-600', 'text-gray-600'),
    (r'text-slate-500', 'text-gray-500'),
    (r'text-slate-400', 'text-gray-400'),
    
    (r'bg-slate-50', 'bg-gray-50'),
    (r'bg-slate-100', 'bg-gray-100'),
    (r'bg-slate-200', 'bg-gray-200'),
    
    (r'border-slate-200', 'border-gray-200'),
    (r'border-slate-300', 'border-gray-300'),
    (r'ring-slate-100', 'ring-gray-100'),
    (r'ring-slate-200', 'ring-gray-200'),
]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()
            
        for old, new in replacements:
            content = re.sub(old, new, content)
            
        with open(filepath, 'w') as f:
            f.write(content)

print("Button and gray fixes applied.")
