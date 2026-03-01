import os
import re

files = [
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutClassic.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutCompact.tsx'
]

replacements = [
    (r'bg-\[\#020617\]', 'bg-[#f4f6f8]'),
    (r'bg-slate-950/40', 'bg-white/80'),
    (r'bg-slate-950/20', 'bg-white/50'),
    (r'bg-slate-950', 'bg-white'),
    (r'bg-slate-900/40', 'bg-gray-50/80'),
    (r'bg-slate-900', 'bg-gray-50'),
    (r'bg-slate-800', 'bg-gray-100'),
    (r'bg-slate-700', 'bg-gray-200'),
    (r'text-white', 'text-gray-900'),
    (r'text-slate-300', 'text-gray-600'),
    (r'text-slate-400', 'text-gray-500'),
    (r'text-slate-500', 'text-gray-400'),
    (r'border-white/5', 'border-gray-200'),
    (r'border-white/10', 'border-gray-200'),
    (r'border-white/20', 'border-gray-300'),
    (r'ring-white/5', 'ring-black/5'),
    (r'shadow-\[0_30px_60px_rgba\(0,0,0,0\.8\)\]', 'shadow-2xl'),
    (r'placeholder:text-slate-800', 'placeholder:text-gray-400'),
    (r'hover:bg-white/5', 'hover:bg-gray-100'),
    (r'hover:bg-slate-800', 'hover:bg-gray-100'),
    (r'bg-indigo-900/50', 'bg-indigo-50'),
    (r'text-indigo-300', 'text-indigo-600'),
    (r'bg-emerald-900/50', 'bg-emerald-50'),
    (r'text-emerald-300', 'text-emerald-600'),
    (r'bg-amber-900/50', 'bg-amber-50'),
    (r'text-amber-300', 'text-amber-600'),
    (r'bg-rose-900/50', 'bg-rose-50'),
    (r'text-rose-300', 'text-rose-600'),
    (r'custom-scrollbar-dark', 'custom-scrollbar'),
    (r'border-slate-800', 'border-gray-200'),
]

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Exceptions where text-white must stay white (e.g. inside a green button)
    # This might be tricky, but let's just do a naive replacement, and we'll fix button texts 
    # Or to be safe we can target specific classes. But since the entire layout is switching, 
    # it's usually better to just change the base colors. 
    # Actually, a better approach is to simply use the POSLayoutModern's styling structure.
    
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    # Fix the text-white inside buttons which got converted to text-gray-900
    # bg-emerald-600 text-gray-900 -> bg-emerald-600 text-white
    content = re.sub(r'(bg-\w+-500(?:/\d+)?) text-gray-900', r'\1 text-white', content)
    content = re.sub(r'(bg-\w+-600(?:/\d+)?) text-gray-900', r'\1 text-white', content)
    content = re.sub(r'(bg-[a-z]+-gradient) text-gray-900', r'\1 text-white', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
        
print("Replacement script generated and executed.")
