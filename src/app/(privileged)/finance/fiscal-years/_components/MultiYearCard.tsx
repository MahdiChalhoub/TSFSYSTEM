'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, BarChart3, ChevronDown, ChevronUp } from 'lucide-react'
import { getMultiYearComparison, type MultiYearReport } from '@/app/actions/finance/fiscal-year'
import { useScope } from '@/hooks/useScope'

function fmtMoney(s: string): string {
    const n = Number(s)
    if (!Number.isFinite(n)) return s
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function cellColor(v: string, leftmost: string): string | undefined {
    const n = Number(v); const l = Number(leftmost)
    if (!Number.isFinite(n) || !Number.isFinite(l) || l === 0) return undefined
    // Compare each column to the most-recent (leftmost) year
    if (n === 0) return 'var(--app-muted-foreground)'
    return undefined
}

export function MultiYearCard({ fullHeight = false }: { fullHeight?: boolean }) {
    const { scope } = useScope()
    const [yearsToShow, setYearsToShow] = useState(3)
    const [report, setReport] = useState<MultiYearReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [showAllAccounts, setShowAllAccounts] = useState(false)
    const [cardExpanded, setCardExpanded] = useState(fullHeight)

    const load = useCallback(async () => {
        setLoading(true)
        try { setReport(await getMultiYearComparison(yearsToShow)) }
        finally { setLoading(false) }
    }, [yearsToShow])

    // Refetch when years-to-show changes OR the scope toggle flips.
    useEffect(() => { void load() }, [load, scope])

    if (loading && !report) {
        return <div className="p-4 text-center"><Loader2 size={16} className="animate-spin mx-auto" style={{ color: 'var(--app-muted-foreground)' }} /></div>
    }
    if (!report || report.years.length < 2) return null

    const pnlRows = report.rollups.filter(r => r.section === 'pnl')
    const bsRows = report.rollups.filter(r => r.section === 'balance_sheet')
    const topAccounts = [...report.per_account]
        .sort((a, b) => Math.abs(Number(b.values[0] ?? 0)) - Math.abs(Number(a.values[0] ?? 0)))
    const visibleAccounts = showAllAccounts ? topAccounts : topAccounts.slice(0, 10)
    const nYears = report.years.length

    return (
        <div className={`rounded-xl overflow-hidden flex flex-col ${fullHeight ? 'flex-1 min-h-0' : ''}`} style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            {/* Header — in fullHeight tab mode: static bar, otherwise collapsible toggle */}
            {fullHeight ? (
                <div className="px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, transparent)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                        <BarChart3 size={14} style={{ color: 'var(--app-info, #3b82f6)' }} />
                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                            {nYears}-year comparative view
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {[2, 3, 5].map(n => (
                            <button key={n} onClick={() => setYearsToShow(n)}
                                className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-md transition-all cursor-pointer"
                                style={{
                                    background: yearsToShow === n ? 'var(--app-info, #3b82f6)' : 'transparent',
                                    color: yearsToShow === n ? 'white' : 'var(--app-muted-foreground)',
                                    border: yearsToShow === n ? 'none' : '1px solid var(--app-border)',
                                }}>
                                {n}Y
                            </button>
                        ))}
                        <button onClick={() => void load()} disabled={loading}
                            className="p-1 rounded hover:opacity-70" title="Reload">
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--app-muted-foreground)' }} />
                        </button>
                    </div>
                </div>
            ) : (
            <button onClick={() => setCardExpanded(v => !v)}
                aria-expanded={cardExpanded}
                className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left"
                style={{ borderBottom: cardExpanded ? '1px solid var(--app-border)' : 'none', background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, transparent)' }}>
                <div className="flex items-center gap-2 min-w-0">
                    <BarChart3 size={14} style={{ color: 'var(--app-info, #3b82f6)' }} />
                    <span className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                        Multi-Year Comparative
                    </span>
                    <span className="text-tp-md font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                        {nYears}-year view
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {cardExpanded && [2, 3, 5].map(n => (
                        <span key={n} onClick={(e) => { e.stopPropagation(); setYearsToShow(n) }}
                            role="button" tabIndex={-1}
                            className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-md transition-all cursor-pointer"
                            style={{
                                background: yearsToShow === n ? 'var(--app-info, #3b82f6)' : 'transparent',
                                color: yearsToShow === n ? 'white' : 'var(--app-muted-foreground)',
                                border: yearsToShow === n ? 'none' : '1px solid var(--app-border)',
                            }}>
                            {n}Y
                        </span>
                    ))}
                    {cardExpanded && (
                        <span onClick={(e) => { e.stopPropagation(); void load() }}
                            role="button" tabIndex={-1}
                            aria-disabled={loading}
                            className="p-1 rounded hover:opacity-70 cursor-pointer" title="Reload">
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--app-muted-foreground)' }} />
                        </span>
                    )}
                    {cardExpanded
                        ? <ChevronUp size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                        : <ChevronDown size={14} style={{ color: 'var(--app-muted-foreground)' }} />}
                </div>
            </button>
            )}

            {(cardExpanded || fullHeight) && (<>
            {/* Year headers */}
            <div className="grid gap-2 px-3 py-1 text-tp-xxs font-bold uppercase tracking-wide"
                style={{
                    gridTemplateColumns: `minmax(160px, 1fr) repeat(${nYears}, 110px)`,
                    color: 'var(--app-muted-foreground)',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                <div></div>
                {report.years.map((y, i) => (
                    <div key={y.id} className="text-right"
                        style={{ color: i === 0 ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }}>
                        {y.name}
                    </div>
                ))}
            </div>

            <div className="px-3 py-2">
                {/* P&L rollups */}
                <div className="text-tp-xxs font-bold uppercase tracking-wide mt-1 mb-1"
                    style={{ color: 'var(--app-muted-foreground)' }}>Profit & Loss</div>
                {pnlRows.map(r => (
                    <div key={r.label}
                        className="grid gap-2 items-center py-1 text-tp-xs"
                        style={{
                            gridTemplateColumns: `minmax(160px, 1fr) repeat(${nYears}, 110px)`,
                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                        }}>
                        <div className="font-bold"
                            style={{ color: r.label === 'Net Income' ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                            {r.label}
                        </div>
                        {r.values.map((v, i) => (
                            <div key={i} className="text-right font-mono tabular-nums"
                                style={{
                                    color: cellColor(v, r.values[0] ?? '0') ?? (i === 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)'),
                                    fontWeight: i === 0 ? 600 : 400,
                                }}>
                                {fmtMoney(v)}
                            </div>
                        ))}
                    </div>
                ))}

                {/* Balance Sheet rollups */}
                <div className="text-tp-xxs font-bold uppercase tracking-wide mt-3 mb-1"
                    style={{ color: 'var(--app-muted-foreground)' }}>Balance Sheet (period-end)</div>
                {bsRows.map(r => (
                    <div key={r.label}
                        className="grid gap-2 items-center py-1 text-tp-xs"
                        style={{
                            gridTemplateColumns: `minmax(160px, 1fr) repeat(${nYears}, 110px)`,
                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                        }}>
                        <div className="font-bold" style={{ color: 'var(--app-foreground)' }}>{r.label}</div>
                        {r.values.map((v, i) => (
                            <div key={i} className="text-right font-mono tabular-nums"
                                style={{
                                    color: cellColor(v, r.values[0] ?? '0') ?? (i === 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)'),
                                    fontWeight: i === 0 ? 600 : 400,
                                }}>
                                {fmtMoney(v)}
                            </div>
                        ))}
                    </div>
                ))}

                {/* Per-account */}
                {topAccounts.length > 0 && (
                    <>
                        <div className="text-tp-xxs font-bold uppercase tracking-wide mt-3 mb-1"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            Per-account ({visibleAccounts.length}/{topAccounts.length})
                        </div>
                        {visibleAccounts.map(a => (
                            <div key={a.account_id}
                                className="grid gap-2 items-center py-1 text-tp-xs"
                                style={{
                                    gridTemplateColumns: `minmax(160px, 1fr) repeat(${nYears}, 110px)`,
                                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                }}>
                                <div className="truncate" style={{ color: 'var(--app-foreground)' }}>
                                    <span className="font-mono text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>{a.code}</span>
                                    {' '}{a.name}
                                </div>
                                {a.values.map((v, i) => (
                                    <div key={i} className="text-right font-mono tabular-nums"
                                        style={{ color: i === 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                        {fmtMoney(v)}
                                    </div>
                                ))}
                            </div>
                        ))}
                        {topAccounts.length > 10 && (
                            <button onClick={() => setShowAllAccounts(v => !v)}
                                className="mt-2 text-tp-xxs font-bold flex items-center gap-1"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                <ChevronDown size={11} style={{ transform: showAllAccounts ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms' }} />
                                {showAllAccounts ? 'Show top 10' : `Show all ${topAccounts.length}`}
                            </button>
                        )}
                    </>
                )}
            </div>
            </>)}
        </div>
    )
}
