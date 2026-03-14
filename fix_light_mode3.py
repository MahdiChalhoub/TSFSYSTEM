import os
import re

files = [
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutIntelligence.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutModern.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutSelector.tsx'
]

replacements = [
    (r'bg-\[\#020617\]', 'bg-[#f4f6f8]'),
    (r'bg-slate-950/40', 'bg-white/80'),
    (r'bg-slate-950/80', 'bg-white'),
    (r'bg-slate-950', 'bg-white'),
    (r'bg-slate-900/40', 'bg-gray-50/80'),
    (r'bg-slate-900/50', 'bg-gray-50'),
    (r'bg-slate-900/90', 'bg-white'),
    (r'bg-slate-900', 'bg-gray-50'),
    (r'bg-slate-800', 'bg-gray-100'),
    (r'bg-slate-700', 'bg-gray-200'),
    
    (r'bg-\[\#0F172A\]', 'bg-white'),
    (r'bg-black/40', 'bg-gray-100'),
    
    (r'text-white', 'text-gray-900'),
    (r'text-slate-200', 'text-gray-800'),
    (r'text-slate-300', 'text-gray-600'),
    (r'text-slate-400', 'text-gray-500'),
    (r'text-slate-500', 'text-gray-400'),
    
    (r'border-white/5', 'border-gray-200'),
    (r'border-white/10', 'border-gray-200'),
    (r'border-white/20', 'border-gray-300'),
    (r'ring-white/5', 'ring-black/5'),
    (r'shadow-\[0_30px_60px_rgba\(0,0,0,0\.8\)\]', 'shadow-2xl'),
    (r'shadow-\[0_50px_100px_rgba\(0,0,0,0\.6\)\]', 'shadow-2xl'),
    (r'placeholder:text-slate-800', 'placeholder:text-gray-400'),
    (r'placeholder:text-slate-700', 'placeholder:text-gray-400'),
    
    (r'hover:bg-white/5', 'hover:bg-gray-100'),
    (r'hover:bg-slate-800', 'hover:bg-gray-100'),
    
    (r'custom-scrollbar-dark', 'custom-scrollbar'),
    (r'border-slate-800', 'border-gray-200'),
    
    # Text reverse for gradients/primary backgrounds
    (r'(bg-\w+-600(?:/\d+)?) text-gray-900', r'\1 text-white'),
    (r'(bg-\w+-500(?:/\d+)?) text-gray-900', r'\1 text-white'),
    (r'(bg-emerald-gradient) text-gray-900', r'\1 text-white'),
    (r'(bg-[a-z]+-gradient) text-gray-900', r'\1 text-white'),
    
    # Intelligence Layout Specific Tweaks
    (r'text-white/60', 'text-gray-500'),
]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()
        
        for old, new in replacements:
            content = re.sub(old, new, content)
            
        with open(filepath, 'w') as f:
            f.write(content)
        
print("Replacement script 3 generated and executed.")
