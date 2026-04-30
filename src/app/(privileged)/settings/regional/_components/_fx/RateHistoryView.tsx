'use client'
/**
 * FX Management — RATE HISTORY view (sub-tab #1).
 * Extracted verbatim from FxRedesigned.tsx.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import {
    Plus, TrendingUp, TrendingDown, Trash2,
    Settings,
} from 'lucide-react'
import {
    deleteExchangeRate,
    type Currency, type ExchangeRate, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import {
    soft,
    Th, Td, Pill, ActionBtn,
} from '../fx/_shared'
import { SegSelect, EmptyState } from './atoms'
import { PairChart } from './PairChart'
import { EditRateModal } from './EditRateModal'
import { DeleteRateConfirm } from './DeleteRateConfirm'

/* ═══════════════════════════════════════════════════════════════════
 *  RATE HISTORY — pair × time-range × side filters + table
 * ═══════════════════════════════════════════════════════════════════ */
export function RateHistoryView({ rates, policies, baseCurrency, orgCurrencyCount, orgBaseCode, onAddManual, onRefresh }: {
    rates: ExchangeRate[]
    policies: CurrencyRatePolicy[]
    baseCurrency: Currency | undefined
    orgCurrencyCount?: number
    orgBaseCode?: string | null
    onAddManual: () => void
    onRefresh?: () => Promise<void>
}) {
    const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null)
    const [deletingRate, setDeletingRate] = useState<ExchangeRate | null>(null)
    const [busyId, setBusyId] = useState<number | null>(null)
    async function performDelete(r: ExchangeRate) {
        setBusyId(r.id)
        try {
            const res = await deleteExchangeRate(r.id)
            if (!res.success) {
                console.error('[FX] Delete failed:', res.error)
                toast.error(res.error || 'Delete failed')
                return
            }
            toast.success('Rate deleted')
            setDeletingRate(null)
            await onRefresh?.()
        } catch (e) {
            console.error('[FX] Delete threw:', e)
            toast.error(e instanceof Error ? e.message : 'Delete failed')
        } finally {
            setBusyId(null)
        }
    }
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
                                                <Th align="right">&nbsp;</Th>
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
                                                        <Td align="right">
                                                            <div className="inline-flex items-center gap-1">
                                                                <button
                                                                    onClick={() => setEditingRate(r)}
                                                                    disabled={busyId === r.id}
                                                                    title="Edit this rate"
                                                                    className="p-1 rounded-md hover:bg-app-border/40 disabled:opacity-40"
                                                                    style={{ color: 'var(--app-info)' }}>
                                                                    <Settings size={11} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeletingRate(r)}
                                                                    disabled={busyId === r.id}
                                                                    title="Delete this rate"
                                                                    className="p-1 rounded-md hover:bg-app-border/40 disabled:opacity-40"
                                                                    style={{ color: 'var(--app-error)' }}>
                                                                    <Trash2 size={11} />
                                                                </button>
                                                            </div>
                                                        </Td>
                                                    </tr>
                                                )
                                            })}
                                            {list.length > 20 && (
                                                <tr><td colSpan={7} className="px-3 py-1.5 text-[10px] text-app-muted-foreground text-center italic">… {list.length - 20} older rows hidden</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {editingRate && (
                <EditRateModal
                    rate={editingRate}
                    onClose={() => setEditingRate(null)}
                    onSaved={async () => { setEditingRate(null); await onRefresh?.() }}
                />
            )}

            {deletingRate && (
                <DeleteRateConfirm
                    rate={deletingRate}
                    busy={busyId === deletingRate.id}
                    onCancel={() => setDeletingRate(null)}
                    onConfirm={() => performDelete(deletingRate)}
                />
            )}
        </div>
    )
}
