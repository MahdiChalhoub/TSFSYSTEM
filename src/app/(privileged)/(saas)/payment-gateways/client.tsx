'use client'

import { useState, useMemo, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    CreditCard, Search, ArrowLeft, X, Check,
    Globe, Filter, Layers, MapPin, Plus, LayoutGrid, MapPinned,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    deleteRefPaymentGateway, toggleRefPaymentGateway,
} from '@/app/actions/reference'
import { runTimed } from '@/lib/perf-timing'
import { GatewayEditorDialog } from './GatewayEditorDialog'
import ViewByGateway from './view-by-gateway'
import ViewByCountry from './view-by-country'
import type { RefGateway, RefCountryLite } from './shared'

const inputCls = "w-full text-[12px] font-bold px-3 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary focus:ring-2 focus:ring-app-primary/10 transition-all"

type ViewMode = 'gateway' | 'country'

export default function PaymentGatewaysClient({ allGateways, initialOrgGateways, countries }: {
    allGateways: RefGateway[]
    initialOrgGateways: Array<Record<string, unknown>>
    countries: RefCountryLite[]
}) {
    const router = useRouter()
    const [, startTransition] = useTransition()

    const [viewMode, setViewMode] = useState<ViewMode>('gateway')
    const [search, setSearch] = useState('')
    const [familyFilter, setFamilyFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
    const [regionFilter, setRegionFilter] = useState('')

    const [expanded, setExpanded] = useState<number | null>(null)
    const [editorOpen, setEditorOpen] = useState(false)
    const [editorTarget, setEditorTarget] = useState<RefGateway | null>(null)
    const [pendingDelete, setPendingDelete] = useState<RefGateway | null>(null)

    // Cross-navigation focus state — set when user pivots from one view to the other
    const [focusGatewayId, setFocusGatewayId] = useState<number | null>(null)
    const [focusCountryIso2, setFocusCountryIso2] = useState<string | null>(null)

    function openCreate() {
        setEditorTarget(null)
        setEditorOpen(true)
    }
    function openEdit(gw: RefGateway) {
        setEditorTarget(gw)
        setEditorOpen(true)
    }
    async function handleToggle(gw: RefGateway) {
        const res = await runTimed(
            'saas.payment-gateways:toggle-active',
            () => toggleRefPaymentGateway(gw.id),
        )
        if (res.success) {
            toast.success(`${gw.name} ${gw.is_active ? 'deactivated' : 'activated'}`)
            startTransition(() => router.refresh())
        } else {
            toast.error(res.error || 'Failed to toggle')
        }
    }
    async function handleConfirmDelete() {
        if (!pendingDelete) return
        const target = pendingDelete
        setPendingDelete(null)
        const res = await runTimed(
            'saas.payment-gateways:delete',
            () => deleteRefPaymentGateway(target.id),
        )
        if (res.success) {
            toast.success(`${target.name} removed`)
            startTransition(() => router.refresh())
        } else {
            toast.error(res.error || 'Failed to delete')
        }
    }
    function askDelete(gw: RefGateway) {
        const inUse = initialOrgGateways.some(og => og.gateway === gw.id)
        if (inUse) {
            toast.error('In use by one or more orgs — deactivate instead.')
            return
        }
        setPendingDelete(gw)
    }

    // Pivot: gateway-card flag → country view
    function gotoCountry(iso2: string) {
        const code = iso2.toUpperCase()
        setViewMode('country')
        setFocusCountryIso2(code)
        setFocusGatewayId(null)
    }
    // Pivot: country chip → gateway view
    function gotoGateway(gatewayId: number) {
        setViewMode('gateway')
        setFocusGatewayId(gatewayId)
        setFocusCountryIso2(null)
        setExpanded(gatewayId)
    }

    // Scroll-to-focused-card after pivot
    useEffect(() => {
        if (viewMode === 'gateway' && focusGatewayId != null) {
            const el = document.getElementById(`gw-card-${focusGatewayId}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        if (viewMode === 'country' && focusCountryIso2) {
            const el = document.getElementById(`country-card-${focusCountryIso2.toUpperCase()}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [viewMode, focusGatewayId, focusCountryIso2])

    /* ── Derived data ── */
    const families = useMemo(
        () => [...new Set(allGateways.map(g => g.provider_family).filter(Boolean))].sort() as string[],
        [allGateways],
    )

    const regions = useMemo(
        () => [...new Set(countries.map(c => c.region).filter(Boolean))].sort() as string[],
        [countries],
    )

    const countriesByIso2 = useMemo(() => {
        const map: Record<string, RefCountryLite> = {}
        countries.forEach(c => { map[c.iso2.toUpperCase()] = c })
        return map
    }, [countries])

    // Filter gateways for "By Gateway" view (search/family/status)
    const filteredGateways = useMemo(() => {
        let list = allGateways
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(g =>
                g.name.toLowerCase().includes(q) ||
                g.code.toLowerCase().includes(q) ||
                (g.provider_family || '').toLowerCase().includes(q) ||
                (g.description || '').toLowerCase().includes(q) ||
                (g.country_codes || []).some(cc => {
                    if (cc.toLowerCase().includes(q)) return true
                    const c = countriesByIso2[cc.toUpperCase()]
                    return c?.name.toLowerCase().includes(q) || false
                }),
            )
        }
        if (familyFilter) list = list.filter(g => g.provider_family === familyFilter)
        if (statusFilter === 'active') list = list.filter(g => g.is_active)
        if (statusFilter === 'inactive') list = list.filter(g => !g.is_active)
        return list
    }, [allGateways, search, familyFilter, statusFilter, countriesByIso2])

    // Filter for "By Country" view: same gateway-level filters apply, plus a country search.
    const filteredCountries = useMemo(() => {
        if (!search) return countries
        const q = search.toLowerCase()
        return countries.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.iso2.toLowerCase().includes(q) ||
            (c.iso3 || '').toLowerCase().includes(q) ||
            (c.region || '').toLowerCase().includes(q) ||
            (c.subregion || '').toString().toLowerCase().includes(q),
        )
    }, [countries, search])

    // KPIs
    const activeCount = allGateways.filter(g => g.is_active).length
    const globalCount = allGateways.filter(g => g.is_global).length
    const regionalCount = allGateways.length - globalCount
    const familyCount = families.length
    const countriesCovered = useMemo(() => {
        const set = new Set<string>()
        allGateways.forEach(g => (g.country_codes || []).forEach(cc => set.add(cc.toUpperCase())))
        return set.size
    }, [allGateways])

    const hasActiveFilters = !!(search || familyFilter || statusFilter || regionFilter)

    function clearFilters() {
        setSearch(''); setFamilyFilter(''); setStatusFilter(''); setRegionFilter('')
        setFocusGatewayId(null); setFocusCountryIso2(null)
    }

    return (
        <div className="app-page max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* ═══ Header ═══ */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2 fade-in-up">
                <div className="flex items-center gap-4">
                    <Link href="/saas-home">
                        <button className="w-9 h-9 rounded-xl border border-app-border flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all">
                            <ArrowLeft size={16} />
                        </button>
                    </Link>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: 'var(--app-primary-bg)', border: '1px solid var(--app-primary-border)' }}>
                        <CreditCard size={26} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                            SaaS · Reference Data
                        </p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground">
                            Payment Gateway Catalog
                        </h1>
                        <p className="text-[11px] text-app-muted-foreground mt-0.5">
                            Browse the catalog from either side: by gateway brand or by country coverage.
                        </p>
                    </div>
                </div>
                <button onClick={openCreate}
                        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl text-white transition-all hover:shadow-md"
                        style={{ background: 'var(--app-primary)' }}>
                    <Plus size={12} /> Add Gateway
                </button>
            </header>

            {/* ═══ KPI Strip ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                {[
                    { label: 'Total Gateways', value: allGateways.length, color: 'var(--app-primary)', icon: <Layers size={14} /> },
                    { label: 'Active', value: activeCount, color: 'var(--app-success, #22c55e)', icon: <Check size={14} /> },
                    { label: 'Global', value: globalCount, color: 'var(--app-info, #3b82f6)', icon: <Globe size={14} /> },
                    { label: 'Regional', value: regionalCount, color: 'var(--app-accent)', icon: <MapPin size={14} /> },
                    { label: 'Families', value: familyCount, color: 'var(--app-warning)', icon: <Filter size={14} /> },
                    { label: 'Countries Covered', value: countriesCovered, color: 'var(--app-info, #3b82f6)', icon: <Globe size={14} /> },
                ].map(s => (
                    <div key={s.label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color }}>{s.icon}</div>
                        <div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground">{s.label}</div>
                            <div className="text-lg font-black text-app-foreground tabular-nums leading-none">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ═══ View Toggle + Filters ═══ */}
            <div className="flex flex-col gap-3">
                {/* Segmented view toggle */}
                <div className="inline-flex items-center gap-1 p-1 rounded-xl self-start"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <button
                        onClick={() => { setViewMode('gateway'); setFocusCountryIso2(null) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg transition-all"
                        style={{
                            background: viewMode === 'gateway' ? 'var(--app-primary)' : 'transparent',
                            color: viewMode === 'gateway' ? '#fff' : 'var(--app-muted-foreground)',
                        }}>
                        <LayoutGrid size={12} /> By Gateway
                    </button>
                    <button
                        onClick={() => { setViewMode('country'); setFocusGatewayId(null) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg transition-all"
                        style={{
                            background: viewMode === 'country' ? 'var(--app-primary)' : 'transparent',
                            color: viewMode === 'country' ? '#fff' : 'var(--app-muted-foreground)',
                        }}>
                        <MapPinned size={12} /> By Country
                    </button>
                </div>

                {/* Filter row */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={viewMode === 'gateway' ? 'Search by gateway name, code, family, country…' : 'Search countries by name, ISO, region…'}
                            className={`${inputCls} pl-9`} />
                    </div>

                    {viewMode === 'gateway' ? (
                        <select value={familyFilter} onChange={e => setFamilyFilter(e.target.value)}
                            className={`${inputCls} w-[160px] appearance-none pr-7`}
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                            <option value="">All Families</option>
                            {families.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    ) : (
                        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                            className={`${inputCls} w-[160px] appearance-none pr-7`}
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                            <option value="">All Regions</option>
                            {regions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    )}

                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as '' | 'active' | 'inactive')}
                        className={`${inputCls} w-[120px] appearance-none pr-7`}
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>

                    {hasActiveFilters && (
                        <button onClick={clearFilters}
                            className="text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground px-2 py-1.5 rounded-lg hover:bg-app-surface transition-all flex items-center gap-1">
                            <X size={10} /> Clear
                        </button>
                    )}

                    <div className="ml-auto text-[10px] font-bold text-app-muted-foreground">
                        {viewMode === 'gateway'
                            ? `${filteredGateways.length} of ${allGateways.length} gateways`
                            : `${countries.length} countries · ${allGateways.length} gateways`}
                    </div>
                </div>

                {/* Cross-pivot focus banner */}
                {viewMode === 'country' && focusCountryIso2 && (
                    <PivotBanner
                        text={`Showing payment gateways in ${countriesByIso2[focusCountryIso2.toUpperCase()]?.name || focusCountryIso2.toUpperCase()}`}
                        onClear={() => setFocusCountryIso2(null)}
                    />
                )}
                {viewMode === 'gateway' && focusGatewayId != null && (
                    <PivotBanner
                        text={`Focused on ${allGateways.find(g => g.id === focusGatewayId)?.name || 'gateway'} — click another card or clear to reset.`}
                        onClear={() => { setFocusGatewayId(null); setExpanded(null) }}
                    />
                )}
            </div>

            {/* ═══ Active View ═══ */}
            {viewMode === 'gateway' ? (
                <ViewByGateway
                    gateways={filteredGateways}
                    orgGateways={initialOrgGateways}
                    countriesByIso2={countriesByIso2}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    focusGatewayId={focusGatewayId}
                    onGotoCountry={gotoCountry}
                    onToggle={handleToggle}
                    onEdit={openEdit}
                    onAskDelete={askDelete}
                />
            ) : (
                <ViewByCountry
                    gateways={filteredGateways}
                    countries={filteredCountries}
                    orgGateways={initialOrgGateways}
                    regionFilter={regionFilter}
                    onGotoGateway={gotoGateway}
                    focusCountryIso2={focusCountryIso2}
                />
            )}

            {/* Empty states */}
            {viewMode === 'gateway' && filteredGateways.length === 0 && (
                <div className="text-center py-16 rounded-2xl border-2 border-dashed border-app-border">
                    <CreditCard size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-bold text-app-muted-foreground">
                        {hasActiveFilters ? 'No gateways match your filters' : 'No payment gateways in the catalog'}
                    </p>
                    <p className="text-[11px] text-app-muted-foreground mt-1">
                        {hasActiveFilters
                            ? 'Try adjusting your search or filter.'
                            : 'Click "Add Gateway" above, or run the seed_payment_gateways command.'}
                    </p>
                    {!hasActiveFilters && (
                        <button onClick={openCreate}
                                className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl text-white"
                                style={{ background: 'var(--app-primary)' }}>
                            <Plus size={12} /> Add First Gateway
                        </button>
                    )}
                </div>
            )}

            <GatewayEditorDialog
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                onSaved={() => startTransition(() => router.refresh())}
                initial={editorTarget}
            />

            <ConfirmDialog
                open={!!pendingDelete}
                onOpenChange={(o) => { if (!o) setPendingDelete(null) }}
                title={pendingDelete ? `Delete ${pendingDelete.name}?` : 'Delete'}
                description="This removes the gateway from the global catalog. Tenants who haven't activated it won't be affected."
                confirmText="Delete"
                variant="danger"
                onConfirm={handleConfirmDelete}
            />
        </div>
    )
}

function PivotBanner({ text, onClear }: { text: string; onClear: () => void }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold animate-in fade-in slide-in-from-top-2 duration-200"
            style={{
                background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                color: 'var(--app-primary)',
            }}>
            <Filter size={11} />
            <span className="flex-1">{text}</span>
            <button onClick={onClear}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black hover:bg-app-surface transition-all">
                <X size={10} /> Clear pivot
            </button>
        </div>
    )
}
