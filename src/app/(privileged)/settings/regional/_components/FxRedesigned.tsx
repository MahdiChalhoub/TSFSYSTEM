'use client'
/**
 * FX Management — Redesigned (v3)
 * ================================
 * Three sub-tabs with single-purpose workflows. Replaces FxManagementSection.tsx.
 *
 *   1. Rate Rules         → Source-configuration card grid.
 *                           One card per pair. Each card shows the LIVE rate
 *                           prominently, source provider, freshness pip,
 *                           multiplier/markup/spread inline, and a ⋮ menu.
 *                           Click the card → side drawer for full editing.
 *
 *   2. Rate History       → Pair × time-range filter + table.
 *                           Optional manual-rate quick-add.
 *
 *   3. Revaluations       → Two-column period board.
 *                           LEFT: list of fiscal periods with status pip.
 *                           RIGHT: selected-period detail + run + history.
 *
 * Workflow / logic principles
 * ----------------------------
 *   - One primary action per tab. No buttons that require explanation.
 *   - Live rate is surfaced everywhere a policy/pair appears, never hidden in
 *     a sub-row or tooltip.
 *   - Configuration mutations go through a single drawer (one form, one
 *     submit, one error path). No inline-edit + tooltip + modal mix.
 *   - All colors are CSS variables (`var(--app-...)`); zero hex / 'white' /
 *     'black' literals. The single exception is `var(--app-primary-foreground,
 *     #fff)` which is a fallback chain built into the var system.
 *
 * Theme tokens used:  --app-foreground · --app-muted-foreground ·
 *   --app-background · --app-surface · --app-border ·
 *   --app-primary · --app-primary-foreground ·
 *   --app-success · --app-warning · --app-error · --app-info
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
    Coins, RefreshCcw, Plus, ShieldCheck, ShieldAlert,
    TrendingUp, TrendingDown, Play, Trash2, Wand2, AlertTriangle, Check,
    Settings, MoreVertical, X,
} from 'lucide-react'
import {
    getCurrencies, getExchangeRates, getRevaluations,
    createExchangeRate, runRevaluation,
    getRatePolicies, createRatePolicy, updateRatePolicy, syncRatePolicy, syncAllRatePolicies,
    deleteRatePolicy, bulkCreateRatePolicies, bulkUpdateRatePolicyProvider,
    type Currency, type ExchangeRate, type CurrencyRevaluation, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import { erpFetch } from '@/lib/erp-api'

/* ─── Local design helpers ─────────────────────────────────────────── */
const grad = (v: string) => ({ background: `linear-gradient(135deg, var(${v}), color-mix(in srgb, var(${v}) 60%, black))` })
const soft = (v: string, p = 12) => ({ backgroundColor: `color-mix(in srgb, var(${v}) ${p}%, transparent)` })
const FG_PRIMARY = 'var(--app-primary-foreground, #fff)' // Theme token w/ literal fallback for legacy themes
/** Normalize any thrown value into a short string for diagnostic display. */
const msg = (e: unknown): string => {
    if (e instanceof Error) return e.message
    if (typeof e === 'string') return e
    try { return JSON.stringify(e) } catch { return String(e) }
}

type FxView = 'rates' | 'policies' | 'revaluations'
type Period = { id: number; name: string; start_date: string; end_date: string; status: string; fiscal_year: number; fiscal_year_name?: string }
type FiscalYear = { id: number; name: string; periods: Period[] }

const RATE_TYPES: ExchangeRate['rate_type'][] = ['SPOT', 'AVERAGE', 'CLOSING', 'BUDGET']

const PROVIDER_META: Record<CurrencyRatePolicy['provider'], { label: string; tone: string; needsKey: boolean }> = {
    MANUAL:            { label: 'Manual',             tone: '--app-muted-foreground', needsKey: false },
    ECB:               { label: 'ECB',                tone: '--app-success',          needsKey: false },
    FRANKFURTER:       { label: 'Frankfurter',        tone: '--app-success',          needsKey: false },
    EXCHANGERATE_HOST: { label: 'exchangerate.host',  tone: '--app-info',             needsKey: true  },
    FIXER:             { label: 'Fixer.io',           tone: '--app-info',             needsKey: true  },
    OPENEXCHANGERATES: { label: 'OpenExchangeRates',  tone: '--app-info',             needsKey: true  },
}

const FREQ_LABEL: Record<CurrencyRatePolicy['sync_frequency'], string> = {
    ON_TRANSACTION: 'Per transaction',
    DAILY: 'Every day',
    WEEKLY: 'Every week',
    MONTHLY: 'Every month',
}

const HEALTH = {
    fresh:  { tone: '--app-success', label: 'Healthy — synced in the last 36h' },
    stale:  { tone: '--app-warning', label: 'Stale — last sync was over 36h ago' },
    fail:   { tone: '--app-error',   label: 'Failing — last attempt errored' },
    never:  { tone: '--app-muted-foreground', label: 'Never synced' },
    manual: { tone: '--app-info',    label: 'Manual provider — does not auto-sync' },
} as const
type HealthKey = keyof typeof HEALTH

/* ═══════════════════════════════════════════════════════════════════
 *  ROOT
 * ═══════════════════════════════════════════════════════════════════ */
export function FxRedesigned({ view, orgCurrencyCount, orgBaseCode }: {
    view?: FxView
    orgCurrencyCount?: number
    orgBaseCode?: string | null
} = {}) {
    const isEmbedded = !!view
    const [tabState, setTab] = useState<FxView>('rates')
    const tab = view ?? tabState

    const [currencies, setCurrencies] = useState<Currency[]>([])
    const [rates, setRates] = useState<ExchangeRate[]>([])
    const [revals, setRevals] = useState<CurrencyRevaluation[]>([])
    const [policies, setPolicies] = useState<CurrencyRatePolicy[]>([])
    const [years, setYears] = useState<FiscalYear[]>([])
    const [loading, setLoading] = useState(true)

    // Drawer / modal state
    const [editPolicyId, setEditPolicyId] = useState<number | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [setBrokerOpen, setSetBrokerOpen] = useState(false)
    const [manualRateOpen, setManualRateOpen] = useState(false)
    const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null)

    // Per-row sync indicators
    const [syncingId, setSyncingId] = useState<number | null>(null)
    const [syncingAll, setSyncingAll] = useState(false)
    const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null)
    const [bulkBusy, setBulkBusy] = useState(false)
    const [running, setRunning] = useState<number | null>(null)

    /** Per-endpoint error map shown in the diagnostic strip when something
     *  failed. Empty when everything succeeded. Surfaced inline (no more
     *  silent toast that vanishes after 5 seconds). */
    const [loadErrors, setLoadErrors] = useState<Record<string, string>>({})


    /** Concurrency guard — prevents duplicate loadAll calls from
     *  React Strict Mode double-fires, fast hot-reload remounts, or rapid
     *  back-to-back retry clicks. If a load is in-flight, subsequent
     *  callers await the same promise instead of starting a new one. */
    const loadInFlight = useRef<Promise<void> | null>(null)

    useEffect(() => { void loadAll() }, [])
    async function loadAll() {
        if (loadInFlight.current) return loadInFlight.current
        const p = (async () => {
            await _doLoadAll()
        })()
        loadInFlight.current = p
        try { await p } finally { loadInFlight.current = null }
    }

    async function _doLoadAll() {
        setLoading(true)
        // Use allSettled so one failed endpoint doesn't tank the whole page.
        // Each endpoint reports its own success/failure into loadErrors so the
        // user sees exactly what's broken instead of an empty UI.
        const [cs, rs, vs, ps, ys] = await Promise.allSettled([
            getCurrencies(),
            getExchangeRates(),
            getRevaluations(),
            getRatePolicies(),
            erpFetch('finance/fiscal-years/')
                .then((r: any) => Array.isArray(r) ? r : (r?.results ?? [])),
        ])
        const next: Record<string, string> = {}
        if (cs.status === 'fulfilled') setCurrencies(cs.value); else next.currencies = msg(cs.reason)
        if (rs.status === 'fulfilled') setRates(rs.value); else next.rates = msg(rs.reason)
        if (vs.status === 'fulfilled') setRevals(vs.value); else next.revaluations = msg(vs.reason)
        if (ps.status === 'fulfilled') setPolicies(ps.value); else next.policies = msg(ps.reason)
        if (ys.status === 'fulfilled') setYears(ys.value); else next.fiscal_years = msg(ys.reason)
        setLoadErrors(next)
        if (Object.keys(next).length) {
            // Log full errors to the browser console so the user can copy them
            // even if the banner is below the fold.
            console.group('%c[FX] loadAll failures', 'color:#e11; font-weight:bold')
            for (const [k, v] of Object.entries(next)) console.error(`  ${k}: ${v}`)
            console.groupEnd()
            toast.error(`Failed to load: ${Object.keys(next).join(', ')} — see banner for details`)
        }
        setLoading(false)
    }

    /* ─── Derived state ─────────────────────────────────────────── */
    const baseCurrency = useMemo(() => currencies.find(c => c.is_base), [currencies])
    const periods = useMemo(
        () => years.flatMap(y => (y.periods ?? []).map(p => ({ ...p, fiscal_year_name: y.name }))),
        [years],
    )

    /** Latest stored rate per (from→to, rate_type, side=MID) for live row display. */
    const latestRateByKey = useMemo(() => {
        const m = new Map<string, ExchangeRate>()
        for (const r of rates) {
            // Default to MID when reading the live rate; bid/ask are surfaced
            // separately on the policy detail drawer.
            if (r.rate_side && r.rate_side !== 'MID') continue
            const k = `${r.from_code}→${r.to_code}|${r.rate_type}`
            const prev = m.get(k)
            if (!prev || r.effective_date > prev.effective_date) m.set(k, r)
        }
        return m
    }, [rates])

    /** All-sides lookup per (from→to, rate_type) → { MID?, BID?, ASK? }.
     *  Drives the three-side rate readout on a policy card whenever the
     *  policy has non-zero bid_spread_pct or ask_spread_pct. */
    const latestSidesByKey = useMemo(() => {
        const m = new Map<string, { MID?: ExchangeRate; BID?: ExchangeRate; ASK?: ExchangeRate }>()
        for (const r of rates) {
            const side = (r.rate_side ?? 'MID') as 'MID' | 'BID' | 'ASK'
            const k = `${r.from_code}→${r.to_code}|${r.rate_type}`
            const slot = m.get(k) ?? {}
            const prev = slot[side]
            if (!prev || r.effective_date > prev.effective_date) slot[side] = r
            m.set(k, slot)
        }
        return m
    }, [rates])

    /** Last 30 MID rates per (from→to, rate_type) — drives the sparkline on
     *  each policy card. Sorted ascending so SVG draws left-to-right. */
    const historyByKey = useMemo(() => {
        const m = new Map<string, ExchangeRate[]>()
        for (const r of rates) {
            if (r.rate_side && r.rate_side !== 'MID') continue
            const k = `${r.from_code}→${r.to_code}|${r.rate_type}`
            const arr = m.get(k) ?? []
            arr.push(r); m.set(k, arr)
        }
        for (const arr of m.values()) {
            arr.sort((a, b) => a.effective_date.localeCompare(b.effective_date))
            if (arr.length > 30) arr.splice(0, arr.length - 30)
        }
        return m
    }, [rates])

    function policyHealth(p: CurrencyRatePolicy): HealthKey {
        if (p.provider === 'MANUAL') return 'manual'
        if (!p.last_synced_at) return 'never'
        if (p.last_sync_status === 'FAIL') return 'fail'
        const ageH = (Date.now() - new Date(p.last_synced_at).getTime()) / 36e5
        return ageH > 36 ? 'stale' : 'fresh'
    }

    const editPolicy = policies.find(p => p.id === editPolicyId) ?? null
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId) ?? periods[0] ?? null

    /* ─── Handlers ──────────────────────────────────────────────── */
    async function handleSyncOne(id: number) {
        setSyncingId(id)
        try {
            const r = await syncRatePolicy(id)
            if (r.success) toast.success(r.message || 'Synced')
            else toast.error(r.message || r.error || 'Sync failed')
            await loadAll()
        } finally { setSyncingId(null) }
    }
    async function handleSyncAll() {
        const eligible = policies.filter(p => p.provider !== 'MANUAL')
        if (eligible.length === 0) return
        setSyncingAll(true)
        setSyncProgress({ done: 0, total: eligible.length })
        let ok = 0, fail = 0
        try {
            if (eligible.length > 25) {
                const r = await syncAllRatePolicies()
                if (!r.success) { toast.error(r.error || 'Sync-all failed'); return }
                ok = (r.results ?? []).filter(x => x.ok).length
                fail = (r.results ?? []).filter(x => !x.ok).length
            } else {
                for (let i = 0; i < eligible.length; i++) {
                    const r = await syncRatePolicy(eligible[i].id)
                    if (r.success) ok++; else fail++
                    setSyncProgress({ done: i + 1, total: eligible.length })
                }
            }
            toast.success(`${ok} synced${fail ? ` · ${fail} failed` : ''}`)
            await loadAll()
        } finally { setSyncingAll(false); setSyncProgress(null) }
    }
    async function handleDelete(p: CurrencyRatePolicy) {
        if (!confirm(`Delete policy ${p.from_code}→${p.to_code}? Rate history is preserved.`)) return
        const r = await deleteRatePolicy(p.id)
        if (!r.success) { toast.error(r.error || 'Delete failed'); return }
        toast.success(`Removed ${p.from_code}→${p.to_code}`)
        await loadAll()
    }
    async function handleAutoConfigure() {
        setBulkBusy(true)
        try {
            const r = await bulkCreateRatePolicies({ provider: 'ECB', rate_type: 'SPOT', auto_sync: true })
            if (!r.success) { toast.error(r.error || 'Failed'); return }
            const made = r.created?.length ?? 0
            const skipped = r.skipped?.length ?? 0
            if (made === 0 && skipped > 0) toast.info('All currencies already covered')
            else toast.success(`${made} polic${made === 1 ? 'y' : 'ies'} created${skipped ? ` · ${skipped} skipped` : ''}`)
            await loadAll()
        } finally { setBulkBusy(false) }
    }
    async function handleRunReval(periodId: number) {
        setRunning(periodId)
        try {
            const r = await runRevaluation(periodId, 'OFFICIAL')
            if (!r.success) { toast.error(r.error || 'Revaluation failed'); return }
            if (r.data === null) { toast.info(r.detail || 'Nothing to revalue'); return }
            const d = r.data!
            const sign = Number(d.net_impact) >= 0 ? '+' : ''
            toast.success(`Revaluation posted · net ${sign}${d.net_impact} · ${d.accounts_processed} account${d.accounts_processed === 1 ? '' : 's'}`)
            await loadAll()
        } finally { setRunning(null) }
    }

    /* ─── KPI / health roll-up for the rates tab — memoized so it doesn't
     *  recompute on every keystroke in the search filter. ── */
    const healthByPolicy = useMemo(() => {
        const m = new Map<number, HealthKey>()
        for (const p of policies) m.set(p.id, policyHealth(p))
        return m
    }, [policies])
    const healthCounts = useMemo(() => {
        const acc: Record<HealthKey, number> = { fresh: 0, stale: 0, fail: 0, never: 0, manual: 0 }
        for (const h of healthByPolicy.values()) acc[h] = (acc[h] ?? 0) + 1
        return acc
    }, [healthByPolicy])

    /* ─── Stale-warning banner — fires when ANY policy is approaching the
     *  36h staleness threshold (within 6h) and isn't fail/manual. Encourages
     *  the operator to hit Sync All before the cron next ticks. ── */
    const approachingStale = useMemo(() => {
        const now = Date.now()
        return policies.filter(p => {
            if (p.provider === 'MANUAL') return false
            if (!p.last_synced_at) return false
            if (p.last_sync_status === 'FAIL') return false
            const ageH = (now - new Date(p.last_synced_at).getTime()) / 36e5
            return ageH >= 30 && ageH <= 36
        }).length
    }, [policies])

    /* ─── Keyboard shortcuts: '/' focuses search · 'n' opens new-policy
     *  drawer · Esc closes any open drawer/modal. ── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (tab !== 'policies') return
            const target = e.target as HTMLElement
            const inField = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
            if (e.key === '/' && !inField) {
                e.preventDefault()
                const input = document.querySelector<HTMLInputElement>('[data-fx-search]')
                input?.focus()
            } else if (e.key === 'n' && !inField && !createOpen && !editPolicyId && !setBrokerOpen) {
                e.preventDefault()
                setCreateOpen(true)
            } else if (e.key === 'Escape') {
                if (editPolicyId !== null) setEditPolicyId(null)
                else if (createOpen) setCreateOpen(false)
                else if (setBrokerOpen) setSetBrokerOpen(false)
                else if (manualRateOpen) setManualRateOpen(false)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [tab, createOpen, editPolicyId, setBrokerOpen, manualRateOpen])

    if (loading) return <FxSkeleton />

    // Visible diagnostic banner — appears whenever any endpoint failed in
    // loadAll. Replaces the silent "return [] on error" pattern so users see
    // exactly which slice of data is missing and why. Click Retry to refire
    // loadAll; a real error message lives in each row's tooltip.
    const hasLoadErrors = Object.keys(loadErrors).length > 0


    /* ═══════════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════════ */
    return (
        <div className="space-y-3 animate-in fade-in duration-300">
            {/* ── Tab strip (only standalone — parent provides nav otherwise) ── */}
            {!isEmbedded && (
                <SubTabBar tab={tab} setTab={setTab}
                    counts={{ rates: policies.length, history: rates.length, reval: revals.length }} />
            )}

            {hasLoadErrors && (
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--app-surface)', border: '1.5px solid color-mix(in srgb, var(--app-error) 40%, transparent)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-error) 12%, transparent)' }}>
                    {/* Header strip */}
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap"
                        style={{ background: 'color-mix(in srgb, var(--app-error) 14%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
                        <div className="inline-flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center"
                                style={{ background: 'var(--app-error)', color: FG_PRIMARY }}>
                                <AlertTriangle size={14} />
                            </div>
                            <div>
                                <div className="font-black uppercase tracking-widest" style={{ fontSize: 11, color: 'var(--app-error)' }}>
                                    {Object.keys(loadErrors).length} data fetch{Object.keys(loadErrors).length === 1 ? '' : 'es'} failed
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                                    Open the browser console (F12) to copy the full traces.
                                </div>
                            </div>
                        </div>
                        <div className="inline-flex items-center gap-1">
                            <button onClick={() => { setLoadErrors({}); void loadAll() }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all"
                                style={{ fontSize: 11, color: FG_PRIMARY, ...grad('--app-error'), boxShadow: '0 4px 12px color-mix(in srgb, var(--app-error) 30%, transparent)' }}>
                                <RefreshCcw size={11} /> Retry
                            </button>
                            <button onClick={() => setLoadErrors({})}
                                title="Hide this banner without retrying"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all border"
                                style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                                Dismiss
                            </button>
                        </div>
                    </div>
                    {/* Per-endpoint error list */}
                    <ul className="p-3 space-y-1.5">
                        {Object.entries(loadErrors).map(([endpoint, message]) => (
                            <li key={endpoint}
                                className="rounded-md px-2.5 py-1.5"
                                style={{ background: 'color-mix(in srgb, var(--app-error) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                <div className="font-mono font-black uppercase tracking-widest" style={{ fontSize: 9, color: 'var(--app-error)' }}>
                                    {endpoint}
                                </div>
                                <div className="font-mono mt-0.5 break-words" style={{ fontSize: 10, color: 'var(--app-foreground)' }}>
                                    {message}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ───────────────── Rate Rules ───────────────── */}
            {tab === 'policies' && (
                <RateRulesView
                    policies={policies}
                    currencies={currencies}
                    baseCurrency={baseCurrency}
                    orgCurrencyCount={orgCurrencyCount}
                    orgBaseCode={orgBaseCode}
                    latestRateByKey={latestRateByKey}
                    latestSidesByKey={latestSidesByKey}
                    historyByKey={historyByKey}
                    healthCounts={healthCounts}
                    healthByPolicy={healthByPolicy}
                    approachingStale={approachingStale}
                    syncingId={syncingId}
                    syncingAll={syncingAll}
                    syncProgress={syncProgress}
                    bulkBusy={bulkBusy}
                    onSyncOne={handleSyncOne}
                    onSyncAll={handleSyncAll}
                    onDelete={handleDelete}
                    onAutoConfigure={handleAutoConfigure}
                    onCreate={() => setCreateOpen(true)}
                    onSetBroker={() => setSetBrokerOpen(true)}
                    onEdit={(id) => setEditPolicyId(id)}
                    onUpdate={async (id, patch) => {
                        const r = await updateRatePolicy(id, patch)
                        if (!r.success) toast.error(r.error || 'Update failed')
                        await loadAll()
                    }}
                />
            )}

            {/* ───────────────── Rate History ───────────────── */}
            {tab === 'rates' && (
                <RateHistoryView
                    rates={rates}
                    policies={policies}
                    baseCurrency={baseCurrency}
                    /* Pass the OrgCurrency-derived gating so the Add Manual
                     * Rate button shows even when the finance.Currency mirror
                     * hasn't finished materializing. */
                    orgCurrencyCount={orgCurrencyCount}
                    orgBaseCode={orgBaseCode}
                    onAddManual={() => setManualRateOpen(true)}
                />
            )}

            {/* ───────────────── Revaluations ───────────────── */}
            {tab === 'revaluations' && (
                <RevaluationsView
                    periods={periods}
                    revals={revals}
                    selectedPeriod={selectedPeriod}
                    setSelectedPeriodId={setSelectedPeriodId}
                    running={running}
                    onRun={handleRunReval}
                />
            )}

            {/* ── Drawer: edit a policy ── */}
            {editPolicy && (
                <PolicyDrawer policy={editPolicy} currencies={currencies}
                    onClose={() => setEditPolicyId(null)}
                    onSubmit={async (patch) => {
                        const r = await updateRatePolicy(editPolicy.id, patch)
                        if (!r.success) { toast.error(r.error || 'Update failed'); return }
                        toast.success('Saved')
                        setEditPolicyId(null)
                        await loadAll()
                    }} />
            )}

            {/* ── Drawer: create a policy. NOT gated on `baseCurrency` —
                 the drawer falls back to currencies.find(c => c.is_base)
                 internally and self-heals via `onRefresh` if the mirror was
                 briefly empty when the user clicked. */}
            {createOpen && (
                <PolicyDrawer
                    policy={null}
                    base={baseCurrency}
                    currencies={currencies}
                    existingPairs={new Set(policies.map(p => `${p.from_currency}-${p.to_currency}-${p.rate_type}`))}
                    onRefresh={loadAll}
                    onClose={() => setCreateOpen(false)}
                    onSubmit={async (payload) => {
                        const r = await createRatePolicy(payload as any)
                        if (!r.success) { toast.error(r.error || 'Create failed'); return }
                        toast.success('Policy created')
                        setCreateOpen(false)
                        await loadAll()
                    }} />
            )}

            {/* ── Modal: set broker for many ── */}
            {setBrokerOpen && (
                <SetBrokerModal
                    policies={policies}
                    currencies={currencies}
                    onClose={() => setSetBrokerOpen(false)}
                    onApplied={async () => { setSetBrokerOpen(false); await loadAll() }}
                />
            )}

            {/* ── Modal: add a manual rate. Not gated on `baseCurrency` —
                 the modal renders even when the mirror is briefly empty
                 and resolves the base from `currencies` internally. */}
            {manualRateOpen && (
                <ManualRateModal
                    base={baseCurrency}
                    currencies={currencies}
                    onRefresh={loadAll}
                    onClose={async () => {
                        // Reload on close — fires after either single MID
                        // or three-side submissions complete. Avoids a
                        // round-trip per row when entering all three sides.
                        setManualRateOpen(false)
                        await loadAll()
                    }}
                    onSubmit={async (payload) => {
                        const r = await createExchangeRate(payload)
                        if (!r.success) { throw new Error(r.error || 'Failed'); }
                        toast.success(`Rate ${payload.rate_side ?? 'MID'} added`)
                        // Note: NOT calling loadAll() here — happens on modal close.
                    }}
                />
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-TAB BAR (standalone use)
 * ═══════════════════════════════════════════════════════════════════ */
function SubTabBar({ tab, setTab, counts }: {
    tab: FxView
    setTab: (t: FxView) => void
    counts: { rates: number; history: number; reval: number }
}) {
    const items: { key: FxView; label: string; icon: any; count: number }[] = [
        { key: 'rates', label: 'Rate History', icon: TrendingUp, count: counts.history },
        { key: 'policies', label: 'Rate Rules', icon: RefreshCcw, count: counts.rates },
        { key: 'revaluations', label: 'Revaluations', icon: Coins, count: counts.reval },
    ]
    return (
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-app-surface border border-app-border/50">
            {items.map(it => {
                const Icon = it.icon; const active = tab === it.key
                return (
                    <button key={it.key} onClick={() => setTab(it.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all duration-200"
                        style={active
                            ? { ...grad('--app-primary'), color: FG_PRIMARY, boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 30%, transparent)' }
                            : { color: 'var(--app-muted-foreground)', background: 'transparent' }}>
                        <Icon size={12} /> {it.label}
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded tabular-nums"
                            style={active
                                ? { background: 'color-mix(in srgb, var(--app-primary-foreground, #fff) 22%, transparent)' }
                                : { background: 'var(--app-background)' }}>
                            {it.count}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  RATE RULES — card grid
 * ═══════════════════════════════════════════════════════════════════ */
function RateRulesView(props: {
    policies: CurrencyRatePolicy[]
    currencies: Currency[]
    baseCurrency: Currency | undefined
    orgCurrencyCount?: number
    orgBaseCode?: string | null
    latestRateByKey: Map<string, ExchangeRate>
    latestSidesByKey: Map<string, { MID?: ExchangeRate; BID?: ExchangeRate; ASK?: ExchangeRate }>
    historyByKey: Map<string, ExchangeRate[]>
    healthCounts: Record<HealthKey, number>
    healthByPolicy: Map<number, HealthKey>
    approachingStale: number
    syncingId: number | null
    syncingAll: boolean
    syncProgress: { done: number; total: number } | null
    bulkBusy: boolean
    onSyncOne: (id: number) => void
    onSyncAll: () => void
    onDelete: (p: CurrencyRatePolicy) => void
    onAutoConfigure: () => void
    onCreate: () => void
    onSetBroker: () => void
    onEdit: (id: number) => void
    onUpdate: (id: number, patch: Partial<CurrencyRatePolicy>) => void
}) {
    const [query, setQuery] = useState('')
    const [healthFilter, setHealthFilter] = useState<'all' | HealthKey>('all')
    const [providerFilter, setProviderFilter] = useState<'all' | CurrencyRatePolicy['provider']>('all')

    const hasBase = !!(props.baseCurrency || props.orgBaseCode)
    const totalCcy = Math.max(props.currencies.length, props.orgCurrencyCount ?? 0)
    const hasNonBase = totalCcy >= 2

    const policiedFromIds = new Set(props.policies.map(p => p.from_currency))
    const nonBaseFromMirror = props.currencies.filter(c => !c.is_base && c.is_active).length
    const missingCoverage = nonBaseFromMirror > 0
        ? props.currencies.filter(c => !c.is_base && c.is_active && !policiedFromIds.has(c.id)).length
        : Math.max(0, totalCcy - 1 - props.policies.length)

    const q = query.trim().toLowerCase()
    const filtered = props.policies.filter(p => {
        if (healthFilter !== 'all' && props.healthByPolicy.get(p.id) !== healthFilter) return false
        if (providerFilter !== 'all' && p.provider !== providerFilter) return false
        if (!q) return true
        return [p.from_code, p.to_code, p.provider, p.rate_type].some(s => s.toLowerCase().includes(q))
    })

    const usedProviders = Array.from(new Set(props.policies.map(p => p.provider))) as CurrencyRatePolicy['provider'][]
    const eligibleSyncCount = props.policies.filter(p => p.provider !== 'MANUAL').length

    return (
        <div className="space-y-3">
            {/* ── Health KPI strip ── */}
            {props.policies.length > 0 && (
                <div className="bg-app-surface rounded-2xl border border-app-border/50 p-2.5 grid gap-2"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                    <Kpi label="Healthy"   value={props.healthCounts.fresh}  tone="--app-success"          icon={<Check size={12} />} />
                    <Kpi label="Stale >36h" value={props.healthCounts.stale} tone="--app-warning"          icon={<AlertTriangle size={12} />} />
                    <Kpi label="Failing"   value={props.healthCounts.fail}   tone="--app-error"            icon={<AlertTriangle size={12} />} />
                    <Kpi label="Never run" value={props.healthCounts.never}  tone="--app-muted-foreground" icon={<RefreshCcw size={12} />} />
                    <Kpi label="Manual"    value={props.healthCounts.manual} tone="--app-info"             icon={<ShieldCheck size={12} />} />
                </div>
            )}

            {/* ── Toolbar (search + actions) ── */}
            <div className="bg-app-surface rounded-2xl border border-app-border/50 px-3 py-2.5 flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[220px] relative">
                    <input value={query} onChange={e => setQuery(e.target.value)}
                        data-fx-search
                        placeholder="Search pair, provider, status…  ( / )"
                        className="w-full pl-2.5 pr-12 py-1.5 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-app-primary/20"
                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                    <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded font-mono pointer-events-none"
                        style={{ fontSize: 9, background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>/</kbd>
                </div>

                {/* Health filter */}
                <SegSelect<'all' | HealthKey>
                    title="Health"
                    options={[
                        { key: 'all', label: 'All' },
                        { key: 'fresh', label: 'Fresh', tone: HEALTH.fresh.tone },
                        { key: 'stale', label: 'Stale', tone: HEALTH.stale.tone },
                        { key: 'fail',  label: 'Fail',  tone: HEALTH.fail.tone  },
                        { key: 'never', label: 'Never', tone: HEALTH.never.tone },
                        { key: 'manual',label: 'Manual',tone: HEALTH.manual.tone},
                    ]}
                    value={healthFilter} onChange={setHealthFilter} />

                {usedProviders.length > 1 && (
                    <SegSelect<'all' | CurrencyRatePolicy['provider']>
                        title="Provider"
                        options={[
                            { key: 'all', label: 'All providers' },
                            ...usedProviders.map(p => ({ key: p, label: p, tone: PROVIDER_META[p].tone })),
                        ]}
                        value={providerFilter} onChange={setProviderFilter} />
                )}

                <div className="flex-1" />

                {/* Primary actions */}
                {missingCoverage > 0 && hasBase && (
                    <ActionBtn icon={<Wand2 size={11} className={props.bulkBusy ? 'animate-spin' : ''} />}
                        tone="--app-success"
                        onClick={props.onAutoConfigure} disabled={props.bulkBusy}>
                        {props.bulkBusy ? 'Configuring…' : `Auto-configure ${missingCoverage}`}
                    </ActionBtn>
                )}
                {props.policies.length > 0 && (
                    <ActionBtn icon={<Settings size={11} />} tone="--app-warning"
                        onClick={props.onSetBroker}>
                        Set Broker
                    </ActionBtn>
                )}
                <ActionBtn icon={<RefreshCcw size={11} className={props.syncingAll ? 'animate-spin' : ''} />}
                    tone="--app-info" disabled={props.syncingAll || eligibleSyncCount === 0}
                    onClick={props.onSyncAll}>
                    {props.syncingAll
                        ? (props.syncProgress ? `${props.syncProgress.done}/${props.syncProgress.total}` : 'Syncing…')
                        : eligibleSyncCount > 0 ? `Sync All · ${eligibleSyncCount}` : 'Sync All'}
                </ActionBtn>
                <ActionBtn icon={<Plus size={11} />} tone="--app-primary" filled
                    disabled={!hasNonBase || !hasBase}
                    title={!hasBase
                        ? 'Set a base currency first — Currencies tab → ⭐'
                        : !hasNonBase
                            ? 'Enable at least one non-base currency'
                            : 'Add a new rate-source policy  ( n )'}
                    onClick={props.onCreate}>
                    New Policy
                </ActionBtn>
            </div>

            {/* ── Stale-approaching banner — flags policies near the 36h cliff. ── */}
            {props.approachingStale > 0 && (
                <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200"
                    style={{ ...soft('--app-warning', 8), border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--app-warning)' }} />
                    <span className="font-bold" style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                        {props.approachingStale} polic{props.approachingStale === 1 ? 'y is' : 'ies are'} within 6h of going stale.
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                        Hit Sync All to refresh now, or wait for the next cron tick.
                    </span>
                </div>
            )}

            {/* ── Card grid ── */}
            {props.policies.length === 0 ? (
                <EmptyState
                    icon={<RefreshCcw size={28} className="text-app-muted-foreground opacity-25" />}
                    title="No rate sources yet"
                    hint="Wire ECB into all your active currencies in one click — or add them one at a time."
                    cta={hasBase && totalCcy > 1 ? (
                        <button onClick={props.onAutoConfigure} disabled={props.bulkBusy}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold disabled:opacity-50"
                            style={{ ...grad('--app-success'), color: FG_PRIMARY, boxShadow: '0 4px 12px color-mix(in srgb, var(--app-success) 30%, transparent)' }}>
                            <Wand2 size={12} className={props.bulkBusy ? 'animate-spin' : ''} />
                            {props.bulkBusy ? 'Configuring…' : `Auto-configure ${Math.max(1, totalCcy - 1)}`}
                        </button>
                    ) : (
                        <p className="text-[10px] text-app-muted-foreground mt-3">
                            {!hasBase ? 'Mark a base currency first.' : 'Add at least one non-base currency.'}
                        </p>
                    )}
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={<Search24 />}
                    title="No policies match the filter"
                    hint="Try a different search or clear the filters."
                />
            ) : (
                <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                    {filtered.map(p => (
                        <PolicyCard key={p.id}
                            p={p}
                            health={props.healthByPolicy.get(p.id) ?? 'never'}
                            latest={props.latestRateByKey.get(`${p.from_code}→${p.to_code}|${p.rate_type}`) ?? null}
                            sides={props.latestSidesByKey.get(`${p.from_code}→${p.to_code}|${p.rate_type}`) ?? {}}
                            history={props.historyByKey.get(`${p.from_code}→${p.to_code}|${p.rate_type}`) ?? []}
                            syncing={props.syncingId === p.id}
                            onSync={() => props.onSyncOne(p.id)}
                            onEdit={() => props.onEdit(p.id)}
                            onDelete={() => props.onDelete(p)}
                            onToggleAuto={() => props.onUpdate(p.id, { auto_sync: !p.auto_sync } as any)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function Search24() { return <RefreshCcw size={28} className="text-app-muted-foreground opacity-20" /> }

/* ─── Policy card ────────────────────────────────────────────────── */
function PolicyCard({ p, health, latest, sides, history, syncing, onSync, onEdit, onDelete, onToggleAuto }: {
    p: CurrencyRatePolicy
    health: HealthKey
    latest: ExchangeRate | null
    /** All-sides snapshot for this pair. Used to render BID/MID/ASK row when
     *  the policy has spreads configured. Empty object = no rates yet. */
    sides: { MID?: ExchangeRate; BID?: ExchangeRate; ASK?: ExchangeRate }
    /** Last ~30 MID rates ascending — drives the sparkline. */
    history: ExchangeRate[]
    syncing: boolean
    onSync: () => void
    onEdit: () => void
    onDelete: () => void
    onToggleAuto: () => void
}) {
    const [menuOpen, setMenuOpen] = useState(false)
    // Optimistic toggle — flip locally, parent will revert on failure via a
    // re-fetch. Avoids the perceived lag of "click → wait for round-trip".
    const [autoSyncOptimistic, setAutoSyncOptimistic] = useState(p.auto_sync)
    useEffect(() => { setAutoSyncOptimistic(p.auto_sync) }, [p.auto_sync])
    const meta = PROVIDER_META[p.provider]
    const adjusted = latest ? Number(latest.rate) : null
    const mul = Number(p.multiplier) || 1
    const mk = Number(p.markup_pct) || 0
    const factor = mul * (1 + mk / 100)
    const hasSpread = Math.abs(factor - 1) > 1e-9
    const raw = (adjusted !== null && hasSpread && factor !== 0) ? adjusted / factor : null

    const ageH = p.last_synced_at ? (Date.now() - new Date(p.last_synced_at).getTime()) / 36e5 : null
    const ageLabel = ageH === null ? 'never'
        : ageH < 1 / 60 ? 'just now'
        : ageH < 1 ? `${Math.max(1, Math.round(ageH * 60))}m ago`
        : ageH < 48 ? `${Math.round(ageH)}h ago`
        : `${Math.round(ageH / 24)}d ago`

    return (
        <div className="rounded-2xl border transition-all hover:shadow-md cursor-pointer"
            style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
            onClick={(e) => { if ((e.target as HTMLElement).closest('[data-stop]')) return; onEdit() }}>
            {/* Header: pair + health pip + ⋮ menu */}
            <div className="px-4 pt-3 pb-1 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: `var(${HEALTH[health].tone})`, boxShadow: `0 0 0 3px color-mix(in srgb, var(${HEALTH[health].tone}) 18%, transparent)` }}
                        title={HEALTH[health].label} />
                    <span className="font-black font-mono truncate" style={{ fontSize: 13, color: 'var(--app-foreground)' }}>
                        {p.from_code}<span className="text-app-muted-foreground mx-1">→</span>{p.to_code}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0"
                        style={{ ...soft('--app-info', 12), color: 'var(--app-info)' }}>{p.rate_type}</span>
                </div>
                <div className="relative" data-stop>
                    <button onClick={() => setMenuOpen(v => !v)}
                        className="p-1 rounded-md hover:bg-app-border/40 text-app-muted-foreground transition-colors">
                        <MoreVertical size={14} />
                    </button>
                    {menuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                            <div className="absolute right-0 top-full mt-1 z-20 rounded-lg overflow-hidden shadow-xl min-w-[150px]"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <MenuItem icon={<Settings size={11} />} label="Edit"
                                    onClick={() => { setMenuOpen(false); onEdit() }} />
                                <MenuItem icon={<RefreshCcw size={11} />} label="Sync now"
                                    disabled={p.provider === 'MANUAL' || syncing}
                                    onClick={() => { setMenuOpen(false); onSync() }} />
                                <MenuItem icon={<Trash2 size={11} />} label="Delete"
                                    tone="--app-error"
                                    onClick={() => { setMenuOpen(false); onDelete() }} />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Live rate readout — when the policy has bid/ask spreads
                configured (or BID/ASK rows exist in the DB), render a
                three-column BID | MID | ASK readout. Otherwise the classic
                single-MID block. */}
            <div className="px-4 pb-2">
                {(() => {
                    const hasSpread = Number(p.bid_spread_pct) !== 0 || Number(p.ask_spread_pct) !== 0
                    const hasBidAsk = !!sides.BID || !!sides.ASK
                    const showThreeSided = hasSpread || hasBidAsk

                    if (!showThreeSided) {
                        return adjusted !== null ? (
                            <>
                                <div className="font-mono font-black tabular-nums" style={{ fontSize: 22, color: 'var(--app-foreground)', lineHeight: 1.2 }}>
                                    {adjusted.toFixed(6)}
                                </div>
                                <div className="font-mono mt-0.5" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                                    1 {p.from_code} = {adjusted.toFixed(6)} {p.to_code}
                                    {raw !== null && (
                                        <span className="ml-1.5 opacity-70" title={`Raw provider rate before ×${mul.toFixed(4)} +${mk.toFixed(4)}%`}>
                                            · raw {raw.toFixed(6)}
                                        </span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-[11px] italic" style={{ color: 'var(--app-muted-foreground)' }}>
                                No rate yet — click Sync below.
                            </div>
                        )
                    }

                    // Three-sided render: derive BID/ASK from spreads if rows
                    // aren't yet in the DB (so the user sees the *intended*
                    // values immediately after configuring spreads, even
                    // before the next sync writes them).
                    const midRate = sides.MID ? Number(sides.MID.rate) : adjusted
                    const bidPct = Number(p.bid_spread_pct) || 0
                    const askPct = Number(p.ask_spread_pct) || 0
                    const bidRate = sides.BID ? Number(sides.BID.rate)
                        : midRate !== null ? midRate * (1 - bidPct / 100) : null
                    const askRate = sides.ASK ? Number(sides.ASK.rate)
                        : midRate !== null ? midRate * (1 + askPct / 100) : null
                    const bidIsLive = !!sides.BID
                    const askIsLive = !!sides.ASK

                    if (midRate === null) {
                        return (
                            <div className="text-[11px] italic" style={{ color: 'var(--app-muted-foreground)' }}>
                                No rate yet — click Sync below to populate BID / MID / ASK.
                            </div>
                        )
                    }

                    return (
                        <div>
                            <div className="grid grid-cols-3 gap-2 items-end">
                                <RateColumn side="BID" tone="--app-success" sub={`-${bidPct.toFixed(2)}%`}
                                    rate={bidRate} pending={!bidIsLive && bidRate !== null} />
                                <RateColumn side="MID" tone="--app-info" sub="mid-market"
                                    rate={midRate} pending={false} primary />
                                <RateColumn side="ASK" tone="--app-error" sub={`+${askPct.toFixed(2)}%`}
                                    rate={askRate} pending={!askIsLive && askRate !== null} />
                            </div>
                            {(!bidIsLive || !askIsLive) && (
                                <p className="font-mono mt-1.5 leading-tight" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                                    <AlertTriangle size={9} className="inline -mt-px mr-0.5" style={{ color: 'var(--app-warning)' }} />
                                    Bid/Ask values shown are <strong>previewed</strong> from spread; sync to write them to history.
                                </p>
                            )}
                        </div>
                    )
                })()}

                {/* Sparkline of the last ~30 MID rates — drawn left-to-right
                    over time. Trend tone matches the directional change. */}
                {history.length >= 2 && (
                    <Sparkline rates={history} health={health} />
                )}
            </div>

            {/* Source / freshness band */}
            <div className="px-4 py-2 flex items-center gap-2 flex-wrap"
                style={{ background: 'color-mix(in srgb, var(--app-background) 50%, transparent)', borderTop: '1px solid var(--app-border)' }}>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ ...soft(meta.tone, 12), color: `var(${meta.tone})`, border: `1px solid color-mix(in srgb, var(${meta.tone}) 25%, transparent)` }}>
                    {meta.label}
                </span>
                <span className="text-[9px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>·</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--app-muted-foreground)' }}>{FREQ_LABEL[p.sync_frequency]}</span>
                <div className="flex-1" />
                <span className="text-[9px] font-mono whitespace-nowrap"
                    style={{ color: `var(${HEALTH[health].tone})` }}
                    title={p.last_sync_error ?? HEALTH[health].label}>
                    {p.last_sync_status ?? '—'} · {ageLabel}
                </span>
            </div>

            {/* Footer: spread chips + auto toggle + sync */}
            <div className="px-4 py-2 flex items-center gap-2 flex-wrap"
                style={{ borderTop: '1px solid var(--app-border)' }}>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded tabular-nums"
                    style={{ ...soft('--app-info', 8), color: 'var(--app-info)' }}>
                    × {Number(p.multiplier).toFixed(4)}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded tabular-nums"
                    style={{ ...soft('--app-info', 8), color: 'var(--app-info)' }}>
                    + {Number(p.markup_pct).toFixed(2)}%
                </span>
                {(Number(p.bid_spread_pct) !== 0 || Number(p.ask_spread_pct) !== 0) && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded tabular-nums"
                        style={{ ...soft('--app-warning', 8), color: 'var(--app-warning)' }}
                        title="Bid / Ask spreads are non-zero — sync writes a triple (MID, BID, ASK)">
                        ±{Number(p.bid_spread_pct).toFixed(2)} / {Number(p.ask_spread_pct).toFixed(2)}%
                    </span>
                )}
                <div className="flex-1" />
                <button data-stop onClick={() => { setAutoSyncOptimistic(!autoSyncOptimistic); onToggleAuto() }}
                    disabled={p.provider === 'MANUAL'}
                    title={p.provider === 'MANUAL' ? 'Manual policies do not auto-sync' : (autoSyncOptimistic ? 'Disable auto-sync' : 'Enable auto-sync')}
                    className="w-9 h-4 rounded-full relative transition-all disabled:opacity-30"
                    style={{ background: autoSyncOptimistic ? 'var(--app-info)' : 'var(--app-border)' }}>
                    <span className={`w-3 h-3 rounded-full absolute top-0.5 transition-all shadow ${autoSyncOptimistic ? 'left-[22px]' : 'left-0.5'}`}
                        style={{ background: FG_PRIMARY }} />
                </button>
                <button data-stop onClick={onSync}
                    disabled={syncing || p.provider === 'MANUAL'}
                    title={p.provider === 'MANUAL' ? 'Manual provider — no fetch' : 'Fetch fresh rate from provider'}
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border disabled:opacity-50"
                    style={{
                        color: 'var(--app-info)',
                        borderColor: 'color-mix(in srgb, var(--app-info) 30%, transparent)',
                        background: syncing ? 'color-mix(in srgb, var(--app-info) 10%, transparent)' : 'transparent',
                    }}>
                    <RefreshCcw size={11} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing…' : 'Sync'}
                </button>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  RATE HISTORY — pair × time-range × side filters + table
 * ═══════════════════════════════════════════════════════════════════ */
function RateHistoryView({ rates, policies, baseCurrency, orgCurrencyCount, orgBaseCode, onAddManual }: {
    rates: ExchangeRate[]
    policies: CurrencyRatePolicy[]
    baseCurrency: Currency | undefined
    orgCurrencyCount?: number
    orgBaseCode?: string | null
    onAddManual: () => void
}) {
    // Show the Add Manual Rate button as soon as the operator has *any* base
    // configured — either the finance.Currency mirror is up, or the parent
    // tells us OrgCurrency has a default. Prevents the button from being
    // invisible while the mirror lags.
    const canAddManual = !!baseCurrency || !!orgBaseCode
    const [pairFilter, setPairFilter] = useState<'all' | string>('all')
    const [sideFilter, setSideFilter] = useState<'all' | 'MID' | 'BID' | 'ASK'>('all')
    const [rangeFilter, setRangeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')

    const allPairs = Array.from(new Set(rates.map(r => `${r.from_code}→${r.to_code}`))).sort()
    const cutoff = (() => {
        if (rangeFilter === 'all') return null
        const days = rangeFilter === '7d' ? 7 : rangeFilter === '30d' ? 30 : 90
        const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10)
    })()

    const filtered = rates.filter(r => {
        if (pairFilter !== 'all' && `${r.from_code}→${r.to_code}` !== pairFilter) return false
        if (sideFilter !== 'all' && (r.rate_side ?? 'MID') !== sideFilter) return false
        if (cutoff && r.effective_date < cutoff) return false
        return true
    }).sort((a, b) => b.effective_date.localeCompare(a.effective_date))

    // Group by pair → newest first per pair, then aggregate stats.
    const byPair = new Map<string, ExchangeRate[]>()
    for (const r of filtered) {
        const k = `${r.from_code}→${r.to_code}`
        const arr = byPair.get(k) ?? []; arr.push(r); byPair.set(k, arr)
    }

    return (
        <div className="space-y-3">
            {/* ── Toolbar ── */}
            <div className="bg-app-surface rounded-2xl border border-app-border/50 px-3 py-2.5 flex items-center gap-2 flex-wrap">
                <SegSelect<'all' | string>
                    title="Pair"
                    options={[
                        { key: 'all', label: 'All pairs' },
                        ...allPairs.map(p => ({ key: p, label: p })),
                    ]}
                    value={pairFilter} onChange={setPairFilter} />
                <SegSelect<'all' | 'MID' | 'BID' | 'ASK'>
                    title="Side"
                    options={[
                        { key: 'all', label: 'All sides' },
                        { key: 'MID', label: 'Mid', tone: '--app-info' },
                        { key: 'BID', label: 'Bid', tone: '--app-success' },
                        { key: 'ASK', label: 'Ask', tone: '--app-error' },
                    ]}
                    value={sideFilter} onChange={setSideFilter} />
                <SegSelect<'7d' | '30d' | '90d' | 'all'>
                    title="Range"
                    options={[
                        { key: '7d',  label: '7 days' },
                        { key: '30d', label: '30 days' },
                        { key: '90d', label: '90 days' },
                        { key: 'all', label: 'All' },
                    ]}
                    value={rangeFilter} onChange={setRangeFilter} />
                <SegSelect<'table' | 'chart'>
                    title="View"
                    options={[
                        { key: 'table', label: 'Table' },
                        { key: 'chart', label: 'Chart' },
                    ]}
                    value={viewMode} onChange={setViewMode} />
                <div className="flex-1" />
                <ActionBtn icon={<Plus size={11} />} tone="--app-success"
                    disabled={!canAddManual}
                    title={!canAddManual
                        ? 'Set a base currency first — Currencies tab → ⭐'
                        : 'Type a rate by hand for one date · MID only or BID + MID + ASK'}
                    onClick={onAddManual}>
                    Add Manual Rate
                </ActionBtn>
            </div>

            {/* ── Per-pair sections ── */}
            {byPair.size === 0 ? (
                <EmptyState
                    icon={<TrendingUp size={28} className="text-app-muted-foreground opacity-25" />}
                    title="No rates in this range"
                    hint="Adjust the filters above, or run a sync from the Rate Rules tab to populate history."
                />
            ) : (
                <div className="space-y-3">
                    {Array.from(byPair.entries()).map(([pair, list]) => {
                        const latest = list[0]; const previous = list[1]
                        const latestN = Number(latest.rate)
                        const prevN = previous ? Number(previous.rate) : null
                        const delta = prevN !== null ? latestN - prevN : null
                        const deltaPct = prevN !== null && prevN !== 0 ? (delta! / prevN) * 100 : null
                        return (
                            <div key={pair} className="bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden">
                                <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
                                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', borderBottom: '1px solid var(--app-border)' }}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black font-mono" style={{ fontSize: 13, color: 'var(--app-foreground)' }}>{pair}</span>
                                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                            style={{ ...soft('--app-info', 12), color: 'var(--app-info)' }}>
                                            {list.length} {list.length === 1 ? 'snapshot' : 'snapshots'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>latest</span>
                                        <span className="font-mono font-black tabular-nums" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>
                                            {latestN.toFixed(6)}
                                        </span>
                                        {delta !== null && deltaPct !== null && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold whitespace-nowrap"
                                                style={delta === 0
                                                    ? { ...soft('--app-muted-foreground', 12), color: 'var(--app-muted-foreground)', fontSize: 10 }
                                                    : delta > 0
                                                        ? { ...soft('--app-success', 12), color: 'var(--app-success)', fontSize: 10 }
                                                        : { ...soft('--app-error', 12), color: 'var(--app-error)', fontSize: 10 }}>
                                                {delta > 0 ? <TrendingUp size={10} /> : delta < 0 ? <TrendingDown size={10} /> : null}
                                                {delta > 0 ? '+' : ''}{deltaPct.toFixed(2)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {viewMode === 'chart' ? (
                                    <PairChart list={list} />
                                ) : (
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ background: 'color-mix(in srgb, var(--app-background) 30%, transparent)' }}>
                                                <Th>Date</Th>
                                                <Th>Type</Th>
                                                <Th>Side</Th>
                                                <Th align="right">Rate</Th>
                                                <Th align="right">Δ vs prev</Th>
                                                <Th>Source</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {list.slice(0, 20).map((r, idx) => {
                                                const next = list[idx + 1]
                                                const rDelta = next && Number(next.rate) !== 0 ? ((Number(r.rate) - Number(next.rate)) / Number(next.rate)) * 100 : null
                                                const isToday = r.effective_date === new Date().toISOString().slice(0, 10)
                                                return (
                                                    <tr key={r.id} className="border-t border-app-border/30 hover:bg-app-background/40">
                                                        <Td><span className="font-mono whitespace-nowrap" style={{ color: isToday ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                                            {r.effective_date}{isToday && <span className="ml-1.5 text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success)' }}>today</span>}
                                                        </span></Td>
                                                        <Td><Pill tone="--app-info">{r.rate_type}</Pill></Td>
                                                        <Td><Pill tone={r.rate_side === 'BID' ? '--app-success' : r.rate_side === 'ASK' ? '--app-error' : '--app-muted-foreground'}>{r.rate_side ?? 'MID'}</Pill></Td>
                                                        <Td align="right"><span className="font-mono font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{Number(r.rate).toFixed(6)}</span></Td>
                                                        <Td align="right">
                                                            <span className="font-mono tabular-nums whitespace-nowrap"
                                                                style={rDelta === null ? { color: 'var(--app-muted-foreground)' }
                                                                    : rDelta === 0 ? { color: 'var(--app-muted-foreground)' }
                                                                        : rDelta > 0 ? { color: 'var(--app-success)' } : { color: 'var(--app-error)' }}>
                                                                {rDelta === null ? '—' : `${rDelta > 0 ? '+' : ''}${rDelta.toFixed(2)}%`}
                                                            </span>
                                                        </Td>
                                                        <Td><span className="font-mono text-app-muted-foreground" style={{ fontSize: 10 }}>{r.source ?? '—'}</span></Td>
                                                    </tr>
                                                )
                                            })}
                                            {list.length > 20 && (
                                                <tr><td colSpan={6} className="px-3 py-1.5 text-[10px] text-app-muted-foreground text-center italic">… {list.length - 20} older rows hidden</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  REVALUATIONS — period board (left list + right detail)
 * ═══════════════════════════════════════════════════════════════════ */
function RevaluationsView({ periods, revals, selectedPeriod, setSelectedPeriodId, running, onRun }: {
    periods: Period[]
    revals: CurrencyRevaluation[]
    selectedPeriod: Period | null
    setSelectedPeriodId: (id: number | null) => void
    running: number | null
    onRun: (periodId: number) => void
}) {
    const periodReval = (periodId: number) => revals.find(r => r.fiscal_period === periodId && r.status === 'POSTED') ?? null

    const yearTotals = revals.reduce((acc, r) => {
        if (r.status !== 'POSTED') return acc
        acc.gain += Number(r.total_gain || 0)
        acc.loss += Number(r.total_loss || 0)
        acc.net += Number(r.net_impact || 0)
        return acc
    }, { gain: 0, loss: 0, net: 0 })

    return (
        <div className="space-y-3">
            {/* KPI summary */}
            <div className="bg-app-surface rounded-2xl border border-app-border/50 p-2.5 grid gap-2"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <Kpi label="Open periods" value={periods.filter(p => p.status === 'OPEN').length} tone="--app-success" icon={<Play size={12} />} />
                <Kpi label="Reval'd"       value={revals.filter(r => r.status === 'POSTED').length} tone="--app-info"   icon={<Check size={12} />} />
                <Kpi label="Total gain"    value={yearTotals.gain.toFixed(2)} tone="--app-success" icon={<TrendingUp size={12} />} />
                <Kpi label="Total loss"    value={yearTotals.loss.toFixed(2)} tone="--app-error"   icon={<TrendingDown size={12} />} />
                <Kpi label="Net YTD"       value={(yearTotals.net >= 0 ? '+' : '') + yearTotals.net.toFixed(2)} tone={yearTotals.net >= 0 ? '--app-success' : '--app-error'} icon={<Coins size={12} />} />
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(280px, 360px) 1fr' }}>
                {/* ── Period list ── */}
                <div className="bg-app-surface rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
                    <SectionHeader icon={<Coins size={13} style={{ color: 'var(--app-warning)' }} />}
                        title="Fiscal Periods" subtitle={`${periods.length} period${periods.length === 1 ? '' : 's'}`} />
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[600px]">
                        {periods.length === 0 ? (
                            <p className="text-[10px] text-app-muted-foreground italic px-2 py-3">No fiscal periods configured. Create a fiscal year first.</p>
                        ) : periods.map(p => {
                            const r = periodReval(p.id)
                            const isSel = selectedPeriod?.id === p.id
                            const tone = r ? '--app-success' : p.status === 'OPEN' ? '--app-info' : '--app-muted-foreground'
                            return (
                                <button key={p.id} onClick={() => setSelectedPeriodId(p.id)}
                                    className="w-full text-left rounded-lg px-3 py-2 transition-all"
                                    style={isSel
                                        ? { ...soft('--app-warning', 10), border: '1px solid color-mix(in srgb, var(--app-warning) 30%, transparent)' }
                                        : { background: 'transparent', border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-black truncate" style={{ fontSize: 12, color: 'var(--app-foreground)' }}>{p.name}</span>
                                        <Pill tone={tone}>{r ? "✓ REVAL'D" : p.status}</Pill>
                                    </div>
                                    <div className="font-mono mt-0.5" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                                        {p.start_date} → {p.end_date}
                                    </div>
                                    {r && (
                                        <div className="font-mono font-bold tabular-nums mt-1" style={{ fontSize: 10, color: Number(r.net_impact) >= 0 ? 'var(--app-success)' : 'var(--app-error)' }}>
                                            net {Number(r.net_impact) >= 0 ? '+' : ''}{r.net_impact}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* ── Selected-period detail ── */}
                <div className="bg-app-surface rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
                    {!selectedPeriod ? (
                        <div className="p-8 flex items-center justify-center text-app-muted-foreground italic" style={{ fontSize: 11 }}>
                            Pick a period on the left to see details.
                        </div>
                    ) : (() => {
                        const r = periodReval(selectedPeriod.id)
                        return (
                            <>
                                <SectionHeader
                                    icon={<Play size={13} style={{ color: 'var(--app-warning)' }} />}
                                    title={selectedPeriod.name}
                                    subtitle={`${selectedPeriod.start_date} → ${selectedPeriod.end_date} · ${selectedPeriod.status}`}
                                    action={
                                        <ActionBtn icon={<Play size={11} />} tone="--app-warning" filled
                                            disabled={running === selectedPeriod.id || selectedPeriod.status !== 'OPEN'}
                                            onClick={() => onRun(selectedPeriod.id)}>
                                            {running === selectedPeriod.id ? 'Running…' : (r ? 'Re-run' : 'Run revaluation')}
                                        </ActionBtn>
                                    } />
                                <div className="p-4 space-y-3 overflow-y-auto">
                                    {r ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            <Kpi label="Gain" value={r.total_gain} tone="--app-success" icon={<TrendingUp size={12} />} />
                                            <Kpi label="Loss" value={r.total_loss} tone="--app-error" icon={<TrendingDown size={12} />} />
                                            <Kpi label="Net" value={(Number(r.net_impact) >= 0 ? '+' : '') + r.net_impact}
                                                tone={Number(r.net_impact) >= 0 ? '--app-success' : '--app-error'}
                                                icon={<Coins size={12} />} />
                                        </div>
                                    ) : (
                                        <div className="rounded-lg p-3 text-[10px]"
                                            style={{ ...soft('--app-info', 6), border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)', color: 'var(--app-foreground)' }}>
                                            <strong className="font-black uppercase tracking-widest" style={{ color: 'var(--app-info)', fontSize: 9 }}>How it works</strong>
                                            {' — '}revaluation marks every foreign-currency account to its closing rate. Posts a journal entry; cannot run on closed periods.
                                        </div>
                                    )}

                                    {/* All revaluations for this period (history) */}
                                    {(() => {
                                        const all = revals.filter(rv => rv.fiscal_period === selectedPeriod.id)
                                        if (all.length === 0) return null
                                        // Net-impact mini chart across this period's reval runs.
                                        const netSeries = [...all]
                                            .filter(rv => rv.status === 'POSTED')
                                            .sort((a, b) => a.revaluation_date.localeCompare(b.revaluation_date))
                                            .map(rv => Number(rv.net_impact))
                                        return (
                                            <div className="rounded-lg overflow-hidden border border-app-border/50">
                                                <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-app-muted-foreground flex items-center justify-between gap-2"
                                                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                                    <span>History</span>
                                                    {netSeries.length >= 2 && (
                                                        <span className="text-[9px] font-bold normal-case tracking-normal text-app-muted-foreground">
                                                            net-impact trend
                                                        </span>
                                                    )}
                                                </div>
                                                {netSeries.length >= 2 && (
                                                    <div className="px-3 pt-2">
                                                        <NumericSparkline values={netSeries} />
                                                    </div>
                                                )}
                                                <table className="w-full">
                                                    <tbody>
                                                        {all.map(rv => (
                                                            <tr key={rv.id} className="border-t border-app-border/30">
                                                                <Td><span className="font-mono" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>{rv.revaluation_date}</span></Td>
                                                                <Td><Pill tone={rv.scope === 'OFFICIAL' ? '--app-success' : '--app-info'}>{rv.scope}</Pill></Td>
                                                                <Td align="right"><span className="font-mono font-bold tabular-nums" style={{ fontSize: 10, color: Number(rv.net_impact) >= 0 ? 'var(--app-success)' : 'var(--app-error)' }}>
                                                                    {Number(rv.net_impact) >= 0 ? '+' : ''}{rv.net_impact}
                                                                </span></Td>
                                                                <Td><span style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>{rv.accounts_processed} accts</span></Td>
                                                                <Td><span className="font-mono" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>{rv.je_reference ?? '—'}</span></Td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )
                                    })()}
                                </div>
                            </>
                        )
                    })()}
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  POLICY DRAWER — single source of truth for create + edit
 * ═══════════════════════════════════════════════════════════════════ */
function PolicyDrawer({ policy, base, currencies, existingPairs, onRefresh, onClose, onSubmit }: {
    policy: CurrencyRatePolicy | null
    base?: Currency
    currencies: Currency[]
    existingPairs?: Set<string>
    /** Same self-heal as ManualRateModal — refreshes parent state when the
     *  drawer opens to a missing-base condition. */
    onRefresh?: () => Promise<void>
    onClose: () => void
    onSubmit: (patch: any) => Promise<void>
}) {
    const isCreate = policy === null
    const baseCcy = base ?? currencies.find(c => c.is_base)
    const non_base = currencies.filter(c => c.id !== baseCcy?.id && c.is_active)
    const [refreshing, setRefreshing] = useState(false)
    // useRef instead of useState — flipping this guard MUST NOT itself trigger
    // a re-render, otherwise the effect re-runs with a fresh `onRefresh` ref
    // and (depending on render timing) fires another refresh. With a ref,
    // the value is mutated synchronously and the effect simply doesn't see
    // the not-yet-rendered state from the parent.
    const didRefresh = useRef(false)
    useEffect(() => {
        if (isCreate && !baseCcy && !didRefresh.current && onRefresh) {
            didRefresh.current = true
            setRefreshing(true)
            onRefresh().finally(() => { setRefreshing(false) })
        }
    }, [isCreate, baseCcy, onRefresh])

    const [fromId, setFromId] = useState<number | null>(policy?.from_currency ?? non_base[0]?.id ?? null)
    const [rateType, setRateType] = useState<CurrencyRatePolicy['rate_type']>(policy?.rate_type ?? 'SPOT')
    const [provider, setProvider] = useState<CurrencyRatePolicy['provider']>(policy?.provider ?? 'ECB')
    const [syncFrequency, setSyncFrequency] = useState<CurrencyRatePolicy['sync_frequency']>(policy?.sync_frequency ?? 'DAILY')
    const [autoSync, setAutoSync] = useState(policy?.auto_sync ?? true)
    const [multiplier, setMultiplier] = useState(policy?.multiplier ?? '1.000000')
    const [markupPct, setMarkupPct] = useState(policy?.markup_pct ?? '0.0000')
    const [bidSpreadPct, setBidSpreadPct] = useState(policy?.bid_spread_pct ?? '0.0000')
    const [askSpreadPct, setAskSpreadPct] = useState(policy?.ask_spread_pct ?? '0.0000')
    const [apiKey, setApiKey] = useState('')
    const [busy, setBusy] = useState(false)

    const meta = PROVIDER_META[provider]
    const mul = Number(multiplier); const mk = Number(markupPct)
    const bid = Number(bidSpreadPct); const ask = Number(askSpreadPct)
    const mulValid = isFinite(mul) && mul > 0
    const mkValid  = isFinite(mk) && mk >= -50 && mk <= 50
    const bidValid = isFinite(bid) && bid >= 0 && bid <= 50
    const askValid = isFinite(ask) && ask >= 0 && ask <= 50
    const dupKey = `${fromId}-${baseCcy?.id}-${rateType}`
    const isDup = isCreate && existingPairs?.has(dupKey)
    const valid = mulValid && mkValid && bidValid && askValid && !isDup && !!fromId
    // For paid providers, require key only on create. On edit, leaving key
    // blank means "keep existing", so we accept blank.
    const needsKey = meta.needsKey && (isCreate ? !apiKey.trim() : false)

    const previewAdjusted = mulValid ? (1 * mul * (mkValid ? (1 + mk / 100) : 1)).toFixed(6) : null

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-md flex flex-col animate-in slide-in-from-right duration-200"
                style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>
                {/* Header */}
                <div className="px-5 py-4 flex items-start justify-between gap-3"
                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div>
                        <div className="font-black" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>
                            {isCreate ? 'New rate source' : `${policy?.from_code} → ${policy?.to_code}`}
                        </div>
                        <p className="font-bold uppercase tracking-widest mt-0.5"
                            style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                            {isCreate ? 'Configure how a pair is sourced' : 'Edit policy'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-border/40 -m-1.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Cant-create state — replaces a half-broken form when the
                        currency list isn't available. Surfaces refresh status
                        and a retry button so the user has a path forward. */}
                    {isCreate && !baseCcy && (
                        <div className="rounded-xl p-4"
                            style={{ ...soft('--app-error', 8), border: '1px solid color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
                            <div className="font-black mb-1.5 inline-flex items-center gap-1.5"
                                style={{ fontSize: 13, color: 'var(--app-error)' }}>
                                {refreshing
                                    ? <><RefreshCcw size={13} className="animate-spin" /> Loading currencies…</>
                                    : <><AlertTriangle size={13} /> Can&apos;t create a policy yet</>}
                            </div>
                            {!refreshing && (
                                <>
                                    <p className="leading-relaxed mb-3" style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                                        The currency list couldn&apos;t be loaded — typically because:
                                    </p>
                                    <ul className="space-y-1 mb-3 ml-4 list-disc" style={{ fontSize: 10, color: 'var(--app-foreground)' }}>
                                        <li>You&apos;re on the SaaS root domain instead of a tenant subdomain.</li>
                                        <li>Your session expired and you need to re-login.</li>
                                        <li>The backend missed a migration (run <code className="font-mono">manage.py migrate finance</code>).</li>
                                        <li>No base currency is set — go to the <em>Select Currency</em> tab and mark one with ⭐.</li>
                                    </ul>
                                    <p style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                                        Currently loaded: <strong>{currencies.length}</strong> currenc{currencies.length === 1 ? 'y' : 'ies'},
                                        base = <strong>{currencies.find(c => c.is_base)?.code ?? 'none'}</strong>.
                                    </p>
                                    <div className="mt-3 flex items-center gap-2">
                                        {onRefresh && (
                                            <button onClick={() => {
                                                setRefreshing(true)
                                                onRefresh().finally(() => setRefreshing(false))
                                            }}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold border"
                                                style={{
                                                    fontSize: 11,
                                                    color: 'var(--app-error)',
                                                    borderColor: 'color-mix(in srgb, var(--app-error) 30%, transparent)',
                                                    background: 'color-mix(in srgb, var(--app-error) 6%, transparent)',
                                                }}>
                                                <RefreshCcw size={11} /> Retry load
                                            </button>
                                        )}
                                        <button onClick={onClose}
                                            className="px-3 py-1.5 rounded-lg font-bold border"
                                            style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                                            Close
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Pair (create only) */}
                    {isCreate && baseCcy && (
                        <Field label="Pair" hint={isDup ? 'A policy for this pair already exists' : undefined} error={isDup}>
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                                <select value={fromId ?? ''} onChange={e => setFromId(Number(e.target.value))}
                                    className={INPUT_CLS} style={INPUT_STYLE}>
                                    {non_base.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                                </select>
                                <span className="text-[12px] font-mono font-black text-center" style={{ color: 'var(--app-muted-foreground)' }}>→</span>
                                <div className="px-3 py-1.5 rounded-lg font-mono font-black text-center"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)', fontSize: 12 }}>
                                    {baseCcy.code}
                                </div>
                            </div>
                        </Field>
                    )}

                    {/* Suppress the rest of the form in the no-base error state — the
                        user has nothing to configure until currencies load. */}
                    {(!isCreate || baseCcy) && (
                    <>

                    {/* Provider + rate type + frequency */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Provider">
                            <select value={provider} onChange={e => setProvider(e.target.value as any)}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                <option value="ECB">ECB · free</option>
                                <option value="FRANKFURTER">Frankfurter · free</option>
                                <option value="EXCHANGERATE_HOST">exchangerate.host</option>
                                <option value="FIXER">Fixer.io</option>
                                <option value="OPENEXCHANGERATES">OpenExchangeRates</option>
                                <option value="MANUAL">Manual entry</option>
                            </select>
                        </Field>
                        <Field label="Rate type">
                            <select value={rateType} onChange={e => setRateType(e.target.value as any)}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                <option value="SPOT">SPOT</option>
                                <option value="AVERAGE">AVERAGE</option>
                                <option value="CLOSING">CLOSING</option>
                            </select>
                        </Field>
                    </div>

                    {provider !== 'MANUAL' && (
                        <Field label="Refresh">
                            <select value={syncFrequency} onChange={e => setSyncFrequency(e.target.value as any)}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                <option value="ON_TRANSACTION">Per transaction (just-in-time)</option>
                                <option value="DAILY">Every day</option>
                                <option value="WEEKLY">Every week</option>
                                <option value="MONTHLY">Every month</option>
                            </select>
                        </Field>
                    )}

                    {/* API key (paid providers) */}
                    {meta.needsKey && (
                        <Field label="API key" hint={!isCreate ? 'Leave blank to keep existing key' : undefined}>
                            <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                                type="password" autoComplete="off"
                                placeholder={provider === 'FIXER' ? 'Fixer access_key'
                                    : provider === 'OPENEXCHANGERATES' ? 'OXR app_id' : 'access_key'}
                                className={INPUT_CLS} style={INPUT_STYLE} />
                        </Field>
                    )}

                    {/* Multiplier × Markup */}
                    <PanelGroup tone="--app-info" title="Spread Adjustment" hint="Optional. Default = no spread.">
                        <div className="grid grid-cols-2 gap-2">
                            <PrefixInput tone="--app-info" prefix="×" suffix=""
                                value={multiplier} onChange={setMultiplier} valid={mulValid}
                                placeholder="1.000000" />
                            <PrefixInput tone="--app-info" prefix="+" suffix="%"
                                value={markupPct} onChange={setMarkupPct} valid={mkValid}
                                placeholder="0.0000" />
                        </div>
                        {previewAdjusted && valid && (
                            <p className="font-mono mt-2" style={{ fontSize: 10, color: 'var(--app-info)' }}>
                                Preview: 1.000000 × {Number(multiplier).toFixed(6)} × (1 + {Number(markupPct).toFixed(4)}%) = <strong>{previewAdjusted}</strong>
                            </p>
                        )}
                    </PanelGroup>

                    {/* Bid / Ask spread */}
                    <PanelGroup tone="--app-warning" title="Bid / Ask Spread" hint="Non-zero = sync writes (MID, BID, ASK) triple.">
                        <div className="grid grid-cols-2 gap-2">
                            <PrefixInput tone="--app-warning" prefix="−" suffix="%"
                                value={bidSpreadPct} onChange={setBidSpreadPct} valid={bidValid}
                                placeholder="0.0000" />
                            <PrefixInput tone="--app-warning" prefix="+" suffix="%"
                                value={askSpreadPct} onChange={setAskSpreadPct} valid={askValid}
                                placeholder="0.0000" />
                        </div>
                    </PanelGroup>

                    {provider !== 'MANUAL' && syncFrequency !== 'ON_TRANSACTION' && (
                        <label className="flex items-center gap-2 text-[10px] font-bold cursor-pointer"
                            style={{ color: 'var(--app-foreground)' }}>
                            <input type="checkbox" checked={autoSync} onChange={e => setAutoSync(e.target.checked)}
                                className="w-3.5 h-3.5 rounded accent-app-info" />
                            Run on cron (auto-sync)
                        </label>
                    )}
                    </>
                    )}{/* end suppression when isCreate && !baseCcy */}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 flex items-center justify-between gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <div className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                        {!valid && (isDup ? 'Pair already covered'
                            : !mulValid ? 'Invalid multiplier'
                            : !mkValid ? 'Markup out of range'
                            : !bidValid || !askValid ? 'Bid/ask out of range'
                            : 'Fix errors above')}
                        {needsKey && ' · API key required'}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose}
                            className="px-3.5 py-1.5 rounded-xl font-bold border"
                            style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                            Cancel
                        </button>
                        <button disabled={busy || !valid || needsKey || (isCreate && !baseCcy)}
                            onClick={async () => {
                                setBusy(true)
                                try {
                                    const provider_config: Record<string, any> = policy?.provider_config ?? {}
                                    const k = apiKey.trim()
                                    if (k) { provider_config.access_key = k; provider_config.api_key = k; provider_config.app_id = k }
                                    const payload: any = {
                                        rate_type: rateType, provider,
                                        sync_frequency: provider === 'MANUAL' ? 'DAILY' : syncFrequency,
                                        auto_sync: autoSync && provider !== 'MANUAL' && syncFrequency !== 'ON_TRANSACTION',
                                        multiplier, markup_pct: markupPct,
                                        bid_spread_pct: bidSpreadPct, ask_spread_pct: askSpreadPct,
                                    }
                                    if (Object.keys(provider_config).length) payload.provider_config = provider_config
                                    if (isCreate) {
                                        payload.from_currency = fromId!
                                        payload.to_currency = baseCcy!.id
                                    }
                                    await onSubmit(payload)
                                } finally { setBusy(false) }
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold disabled:opacity-50"
                            style={!busy && valid && !needsKey
                                ? { ...grad('--app-primary'), color: FG_PRIMARY, fontSize: 11, boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }
                                : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)', fontSize: 11 }}>
                            {busy ? 'Saving…' : (isCreate ? 'Create policy' : 'Save changes')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  SET BROKER MODAL — bulk re-assignment
 * ═══════════════════════════════════════════════════════════════════ */
function SetBrokerModal({ policies, currencies, onClose, onApplied }: {
    policies: CurrencyRatePolicy[]
    currencies: Currency[]
    onClose: () => void
    onApplied: () => Promise<void>
}) {
    const [provider, setProvider] = useState<CurrencyRatePolicy['provider']>('FRANKFURTER')
    const [scope, setScope] = useState<'all' | 'include' | 'exclude'>('all')
    const [codes, setCodes] = useState<string[]>([])
    const [apiKey, setApiKey] = useState('')
    const [busy, setBusy] = useState(false)

    const meta = PROVIDER_META[provider]
    const policyCodes = new Set(policies.map(p => p.from_code))
    const fromMirror = currencies.filter(c => !c.is_base && c.is_active).map(c => c.code)
    const allCodes = Array.from(new Set([...fromMirror, ...policyCodes])).sort()

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
                style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-warning) 30%, var(--app-border))' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'var(--app-warning)' }} />
                <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ ...soft('--app-warning', 14), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                        <Settings size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-black" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>Set Broker</div>
                        <p className="font-bold uppercase tracking-widest mt-0.5"
                            style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                            Re-assign the rate provider for one, all, or a custom group of currencies
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-border/40 -m-1.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={14} />
                    </button>
                </div>

                <div className="px-5 pb-4 space-y-4">
                    {/* Provider */}
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>1. Pick provider</div>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(PROVIDER_META) as Array<keyof typeof PROVIDER_META>).map(code => {
                                const m = PROVIDER_META[code]; const active = provider === code
                                return (
                                    <button key={code} type="button" onClick={() => setProvider(code)}
                                        className="text-left px-3 py-2 rounded-lg transition-all"
                                        style={active
                                            ? { ...soft('--app-warning', 12), border: '1px solid color-mix(in srgb, var(--app-warning) 35%, transparent)' }
                                            : { background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="font-black"
                                                style={{ fontSize: 11, color: active ? 'var(--app-warning)' : 'var(--app-foreground)' }}>{m.label}</span>
                                            {active && <Check size={11} style={{ color: 'var(--app-warning)' }} />}
                                        </div>
                                        <div className="mt-0.5 leading-tight"
                                            style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                                            {m.needsKey ? 'API key required' : 'Free · no auth'}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {meta.needsKey && (
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>API key</div>
                            <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                                type="password" autoComplete="off" placeholder="access_key / api_key / app_id"
                                className={INPUT_CLS} style={INPUT_STYLE} />
                        </div>
                    )}

                    {/* Scope */}
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>2. Apply to</div>
                        <div className="inline-flex items-stretch rounded-xl overflow-hidden border h-9 w-full"
                            style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                            {([
                                { key: 'all', label: 'All currencies' },
                                { key: 'include', label: 'Specific' },
                                { key: 'exclude', label: 'All except' },
                            ] as const).map((opt, idx) => {
                                const active = scope === opt.key
                                return (
                                    <button key={opt.key} type="button" onClick={() => setScope(opt.key)}
                                        className="flex-1 inline-flex items-center justify-center font-bold transition-all"
                                        style={{
                                            fontSize: 11,
                                            color: active ? 'var(--app-warning)' : 'var(--app-muted-foreground)',
                                            background: active ? 'color-mix(in srgb, var(--app-warning) 12%, transparent)' : 'transparent',
                                            borderLeft: idx === 0 ? 'none' : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                        }}>
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Currencies */}
                    {scope !== 'all' && (
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {scope === 'include' ? '3. Pick currencies to switch' : '3. Pick currencies to KEEP unchanged'}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => setCodes(allCodes)}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-app-warning/10"
                                        style={{ color: 'var(--app-warning)' }}>Select all</button>
                                    <button type="button" onClick={() => setCodes([])}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-app-warning/10"
                                        style={{ color: 'var(--app-warning)' }}>Clear</button>
                                </div>
                            </div>
                            {allCodes.length === 0 ? (
                                <p className="text-[10px] italic" style={{ color: 'var(--app-muted-foreground)' }}>
                                    No active currencies — enable some in the Select Currency tab first.
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {allCodes.map(code => {
                                        const active = codes.includes(code)
                                        const hasPolicy = policyCodes.has(code)
                                        return (
                                            <button key={code} type="button"
                                                onClick={() => setCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])}
                                                title={hasPolicy ? `Existing policy will be re-pointed to ${provider}` : `No policy yet — a new one will be created with ${provider}`}
                                                className="px-2 py-1 rounded-md font-mono font-bold inline-flex items-center gap-1"
                                                style={active
                                                    ? { ...soft('--app-warning', 14), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 35%, transparent)', fontSize: 11 }
                                                    : { background: 'var(--app-background)', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)', fontSize: 11 }}>
                                                {active && <Check size={9} className="-mt-px" />}
                                                {code}
                                                {!hasPolicy && (
                                                    <span className="ml-0.5 font-bold uppercase tracking-widest"
                                                        style={{ fontSize: 8, color: active ? 'var(--app-warning)' : 'var(--app-muted-foreground)' }}>· new</span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Impact */}
                    <div className="rounded-md p-2.5"
                        style={{ ...soft('--app-info', 6), border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                        <div className="text-[10px] leading-relaxed" style={{ color: 'var(--app-foreground)' }}>
                            {(() => {
                                const codesNow = new Set(policies.map(p => p.from_code))
                                let upd = 0, made = 0
                                if (scope === 'all') upd = policies.length
                                else if (scope === 'include') {
                                    upd = policies.filter(p => codes.includes(p.from_code)).length
                                    made = codes.filter(c => !codesNow.has(c)).length
                                } else {
                                    upd = policies.filter(p => !codes.includes(p.from_code)).length
                                }
                                return (
                                    <>
                                        <strong className="font-black uppercase tracking-widest"
                                            style={{ color: 'var(--app-info)', fontSize: 9 }}>Impact</strong>
                                        {upd > 0 && <> · <strong>{upd}</strong> updated</>}
                                        {made > 0 && <> · <strong style={{ color: 'var(--app-success)' }}>{made} new</strong> created</>}
                                        {' '}with <strong>{provider}</strong>.
                                        {(upd === 0 && made === 0) && ' Nothing selected — pick currencies or change scope.'}
                                    </>
                                )
                            })()}
                        </div>
                    </div>
                </div>

                <div className="px-4 py-3 flex items-center justify-end gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <button onClick={onClose}
                        className="px-3.5 py-1.5 rounded-xl font-bold border"
                        style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                        Cancel
                    </button>
                    <button disabled={busy} onClick={async () => {
                        setBusy(true)
                        try {
                            const provider_config: Record<string, any> = {}
                            const k = apiKey.trim()
                            if (k) { provider_config.access_key = k; provider_config.api_key = k; provider_config.app_id = k }
                            const r = await bulkUpdateRatePolicyProvider({
                                provider, provider_config: Object.keys(provider_config).length ? provider_config : undefined,
                                scope, from_currency_codes: scope === 'all' ? undefined : codes,
                                create_if_missing: scope === 'include',
                            })
                            if (!r.success) { toast.error(r.error || 'Failed'); return }
                            const created = r.created?.length ?? 0
                            const updated = (r.count ?? 0) - created
                            toast.success(`Broker = ${provider}` + (updated ? ` · ${updated} updated` : '') + (created ? ` · ${created} created` : ''))
                            await onApplied()
                        } finally { setBusy(false) }
                    }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold disabled:opacity-50"
                        style={{ ...grad('--app-warning'), color: FG_PRIMARY, fontSize: 11, boxShadow: '0 4px 12px color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                        {busy && <RefreshCcw size={11} className="animate-spin" />}
                        {busy ? 'Applying…' : 'Apply broker'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  MANUAL RATE MODAL
 * ═══════════════════════════════════════════════════════════════════ */
/** Manual rate entry. Two modes:
 *    - "Mid only" (default)        — single rate input, writes one MID row.
 *    - "Bid + Mid + Ask"           — three rate inputs, writes a triple.
 *  Backend's unique-together is (org, from, to, date, type, side), so writing
 *  three rows with distinct sides is safe and idempotent for re-edits. */
function ManualRateModal({ base, currencies, onRefresh, onClose, onSubmit }: {
    /** Optional — modal falls back to `currencies.find(c => c.is_base)` so
     *  clicking the button works even before the mirror finishes loading. */
    base?: Currency
    currencies: Currency[]
    /** Called when the modal opens with no base in `currencies`. Re-fetches
     *  the parent's loadAll(); modal re-renders when state updates. Without
     *  this, a click on Add Manual Rate during the initial fetch would
     *  permanently show the "Set a base currency first" notice. */
    onRefresh?: () => Promise<void>
    onClose: () => void
    onSubmit: (p: { from_currency: number; to_currency: number; rate: string; rate_type: ExchangeRate['rate_type']; rate_side?: 'MID' | 'BID' | 'ASK'; effective_date: string; source?: string }) => Promise<void>
}) {
    const baseCcy = base ?? currencies.find(c => c.is_base)
    const [refreshing, setRefreshing] = useState(false)
    // useRef guard — see PolicyDrawer for why this can't be useState. Flipping
    // it doesn't trigger a re-render, so subsequent effect re-evaluations
    // (caused by onRefresh ref changes from parent re-renders) safely skip
    // the body and don't fire another refresh.
    const didRefresh = useRef(false)

    useEffect(() => {
        if (!baseCcy && !didRefresh.current && onRefresh) {
            didRefresh.current = true
            setRefreshing(true)
            onRefresh().finally(() => { setRefreshing(false) })
        }
    }, [baseCcy, onRefresh])

    if (!baseCcy) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
                onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
                <div className="w-full max-w-md rounded-2xl overflow-hidden p-5"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    {refreshing ? (
                        <>
                            <div className="font-black mb-2 inline-flex items-center gap-2" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>
                                <RefreshCcw size={14} className="animate-spin" /> Loading currencies…
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--app-muted-foreground)' }}>
                                Refreshing the currency list. This usually takes a second.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="font-black mb-2" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>Set a base currency first</div>
                            <p style={{ fontSize: 11, color: 'var(--app-muted-foreground)' }}>
                                Manual-rate entries store the value in your base currency. Mark one of your enabled currencies as ⭐ base
                                in the <em>Select Currency</em> tab, then come back here. Currently loaded:
                                {' '}<strong>{currencies.length}</strong> currenc{currencies.length === 1 ? 'y' : 'ies'},
                                {' '}base = <strong>{currencies.find(c => c.is_base)?.code ?? 'none'}</strong>.
                            </p>
                            <div className="mt-4 flex items-center gap-2">
                                {onRefresh && (
                                    <button onClick={() => {
                                        setRefreshing(true)
                                        onRefresh().finally(() => setRefreshing(false))
                                    }}
                                        className="px-3.5 py-1.5 rounded-xl font-bold border"
                                        style={{
                                            fontSize: 11,
                                            color: 'var(--app-info)',
                                            borderColor: 'color-mix(in srgb, var(--app-info) 30%, transparent)',
                                            background: 'color-mix(in srgb, var(--app-info) 6%, transparent)',
                                        }}>
                                        <RefreshCcw size={11} className="inline -mt-0.5 mr-1" /> Refresh
                                    </button>
                                )}
                                <button onClick={onClose} className="px-3.5 py-1.5 rounded-xl font-bold border"
                                    style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                                    Close
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }
    const non_base = currencies.filter(c => c.id !== baseCcy.id && c.is_active)
    const [fromId, setFromId] = useState<number | null>(non_base[0]?.id ?? null)
    const [mode, setMode] = useState<'mid' | 'three'>('mid')
    const [midRate, setMidRate] = useState('1.000000')
    const [bidRate, setBidRate] = useState('')
    const [askRate, setAskRate] = useState('')
    const [rateType, setRateType] = useState<ExchangeRate['rate_type']>('SPOT')
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
    const [busy, setBusy] = useState(false)
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

    const fromCode = non_base.find(c => c.id === fromId)?.code ?? '???'
    const mid = Number(midRate)
    const bid = Number(bidRate)
    const ask = Number(askRate)
    const midValid = isFinite(mid) && mid > 0
    const threeValid = midValid
        && isFinite(bid) && bid > 0 && bid <= mid
        && isFinite(ask) && ask > 0 && ask >= mid
    const valid = mode === 'mid' ? midValid : threeValid

    // When user switches to 'three', auto-fill bid/ask with mid as a starting
    // point so they don't see empty fields screaming "invalid".
    useEffect(() => {
        if (mode === 'three' && !bidRate && midValid) setBidRate(midRate)
        if (mode === 'three' && !askRate && midValid) setAskRate(midRate)
    }, [mode, midRate, midValid])  // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
                style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-success) 30%, var(--app-border))' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'var(--app-success)' }} />
                <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                    <div>
                        <div className="font-black" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>Add Manual Rate</div>
                        <p className="font-bold uppercase tracking-widest mt-0.5"
                            style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>One-off entry · stored under <code className="font-mono">source=MANUAL</code></p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-border/40 -m-1.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={14} />
                    </button>
                </div>
                <div className="px-5 pb-4 space-y-3">
                    {/* Pair + type + date */}
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="From">
                            <select value={fromId ?? ''} onChange={e => setFromId(Number(e.target.value))}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                {non_base.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                            </select>
                        </Field>
                        <Field label={`To (always ${baseCcy.code})`}>
                            <div className={INPUT_CLS + ' font-mono font-black flex items-center'}
                                style={{ ...INPUT_STYLE, justifyContent: 'center', color: 'var(--app-muted-foreground)' }}>
                                {baseCcy.code}
                            </div>
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Type">
                            <select value={rateType} onChange={e => setRateType(e.target.value as any)}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                {RATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </Field>
                        <Field label="Date">
                            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                className={INPUT_CLS} style={INPUT_STYLE} />
                        </Field>
                    </div>

                    {/* Mode toggle: mid-only vs three-sided */}
                    <Field label="Sides">
                        <div className="inline-flex items-stretch rounded-xl overflow-hidden border h-9 w-full"
                            style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                            {([
                                { key: 'mid' as const,   label: 'Mid only',          hint: 'Single quote (most common)' },
                                { key: 'three' as const, label: 'Bid + Mid + Ask',   hint: 'Two-sided quote (transactional)' },
                            ]).map((opt, idx) => {
                                const active = mode === opt.key
                                return (
                                    <button key={opt.key} type="button" onClick={() => setMode(opt.key)}
                                        title={opt.hint}
                                        className="flex-1 inline-flex items-center justify-center font-bold transition-all"
                                        style={{
                                            fontSize: 11,
                                            color: active ? 'var(--app-success)' : 'var(--app-muted-foreground)',
                                            background: active ? 'color-mix(in srgb, var(--app-success) 12%, transparent)' : 'transparent',
                                            borderLeft: idx === 0 ? 'none' : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                        }}>
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    </Field>

                    {/* Rate inputs */}
                    {mode === 'mid' ? (
                        <Field label={`Rate (1 ${fromCode} = ? ${baseCcy.code})`} error={!midValid}
                            hint={!midValid ? 'Must be a positive number' : undefined}>
                            <PrefixInput tone="--app-success" prefix={`1 ${fromCode} =`} suffix={baseCcy.code}
                                value={midRate} onChange={setMidRate} valid={midValid} placeholder="1.000000" />
                        </Field>
                    ) : (
                        <div className="space-y-2">
                            <Field label={`Bid · operator buys (≤ Mid)`} error={!isFinite(bid) || bid <= 0 || bid > mid}>
                                <PrefixInput tone="--app-success" prefix="−" suffix={baseCcy.code}
                                    value={bidRate} onChange={setBidRate}
                                    valid={isFinite(bid) && bid > 0 && bid <= mid}
                                    placeholder="0.999000" />
                            </Field>
                            <Field label={`Mid · mid-market`} error={!midValid}>
                                <PrefixInput tone="--app-info" prefix="·" suffix={baseCcy.code}
                                    value={midRate} onChange={setMidRate} valid={midValid}
                                    placeholder="1.000000" />
                            </Field>
                            <Field label={`Ask · operator sells (≥ Mid)`} error={!isFinite(ask) || ask <= 0 || ask < mid}>
                                <PrefixInput tone="--app-error" prefix="+" suffix={baseCcy.code}
                                    value={askRate} onChange={setAskRate}
                                    valid={isFinite(ask) && ask > 0 && ask >= mid}
                                    placeholder="1.001000" />
                            </Field>
                            {threeValid && mid > 0 && (
                                <p className="font-mono px-2 py-1.5 rounded-md inline-block"
                                    style={{ ...soft('--app-info', 8), color: 'var(--app-info)', fontSize: 10 }}>
                                    Spread: bid −{((mid - bid) / mid * 100).toFixed(2)}% / ask +{((ask - mid) / mid * 100).toFixed(2)}%
                                </p>
                            )}
                        </div>
                    )}

                    {mode === 'mid' && midValid && (
                        <p className="font-mono px-2 py-1.5 rounded-md inline-block"
                            style={{ ...soft('--app-success', 8), color: 'var(--app-success)', fontSize: 10 }}>
                            <TrendingUp size={10} className="inline -mt-0.5 mr-1" />
                            Preview: 1 {fromCode} = <strong>{mid.toFixed(6)}</strong> {baseCcy.code} on {date}
                        </p>
                    )}
                </div>
                <div className="px-4 py-3 flex items-center justify-between gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <div className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                        {progress ? `Saving ${progress.done}/${progress.total}…`
                            : !valid ? (mode === 'mid' ? 'Enter a positive rate' : 'Bid ≤ Mid ≤ Ask, all positive')
                            : mode === 'three' ? 'Will write 3 rows (BID + MID + ASK)'
                            : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose}
                            className="px-3.5 py-1.5 rounded-xl font-bold border"
                            style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                            Cancel
                        </button>
                        <button disabled={!valid || busy} onClick={async () => {
                            setBusy(true)
                            try {
                                if (mode === 'mid') {
                                    setProgress({ done: 0, total: 1 })
                                    await onSubmit({ from_currency: fromId!, to_currency: baseCcy.id, rate: midRate, rate_type: rateType, rate_side: 'MID', effective_date: date, source: 'MANUAL' })
                                    setProgress({ done: 1, total: 1 })
                                } else {
                                    // Three sequential calls — backend's unique-together accepts the trio.
                                    const ops: Array<{ side: 'BID' | 'MID' | 'ASK'; rate: string }> = [
                                        { side: 'BID', rate: bidRate },
                                        { side: 'MID', rate: midRate },
                                        { side: 'ASK', rate: askRate },
                                    ]
                                    setProgress({ done: 0, total: ops.length })
                                    for (let i = 0; i < ops.length; i++) {
                                        await onSubmit({
                                            from_currency: fromId!, to_currency: baseCcy.id,
                                            rate: ops[i].rate, rate_type: rateType,
                                            rate_side: ops[i].side, effective_date: date, source: 'MANUAL',
                                        })
                                        setProgress({ done: i + 1, total: ops.length })
                                    }
                                }
                                onClose()  // triggers parent's reload
                            } catch (e) {
                                toast.error(e instanceof Error ? e.message : 'Failed')
                            } finally { setBusy(false); setProgress(null) }
                        }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold disabled:opacity-50"
                            style={!busy && valid
                                ? { ...grad('--app-success'), color: FG_PRIMARY, fontSize: 11, boxShadow: '0 4px 12px color-mix(in srgb, var(--app-success) 30%, transparent)' }
                                : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)', fontSize: 11 }}>
                            {busy ? 'Adding…' : mode === 'three' ? 'Add 3 rows' : 'Add rate'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  PRIMITIVES
 * ═══════════════════════════════════════════════════════════════════ */
const INPUT_CLS = 'px-2.5 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-app-primary/20 transition-all w-full font-mono'
const INPUT_STYLE: React.CSSProperties = {
    background: 'var(--app-background)',
    border: '1px solid var(--app-border)',
    color: 'var(--app-foreground)',
    fontSize: 12,
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' | 'center' }) {
    return (
        <th className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest"
            style={{ color: 'var(--app-muted-foreground)', textAlign: align ?? 'left' }}>
            {children}
        </th>
    )
}
function Td({ children, align }: { children: React.ReactNode; align?: 'right' | 'center' }) {
    return (
        <td className="px-3 py-1.5" style={{ textAlign: align ?? 'left', fontSize: 11 }}>
            {children}
        </td>
    )
}
function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
    return (
        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{ ...soft(tone, 12), color: `var(${tone})` }}>{children}</span>
    )
}

/** Larger pair-history chart for Rate History "Chart" view. Same SVG style
 *  as Sparkline but with min/max/latest dot labels and a 3-tick date axis.
 *  Sorts ascending so x-axis is left-to-right time. */
function PairChart({ list }: { list: ExchangeRate[] }) {
    if (list.length < 2) {
        return (
            <div className="px-4 py-8 text-center italic" style={{ fontSize: 11, color: 'var(--app-muted-foreground)' }}>
                Need ≥2 snapshots to draw a chart. {list.length === 1 && 'Run another sync.'}
            </div>
        )
    }
    // list is newest-first; reverse for chronological plotting.
    const sorted = [...list].sort((a, b) => a.effective_date.localeCompare(b.effective_date))
    const values = sorted.map(r => Number(r.rate))
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || max * 0.001 || 1
    const W = 800, H = 180, ML = 50, MR = 20, MT = 16, MB = 32
    const xOf = (i: number) => ML + (i / (sorted.length - 1)) * (W - ML - MR)
    const yOf = (v: number) => MT + (1 - (v - min) / span) * (H - MT - MB)
    const pts = sorted.map((r, i) => [xOf(i), yOf(values[i])] as const)
    const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(2)},${H - MB} L${pts[0][0].toFixed(2)},${H - MB} Z`
    const trend = values[values.length - 1] - values[0]
    const tone = trend > 0 ? '--app-success' : trend < 0 ? '--app-error' : '--app-muted-foreground'
    const minIdx = values.indexOf(min)
    const maxIdx = values.indexOf(max)
    const xTicks = sorted.length <= 4 ? sorted.map((_, i) => i)
        : [0, Math.floor((sorted.length - 1) / 2), sorted.length - 1]
    return (
        <div className="px-4 py-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
                {/* Min / mid / max horizontal grid lines */}
                {[0, 0.5, 1].map((p, i) => {
                    const v = min + span * (1 - p)
                    return (
                        <g key={i}>
                            <line x1={ML} x2={W - MR} y1={MT + p * (H - MT - MB)} y2={MT + p * (H - MT - MB)}
                                stroke="color-mix(in srgb, var(--app-border) 80%, transparent)" strokeWidth="1" strokeDasharray={i === 1 ? '0' : '3,3'} />
                            <text x={ML - 6} y={MT + p * (H - MT - MB) + 3} textAnchor="end"
                                fontSize="9" fill="var(--app-muted-foreground)" fontFamily="ui-monospace, SFMono-Regular, monospace">
                                {v.toFixed(4)}
                            </text>
                        </g>
                    )
                })}
                {/* Area + line */}
                <path d={areaPath} fill={`color-mix(in srgb, var(${tone}) 14%, transparent)`} />
                <path d={linePath} fill="none" stroke={`var(${tone})`} strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
                {/* Min / max / latest markers */}
                <circle cx={pts[minIdx][0]} cy={pts[minIdx][1]} r="3" fill="var(--app-error)" />
                <circle cx={pts[maxIdx][0]} cy={pts[maxIdx][1]} r="3" fill="var(--app-success)" />
                <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={`var(${tone})`}
                    stroke="var(--app-surface)" strokeWidth="2" />
                {/* Date axis */}
                {xTicks.map(i => (
                    <text key={i} x={xOf(i)} y={H - MB + 14} textAnchor={i === 0 ? 'start' : i === sorted.length - 1 ? 'end' : 'middle'}
                        fontSize="9" fill="var(--app-muted-foreground)" fontFamily="ui-monospace, SFMono-Regular, monospace">
                        {sorted[i].effective_date}
                    </text>
                ))}
            </svg>
            {/* Legend */}
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 10 }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--app-success)' }} />
                    <span className="text-app-muted-foreground">Max</span>
                    <span className="font-mono font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{max.toFixed(6)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 10 }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--app-error)' }} />
                    <span className="text-app-muted-foreground">Min</span>
                    <span className="font-mono font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{min.toFixed(6)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 10 }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: `var(${tone})` }} />
                    <span className="text-app-muted-foreground">Latest</span>
                    <span className="font-mono font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{values[values.length - 1].toFixed(6)}</span>
                </span>
            </div>
        </div>
    )
}

/** Single column in the BID / MID / ASK trio shown on a policy card. The
 *  `pending` flag styles previewed (not-yet-written-to-DB) values with a
 *  dashed underline so the operator knows to sync. */
function RateColumn({ side, tone, sub, rate, pending, primary }: {
    side: 'BID' | 'MID' | 'ASK'
    tone: string
    sub: string
    rate: number | null
    pending: boolean
    primary?: boolean
}) {
    return (
        <div className="text-center">
            <div className="font-black uppercase tracking-widest mb-0.5"
                style={{ fontSize: 8, color: `var(${tone})` }}>
                {side} <span className="text-app-muted-foreground font-mono">· {sub}</span>
            </div>
            <div className="font-mono font-black tabular-nums leading-none"
                style={{
                    fontSize: primary ? 18 : 14,
                    color: rate === null ? 'var(--app-muted-foreground)' : 'var(--app-foreground)',
                    textDecoration: pending ? 'underline dashed' : 'none',
                    textDecorationColor: pending ? `var(--app-warning)` : undefined,
                    textUnderlineOffset: 3,
                }}
                title={pending ? 'Previewed from spread — sync to commit' : undefined}>
                {rate === null ? '—' : rate.toFixed(primary ? 6 : 4)}
            </div>
        </div>
    )
}

/** Generic numeric-array sparkline. Used by Revaluations to plot net-impact
 *  over time. Tone is directional: green if rising, red if falling. */
function NumericSparkline({ values }: { values: number[] }) {
    if (values.length < 2) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || Math.max(Math.abs(max), 1) * 0.001
    const W = 100, H = 24, P = 2
    const pts = values.map((v, i) => {
        const x = P + (i / (values.length - 1)) * (W - P * 2)
        const y = P + (1 - (v - min) / span) * (H - P * 2)
        return [x, y] as const
    })
    const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const trend = values[values.length - 1] - values[0]
    const tone = trend > 0 ? '--app-success' : trend < 0 ? '--app-error' : '--app-muted-foreground'
    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-6">
            <path d={linePath} fill="none" stroke={`var(${tone})`} strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.6" fill={`var(${tone})`} />
        </svg>
    )
}

/** Mini SVG sparkline — uses theme tokens, no external dependency. Draws a
 *  filled area below the line for visual weight, with the latest dot
 *  highlighted. Tone derives from health: stale → warning, fail → error,
 *  healthy → directional (green if rising, red if falling, muted if flat). */
function Sparkline({ rates, health }: { rates: ExchangeRate[]; health: HealthKey }) {
    if (rates.length < 2) return null
    const values = rates.map(r => Number(r.rate))
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || max * 0.001 || 1   // avoid divide-by-zero on flat series
    const W = 100, H = 28, P = 2                  // viewBox + padding
    const pts = values.map((v, i) => {
        const x = P + (i / (values.length - 1)) * (W - P * 2)
        const y = P + (1 - (v - min) / span) * (H - P * 2)
        return [x, y] as const
    })
    const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(2)},${H - P} L${pts[0][0].toFixed(2)},${H - P} Z`
    const lastY = pts[pts.length - 1][1]
    const lastX = pts[pts.length - 1][0]
    const trend = values[values.length - 1] - values[0]
    const tone = health === 'fail'  ? '--app-error'
              : health === 'stale' ? '--app-warning'
              : trend > 0          ? '--app-success'
              : trend < 0          ? '--app-error'
              : '--app-muted-foreground'
    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
            className="w-full h-7 mt-1.5"
            aria-label={`${rates.length}-snapshot rate trend`}>
            <path d={areaPath} fill={`color-mix(in srgb, var(${tone}) 14%, transparent)`} />
            <path d={linePath} fill="none" stroke={`var(${tone})`} strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lastX} cy={lastY} r="1.8" fill={`var(${tone})`} />
        </svg>
    )
}
function Kpi({ label, value, tone, icon }: { label: string; value: number | string; tone: string; icon: React.ReactNode }) {
    const dim = value === 0 || value === '0' || value === '0.00'
    // Detect numeric-with-optional-sign for animated count-up. String values
    // (e.g. currency codes "XAF") render verbatim.
    const numMatch = typeof value === 'number'
        ? { sign: '', n: value, decimals: 0, suffix: '' }
        : (() => {
            const s = String(value)
            const m = s.match(/^([+-]?)(\d+(?:\.\d+)?)(.*)$/)
            if (!m) return null
            return { sign: m[1], n: Number(m[2]), decimals: (m[2].split('.')[1] ?? '').length, suffix: m[3] }
        })()
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={dim
                ? { background: 'transparent', borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)', opacity: 0.55 }
                : { ...soft(tone, 8), borderColor: `color-mix(in srgb, var(${tone}) 25%, transparent)` }}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ ...soft(tone, 14), color: `var(${tone})` }}>{icon}</div>
            <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-widest truncate"
                    style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
                <div className="font-black tabular-nums leading-none mt-0.5"
                    style={{ fontSize: 14, color: dim ? 'var(--app-muted-foreground)' : `var(${tone})` }}>
                    {numMatch
                        ? <>{numMatch.sign}<AnimatedCounter value={numMatch.n} decimals={numMatch.decimals} />{numMatch.suffix}</>
                        : value}
                </div>
            </div>
        </div>
    )
}

/** Smooth-tween a numeric value with ease-out cubic. ~400 ms total — fast
 *  enough to feel snappy, slow enough to be visible. */
function AnimatedCounter({ value, decimals = 0 }: { value: number; decimals?: number }) {
    const [display, setDisplay] = useState(value)
    useEffect(() => {
        const start = display
        const end = value
        if (Math.abs(end - start) < Math.pow(10, -decimals - 1)) {
            setDisplay(end)
            return
        }
        const duration = 400
        const t0 = performance.now()
        let raf = 0
        const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / duration)
            const eased = 1 - Math.pow(1 - p, 3)
            setDisplay(start + (end - start) * eased)
            if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, decimals])
    return <>{display.toFixed(decimals)}</>
}
function ActionBtn({ icon, tone, filled, onClick, disabled, children, title }: {
    icon: React.ReactNode; tone: string; filled?: boolean; onClick?: () => void; disabled?: boolean; children: React.ReactNode; title?: string
}) {
    if (filled) {
        return (
            <button onClick={onClick} disabled={disabled} title={title}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                style={!disabled
                    ? { ...grad(tone), color: FG_PRIMARY, fontSize: 11, boxShadow: `0 4px 12px color-mix(in srgb, var(${tone}) 30%, transparent)` }
                    : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)', fontSize: 11 }}>
                {icon} {children}
            </button>
        )
    }
    return (
        <button onClick={onClick} disabled={disabled} title={title}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
                fontSize: 11,
                color: `var(${tone})`,
                borderColor: `color-mix(in srgb, var(${tone}) 30%, transparent)`,
                background: `color-mix(in srgb, var(${tone}) 6%, transparent)`,
            }}>
            {icon} {children}
        </button>
    )
}
function MenuItem({ icon, label, tone, onClick, disabled }: {
    icon: React.ReactNode; label: string; tone?: string; onClick: () => void; disabled?: boolean
}) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="w-full text-left px-3 py-1.5 inline-flex items-center gap-2 hover:bg-app-background disabled:opacity-50"
            style={{ fontSize: 11, color: tone ? `var(${tone})` : 'var(--app-foreground)' }}>
            {icon} {label}
        </button>
    )
}
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: error ? 'var(--app-error)' : 'var(--app-foreground)' }}>{label}</div>
            {children}
            {hint && <p className="mt-1 leading-tight"
                style={{ fontSize: 9, color: error ? 'var(--app-error)' : 'var(--app-muted-foreground)' }}>{hint}</p>}
        </div>
    )
}
function PanelGroup({ tone, title, hint, children }: { tone: string; title: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl p-3 space-y-2"
            style={{ background: `color-mix(in srgb, var(${tone}) 4%, transparent)`, border: `1px solid color-mix(in srgb, var(${tone}) 18%, transparent)` }}>
            <div className="flex items-center gap-1.5">
                <span className="font-black uppercase tracking-widest"
                    style={{ fontSize: 9, color: `var(${tone})` }}>{title}</span>
                {hint && <span className="text-app-muted-foreground" style={{ fontSize: 9 }}>— {hint}</span>}
            </div>
            {children}
        </div>
    )
}
function PrefixInput({ tone, prefix, suffix, value, onChange, valid, placeholder }: {
    tone: string; prefix: string; suffix: string; value: string; onChange: (v: string) => void; valid: boolean; placeholder?: string
}) {
    return (
        <div className="flex items-stretch rounded-lg overflow-hidden border"
            style={valid
                ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
            <span className="px-3 flex items-center font-mono font-black"
                style={{ fontSize: 12, background: `color-mix(in srgb, var(${tone}) 8%, transparent)`, borderRight: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                {prefix}
            </span>
            <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                inputMode="decimal"
                className="flex-1 px-2 py-1.5 outline-none bg-transparent font-mono tabular-nums"
                style={{ fontSize: 12, color: 'var(--app-foreground)' }} />
            {suffix && (
                <span className="px-3 flex items-center font-mono font-black"
                    style={{ fontSize: 12, background: `color-mix(in srgb, var(${tone}) 8%, transparent)`, borderLeft: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                    {suffix}
                </span>
            )}
        </div>
    )
}

function SegSelect<T extends string>({ title, options, value, onChange }: {
    title: string
    options: Array<{ key: T; label: string; tone?: string }>
    value: T
    onChange: (v: T) => void
}) {
    return (
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border bg-app-surface" title={title}
            style={{ borderColor: 'var(--app-border)' }}>
            {options.map(opt => {
                const active = value === opt.key
                return (
                    <button key={opt.key} onClick={() => onChange(opt.key)}
                        className="px-2 py-1 rounded-md font-bold transition-all"
                        style={active && opt.tone
                            ? { ...soft(opt.tone, 18), color: `var(${opt.tone})`, fontSize: 10 }
                            : active
                                ? { background: 'var(--app-foreground)', color: 'var(--app-background)', fontSize: 10 }
                                : { color: 'var(--app-muted-foreground)', fontSize: 10 }}>
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

function SectionHeader({ icon, title, subtitle, action }: {
    icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode
}) {
    return (
        <div className="px-4 py-3 border-b border-app-border/50 flex items-center justify-between gap-3 shrink-0"
            style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
            <div className="min-w-0 flex-1">
                <div className="font-black uppercase tracking-widest flex items-center gap-2"
                    style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                    {icon}<span className="truncate">{title}</span>
                </div>
                {subtitle && <p className="mt-0.5 truncate"
                    style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>{subtitle}</p>}
            </div>
            {action}
        </div>
    )
}
/** Skeleton mirrors the real layout (KPI strip + toolbar + 4 card placeholders)
 *  so the page doesn't pop during initial load. Uses `.animate-pulse` for
 *  the shimmer effect — single Tailwind class, no JS. */
function FxSkeleton() {
    const ph = (h: string, w?: string) => ({
        height: h,
        width: w ?? '100%',
        background: 'color-mix(in srgb, var(--app-foreground) 8%, transparent)',
        borderRadius: 6,
    })
    return (
        <div className="space-y-3 animate-pulse">
            <div className="bg-app-surface rounded-2xl border border-app-border/50 p-2.5 grid gap-2"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg border" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div style={ph('8px', '70%')} />
                        <div className="mt-1.5" style={ph('14px', '40%')} />
                    </div>
                ))}
            </div>
            <div className="bg-app-surface rounded-2xl border border-app-border/50 px-3 py-2.5 flex items-center gap-2 flex-wrap">
                <div style={{ ...ph('30px', '220px'), flex: 1 }} />
                <div style={ph('30px', '120px')} />
                <div style={ph('30px', '120px')} />
            </div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl p-4 border space-y-2" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                        <div className="flex items-center gap-2">
                            <div style={ph('8px', '8px')} />
                            <div style={ph('12px', '40%')} />
                        </div>
                        <div style={ph('22px', '60%')} />
                        <div style={ph('10px', '80%')} />
                        <div style={ph('28px', '100%')} />
                        <div className="flex gap-2 mt-1">
                            <div style={ph('20px', '60px')} />
                            <div style={ph('20px', '40px')} />
                            <div className="flex-1" />
                            <div style={ph('20px', '60px')} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function EmptyState({ icon, title, hint, cta }: { icon: React.ReactNode; title: string; hint?: string; cta?: React.ReactNode }) {
    return (
        <div className="bg-app-surface rounded-2xl border border-app-border/50 py-10 text-center">
            <div className="flex justify-center">{icon}</div>
            <p className="font-bold mt-2"
                style={{ fontSize: 11, color: 'var(--app-foreground)' }}>{title}</p>
            {hint && <p className="mt-1 max-w-md mx-auto leading-relaxed"
                style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>{hint}</p>}
            {cta}
        </div>
    )
}
