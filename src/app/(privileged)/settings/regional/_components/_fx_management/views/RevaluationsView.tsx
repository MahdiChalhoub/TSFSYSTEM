'use client'

import { Play, TrendingUp, TrendingDown } from 'lucide-react'
import type { CurrencyRevaluation } from '@/app/actions/finance/currency'
import { soft, statusPill } from '../constants'
import { SectionHeader, EmptyState } from '../atoms'

type PeriodWithYear = {
    id: number
    name: string
    start_date: string
    end_date: string
    status: string
    fiscal_year: number
    fiscal_year_name: string
}

export function RevaluationsView({
    periods, revals, running, handleRunRevaluation,
}: {
    periods: PeriodWithYear[]
    revals: CurrencyRevaluation[]
    running: number | null
    handleRunRevaluation: (periodId: number) => Promise<void>
}) {
    return (
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
    )
}
