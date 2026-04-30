'use client'

import { Fragment } from 'react'
import { toast } from 'sonner'
import { RefreshCcw, Trash2, AlertTriangle } from 'lucide-react'
import {
    updateRatePolicy,
    type ExchangeRate, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import { soft, HEALTH_COLOR, HEALTH_LABEL, policyHealth } from '../constants'
import { FreshSyncBadge } from '../atoms'

export function PoliciesTable({
    policies, latestRateByKey,
    policyQuery, policyHealthFilter, policyProviderFilter,
    editingPolicy, setEditingPolicy, savingEdit, commitInlineEdit,
    syncingId, deletingId,
    handleSyncPolicy, handleDeletePolicy, loadAll,
}: {
    policies: CurrencyRatePolicy[]
    latestRateByKey: Map<string, ExchangeRate>
    policyQuery: string
    policyHealthFilter: 'all' | 'fresh' | 'stale' | 'fail' | 'never' | 'manual'
    policyProviderFilter: 'all' | CurrencyRatePolicy['provider']
    editingPolicy: { id: number; multiplier: string; markup_pct: string } | null
    setEditingPolicy: React.Dispatch<React.SetStateAction<{ id: number; multiplier: string; markup_pct: string } | null>>
    savingEdit: boolean
    commitInlineEdit: () => Promise<void>
    syncingId: number | null
    deletingId: number | null
    handleSyncPolicy: (id: number) => Promise<void>
    handleDeletePolicy: (p: CurrencyRatePolicy) => Promise<void>
    loadAll: () => Promise<void>
}) {
    return (
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
    )
}
