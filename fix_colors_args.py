import sys
import os

def process_file(filepath):
    print(f"Processing {filepath}...")
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Strip inline styles that hardcode dark mode
    content = content.replace("style={{ background: '#0a0f1e' }}", "className=\"bg-app-bg\"")
    content = content.replace("style={{ background: '#0a0f1e', backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(0,212,255,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(99,102,241,0.04) 0%, transparent 50%)' }}", "className=\"bg-app-bg\"")
    content = content.replace("style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }}", "className=\"opacity-10 pointer-events-none mix-blend-overlay\" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '28px 28px' }}")
    
    content = content.replace("style={{ borderColor: 'rgba(0,212,255,0.1)', background: 'linear-gradient(160deg, rgba(0,212,255,0.05) 0%, rgba(99,102,241,0.04) 100%)' }}", "className=\"border-r border-[var(--app-primary-strong)]/10 bg-[var(--app-surface-2)]\"")
    content = content.replace("style={{ color: 'rgba(0,212,255,0.6)' }}", "className=\"text-[var(--app-primary)]/60\"")
    content = content.replace("style={{ color: 'rgba(0,212,255,0.5)' }}", "className=\"text-[var(--app-primary)]/50\"")
    content = content.replace("style={{ color: 'rgba(0,212,255,0.7)' }}", "className=\"text-[var(--app-primary)]/70\"")
    content = content.replace("style={{ color: '#00D4FF' }}", "className=\"text-[var(--app-primary)]\"")
    
    content = content.replace("style={{ background: 'linear-gradient(135deg,rgba(0,212,255,.2),rgba(99,102,241,.2))', border: '1px solid rgba(0,212,255,.3)' }}", "className=\"bg-[var(--app-primary-light)] border border-[var(--app-primary-strong)]/30\"")
    
    content = content.replace("style={{ color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}", "className=\"text-[var(--app-text-muted)] bg-[var(--app-surface-hover)] border border-[var(--app-border)]\"")
    content = content.replace("(e.currentTarget as HTMLElement).style.color = 'rgba(0,212,255,0.8)';", "")
    content = content.replace("(e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.2)';", "")
    content = content.replace("(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)';", "")
    content = content.replace("(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';", "")
    content = content.replace("onMouseEnter={e => {  }}", "")
    content = content.replace("onMouseLeave={e => {  }}", "")
    content = content.replace("onMouseEnter={e => {  (e.currentTarget as HTMLElement).style.color = 'rgba(0,212,255,0.8)'; }}", "")
    content = content.replace("onMouseEnter={e => {  (e.currentTarget as HTMLElement).style.color = 'rgba(0,212,255,0.8)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.2)'; }}", "")
    content = content.replace("onMouseLeave={e => {  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}", "")
    content = content.replace("onMouseLeave={e => {  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}", "")
    
    content = content.replace("style={{ textShadow: '0 0 40px rgba(0,212,255,0.4)' }}", "")
    content = content.replace("style={{ color: 'rgba(255,255,255,0.1)' }}", "className=\"text-[var(--app-text-faint)]\"")
    content = content.replace("style={{ borderColor: 'rgba(255,255,255,0.04)' }}", "className=\"border-[var(--app-border)]\"")

    content = content.replace("style={{ background: '#0a0f1e' }}", "className=\"bg-app-bg\"")

    # 2. Tailwind Colors
    # Cyan
    content = content.replace("text-cyan-400", "text-[var(--app-primary)]")
    content = content.replace("text-cyan-300", "text-[var(--app-primary)]")
    content = content.replace("text-cyan-500", "text-[var(--app-primary-dark)]")
    content = content.replace("bg-cyan-400/8", "bg-[var(--app-primary-light)]")
    content = content.replace("bg-cyan-400/10", "bg-[var(--app-primary-light)]")
    content = content.replace("bg-cyan-400/12", "bg-[var(--app-primary-light)]")
    content = content.replace("bg-cyan-400/15", "bg-[var(--app-primary-light)]")
    content = content.replace("bg-cyan-400/20", "bg-[var(--app-primary-light)]")
    content = content.replace("bg-cyan-400", "bg-[var(--app-primary)]")
    content = content.replace("border-cyan-400/8", "border-[var(--app-primary-strong)]/10")
    content = content.replace("border-cyan-400/12", "border-[var(--app-primary-strong)]/10")
    content = content.replace("border-cyan-400/20", "border-[var(--app-primary-strong)]/20")
    content = content.replace("border-cyan-400/30", "border-[var(--app-primary-strong)]/30")
    content = content.replace("border-cyan-400/50", "border-[var(--app-primary-strong)]/50")
    content = content.replace("border-cyan-400", "border-[var(--app-primary-strong)]")
    content = content.replace("shadow-cyan-400/20", "shadow-[var(--app-primary-glow)]")
    content = content.replace("shadow-cyan-400/30", "shadow-[var(--app-primary-glow)]")
    content = content.replace("shadow-cyan-400/50", "shadow-[var(--app-primary-glow)]")
    content = content.replace("ring-cyan-400/50", "ring-[var(--app-primary-strong)]/50")
    content = content.replace("from-cyan-400/0", "from-[var(--app-primary)]/0")
    content = content.replace("from-cyan-400/8", "from-[var(--app-primary)]/10")
    content = content.replace("from-cyan-400", "from-[var(--app-primary)]")

    # Indigo
    content = content.replace("text-indigo-400", "text-[var(--app-primary)]")
    content = content.replace("text-indigo-300", "text-[var(--app-primary)]")
    content = content.replace("text-indigo-500", "text-[var(--app-primary)]")
    content = content.replace("bg-indigo-400/8", "bg-[var(--app-primary-light)]")
    content = content.replace("bg-indigo-400/10", "bg-[var(--app-primary-light)]")
    content = content.replace("bg-indigo-400/20", "bg-[var(--app-primary-light)]")
    content = content.replace("bg-indigo-400/50", "bg-[var(--app-primary-strong)]/50")
    content = content.replace("border-indigo-400/20", "border-[var(--app-primary-strong)]/20")
    content = content.replace("border-indigo-400/30", "border-[var(--app-primary-strong)]/30")
    content = content.replace("border-indigo-400/50", "border-[var(--app-primary-strong)]/50")
    content = content.replace("border-indigo-400", "border-[var(--app-primary-strong)]")
    content = content.replace("to-indigo-500/0", "to-[var(--app-primary-glow)]/0")
    content = content.replace("to-indigo-500/8", "to-[var(--app-primary-glow)]/10")
    
    # And specifically handle bg-indigo-500 from the older buttons
    content = content.replace("bg-indigo-500/10", "bg-[var(--app-primary-light)]")
    content = content.replace("bg-indigo-500/20", "bg-[var(--app-primary-light)]")
    content = content.replace("bg-indigo-500", "bg-[var(--app-primary)]")

    # Violet
    content = content.replace("text-violet-400", "text-[var(--app-info)]")
    content = content.replace("text-violet-300", "text-[var(--app-info)]")
    content = content.replace("bg-violet-500/10", "bg-[var(--app-info-bg)]")
    content = content.replace("bg-violet-500/15", "bg-[var(--app-info-bg)]")
    content = content.replace("bg-violet-500/20", "bg-[var(--app-info-bg)]")
    content = content.replace("bg-violet-500", "bg-[var(--app-info)]")
    content = content.replace("border-violet-500/30", "border-[var(--app-info)]/30")
    content = content.replace("border-violet-400/50", "border-[var(--app-info)]/50")
    content = content.replace("shadow-violet-500/20", "shadow-sm shadow-[var(--app-info)]/20")

    # Emerald
    content = content.replace("text-emerald-400/80", "text-[var(--app-success)]/80")
    content = content.replace("text-emerald-400", "text-[var(--app-success)]")
    content = content.replace("bg-emerald-400/8", "bg-[var(--app-success-bg)]")
    content = content.replace("bg-emerald-400/15", "bg-[var(--app-success-bg)]")
    content = content.replace("bg-emerald-400/20", "bg-[var(--app-success-bg)]")
    content = content.replace("border-emerald-400/30", "border-[var(--app-success)]/30")
    content = content.replace("border-emerald-400/60", "border-[var(--app-success)]/60")
    content = content.replace("bg-emerald-400", "bg-[var(--app-success)]")
    content = content.replace("shadow-emerald-400", "shadow-sm shadow-[var(--app-success)]")

    # Amber
    content = content.replace("text-amber-400/60", "text-[var(--app-warning)]/60")
    content = content.replace("text-amber-400", "text-[var(--app-warning)]")
    content = content.replace("text-amber-300", "text-[var(--app-warning)]")
    content = content.replace("text-amber-200/70", "text-[var(--app-warning)]/70")
    content = content.replace("bg-amber-400/10", "bg-[var(--app-warning-bg)]")
    content = content.replace("bg-amber-500/15", "bg-[var(--app-warning-bg)]")
    content = content.replace("border-amber-400/20", "border-[var(--app-warning)]/20")
    content = content.replace("border-amber-400/30", "border-[var(--app-warning)]/30")
    content = content.replace("bg-amber-400", "bg-[var(--app-warning)]")

    # Rose
    content = content.replace("text-rose-400", "text-[var(--app-error)]")
    content = content.replace("bg-rose-500/15", "bg-[var(--app-error-bg)]")
    content = content.replace("bg-rose-500/25", "bg-[var(--app-error-bg)]")

    # Teal/gradient mix
    content = content.replace("bg-gradient-to-br from-cyan-400 to-teal-500", "bg-[var(--app-primary)] hover:bg-[var(--app-primary-dark)]")
    
    # White background/borders
    content = content.replace("bg-white/[0.04]", "bg-[var(--app-surface)]")
    content = content.replace("bg-white/[0.03]", "bg-[var(--app-surface-2)]")
    content = content.replace("bg-white/[0.02]", "bg-[var(--app-surface-2)]")
    content = content.replace("bg-white/5", "bg-[var(--app-surface-hover)]")
    content = content.replace("bg-white/8", "bg-[var(--app-surface-hover)]")
    content = content.replace("bg-white/10", "bg-[var(--app-surface-hover)]")
    content = content.replace("bg-white/15", "bg-[var(--app-surface-hover)]")
    content = content.replace("bg-white/20", "bg-[var(--app-surface-hover)]")
    
    content = content.replace("border-white/5", "border-[var(--app-border)]/50")
    content = content.replace("border-white/10", "border-[var(--app-border)]")
    content = content.replace("border-white/20", "border-[var(--app-border)]/80")
    
    # Text colors
    content = content.replace("text-white/10", "text-[var(--app-text-faint)]/50")
    content = content.replace("text-white/15", "text-[var(--app-text-faint)]")
    content = content.replace("text-white/20", "text-[var(--app-text-faint)]")
    content = content.replace("text-white/25", "text-[var(--app-text-faint)]")
    content = content.replace("text-white/30", "text-[var(--app-text-muted)]")
    content = content.replace("text-white/40", "text-[var(--app-text-muted)]")
    content = content.replace("text-white/50", "text-[var(--app-text-muted)]")
    content = content.replace("text-white/80", "text-[var(--app-text)]/80")
    content = content.replace("text-white ", "text-[var(--app-text)] ")
    content = content.replace('text-white"', 'text-[var(--app-text)]"')
    content = content.replace("text-white'", "text-[var(--app-text)]'")
    
    content = content.replace("text-slate-900", "text-white")

    with open(filepath, 'w') as f:
        f.write(content)

for filepath in sys.argv[1:]:
    if os.path.isfile(filepath):
        process_file(filepath)

print("Replacement applied to all provided files")
