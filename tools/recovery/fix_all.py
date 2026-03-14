import re

files = [
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutIntelligence.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutModern.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutCompact.tsx',
    '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutClassic.tsx'
]

replacements = [
    (r'bg-\[\#020617\]', 'bg-slate-50'),
    (r'bg-\[\#0F172A\]', 'bg-white'),
    (r'bg-slate-950/40', 'bg-white/80'),
    (r'bg-slate-950/80', 'bg-white/90'),
    (r'bg-slate-950', 'bg-white'),
    (r'bg-slate-900/40', 'bg-slate-50/80'),
    (r'bg-slate-900/50', 'bg-slate-50'),
    (r'bg-slate-900/90', 'bg-white/95'),
    (r'bg-slate-900/30', 'bg-slate-50'),
    (r'bg-slate-900', 'bg-white'),
    (r'bg-slate-800', 'bg-slate-100'),
    (r'bg-slate-700', 'bg-slate-200'),
    
    # Border & rings
    (r'border-white/5', 'border-slate-200'),
    (r'border-white/10', 'border-slate-200'),
    (r'border-white/20', 'border-slate-300'),
    (r'ring-white/5', 'ring-slate-200'),
    (r'ring-white/10', 'ring-slate-200'),
    
    # Text colors
    (r'text-slate-200', 'text-slate-800'),
    (r'text-slate-300', 'text-slate-700'),
    (r'text-slate-400', 'text-slate-500'),
    (r'text-slate-500', 'text-slate-400'),
    (r'text-white/60', 'text-slate-500'),
    
    # Specific elements
    (r'bg-black/40', 'bg-slate-100'),
    (r'shadow-\[0_30px_60px_rgba\(0,0,0,0\.8\)\]', 'shadow-2xl'),
    (r'shadow-\[0_50px_100px_rgba\(0,0,0,0\.6\)\]', 'shadow-2xl'),
    (r'placeholder:text-slate-800', 'placeholder:text-slate-400'),
    (r'placeholder:text-slate-700', 'placeholder:text-slate-400'),
    
    # Hover effects
    (r'hover:bg-white/5', 'hover:bg-slate-50'),
    (r'hover:border-white/10', 'hover:border-slate-300'),
    
    # Scrollbar
    (r'custom-scrollbar-dark', 'custom-scrollbar'),
]

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    # Careful handling of text-white -> text-slate-900
    # but ONLY if not in specific components (e.g. bg-emerald, buttons, gradients)
    # 1. Replace ALL text-white with text-slate-900
    content = re.sub(r'\btext-white\b', 'text-slate-900', content)
    
    # 2. Restore text-slate-900 back to text-white conditionally
    # bg-* something followed by text-slate-900 up to 100 chars
    def restore_white(match):
        return match.group(0).replace('text-slate-900', 'text-white')
        
    content = re.sub(r'(bg-\w+-600\b[^>]{0,100}text-slate-900)', restore_white, content)
    content = re.sub(r'(bg-\w+-500\b[^>]{0,100}text-slate-900)', restore_white, content)
    content = re.sub(r'(bg-emerald-gradient\b[^>]{0,100}text-slate-900)', restore_white, content)
    content = re.sub(r'(bg-amber-gradient\b[^>]{0,100}text-slate-900)', restore_white, content)
    content = re.sub(r'(bg-indigo-600\b[^>]{0,100}text-slate-900)', restore_white, content)
    content = re.sub(r'(bg-rose-500\b[^>]{0,100}text-slate-900)', restore_white, content)
    content = re.sub(r'(bg-blue-600\b[^>]{0,100}text-slate-900)', restore_white, content)
    content = re.sub(r'(bg-gradient-to-br\b[^>]{0,100}text-slate-900)', restore_white, content)
        
    with open(filepath, 'w') as f:
        f.write(content)
        
print("Conversion complete.")
