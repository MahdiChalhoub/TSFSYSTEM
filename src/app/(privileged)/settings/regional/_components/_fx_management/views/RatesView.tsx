'use client'

import { toast } from 'sonner'
import { TrendingUp, TrendingDown, Plus } from 'lucide-react'
import {
    createExchangeRate,
    type Currency, type ExchangeRate,
} from '@/app/actions/finance/currency'
import { soft } from '../constants'
import { SectionHeader, PrimaryButton, EmptyState } from '../atoms'
import { NewRateForm } from '../NewRateForm'

export function RatesView({
    currencies, baseCurrency, ratesByPair,
    hasBase, hasNonBase,
    newRateOpen, setNewRateOpen, setPendingNewRate,
    loadAll,
}: {
    currencies: Currency[]
    baseCurrency?: Currency
    ratesByPair: { pair: string; list: ExchangeRate[] }[]
    hasBase: boolean
    hasNonBase: boolean
    newRateOpen: boolean
    setNewRateOpen: (v: boolean) => void
    setPendingNewRate: (v: boolean) => void
    loadAll: () => Promise<void>
}) {
    return (
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
    )
}
