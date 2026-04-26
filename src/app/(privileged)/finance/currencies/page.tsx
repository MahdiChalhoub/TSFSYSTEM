'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
    Coins, RefreshCcw, Plus, ShieldCheck, ShieldAlert,
    TrendingUp, TrendingDown, Minus, Play,
} from 'lucide-react'
import {
    getCurrencies, getExchangeRates, getRevaluations,
    createCurrency, createExchangeRate, runRevaluation,
    type Currency, type ExchangeRate, type CurrencyRevaluation,
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

export default function CurrenciesPage() {
    const [tab, setTab] = useState<'currencies' | 'rates' | 'revaluations'>('currencies')
    const [currencies, setCurrencies] = useState<Currency[]>([])
    const [rates, setRates] = useState<ExchangeRate[]>([])
    const [revals, setRevals] = useState<CurrencyRevaluation[]>([])
    const [years, setYears] = useState<FiscalYear[]>([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState<number | null>(null)

    // Quick-add forms
    const [newCcyOpen, setNewCcyOpen] = useState(false)
    const [newRateOpen, setNewRateOpen] = useState(false)

    useEffect(() => { void loadAll() }, [])

    async function loadAll() {
        setLoading(true)
        try {
            const [cs, rs, vs, ys] = await Promise.all([
                getCurrencies(),
                getExchangeRates(),
                getRevaluations(),
                erpFetch('fiscal-years/').then((r: any) => Array.isArray(r) ? r : (r?.results ?? [])),
            ])
            setCurrencies(cs)
            setRates(rs)
            setRevals(vs)
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

    if (loading) {
        return <div className="p-6 text-app-muted-foreground">Loading…</div>
    }

    return (
        <div className="p-4 md:p-6 space-y-4 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Coins size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-app-foreground tracking-tight">Currencies & FX</h1>
                        <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">
                            Multi-currency · Exchange Rates · Revaluation
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <BasePill base={baseCurrency} />
                    <button onClick={() => loadAll()}
                        title="Refresh"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-tp-sm font-bold transition-all hover:bg-app-surface"
                        style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                        <RefreshCcw size={13} />
                    </button>
                </div>
            </div>

            {/* Tab strip */}
            <div className="flex items-center gap-1.5 border-b" style={{ borderColor: 'var(--app-border)' }}>
                {([
                    ['currencies', `Currencies · ${currencies.length}`],
                    ['rates', `Rates · ${rates.length}`],
                    ['revaluations', `Revaluations · ${revals.length}`],
                ] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setTab(k)}
                        className="text-tp-sm font-bold px-3 py-2 transition-all"
                        style={{
                            color: tab === k ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                            borderBottom: `2px solid ${tab === k ? 'var(--app-primary)' : 'transparent'}`,
                        }}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Currencies tab */}
            {tab === 'currencies' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-tp-sm text-app-muted-foreground">Currencies your books recognize. Exactly one is the base.</p>
                        <button onClick={() => setNewCcyOpen(true)}
                            className="flex items-center gap-1.5 text-tp-sm font-bold bg-app-primary text-white px-3 py-1.5 rounded-xl">
                            <Plus size={13} /> New Currency
                        </button>
                    </div>
                    {newCcyOpen && (
                        <NewCurrencyForm
                            onCancel={() => setNewCcyOpen(false)}
                            onSubmit={async (payload) => {
                                const r = await createCurrency(payload)
                                if (!r.success) { toast.error(r.error || 'Create failed'); return }
                                toast.success(`Added ${payload.code}`)
                                setNewCcyOpen(false)
                                await loadAll()
                            }}
                        />
                    )}
                    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <table className="w-full text-tp-sm">
                            <thead style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                <tr className="text-tp-xs font-bold uppercase tracking-wide text-app-muted-foreground">
                                    <th className="px-3 py-2 text-left">Code</th>
                                    <th className="px-3 py-2 text-left">Name</th>
                                    <th className="px-3 py-2 text-center">Symbol</th>
                                    <th className="px-3 py-2 text-center">Decimals</th>
                                    <th className="px-3 py-2 text-center">Base</th>
                                    <th className="px-3 py-2 text-center">Active</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currencies.length === 0 && (
                                    <tr><td colSpan={6} className="text-center py-8 text-app-muted-foreground">
                                        No currencies. Run <code className="text-tp-xs">manage.py bootstrap_currencies</code> or click New Currency.
                                    </td></tr>
                                )}
                                {currencies.map(c => (
                                    <tr key={c.id} style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                        <td className="px-3 py-2 font-mono font-bold">{c.code}</td>
                                        <td className="px-3 py-2">{c.name}</td>
                                        <td className="px-3 py-2 text-center">{c.symbol}</td>
                                        <td className="px-3 py-2 text-center tabular-nums">{c.decimal_places}</td>
                                        <td className="px-3 py-2 text-center">
                                            {c.is_base
                                                ? <ShieldCheck size={14} className="inline" style={{ color: 'var(--app-success, #22c55e)' }} />
                                                : <span className="text-app-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {c.is_active
                                                ? <span className="text-tp-xs">✓</span>
                                                : <span className="text-app-muted-foreground">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Rates tab */}
            {tab === 'rates' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-tp-sm text-app-muted-foreground">
                            Rates relative to base ({baseCurrency?.code ?? '—'}). Most-recent first per pair.
                        </p>
                        <button onClick={() => setNewRateOpen(true)}
                            disabled={currencies.length < 2}
                            title={currencies.length < 2 ? 'Add a non-base currency first' : 'Add a new rate row'}
                            className="flex items-center gap-1.5 text-tp-sm font-bold bg-app-primary text-white px-3 py-1.5 rounded-xl disabled:opacity-50">
                            <Plus size={13} /> New Rate
                        </button>
                    </div>
                    {newRateOpen && baseCurrency && (
                        <NewRateForm
                            currencies={currencies}
                            base={baseCurrency}
                            onCancel={() => setNewRateOpen(false)}
                            onSubmit={async (payload) => {
                                const r = await createExchangeRate(payload)
                                if (!r.success) { toast.error(r.error || 'Failed'); return }
                                toast.success(`Rate added`)
                                setNewRateOpen(false)
                                await loadAll()
                            }}
                        />
                    )}
                    {ratesByPair.length === 0 && (
                        <div className="rounded-xl p-8 text-center text-app-muted-foreground"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            No rates on file.
                        </div>
                    )}
                    <div className="space-y-3">
                        {ratesByPair.map(({ pair, list }) => (
                            <div key={pair} className="rounded-xl overflow-hidden"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <div className="px-3 py-2 font-bold text-tp-sm flex items-center gap-2"
                                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                                    <span className="font-mono">{pair}</span>
                                    <span className="text-tp-xs text-app-muted-foreground font-medium">· {list.length} rate{list.length === 1 ? '' : 's'}</span>
                                </div>
                                <table className="w-full text-tp-sm">
                                    <thead className="text-tp-xs font-bold uppercase tracking-wide text-app-muted-foreground">
                                        <tr style={{ background: 'color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                                            <th className="px-3 py-1.5 text-left">Date</th>
                                            <th className="px-3 py-1.5 text-left">Type</th>
                                            <th className="px-3 py-1.5 text-right">Rate</th>
                                            <th className="px-3 py-1.5 text-left">Source</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {list.slice(0, 10).map(r => (
                                            <tr key={r.id} style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 35%, transparent)' }}>
                                                <td className="px-3 py-1.5 font-mono text-tp-xs">{r.effective_date}</td>
                                                <td className="px-3 py-1.5">
                                                    <span className="text-tp-xxs font-bold uppercase px-1.5 py-0.5 rounded"
                                                        style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)' }}>
                                                        {r.rate_type}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono tabular-nums font-bold">{Number(r.rate).toFixed(6)}</td>
                                                <td className="px-3 py-1.5 text-tp-xs text-app-muted-foreground">{r.source ?? '—'}</td>
                                            </tr>
                                        ))}
                                        {list.length > 10 && (
                                            <tr><td colSpan={4} className="px-3 py-1.5 text-tp-xs text-app-muted-foreground text-center">
                                                … {list.length - 10} older row(s)
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Revaluations tab */}
            {tab === 'revaluations' && (
                <div className="space-y-3">
                    <p className="text-tp-sm text-app-muted-foreground">
                        Period-end mark-to-market for foreign-pinned accounts. Click <em>Revalue</em> on a period to run it.
                    </p>

                    {/* Period actions */}
                    <div className="rounded-xl overflow-hidden"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="px-3 py-2 font-bold text-tp-sm" style={{ borderBottom: '1px solid var(--app-border)' }}>
                            Run Revaluation by Period
                        </div>
                        <table className="w-full text-tp-sm">
                            <thead className="text-tp-xs font-bold uppercase tracking-wide text-app-muted-foreground">
                                <tr style={{ background: 'color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                                    <th className="px-3 py-1.5 text-left">Period</th>
                                    <th className="px-3 py-1.5 text-left">Window</th>
                                    <th className="px-3 py-1.5 text-left">Status</th>
                                    <th className="px-3 py-1.5 text-left">Reval'd?</th>
                                    <th className="px-3 py-1.5"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {periods.map(p => {
                                    const existing = revals.find(r => r.fiscal_period === p.id && r.status === 'POSTED')
                                    return (
                                        <tr key={p.id} style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 35%, transparent)' }}>
                                            <td className="px-3 py-1.5 font-bold">{p.name}</td>
                                            <td className="px-3 py-1.5 font-mono text-tp-xs">{p.start_date} → {p.end_date}</td>
                                            <td className="px-3 py-1.5">
                                                <span className="text-tp-xxs font-bold uppercase px-1.5 py-0.5 rounded"
                                                    style={statusPill(p.status)}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-1.5">
                                                {existing
                                                    ? <span className="text-tp-xs" style={{ color: 'var(--app-success, #22c55e)' }}>
                                                        ✓ {Number(existing.net_impact) >= 0 ? '+' : ''}{existing.net_impact}
                                                    </span>
                                                    : <span className="text-app-muted-foreground">—</span>}
                                            </td>
                                            <td className="px-3 py-1.5 text-right">
                                                <button onClick={() => handleRunRevaluation(p.id)}
                                                    disabled={running === p.id || p.status !== 'OPEN'}
                                                    title={p.status !== 'OPEN' ? 'Period must be OPEN' : `Revalue ${p.name}`}
                                                    className="flex items-center gap-1 text-tp-xs font-bold px-2 py-1 rounded-lg border ml-auto disabled:opacity-50"
                                                    style={{ color: 'var(--app-primary)', borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                                    <Play size={11} /> {running === p.id ? 'Running…' : (existing ? 'Re-run' : 'Revalue')}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {periods.length === 0 && (
                                    <tr><td colSpan={5} className="px-3 py-8 text-center text-app-muted-foreground">No fiscal periods configured.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* History */}
                    <div className="rounded-xl overflow-hidden"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="px-3 py-2 font-bold text-tp-sm" style={{ borderBottom: '1px solid var(--app-border)' }}>
                            Revaluation History
                        </div>
                        {revals.length === 0
                            ? <div className="p-6 text-center text-tp-sm text-app-muted-foreground">No revaluations yet.</div>
                            : <table className="w-full text-tp-sm">
                                <thead className="text-tp-xs font-bold uppercase tracking-wide text-app-muted-foreground">
                                    <tr style={{ background: 'color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                                        <th className="px-3 py-1.5 text-left">When</th>
                                        <th className="px-3 py-1.5 text-left">Period</th>
                                        <th className="px-3 py-1.5 text-left">Scope</th>
                                        <th className="px-3 py-1.5 text-right">Gain</th>
                                        <th className="px-3 py-1.5 text-right">Loss</th>
                                        <th className="px-3 py-1.5 text-right">Net</th>
                                        <th className="px-3 py-1.5 text-center">Accts</th>
                                        <th className="px-3 py-1.5 text-left">JE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {revals.map(r => (
                                        <tr key={r.id} style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 35%, transparent)' }}>
                                            <td className="px-3 py-1.5 font-mono text-tp-xs">{r.revaluation_date}</td>
                                            <td className="px-3 py-1.5 font-bold">{r.fiscal_year_name} / {r.period_name}</td>
                                            <td className="px-3 py-1.5">
                                                <span className="text-tp-xxs font-bold uppercase px-1.5 py-0.5 rounded"
                                                    style={r.scope === 'OFFICIAL'
                                                        ? { background: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)', color: 'var(--app-success, #22c55e)' }
                                                        : { background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                                    {r.scope}
                                                </span>
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-mono tabular-nums" style={{ color: Number(r.total_gain) > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>
                                                {Number(r.total_gain) > 0 ? <TrendingUp size={11} className="inline mr-1" /> : null}
                                                {r.total_gain}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-mono tabular-nums" style={{ color: Number(r.total_loss) > 0 ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
                                                {Number(r.total_loss) > 0 ? <TrendingDown size={11} className="inline mr-1" /> : null}
                                                {r.total_loss}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-mono tabular-nums font-bold">
                                                {Number(r.net_impact) >= 0 ? '+' : ''}{r.net_impact}
                                            </td>
                                            <td className="px-3 py-1.5 text-center tabular-nums">{r.accounts_processed}</td>
                                            <td className="px-3 py-1.5 font-mono text-tp-xs">{r.je_reference ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>}
                    </div>
                </div>
            )}
        </div>
    )
}

function BasePill({ base }: { base?: Currency }) {
    if (!base) {
        return (
            <span className="flex items-center gap-1 text-tp-xs font-bold px-2 py-1 rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                <ShieldAlert size={11} /> No base currency
            </span>
        )
    }
    return (
        <span className="flex items-center gap-1 text-tp-xs font-bold px-2 py-1 rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>
            <ShieldCheck size={11} /> Base: {base.code}
        </span>
    )
}

function statusPill(s: string): React.CSSProperties {
    if (s === 'OPEN') return { background: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)', color: 'var(--app-success, #22c55e)' }
    if (s === 'CLOSED') return { background: 'color-mix(in srgb, var(--app-muted-foreground) 12%, transparent)', color: 'var(--app-muted-foreground)' }
    return { background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }
}

function NewCurrencyForm({ onCancel, onSubmit }: {
    onCancel: () => void
    onSubmit: (p: { code: string; name: string; symbol: string; decimal_places: number; is_base: boolean; is_active: boolean }) => Promise<void>
}) {
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [symbol, setSymbol] = useState('')
    const [dp, setDp] = useState(2)
    const [busy, setBusy] = useState(false)
    return (
        <div className="rounded-xl p-3 space-y-2"
            style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="USD" maxLength={10}
                    className="px-2 py-1.5 rounded-lg text-tp-sm font-mono font-bold outline-none"
                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="US Dollar"
                    className="px-2 py-1.5 rounded-lg text-tp-sm outline-none"
                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="$"
                    className="px-2 py-1.5 rounded-lg text-tp-sm outline-none"
                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                <input value={dp} onChange={e => setDp(Math.max(0, Math.min(8, Number(e.target.value) || 0)))} type="number" min={0} max={8}
                    className="px-2 py-1.5 rounded-lg text-tp-sm tabular-nums outline-none"
                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
            </div>
            <div className="flex items-center gap-2 justify-end">
                <button onClick={onCancel} className="text-tp-xs font-bold px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>Cancel</button>
                <button disabled={!code || !name || busy} onClick={async () => {
                    setBusy(true)
                    try { await onSubmit({ code, name, symbol: symbol || code, decimal_places: dp, is_base: false, is_active: true }) }
                    finally { setBusy(false) }
                }}
                    className="text-tp-xs font-bold px-3 py-1.5 rounded-lg bg-app-primary text-white disabled:opacity-50">
                    {busy ? 'Adding…' : 'Add'}
                </button>
            </div>
        </div>
    )
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
        <div className="text-tp-sm text-app-muted-foreground">Add a non-base currency before entering rates.</div>
    )
    return (
        <div className="rounded-xl p-3 space-y-2"
            style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <select value={fromId} onChange={e => setFromId(Number(e.target.value))}
                    className="px-2 py-1.5 rounded-lg text-tp-sm font-mono outline-none"
                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                    {non_base.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select>
                <div className="text-tp-sm py-1.5 font-mono text-app-muted-foreground">→ {base.code}</div>
                <input value={rate} onChange={e => setRate(e.target.value)} placeholder="1.10"
                    className="px-2 py-1.5 rounded-lg text-tp-sm font-mono tabular-nums outline-none"
                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                <select value={rateType} onChange={e => setRateType(e.target.value as ExchangeRate['rate_type'])}
                    className="px-2 py-1.5 rounded-lg text-tp-sm outline-none"
                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                    {RATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="px-2 py-1.5 rounded-lg text-tp-sm outline-none"
                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
            </div>
            <div className="flex items-center gap-2 justify-end">
                <button onClick={onCancel} className="text-tp-xs font-bold px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>Cancel</button>
                <button disabled={!rate || busy} onClick={async () => {
                    setBusy(true)
                    try {
                        await onSubmit({
                            from_currency: fromId!,
                            to_currency: base.id,
                            rate,
                            rate_type: rateType,
                            effective_date: date,
                            source: 'MANUAL',
                        })
                    } finally { setBusy(false) }
                }}
                    className="text-tp-xs font-bold px-3 py-1.5 rounded-lg bg-app-primary text-white disabled:opacity-50">
                    {busy ? 'Adding…' : 'Add Rate'}
                </button>
            </div>
        </div>
    )
}
