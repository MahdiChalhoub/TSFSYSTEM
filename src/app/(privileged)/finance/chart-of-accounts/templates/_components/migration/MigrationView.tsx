'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    Search, Zap, Loader2, ArrowRight, ArrowRightLeft,
} from 'lucide-react'
import { ACCENT_MAP, resolveIcon } from '../icons'
import type { TemplateInfo } from '../types'
import { EmptyState } from '../EmptyState'
import { buildAutoMapping } from './buildAutoMapping'
import { MigrationStatsStrip } from './MigrationStatsStrip'
import { MigrationMappingRows } from './MigrationMappingRows'

// ══════════════════════════════════════════════════════════════════
// Migration View — Full Auto-Mapper (Merge N:1 + Split 1:N)
// ══════════════════════════════════════════════════════════════════
export function MigrationView({
    templates, templatesMap, migrationMaps, autoMigration, onApplyImport, isPending, accountBalances,
}: {
    templates: TemplateInfo[]; templatesMap: Record<string, any>
    migrationMaps: Record<string, Record<string, string>>
    autoMigration?: { from: string; to: string } | null
    onApplyImport?: (targetKey: string, accountMapping: Record<string, string>) => Promise<void>
    isPending?: boolean
    accountBalances?: { code: string; name: string; type: string; balance: number }[]
}) {
    const [sourceKey, setSourceKey] = useState<string>(autoMigration?.from || '')
    const [targetKey, setTargetKey] = useState<string>(autoMigration?.to || '')
    const [migSearch, setMigSearch] = useState('')
    const [filterLevel, setFilterLevel] = useState<string>('ALL')

    // Auto-select when autoMigration prop changes
    useEffect(() => {
        if (autoMigration) {
            setSourceKey(autoMigration.from)
            setTargetKey(autoMigration.to)
        }
    }, [autoMigration])

    const availableTargets = useMemo(() => {
        if (!sourceKey) return []
        return templates.filter(t => t.key !== sourceKey)
    }, [sourceKey, templates])

    // Build balance lookup from real DB data
    const balanceMap = useMemo(() => {
        const map: Record<string, number> = {}
        for (const acc of accountBalances || []) {
            map[acc.code] = acc.balance
        }
        return map
    }, [accountBalances])

    // ── Build full auto-mapping with ZERO unmapped ──
    const fullMapping = useMemo(
        () => buildAutoMapping(sourceKey, targetKey, templatesMap, migrationMaps),
        [sourceKey, targetKey, templatesMap, migrationMaps],
    )

    // Filter entries
    const filteredEntries = useMemo(() => {
        let entries = fullMapping
        if (filterLevel !== 'ALL') {
            entries = entries.filter(e => e.matchLevel === filterLevel)
        }
        if (migSearch) {
            const q = migSearch.toLowerCase()
            entries = entries.filter(e =>
                e.srcCode.toLowerCase().includes(q) || e.srcName.toLowerCase().includes(q) ||
                e.targets.some(t => t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
            )
        }
        return entries
    }, [fullMapping, filterLevel, migSearch])

    // Stats
    const stats = useMemo(() => {
        const byLevel: Record<string, number> = {}
        for (const e of fullMapping) {
            byLevel[e.matchLevel] = (byLevel[e.matchLevel] || 0) + 1
        }
        return byLevel
    }, [fullMapping])

    const sourceAccent = ACCENT_MAP[sourceKey] || 'var(--app-primary)'
    const targetAccent = ACCENT_MAP[targetKey] || 'var(--app-info, #3b82f6)'

    return (
        <div>
            {/* Source/Target selectors */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wide mb-1 block">
                        Source Template
                    </label>
                    <select value={sourceKey} onChange={e => { setSourceKey(e.target.value); setTargetKey('') }}
                        className="w-full text-tp-md font-bold px-3 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none">
                        <option value="">Select source...</option>
                        {templates.map(t => <option key={t.key} value={t.key}>{t.name} ({t.region})</option>)}
                    </select>
                </div>
                <div className="flex items-center pt-4">
                    <ArrowRightLeft size={20} className="text-app-muted-foreground" />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wide mb-1 block">
                        Target Template
                    </label>
                    <select value={targetKey} onChange={e => setTargetKey(e.target.value)}
                        disabled={!sourceKey}
                        className="w-full text-tp-md font-bold px-3 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none disabled:opacity-40">
                        <option value="">Select target...</option>
                        {availableTargets.map(t => <option key={t.key} value={t.key}>{t.name} ({t.region})</option>)}
                    </select>
                </div>
            </div>

            {!sourceKey || !targetKey ? (
                <EmptyState icon={ArrowRightLeft} text="Select source and target templates"
                    subtitle="Full auto-mapping with merge & split — zero unmapped accounts." />
            ) : (
                <div>
                    {/* Stats strip */}
                    <MigrationStatsStrip
                        fullMappingCount={fullMapping.length}
                        stats={stats}
                        filterLevel={filterLevel}
                        setFilterLevel={setFilterLevel}
                    />

                    {/* Mapping table */}
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                                borderBottom: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${sourceAccent} 15%, transparent)`, color: sourceAccent }}>
                                        {(() => { const t = templates.find(t => t.key === sourceKey); const I = resolveIcon(t?.icon); return <I size={13} /> })()}
                                    </div>
                                    <span className="text-tp-md font-bold text-app-foreground">{templates.find(t => t.key === sourceKey)?.name}</span>
                                </div>
                                <ArrowRight size={16} className="text-app-muted-foreground" />
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${targetAccent} 15%, transparent)`, color: targetAccent }}>
                                        {(() => { const t = templates.find(t => t.key === targetKey); const I = resolveIcon(t?.icon); return <I size={13} /> })()}
                                    </div>
                                    <span className="text-tp-md font-bold text-app-foreground">{templates.find(t => t.key === targetKey)?.name}</span>
                                </div>
                            </div>
                            <div className="relative">
                                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input type="text" value={migSearch} onChange={e => setMigSearch(e.target.value)}
                                    placeholder="Filter mappings..."
                                    className="pl-7 pr-2 py-1 text-tp-sm bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground outline-none w-44" />
                            </div>
                        </div>

                        {/* Column headers */}
                        <div className="flex items-center gap-2 px-4 py-1.5 text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wider"
                            style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                            <div className="w-16 flex-shrink-0">Source</div>
                            <div className="flex-1 min-w-0">Source Account</div>
                            <div className="w-20 flex-shrink-0 text-right">Balance</div>
                            <div className="w-16 flex-shrink-0 text-center">Strategy</div>
                            <div className="w-16 flex-shrink-0">Target</div>
                            <div className="flex-1 min-w-0">Target Account</div>
                            <div className="w-10 flex-shrink-0 text-center hidden sm:block">%</div>
                        </div>

                        {/* Rows — grouped rendering */}
                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                            <MigrationMappingRows
                                filteredEntries={filteredEntries}
                                balanceMap={balanceMap}
                                sourceAccent={sourceAccent}
                                targetAccent={targetAccent}
                            />
                        </div>

                        {/* Footer with Apply */}
                        <div className="px-4 py-3 flex items-center justify-between"
                            style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                            <div className="flex items-center gap-3">
                                <span className="text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wide">
                                    {filteredEntries.length} of {fullMapping.length} mappings
                                </span>
                                {(stats['MERGE'] || 0) > 0 && (
                                    <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                                        style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                                            color: 'var(--app-warning, #f59e0b)' }}>
                                        {stats['MERGE']} merges
                                    </span>
                                )}
                                {(stats['SPLIT'] || 0) > 0 && (
                                    <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                                        style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>
                                        {stats['SPLIT']} splits
                                    </span>
                                )}
                                <span className="text-tp-sm font-bold tabular-nums px-2 py-0.5 rounded"
                                    style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                                        color: 'var(--app-success, #22c55e)' }}>
                                    100% mapped
                                </span>
                            </div>
                            {onApplyImport && targetKey && (
                                <button
                                    onClick={() => {
                                        // Build source_code → target_code mapping from fullMapping
                                        const mapping: Record<string, string> = {}
                                        for (const entry of fullMapping) {
                                            if (entry.targets.length > 0) {
                                                // Use the first (primary) target for the mapping
                                                mapping[entry.srcCode] = entry.targets[0].code
                                            }
                                        }
                                        onApplyImport(targetKey, mapping)
                                    }}
                                    disabled={isPending || fullMapping.length === 0}
                                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-tp-md font-bold uppercase tracking-wider transition-all"
                                    style={{
                                        background: isPending ? 'var(--app-muted)' : 'var(--app-success, #22c55e)',
                                        color: 'white',
                                        opacity: isPending || fullMapping.length === 0 ? 0.5 : 1,
                                        cursor: isPending ? 'wait' : 'pointer',
                                    }}>
                                    {isPending ? (
                                        <><Loader2 size={14} className="animate-spin" /> Migrating...</>
                                    ) : (
                                        <><Zap size={14} /> Apply Migration &amp; Import</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
