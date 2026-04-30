'use client'

import type { MappingEntry } from './helpers'
import { LEVEL_COLORS } from './MigrationConstants'

// Renders the rows of the mapping table — handles MERGE groups, SPLIT, and 1:1 entries.
export function MigrationMappingRows({
    filteredEntries, balanceMap, sourceAccent, targetAccent,
}: {
    filteredEntries: MappingEntry[]
    balanceMap: Record<string, number>
    sourceAccent: string
    targetAccent: string
}) {
    // Build display items: group MERGE entries by target, keep others as-is
    type DisplayItem =
        | { kind: '1:1'; entry: MappingEntry }
        | { kind: 'split'; entry: MappingEntry }
        | { kind: 'merge-group'; targetCode: string; targetName: string; sources: MappingEntry[] }

    const items: DisplayItem[] = []
    const mergeGroups = new Map<string, MappingEntry[]>()
    const mergeGroupOrder: string[] = []

    for (const entry of filteredEntries) {
        if (entry.isSplit && entry.targets.length > 1) {
            items.push({ kind: 'split', entry })
        } else if (entry.isMerge) {
            const tgtCode = entry.targets[0]?.code || ''
            if (!mergeGroups.has(tgtCode)) {
                mergeGroups.set(tgtCode, [])
                mergeGroupOrder.push(tgtCode)
            }
            mergeGroups.get(tgtCode)!.push(entry)
        } else {
            items.push({ kind: '1:1', entry })
        }
    }

    // Insert merge groups in order of first appearance
    const allItems: DisplayItem[] = []
    let mergeInserted = new Set<string>()
    let entryIdx = 0

    for (const entry of filteredEntries) {
        if (entry.isSplit && entry.targets.length > 1) {
            allItems.push({ kind: 'split', entry })
        } else if (entry.isMerge) {
            const tgtCode = entry.targets[0]?.code || ''
            if (!mergeInserted.has(tgtCode)) {
                mergeInserted.add(tgtCode)
                const sources = mergeGroups.get(tgtCode) || []
                const tgt = sources[0]?.targets[0]
                allItems.push({ kind: 'merge-group', targetCode: tgt?.code || '', targetName: tgt?.name || '', sources })
            }
        } else {
            allItems.push({ kind: '1:1', entry })
        }
    }

    const mergeColor = LEVEL_COLORS['MERGE'] || 'var(--app-warning, #f59e0b)'

    return <>{allItems.map((item, i) => {
        // ── MERGE GROUP: Target header → indented source sub-rows ──
        if (item.kind === 'merge-group') {
            const { targetCode, targetName, sources } = item
            return (
                <div key={`mg-${targetCode}-${i}`}>
                    {/* Target header row */}
                    <div className="flex items-center gap-2 px-4 py-2 transition-all"
                        style={{
                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 15%, transparent)',
                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 5%, var(--app-surface))',
                        }}>
                        <div className="w-16 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <span className="text-tp-xs font-bold uppercase tracking-wider"
                                style={{ color: mergeColor }}>
                                {sources.length} accounts merge into ↓
                            </span>
                        </div>
                        <div className="w-20 flex-shrink-0" />
                        <div className="w-16 flex-shrink-0 text-center">
                            <span className="text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background: `color-mix(in srgb, ${mergeColor} 12%, transparent)`, color: mergeColor,
                                    border: `1px solid color-mix(in srgb, ${mergeColor} 25%, transparent)` }}>
                                MERGE {sources.length}→1
                            </span>
                        </div>
                        <div className="w-16 flex-shrink-0">
                            <span className="text-tp-sm font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                                style={{ background: `color-mix(in srgb, ${targetAccent} 12%, transparent)`, color: targetAccent }}>
                                {targetCode}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-tp-sm font-bold text-app-foreground truncate block">{targetName}</span>
                        </div>
                        <div className="w-10 flex-shrink-0 text-center hidden sm:block">
                            <span className="text-tp-xs font-bold tabular-nums"
                                style={{ color: mergeColor }}>100%</span>
                        </div>
                    </div>
                    {/* Source sub-rows */}
                    {sources.map((src, j) => (
                        <div key={`mg-${targetCode}-${j}`}
                            className="flex items-center gap-2 pl-6 pr-4 py-1 transition-all hover:bg-app-surface/40"
                            style={{
                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 15%, transparent)',
                                borderLeft: `3px solid ${mergeColor}`,
                                marginLeft: '8px',
                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 2%, transparent)',
                            }}>
                            <div className="w-16 flex-shrink-0">
                                <span className="text-tp-sm font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                                    style={{ background: `color-mix(in srgb, ${sourceAccent} 8%, transparent)`, color: sourceAccent }}>
                                    {src.srcCode}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="text-tp-sm font-medium text-app-foreground truncate block">{src.srcName}</span>
                            </div>
                            <div className="w-20 flex-shrink-0 text-right">
                                {(() => { const bal = balanceMap[src.srcCode]; return bal !== undefined && bal !== 0 ? (
                                    <span className="text-tp-xs font-bold tabular-nums" style={{ color: bal > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-danger, #ef4444)' }}>
                                        {bal.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                ) : <span className="text-tp-xs text-app-muted-foreground">—</span> })()}
                            </div>
                            <div className="w-16 flex-shrink-0 text-center">
                                <span className="text-tp-xxs font-bold" style={{ color: mergeColor }}>├─</span>
                            </div>
                            <div className="w-16 flex-shrink-0">
                                <span className="text-tp-xs font-mono font-bold tabular-nums text-app-muted-foreground">{targetCode}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="text-tp-xs text-app-muted-foreground truncate block italic">{targetName}</span>
                            </div>
                            <div className="w-10 flex-shrink-0 text-center hidden sm:block">
                                <span className="text-tp-xs font-bold tabular-nums text-app-muted-foreground">100%</span>
                            </div>
                        </div>
                    ))}
                </div>
            )
        }

        // ── SPLIT row ──
        if (item.kind === 'split') {
            const entry = item.entry
            return (
                <div key={`sp-${i}`}>
                    <div className="flex items-center gap-2 px-4 py-1.5 transition-all"
                        style={{
                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 15%, transparent)',
                            background: 'color-mix(in srgb, var(--app-error) 3%, var(--app-surface))',
                        }}>
                        <div className="w-16 flex-shrink-0">
                            <span className="text-tp-sm font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                                style={{ background: `color-mix(in srgb, ${sourceAccent} 8%, transparent)`, color: sourceAccent }}>
                                {entry.srcCode}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-tp-sm font-bold text-app-foreground truncate block">{entry.srcName}</span>
                        </div>
                        <div className="w-20 flex-shrink-0 text-right">
                            {(() => { const bal = balanceMap[entry.srcCode]; return bal !== undefined && bal !== 0 ? (
                                <span className="text-tp-xs font-bold tabular-nums" style={{ color: bal > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-danger, #ef4444)' }}>
                                    {bal.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                            ) : <span className="text-tp-xs text-app-muted-foreground">—</span> })()}
                        </div>
                        <div className="w-16 flex-shrink-0 text-center">
                            <span className="text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)',
                                    border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)' }}>
                                SPLIT 1→{entry.targets.length}
                            </span>
                        </div>
                        <div className="w-16 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <span className="text-tp-xs font-bold text-app-muted-foreground italic">
                                Split across {entry.targets.length} accounts ↓
                            </span>
                        </div>
                        <div className="w-10 flex-shrink-0 hidden sm:block" />
                    </div>
                    {entry.targets.map((tgt, j) => (
                        <div key={`sp-${i}-${j}`}
                            className="flex items-center gap-2 pl-6 pr-4 py-1 transition-all hover:bg-app-surface/40"
                            style={{
                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 20%, transparent)',
                                borderLeft: '3px solid var(--app-error)',
                                marginLeft: '8px',
                            }}>
                            <div className="w-16 flex-shrink-0" />
                            <div className="flex-1 min-w-0" />
                            <div className="w-20 flex-shrink-0" />
                            <div className="w-16 flex-shrink-0 text-center">
                                <span className="text-tp-xxs font-bold" style={{ color: 'var(--app-error)' }}>├─</span>
                            </div>
                            <div className="w-16 flex-shrink-0">
                                <span className="text-tp-sm font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                                    style={{ background: `color-mix(in srgb, ${targetAccent} 8%, transparent)`, color: targetAccent }}>
                                    {tgt.code}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="text-tp-sm font-medium text-app-foreground truncate block">{tgt.name}</span>
                            </div>
                            <div className="w-10 flex-shrink-0 text-center hidden sm:block">
                                <span className="text-tp-xs font-bold tabular-nums px-1 py-0.5 rounded"
                                    style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>
                                    {tgt.pct}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )
        }

        // ── Standard 1:1 row ──
        const entry = item.entry
        const levelColor = LEVEL_COLORS[entry.matchLevel] || 'var(--app-muted-foreground)'
        const tgt = entry.targets[0]
        return (
            <div key={`s-${i}`} className="flex items-center gap-2 px-4 py-1.5 transition-all hover:bg-app-surface/40"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                <div className="w-16 flex-shrink-0">
                    <span className="text-tp-sm font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                        style={{ background: `color-mix(in srgb, ${sourceAccent} 8%, transparent)`, color: sourceAccent }}>
                        {entry.srcCode}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-tp-sm font-medium text-app-foreground truncate block">{entry.srcName}</span>
                </div>
                <div className="w-20 flex-shrink-0 text-right">
                    {(() => { const bal = balanceMap[entry.srcCode]; return bal !== undefined && bal !== 0 ? (
                        <span className="text-tp-xs font-bold tabular-nums" style={{ color: bal > 0 ? 'var(--app-success, #22c55e)' : bal < 0 ? 'var(--app-danger, #ef4444)' : 'var(--app-muted-foreground)' }}>
                            {bal.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                    ) : <span className="text-tp-xs text-app-muted-foreground">—</span> })()}
                </div>
                <div className="w-16 flex-shrink-0 text-center">
                    <span className="text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                            background: `color-mix(in srgb, ${levelColor} 10%, transparent)`,
                            color: levelColor,
                            border: `1px solid color-mix(in srgb, ${levelColor} 20%, transparent)`,
                        }}>
                        {entry.matchLevel}
                    </span>
                </div>
                <div className="w-16 flex-shrink-0">
                    {tgt ? (
                        <span className="text-tp-sm font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                            style={{ background: `color-mix(in srgb, ${targetAccent} 8%, transparent)`, color: targetAccent }}>
                            {tgt.code}
                        </span>
                    ) : (
                        <span className="text-tp-xs font-bold text-app-muted-foreground">—</span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-tp-sm font-medium text-app-foreground truncate block">
                        {tgt?.name || '—'}
                    </span>
                </div>
                <div className="w-10 flex-shrink-0 text-center hidden sm:block">
                    <span className="text-tp-xs font-bold tabular-nums text-app-muted-foreground">100%</span>
                </div>
            </div>
        )
    })}</>
}
