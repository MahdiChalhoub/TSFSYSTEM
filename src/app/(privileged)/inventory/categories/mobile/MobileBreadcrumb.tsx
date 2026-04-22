// @ts-nocheck
'use client'

import { ChevronRight, Home, X } from 'lucide-react'
import type { CategoryNode } from '../components/types'

/* ═══════════════════════════════════════════════════════════
 *  MobileBreadcrumb — shown above the tree when drilled into a scope
 *  Tap any segment to drill to that ancestor; tap X to exit scope.
 * ═══════════════════════════════════════════════════════════ */

interface Props {
    path: CategoryNode[]   // root → current, in order
    onNavigate: (n: CategoryNode | null) => void   // null = full tree (all roots)
}

export function MobileBreadcrumb({ path, onNavigate }: Props) {
    if (path.length === 0) return null
    return (
        <div className="mb-2 px-3 py-2 flex items-center gap-1 overflow-x-auto rounded-xl"
            style={{
                background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                scrollbarWidth: 'none',
            }}>
            <button onClick={() => onNavigate(null)}
                className="flex items-center justify-center flex-shrink-0 rounded-lg active:scale-90 transition-all"
                style={{
                    width: 28, height: 28,
                    color: 'var(--app-primary)',
                    background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                }}
                aria-label="All categories">
                <Home size={14} />
            </button>
            {path.map((n, i) => (
                <div key={n.id} className="flex items-center gap-1 flex-shrink-0">
                    <ChevronRight size={12} className="text-app-muted-foreground/60 flex-shrink-0" />
                    <button
                        onClick={() => i === path.length - 1 ? null : onNavigate(n)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg active:scale-95 transition-all"
                        style={{
                            background: i === path.length - 1
                                ? 'color-mix(in srgb, var(--app-primary) 14%, transparent)'
                                : 'transparent',
                            color: i === path.length - 1 ? 'var(--app-primary)' : 'var(--app-foreground)',
                            border: i === path.length - 1
                                ? '1px solid color-mix(in srgb, var(--app-primary) 28%, transparent)'
                                : '1px solid transparent',
                        }}>
                        <span className="text-tp-md font-bold truncate max-w-[140px] leading-none">{n.name}</span>
                    </button>
                </div>
            ))}
            <div className="flex-1" />
            <button onClick={() => onNavigate(null)}
                className="flex items-center justify-center flex-shrink-0 rounded-lg active:scale-90 transition-all ml-1"
                style={{
                    width: 28, height: 28,
                    color: 'var(--app-muted-foreground)',
                    background: 'color-mix(in srgb, var(--app-border) 35%, transparent)',
                }}
                aria-label="Exit scope">
                <X size={14} />
            </button>
        </div>
    )
}
