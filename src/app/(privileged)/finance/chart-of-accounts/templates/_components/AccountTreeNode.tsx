'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

// ══════════════════════════════════════════════════════════════════
// Account Tree Node
// ══════════════════════════════════════════════════════════════════
export function AccountTreeNode({ item, level, accent, expandAll }: { item: any; level: number; accent: string; expandAll: boolean }) {
    const [open, setOpen] = useState(level < 1)
    const hasChildren = item.children && item.children.length > 0
    const isRoot = level === 0
    useEffect(() => { setOpen(expandAll || level < 1) }, [expandAll, level])

    const typeColor: Record<string, string> = {
        ASSET: 'var(--app-info, #3b82f6)', LIABILITY: 'var(--app-error, #ef4444)',
        EQUITY: 'var(--app-info)', INCOME: 'var(--app-success, #22c55e)', EXPENSE: 'var(--app-warning, #f59e0b)',
    }
    const tc = typeColor[item.type] || 'var(--app-muted-foreground)'
    const reportTag = ['ASSET', 'LIABILITY', 'EQUITY'].includes(item.type) ? 'BS' : 'P&L'
    const rc = reportTag === 'BS' ? 'var(--app-info, #3b82f6)' : 'var(--app-warning, #f59e0b)'

    return (
        <div>
            <div onClick={() => hasChildren && setOpen(!open)}
                className={`group flex items-center gap-2 transition-all duration-150 border-b hover:bg-app-surface/40 ${hasChildren ? 'cursor-pointer' : ''}`}
                style={{
                    paddingLeft: isRoot ? '12px' : `${12 + level * 20}px`,
                    paddingRight: '12px', paddingTop: isRoot ? '8px' : '5px', paddingBottom: isRoot ? '8px' : '5px',
                    background: isRoot ? `color-mix(in srgb, ${accent} 4%, var(--app-surface))` : undefined,
                    borderLeft: isRoot ? `3px solid ${accent}` : '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                    marginLeft: !isRoot ? `${12 + (level - 1) * 20 + 10}px` : undefined,
                }}>
                <div className="w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0"
                    style={{ color: hasChildren ? 'var(--app-muted-foreground)' : 'var(--app-border)' }}>
                    {hasChildren ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: tc }} />
                    )}
                </div>
                <span className="w-16 flex-shrink-0 font-mono text-tp-sm font-bold tabular-nums"
                    style={{ color: isRoot ? accent : 'var(--app-muted-foreground)' }}>{item.code}</span>
                <span className={`flex-1 min-w-0 truncate text-tp-lg ${isRoot ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}>
                    {item.name}
                </span>
                {item.type && (
                    <span className="text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 hidden sm:block"
                        style={{ background: `color-mix(in srgb, ${tc} 10%, transparent)`, color: tc,
                            border: `1px solid color-mix(in srgb, ${tc} 20%, transparent)` }}>
                        {item.type}
                    </span>
                )}
                {item.type && (
                    <span className="text-tp-xxs font-bold px-1 rounded flex-shrink-0 hidden md:block"
                        style={{ background: `color-mix(in srgb, ${rc} 10%, transparent)`, color: rc }}>
                        [{reportTag}]
                    </span>
                )}
            </div>
            {hasChildren && open && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {item.children.map((child: any, i: number) => (
                        <AccountTreeNode key={i} item={child} level={level + 1} accent={accent} expandAll={expandAll} />
                    ))}
                </div>
            )}
        </div>
    )
}
