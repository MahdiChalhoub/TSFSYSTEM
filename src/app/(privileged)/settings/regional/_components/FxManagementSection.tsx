'use client'

import { useEffect, useMemo, useState, Fragment } from 'react'
import { toast } from 'sonner'
import {
    Coins, RefreshCcw, Plus, ShieldCheck, ShieldAlert,
    TrendingUp, TrendingDown, Play, Trash2, Wand2, AlertTriangle, Check,
} from 'lucide-react'
import {
    getCurrencies, getExchangeRates, getRevaluations,
    createExchangeRate, runRevaluation,
    getRatePolicies, createRatePolicy, updateRatePolicy, syncRatePolicy, syncAllRatePolicies,
    deleteRatePolicy, bulkCreateRatePolicies, bulkUpdateRatePolicyProvider,
    type Currency, type ExchangeRate, type CurrencyRevaluation, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import { erpFetch } from '@/lib/erp-api'

type Period = {
    id: number
    name: string
    start_date: string
    end_date: string
    status: string
    fiscal_year: number
}

type FiscalYear = {
    id: number
    name: string
    periods: Period[]
}

const RATE_TYPES: ExchangeRate['rate_type'][] = ['SPOT', 'AVERAGE', 'CLOSING', 'BUDGET']

/* ─── Local design helpers (mirror /settings/regional/client.tsx) ── */
const grad = (v: string) => ({ background: `linear-gradient(135deg, var(${v}), color-mix(in srgb, var(${v}) 60%, black))` })
const soft = (v: string, p = 12) => ({ backgroundColor: `color-mix(in srgb, var(${v}) ${p}%, transparent)` })

const SUB_TABS = [
    { key: 'rates' as const, label: 'Rates', icon: TrendingUp, color: '--app-success' },
    { key: 'policies' as const, label: 'Auto-Sync', icon: RefreshCcw, color: '--app-info' },
    { key: 'revaluations' as const, label: 'Revaluations', icon: Coins, color: '--app-warning' },
]

type FxView = 'rates' | 'policies' | 'revaluations';

export function FxManagementSection({ view, hideHeader, orgCurrencyCount, orgBaseCode }: {
    /** When set, renders only that sub-view (no internal tab strip).
     *  Used when this component is mounted inside the Currencies tab as
     *  an embedded sub-tab — the parent tab strip already provides nav. */
    view?: FxView;
    /** When true, suppress the internal "FX & Rates" header card too —
     *  use when the parent already shows context. */
    hideHeader?: boolean;
    /** Source-of-truth gating handed down from /settings/regional so this
     *  section doesn't disable itself when the finance.Currency mirror is
     *  lagged/empty. The parent already loaded OrgCurrencies; using them
     *  here decouples the UI gating from the mirror's freshness. */
    orgCurrencyCount?: number;
    orgBaseCode?: string | null;
} = {}) {
    const isEmbedded = !!view;
    const [tabState, setTab] = useState<FxView>('rates');
    const tab = view ?? tabState;
    const [currencies, setCurrencies] = useState<Currency[]>([])
    const [rates, setRates] = useState<ExchangeRate[]>([])
    const [revals, setRevals] = useState<CurrencyRevaluation[]>([])
    const [policies, setPolicies] = useState<CurrencyRatePolicy[]>([])
    const [years, setYears] = useState<FiscalYear[]>([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState<number | null>(null)
    const [syncingId, setSyncingId] = useState<number | null>(null)
    const [syncingAll, setSyncingAll] = useState(false)
    // Sync-All progress for the per-row spinner.
    const [syncAllProgress, setSyncAllProgress] = useState<{ done: number; total: number } | null>(null)
    const [bulkBusy, setBulkBusy] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    // Set-broker dialog state. Closed by default; opened from a button next
    // to "Auto-configure". Scope drives whether the codes list applies as
    // include / exclude or is ignored ("all").
    const [setBrokerOpen, setSetBrokerOpen] = useState(false)
    const [setBrokerProvider, setSetBrokerProvider] = useState<CurrencyRatePolicy['provider']>('FRANKFURTER')
    const [setBrokerScope, setSetBrokerScope] = useState<'all' | 'include' | 'exclude'>('all')
    const [setBrokerCodes, setSetBrokerCodes] = useState<string[]>([])
    const [setBrokerKey, setSetBrokerKey] = useState('')   // optional API key for paid providers
    const [setBrokerBusy, setSetBrokerBusy] = useState(false)
    // Inline-edit state: which row's multiplier/markup is being edited.
    const [editingPolicy, setEditingPolicy] = useState<{ id: number; multiplier: string; markup_pct: string } | null>(null)
    const [savingEdit, setSavingEdit] = useState(false)

    // Quick-add forms
    const [newRateOpen, setNewRateOpen] = useState(false)
    const [newPolicyOpen, setNewPolicyOpen] = useState(false)
    // Policies table filters — text + health pill + provider pill.
    const [policyQuery, setPolicyQuery] = useState('')
    const [policyHealthFilter, setPolicyHealthFilter] = useState<'all' | 'fresh' | 'stale' | 'fail' | 'never' | 'manual'>('all')
    const [policyProviderFilter, setPolicyProviderFilter] = useState<'all' | CurrencyRatePolicy['provider']>('all')
    // "Open as soon as the mirror materializes" — clicked while finance.Currency
    // hasn't synced yet. The useEffect below flips newPolicyOpen=true once
    // baseCurrency becomes available, so the click feels instant.
    const [pendingNewPolicy, setPendingNewPolicy] = useState(false)
    const [pendingNewRate, setPendingNewRate] = useState(false)

    useEffect(() => { void loadAll() }, [])

    async function loadAll() {
        setLoading(true)
        try {
            const [cs, rs, vs, ps, ys] = await Promise.all([
                getCurrencies(),
                getExchangeRates(),
                getRevaluations(),
                getRatePolicies(),
                erpFetch('fiscal-years/').then((r: any) => Array.isArray(r) ? r : (r?.results ?? [])),
            ])
            setCurrencies(cs)
            setRates(rs)
            setRevals(vs)
            setPolicies(ps)
            setYears(ys)
        } catch (e) {
            toast.error(`Failed to load: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setLoading(false)
        }
    }

    const baseCurrency = useMemo(() => currencies.find(c => c.is_base), [currencies])

    // Open the New Policy / New Rate form as soon as the mirror has produced
    // a baseCurrency. Without this the button felt broken: click → silent
    // toast → nothing happens because the form requires `base: Currency`.
    useEffect(() => {
        if (pendingNewPolicy && baseCurrency) {
            setNewPolicyOpen(true)
            setPendingNewPolicy(false)
        }
        if (pendingNewRate && baseCurrency) {
            setNewRateOpen(true)
            setPendingNewRate(false)
        }
    }, [pendingNewPolicy, pendingNewRate, baseCurrency])
    /** Effective gating: if the parent passed OrgCurrency state, use it as the
     *  source of truth so the UI works even when the finance.Currency mirror
     *  is empty (cron lagged, mirror raised silently, etc.). The backend's
     *  bulk_create now self-heals, so we just need to *let the user click*. */
    const effectiveBaseCode = baseCurrency?.code ?? orgBaseCode ?? null
    const effectiveTotalCcy = Math.max(currencies.length, orgCurrencyCount ?? 0)
    const hasBase = !!effectiveBaseCode
    const hasNonBase = effectiveTotalCcy >= 2
    const periods = useMemo(() => years.flatMap(y => (y.periods ?? []).map(p => ({ ...p, fiscal_year_name: y.name }))), [years])

    // Group rates by from→to for tidier display
    const ratesByPair = useMemo(() => {
        const m = new Map<string, ExchangeRate[]>()
        rates.forEach(r => {
            const k = `${r.from_code}→${r.to_code}`
            const arr = m.get(k) ?? []
            arr.push(r)
            m.set(k, arr)
        })
        return Array.from(m.entries()).map(([k, list]) => ({
            pair: k,
            list: list.sort((a, b) => b.effective_date.localeCompare(a.effective_date)),
        }))
    }, [rates])

    /** Latest rate per (from_code, to_code, rate_type) — used to surface the
     *  actual stored rate on the policies row, so the operator doesn't have
     *  to cross-reference the Rate History tab to see what got synced. */
    const latestRateByKey = useMemo(() => {
        const m = new Map<string, ExchangeRate>()
        for (const r of rates) {
            const k = `${r.from_code}→${r.to_code}|${r.rate_type}`
            const prev = m.get(k)
            if (!prev || r.effective_date > prev.effective_date) m.set(k, r)
        }
        return m
    }, [rates])

    async function handleRunRevaluation(periodId: number) {
        setRunning(periodId)
        try {
            const res = await runRevaluation(periodId, 'OFFICIAL')
            if (!res.success) {
                toast.error(res.error || 'Revaluation failed')
                return
            }
            if (res.data === null) {
                toast.info(res.detail || 'No foreign-currency activity to revalue')
                return
            }
            const r = res.data!
            const sign = Number(r.net_impact) >= 0 ? '+' : ''
            toast.success(`Revaluation posted: net impact ${sign}${r.net_impact} (${r.accounts_processed} account${r.accounts_processed === 1 ? '' : 's'})`)
            await loadAll()
            setTab('revaluations')
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
        } finally {
            setRunning(null)
        }
    }

    async function handleSyncPolicy(id: number) {
        setSyncingId(id)
        try {
            const res = await syncRatePolicy(id)
            if (res.success) toast.success(res.message || 'Sync OK')
            else toast.error(res.message || res.error || 'Sync failed')
            await loadAll()
        } finally {
            setSyncingId(null)
        }
    }

    async function handleSyncAll() {
        setSyncingAll(true)
        // The backend processes serially; we don't yet stream progress. To avoid
        // a misleading "0/N" placeholder, show the total only and flip to a final
        // count when the response lands.
        const eligible = policies.filter(p => p.provider !== 'MANUAL').length
        setSyncAllProgress({ done: 0, total: eligible })
        try {
            const res = await syncAllRatePolicies()
            if (!res.success) { toast.error(res.error || 'Sync-all failed'); return }
            const ok = (res.results ?? []).filter(r => r.ok).length
            const fail = (res.results ?? []).filter(r => !r.ok).length
            toast.success(`Synced ${ok} policy${ok === 1 ? '' : 'ies'}${fail > 0 ? `, ${fail} failed` : ''}`)
            await loadAll()
        } finally {
            setSyncingAll(false)
            setSyncAllProgress(null)
        }
    }

    async function handleDeletePolicy(p: CurrencyRatePolicy) {
        if (!confirm(`Delete the auto-sync policy for ${p.from_code} → ${p.to_code}? Existing rate history is kept; only the policy goes away.`)) return
        setDeletingId(p.id)
        try {
            const res = await deleteRatePolicy(p.id)
            if (!res.success) { toast.error(res.error || 'Delete failed'); return }
            toast.success(`Removed ${p.from_code} → ${p.to_code} policy`)
            await loadAll()
        } finally {
            setDeletingId(null)
        }
    }

    async function handleSetBroker() {
        if ((setBrokerScope === 'include' || setBrokerScope === 'exclude') && setBrokerCodes.length === 0) {
            toast.error(setBrokerScope === 'include'
                ? 'Pick at least one currency to include.'
                : 'Pick at least one currency to exclude.')
            return
        }
        setSetBrokerBusy(true)
        try {
            const provider_config: Record<string, any> = {}
            const key = setBrokerKey.trim()
            // Each broker reads a slightly different config key. We set them
            // all to the same value so the policy works regardless of which
            // provider it ends up assigned to.
            if (key) {
                provider_config.access_key = key   // exchangerate.host
                provider_config.api_key = key      // FIXER
                provider_config.app_id = key       // OpenExchangeRates
            }
            const res = await bulkUpdateRatePolicyProvider({
                provider: setBrokerProvider,
                provider_config: Object.keys(provider_config).length ? provider_config : undefined,
                scope: setBrokerScope,
                from_currency_codes: setBrokerScope === 'all' ? undefined : setBrokerCodes,
                // For 'include' scope, create policies for picked codes that
                // don't have one yet — that's what makes first-time setup work.
                create_if_missing: setBrokerScope === 'include',
            })
            if (!res.success) { toast.error(res.error || 'Failed to update broker'); return }
            const createdN = res.created?.length ?? 0
            const updatedN = (res.count ?? 0) - createdN
            toast.success(
                `Broker = ${setBrokerProvider}` +
                (updatedN ? ` · ${updatedN} updated` : '') +
                (createdN ? ` · ${createdN} created` : ''),
            )
            setSetBrokerOpen(false)
            setSetBrokerCodes([])
            setSetBrokerKey('')
            await loadAll()
        } finally {
            setSetBrokerBusy(false)
        }
    }

    async function handleBulkCreate() {
        setBulkBusy(true)
        try {
            const res = await bulkCreateRatePolicies({
                provider: 'ECB', rate_type: 'SPOT', auto_sync: true,
            })
            if (!res.success) { toast.error(res.error || 'Bulk create failed'); return }
            const made = res.created?.length ?? 0
            const skipped = res.skipped?.length ?? 0
            if (made === 0 && skipped > 0) {
                toast.info('Every active currency already has a policy.')
            } else {
                toast.success(`Created ${made} polic${made === 1 ? 'y' : 'ies'}${skipped ? ` · skipped ${skipped} existing` : ''}`)
            }
            await loadAll()
        } finally {
            setBulkBusy(false)
        }
    }

    async function commitInlineEdit() {
        if (!editingPolicy) return
        const mul = Number(editingPolicy.multiplier)
        const mk = Number(editingPolicy.markup_pct)
        if (!isFinite(mul) || mul <= 0) { toast.error('Multiplier must be a positive number'); return }
        if (!isFinite(mk) || mk < -50 || mk > 50) { toast.error('Markup % must be between -50 and 50'); return }
        setSavingEdit(true)
        try {
            const r = await updateRatePolicy(editingPolicy.id, {
                multiplier: editingPolicy.multiplier,
                markup_pct: editingPolicy.markup_pct,
            })
            if (!r.success) { toast.error(r.error || 'Update failed'); return }
            setEditingPolicy(null)
            await loadAll()
        } finally {
            setSavingEdit(false)
        }
    }

    /** Classify a policy's freshness based on its last successful sync.
     *  This is the freshness rule the UI surfaces — *not* the backend's own
     *  truth. Backend-side, OK + stale rates remain valid; we just warn. */
    function policyHealth(p: CurrencyRatePolicy): 'manual' | 'never' | 'fail' | 'stale' | 'fresh' {
        if (p.provider === 'MANUAL') return 'manual'
        if (!p.last_synced_at) return 'never'
        if (p.last_sync_status === 'FAIL') return 'fail'
        const ageH = (Date.now() - new Date(p.last_synced_at).getTime()) / 36e5
        if (ageH > 36) return 'stale'
        return 'fresh'
    }

    if (loading) {
        return (
            <div className="bg-app-surface rounded-2xl border border-app-border/50 p-10 flex items-center justify-center">
                <RefreshCcw size={16} className="animate-spin text-app-muted-foreground" />
            </div>
        )
    }

    const subCounts: Record<typeof tab, number> = {
        rates: rates.length, policies: policies.length, revaluations: revals.length,
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* ── Section header (suppress when embedded — parent already shows context) ── */}
            {!hideHeader && !isEmbedded && (
                <div className="bg-app-surface rounded-2xl border border-app-border/50 px-4 py-3 flex items-center justify-between flex-wrap gap-3"
                     style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0" style={grad('--app-success')}>
                            <Coins size={14} style={{ color: 'var(--app-primary-foreground, #fff)' }} />
                        </div>
                        <div>
                            <div className="font-black uppercase tracking-widest text-app-foreground" style={{ fontSize: 11 }}>FX & Rates</div>
                            <p className="text-app-muted-foreground mt-0.5" style={{ fontSize: 9 }}>
                                Exchange rate history · Auto-sync policies · Period-end revaluation
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <BasePill base={baseCurrency} />
                        <button onClick={() => loadAll()}
                            title="Refresh"
                            className="w-8 h-8 rounded-lg flex items-center justify-center border border-app-border/50 hover:bg-app-background transition-colors"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            <RefreshCcw size={13} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Sub-tab pill strip (only when standalone — parent provides nav otherwise) ── */}
            {!isEmbedded && (
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-app-surface border border-app-border/50">
                    {SUB_TABS.map(t => {
                        const Icon = t.icon
                        const active = tab === t.key
                        const n = subCounts[t.key]
                        return (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all duration-200 ${active ? 'shadow-md' : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-background'}`}
                                style={active ? { ...grad(t.color), color: 'var(--app-primary-foreground, #fff)' } : {}}>
                                <Icon size={12} /> {t.label}
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded tabular-nums"
                                    style={active
                                        ? { background: 'color-mix(in srgb, var(--app-primary-foreground, #fff) 22%, transparent)' }
                                        : { background: 'var(--app-background)' }}>{n}</span>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Currencies are managed in the parent Currencies tab — no
                duplicate sub-tab here. The FX section just consumes them. */}

            {/* ── Rates tab ─────────────────────────────────────────── */}
            {tab === 'rates' && (
                <div className="bg-app-surface rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
                    <SectionHeader
                        icon={<TrendingUp size={13} style={{ color: 'var(--app-success)' }} />}
                        title="Exchange Rate History"
                        subtitle={`Rates relative to base (${baseCurrency?.code ?? '—'}) · most-recent first per pair`}
                        action={
                            <PrimaryButton
                                colorVar="--app-success"
                                disabled={!hasNonBase || !hasBase}
                                title={!hasBase
                                    ? 'Set a base in the Currencies tab first'
                                    : !hasNonBase
                                        ? 'Enable a non-base currency in the Currencies tab first'
                                        : 'Add a new rate row'}
                                onClick={() => {
                                    if (!hasBase) { toast.error('Set a base currency first — Currencies tab → ⭐'); return }
                                    if (!hasNonBase) { toast.error('Enable at least one non-base currency in the Currencies tab.'); return }
                                    if (!baseCurrency) {
                                        // Form needs a finance.Currency object — wait for the mirror.
                                        setPendingNewRate(true)
                                        toast.info('Resolving currencies…')
                                        void loadAll()
                                        return
                                    }
                                    setNewRateOpen(true)
                                }}
                            >
                                <Plus size={11} /> New Rate
                            </PrimaryButton>
                        }
                    />
                    {newRateOpen && baseCurrency && (
                        <div className="px-4 py-3 border-b border-app-border/50" style={soft('--app-success', 4)}>
                            <NewRateForm
                                currencies={currencies}
                                base={baseCurrency}
                                onCancel={() => setNewRateOpen(false)}
                                onSubmit={async (payload) => {
                                    const r = await createExchangeRate(payload)
                                    if (!r.success) { toast.error(r.error || 'Failed'); return }
                                    toast.success('Rate added')
                                    setNewRateOpen(false)
                                    await loadAll()
                                }}
                            />
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {ratesByPair.length === 0 ? (
                            <EmptyState
                                icon={<TrendingUp size={24} className="text-app-muted-foreground opacity-20" />}
                                title="No rates on file"
                                hint="Click New Rate to enter your first one — or set up an Auto-Sync policy in Rate Rules to fetch them automatically."
                            />
                        ) : ratesByPair.map(({ pair, list }) => {
                            // list is already sorted newest-first by effective_date.
                            const latest = list[0]
                            const previous = list[1]
                            const latestRate = Number(latest.rate)
                            const prevRate = previous ? Number(previous.rate) : null
                            const delta = prevRate !== null ? latestRate - prevRate : null
                            const deltaPct = prevRate !== null && prevRate !== 0 ? (delta! / prevRate) * 100 : null
                            return (
                                <div key={pair} className="rounded-lg border border-app-border/50 overflow-hidden">
                                    {/* Pair summary header — latest + delta + count at a glance */}
                                    <div className="px-3 py-2 flex items-center justify-between gap-3 flex-wrap"
                                         style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black font-mono text-app-foreground" style={{ fontSize: 13 }}>{pair}</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                                style={{ ...soft('--app-info', 12), color: 'var(--app-info)' }}>
                                                {list.length} {list.length === 1 ? 'snapshot' : 'snapshots'}
                                            </span>
                                            {list.length === 1 && (
                                                <span className="text-[9px] italic text-app-muted-foreground">
                                                    history starts after the next sync
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-app-muted-foreground" style={{ fontSize: 10 }}>latest</span>
                                            <span className="font-mono font-black tabular-nums text-app-foreground" style={{ fontSize: 13 }}>{latestRate.toFixed(6)}</span>
                                            {delta !== null && deltaPct !== null && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold whitespace-nowrap"
                                                    style={delta === 0
                                                        ? { ...soft('--app-muted-foreground', 12), color: 'var(--app-muted-foreground)', fontSize: 10 }
                                                        : delta > 0
                                                            ? { ...soft('--app-success', 12), color: 'var(--app-success)', fontSize: 10 }
                                                            : { ...soft('--app-error', 12), color: 'var(--app-error)', fontSize: 10 }}
                                                    title={`vs previous (${previous!.effective_date})`}>
                                                    {delta > 0 ? <TrendingUp size={10} /> : delta < 0 ? <TrendingDown size={10} /> : null}
                                                    {delta > 0 ? '+' : ''}{deltaPct.toFixed(2)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 30%, transparent)' }}>
                                                <th className="px-3 py-1.5 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Date</th>
                                                <th className="px-3 py-1.5 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Type</th>
                                                <th className="px-3 py-1.5 text-right text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Rate</th>
                                                <th className="px-3 py-1.5 text-right text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Δ vs prev</th>
                                                <th className="px-3 py-1.5 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Source</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {list.slice(0, 10).map((r, idx) => {
                                                const next = list[idx + 1]
                                                const rowDelta = next ? Number(r.rate) - Number(next.rate) : null
                                                const rowDeltaPct = next && Number(next.rate) !== 0
                                                    ? ((Number(r.rate) - Number(next.rate)) / Number(next.rate)) * 100
                                                    : null
                                                const isToday = r.effective_date === new Date().toISOString().slice(0, 10)
                                                return (
                                                    <tr key={r.id} className="border-t border-app-border/30 hover:bg-app-background/40">
                                                        <td className="px-3 py-1.5 text-[11px] font-mono whitespace-nowrap"
                                                            style={{ color: isToday ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                                            {r.effective_date}
                                                            {isToday && <span className="ml-1.5 text-[8px] font-black uppercase tracking-widest"
                                                                style={{ color: 'var(--app-success)' }}>today</span>}
                                                        </td>
                                                        <td className="px-3 py-1.5 whitespace-nowrap">
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                                                style={{ ...soft('--app-info', 12), color: 'var(--app-info)' }}>
                                                                {r.rate_type}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right text-[11px] font-mono font-black tabular-nums text-app-foreground whitespace-nowrap">{Number(r.rate).toFixed(6)}</td>
                                                        <td className="px-3 py-1.5 text-right text-[10px] font-mono tabular-nums whitespace-nowrap"
                                                            style={rowDelta === null
                                                                ? { color: 'var(--app-muted-foreground)' }
                                                                : rowDelta === 0
                                                                    ? { color: 'var(--app-muted-foreground)' }
                                                                    : rowDelta > 0
                                                                        ? { color: 'var(--app-success)' }
                                                                        : { color: 'var(--app-error)' }}>
                                                            {rowDelta === null ? '—'
                                                                : rowDelta === 0 ? '0.00%'
                                                                : `${rowDelta > 0 ? '+' : ''}${rowDeltaPct!.toFixed(2)}%`}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-[10px] font-mono text-app-muted-foreground">{r.source ?? '—'}</td>
                                                    </tr>
                                                )
                                            })}
                                            {list.length > 10 && (
                                                <tr><td colSpan={5} className="px-3 py-1.5 text-[10px] text-app-muted-foreground text-center italic">… {list.length - 10} older snapshot(s) hidden</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Auto-Sync (policies) tab — redesigned ───────────────── */}
            {tab === 'policies' && (() => {
                // Health roll-up of all policies → drives the overview pills.
                const healthCounts = policies.reduce<Record<ReturnType<typeof policyHealth>, number>>((acc, p) => {
                    const h = policyHealth(p); acc[h] = (acc[h] ?? 0) + 1; return acc
                }, { manual: 0, never: 0, fail: 0, stale: 0, fresh: 0 })
                // Use OrgCurrency-derived counts when available — the finance.Currency
                // mirror can be empty/lagged after first reaching this page, in which
                // case `currencies.length` would falsely gate everything off.
                const nonBaseFromMirror = currencies.filter(c => !c.is_base && c.is_active).length
                const nonBaseCount = Math.max(nonBaseFromMirror, Math.max(0, (orgCurrencyCount ?? 0) - (orgBaseCode ? 1 : 0)))
                const policiedFromIds = new Set(policies.map(p => p.from_currency))
                const missingCoverage = nonBaseFromMirror > 0
                    ? currencies.filter(c => !c.is_base && c.is_active && !policiedFromIds.has(c.id)).length
                    : nonBaseCount  // mirror empty → assume nothing covered yet

                return (
                    <div className="space-y-3">
                        {/* Health roll-up — at-a-glance status of every policy. */}
                        {policies.length > 0 && (
                            <div className="bg-app-surface rounded-2xl border border-app-border/50 p-3 grid gap-2"
                                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                                <HealthPill label="Healthy"   value={healthCounts.fresh}  color="--app-success" icon={<Check size={12} />} />
                                <HealthPill label="Stale >36h" value={healthCounts.stale}  color="--app-warning" icon={<AlertTriangle size={12} />} />
                                <HealthPill label="Failing"   value={healthCounts.fail}   color="--app-error"   icon={<AlertTriangle size={12} />} />
                                <HealthPill label="Never run" value={healthCounts.never}  color="--app-muted-foreground" icon={<RefreshCcw size={12} />} />
                                <HealthPill label="Manual"    value={healthCounts.manual} color="--app-info"    icon={<ShieldCheck size={12} />} />
                            </div>
                        )}

                        <div className="bg-app-surface rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
                            <SectionHeader
                                icon={<RefreshCcw size={13} style={{ color: 'var(--app-info)' }} />}
                                title="Auto-Sync Policies"
                                subtitle={
                                    policies.length === 0
                                        ? 'One policy per pair · pulls a fresh rate from the provider on a daily cron'
                                        : `${policies.length} polic${policies.length === 1 ? 'y' : 'ies'}` +
                                          (missingCoverage ? ` · ${missingCoverage} active currenc${missingCoverage === 1 ? 'y' : 'ies'} not covered` : ' · all active currencies covered')
                                }
                                action={
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {missingCoverage > 0 && nonBaseCount > 0 && hasBase && (
                                            <button onClick={handleBulkCreate} disabled={bulkBusy}
                                                title={`Create an ECB / SPOT / auto-sync policy for the ${missingCoverage} uncovered currenc${missingCoverage === 1 ? 'y' : 'ies'}`}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                                                style={{ ...soft('--app-success', 12), color: 'var(--app-success)', border: '1px solid color-mix(in srgb, var(--app-success) 30%, transparent)' }}>
                                                <Wand2 size={11} className={bulkBusy ? 'animate-spin' : ''} />
                                                {bulkBusy ? 'Configuring…' : `Auto-configure ${missingCoverage}`}
                                            </button>
                                        )}
                                        {policies.length > 0 && (
                                            <button onClick={() => setSetBrokerOpen(true)}
                                                title="Switch the broker (ECB / Frankfurter / exchangerate.host / MANUAL) for one currency, all currencies, or a custom group"
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                                                style={{ ...soft('--app-warning', 12), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                                                <ShieldCheck size={11} /> Set Broker
                                            </button>
                                        )}
                                        <button onClick={handleSyncAll} disabled={syncingAll || policies.filter(p => p.provider !== 'MANUAL').length === 0}
                                            title="Sync every active non-MANUAL policy now"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-app-border/50 hover:bg-app-background transition-all disabled:opacity-50"
                                            style={{ color: 'var(--app-info)' }}>
                                            <RefreshCcw size={11} className={syncingAll ? 'animate-spin' : ''} />
                                            {syncingAll
                                                ? `Syncing ${syncAllProgress?.total ?? 0}…`
                                                : `Sync All${policies.filter(p => p.provider !== 'MANUAL').length ? ` (${policies.filter(p => p.provider !== 'MANUAL').length})` : ''}`}
                                        </button>
                                        <PrimaryButton
                                            colorVar="--app-info"
                                            disabled={!hasNonBase || !hasBase}
                                            title={!hasBase
                                                ? 'Set a base in the Currencies tab first'
                                                : !hasNonBase
                                                    ? 'Enable a non-base currency in the Currencies tab first'
                                                    : 'Configure a new auto-sync pair'}
                                            onClick={() => {
                                                if (!hasBase) { toast.error('Set a base currency first — Currencies tab → ⭐'); return }
                                                if (!hasNonBase) { toast.error('Enable at least one non-base currency in the Currencies tab.'); return }
                                                if (!baseCurrency) {
                                                    // Form needs the mirror — open as soon as it lands.
                                                    setPendingNewPolicy(true)
                                                    toast.info('Resolving currencies…')
                                                    void loadAll()
                                                    return
                                                }
                                                setNewPolicyOpen(true)
                                            }}
                                        >
                                            <Plus size={11} /> New Policy
                                        </PrimaryButton>
                                    </div>
                                }
                            />
                            {newPolicyOpen && baseCurrency && (
                                <div className="px-4 py-3 border-b border-app-border/50" style={soft('--app-info', 4)}>
                                    <NewPolicyForm
                                        currencies={currencies}
                                        base={baseCurrency}
                                        existingPairs={new Set(policies.map(p => `${p.from_currency}-${p.to_currency}-${p.rate_type}`))}
                                        onCancel={() => setNewPolicyOpen(false)}
                                        onSubmit={async (payload) => {
                                            const r = await createRatePolicy(payload)
                                            if (!r.success) { toast.error(r.error || 'Create failed'); return }
                                            toast.success('Policy created')
                                            setNewPolicyOpen(false)
                                            await loadAll()
                                        }}
                                    />
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                                {/* Filter row — only when worth filtering. */}
                                {policies.length >= 4 && (() => {
                                    const providers = Array.from(new Set(policies.map(p => p.provider))) as CurrencyRatePolicy['provider'][]
                                    return (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <input value={policyQuery} onChange={e => setPolicyQuery(e.target.value)}
                                                placeholder="Filter by pair, provider, status…"
                                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-app-info/20 transition-all flex-1 min-w-[180px]"
                                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-app-border/50 bg-app-surface" title="Filter by health">
                                                {(['all', 'fresh', 'stale', 'fail', 'never', 'manual'] as const).map(k => (
                                                    <button key={k} onClick={() => setPolicyHealthFilter(k)}
                                                        className="px-2 py-1 text-[10px] font-bold rounded-md transition-all"
                                                        style={policyHealthFilter === k
                                                            ? (k === 'all'
                                                                ? { background: 'var(--app-foreground)', color: 'var(--app-background)' }
                                                                : { ...soft(HEALTH_COLOR[k], 18), color: `var(${HEALTH_COLOR[k]})` })
                                                            : { color: 'var(--app-muted-foreground)' }}>
                                                        {k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)}
                                                    </button>
                                                ))}
                                            </div>
                                            {providers.length > 1 && (
                                                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-app-border/50 bg-app-surface" title="Filter by provider">
                                                    <button onClick={() => setPolicyProviderFilter('all')}
                                                        className="px-2 py-1 text-[10px] font-bold rounded-md transition-all"
                                                        style={policyProviderFilter === 'all'
                                                            ? { background: 'var(--app-foreground)', color: 'var(--app-background)' }
                                                            : { color: 'var(--app-muted-foreground)' }}>
                                                        All providers
                                                    </button>
                                                    {providers.map(prov => (
                                                        <button key={prov} onClick={() => setPolicyProviderFilter(prov)}
                                                            className="px-2 py-1 text-[10px] font-bold font-mono rounded-md transition-all"
                                                            style={policyProviderFilter === prov
                                                                ? { ...soft(prov === 'MANUAL' ? '--app-muted-foreground' : '--app-success', 18), color: prov === 'MANUAL' ? 'var(--app-muted-foreground)' : 'var(--app-success)' }
                                                                : { color: 'var(--app-muted-foreground)' }}>
                                                            {prov}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                                {policies.length === 0 ? (
                                    <div className="py-8 px-4 text-center">
                                        <div className="flex justify-center"><RefreshCcw size={28} className="text-app-muted-foreground opacity-20" /></div>
                                        <p className="text-[11px] font-bold text-app-foreground mt-2">No auto-sync policies yet</p>
                                        <p className="text-[10px] text-app-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
                                            Wire ECB (free, no API key) into your active currencies in one click — or build them one at a time with <em>New Policy</em>.
                                        </p>
                                        {nonBaseCount > 0 && hasBase && (
                                            <button onClick={handleBulkCreate} disabled={bulkBusy}
                                                className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                                                style={{ ...grad('--app-success'), color: 'var(--app-primary-foreground, #fff)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-success) 30%, transparent)' }}>
                                                <Wand2 size={12} className={bulkBusy ? 'animate-spin' : ''} />
                                                {bulkBusy ? 'Configuring…' : `Auto-configure ${nonBaseCount} currenc${nonBaseCount === 1 ? 'y' : 'ies'}`}
                                            </button>
                                        )}
                                        {!hasBase && orgCurrencyCount === 0 && (
                                            <p className="text-[10px] text-app-muted-foreground mt-3">
                                                Add at least one currency in the <em>Select Currency</em> tab first, then come back here.
                                            </p>
                                        )}
                                        {!hasBase && orgCurrencyCount && orgCurrencyCount > 0 && (
                                            <p className="text-[10px] text-app-muted-foreground mt-3">
                                                Mark one of your currencies as <strong>base</strong> (⭐) in the <em>Select Currency</em> tab first.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-app-border/50 overflow-hidden">
                                        <table className="w-full">
                                            <thead>
                                                <tr style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Pair</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Type</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Mode</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground" title="How often the rate is refreshed">Refresh</th>
                                                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-app-muted-foreground" title="Multiplier — click to edit">×</th>
                                                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-app-muted-foreground" title="Markup % — click to edit">+ %</th>
                                                    <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Auto</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Last sync</th>
                                                    <th className="px-3 py-2"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const q = policyQuery.trim().toLowerCase()
                                                    const filtered = policies.filter(p => {
                                                        if (policyHealthFilter !== 'all' && policyHealth(p) !== policyHealthFilter) return false
                                                        if (policyProviderFilter !== 'all' && p.provider !== policyProviderFilter) return false
                                                        if (!q) return true
                                                        return [
                                                            p.from_code, p.to_code, `${p.from_code}→${p.to_code}`, `${p.from_code}/${p.to_code}`,
                                                            p.provider, p.rate_type, p.last_sync_status ?? '',
                                                        ].some(s => s.toLowerCase().includes(q))
                                                    })
                                                    if (filtered.length === 0) return (
                                                        <tr><td colSpan={9} className="px-3 py-6 text-center text-[10px] text-app-muted-foreground italic">
                                                            No policies match the current filter.
                                                        </td></tr>
                                                    )
                                                    return filtered.map(p => {
                                                    const health = policyHealth(p)
                                                    const isEditingThisRow = editingPolicy?.id === p.id
                                                    const showErr = health === 'fail' && !!p.last_sync_error
                                                    return (
                                                    <Fragment key={p.id}>
                                                        <tr className="border-t border-app-border/30 hover:bg-app-background/40 transition-colors">
                                                            {/* Pair + rate readout — kept on a single visual block with no wrap */}
                                                            <td className="px-3 py-2 whitespace-nowrap">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-2 h-2 rounded-full shrink-0"
                                                                        style={{ background: `var(${HEALTH_COLOR[health]})`, boxShadow: `0 0 0 3px color-mix(in srgb, var(${HEALTH_COLOR[health]}) 18%, transparent)` }}
                                                                        title={HEALTH_LABEL[health]} />
                                                                    <span className="font-black font-mono text-app-foreground" style={{ fontSize: 12 }}>
                                                                        {p.from_code}<span className="text-app-muted-foreground mx-0.5">→</span>{p.to_code}
                                                                    </span>
                                                                </div>
                                                                {(() => {
                                                                    const r = latestRateByKey.get(`${p.from_code}→${p.to_code}|${p.rate_type}`)
                                                                    if (!r) return (
                                                                        <div className="font-mono text-app-muted-foreground italic mt-0.5 ml-4" style={{ fontSize: 10, lineHeight: 1.2 }}>
                                                                            no rate yet · click Sync
                                                                        </div>
                                                                    )
                                                                    const adjusted = Number(r.rate)
                                                                    const mul = Number(p.multiplier) || 1
                                                                    const mk = Number(p.markup_pct) || 0
                                                                    const factor = mul * (1 + mk / 100)
                                                                    const hasSpread = Math.abs(factor - 1) > 1e-9 && isFinite(factor) && factor !== 0
                                                                    const raw = hasSpread ? adjusted / factor : null
                                                                    return (
                                                                        <div className="font-mono mt-0.5 ml-4 flex items-baseline gap-1.5"
                                                                            style={{ fontSize: 10, lineHeight: 1.2 }}
                                                                            title={`Latest stored rate · ${r.effective_date} · source: ${r.source ?? 'MANUAL'}`}>
                                                                            <span className="text-app-muted-foreground">1 {p.from_code} =</span>
                                                                            <span className="text-app-foreground font-black tabular-nums">{adjusted.toFixed(6)}</span>
                                                                            <span className="text-app-muted-foreground">{p.to_code}</span>
                                                                            {raw !== null && (
                                                                                <span className="text-app-muted-foreground/70 ml-1"
                                                                                    title={`Raw provider rate before ×${mul.toFixed(4)} and +${mk.toFixed(4)}%`}>
                                                                                    raw {raw.toFixed(6)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                })()}
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap">
                                                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md"
                                                                    style={{ ...soft('--app-info', 12), color: 'var(--app-info)', border: '1px solid color-mix(in srgb, var(--app-info) 25%, transparent)' }}>
                                                                    {p.rate_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap">
                                                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                                                                    style={p.provider === 'MANUAL'
                                                                        ? { ...soft('--app-muted-foreground', 14), color: 'var(--app-muted-foreground)', border: '1px solid color-mix(in srgb, var(--app-muted-foreground) 25%, transparent)' }
                                                                        : { ...soft('--app-success', 12), color: 'var(--app-success)', border: '1px solid color-mix(in srgb, var(--app-success) 25%, transparent)' }}
                                                                    title={p.provider === 'MANUAL'
                                                                        ? 'Fixed rate — operator-entered, never auto-fetched'
                                                                        : `Floating rate — pulled from ${p.provider}`}>
                                                                    {p.provider === 'MANUAL' ? 'Fixed' : 'Floating'}
                                                                    <span className="opacity-50">·</span>
                                                                    <span className="font-mono">{p.provider}</span>
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <select value={p.sync_frequency}
                                                                    onChange={async e => {
                                                                        const r = await updateRatePolicy(p.id, { sync_frequency: e.target.value as CurrencyRatePolicy['sync_frequency'] })
                                                                        if (!r.success) toast.error(r.error || 'Update failed')
                                                                        await loadAll()
                                                                    }}
                                                                    disabled={p.provider === 'MANUAL'}
                                                                    title={p.provider === 'MANUAL'
                                                                        ? 'Fixed rates have no refresh cadence'
                                                                        : 'Change how often this rate is refreshed'}
                                                                    className="text-[10px] font-bold rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-app-info/30 disabled:opacity-40"
                                                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                                                    <option value="ON_TRANSACTION">Per txn</option>
                                                                    <option value="DAILY">Daily</option>
                                                                    <option value="WEEKLY">Weekly</option>
                                                                    <option value="MONTHLY">Monthly</option>
                                                                </select>
                                                            </td>

                                                            {/* Multiplier — inline editable */}
                                                            <td className="px-3 py-2 text-right text-[11px] font-mono tabular-nums whitespace-nowrap">
                                                                {isEditingThisRow ? (
                                                                    <input value={editingPolicy.multiplier}
                                                                        onChange={e => setEditingPolicy(s => s ? { ...s, multiplier: e.target.value } : s)}
                                                                        onBlur={commitInlineEdit}
                                                                        onKeyDown={e => { if (e.key === 'Enter') commitInlineEdit(); if (e.key === 'Escape') setEditingPolicy(null) }}
                                                                        autoFocus disabled={savingEdit}
                                                                        className="w-20 px-2 py-1 rounded-md text-right outline-none focus:ring-2 focus:ring-app-info/30"
                                                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                                                ) : (
                                                                    <button onClick={() => setEditingPolicy({ id: p.id, multiplier: p.multiplier, markup_pct: p.markup_pct })}
                                                                        title="Click to edit multiplier"
                                                                        className="text-app-foreground hover:underline decoration-dotted">
                                                                        {Number(p.multiplier).toFixed(4)}
                                                                    </button>
                                                                )}
                                                            </td>

                                                            {/* Markup — inline editable */}
                                                            <td className="px-3 py-2 text-right text-[11px] font-mono tabular-nums whitespace-nowrap">
                                                                {isEditingThisRow ? (
                                                                    <input value={editingPolicy.markup_pct}
                                                                        onChange={e => setEditingPolicy(s => s ? { ...s, markup_pct: e.target.value } : s)}
                                                                        onBlur={commitInlineEdit}
                                                                        onKeyDown={e => { if (e.key === 'Enter') commitInlineEdit(); if (e.key === 'Escape') setEditingPolicy(null) }}
                                                                        disabled={savingEdit}
                                                                        className="w-20 px-2 py-1 rounded-md text-right outline-none focus:ring-2 focus:ring-app-info/30"
                                                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                                                ) : (
                                                                    <button onClick={() => setEditingPolicy({ id: p.id, multiplier: p.multiplier, markup_pct: p.markup_pct })}
                                                                        title="Click to edit markup %"
                                                                        className="text-app-foreground hover:underline decoration-dotted">
                                                                        {Number(p.markup_pct).toFixed(2)}
                                                                    </button>
                                                                )}
                                                            </td>

                                                            <td className="px-3 py-2 text-center">
                                                                <button onClick={async () => {
                                                                    const r = await updateRatePolicy(p.id, { auto_sync: !p.auto_sync })
                                                                    if (!r.success) toast.error(r.error || 'Update failed')
                                                                    await loadAll()
                                                                }}
                                                                    disabled={p.provider === 'MANUAL'}
                                                                    title={p.provider === 'MANUAL'
                                                                        ? 'MANUAL policies do not auto-sync (provider has no fetch step)'
                                                                        : p.auto_sync ? 'Disable daily auto-sync' : 'Enable daily auto-sync'}
                                                                    className="w-9 h-4 rounded-full relative transition-all mx-auto block disabled:opacity-30"
                                                                    style={{ background: p.auto_sync ? 'var(--app-info)' : 'var(--app-border)' }}>
                                                                    <span className={`w-3 h-3 rounded-full absolute top-0.5 transition-all shadow ${p.auto_sync ? 'left-[22px]' : 'left-0.5'}`}
                                                                        style={{ background: 'var(--app-primary-foreground, white)' }} />
                                                                </button>
                                                            </td>
                                                            <td className="px-3 py-2 text-[10px] whitespace-nowrap">
                                                                {p.last_synced_at
                                                                    ? <FreshSyncBadge health={health} status={p.last_sync_status} when={p.last_synced_at} error={p.last_sync_error} />
                                                                    : <span className="text-app-muted-foreground italic">never</span>}
                                                            </td>
                                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button onClick={() => handleSyncPolicy(p.id)}
                                                                        disabled={syncingId === p.id || p.provider === 'MANUAL'}
                                                                        title={p.provider === 'MANUAL' ? 'MANUAL provider cannot be synced' : 'Fetch fresh rate from provider'}
                                                                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border transition-colors disabled:opacity-50 whitespace-nowrap"
                                                                        style={{
                                                                            color: 'var(--app-info)',
                                                                            borderColor: 'color-mix(in srgb, var(--app-info) 30%, transparent)',
                                                                            background: syncingId === p.id ? `color-mix(in srgb, var(--app-info) 10%, transparent)` : 'transparent',
                                                                        }}>
                                                                        <RefreshCcw size={11} className={syncingId === p.id ? 'animate-spin' : ''} />
                                                                        {syncingId === p.id ? 'Syncing…' : 'Sync'}
                                                                    </button>
                                                                    <button onClick={() => handleDeletePolicy(p)}
                                                                        disabled={deletingId === p.id}
                                                                        title="Delete this policy (rate history is preserved)"
                                                                        className="p-1.5 rounded-md hover:bg-app-error/10 transition-colors disabled:opacity-50">
                                                                        <Trash2 size={12} style={{ color: 'var(--app-error)' }} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {showErr && (
                                                            <tr className="border-t-0">
                                                                <td colSpan={9} className="px-3 pb-2 pt-0">
                                                                    <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-md"
                                                                        style={{ ...soft('--app-error', 8), border: '1px solid color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
                                                                        <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color: 'var(--app-error)' }} />
                                                                        <span className="text-[10px] leading-relaxed font-mono break-words" style={{ color: 'var(--app-error)' }}>
                                                                            {p.last_sync_error}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                    )
                                                    })
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {policies.length > 0 && (
                                    <div className="rounded-lg p-3 flex items-start gap-2"
                                        style={{ ...soft('--app-info', 6), border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                                        <RefreshCcw size={11} className="mt-0.5 shrink-0" style={{ color: 'var(--app-info)' }} />
                                        <div className="text-[10px] leading-relaxed text-app-foreground">
                                            <strong className="font-black uppercase tracking-widest text-[9px]" style={{ color: 'var(--app-info)' }}>Daily cron</strong> —
                                            add <code className="font-mono px-1 py-0.5 rounded" style={soft('--app-info', 12)}>python manage.py sync_currency_rates</code>
                                            {' '}to a <code className="font-mono">0 9 * * *</code> schedule to refresh policies with <em>auto-sync on</em> automatically.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* ── Set-Broker dialog — handles all four scopes:
                 1) one currency  → Scope=Specific, pick 1 chip
                 2) all           → Scope=All
                 3) all except    → Scope=Exclude, pick chips to exclude
                 4) group of N    → Scope=Specific, pick N chips                ── */}
            {setBrokerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setSetBrokerOpen(false) }}>
                    <div className="w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid color-mix(in srgb, var(--app-warning) 30%, var(--app-border))',
                            boxShadow: '0 20px 60px color-mix(in srgb, var(--app-warning) 18%, transparent)',
                        }}>
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'var(--app-warning)' }} />

                        {/* Header */}
                        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ ...soft('--app-warning', 14), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                                <ShieldCheck size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-black text-app-foreground" style={{ fontSize: 14, lineHeight: 1.3 }}>Set Broker</div>
                                <p className="font-bold uppercase tracking-widest text-app-muted-foreground mt-0.5" style={{ fontSize: 9 }}>
                                    Re-assign the rate provider for one, all, or a custom group of currencies
                                </p>
                            </div>
                            <button onClick={() => setSetBrokerOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-app-border/40 text-app-muted-foreground hover:text-app-foreground transition-colors shrink-0 -m-1">
                                <Plus size={14} className="rotate-45" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-5 pb-4 space-y-4">
                            {/* Provider picker — visual cards instead of plain select */}
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">1. Pick provider</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { code: 'ECB' as const,                label: 'ECB',                  hint: 'Free · ECB daily XML, 32 majors + pegs' },
                                        { code: 'FRANKFURTER' as const,        label: 'Frankfurter',          hint: 'Free · ECB-derived JSON · no auth' },
                                        { code: 'EXCHANGERATE_HOST' as const,  label: 'exchangerate.host',    hint: '~170 ccys · API access_key' },
                                        { code: 'FIXER' as const,              label: 'Fixer.io',             hint: 'Paid · 170+ ccys · api_key' },
                                        { code: 'OPENEXCHANGERATES' as const,  label: 'OpenExchangeRates',    hint: 'Paid · 170+ ccys · app_id' },
                                        { code: 'MANUAL' as const,             label: 'Manual',               hint: 'You enter rates by hand · no fetch' },
                                    ].map(opt => {
                                        const active = setBrokerProvider === opt.code
                                        return (
                                            <button key={opt.code} type="button"
                                                onClick={() => setSetBrokerProvider(opt.code)}
                                                className="text-left px-3 py-2 rounded-lg transition-all"
                                                style={active
                                                    ? { ...soft('--app-warning', 12), border: '1px solid color-mix(in srgb, var(--app-warning) 35%, transparent)' }
                                                    : { background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="font-black text-[11px]"
                                                        style={{ color: active ? 'var(--app-warning)' : 'var(--app-foreground)' }}>{opt.label}</span>
                                                    {active && <Check size={11} style={{ color: 'var(--app-warning)' }} />}
                                                </div>
                                                <div className="text-[9px] text-app-muted-foreground mt-0.5 leading-tight">{opt.hint}</div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Optional API key (paid providers) */}
                            {(setBrokerProvider === 'EXCHANGERATE_HOST' || setBrokerProvider === 'FIXER' || setBrokerProvider === 'OPENEXCHANGERATES') && (
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">API key</div>
                                    <input value={setBrokerKey} onChange={e => setSetBrokerKey(e.target.value)}
                                        type="password" autoComplete="off" placeholder="Provider access_key / api_key"
                                        className="w-full px-3 py-1.5 text-[12px] rounded-lg outline-none focus:ring-2 focus:ring-app-warning/20"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                    <p className="text-[9px] text-app-muted-foreground mt-1 leading-tight">
                                        Stored in each policy&apos;s <code className="font-mono">provider_config</code>. Leave blank to keep the existing key.
                                    </p>
                                </div>
                            )}

                            {/* Scope picker */}
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">2. Apply to</div>
                                <div className="inline-flex items-stretch rounded-xl overflow-hidden border h-9 w-full"
                                    style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                                    {([
                                        { key: 'all',     label: 'All currencies',    hint: 'Every active policy switches.' },
                                        { key: 'include', label: 'Specific',          hint: 'Only the picked currencies.' },
                                        { key: 'exclude', label: 'All except',        hint: 'Everything except the picked.' },
                                    ] as const).map((opt, idx) => {
                                        const active = setBrokerScope === opt.key
                                        return (
                                            <button key={opt.key} type="button"
                                                onClick={() => setSetBrokerScope(opt.key)}
                                                title={opt.hint}
                                                className="flex-1 inline-flex items-center justify-center text-[11px] font-bold transition-all"
                                                style={{
                                                    color: active ? 'var(--app-warning)' : 'var(--app-muted-foreground)',
                                                    background: active ? `color-mix(in srgb, var(--app-warning) 12%, transparent)` : 'transparent',
                                                    borderLeft: idx === 0 ? 'none' : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                                }}>
                                                {opt.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Currency multi-select chips — only when scope ≠ all.
                                Source = ALL active non-base currencies the org has enabled
                                (not just policy-bearing ones). For currencies without a
                                policy yet, the backend will create one with the chosen
                                broker when create_if_missing is set in the apply payload. */}
                            {setBrokerScope !== 'all' && (() => {
                                const policyCodes = new Set(policies.map(p => p.from_code))
                                // Prefer the parent's OrgCurrency snapshot when available so
                                // the chip list works even if the finance.Currency mirror lags.
                                const fromMirror = currencies.filter(c => !c.is_base && c.is_active).map(c => c.code)
                                const codes = Array.from(new Set([...fromMirror, ...policyCodes])).sort()
                                if (codes.length === 0) return (
                                    <p className="text-[10px] text-app-muted-foreground italic">
                                        No active currencies — enable some in the <em>Select Currency</em> tab first.
                                    </p>
                                )
                                const toggleCode = (code: string) => {
                                    setSetBrokerCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])
                                }
                                return (
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">
                                                {setBrokerScope === 'include' ? '3. Pick currencies to switch' : '3. Pick currencies to KEEP unchanged'}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button type="button" onClick={() => setSetBrokerCodes(codes)}
                                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-app-warning/10"
                                                    style={{ color: 'var(--app-warning)' }}>Select all</button>
                                                <button type="button" onClick={() => setSetBrokerCodes([])}
                                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-app-warning/10"
                                                    style={{ color: 'var(--app-warning)' }}>Clear</button>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {codes.map(code => {
                                                const active = setBrokerCodes.includes(code)
                                                const hasPolicy = policyCodes.has(code)
                                                return (
                                                    <button key={code} type="button" onClick={() => toggleCode(code)}
                                                        title={hasPolicy
                                                            ? `Existing policy will be re-pointed to ${setBrokerProvider}`
                                                            : `No policy yet — a new one will be created with ${setBrokerProvider}`}
                                                        className="px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-all inline-flex items-center gap-1"
                                                        style={active
                                                            ? { ...soft('--app-warning', 14), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 35%, transparent)' }
                                                            : { background: 'var(--app-background)', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                                                        {active && <Check size={9} className="-mt-px" />}
                                                        {code}
                                                        {!hasPolicy && (
                                                            <span className="text-[8px] uppercase tracking-widest font-bold ml-0.5"
                                                                style={{ color: active ? 'var(--app-warning)' : 'var(--app-muted-foreground)' }}>
                                                                · new
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Impact preview */}
                            <div className="rounded-md p-2.5 flex items-start gap-2"
                                style={{ ...soft('--app-info', 6), border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                                <RefreshCcw size={11} className="mt-0.5 shrink-0" style={{ color: 'var(--app-info)' }} />
                                <div className="text-[10px] leading-relaxed text-app-foreground">
                                    {(() => {
                                        const total = policies.length
                                        const policyCodesNow = new Set(policies.map(p => p.from_code))
                                        let updatedN = 0
                                        let createdN = 0
                                        if (setBrokerScope === 'all') {
                                            updatedN = total
                                        } else if (setBrokerScope === 'include') {
                                            updatedN = policies.filter(p => setBrokerCodes.includes(p.from_code)).length
                                            createdN = setBrokerCodes.filter(c => !policyCodesNow.has(c)).length
                                        } else {
                                            updatedN = policies.filter(p => !setBrokerCodes.includes(p.from_code)).length
                                        }
                                        return (
                                            <>
                                                <strong className="font-black uppercase tracking-widest text-[9px]" style={{ color: 'var(--app-info)' }}>Impact</strong> —
                                                {updatedN > 0 && (
                                                    <> <strong className="font-black">{updatedN}</strong> polic{updatedN === 1 ? 'y' : 'ies'} switched to <strong className="font-black">{setBrokerProvider}</strong></>
                                                )}
                                                {createdN > 0 && (
                                                    <>{updatedN > 0 ? ' · ' : ' '}<strong className="font-black" style={{ color: 'var(--app-success)' }}>{createdN} new</strong> polic{createdN === 1 ? 'y' : 'ies'} created with <strong className="font-black">{setBrokerProvider}</strong></>
                                                )}
                                                {updatedN === 0 && createdN === 0 && <> Nothing selected — pick currencies or change scope.</>}
                                                {(updatedN > 0 || createdN > 0) && <>. Sync history is preserved; old <code className="font-mono">OK</code>/<code className="font-mono">FAIL</code> flags reset.</>}
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 flex items-center justify-end gap-2 border-t border-app-border/50"
                            style={{ background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                            <button onClick={() => setSetBrokerOpen(false)}
                                className="px-3.5 py-1.5 rounded-xl font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:bg-app-surface transition-all"
                                style={{ fontSize: 11 }}>
                                Cancel
                            </button>
                            <button onClick={handleSetBroker} disabled={setBrokerBusy}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all disabled:opacity-50"
                                style={{
                                    ...grad('--app-warning'),
                                    color: 'var(--app-primary-foreground, white)',
                                    fontSize: 11,
                                    boxShadow: '0 4px 12px color-mix(in srgb, var(--app-warning) 30%, transparent)',
                                }}>
                                {setBrokerBusy && <RefreshCcw size={11} className="animate-spin" />}
                                {setBrokerBusy ? 'Applying…' : 'Apply broker'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Revaluations tab ──────────────────────────────────── */}
            {tab === 'revaluations' && (
                <div className="space-y-4">
                    {/* Period actions card */}
                    <div className="bg-app-surface rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
                        <SectionHeader
                            icon={<Play size={13} style={{ color: 'var(--app-warning)' }} />}
                            title="Run Revaluation"
                            subtitle={`${periods.filter(p => p.status === 'OPEN').length} open period(s) eligible · click Revalue to mark-to-market a period`}
                        />
                        <div className="flex-1 overflow-y-auto p-3">
                            {periods.length === 0 ? (
                                <EmptyState
                                    icon={<Play size={24} className="text-app-muted-foreground opacity-20" />}
                                    title="No fiscal periods configured"
                                    hint="Create a fiscal year first in /finance/fiscal-years."
                                />
                            ) : (
                                <div className="rounded-lg border border-app-border/50 overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Period</th>
                                                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Window</th>
                                                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Status</th>
                                                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Reval&apos;d?</th>
                                                <th className="px-3 py-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {periods.map(p => {
                                                const existing = revals.find(r => r.fiscal_period === p.id && r.status === 'POSTED')
                                                return (
                                                    <tr key={p.id} className="border-t border-app-border/30 hover:bg-app-background/40 transition-colors">
                                                        <td className="px-3 py-2 text-[12px] font-black text-app-foreground">{p.name}</td>
                                                        <td className="px-3 py-2 text-[10px] font-mono text-app-muted-foreground">{p.start_date} → {p.end_date}</td>
                                                        <td className="px-3 py-2">
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded" style={statusPill(p.status)}>
                                                                {p.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-[11px]">
                                                            {existing ? (
                                                                <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--app-success)' }}>
                                                                    ✓ {Number(existing.net_impact) >= 0 ? '+' : ''}{existing.net_impact}
                                                                </span>
                                                            ) : (
                                                                <span className="text-app-muted-foreground">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <button onClick={() => handleRunRevaluation(p.id)}
                                                                disabled={running === p.id || p.status !== 'OPEN'}
                                                                title={p.status !== 'OPEN' ? 'Period must be OPEN' : `Revalue ${p.name}`}
                                                                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border border-app-border/50 hover:bg-app-background ml-auto transition-colors disabled:opacity-50"
                                                                style={{ color: 'var(--app-warning)' }}>
                                                                <Play size={10} /> {running === p.id ? 'Running…' : (existing ? 'Re-run' : 'Revalue')}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* History card */}
                    <div className="bg-app-surface rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
                        <SectionHeader
                            icon={<TrendingUp size={13} style={{ color: 'var(--app-success)' }} />}
                            title="Revaluation History"
                            subtitle={`${revals.length} run${revals.length === 1 ? '' : 's'} on file · per-scope mark-to-market audit trail`}
                        />
                        <div className="flex-1 overflow-y-auto p-3">
                            {revals.length === 0 ? (
                                <EmptyState
                                    icon={<TrendingUp size={24} className="text-app-muted-foreground opacity-20" />}
                                    title="No revaluations yet"
                                    hint="Run one above to mark a period to closing rate."
                                />
                            ) : (
                                <div className="rounded-lg border border-app-border/50 overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">When</th>
                                                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Period</th>
                                                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Scope</th>
                                                <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Gain</th>
                                                <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Loss</th>
                                                <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Net</th>
                                                <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Accts</th>
                                                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">JE</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {revals.map(r => (
                                                <tr key={r.id} className="border-t border-app-border/30 hover:bg-app-background/40 transition-colors">
                                                    <td className="px-3 py-2 text-[10px] font-mono text-app-muted-foreground">{r.revaluation_date}</td>
                                                    <td className="px-3 py-2 text-[11px] font-black text-app-foreground">{r.fiscal_year_name} / {r.period_name}</td>
                                                    <td className="px-3 py-2">
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                                            style={r.scope === 'OFFICIAL'
                                                                ? { ...soft('--app-success', 12), color: 'var(--app-success)' }
                                                                : { ...soft('--app-info', 12), color: 'var(--app-info)' }}>
                                                            {r.scope}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-[11px] font-mono tabular-nums" style={{ color: Number(r.total_gain) > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                                                        {Number(r.total_gain) > 0 && <TrendingUp size={10} className="inline mr-1" />}
                                                        {r.total_gain}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-[11px] font-mono tabular-nums" style={{ color: Number(r.total_loss) > 0 ? 'var(--app-error)' : 'var(--app-muted-foreground)' }}>
                                                        {Number(r.total_loss) > 0 && <TrendingDown size={10} className="inline mr-1" />}
                                                        {r.total_loss}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-[11px] font-mono font-black tabular-nums text-app-foreground">
                                                        {Number(r.net_impact) >= 0 ? '+' : ''}{r.net_impact}
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-[10px] tabular-nums text-app-muted-foreground">{r.accounts_processed}</td>
                                                    <td className="px-3 py-2 text-[10px] font-mono text-app-muted-foreground">{r.je_reference ?? '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ─── Reusable layout helpers (theme-aligned) ───────────────────────── */

function SectionHeader({ icon, title, subtitle, action }: {
    icon: React.ReactNode
    title: string
    subtitle?: string
    action?: React.ReactNode
}) {
    return (
        <div className="px-4 py-3 border-b border-app-border/50 flex items-center justify-between gap-3 shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
            <div className="min-w-0 flex-1">
                <div className="font-black uppercase tracking-widest text-app-foreground flex items-center gap-2"
                     style={{ fontSize: 11, lineHeight: 1.3 }}>
                    {icon}<span className="truncate">{title}</span>
                </div>
                {subtitle && <p className="text-app-muted-foreground mt-0.5 truncate" style={{ fontSize: 9, lineHeight: 1.3 }}>{subtitle}</p>}
            </div>
            {action}
        </div>
    )
}

function PrimaryButton({ children, onClick, disabled, title, colorVar }: {
    children: React.ReactNode
    onClick: () => void
    disabled?: boolean
    title?: string
    colorVar: string
}) {
    return (
        <button onClick={onClick} disabled={disabled} title={title}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={!disabled
                ? { ...grad(colorVar), color: 'var(--app-primary-foreground, #fff)', boxShadow: `0 4px 12px color-mix(in srgb, var(${colorVar}) 30%, transparent)` }
                : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
            {children}
        </button>
    )
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
    return (
        <div className="py-10 text-center">
            <div className="flex justify-center">{icon}</div>
            <p className="text-[11px] font-bold text-app-foreground mt-2">{title}</p>
            {hint && <p className="text-[9px] text-app-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">{hint}</p>}
        </div>
    )
}

function SyncStatusBadge({ status, when, error }: { status: string | null; when: string; error?: string | null }) {
    const colorVar =
        status === 'OK' ? '--app-success'
        : status === 'FAIL' ? '--app-error'
        : '--app-muted-foreground'
    return (
        <span title={error ?? ''} className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(${colorVar})` }} />
            <span className="font-mono text-[10px]" style={{ color: `var(${colorVar})` }}>
                {status} · {new Date(when).toLocaleString()}
            </span>
        </span>
    )
}

/* Health classification — keyed by the policyHealth() return value above. */
const HEALTH_COLOR = {
    fresh:  '--app-success',
    stale:  '--app-warning',
    fail:   '--app-error',
    never:  '--app-muted-foreground',
    manual: '--app-info',
} as const
const HEALTH_LABEL = {
    fresh:  'Healthy — synced in the last 36h',
    stale:  'Stale — last sync was over 36h ago, cron may not be running',
    fail:   'Failing — last attempt errored',
    never:  'Never synced — auto-sync hasn\'t run yet',
    manual: 'Manual provider — does not auto-sync',
} as const

function HealthPill({ label, value, color, icon }: {
    label: string; value: number; color: string; icon: React.ReactNode
}) {
    const dim = value === 0
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
            style={dim
                ? { background: 'transparent', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', opacity: 0.55 }
                : { ...soft(color, 8), border: `1px solid color-mix(in srgb, var(${color}) 25%, transparent)` }}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ ...soft(color, 14), color: `var(${color})` }}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-widest text-app-muted-foreground truncate">{label}</div>
                <div className="text-[14px] font-black tabular-nums leading-none mt-0.5"
                    style={{ color: dim ? 'var(--app-muted-foreground)' : `var(${color})` }}>{value}</div>
            </div>
        </div>
    )
}

/** Sync-time badge that uses the *health-derived* color (not just the raw
 *  status) — a 5-day-old "OK" reads as warning, not green. */
function FreshSyncBadge({ health, status, when, error }: {
    health: 'fresh' | 'stale' | 'fail' | 'never' | 'manual'
    status: string | null
    when: string
    error?: string | null
}) {
    const colorVar = HEALTH_COLOR[health]
    const ageH = (Date.now() - new Date(when).getTime()) / 36e5
    const ageLabel = ageH < 1 / 60 ? 'just now'
        : ageH < 1 ? `${Math.max(1, Math.round(ageH * 60))}m ago`
        : ageH < 48 ? `${Math.round(ageH)}h ago`
        : `${Math.round(ageH / 24)}d ago`
    return (
        <span title={error ?? HEALTH_LABEL[health]}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md whitespace-nowrap"
            style={{
                ...soft(colorVar, 10),
                border: `1px solid color-mix(in srgb, var(${colorVar}) 25%, transparent)`,
            }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `var(${colorVar})` }} />
            <span className="font-black uppercase tracking-wider" style={{ color: `var(${colorVar})`, fontSize: 9 }}>
                {status ?? '—'}
            </span>
            <span className="opacity-50" style={{ color: `var(${colorVar})`, fontSize: 9 }}>·</span>
            <span className="font-mono" style={{ color: `var(${colorVar})`, fontSize: 9 }}>
                {ageLabel}
            </span>
        </span>
    )
}

function BasePill({ base }: { base?: Currency }) {
    if (!base) {
        return (
            <a href="?tab=currencies"
                title="Click to open the Currencies tab and mark one as ⭐ default"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer hover:brightness-110 transition-all"
                style={{ ...soft('--app-warning', 12), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)' }}>
                <ShieldAlert size={10} /> Set base →
            </a>
        )
    }
    return (
        <a href="?tab=currencies"
            title={`Base = ${base.code}. Click to change it in the Currencies tab.`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer hover:brightness-110 transition-all"
            style={{ ...soft('--app-success', 12), color: 'var(--app-success)', border: '1px solid color-mix(in srgb, var(--app-success) 25%, transparent)' }}>
            <ShieldCheck size={10} /> Base: <span className="font-mono font-black">{base.code}</span>
        </a>
    )
}

function statusPill(s: string): React.CSSProperties {
    if (s === 'OPEN') return { ...soft('--app-success', 12), color: 'var(--app-success)' }
    if (s === 'CLOSED') return { ...soft('--app-muted-foreground', 12), color: 'var(--app-muted-foreground)' }
    return { ...soft('--app-info', 12), color: 'var(--app-info)' }
}

function NewRateForm({ currencies, base, onCancel, onSubmit }: {
    currencies: Currency[]
    base: Currency
    onCancel: () => void
    onSubmit: (p: { from_currency: number; to_currency: number; rate: string; rate_type: ExchangeRate['rate_type']; effective_date: string; source?: string }) => Promise<void>
}) {
    const non_base = currencies.filter(c => c.id !== base.id && c.is_active)
    const [fromId, setFromId] = useState<number | null>(non_base[0]?.id ?? null)
    const [rate, setRate] = useState('1.000000')
    const [rateType, setRateType] = useState<ExchangeRate['rate_type']>('SPOT')
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
    const [busy, setBusy] = useState(false)
    if (!fromId) return (
        <p className="text-[10px] text-app-muted-foreground">Add a non-base currency in the Currencies tab before entering rates.</p>
    )
    const fromCode = non_base.find(c => c.id === fromId)?.code ?? '???'
    const rateNum = Number(rate)
    const rateValid = isFinite(rateNum) && rateNum > 0
    const valid = rateValid && !!fromId
    return (
        <div className="space-y-3">
            {/* Header band — same accent (success) as the rates tab. */}
            <div className="flex items-center gap-2">
                <TrendingUp size={11} style={{ color: 'var(--app-success)' }} />
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success)' }}>New Exchange Rate</span>
                <span className="text-[9px] text-app-muted-foreground">— manual entry · stored under <code className="font-mono">source=MANUAL</code></span>
            </div>

            {/* Pair + rate type + date — same row, prefix/suffix labels mirror NewPolicyForm. */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-end">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-app-foreground mb-1">From</div>
                    <div className="flex items-stretch rounded-lg overflow-hidden border"
                        style={{ background: 'var(--app-background)', borderColor: 'var(--app-border)' }}>
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 11, background: 'color-mix(in srgb, var(--app-success) 8%, transparent)', borderRight: '1px solid var(--app-border)' }}>1×</span>
                        <select value={fromId} onChange={e => setFromId(Number(e.target.value))}
                            className="flex-1 px-2 py-1.5 text-[12px] font-mono outline-none bg-transparent text-app-foreground">
                            {non_base.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="self-end pb-1 text-center pr-1 pl-1">
                    <span className="text-[12px] font-mono font-black text-app-muted-foreground">→</span>
                </div>
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-app-foreground mb-1">Rate (in {base.code})</div>
                    <div className="flex items-stretch rounded-lg overflow-hidden border"
                        style={rateValid
                            ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                            : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
                        <input value={rate} onChange={e => setRate(e.target.value)} placeholder="1.000000"
                            inputMode="decimal"
                            className="flex-1 px-2 py-1.5 text-[12px] font-mono tabular-nums font-black outline-none bg-transparent text-app-foreground" />
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 11, background: 'color-mix(in srgb, var(--app-success) 8%, transparent)', borderLeft: '1px solid var(--app-border)' }}>{base.code}</span>
                    </div>
                </div>
                <div className="self-end pb-2 text-center text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground">·</div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-app-foreground mb-1">Type</div>
                        <select value={rateType} onChange={e => setRateType(e.target.value as ExchangeRate['rate_type'])}
                            className={INPUT_CLS} style={INPUT_STYLE}>
                            {RATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-app-foreground mb-1">Date</div>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE} />
                    </div>
                </div>
            </div>

            {/* Inline preview / error line. */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                {!rateValid ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>
                        <AlertTriangle size={10} /> Rate must be a positive number
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-md"
                        style={{ ...soft('--app-success', 8), color: 'var(--app-success)' }}
                        title={`On ${date}, 1 ${fromCode} will convert to ${rateNum.toFixed(6)} ${base.code}`}>
                        <TrendingUp size={10} /> Preview: 1 {fromCode} = <strong className="font-black">{rateNum.toFixed(6)}</strong> {base.code} on {date}
                    </span>
                )}
                <div className="flex items-center gap-2">
                    <button onClick={onCancel} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border/50 hover:bg-app-background transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button disabled={!valid || busy} onClick={async () => {
                        setBusy(true)
                        try {
                            await onSubmit({ from_currency: fromId!, to_currency: base.id, rate, rate_type: rateType, effective_date: date, source: 'MANUAL' })
                        } finally { setBusy(false) }
                    }}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                        style={!busy && valid
                            ? { ...grad('--app-success'), color: 'var(--app-primary-foreground, white)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-success) 30%, transparent)' }
                            : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                        {busy ? 'Adding…' : 'Add Rate'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ─── Form input styling tokens (kept inline so the file stays a single
       drop-in replacement; copy these to a shared util if reused) ── */
const INPUT_CLS = 'px-2 py-1.5 rounded-lg text-[11px] outline-none focus:ring-2 transition-all w-full'
const INPUT_STYLE: React.CSSProperties = {
    background: 'var(--app-background)',
    border: '1px solid var(--app-border)',
    color: 'var(--app-foreground)',
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-app-muted-foreground">{label}</span>
            {children}
        </div>
    )
}

function NewPolicyForm({ currencies, base, existingPairs, onCancel, onSubmit }: {
    currencies: Currency[]
    base: Currency
    /** `${from_id}-${to_id}-${rate_type}` keys already configured; blocks the
     *  unique-together violation client-side instead of failing on submit. */
    existingPairs: Set<string>
    onCancel: () => void
    onSubmit: (p: {
        from_currency: number
        to_currency: number
        rate_type: CurrencyRatePolicy['rate_type']
        provider: CurrencyRatePolicy['provider']
        auto_sync: boolean
        sync_frequency: CurrencyRatePolicy['sync_frequency']
        multiplier: string
        markup_pct: string
        bid_spread_pct?: string
        ask_spread_pct?: string
        provider_config?: Record<string, any>
    }) => Promise<void>
}) {
    const non_base = currencies.filter(c => c.id !== base.id && c.is_active)
    const [fromId, setFromId] = useState<number | null>(non_base[0]?.id ?? null)
    // ── Rate "mode" is a UI-level abstraction over `provider`. FIXED rates are
    //    `MANUAL` (operator types the rate, never auto-fetched). FLOATING are
    //    provider-fed — ECB / Frankfurter / exchangerate.host / Fixer / OXR. ──
    const [rateMode, setRateMode] = useState<'FIXED' | 'FLOATING'>('FLOATING')
    const [floatingProvider, setFloatingProvider] = useState<Exclude<CurrencyRatePolicy['provider'], 'MANUAL'>>('ECB')
    const provider: CurrencyRatePolicy['provider'] = rateMode === 'FIXED' ? 'MANUAL' : floatingProvider
    const [rateType, setRateType] = useState<CurrencyRatePolicy['rate_type']>('SPOT')
    const [syncFrequency, setSyncFrequency] = useState<CurrencyRatePolicy['sync_frequency']>('DAILY')
    const [multiplier, setMultiplier] = useState('1.000000')
    const [markupPct, setMarkupPct] = useState('0.0000')
    // Optional Bid/Ask spreads — both 0 means single-MID-row mode (default).
    const [bidSpreadPct, setBidSpreadPct] = useState('0.0000')
    const [askSpreadPct, setAskSpreadPct] = useState('0.0000')
    // Optional API key for paid providers — written to provider_config.
    const [apiKey, setApiKey] = useState('')
    const [autoSync, setAutoSync] = useState(true)
    const [busy, setBusy] = useState(false)
    if (!fromId) return <p className="text-[10px] text-app-muted-foreground">Add a non-base currency in the Currencies tab before creating a policy.</p>

    // Validation
    const mul = Number(multiplier)
    const mk = Number(markupPct)
    const bid = Number(bidSpreadPct)
    const ask = Number(askSpreadPct)
    const mulValid = isFinite(mul) && mul > 0
    const mkValid = isFinite(mk) && mk >= -50 && mk <= 50
    const bidValid = isFinite(bid) && bid >= 0 && bid <= 50
    const askValid = isFinite(ask) && ask >= 0 && ask <= 50
    const dupKey = `${fromId}-${base.id}-${rateType}`
    const isDup = existingPairs.has(dupKey)
    // Paid providers need a key; if rateMode=FLOATING && provider needs key, require apiKey
    const needsKey = provider === 'EXCHANGERATE_HOST' || provider === 'FIXER' || provider === 'OPENEXCHANGERATES'
    const keyValid = !needsKey || apiKey.trim().length > 0
    const valid = mulValid && mkValid && bidValid && askValid && !isDup && keyValid

    // Live preview: example raw rate × multiplier × (1+markup/100). Uses 1.0
    // as the synthetic raw rate so users see the adjustment math directly
    // without an extra API roundtrip.
    const previewAdjusted = mulValid
        ? (1 * mul * (mkValid ? (1 + mk / 100) : 1)).toFixed(6)
        : null

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <RefreshCcw size={11} style={{ color: 'var(--app-info)' }} />
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info)' }}>New Auto-Sync Policy</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                <div className="md:col-span-2">
                    <FieldLabel label="Pair">
                        <div className="flex items-center gap-2">
                            <select value={fromId} onChange={e => setFromId(Number(e.target.value))}
                                className={INPUT_CLS + ' font-mono flex-1'} style={INPUT_STYLE}>
                                {non_base.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                            </select>
                            <span className="text-[10px] font-mono text-app-muted-foreground">→</span>
                            <span className="text-[12px] font-mono font-black text-app-foreground">{base.code}</span>
                        </div>
                    </FieldLabel>
                </div>
                <FieldLabel label="Type">
                    <select value={rateType} onChange={e => setRateType(e.target.value as CurrencyRatePolicy['rate_type'])} className={INPUT_CLS} style={INPUT_STYLE}>
                        <option value="SPOT">SPOT</option>
                        <option value="AVERAGE">AVERAGE</option>
                        <option value="CLOSING">CLOSING</option>
                    </select>
                </FieldLabel>
                <FieldLabel label="Mode">
                    <select value={rateMode} onChange={e => setRateMode(e.target.value as 'FIXED' | 'FLOATING')}
                        className={INPUT_CLS} style={INPUT_STYLE}
                        title="FIXED = manual entry only, never auto-fetched (e.g. CFA ↔ EUR peg). FLOATING = pulled from a provider.">
                        <option value="FLOATING">Floating</option>
                        <option value="FIXED">Fixed · manual</option>
                    </select>
                </FieldLabel>
                {rateMode === 'FLOATING' && (
                    <FieldLabel label="Provider">
                        <select value={floatingProvider}
                            onChange={e => setFloatingProvider(e.target.value as Exclude<CurrencyRatePolicy['provider'], 'MANUAL'>)}
                            className={INPUT_CLS} style={INPUT_STYLE}
                            title="Which broker fetches the rate. ECB & Frankfurter are free; the rest need an API key.">
                            <option value="ECB">ECB · free</option>
                            <option value="FRANKFURTER">Frankfurter · free</option>
                            <option value="EXCHANGERATE_HOST">exchangerate.host</option>
                            <option value="FIXER">Fixer.io</option>
                            <option value="OPENEXCHANGERATES">OpenExchangeRates</option>
                        </select>
                    </FieldLabel>
                )}
                <FieldLabel label="Refresh">
                    <select value={rateMode === 'FIXED' ? 'NEVER' : syncFrequency}
                        onChange={e => setSyncFrequency(e.target.value as CurrencyRatePolicy['sync_frequency'])}
                        disabled={rateMode === 'FIXED'}
                        className={INPUT_CLS} style={INPUT_STYLE}
                        title="How often the engine refreshes a FLOATING rate. Per-transaction = pulled at posting time. Daily/Weekly/Monthly = honoured by cron.">
                        {rateMode === 'FIXED'
                            ? <option value="NEVER">Never (fixed)</option>
                            : <>
                                <option value="ON_TRANSACTION">Per transaction</option>
                                <option value="DAILY">Every day</option>
                                <option value="WEEKLY">Every week</option>
                                <option value="MONTHLY">Every month</option>
                            </>}
                    </select>
                </FieldLabel>
            </div>

            {/* ── Spread adjustment panel — both knobs grouped, with affixed
                 unit labels, presets, and a live preview line. Multiplier is
                 a structural scaling factor; Markup is an operational fee. ── */}
            <div className="rounded-xl p-3 space-y-2.5"
                style={{ background: 'color-mix(in srgb, var(--app-info) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 18%, transparent)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info)' }}>Spread Adjustment</span>
                        <span className="text-[9px] text-app-muted-foreground">— optional. Default = no spread.</span>
                    </div>
                    {/* Quick presets — common bank/operator spreads */}
                    <div className="inline-flex items-center gap-0.5">
                        {[
                            { label: 'None',   mul: '1.000000', mk: '0.0000' },
                            { label: '+ 1%',  mul: '1.000000', mk: '1.0000' },
                            { label: '+ 2.5%', mul: '1.000000', mk: '2.5000' },
                            { label: '+ 5%',  mul: '1.000000', mk: '5.0000' },
                        ].map(preset => (
                            <button key={preset.label} type="button"
                                onClick={() => { setMultiplier(preset.mul); setMarkupPct(preset.mk) }}
                                title={`Multiplier ${preset.mul} · Markup ${preset.mk}%`}
                                className="text-[9px] font-bold px-2 py-0.5 rounded-md hover:bg-app-info/10 transition-colors"
                                style={{ color: 'var(--app-info)' }}>
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Multiplier — structural factor */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-app-foreground">Multiplier</span>
                            <span className="text-[9px] text-app-muted-foreground">scaling factor</span>
                        </div>
                        <div className="flex items-stretch rounded-lg overflow-hidden border"
                            style={mulValid
                                ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                                : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
                            <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                                style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', borderRight: '1px solid var(--app-border)' }}>×</span>
                            <input value={multiplier} onChange={e => setMultiplier(e.target.value)} placeholder="1.000000"
                                inputMode="decimal"
                                title="e.g. 1.035 for a 3.5% spread above the official rate"
                                className="flex-1 px-2 py-1.5 text-[12px] font-mono tabular-nums outline-none bg-transparent text-app-foreground" />
                        </div>
                        <p className="text-[9px] text-app-muted-foreground mt-1 leading-tight">
                            Bare ratio. <code className="font-mono">1.0000</code> = no change.
                        </p>
                    </div>

                    {/* Markup — percent fee */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-app-foreground">Markup</span>
                            <span className="text-[9px] text-app-muted-foreground">percent fee</span>
                        </div>
                        <div className="flex items-stretch rounded-lg overflow-hidden border"
                            style={mkValid
                                ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                                : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
                            <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                                style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', borderRight: '1px solid var(--app-border)' }}>+</span>
                            <input value={markupPct} onChange={e => setMarkupPct(e.target.value)} placeholder="0.0000"
                                inputMode="decimal"
                                title="Applied AFTER multiplier. Range -50 to +50."
                                className="flex-1 px-2 py-1.5 text-[12px] font-mono tabular-nums outline-none bg-transparent text-app-foreground" />
                            <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                                style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', borderLeft: '1px solid var(--app-border)' }}>%</span>
                        </div>
                        <p className="text-[9px] text-app-muted-foreground mt-1 leading-tight">
                            Operational fee on top. <code className="font-mono">0.00</code> = none.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Bid / Ask spreads — when EITHER is non-zero, syncs write a
                 (MID, BID, ASK) triple per snapshot. Default 0/0 = single
                 mid-rate row, backwards-compatible. ── */}
            <div className="rounded-xl p-3 space-y-2.5"
                style={{ background: 'color-mix(in srgb, var(--app-warning) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 18%, transparent)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-warning)' }}>Bid / Ask Spread</span>
                        <span className="text-[9px] text-app-muted-foreground">— optional. Stays at 0 = mid-only.</span>
                    </div>
                    <div className="inline-flex items-center gap-0.5">
                        {[
                            { label: 'None',  bid: '0.0000', ask: '0.0000' },
                            { label: '±0.5%', bid: '0.5000', ask: '0.5000' },
                            { label: '±1%',   bid: '1.0000', ask: '1.0000' },
                            { label: '±2%',   bid: '2.0000', ask: '2.0000' },
                        ].map(p => (
                            <button key={p.label} type="button"
                                onClick={() => { setBidSpreadPct(p.bid); setAskSpreadPct(p.ask) }}
                                className="text-[9px] font-bold px-2 py-0.5 rounded-md hover:bg-app-warning/10 transition-colors"
                                style={{ color: 'var(--app-warning)' }}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-app-foreground">Bid spread</span>
                            <span className="text-[9px] text-app-muted-foreground">below mid · operator buys</span>
                        </div>
                        <div className="flex items-stretch rounded-lg overflow-hidden border"
                            style={bidValid
                                ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                                : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
                            <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                                style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', borderRight: '1px solid var(--app-border)' }}>−</span>
                            <input value={bidSpreadPct} onChange={e => setBidSpreadPct(e.target.value)} placeholder="0.0000"
                                inputMode="decimal"
                                title="BID = mid × (1 − bid_spread/100). 0–50."
                                className="flex-1 px-2 py-1.5 text-[12px] font-mono tabular-nums outline-none bg-transparent text-app-foreground" />
                            <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                                style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', borderLeft: '1px solid var(--app-border)' }}>%</span>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-app-foreground">Ask spread</span>
                            <span className="text-[9px] text-app-muted-foreground">above mid · operator sells</span>
                        </div>
                        <div className="flex items-stretch rounded-lg overflow-hidden border"
                            style={askValid
                                ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                                : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
                            <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                                style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', borderRight: '1px solid var(--app-border)' }}>+</span>
                            <input value={askSpreadPct} onChange={e => setAskSpreadPct(e.target.value)} placeholder="0.0000"
                                inputMode="decimal"
                                title="ASK = mid × (1 + ask_spread/100). 0–50."
                                className="flex-1 px-2 py-1.5 text-[12px] font-mono tabular-nums outline-none bg-transparent text-app-foreground" />
                            <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                                style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', borderLeft: '1px solid var(--app-border)' }}>%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── API key (paid providers only) ── */}
            {needsKey && (
                <div className="rounded-xl p-3"
                    style={{ background: 'color-mix(in srgb, var(--app-error) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 18%, transparent)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-error)' }}>API Key required</span>
                        <span className="text-[9px] text-app-muted-foreground">stored in <code className="font-mono">provider_config</code></span>
                    </div>
                    <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                        type="password" autoComplete="off"
                        placeholder={
                            provider === 'FIXER' ? 'Fixer access_key (data.fixer.io)'
                            : provider === 'OPENEXCHANGERATES' ? 'OpenExchangeRates app_id'
                            : 'exchangerate.host access_key'
                        }
                        className="w-full px-3 py-1.5 text-[12px] rounded-lg outline-none focus:ring-2"
                        style={{
                            background: 'var(--app-background)',
                            border: keyValid ? '1px solid var(--app-border)' : '1px solid color-mix(in srgb, var(--app-error) 50%, transparent)',
                            color: 'var(--app-foreground)',
                        }} />
                </div>
            )}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                    {isDup && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>
                            <AlertTriangle size={10} /> A {rateType} policy already exists for this pair
                        </span>
                    )}
                    {!mulValid && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>
                            <AlertTriangle size={10} /> Multiplier must be a positive number
                        </span>
                    )}
                    {mulValid && !mkValid && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>
                            <AlertTriangle size={10} /> Markup must be between -50 and +50
                        </span>
                    )}
                </div>
                {previewAdjusted && valid && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-md"
                        style={{ ...soft('--app-info', 8), color: 'var(--app-info)' }}
                        title={`If today's raw rate were 1.000000, this policy would store ${previewAdjusted}`}>
                        <TrendingUp size={10} /> Preview: 1.000000 × {Number(multiplier).toFixed(6)} × (1 + {Number(markupPct).toFixed(4)}%) = <strong className="font-black">{previewAdjusted}</strong>
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-app-border/30">
                <label className="flex items-center gap-2 text-[10px] font-bold cursor-pointer text-app-foreground"
                    title={rateMode === 'FIXED'
                        ? 'FIXED rates never auto-sync — toggle has no effect'
                        : syncFrequency === 'ON_TRANSACTION'
                            ? 'Per-transaction policies sync just-in-time, not via cron — toggle has no effect'
                            : `Cron will refresh this rate ${syncFrequency.toLowerCase()}`}>
                    <input type="checkbox"
                        checked={autoSync && rateMode === 'FLOATING' && syncFrequency !== 'ON_TRANSACTION'}
                        disabled={rateMode === 'FIXED' || syncFrequency === 'ON_TRANSACTION'}
                        onChange={e => setAutoSync(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-app-info" />
                    Run on cron (auto-sync)
                </label>
                <div className="flex items-center gap-2">
                    <button onClick={onCancel} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border/50 hover:bg-app-background transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button disabled={busy || !valid} onClick={async () => {
                        setBusy(true)
                        try {
                            // Each broker reads a different config key. Set all
                            // three so the policy works regardless.
                            const provider_config: Record<string, any> = {}
                            const k = apiKey.trim()
                            if (k) {
                                provider_config.access_key = k
                                provider_config.api_key = k
                                provider_config.app_id = k
                            }
                            await onSubmit({
                                from_currency: fromId!, to_currency: base.id, rate_type: rateType,
                                provider,
                                auto_sync: autoSync && provider !== 'MANUAL' && syncFrequency !== 'ON_TRANSACTION',
                                sync_frequency: rateMode === 'FIXED' ? 'DAILY' : syncFrequency,
                                multiplier, markup_pct: markupPct,
                                bid_spread_pct: bidSpreadPct, ask_spread_pct: askSpreadPct,
                                ...(Object.keys(provider_config).length ? { provider_config } : {}),
                            })
                        } finally { setBusy(false) }
                    }}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                        style={!busy && valid
                            ? { ...grad('--app-info'), color: 'var(--app-primary-foreground, white)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-info) 30%, transparent)' }
                            : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                        {busy ? 'Creating…' : 'Create Policy'}
                    </button>
                </div>
            </div>
        </div>
    )
}
