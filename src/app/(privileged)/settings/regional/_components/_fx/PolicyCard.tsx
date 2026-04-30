'use client'
/**
 * FX Management — single policy card (rate-rules grid item).
 * Extracted verbatim from FxRedesigned.tsx.
 */
import { useEffect, useState } from 'react'
import {
    RefreshCcw, Trash2, AlertTriangle, Settings, MoreVertical,
} from 'lucide-react'
import { type ExchangeRate, type CurrencyRatePolicy } from '@/app/actions/finance/currency'
import { soft, FG_PRIMARY } from '../fx/_shared'
import { HEALTH, PROVIDER_META, FREQ_LABEL, type HealthKey } from './constants'
import { MenuItem, RateColumn } from './atoms'
import { Sparkline } from './PairChart'

/* ─── Policy card ────────────────────────────────────────────────── */
export function PolicyCard({ p, health, latest, sides, history, syncing, onSync, onEdit, onDelete, onToggleAuto }: {
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
