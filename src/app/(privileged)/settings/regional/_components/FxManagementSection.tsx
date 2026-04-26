'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
    Coins, RefreshCcw, Plus, ShieldCheck, ShieldAlert,
    TrendingUp, TrendingDown, Play,
} from 'lucide-react'
import {
    getCurrencies, getExchangeRates, getRevaluations,
    createExchangeRate, runRevaluation,
    getRatePolicies, createRatePolicy, updateRatePolicy, syncRatePolicy, syncAllRatePolicies,
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

export function FxManagementSection({ view, hideHeader }: {
    /** When set, renders only that sub-view (no internal tab strip).
     *  Used when this component is mounted inside the Currencies tab as
     *  an embedded sub-tab — the parent tab strip already provides nav. */
    view?: FxView;
    /** When true, suppress the internal "FX & Rates" header card too —
     *  use when the parent already shows context. */
    hideHeader?: boolean;
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

    // Quick-add forms
    const [newRateOpen, setNewRateOpen] = useState(false)
    const [newPolicyOpen, setNewPolicyOpen] = useState(false)

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
        try {
            const res = await syncAllRatePolicies()
            if (!res.success) { toast.error(res.error || 'Sync-all failed'); return }
            const ok = (res.results ?? []).filter(r => r.ok).length
            const fail = (res.results ?? []).filter(r => !r.ok).length
            toast.success(`Synced ${ok} policy${ok === 1 ? '' : 'ies'}${fail > 0 ? `, ${fail} failed` : ''}`)
            await loadAll()
        } finally {
            setSyncingAll(false)
        }
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
            {/* ── Section header — same rhythm as the regional page chrome ── */}
            <div className="bg-app-surface rounded-2xl border border-app-border/50 px-4 py-3 flex items-center justify-between flex-wrap gap-3"
                 style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0" style={grad('--app-success')}>
                        <Coins size={14} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-app-foreground">FX & Rates</h2>
                        <p className="text-[9px] text-app-muted-foreground mt-0.5">
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

            {/* ── Sub-tab pill strip — matches parent regional tab style ── */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-app-surface border border-app-border/50">
                {SUB_TABS.map(t => {
                    const Icon = t.icon
                    const active = tab === t.key
                    const n = subCounts[t.key]
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all duration-200 ${active ? 'text-white shadow-md' : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-background'}`}
                            style={active ? grad(t.color) : {}}>
                            <Icon size={12} /> {t.label}
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${active ? 'bg-white/20' : 'bg-app-background'} tabular-nums`}>{n}</span>
                        </button>
                    )
                })}
            </div>

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
                                disabled={currencies.length < 2 || !baseCurrency}
                                title={!baseCurrency
                                    ? 'Set a base in the Currencies tab first'
                                    : currencies.length < 2
                                        ? 'Enable a non-base currency in the Currencies tab first'
                                        : 'Add a new rate row'}
                                onClick={() => {
                                    if (!baseCurrency) { toast.error('Set a base currency first — Currencies tab → ⭐'); return }
                                    if (currencies.length < 2) { toast.error('Enable at least one non-base currency in the Currencies tab.'); return }
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
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                        {ratesByPair.length === 0 ? (
                            <EmptyState
                                icon={<TrendingUp size={24} className="text-app-muted-foreground opacity-20" />}
                                title="No rates on file"
                                hint="Click New Rate to enter your first one — or set up Auto-Sync to fetch them automatically."
                            />
                        ) : ratesByPair.map(({ pair, list }) => (
                            <div key={pair} className="rounded-lg border border-app-border/50 overflow-hidden">
                                <div className="px-3 py-2 flex items-center gap-2"
                                     style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                    <span className="text-[12px] font-black font-mono text-app-foreground">{pair}</span>
                                    <span className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest">{list.length} rate{list.length === 1 ? '' : 's'}</span>
                                </div>
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 30%, transparent)' }}>
                                            <th className="px-3 py-1.5 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Date</th>
                                            <th className="px-3 py-1.5 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Type</th>
                                            <th className="px-3 py-1.5 text-right text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Rate</th>
                                            <th className="px-3 py-1.5 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Source</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {list.slice(0, 10).map(r => (
                                            <tr key={r.id} className="border-t border-app-border/30">
                                                <td className="px-3 py-1.5 text-[11px] font-mono text-app-foreground">{r.effective_date}</td>
                                                <td className="px-3 py-1.5">
                                                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                                        style={{ ...soft('--app-info', 12), color: 'var(--app-info)' }}>
                                                        {r.rate_type}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-right text-[11px] font-mono font-black tabular-nums text-app-foreground">{Number(r.rate).toFixed(6)}</td>
                                                <td className="px-3 py-1.5 text-[10px] font-mono text-app-muted-foreground">{r.source ?? '—'}</td>
                                            </tr>
                                        ))}
                                        {list.length > 10 && (
                                            <tr><td colSpan={4} className="px-3 py-1.5 text-[10px] text-app-muted-foreground text-center">… {list.length - 10} older row(s)</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Auto-Sync (policies) tab ──────────────────────────── */}
            {tab === 'policies' && (
                <div className="bg-app-surface rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
                    <SectionHeader
                        icon={<RefreshCcw size={13} style={{ color: 'var(--app-info)' }} />}
                        title="Auto-Sync Policies"
                        subtitle="One policy per pair · provider + multiplier + markup. Daily cron refreshes auto-sync rows."
                        action={
                            <div className="flex items-center gap-2">
                                <button onClick={handleSyncAll} disabled={syncingAll || policies.length === 0}
                                    title="Sync every active non-MANUAL policy now"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-app-border/50 hover:bg-app-background transition-all disabled:opacity-50"
                                    style={{ color: 'var(--app-info)' }}>
                                    <RefreshCcw size={11} className={syncingAll ? 'animate-spin' : ''} />
                                    {syncingAll ? 'Syncing…' : 'Sync All'}
                                </button>
                                <PrimaryButton
                                    colorVar="--app-info"
                                    disabled={currencies.length < 2 || !baseCurrency}
                                    title={!baseCurrency
                                        ? 'Set a base in the Currencies tab first'
                                        : currencies.length < 2
                                            ? 'Enable a non-base currency in the Currencies tab first'
                                            : 'Configure a new auto-sync pair'}
                                    onClick={() => {
                                        if (!baseCurrency) { toast.error('Set a base currency first — Currencies tab → ⭐'); return }
                                        if (currencies.length < 2) { toast.error('Enable at least one non-base currency in the Currencies tab.'); return }
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
                        {policies.length === 0 ? (
                            <EmptyState
                                icon={<RefreshCcw size={24} className="text-app-muted-foreground opacity-20" />}
                                title="No policies yet"
                                hint="Click New Policy to wire ECB (free, no API key) into a currency pair, with an optional spread multiplier."
                            />
                        ) : (
                            <div className="rounded-lg border border-app-border/50 overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                            <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Pair</th>
                                            <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Type</th>
                                            <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Provider</th>
                                            <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">×</th>
                                            <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">+ %</th>
                                            <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Auto</th>
                                            <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Last sync</th>
                                            <th className="px-3 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {policies.map(p => (
                                            <tr key={p.id} className="border-t border-app-border/30 hover:bg-app-background/40 transition-colors">
                                                <td className="px-3 py-2 text-[12px] font-black font-mono text-app-foreground">{p.from_code}→{p.to_code}</td>
                                                <td className="px-3 py-2">
                                                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                                        style={{ ...soft('--app-info', 12), color: 'var(--app-info)' }}>
                                                        {p.rate_type}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-app-foreground">{p.provider}</td>
                                                <td className="px-3 py-2 text-right text-[11px] font-mono tabular-nums text-app-foreground">{Number(p.multiplier).toFixed(4)}</td>
                                                <td className="px-3 py-2 text-right text-[11px] font-mono tabular-nums text-app-foreground">{Number(p.markup_pct).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <button onClick={async () => {
                                                        const r = await updateRatePolicy(p.id, { auto_sync: !p.auto_sync })
                                                        if (!r.success) toast.error(r.error || 'Update failed')
                                                        await loadAll()
                                                    }}
                                                        title={p.auto_sync ? 'Disable daily auto-sync' : 'Enable daily auto-sync'}
                                                        className="w-9 h-4 rounded-full relative transition-all mx-auto block"
                                                        style={{ background: p.auto_sync ? 'var(--app-info)' : 'var(--app-border)' }}>
                                                        <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all shadow ${p.auto_sync ? 'left-[22px]' : 'left-0.5'}`} />
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2 text-[10px]">
                                                    {p.last_synced_at
                                                        ? <SyncStatusBadge status={p.last_sync_status} when={p.last_synced_at} error={p.last_sync_error} />
                                                        : <span className="text-app-muted-foreground">never</span>}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <button onClick={() => handleSyncPolicy(p.id)}
                                                        disabled={syncingId === p.id || p.provider === 'MANUAL'}
                                                        title={p.provider === 'MANUAL' ? 'MANUAL provider cannot be synced' : 'Fetch fresh rate from provider'}
                                                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border border-app-border/50 hover:bg-app-background ml-auto transition-colors disabled:opacity-50"
                                                        style={{ color: 'var(--app-info)' }}>
                                                        <RefreshCcw size={11} className={syncingId === p.id ? 'animate-spin' : ''} />
                                                        {syncingId === p.id ? 'Syncing…' : 'Sync Now'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
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
            <div className="min-w-0">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-app-foreground flex items-center gap-2">
                    {icon}{title}
                </h3>
                {subtitle && <p className="text-[9px] text-app-muted-foreground mt-0.5">{subtitle}</p>}
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={!disabled
                ? { ...grad(colorVar), boxShadow: `0 4px 12px color-mix(in srgb, var(${colorVar}) 30%, transparent)` }
                : { background: 'var(--app-border)' }}>
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
    const [rate, setRate] = useState('1.00')
    const [rateType, setRateType] = useState<ExchangeRate['rate_type']>('SPOT')
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
    const [busy, setBusy] = useState(false)
    if (!fromId) return (
        <p className="text-[10px] text-app-muted-foreground">Add a non-base currency in the Currencies tab before entering rates.</p>
    )
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <TrendingUp size={11} style={{ color: 'var(--app-success)' }} />
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success)' }}>New Exchange Rate</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
                <FieldLabel label="From">
                    <select value={fromId} onChange={e => setFromId(Number(e.target.value))} className={INPUT_CLS} style={INPUT_STYLE}>
                        {non_base.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                    </select>
                </FieldLabel>
                <div className="self-end pb-2 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">→</span>
                    <div className="text-[12px] font-mono font-black text-app-foreground">{base.code}</div>
                </div>
                <FieldLabel label="Rate">
                    <input value={rate} onChange={e => setRate(e.target.value)} placeholder="1.10"
                        className={INPUT_CLS + ' font-mono tabular-nums'} style={INPUT_STYLE} />
                </FieldLabel>
                <FieldLabel label="Type">
                    <select value={rateType} onChange={e => setRateType(e.target.value as ExchangeRate['rate_type'])} className={INPUT_CLS} style={INPUT_STYLE}>
                        {RATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </FieldLabel>
                <FieldLabel label="Date">
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE} />
                </FieldLabel>
            </div>
            <div className="flex items-center gap-2 justify-end">
                <button onClick={onCancel} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border/50 hover:bg-app-background transition-colors"
                    style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                <button disabled={!rate || busy} onClick={async () => {
                    setBusy(true)
                    try {
                        await onSubmit({ from_currency: fromId!, to_currency: base.id, rate, rate_type: rateType, effective_date: date, source: 'MANUAL' })
                    } finally { setBusy(false) }
                }}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 transition-all"
                    style={!busy && rate
                        ? { ...grad('--app-success'), boxShadow: '0 4px 12px color-mix(in srgb, var(--app-success) 30%, transparent)' }
                        : { background: 'var(--app-border)' }}>
                    {busy ? 'Adding…' : 'Add Rate'}
                </button>
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

function NewPolicyForm({ currencies, base, onCancel, onSubmit }: {
    currencies: Currency[]
    base: Currency
    onCancel: () => void
    onSubmit: (p: {
        from_currency: number
        to_currency: number
        rate_type: CurrencyRatePolicy['rate_type']
        provider: CurrencyRatePolicy['provider']
        auto_sync: boolean
        multiplier: string
        markup_pct: string
    }) => Promise<void>
}) {
    const non_base = currencies.filter(c => c.id !== base.id && c.is_active)
    const [fromId, setFromId] = useState<number | null>(non_base[0]?.id ?? null)
    const [provider, setProvider] = useState<CurrencyRatePolicy['provider']>('ECB')
    const [rateType, setRateType] = useState<CurrencyRatePolicy['rate_type']>('SPOT')
    const [multiplier, setMultiplier] = useState('1.000000')
    const [markupPct, setMarkupPct] = useState('0.0000')
    const [autoSync, setAutoSync] = useState(true)
    const [busy, setBusy] = useState(false)
    if (!fromId) return <p className="text-[10px] text-app-muted-foreground">Add a non-base currency in the Currencies tab before creating a policy.</p>
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
                <FieldLabel label="Provider">
                    <select value={provider} onChange={e => setProvider(e.target.value as CurrencyRatePolicy['provider'])} className={INPUT_CLS} style={INPUT_STYLE}>
                        <option value="ECB">ECB (free)</option>
                        <option value="MANUAL">MANUAL</option>
                        <option value="FIXER">FIXER (todo)</option>
                        <option value="OPENEXCHANGERATES">OXR (todo)</option>
                    </select>
                </FieldLabel>
                <FieldLabel label="× Multiplier">
                    <input value={multiplier} onChange={e => setMultiplier(e.target.value)} placeholder="1.000000"
                        title="Multiplier — e.g. 1.035 for a 3.5% spread above the official rate"
                        className={INPUT_CLS + ' font-mono tabular-nums'} style={INPUT_STYLE} />
                </FieldLabel>
                <FieldLabel label="+ Markup %">
                    <input value={markupPct} onChange={e => setMarkupPct(e.target.value)} placeholder="0.0000"
                        title="Markup percent — applied AFTER multiplier"
                        className={INPUT_CLS + ' font-mono tabular-nums'} style={INPUT_STYLE} />
                </FieldLabel>
            </div>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-app-border/30">
                <label className="flex items-center gap-2 text-[10px] font-bold cursor-pointer text-app-foreground">
                    <input type="checkbox" checked={autoSync} onChange={e => setAutoSync(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-app-info" />
                    Run on daily cron (auto-sync)
                </label>
                <div className="flex items-center gap-2">
                    <button onClick={onCancel} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border/50 hover:bg-app-background transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button disabled={busy} onClick={async () => {
                        setBusy(true)
                        try {
                            await onSubmit({ from_currency: fromId!, to_currency: base.id, rate_type: rateType, provider, auto_sync: autoSync, multiplier, markup_pct: markupPct })
                        } finally { setBusy(false) }
                    }}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 transition-all"
                        style={!busy
                            ? { ...grad('--app-info'), boxShadow: '0 4px 12px color-mix(in srgb, var(--app-info) 30%, transparent)' }
                            : { background: 'var(--app-border)' }}>
                        {busy ? 'Creating…' : 'Create Policy'}
                    </button>
                </div>
            </div>
        </div>
    )
}
