import os
import re

files = [
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutClassic.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutCompact.tsx'
]

replacements = [
    (r'text-slate-100', 'text-gray-900'),
    (r'text-slate-200', 'text-gray-800'),
    (r'text-white/80', 'text-gray-600'),
    (r'text-white/60', 'text-gray-500'),
    (r'text-white/40', 'text-gray-400'),
    (r'border-white/50', 'border-gray-300'),
    # Fix buttons where text-gray-900 should be text-white
    (r'(bg-\w+-600\s+)text-gray-900', r'\1text-white'),
    (r'(bg-\w+-500\s+)text-gray-900', r'\1text-white'),
    (r'(bg-gradient-to-br[^\'"]+)\s+text-gray-900', r'\1 text-white'),
]

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    with open(filepath, 'w') as f:
        f.write(content)
        
print("Replacement script 2 generated and executed.")
