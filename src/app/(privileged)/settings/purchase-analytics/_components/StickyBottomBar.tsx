'use client'

import { Save, Loader2, CheckCircle2, Eye, Undo2 } from 'lucide-react'

type Props = {
    visible: boolean
    label: string
    isPending: boolean
    saved: boolean
    showDiffBtn: boolean
    showUndoBtn: boolean
    onUndo: () => void
    onShowDiff: () => void
    onSave: () => void
}

export function StickyBottomBar({ visible, label, isPending, saved, showDiffBtn, showUndoBtn, onUndo, onShowDiff, onSave }: Props) {
    if (!visible) return null

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-3 duration-300"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 85%, transparent)',
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px color-mix(in srgb, var(--app-primary) 10%, transparent)',
                padding: '8px 16px',
            }}>
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-app-muted-foreground truncate max-w-[150px]">{label}</span>
                <div className="w-px h-4" style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }} />

                {showUndoBtn && (
                    <button type="button" onClick={onUndo}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <Undo2 size={10} /> Undo
                    </button>
                )}

                {showDiffBtn && (
                    <button type="button" onClick={onShowDiff}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)', color: 'var(--app-primary)' }}>
                        <Eye size={10} /> Review
                    </button>
                )}

                {saved ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>
                        <CheckCircle2 size={12} /> Saved
                    </span>
                ) : (
                    <button type="button" onClick={onSave} disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black text-white transition-all disabled:opacity-50"
                        style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        {isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                        Save
                    </button>
                )}
            </div>
        </div>
    )
}
