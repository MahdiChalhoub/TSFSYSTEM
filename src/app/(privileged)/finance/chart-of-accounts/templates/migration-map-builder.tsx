'use client'
import { useState, useEffect, useMemo } from 'react'
import {
    ArrowRight, Zap, Download, Upload, Search, Save, Check, RotateCcw, Link2,
    AlertTriangle, ChevronDown, Layers
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getMigrationMapsList, getMigrationMap, saveMigrationMap,
    type MigrationMapPair, type MigrationMapping
} from '@/app/actions/finance/coa-templates'

/* ═══════════════════════════════════════════════════════════════ */
/*  Migration Map Builder — Interactive Account Mapping UI       */
/* ═══════════════════════════════════════════════════════════════ */

interface Props {
    templates: Record<string, any>
    templateKeys: string[]
}

type FlatAccount = { code: string; name: string; type: string }

function flattenTree(items: any[], result: FlatAccount[] = []): FlatAccount[] {
    for (const item of items) {
        result.push({ code: item.code, name: item.name, type: item.type })
        if (item.children) flattenTree(item.children, result)
    }
    return result
}

const TYPE_COLORS: Record<string, string> = {
    ASSET: 'var(--app-info)',
    LIABILITY: 'var(--app-error)',
    EQUITY: '#8b5cf6',
    INCOME: 'var(--app-success)',
    EXPENSE: 'var(--app-warning)',
}

export default function MigrationMapBuilder({ templates, templateKeys }: Props) {
    const [sourceKey, setSourceKey] = useState(templateKeys[0] || '')
    const [targetKey, setTargetKey] = useState(templateKeys[1] || '')
    const [pairs, setPairs] = useState<MigrationMapPair[]>([])
    const [mappings, setMappings] = useState<MigrationMapping[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<string>('ALL')

    // Flatten account trees for lookup
    const sourceAccounts = useMemo(() => flattenTree(templates[sourceKey] || []), [templates, sourceKey])
    const targetAccounts = useMemo(() => flattenTree(templates[targetKey] || []), [templates, targetKey])

    const sourceByCode = useMemo(() => {
        const map = new Map<string, FlatAccount>()
        sourceAccounts.forEach(a => map.set(a.code, a))
        return map
    }, [sourceAccounts])

    const targetByCode = useMemo(() => {
        const map = new Map<string, FlatAccount>()
        targetAccounts.forEach(a => map.set(a.code, a))
        return map
    }, [targetAccounts])

    // Load available pairs and existing maps
    useEffect(() => {
        getMigrationMapsList().then((res: any) => {
            setPairs(res.pairs || [])
        }).catch(() => { })
    }, [])

    useEffect(() => {
        if (!sourceKey || !targetKey || sourceKey === targetKey) return
        setLoading(true)
        getMigrationMap(sourceKey, targetKey).then((res: any) => {
            setMappings(res.mappings || [])
            setDirty(false)
        }).catch(() => setMappings([])).finally(() => setLoading(false))
    }, [sourceKey, targetKey])

    // Filtered & searched mappings
    const filteredMappings = useMemo(() => {
        let items = mappings
        if (filterType !== 'ALL') {
            items = items.filter(m => {
                const acc = sourceByCode.get(m.source_account_code)
                return acc?.type === filterType
            })
        }
        if (search) {
            const q = search.toLowerCase()
            items = items.filter(m =>
                m.source_account_code.toLowerCase().includes(q) ||
                m.target_account_code.toLowerCase().includes(q) ||
                sourceByCode.get(m.source_account_code)?.name.toLowerCase().includes(q) ||
                targetByCode.get(m.target_account_code)?.name.toLowerCase().includes(q) ||
                (m.notes || '').toLowerCase().includes(q)
            )
        }
        return items
    }, [mappings, filterType, search, sourceByCode, targetByCode])

    // Map statistics
    const stats = useMemo(() => {
        const mapped = mappings.length
        const unmappedSource = sourceAccounts.filter(a => !mappings.some(m => m.source_account_code === a.code)).length
        return { mapped, unmappedSource, total: sourceAccounts.length }
    }, [mappings, sourceAccounts])

    const handleTargetChange = (sourceCode: string, newTargetCode: string) => {
        setMappings(prev => {
            const existing = prev.findIndex(m => m.source_account_code === sourceCode)
            if (existing >= 0) {
                const updated = [...prev]
                updated[existing] = { ...updated[existing], target_account_code: newTargetCode }
                return updated
            }
            return [...prev, { source_account_code: sourceCode, target_account_code: newTargetCode, notes: '' }]
        })
        setDirty(true)
    }

    const handleNotesChange = (sourceCode: string, notes: string) => {
        setMappings(prev => prev.map(m => m.source_account_code === sourceCode ? { ...m, notes } : m))
        setDirty(true)
    }

    const handleSave = async () => {
        if (!sourceKey || !targetKey || sourceKey === targetKey) return
        setSaving(true)
        try {
            await saveMigrationMap({ source_key: sourceKey, target_key: targetKey, mappings })
            toast.success(`Saved ${mappings.length} mappings: ${sourceKey.replace(/_/g, ' ')} → ${targetKey.replace(/_/g, ' ')}`)
            setDirty(false)
        } catch (e: unknown) {
            toast.error('Save failed: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setSaving(false)
        }
    }

    const handleAutoMap = () => {
        // Auto-map accounts with same code
        const newMappings: MigrationMapping[] = [...mappings]
        const existingCodes = new Set(newMappings.map(m => m.source_account_code))

        for (const srcAcc of sourceAccounts) {
            if (existingCodes.has(srcAcc.code)) continue
            const targetMatch = targetAccounts.find(t => t.code === srcAcc.code)
            if (targetMatch) {
                newMappings.push({
                    source_account_code: srcAcc.code,
                    target_account_code: targetMatch.code,
                    notes: 'Auto-matched (same code)',
                })
            }
        }
        setMappings(newMappings)
        setDirty(true)
        toast.info(`Auto-mapped ${newMappings.length - mappings.length} accounts by matching codes`)
    }

    const handleAddUnmapped = () => {
        const existingCodes = new Set(mappings.map(m => m.source_account_code))
        const unmapped = sourceAccounts
            .filter(a => !existingCodes.has(a.code))
            .map(a => ({ source_account_code: a.code, target_account_code: '', notes: '' }))
        if (unmapped.length === 0) {
            toast.info('All source accounts are already mapped')
            return
        }
        setMappings(prev => [...prev, ...unmapped])
        setDirty(true)
        toast.info(`Added ${unmapped.length} unmapped accounts`)
    }

    const swapTemplates = () => {
        const tmp = sourceKey
        setSourceKey(targetKey)
        setTargetKey(tmp)
    }

    if (sourceKey === targetKey && templateKeys.length > 1) {
        setTargetKey(templateKeys.find(k => k !== sourceKey) || '')
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            {/* ── Header / Template Selector ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <select
                        value={sourceKey}
                        onChange={e => setSourceKey(e.target.value)}
                        className="flex-1 min-w-0 text-sm font-bold px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground"
                    >
                        {templateKeys.map(k => (
                            <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
                        ))}
                    </select>

                    <button onClick={swapTemplates} className="p-2 rounded-lg border border-app-border hover:bg-app-hover transition-colors" title="Swap source/target">
                        <RotateCcw size={14} className="text-app-muted-foreground" />
                    </button>

                    <select
                        value={targetKey}
                        onChange={e => setTargetKey(e.target.value)}
                        className="flex-1 min-w-0 text-sm font-bold px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground"
                    >
                        {templateKeys.filter(k => k !== sourceKey).map(k => (
                            <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Stats Strip ── */}
            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}>
                    <Link2 size={12} style={{ color: 'var(--app-success)' }} />
                    <span className="font-bold" style={{ color: 'var(--app-success)' }}>{stats.mapped}</span>
                    <span className="text-app-muted-foreground">mapped</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)' }}>
                    <AlertTriangle size={12} style={{ color: 'var(--app-warning)' }} />
                    <span className="font-bold" style={{ color: 'var(--app-warning)' }}>{stats.unmappedSource}</span>
                    <span className="text-app-muted-foreground">unmapped</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)' }}>
                    <Layers size={12} style={{ color: 'var(--app-info)' }} />
                    <span className="font-bold" style={{ color: 'var(--app-info)' }}>{stats.total}</span>
                    <span className="text-app-muted-foreground">total accounts</span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <button onClick={handleAutoMap} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-app-border hover:bg-app-hover transition-colors text-app-muted-foreground">
                        <Zap size={12} /> Auto-Match
                    </button>
                    <button onClick={handleAddUnmapped} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-app-border hover:bg-app-hover transition-colors text-app-muted-foreground">
                        <Download size={12} /> Add Unmapped
                    </button>
                    {dirty && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
                            style={{ background: 'var(--app-success)', opacity: saving ? 0.6 : 1 }}
                        >
                            {saving ? <RotateCcw size={12} className="animate-spin" /> : <Save size={12} />}
                            {saving ? 'Saving...' : 'Save Mappings'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Search + Filter ── */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search accounts..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-app-border bg-app-surface text-app-foreground placeholder:text-app-muted-foreground"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="text-xs font-bold px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground"
                >
                    <option value="ALL">All Types</option>
                    {['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </div>

            {/* ── Mapping Table ── */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-app-muted-foreground text-sm">
                    <RotateCcw size={16} className="animate-spin mr-2" /> Loading mappings...
                </div>
            ) : (
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar border rounded-xl border-app-border">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10" style={{ background: 'var(--app-surface)' }}>
                            <tr className="border-b border-app-border">
                                <th className="text-left px-3 py-2.5 font-black text-[10px] uppercase tracking-wider text-app-muted-foreground" style={{ width: '30%' }}>Source Account</th>
                                <th className="text-center px-1 py-2.5" style={{ width: '5%' }}></th>
                                <th className="text-left px-3 py-2.5 font-black text-[10px] uppercase tracking-wider text-app-muted-foreground" style={{ width: '35%' }}>Target Account</th>
                                <th className="text-left px-3 py-2.5 font-black text-[10px] uppercase tracking-wider text-app-muted-foreground" style={{ width: '30%' }}>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMappings.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-app-muted-foreground">
                                        {mappings.length === 0
                                            ? 'No mappings yet. Click "Auto-Match" or "Add Unmapped" to start.'
                                            : 'No results match your search.'
                                        }
                                    </td>
                                </tr>
                            ) : filteredMappings.map((m, i) => {
                                const srcAcc = sourceByCode.get(m.source_account_code)
                                const tgtAcc = targetByCode.get(m.target_account_code)
                                const isMapped = !!m.target_account_code

                                return (
                                    <tr key={m.source_account_code + i} className="border-b border-app-border/50 hover:bg-app-hover/30 transition-colors">
                                        {/* Source */}
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded"
                                                    style={{
                                                        background: `color-mix(in srgb, ${TYPE_COLORS[srcAcc?.type || ''] || 'var(--app-muted)'} 12%, transparent)`,
                                                        color: TYPE_COLORS[srcAcc?.type || ''] || 'var(--app-muted-foreground)',
                                                    }}
                                                >
                                                    {m.source_account_code}
                                                </span>
                                                <span className="text-app-foreground truncate">{srcAcc?.name || 'Unknown'}</span>
                                            </div>
                                        </td>

                                        {/* Arrow */}
                                        <td className="text-center">
                                            <ArrowRight size={12} style={{ color: isMapped ? 'var(--app-success)' : 'var(--app-muted-foreground)', opacity: isMapped ? 1 : 0.3 }} />
                                        </td>

                                        {/* Target dropdown */}
                                        <td className="px-3 py-1.5">
                                            <select
                                                value={m.target_account_code}
                                                onChange={e => handleTargetChange(m.source_account_code, e.target.value)}
                                                className="w-full text-xs px-2 py-1.5 rounded-md border border-app-border bg-app-background text-app-foreground"
                                                style={{
                                                    borderColor: isMapped ? 'color-mix(in srgb, var(--app-success) 40%, transparent)' : undefined,
                                                }}
                                            >
                                                <option value="">— Select target —</option>
                                                {targetAccounts.map(t => (
                                                    <option key={t.code} value={t.code}>
                                                        {t.code} — {t.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        {/* Notes */}
                                        <td className="px-3 py-1.5">
                                            <input
                                                type="text"
                                                value={m.notes || ''}
                                                onChange={e => handleNotesChange(m.source_account_code, e.target.value)}
                                                placeholder="Notes..."
                                                className="w-full text-xs px-2 py-1.5 rounded-md border border-app-border bg-app-background text-app-foreground placeholder:text-app-muted-foreground/50"
                                            />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Coverage bar ── */}
            {stats.total > 0 && (
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground">Coverage</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--app-muted) 20%, transparent)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${Math.round((stats.mapped / Math.max(stats.total, 1)) * 100)}%`,
                                background: stats.mapped === stats.total ? 'var(--app-success)' : 'var(--app-info)',
                            }}
                        />
                    </div>
                    <span className="text-xs font-bold text-app-foreground">
                        {Math.round((stats.mapped / Math.max(stats.total, 1)) * 100)}%
                    </span>
                </div>
            )}
        </div>
    )
}
