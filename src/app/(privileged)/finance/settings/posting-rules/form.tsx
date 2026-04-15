'use client'

import { useState, useMemo, useTransition } from 'react'
import {
    Target, Zap, Save, Search, ChevronLeft,
    CheckCircle2, XCircle, Loader2, RefreshCcw,
    ShoppingCart, CreditCard, Package, Users, BarChart3, Wallet,
    Shield, Settings2, Landmark, ArrowRightLeft,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
    autoDetectAndApply, bulkSaveRules, syncFromTemplate,
    type PostingRuleV2, type CatalogModule, type CompletenessReport,
} from '@/app/actions/finance/posting-rules'

// ── Module icon/color map ──────────────────────────────────────
const MODULE_META: Record<string, { icon: any; color: string; label: string }> = {
    sales:       { icon: ShoppingCart,   color: 'var(--app-info, #3b82f6)',    label: 'Sales & Revenue' },
    purchases:   { icon: CreditCard,     color: '#8b5cf6',                     label: 'Purchases & Suppliers' },
    inventory:   { icon: Package,        color: 'var(--app-warning, #f59e0b)', label: 'Inventory Operations' },
    payments:    { icon: Wallet,         color: 'var(--app-success, #22c55e)', label: 'Financial Processing' },
    tax:         { icon: Shield,         color: 'var(--app-error, #ef4444)',   label: 'Tax Engine' },
    treasury:    { icon: Landmark,       color: '#06b6d4',                     label: 'Treasury & Banking' },
    assets:      { icon: BarChart3,      color: '#64748b',                     label: 'Fixed Assets' },
    equity:      { icon: Users,          color: '#8b5cf6',                     label: 'Equity & Capital' },
    adjustment:  { icon: RefreshCcw,     color: '#f97316',                     label: 'Adjustments' },
    automation:  { icon: Zap,            color: 'var(--app-success, #22c55e)', label: 'Partner Automation' },
    suspense:    { icon: ArrowRightLeft, color: 'var(--app-warning, #f59e0b)', label: 'Suspense & Clearing' },
    partners:    { icon: Users,          color: '#8b5cf6',                     label: 'Partners' },
    fixedAssets: { icon: BarChart3,      color: '#64748b',                     label: 'Fixed Assets' },
    payroll:     { icon: Users,          color: '#ec4899',                     label: 'Payroll' },
}

const getMeta = (mod: string) => MODULE_META[mod] || { icon: Settings2, color: 'var(--app-muted-foreground)', label: mod }

// ══════════════════════════════════════════════════════════════════
export default function PostingRulesConsole({
    rulesByModule,
    catalog,
    completeness,
    accounts,
}: {
    rulesByModule: Record<string, PostingRuleV2[]>
    catalog: { modules: CatalogModule[]; total_events: number }
    completeness: CompletenessReport
    accounts: Record<string, any>[]
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const cameFromCOA = searchParams.get('from') === 'coa' || searchParams.get('from') === 'coa-import'
    const [isPending, startTransition] = useTransition()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedModule, setSelectedModule] = useState<string | null>(null)
    const [overrides, setOverrides] = useState<Record<string, number | null>>({})
    const [hasChanges, setHasChanges] = useState(false)

    // Build flat list of all events with their current mapping
    const { allRules, modules } = useMemo(() => {
        const ruleMap: Record<string, PostingRuleV2> = {}
        for (const rules of Object.values(rulesByModule)) {
            for (const r of rules) ruleMap[r.event_code] = r
        }

        const rows: {
            event_code: string; label: string; description: string; module: string
            criticality: string; account_id: number | null; account_code: string
            account_name: string; source: string; is_mapped: boolean
        }[] = []

        for (const mod of catalog.modules) {
            for (const ev of mod.events) {
                const rule = ruleMap[ev.code]
                rows.push({
                    event_code: ev.code, label: ev.label, description: ev.description,
                    module: mod.key, criticality: ev.criticality || 'NORMAL',
                    account_id: rule?.account_id ?? null, account_code: rule?.account_code ?? '',
                    account_name: rule?.account_name ?? '', source: rule?.source ?? '',
                    is_mapped: !!rule?.account_id,
                })
            }
        }

        // Add rules not in catalog (legacy)
        for (const [code, rule] of Object.entries(ruleMap)) {
            if (!rows.find(r => r.event_code === code)) {
                rows.push({
                    event_code: code, label: code.split('.').slice(1).join(' ').replace(/_/g, ' '),
                    description: rule.description || '', module: code.split('.')[0] || 'unknown',
                    criticality: 'NORMAL', account_id: rule.account_id, account_code: rule.account_code,
                    account_name: rule.account_name, source: rule.source, is_mapped: true,
                })
            }
        }

        // Group by module
        const grouped: Record<string, typeof rows> = {}
        for (const r of rows) {
            if (!grouped[r.module]) grouped[r.module] = []
            grouped[r.module].push(r)
        }

        return { allRules: rows, modules: grouped }
    }, [rulesByModule, catalog])

    // Auto-select first module
    const moduleKeys = Object.keys(modules)
    const activeModule = selectedModule && modules[selectedModule] ? selectedModule : moduleKeys[0] || null
    const activeRules = activeModule ? (modules[activeModule] || []) : []

    // Filter rules in active module
    const filteredRules = useMemo(() => {
        if (!searchQuery.trim()) return activeRules
        const q = searchQuery.toLowerCase()
        return activeRules.filter(r =>
            r.event_code.toLowerCase().includes(q) ||
            r.label.toLowerCase().includes(q) ||
            r.account_code.toLowerCase().includes(q) ||
            r.account_name.toLowerCase().includes(q)
        )
    }, [activeRules, searchQuery])

    // Stats
    const totalEvents = allRules.length
    const mappedEvents = allRules.filter(r => r.is_mapped || overrides[r.event_code] !== undefined).length
    const coveragePct = totalEvents > 0 ? Math.round((mappedEvents / totalEvents) * 100) : 0

    const setRule = (eventCode: string, accountId: number | null) => {
        setOverrides(prev => ({ ...prev, [eventCode]: accountId }))
        setHasChanges(true)
    }

    const getAccountId = (eventCode: string, original: number | null) =>
        eventCode in overrides ? overrides[eventCode] : original

    // ── Actions ──
    const handleAutoDetect = () => {
        startTransition(async () => {
            const result = await autoDetectAndApply(60)
            if (result.applied > 0) {
                toast.success(`Auto-detected ${result.applied} posting rules`)
                router.refresh()
            } else {
                toast.info('No new rules could be auto-detected')
            }
        })
    }

    const handleSyncTemplate = () => {
        startTransition(async () => {
            const result = await syncFromTemplate()
            toast.success(result.message)
            router.refresh()
        })
    }

    const handleSave = () => {
        const rules = Object.entries(overrides)
            .filter(([, id]) => id !== null && id !== undefined)
            .map(([event_code, account_id]) => ({ event_code, account_id: account_id! }))
        if (rules.length === 0) { toast.info('No changes to save'); return }
        startTransition(async () => {
            const result = await bulkSaveRules(rules)
            if (result.errors.length > 0) toast.error(`Saved with ${result.errors.length} errors`)
            else toast.success(result.message)
            setOverrides({}); setHasChanges(false); router.refresh()
        })
    }

    return (
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300 overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap flex-shrink-0">
                <div className="flex items-center gap-3">
                    {cameFromCOA && (
                        <button onClick={() => router.push('/finance/chart-of-accounts')}
                            className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-xl border transition-all mr-1"
                            style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                            <ChevronLeft size={14} /> Chart of Accounts
                        </button>
                    )}
                    <div className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Target size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Posting Engine</h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            Event-to-Account Financial Routing
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleSyncTemplate} disabled={isPending}
                        className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50"
                        style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                        <RefreshCcw size={13} /> Sync Template
                    </button>
                    <button onClick={handleAutoDetect} disabled={isPending}
                        className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50"
                        style={{
                            color: 'var(--app-warning, #f59e0b)',
                            borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)',
                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
                        }}>
                        <Zap size={13} /> Auto-Detect
                    </button>
                    {hasChanges && (
                        <button onClick={handleSave} disabled={isPending}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', color: 'white', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Changes
                        </button>
                    )}
                </div>
            </div>

            {/* ── KPI Strip ── */}
            <div className="flex-shrink-0 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                {[
                    { label: 'Total Events', value: totalEvents, color: 'var(--app-primary)', icon: <Target size={14} /> },
                    { label: 'Mapped', value: mappedEvents, color: 'var(--app-success, #22c55e)', icon: <CheckCircle2 size={14} /> },
                    { label: 'Unmapped', value: totalEvents - mappedEvents, color: 'var(--app-error, #ef4444)', icon: <XCircle size={14} /> },
                    { label: 'Coverage', value: `${coveragePct}%`, color: coveragePct >= 80 ? 'var(--app-success, #22c55e)' : coveragePct >= 50 ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)', icon: <BarChart3 size={14} /> },
                    { label: 'Modules', value: moduleKeys.length, color: '#8b5cf6', icon: <Package size={14} /> },
                ].map(k => (
                    <div key={k.label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${k.color} 10%, transparent)`, color: k.color }}>
                            {k.icon}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[14px] font-black tabular-nums" style={{ color: k.color }}>{k.value}</div>
                            <div className="text-[9px] font-bold uppercase tracking-wider truncate"
                                style={{ color: 'var(--app-muted-foreground)' }}>{k.label}</div>
                        </div>
                    </div>
                ))}

                {/* Coverage ring */}
                <div className="flex items-center justify-center px-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <svg width="44" height="44" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--app-border)" strokeWidth="4" />
                        <circle cx="22" cy="22" r="18" fill="none"
                            stroke={coveragePct >= 80 ? 'var(--app-success, #22c55e)' : coveragePct >= 50 ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)'}
                            strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={`${(coveragePct / 100) * 113} 113`}
                            transform="rotate(-90 22 22)" />
                        <text x="22" y="24" textAnchor="middle" fill="var(--app-foreground)"
                            fontSize="10" fontWeight="900">{coveragePct}%</text>
                    </svg>
                </div>
            </div>

            {/* ── Main Grid: Module Sidebar + Rules Grid ── */}
            <div className="flex-1 min-h-0 flex gap-0 rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--app-border)' }}>

                {/* ── Module Sidebar ── */}
                <div className="w-[200px] md:w-[220px] flex-shrink-0 overflow-y-auto custom-scrollbar"
                    style={{ background: 'var(--app-surface)', borderRight: '1px solid var(--app-border)' }}>
                    {moduleKeys.map(mod => {
                        const meta = getMeta(mod)
                        const Icon = meta.icon
                        const isActive = mod === activeModule
                        const modRules = modules[mod] || []
                        const mapped = modRules.filter(r => r.is_mapped || overrides[r.event_code] !== undefined).length
                        const total = modRules.length

                        return (
                            <button key={mod} onClick={() => { setSelectedModule(mod); setSearchQuery('') }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all"
                                style={{
                                    background: isActive ? `color-mix(in srgb, ${meta.color} 8%, transparent)` : 'transparent',
                                    borderLeft: isActive ? `3px solid ${meta.color}` : '3px solid transparent',
                                    borderBottom: '1px solid var(--app-border)',
                                }}>
                                <Icon size={15} style={{ color: meta.color, flexShrink: 0 }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-bold truncate"
                                        style={{ color: isActive ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                        {meta.label}
                                    </div>
                                    <div className="text-[9px] font-bold tabular-nums"
                                        style={{ color: mapped === total ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>
                                        {mapped}/{total} mapped
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* ── Rules Grid ── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Module Header + Search */}
                    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5"
                        style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                        {activeModule && (() => {
                            const meta = getMeta(activeModule)
                            const Icon = meta.icon
                            return (
                                <>
                                    <div className="flex items-center justify-center w-7 h-7 rounded-lg"
                                        style={{ background: `color-mix(in srgb, ${meta.color} 10%, transparent)` }}>
                                        <Icon size={14} style={{ color: meta.color }} />
                                    </div>
                                    <span className="text-[12px] font-black uppercase tracking-wider"
                                        style={{ color: 'var(--app-foreground)' }}>{meta.label}</span>
                                    <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)',
                                            color: 'var(--app-muted-foreground)',
                                        }}>
                                        {activeRules.length} events
                                    </span>
                                </>
                            )
                        })()}
                        <div className="flex-1" />
                        <div className="relative w-[200px]">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Filter events..."
                                className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-app-bg border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all focus:border-app-border" />
                        </div>
                    </div>

                    {/* Column Headers */}
                    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-1.5"
                        style={{ background: 'var(--app-bg)', borderBottom: '1px solid var(--app-border)' }}>
                        <div className="w-4 flex-shrink-0" />
                        <div className="flex-1 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                            Event
                        </div>
                        <div className="w-[220px] md:w-[320px] flex-shrink-0 text-[9px] font-black uppercase tracking-widest"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            Account Mapping
                        </div>
                        <div className="w-[50px] flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-right"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            Source
                        </div>
                    </div>

                    {/* Rule Rows */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredRules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Target size={32} className="text-app-muted-foreground mb-2 opacity-30" />
                                <p className="text-[12px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {searchQuery ? 'No matching events' : 'No events in this module'}
                                </p>
                            </div>
                        ) : (
                            filteredRules.map(rule => {
                                const currentId = getAccountId(rule.event_code, rule.account_id)
                                const isOverridden = rule.event_code in overrides
                                return (
                                    <div key={rule.event_code}
                                        className="flex items-center gap-3 px-4 py-2 transition-all"
                                        style={{
                                            borderBottom: '1px solid var(--app-border)',
                                            background: isOverridden ? 'color-mix(in srgb, var(--app-primary) 4%, transparent)' : 'transparent',
                                        }}>
                                        {/* Status dot */}
                                        <div className="w-4 flex-shrink-0 flex justify-center">
                                            {currentId
                                                ? <CheckCircle2 size={13} style={{ color: 'var(--app-success, #22c55e)' }} />
                                                : <XCircle size={13} style={{ color: 'var(--app-error, #ef4444)', opacity: 0.4 }} />}
                                        </div>

                                        {/* Event info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                {rule.label}
                                            </div>
                                            <div className="text-[9px] font-mono truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                                                {rule.event_code}
                                            </div>
                                        </div>

                                        {/* Account selector */}
                                        <select
                                            value={currentId || ''}
                                            onChange={e => setRule(rule.event_code, e.target.value ? parseInt(e.target.value) : null)}
                                            className="w-[220px] md:w-[320px] flex-shrink-0 bg-app-surface border border-app-border rounded-xl px-2.5 py-1.5 text-[11px] font-medium outline-none transition-all focus:border-app-primary"
                                            style={{ color: currentId ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                            <option value="">-- Not Mapped --</option>
                                            {accounts.filter(a => a.isActive !== false).map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>
                                            ))}
                                        </select>

                                        {/* Source badge */}
                                        <div className="w-[50px] flex-shrink-0 text-right">
                                            {rule.source && (
                                                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                    style={{
                                                        background: rule.source === 'SEED' ? 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)'
                                                            : rule.source === 'AUTO' ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)'
                                                            : 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)',
                                                        color: rule.source === 'SEED' ? 'var(--app-info, #3b82f6)'
                                                            : rule.source === 'AUTO' ? 'var(--app-warning, #f59e0b)'
                                                            : 'var(--app-muted-foreground)',
                                                    }}>
                                                    {rule.source}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2.5"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    marginTop: '-1px',
                    borderBottomLeftRadius: '1rem',
                    borderBottomRightRadius: '1rem',
                }}>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>
                    {moduleKeys.length} modules
                </span>
                <div className="flex items-center gap-3">
                    {hasChanges && (
                        <span className="text-[10px] font-bold" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                            {Object.keys(overrides).length} unsaved
                        </span>
                    )}
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                        {mappedEvents}/{totalEvents} mapped ({coveragePct}%)
                    </span>
                </div>
            </div>
        </div>
    )
}
