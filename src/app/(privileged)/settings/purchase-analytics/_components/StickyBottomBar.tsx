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

export function StickyBottomBar({
    visible, label, isPending, saved, showDiffBtn, showUndoBtn,
    onUndo, onShowDiff, onSave,
}: Props) {
    if (!visible) return null
    return (
        <div data-sticky-bar className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-app-surface/95 backdrop-blur-md border border-app-border shadow-2xl animate-[fadeIn_0.15s_ease-in-out]">
            <span className="text-[10px] text-app-muted-foreground font-bold">{label}</span>
            {showUndoBtn && (
                <button type="button" onClick={onUndo} aria-label="Undo last change"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border transition-all">
                    <Undo2 size={9} /> Undo
                </button>
            )}
            {showDiffBtn && (
                <button type="button" onClick={onShowDiff} aria-label="Preview changes"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-amber-600 border border-amber-500/30 hover:bg-amber-500/10 transition-all">
                    <Eye size={9} /> Diff
                </button>
            )}
            <button onClick={onSave} disabled={isPending} aria-label="Save configuration"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 bg-app-primary text-white rounded-lg text-[11px] font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm ${saved ? 'ring-2 ring-emerald-400/50' : ''}`}>
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {saved ? 'Saved!' : 'Save'}
            </button>
        </div>
    )
}
