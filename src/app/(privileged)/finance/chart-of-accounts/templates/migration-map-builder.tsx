'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
    ArrowRight, Zap, Download, Search, Save, RotateCcw, Link2,
    AlertTriangle, Layers, ChevronLeft, ChevronRight, Shield, ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getMigrationMapsList, getMigrationMap, saveMigrationMap, rematchMigrationMap,
    getMigrationMapQuality, setMigrationMapStatus,
    type MigrationMapPair, type MigrationMapping, type QualityReport, type MapApprovalStatus
} from '@/app/actions/finance/coa-templates'

/* ═══════════════════════════════════════════════════════════════ */
/*  Migration Map Builder — Interactive Account Mapping UI       */
/* ═══════════════════════════════════════════════════════════════ */

interface Props {
    templates: Record<string, any>
    templateKeys: string[]
}

type FlatAccount = { code: string; name: string; type: string; system_role?: string; sub_type?: string }

function flattenTree(items: any[], result: FlatAccount[] = []): FlatAccount[] {
    for (const item of items) {
        const code = String(item.code || '').trim()
        if (code) {
            result.push({
                code,
                name: item.name || `Account ${code}`,
                type: item.type,
                system_role: item.system_role,
                sub_type: item.sub_type
            })
        }
        if (item.children) flattenTree(item.children, result)
    }
    return result
}

const TYPE_COLORS: Record<string, string> = {
    ASSET: 'var(--app-info)',
    LIABILITY: 'var(--app-error)',
    EQUITY: 'var(--app-info)',
    INCOME: 'var(--app-success)',
    EXPENSE: 'var(--app-warning)',
}

const PAGE_SIZE = 25

export default function MigrationMapBuilder({ templates, templateKeys }: Props) {
    const [sourceKey, setSourceKey] = useState(templateKeys[0] || '')
    const [targetKey, setTargetKey] = useState(templateKeys[1] || templateKeys[0] || '')
    const [mappings, setMappings] = useState<MigrationMapping[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<string>('ALL')
    const [page, setPage] = useState(0)
    const [quality, setQuality] = useState<any>(null)
    const [qualityReport, setQualityReport] = useState<QualityReport | null>(null)
    const [mapStatus, setMapStatus] = useState<MapApprovalStatus>('DRAFT')
    const autoMapRan = useRef(false)

    // Flatten account trees for lookup
    const sourceAccounts = useMemo(() => flattenTree(templates[sourceKey] || []), [templates, sourceKey])
    const targetAccounts = useMemo(() => flattenTree(templates[targetKey] || []), [templates, targetKey])

    const sourceByCode = useMemo(() => {
        const map = new Map<string, FlatAccount>()
        sourceAccounts.forEach(a => map.set(String(a.code).trim(), a))
        return map
    }, [sourceAccounts])

    const targetByCode = useMemo(() => {
        const map = new Map<string, FlatAccount>()
        targetAccounts.forEach(a => map.set(String(a.code).trim(), a))
        return map
    }, [targetAccounts])

    // Smart auto-map function (pure, no side-effects)
    // Uses 4-level matching: Role → Code → Exact Name → Fuzzy Name
    // Unmatched accounts are left UNMAPPED (no broken type-only fallback)
    const computeAutoMap = useCallback(() => {
        const tgtByRole = new Map<string, FlatAccount>()
        const tgtByCode = new Map<string, FlatAccount>()
        const tgtByNorm = new Map<string, FlatAccount>()
        for (const t of targetAccounts) {
            if (t.system_role) tgtByRole.set(t.system_role, t)
            tgtByCode.set(t.code, t)
            tgtByNorm.set(t.name.toLowerCase().trim(), t)
        }

        // Tokenize a name for fuzzy matching
        const tokenize = (s: string) => {
            return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean))
        }
        const tokenOverlap = (a: Set<string>, b: Set<string>): number => {
            if (a.size === 0 || b.size === 0) return 0
            let shared = 0
            for (const t of a) if (b.has(t)) shared++
            return shared / Math.max(a.size, b.size)
        }

        // Pre-tokenize target names for fuzzy
        const tgtTokens = targetAccounts.map(t => ({ acc: t, tokens: tokenize(t.name) }))

        const result: MigrationMapping[] = []
        for (const srcAcc of sourceAccounts) {
            let target: FlatAccount | undefined
            let note = ''
            let level = 'UNMAPPED'

            // Level 1: System role match (highest confidence)
            if (srcAcc.system_role && tgtByRole.has(srcAcc.system_role)) {
                target = tgtByRole.get(srcAcc.system_role)
                note = `Role: ${srcAcc.system_role}`
                level = 'ROLE'
            }

            // Level 2: Exact code match
            if (!target && tgtByCode.has(srcAcc.code)) {
                target = tgtByCode.get(srcAcc.code)
                note = 'Same code'
                level = 'CODE'
            }

            // Level 3: Exact name match (case-insensitive)
            if (!target) {
                const norm = srcAcc.name.toLowerCase().trim()
                if (tgtByNorm.has(norm)) {
                    target = tgtByNorm.get(norm)
                    note = 'Name match'
                    level = 'NAME'
                }
            }

            // Level 4: Fuzzy name match (>70% token overlap, same type)
            if (!target) {
                const srcTokens = tokenize(srcAcc.name)
                let bestScore = 0
                let bestMatch: FlatAccount | undefined
                for (const { acc, tokens } of tgtTokens) {
                    if (acc.type !== srcAcc.type) continue  // Must be same type for fuzzy
                    const score = tokenOverlap(srcTokens, tokens)
                    if (score > 0.7 && score > bestScore) {
                        bestScore = score
                        bestMatch = acc
                    }
                }
                if (bestMatch) {
                    target = bestMatch
                    note = `Fuzzy: ${Math.round(bestScore * 100)}%`
                    level = 'NAME'
                }
            }

            // No type-only fallback — leave as UNMAPPED to avoid garbage mappings

            result.push({
                source_account_code: srcAcc.code,
                target_account_code: target?.code || '',
                notes: note,
                match_level: level as MigrationMapping['match_level'],
            } as MigrationMapping)
        }
        return result
    }, [sourceAccounts, targetAccounts])

    // Load DB maps on template change, auto-map if DB has nothing
    useEffect(() => {
        if (!sourceKey || !targetKey) return
        if (sourceKey === targetKey && templateKeys.length > 1) {
            setTargetKey(templateKeys.find(k => k !== sourceKey) || sourceKey)
            return
        }
        setLoading(true)
        setPage(0)
        autoMapRan.current = false

        getMigrationMap(sourceKey, targetKey).then((res: any) => {
            const dbMaps = Array.isArray(res) ? res : (res?.mappings || [])
            if (res?.quality) setQuality(res.quality)
            if (dbMaps.length > 0) {
                // DB has maps → use them
                setMappings(dbMaps)
                setDirty(false)
            } else {
                // DB empty → auto-map immediately
                const autoMapped = computeAutoMap()
                setMappings(autoMapped)
                setDirty(true)
                autoMapRan.current = true
            }
        }).catch(() => {
            // API failed → auto-map locally
            const autoMapped = computeAutoMap()
            setMappings(autoMapped)
            setDirty(true)
            autoMapRan.current = true
        }).finally(() => setLoading(false))
    }, [sourceKey, targetKey, computeAutoMap])

    // Auto-save after auto-map ran
    useEffect(() => {
        if (!autoMapRan.current || !dirty || mappings.length === 0) return
        if (!sourceKey || !targetKey || sourceKey === targetKey) return

        autoMapRan.current = false
        setSaving(true)
        saveMigrationMap({ source_key: sourceKey, target_key: targetKey, mappings })
            .then(() => { setDirty(false) })
            .catch(() => { /* silent */ })
            .finally(() => setSaving(false))
    }, [mappings, dirty, sourceKey, targetKey])

    // Auto-fetch quality report when templates change
    useEffect(() => {
        if (!sourceKey || !targetKey || sourceKey === targetKey) return
        getMigrationMapQuality(sourceKey, targetKey)
            .then(r => { if (r?.quality_score !== undefined) setQualityReport(r) })
            .catch(() => { /* silent */ })
    }, [sourceKey, targetKey, mappings])

    // Filtered & searched mappings
    const filteredMappings = useMemo(() => {
        let items = mappings
        if (filterType === 'MAPPED') {
            items = items.filter(m => !!m.target_account_code)
        } else if (filterType === 'UNMAPPED') {
            items = items.filter(m => !m.target_account_code)
        } else if (filterType === 'ONE_TO_ONE') {
            items = items.filter(m => m.mapping_type === 'ONE_TO_ONE')
        } else if (filterType === 'MERGE') {
            items = items.filter(m => m.mapping_type === 'MANY_TO_ONE')
        } else if (filterType === 'SPLIT') {
            items = items.filter(m => m.mapping_type === 'ONE_TO_MANY')
        } else if (['ROLE', 'CODE', 'NAME', 'TYPE_SUBTYPE', 'MANUAL'].includes(filterType)) {
            items = items.filter(m => m.match_level === filterType)
        } else if (filterType !== 'ALL') {
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

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredMappings.length / PAGE_SIZE))
    const pagedMappings = useMemo(() =>
        filteredMappings.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
        [filteredMappings, page])

    const stats = useMemo(() => {
        const mapped = mappings.filter(m => !!m.target_account_code).length
        const unmappedSource = mappings.filter(m => !m.target_account_code).length
        const oneToOne = mappings.filter(m => m.mapping_type === 'ONE_TO_ONE').length
        const merges = mappings.filter(m => m.mapping_type === 'MANY_TO_ONE').length
        const splits = mappings.filter(m => m.mapping_type === 'ONE_TO_MANY').length
        return { mapped, unmappedSource, total: mappings.length, oneToOne, merges, splits }
    }, [mappings])

    const handleTargetChange = (sourceCode: string, newTargetCode: string) => {
        setMappings(prev => {
            const existing = prev.findIndex(m => m.source_account_code === sourceCode)
            if (existing >= 0) {
                const updated = [...prev]
                updated[existing] = { ...updated[existing], target_account_code: newTargetCode }
                return updated
            }
            return [...prev, { source_account_code: sourceCode, target_account_code: newTargetCode, notes: '' } as MigrationMapping]
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
            toast.success(`Saved ${mappings.length} mappings`)
            setDirty(false)
        } catch (e: unknown) {
            toast.error('Save failed: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setSaving(false)
        }
    }

    const handleReAutoMap = async () => {
        setLoading(true)
        try {
            const result = await rematchMigrationMap(sourceKey, targetKey)
            toast.info(result.message)
            // Reload from DB
            const data = await getMigrationMap(sourceKey, targetKey)
            setMappings(data.mappings || [])
            setQuality((data as any).quality || null)
            setDirty(false)
        } catch (e) {
            toast.error('Re-match failed')
        } finally {
            setLoading(false)
        }
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <select value={sourceKey} onChange={e => setSourceKey(e.target.value)}
                        className="flex-1 min-w-0 text-sm font-bold px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground">
                        {templateKeys.map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
                    </select>
                    <button onClick={swapTemplates} className="p-2 rounded-lg border border-app-border hover:bg-app-hover transition-colors" title="Swap source/target">
                        <RotateCcw size={14} className="text-app-muted-foreground" />
                    </button>
                    <select value={targetKey} onChange={e => setTargetKey(e.target.value)}
                        className="flex-1 min-w-0 text-sm font-bold px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground">
                        {templateKeys.filter(k => k !== sourceKey).map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Stats Strip ── */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}>
                    <Link2 size={12} style={{ color: 'var(--app-success)' }} />
                    <span className="font-bold" style={{ color: 'var(--app-success)' }}>{stats.mapped}</span>
                    <span className="text-app-muted-foreground">mapped</span>
                </div>
                {stats.unmappedSource > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)' }}>
                        <AlertTriangle size={12} style={{ color: 'var(--app-warning)' }} />
                        <span className="font-bold" style={{ color: 'var(--app-warning)' }}>{stats.unmappedSource}</span>
                        <span className="text-app-muted-foreground">unmapped</span>
                    </div>
                )}
                <div className="h-4 w-px bg-app-border hidden sm:block" />
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-success) 8%, transparent)' }}>
                    <span className="text-tp-xxs font-bold px-1 rounded" style={{ background: 'color-mix(in srgb, var(--app-success) 18%, transparent)', color: 'var(--app-success)' }}>1:1</span>
                    <span className="font-bold text-app-foreground">{stats.oneToOne}</span>
                </div>
                {stats.merges > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)' }}>
                        <span className="text-tp-xxs font-bold px-1 rounded" style={{ background: 'color-mix(in srgb, var(--app-warning) 18%, transparent)', color: 'var(--app-warning)' }}>⊕ N:1</span>
                        <span className="font-bold text-app-foreground">{stats.merges}</span>
                    </div>
                )}
                {stats.splits > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)' }}>
                        <span className="text-tp-xxs font-bold px-1 rounded" style={{ background: 'color-mix(in srgb, var(--app-info) 18%, transparent)', color: 'var(--app-info)' }}>⊗ 1:N</span>
                        <span className="font-bold text-app-foreground">{stats.splits}</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)' }}>
                    <Layers size={12} style={{ color: 'var(--app-info)' }} />
                    <span className="font-bold" style={{ color: 'var(--app-info)' }}>{stats.total}</span>
                    <span className="text-app-muted-foreground">total</span>
                </div>

                <div className="ml-0 sm:ml-auto flex items-center gap-2 w-full sm:w-auto">
                    <button onClick={handleReAutoMap} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-app-border hover:bg-app-hover transition-colors text-app-muted-foreground">
                        <Zap size={12} /> Re-Match
                    </button>
                    {dirty && (
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
                            style={{ background: 'var(--app-success)', opacity: saving ? 0.6 : 1 }}>
                            {saving ? <RotateCcw size={12} className="animate-spin" /> : <Save size={12} />}
                            {saving ? 'Saving...' : 'Save Mappings'}
                        </button>
                    )}
                    {!dirty && mappings.length > 0 && (
                        <div className="flex items-center gap-1">
                            {(['DRAFT', 'REVIEWED', 'APPROVED', 'PUBLISHED'] as MapApprovalStatus[]).map(s => (
                                <button key={s} onClick={() => {
                                    setMigrationMapStatus(sourceKey, targetKey, s).then(() => {
                                        setMapStatus(s)
                                        toast.success(`Status → ${s}`)
                                    })
                                }}
                                    className={`px-2 py-1 rounded text-tp-xxs font-bold uppercase tracking-wider transition-all ${mapStatus === s
                                        ? s === 'PUBLISHED' ? 'bg-app-success/20 text-green-400 ring-1 ring-green-500/30'
                                            : s === 'APPROVED' ? 'bg-app-info/20 text-blue-400 ring-1 ring-app-info/30'
                                                : 'bg-app-primary/20 text-app-primary ring-1 ring-app-primary/30'
                                        : 'bg-app-surface text-app-muted-foreground hover:bg-app-hover'
                                        }`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Quality Score Dashboard ── */}
            {qualityReport && (
                <div className="rounded-xl border border-app-border/50 bg-app-surface/40 backdrop-blur-sm p-3">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Overall Score */}
                        <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${qualityReport.quality_score >= 80 ? 'bg-app-success/15 text-green-400' :
                                qualityReport.quality_score >= 60 ? 'bg-app-warning/15 text-amber-400' :
                                    'bg-app-error/15 text-app-error'
                                }`}>
                                {Math.round(qualityReport.quality_score)}
                            </div>
                            <div>
                                <div className="text-tp-xs uppercase tracking-wider text-app-muted-foreground font-medium">Quality</div>
                                <div className={`text-xs font-bold ${qualityReport.risk.risk_level === 'LOW' ? 'text-green-400' :
                                    qualityReport.risk.risk_level === 'MEDIUM' ? 'text-amber-400' : 'text-app-error'
                                    }`}>{qualityReport.risk.risk_level} Risk</div>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-app-border/50 hidden sm:block" />
                        {/* Coverage */}
                        <div className="text-center">
                            <div className="text-sm font-bold text-app-foreground">{qualityReport.coverage.source_pct}%</div>
                            <div className="text-tp-xxs text-app-muted-foreground">Coverage</div>
                        </div>
                        {/* Confidence */}
                        <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded text-tp-xxs font-bold bg-app-success/15 text-green-400">{qualityReport.confidence.high} hi</span>
                            <span className="px-1.5 py-0.5 rounded text-tp-xxs font-bold bg-app-warning/15 text-amber-400">{qualityReport.confidence.medium} md</span>
                            <span className="px-1.5 py-0.5 rounded text-tp-xxs font-bold bg-app-error/15 text-app-error">{qualityReport.confidence.low} lo</span>
                        </div>
                        <div className="h-8 w-px bg-app-border/50 hidden sm:block" />
                        {/* Critical Roles */}
                        <div className={`text-xs font-bold ${qualityReport.critical_roles.pct === 100 ? 'text-green-400' : 'text-amber-400'
                            }`}>
                            <Shield size={12} className="inline mr-1" />
                            Critical: {qualityReport.critical_roles.mapped}/{qualityReport.critical_roles.total}
                        </div>
                        {/* Match Levels */}
                        <div className="ml-auto flex items-center gap-1 flex-wrap">
                            {Object.entries(qualityReport.match_levels).map(([level, count]) => {
                                const colors: Record<string, string> = { ROLE: 'var(--app-success)', CODE: 'var(--app-info)', NAME: 'var(--app-info)', TYPE_SUBTYPE: 'var(--app-warning)', MANUAL: 'var(--app-muted-foreground)', UNMAPPED: 'var(--app-error)' }
                                return (
                                    <span key={level} className="px-1.5 py-0.5 rounded-full text-tp-xxs font-bold"
                                        style={{ background: `color-mix(in srgb, ${colors[level] || '#888'} 15%, transparent)`, color: colors[level] || '#888' }}>
                                        {level}: {count as number}
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Search + Filter ── */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search accounts..." value={search}
                        onChange={e => { setSearch(e.target.value); setPage(0) }}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-app-border bg-app-surface text-app-foreground placeholder:text-app-muted-foreground" />
                </div>
                <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0) }}
                    className="text-xs font-bold px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground">
                    <option value="ALL">All ({mappings.length})</option>
                    <option value="MAPPED" style={{ color: 'var(--app-success)' }}>✓ Mapped ({mappings.filter(m => !!m.target_account_code).length})</option>
                    <option value="UNMAPPED" style={{ color: 'var(--app-error)' }}>✗ Unmapped ({mappings.filter(m => !m.target_account_code).length})</option>
                    <option disabled>──── Mapping Type ────</option>
                    <option value="ONE_TO_ONE">🔗 1:1 Direct ({stats.oneToOne})</option>
                    <option value="MERGE">⊕ N:1 Merge ({stats.merges})</option>
                    <option value="SPLIT">⊗ 1:N Split ({stats.splits})</option>
                    <option disabled>──── By Type ────</option>
                    {['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map(t =>
                        <option key={t} value={t}>{t}</option>
                    )}
                    <option disabled>──── By Level ────</option>
                    {['ROLE', 'CODE', 'NAME', 'TYPE_SUBTYPE', 'MANUAL'].map(l =>
                        <option key={l} value={l}>{l}</option>
                    )}
                </select>
            </div>

            {/* ── Mapping Table (paginated) ── */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-app-muted-foreground text-sm">
                    <RotateCcw size={16} className="animate-spin mr-2" /> Loading mappings...
                </div>
            ) : (
                <div className="border rounded-xl border-app-border overflow-x-auto">
                    <table className="w-full text-xs" style={{ minWidth: '700px' }}>
                        <thead style={{ background: 'var(--app-surface)' }}>
                            <tr className="border-b border-app-border">
                                <th className="text-left px-3 py-2.5 font-bold text-tp-xs uppercase tracking-wider text-app-muted-foreground" style={{ width: '5%' }}>Type</th>
                                <th className="text-left px-3 py-2.5 font-bold text-tp-xs uppercase tracking-wider text-app-muted-foreground" style={{ width: '25%' }}>Source Account</th>
                                <th className="text-center px-1 py-2.5" style={{ width: '3%' }}></th>
                                <th className="text-left px-3 py-2.5 font-bold text-tp-xs uppercase tracking-wider text-app-muted-foreground" style={{ width: '27%' }}>Target Account</th>
                                <th className="text-left px-2 py-2.5 font-bold text-tp-xs uppercase tracking-wider text-app-muted-foreground" style={{ width: '8%' }}>Level</th>
                                <th className="text-left px-2 py-2.5 font-bold text-tp-xs uppercase tracking-wider text-app-muted-foreground" style={{ width: '7%' }}>Split %</th>
                                <th className="text-left px-3 py-2.5 font-bold text-tp-xs uppercase tracking-wider text-app-muted-foreground" style={{ width: '25%' }}>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedMappings.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-app-muted-foreground">
                                        {filteredMappings.length === 0 && mappings.length === 0
                                            ? 'No accounts to map between these templates.'
                                            : 'No results match your search.'
                                        }
                                    </td>
                                </tr>
                            ) : (() => {
                                // Group ONE_TO_MANY rows by source_account_code so we can render them as a tree
                                const rendered = new Set<number>()
                                const rows: React.ReactNode[] = []

                                for (let i = 0; i < pagedMappings.length; i++) {
                                    if (rendered.has(i)) continue
                                    const m = pagedMappings[i]
                                    const srcAcc = sourceByCode.get(m.source_account_code)
                                    const isMapped = !!m.target_account_code
                                    const mType = m.mapping_type || 'ONE_TO_ONE'
                                    const globalIdx = page * PAGE_SIZE + i

                                    // Collect sibling split rows (same source_account_code + ONE_TO_MANY)
                                    const splitGroup: { mapping: typeof m; pageIdx: number; globalIdx: number }[] = []
                                    if (mType === 'ONE_TO_MANY' && m.group_key) {
                                        for (let j = i; j < pagedMappings.length; j++) {
                                            if (pagedMappings[j].source_account_code === m.source_account_code &&
                                                pagedMappings[j].mapping_type === 'ONE_TO_MANY' &&
                                                pagedMappings[j].group_key === m.group_key) {
                                                splitGroup.push({ mapping: pagedMappings[j], pageIdx: j, globalIdx: page * PAGE_SIZE + j })
                                                rendered.add(j)
                                            }
                                        }
                                    }

                                    if (splitGroup.length > 1) {
                                        // ── SPLIT TREE: parent row + indented children ──
                                        const splitTotal = splitGroup.reduce((sum, s) => sum + (s.mapping.allocation_percent ?? 0), 0)
                                        const isValid = Math.abs(splitTotal - 100) < 0.1

                                        // Parent row: source account
                                        rows.push(
                                            <tr key={`split-parent-${m.source_account_code}`}
                                                className="border-b border-app-border/50"
                                                style={{ borderLeft: '3px solid var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 3%, transparent)' }}>
                                                <td className="px-2 py-2.5 text-center">
                                                    <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-full"
                                                        style={{ background: 'color-mix(in srgb, var(--app-info) 18%, transparent)', color: 'var(--app-info)' }}>
                                                        ⊗ 1:N
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5" colSpan={2}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-tp-sm px-1.5 py-0.5 rounded"
                                                            style={{
                                                                background: `color-mix(in srgb, ${TYPE_COLORS[srcAcc?.type || ''] || 'var(--app-muted)'} 12%, transparent)`,
                                                                color: TYPE_COLORS[srcAcc?.type || ''] || 'var(--app-muted-foreground)',
                                                            }}>
                                                            {m.source_account_code}
                                                        </span>
                                                        <span className="font-semibold text-app-foreground">{srcAcc?.name || m.source_account_code || 'Unknown'}</span>
                                                        <span className="text-tp-xxs text-app-muted-foreground ml-1">→ split into {splitGroup.length} accounts</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-tp-xs font-bold" style={{ color: isValid ? 'var(--app-success)' : 'var(--app-error)' }}>
                                                        Total: {splitTotal.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td></td>
                                                <td></td>
                                            </tr>
                                        )

                                        // Child rows: each target account
                                        splitGroup.forEach((s, si) => {
                                            const tgtAcc = targetByCode.get(s.mapping.target_account_code)
                                            const isLast = si === splitGroup.length - 1
                                            rows.push(
                                                <tr key={`split-child-${s.mapping.source_account_code}-${s.mapping.target_account_code}-${si}`}
                                                    className="border-b border-app-border/30 hover:bg-app-hover/20 transition-colors"
                                                    style={{ borderLeft: '3px solid var(--app-info)' }}>
                                                    <td></td>
                                                    <td className="pl-6 pr-3 py-1.5" colSpan={2}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-app-muted-foreground font-mono text-tp-xs select-none" style={{ color: 'var(--app-info)' }}>
                                                                {isLast ? '└──' : '├──'}
                                                            </span>
                                                            <span className="font-mono font-bold text-tp-xs px-1 py-0.5 rounded"
                                                                style={{
                                                                    background: `color-mix(in srgb, ${TYPE_COLORS[tgtAcc?.type || ''] || 'var(--app-muted)'} 10%, transparent)`,
                                                                    color: TYPE_COLORS[tgtAcc?.type || ''] || 'var(--app-muted-foreground)',
                                                                }}>
                                                                {s.mapping.target_account_code}
                                                            </span>
                                                            <span className="text-app-foreground text-tp-sm truncate">{tgtAcc?.name || s.mapping.target_account_code || 'Unknown'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <input type="number" min={0} max={100} step={0.01}
                                                            value={s.mapping.allocation_percent ?? ''}
                                                            onChange={e => {
                                                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value)
                                                                setMappings(prev => prev.map((r, ri) =>
                                                                    ri === s.globalIdx ? { ...r, allocation_percent: val } : r
                                                                ))
                                                                setDirty(true)
                                                            }}
                                                            placeholder="%"
                                                            className="w-16 text-xs px-1.5 py-1 rounded-md border text-center font-bold"
                                                            style={{
                                                                borderColor: 'color-mix(in srgb, var(--app-info) 40%, transparent)',
                                                                background: 'color-mix(in srgb, var(--app-info) 5%, transparent)',
                                                                color: 'var(--app-info)',
                                                            }} />
                                                    </td>
                                                    <td></td>
                                                    <td className="px-3 py-1.5">
                                                        <input type="text" value={s.mapping.notes || ''} onChange={e => handleNotesChange(s.mapping.source_account_code, e.target.value)}
                                                            placeholder="Notes..." className="w-full text-xs px-2 py-1 rounded-md border border-app-border bg-app-background text-app-foreground placeholder:text-app-muted-foreground/50" />
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    } else {
                                        // ── Standard row (1:1, N:1, or single split) ──
                                        rendered.add(i)
                                        const typeColors: Record<string, { bg: string; label: string; icon: string }> = {
                                            'ONE_TO_ONE': { bg: 'var(--app-success)', label: '1:1', icon: '' },
                                            'MANY_TO_ONE': { bg: 'var(--app-warning)', label: 'N:1', icon: '⊕' },
                                            'ONE_TO_MANY': { bg: 'var(--app-info)', label: '1:N', icon: '⊗' },
                                        }
                                        const tc = typeColors[mType] || typeColors['ONE_TO_ONE']
                                        const borderColor = mType === 'MANY_TO_ONE' ? 'var(--app-warning)' : mType === 'ONE_TO_MANY' ? 'var(--app-info)' : ''

                                        rows.push(
                                            <tr key={`row-${m.source_account_code}-${m.target_account_code}-${i}`}
                                                className="border-b border-app-border/50 hover:bg-app-hover/30 transition-colors"
                                                style={borderColor ? { borderLeft: `3px solid ${borderColor}` } : undefined}>
                                                <td className="px-2 py-2 text-center">
                                                    {isMapped && (
                                                        <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-full"
                                                            style={{ background: `color-mix(in srgb, ${tc.bg} 18%, transparent)`, color: tc.bg }}>
                                                            {tc.icon}{tc.label}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-tp-sm px-1.5 py-0.5 rounded"
                                                            style={{
                                                                background: `color-mix(in srgb, ${TYPE_COLORS[srcAcc?.type || ''] || 'var(--app-muted)'} 12%, transparent)`,
                                                                color: TYPE_COLORS[srcAcc?.type || ''] || 'var(--app-muted-foreground)',
                                                            }}>
                                                            {m.source_account_code}
                                                        </span>
                                                        <span className="text-app-foreground truncate">{srcAcc?.name || m.source_account_code || 'Unknown'}</span>
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <ArrowRight size={12} style={{ color: isMapped ? 'var(--app-success)' : 'var(--app-muted-foreground)', opacity: isMapped ? 1 : 0.3 }} />
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <select value={m.target_account_code}
                                                        onChange={e => handleTargetChange(m.source_account_code, e.target.value)}
                                                        className="w-full text-xs px-2 py-1.5 rounded-md border border-app-border bg-app-background text-app-foreground"
                                                        style={{ borderColor: isMapped ? 'color-mix(in srgb, var(--app-success) 40%, transparent)' : undefined }}>
                                                        <option value="">— Select target —</option>
                                                        {targetAccounts.map(t => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    {(() => {
                                                        const lvl = m.match_level || ''
                                                        const colors: Record<string, string> = { ROLE: 'var(--app-success)', CODE: 'var(--app-info)', NAME: 'var(--app-info)', TYPE_SUBTYPE: 'var(--app-warning)', MANUAL: 'var(--app-muted-foreground)', UNMAPPED: 'var(--app-error)' }
                                                        const labels: Record<string, string> = { ROLE: 'Role', CODE: 'Code', NAME: 'Name', TYPE_SUBTYPE: 'Type', MANUAL: 'Manual', UNMAPPED: '—' }
                                                        return lvl ? (
                                                            <span className="text-tp-xxs font-bold uppercase px-1.5 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${colors[lvl] || '#888'} 15%, transparent)`, color: colors[lvl] || '#888' }}>
                                                                {labels[lvl] || lvl}
                                                            </span>
                                                        ) : null
                                                    })()}
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    {mType === 'MANY_TO_ONE' && (
                                                        <span className="text-tp-xxs text-app-muted-foreground italic">merge</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <input type="text" value={m.notes || ''} onChange={e => handleNotesChange(m.source_account_code, e.target.value)}
                                                        placeholder="Notes..." className="w-full text-xs px-2 py-1.5 rounded-md border border-app-border bg-app-background text-app-foreground placeholder:text-app-muted-foreground/50" />
                                                </td>
                                            </tr>
                                        )
                                    }
                                }
                                return rows
                            })()}
                        </tbody>
                    </table>

                    {/* ── Pagination ── */}
                    {totalPages > 1 && (
                        <div className="sticky left-0 flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-app-border text-xs gap-3"
                            style={{ background: 'var(--app-surface)', minWidth: 'min-content' }}>
                            <span className="text-app-muted-foreground whitespace-nowrap">
                                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredMappings.length)} of {filteredMappings.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                                    className="p-1.5 rounded-lg border border-app-border bg-app-surface hover:bg-app-hover disabled:opacity-30 transition-colors shadow-sm">
                                    <ChevronLeft size={14} />
                                </button>
                                <div className="flex items-center gap-1 overflow-x-auto px-1 custom-scrollbar">
                                    {Array.from({ length: totalPages }, (_, i) => {
                                        // Dynamic page numbering with ellipses for large sets
                                        if (totalPages > 8) {
                                            if (i !== 0 && i !== totalPages - 1 && Math.abs(i - page) > 2) {
                                                if (i === 1 || i === totalPages - 2) return <span key={i} className="px-1 text-app-muted-foreground">...</span>
                                                return null
                                            }
                                        }
                                        return (
                                            <button key={i} onClick={() => setPage(i)}
                                                className="w-7 h-7 rounded-lg text-xs font-bold transition-all shrink-0"
                                                style={{
                                                    background: page === i ? 'var(--app-primary)' : 'transparent',
                                                    color: page === i ? 'white' : 'var(--app-muted-foreground)',
                                                    boxShadow: page === i ? '0 2px 8px var(--app-primary-glow)' : 'none',
                                                }}>
                                                {i + 1}
                                            </button>
                                        )
                                    })}
                                </div>
                                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                                    className="p-1.5 rounded-lg border border-app-border bg-app-surface hover:bg-app-hover disabled:opacity-30 transition-colors shadow-sm">
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Coverage bar ── */}
            {stats.total > 0 && (
                <div className="flex items-center gap-3">
                    <span className="text-tp-xs font-bold uppercase tracking-wider text-app-muted-foreground">Coverage</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--app-muted) 20%, transparent)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${Math.round((stats.mapped / Math.max(stats.total, 1)) * 100)}%`,
                                background: stats.mapped === stats.total ? 'var(--app-success)' : 'var(--app-info)',
                            }} />
                    </div>
                    <span className="text-xs font-bold text-app-foreground">
                        {Math.round((stats.mapped / Math.max(stats.total, 1)) * 100)}%
                    </span>
                </div>
            )}
        </div>
    )
}
