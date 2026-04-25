'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Loader2, RefreshCw, Info } from 'lucide-react'
import { getYoyComparison, type YoyReport, type YoyDelta } from '@/app/actions/finance/fiscal-year'
import { useScope } from '@/hooks/useScope'

function fmtMoney(s: string): string {
    const n = Number(s)
    if (!Number.isFinite(n)) return s
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DeltaRow({ label, d, color }: { label: string; d: YoyDelta; color?: string }) {
    const dn = Number(d.delta)
    const positive = dn > 0
    const negative = dn < 0
    const arrow = positive ? <TrendingUp size={12} /> : negative ? <TrendingDown size={12} /> : <Minus size={12} />
    const arrowColor = positive
        ? 'var(--app-success, #22c55e)'
        : negative ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)'
    return (
        <div className="grid grid-cols-[1fr_110px_110px_90px_50px] gap-2 items-center py-1 text-tp-xs"
            style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
            <div className="font-bold" style={{ color: color ?? 'var(--app-foreground)' }}>{label}</div>
            <div className="text-right font-mono tabular-nums" style={{ color: 'var(--app-foreground)' }}>{fmtMoney(d.current)}</div>
            <div className="text-right font-mono tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{fmtMoney(d.prior)}</div>
            <div className="text-right font-mono tabular-nums flex items-center justify-end gap-1" style={{ color: arrowColor }}>
                {arrow}
                {fmtMoney(d.delta)}
            </div>
            <div className="text-right font-mono text-tp-xxs" style={{ color: arrowColor }}>
                {d.pct === null ? '—' : `${d.pct > 0 ? '+' : ''}${d.pct.toFixed(1)}%`}
            </div>
        </div>
    )
}

export function YoyComparisonCard({ fiscalYearId }: { fiscalYearId: number }) {
    const { scope } = useScope()
    const [report, setReport] = useState<YoyReport | null>(null)
    const [loading, setLoading] = useState(true)

    const load = async () => {
        setLoading(true)
        try { setReport(await getYoyComparison(fiscalYearId)) }
        finally { setLoading(false) }
    }
    // Refetch when the year changes OR the OFFICIAL/INTERNAL toggle flips —
    // the backend returns scope-filtered numbers and we want them live.
    useEffect(() => { void load() }, [fiscalYearId, scope])

    if (loading && !report) {
        return (
            <div className="p-4 text-center">
                <Loader2 size={16} className="animate-spin mx-auto" style={{ color: 'var(--app-muted-foreground)' }} />
            </div>
        )
    }
    if (!report) return null
    if (!report.prior_year) {
        return (
            <div className="rounded-xl p-3 flex items-center gap-2 text-tp-sm"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                <Info size={14} />
                <span>No prior year to compare against. YoY appears once a second fiscal year exists.</span>
            </div>
        )
    }

    const nz = (d: YoyDelta) => Number(d.current) !== 0 || Number(d.prior) !== 0

    return (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            {/* Header */}
            <div className="px-3 py-2 flex items-center justify-between gap-2"
                style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 3%, transparent)' }}>
                <div className="min-w-0">
                    <div className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                        Year-over-Year Comparison
                    </div>
                    <div className="text-tp-md font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                        {report.current_year.name} <span style={{ color: 'var(--app-muted-foreground)' }}>vs</span> {report.prior_year.name}
                    </div>
                </div>
                <button onClick={() => void load()} disabled={loading}
                    className="p-1 rounded hover:opacity-70 disabled:opacity-30" title="Reload">
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--app-muted-foreground)' }} />
                </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_110px_110px_90px_50px] gap-2 px-3 py-1 text-tp-xxs font-bold uppercase tracking-wide"
                style={{ color: 'var(--app-muted-foreground)', borderBottom: '1px solid var(--app-border)' }}>
                <div></div>
                <div className="text-right">{report.current_year.name}</div>
                <div className="text-right">{report.prior_year.name}</div>
                <div className="text-right">Δ</div>
                <div className="text-right">%</div>
            </div>

            <div className="px-3 py-2">
                {/* P&L */}
                <div className="text-tp-xxs font-bold uppercase tracking-wide mt-1 mb-1" style={{ color: 'var(--app-muted-foreground)' }}>
                    Profit & Loss
                </div>
                <DeltaRow label="Revenue" d={report.pnl.revenue} />
                <DeltaRow label="Expenses" d={report.pnl.expenses} />
                <DeltaRow label="Net Income" d={report.pnl.net_income} color="var(--app-primary)" />

                {/* Balance Sheet */}
                <div className="text-tp-xxs font-bold uppercase tracking-wide mt-3 mb-1" style={{ color: 'var(--app-muted-foreground)' }}>
                    Balance Sheet (period-end)
                </div>
                <DeltaRow label="Assets" d={report.balance_sheet.assets} />
                <DeltaRow label="Liabilities" d={report.balance_sheet.liabilities} />
                <DeltaRow label="Equity" d={report.balance_sheet.equity} />

                {/* Per-account (top 10 by |delta|) */}
                {report.accounts.length > 0 && (
                    <>
                        <div className="text-tp-xxs font-bold uppercase tracking-wide mt-3 mb-1" style={{ color: 'var(--app-muted-foreground)' }}>
                            Top accounts by change
                        </div>
                        {report.accounts
                            .filter(a => nz(a as unknown as YoyDelta))
                            .sort((a, b) => Math.abs(Number(b.delta)) - Math.abs(Number(a.delta)))
                            .slice(0, 10)
                            .map(a => (
                                <DeltaRow
                                    key={a.account_id}
                                    label={`${a.code} — ${a.name}`}
                                    d={{ current: a.current, prior: a.prior, delta: a.delta, pct: a.pct }}
                                />
                            ))}
                    </>
                )}
            </div>
        </div>
    )
}
