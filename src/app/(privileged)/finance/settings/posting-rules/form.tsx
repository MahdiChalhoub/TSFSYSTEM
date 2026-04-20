'use client'

import { useState, useMemo, useRef, useEffect, useTransition } from 'react'
import {
    Target, Zap, Save, Search, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, Loader2, RefreshCcw,
    ShoppingCart, CreditCard, Package, Users, BarChart3, Wallet,
    Shield, Settings2, Landmark, ArrowRightLeft, BookOpen,
    Maximize2, Minimize2, X,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
    autoDetectAndApply, bulkSaveRules, syncFromTemplate,
    type PostingRuleV2, type CatalogModule,
} from '@/app/actions/finance/posting-rules'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/finance-posting-rules'

// ── Account Tree Picker ────────────────────────────────────────
function AccountTreePicker({
    value, onChange, accounts, mode = 'posting',
}: {
    value: number | null
    onChange: (id: number | null) => void
    accounts: Record<string, any>[]
    mode?: 'posting' | 'root'  // posting = leaf only, root = parent selection for automation
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [breadcrumb, setBreadcrumb] = useState<{ id: number; code: string; name: string }[]>([])
    const ref = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    // Build tree
    const activeAccounts = useMemo(() => accounts.filter(a => a.isActive !== false), [accounts])
    const childrenOf = useMemo(() => {
        const map: Record<string, typeof activeAccounts> = { root: [] }
        for (const a of activeAccounts) {
            const parentKey = a.parentId ? String(a.parentId) : 'root'
            if (!map[parentKey]) map[parentKey] = []
            map[parentKey].push(a)
        }
        // Sort each group by code
        for (const key in map) map[key].sort((a: any, b: any) => a.code.localeCompare(b.code, undefined, { numeric: true }))
        return map
    }, [activeAccounts])

    // Current parent level
    const currentParentId = breadcrumb.length > 0 ? String(breadcrumb[breadcrumb.length - 1].id) : 'root'
    const currentChildren = childrenOf[currentParentId] || []
    const hasChildren = (id: number) => (childrenOf[String(id)] || []).length > 0

    // Search mode: flatten and filter
    const searchResults = useMemo(() => {
        if (!search.trim()) return null
        const q = search.toLowerCase()
        return activeAccounts.filter(a =>
            a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
        ).slice(0, 30)
    }, [search, activeAccounts])

    const selectedAccount = value ? activeAccounts.find(a => a.id === value) : null

    const selectAccount = (acc: Record<string, any>) => {
        onChange(acc.id)
        setOpen(false)
        setBreadcrumb([])
        setSearch('')
    }

    const drillDown = (acc: Record<string, any>) => {
        setBreadcrumb(prev => [...prev, { id: acc.id, code: acc.code, name: acc.name }])
        setSearch('')
    }

    const goBack = (index: number) => {
        setBreadcrumb(prev => prev.slice(0, index))
        setSearch('')
    }

    return (
        <div ref={ref} className="relative w-[160px] xl:w-[200px] flex-shrink-0">
            {/* Trigger */}
            <button type="button" onClick={() => { setOpen(!open); setBreadcrumb([]); setSearch('') }}
                className="w-full flex items-center gap-1.5 bg-app-surface border border-app-border rounded-xl px-2 py-1.5 text-[10px] font-medium outline-none transition-all text-left truncate"
                style={{ color: selectedAccount ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                {selectedAccount ? `${selectedAccount.code} — ${selectedAccount.name}` : '-- Not Mapped --'}
                <ChevronRight size={10} className="ml-auto flex-shrink-0 opacity-40" />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-1 w-[320px] rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

                    {/* Search */}
                    <div className="px-2 py-2" style={{ borderBottom: '1px solid var(--app-border)' }}>
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search accounts..."
                                autoFocus
                                className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-app-bg border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none" />
                        </div>
                    </div>

                    {/* Breadcrumb */}
                    {breadcrumb.length > 0 && !searchResults && (
                        <div className="flex items-center gap-1 px-2 py-1.5 flex-wrap"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-bg)' }}>
                            <button onClick={() => goBack(0)}
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded transition-all"
                                style={{ color: 'var(--app-primary)' }}>
                                Root
                            </button>
                            {breadcrumb.map((b, i) => (
                                <span key={b.id} className="flex items-center gap-1">
                                    <ChevronRight size={8} style={{ color: 'var(--app-muted-foreground)' }} />
                                    <button onClick={() => goBack(i + 1)}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded transition-all truncate max-w-[100px]"
                                        style={{ color: i === breadcrumb.length - 1 ? 'var(--app-foreground)' : 'var(--app-primary)' }}>
                                        {b.code}
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Account list */}
                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                        {/* Clear mapping option */}
                        {value && !searchResults && breadcrumb.length === 0 && (
                            <button onClick={() => { onChange(null); setOpen(false) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all"
                                style={{ borderBottom: '1px solid var(--app-border)', color: 'var(--app-error, #ef4444)' }}>
                                <X size={12} />
                                <span className="text-[10px] font-bold">Clear mapping</span>
                            </button>
                        )}

                        {(searchResults || currentChildren).length === 0 ? (
                            <div className="py-6 text-center">
                                <p className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {search ? 'No matches' : 'No accounts'}
                                </p>
                            </div>
                        ) : (
                            (searchResults || currentChildren).map((acc: Record<string, any>) => {
                                const isSelected = acc.id === value
                                const hasKids = hasChildren(acc.id)
                                // posting mode: parents are NOT selectable (auto-drill)
                                // root mode: any account is selectable
                                const canSelect = mode === 'root' || !hasKids
                                const isHeader = hasKids && mode === 'posting' && !searchResults

                                return (
                                    <div key={acc.id}
                                        className="flex items-center gap-2 px-3 py-1.5 transition-all group"
                                        style={{
                                            borderBottom: '1px solid var(--app-border)',
                                            background: isSelected ? 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)' : 'transparent',
                                        }}>
                                        {/* Main click area */}
                                        <button onClick={() => isHeader ? drillDown(acc) : selectAccount(acc)}
                                            className="flex-1 flex items-center gap-2 min-w-0 text-left">
                                            <span className="text-[10px] font-mono font-bold flex-shrink-0"
                                                style={{ color: isHeader ? 'var(--app-muted-foreground)' : 'var(--app-primary)', minWidth: '40px' }}>
                                                {acc.code}
                                            </span>
                                            <span className="text-[10px] font-medium truncate"
                                                style={{ color: isHeader ? 'var(--app-muted-foreground)' : 'var(--app-foreground)' }}>
                                                {acc.name}
                                            </span>
                                            {isSelected && <CheckCircle2 size={11} style={{ color: 'var(--app-success, #22c55e)', flexShrink: 0 }} />}
                                            {isHeader && (
                                                <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded flex-shrink-0"
                                                    style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                    Header
                                                </span>
                                            )}
                                        </button>

                                        {/* Drill arrow for parents (visible in both modes for navigation) */}
                                        {hasKids && !searchResults && (
                                            <button onClick={(e) => { e.stopPropagation(); drillDown(acc) }}
                                                className="flex-shrink-0 px-1.5 py-1 rounded-lg transition-all opacity-60 hover:opacity-100"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)' }}>
                                                <ChevronRight size={11} />
                                            </button>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Module meta ────────────────────────────────────────────────
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
    rulesByModule, catalog, accounts,
}: {
    rulesByModule: Record<string, PostingRuleV2[]>
    catalog: { modules: CatalogModule[]; total_events: number }
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
    const [focusMode, setFocusMode] = useState(false)
    const [kpiFilter, setKpiFilter] = useState<string | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    // ── Build data ──
    const { allRules, modules } = useMemo(() => {
        const ruleMap: Record<string, PostingRuleV2> = {}
        for (const rules of Object.values(rulesByModule))
            for (const r of rules) ruleMap[r.event_code] = r

        const rows: {
            event_code: string; label: string; description: string; module: string
            criticality: string; account: number | null; account_code: string
            account_name: string; source: string; is_mapped: boolean
        }[] = []

        for (const mod of catalog.modules) {
            for (const ev of mod.events) {
                const rule = ruleMap[ev.code]
                rows.push({
                    event_code: ev.code, label: ev.label, description: ev.description,
                    module: mod.key, criticality: ev.criticality || 'NORMAL',
                    account: rule?.account ?? null, account_code: rule?.account_code ?? '',
                    account_name: rule?.account_name ?? '', source: rule?.source ?? '',
                    is_mapped: !!rule?.account,
                })
            }
        }
        for (const [code, rule] of Object.entries(ruleMap)) {
            if (!rows.find(r => r.event_code === code)) {
                rows.push({
                    event_code: code, label: code.split('.').slice(1).join(' ').replace(/_/g, ' '),
                    description: rule.description || '', module: code.split('.')[0] || 'unknown',
                    criticality: 'NORMAL', account: rule.account, account_code: rule.account_code,
                    account_name: rule.account_name, source: rule.source, is_mapped: true,
                })
            }
        }

        const grouped: Record<string, typeof rows> = {}
        for (const r of rows) {
            if (!grouped[r.module]) grouped[r.module] = []
            grouped[r.module].push(r)
        }
        return { allRules: rows, modules: grouped }
    }, [rulesByModule, catalog])

    const moduleKeys = Object.keys(modules)
    const totalEvents = allRules.length
    const mappedEvents = allRules.filter(r => r.is_mapped || overrides[r.event_code] !== undefined).length
    const unmappedEvents = totalEvents - mappedEvents
    const coveragePct = totalEvents > 0 ? Math.round((mappedEvents / totalEvents) * 100) : 0

    // ── KPI filter logic ──
    const filteredModuleKeys = useMemo(() => {
        if (!kpiFilter) return moduleKeys
        return moduleKeys.filter(mod => {
            const rules = modules[mod] || []
            if (kpiFilter === 'MAPPED') return rules.some(r => r.is_mapped || overrides[r.event_code] !== undefined)
            if (kpiFilter === 'UNMAPPED') return rules.some(r => !r.is_mapped && !(r.event_code in overrides))
            return true
        })
    }, [moduleKeys, modules, kpiFilter, overrides])

    // Active module
    const activeModule = selectedModule && filteredModuleKeys.includes(selectedModule) ? selectedModule : filteredModuleKeys[0] || null
    const activeRules = useMemo(() => {
        if (!activeModule) return []
        let rules = modules[activeModule] || []
        if (kpiFilter === 'MAPPED') rules = rules.filter(r => r.is_mapped || overrides[r.event_code] !== undefined)
        if (kpiFilter === 'UNMAPPED') rules = rules.filter(r => !r.is_mapped && !(r.event_code in overrides))
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            rules = rules.filter(r =>
                r.event_code.toLowerCase().includes(q) || r.label.toLowerCase().includes(q) ||
                r.account_code.toLowerCase().includes(q) || r.account_name.toLowerCase().includes(q))
        }
        return rules
    }, [activeModule, modules, kpiFilter, overrides, searchQuery])

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
            result.applied > 0 ? toast.success(`Auto-detected ${result.applied} posting rules`) : toast.info('No new rules could be auto-detected')
            router.refresh()
        })
    }
    const handleSyncTemplate = () => {
        startTransition(async () => {
            const result = await syncFromTemplate()
            toast.success(result.message); router.refresh()
        })
    }
    const handleSave = () => {
        const rules = Object.entries(overrides).filter(([, id]) => id !== null && id !== undefined)
            .map(([event_code, account]) => ({ event_code, account_id: account! }))
        if (rules.length === 0) { toast.info('No changes to save'); return }
        startTransition(async () => {
            const result = await bulkSaveRules(rules)
            result.errors.length > 0 ? toast.error(`Saved with ${result.errors.length} errors`) : toast.success(result.message)
            setOverrides({}); setHasChanges(false); router.refresh()
        })
    }

    // ── Interactive tour actions — drives module selection ──
    const tourStepActions = useMemo(() => ({
        2: () => {
            // Prefer a module that has at least one event, fall back to first key
            const preferred = moduleKeys.find(k => (modules[k] || []).length > 0) || moduleKeys[0]
            if (preferred) setSelectedModule(preferred)
        },
    }), [moduleKeys, modules])

    // ── KPI config (all clickable) ──
    const kpis = [
        { label: 'Total Events', value: totalEvents, color: 'var(--app-primary)', icon: <Target size={14} />, filterKey: 'ALL' as string | null },
        { label: 'Mapped', value: mappedEvents, color: 'var(--app-success, #22c55e)', icon: <CheckCircle2 size={14} />, filterKey: 'MAPPED' as string | null },
        { label: 'Unmapped', value: unmappedEvents, color: 'var(--app-error, #ef4444)', icon: <XCircle size={14} />, filterKey: 'UNMAPPED' as string | null },
        { label: 'Coverage', value: `${coveragePct}%`, color: coveragePct >= 80 ? 'var(--app-success, #22c55e)' : coveragePct >= 50 ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)', icon: <BarChart3 size={14} />, filterKey: null },
        { label: 'Modules', value: moduleKeys.length, color: '#8b5cf6', icon: <Package size={14} />, filterKey: null },
    ]

    return (
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300 overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ── Header ── */}
            {!focusMode && (
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {cameFromCOA && (
                            <button onClick={() => router.push('/finance/chart-of-accounts')}
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-xl border transition-all mr-1"
                                style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                                <ChevronLeft size={14} /> COA
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
                        <button data-tour="postingrules-coa-btn" onClick={() => router.push('/finance/chart-of-accounts')}
                            className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all"
                            style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                            <BookOpen size={13} /> Chart of Accounts
                        </button>
                        <button data-tour="postingrules-sync-btn" onClick={handleSyncTemplate} disabled={isPending}
                            className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50"
                            style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                            <RefreshCcw size={13} /> Sync Template
                        </button>
                        <button data-tour="postingrules-autodetect-btn" onClick={handleAutoDetect} disabled={isPending}
                            className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50"
                            style={{
                                color: 'var(--app-warning, #f59e0b)',
                                borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)',
                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
                            }}>
                            <Zap size={13} /> Auto-Detect
                        </button>
                        {hasChanges && (
                            <button data-tour="postingrules-save-btn" onClick={handleSave} disabled={isPending}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', color: 'white', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Changes
                            </button>
                        )}
                        <PageTour tourId="finance-posting-rules" stepActions={tourStepActions} />
                    </div>
                </div>
            )}

            {/* ── KPI Strip (clickable filters) ── */}
            {!focusMode && (
                <div data-tour="postingrules-kpi-strip" className="flex-shrink-0 mb-4 px-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                    {kpis.map(k => {
                        const isActive = kpiFilter === k.filterKey || (k.filterKey === 'ALL' && kpiFilter === null) || (k.filterKey === null && kpiFilter === null)
                        const isClickable = k.filterKey !== null
                        return (
                            <button key={k.label}
                                onClick={() => {
                                    if (!isClickable) return
                                    if (k.filterKey === 'ALL' || kpiFilter === k.filterKey) setKpiFilter(null)
                                    else setKpiFilter(k.filterKey)
                                }}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                                style={{
                                    background: isActive && isClickable
                                        ? `color-mix(in srgb, ${k.color} 8%, var(--app-surface))`
                                        : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: isActive && isClickable
                                        ? `2px solid color-mix(in srgb, ${k.color} 40%, transparent)`
                                        : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    cursor: isClickable ? 'pointer' : 'default',
                                    transform: isActive && isClickable ? 'scale(1.02)' : 'scale(1)',
                                }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: `color-mix(in srgb, ${k.color} ${isActive && isClickable ? '18' : '10'}%, transparent)`, color: k.color }}>
                                    {k.icon}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[9px] font-bold uppercase tracking-wider truncate"
                                        style={{ color: isActive && isClickable ? k.color : 'var(--app-muted-foreground)' }}>{k.label}</div>
                                    <div className="text-sm font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{k.value}</div>
                                </div>
                            </button>
                        )
                    })}

                    {/* Coverage ring */}
                    <div className="flex items-center justify-center px-3 py-2 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <svg width="48" height="48" viewBox="0 0 48 48">
                            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--app-border)" strokeWidth="3" />
                            <circle cx="24" cy="24" r="20" fill="none"
                                stroke={coveragePct >= 80 ? 'var(--app-success, #22c55e)' : coveragePct >= 50 ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)'}
                                strokeWidth="3" strokeLinecap="round"
                                strokeDasharray={`${(coveragePct / 100) * 125.6} 125.6`}
                                transform="rotate(-90 24 24)" />
                            <text x="24" y="26" textAnchor="middle" fill="var(--app-foreground)"
                                fontSize="11" fontWeight="900">{coveragePct}%</text>
                        </svg>
                    </div>
                </div>
            )}

            {/* ── Toolbar (focus mode: compact) ── */}
            <div data-tour="postingrules-search-bar" className="flex items-center gap-2 mb-3 flex-shrink-0 px-0">
                {focusMode && (
                    <div className="flex items-center gap-2 flex-shrink-0 mr-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)', color: 'var(--app-primary)' }}>
                            <Target size={12} /> <span>{mappedEvents}/{totalEvents}</span>
                        </div>
                        {kpiFilter && (
                            <button onClick={() => setKpiFilter(null)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)', color: 'var(--app-primary)' }}>
                                {kpiFilter} <X size={10} />
                            </button>
                        )}
                    </div>
                )}
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                    <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search events, accounts..."
                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] rounded-xl outline-none transition-all"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.background = 'var(--app-surface)' }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
                </div>
                <button onClick={() => setFocusMode(p => !p)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border transition-all flex-shrink-0 text-[11px] font-bold"
                    style={{
                        color: focusMode ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                        borderColor: focusMode ? 'color-mix(in srgb, var(--app-primary) 30%, transparent)' : 'var(--app-border)',
                        background: focusMode ? 'color-mix(in srgb, var(--app-primary) 6%, transparent)' : 'transparent',
                    }}>
                    {focusMode ? <><Minimize2 size={13} /> Exit</> : <Maximize2 size={13} />}
                </button>
            </div>

            {/* ── Main: Module Sidebar + 2-Column Rules ── */}
            <div className="flex-1 min-h-0 flex gap-0 rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--app-border)' }}>

                {/* Module Sidebar */}
                <div data-tour="postingrules-module-sidebar" className="w-[180px] md:w-[200px] flex-shrink-0 overflow-y-auto custom-scrollbar"
                    style={{ background: 'var(--app-surface)', borderRight: '1px solid var(--app-border)' }}>
                    {filteredModuleKeys.map(mod => {
                        const meta = getMeta(mod)
                        const Icon = meta.icon
                        const isActive = mod === activeModule
                        const modRules = modules[mod] || []
                        const mapped = modRules.filter(r => r.is_mapped || overrides[r.event_code] !== undefined).length

                        return (
                            <button key={mod} onClick={() => { setSelectedModule(mod); setSearchQuery('') }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all"
                                style={{
                                    background: isActive ? `color-mix(in srgb, ${meta.color} 8%, transparent)` : 'transparent',
                                    borderLeft: isActive ? `3px solid ${meta.color}` : '3px solid transparent',
                                    borderBottom: '1px solid var(--app-border)',
                                }}>
                                <Icon size={14} style={{ color: meta.color, flexShrink: 0 }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-bold truncate"
                                        style={{ color: isActive ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                        {meta.label}
                                    </div>
                                    <div className="text-[9px] font-bold tabular-nums"
                                        style={{ color: mapped === modRules.length && modRules.length > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>
                                        {mapped}/{modRules.length} mapped
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Rules Content */}
                <div data-tour="postingrules-rules-grid" className="flex-1 flex flex-col min-w-0">
                    {/* Module title bar */}
                    {activeModule && (() => {
                        const meta = getMeta(activeModule)
                        const Icon = meta.icon
                        return (
                            <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-2"
                                style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                    style={{ background: `color-mix(in srgb, ${meta.color} 10%, transparent)` }}>
                                    <Icon size={13} style={{ color: meta.color }} />
                                </div>
                                <span className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--app-foreground)' }}>
                                    {meta.label}
                                </span>
                                <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
                                    style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                    {activeRules.length} events
                                </span>
                            </div>
                        )
                    })()}

                    {/* 2-column grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {activeRules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Target size={32} className="text-app-muted-foreground mb-2 opacity-30" />
                                <p className="text-[12px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {searchQuery ? 'No matching events' : kpiFilter ? `No ${kpiFilter.toLowerCase()} events in this module` : 'No events'}
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
                                {activeRules.map(rule => {
                                    const currentId = getAccountId(rule.event_code, rule.account)
                                    const isOverridden = rule.event_code in overrides
                                    return (
                                        <div key={rule.event_code}
                                            className="flex items-center gap-2 px-3 py-2 transition-all"
                                            style={{
                                                borderBottom: '1px solid var(--app-border)',
                                                borderRight: '1px solid var(--app-border)',
                                                background: isOverridden ? 'color-mix(in srgb, var(--app-primary) 4%, transparent)' : 'transparent',
                                            }}>
                                            <div className="flex-shrink-0">
                                                {currentId
                                                    ? <CheckCircle2 size={13} style={{ color: 'var(--app-success, #22c55e)' }} />
                                                    : <XCircle size={13} style={{ color: 'var(--app-error, #ef4444)', opacity: 0.4 }} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                    {rule.label}
                                                </div>
                                                <div className="text-[9px] font-mono truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                                                    {rule.event_code}
                                                </div>
                                            </div>
                                            <AccountTreePicker
                                                value={currentId}
                                                onChange={id => setRule(rule.event_code, id)}
                                                accounts={accounts}
                                                mode={rule.event_code.startsWith('automation.') ? 'root' : 'posting'}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2.5"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', marginTop: '-1px', borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>
                    {filteredModuleKeys.length} modules
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
