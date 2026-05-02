'use client'

/**
 * BulkActionBar — floating toolbar when N>0 brands are selected.
 *   - Move products (reassign to target brand)
 *   - Delete (with safe/blocked split)
 *
 * Mirrors categories/components/BulkActionBar.tsx pattern.
 */

import { X, ArrowRightLeft, Trash2 } from 'lucide-react'

interface Props {
    count: number
    onMove: () => void
    onDelete: () => void
    onClear: () => void
}

export function BulkActionBar({ count, onMove, onDelete, onClear }: Props) {
    if (count === 0) return null
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-2xl animate-in slide-in-from-bottom-4 duration-200"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
            }}>
            <div className="px-3 py-1.5 rounded-xl text-tp-sm font-bold"
                style={{
                    background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                    color: 'var(--app-primary)',
                }}>
                {count} selected
            </div>
            <button onClick={onMove}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--app-background)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}>
                <ArrowRightLeft size={13} /> Merge Products
            </button>
            <button onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold transition-all hover:-translate-y-0.5"
                style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)' }}>
                <Trash2 size={13} /> Delete
            </button>
            <button onClick={onClear}
                title="Clear selection"
                className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                style={{ color: 'var(--app-muted-foreground)' }}>
                <X size={14} />
            </button>
        </div>
    )
}
