'use client'

import { useState, useMemo, useRef, useEffect, useTransition } from 'react'
import {
    Scale, ChevronDown, Search, Download, Printer,
    RefreshCcw, Calendar, CheckCircle2, AlertTriangle, Eye, EyeOff,
    Maximize2, Minimize2, ArrowLeft, Layers,
    ChevronsUpDown, ChevronsDownUp, TrendingUp, TrendingDown, Sigma, Check,
} from 'lucide-react'
import Link from 'next/link'
import { getTrialBalanceReport } from '@/app/actions/finance/accounts'
import { TYPE_CONFIG } from '@/app/(privileged)/finance/chart-of-accounts/_components/types'
import { ReportAccountNode, ReportAccountHeader } from '../_shared/ReportAccountNode'
import { FiscalYearSelector, useActiveFiscalYear } from '../_shared/FiscalYearSelector'
import { useMoneyFormatter, exportCSV, flattenAccounts } from '../_shared/components'
import { useScope } from '@/hooks/useScope'

/* ═══════════════════════════════════════════════════════════
 *  TRIAL BALANCE — thin consumer
 *  - Reuses TYPE_CONFIG + ReportAccountNode instead of redefining
 *    per-type colours / icons / row layout.
 *  - Fiscal-year selector lives in the toolbar; once picked it
 *    governs every report (the selection is persisted and other
 *    report tabs update live via a storage event).
 *  - PeriodPicker embeds the native date calendar AND the preset
 *    shortcuts in one control (no more separate chips).
 * ═══════════════════════════════════════════════════════════ */

const ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const

export default function TrialBalanceViewer({ initialAccounts, fiscalYears }: {
    initialAccounts: any[]; fiscalYears: any[]
}) {
    const { scope: viewScope } = useScope()
    const [asOfDate, setAsOfDate] = useState(todayLocalIso())
    const [accounts, setAccounts] = useState(initialAccounts)
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string | null>(null)
    const [hideZero, setHideZero] = useState(true)
    const [focusMode, setFocusMode] = useState(false)
    const [expandAll, setExpandAll] = useState<boolean | undefined>(true)
    const [expandKey, setExpandKey] = useState(0)
    const searchRef = useRef<HTMLInputElement>(null)
    const fmt = useMoneyFormatter(mounted)
    useEffect(() => { setMounted(true) }, [])

    // ─── Fiscal year rule ───
    // When an FY is explicitly picked the report is FY-scoped:
    //   balance = opening (carry-forward from prior years, 0 for P&L accts)
    //           + movements inside [fy.start, as_of]
    // The as-of date is *clamped* to the FY window — selecting a date
    // outside the FY is not allowed because the opening wouldn't be the
    // opening of the chosen FY.
    const activeFy = useActiveFiscalYear(fiscalYears)
    const fyBounds = useMemo(() => {
        if (!activeFy.isExplicit || activeFy.mode !== 'fy' || !activeFy.start || !activeFy.end) return null
        return { start: activeFy.start as string, end: activeFy.end as string }
    }, [activeFy.isExplicit, activeFy.mode, activeFy.start, activeFy.end])

    useEffect(() => {
        if (!activeFy.isExplicit) return
        if (activeFy.mode === 'all') { setAsOfDate(''); return }
        if (activeFy.mode === 'fy' && activeFy.start && activeFy.end) {
            // Land on the most useful date inside the FY: if today is within
            // the FY use today; if FY is in the past use its end; if in the
            // future use its start.
            const t = todayLocalIso()
            const next = t >= activeFy.start && t <= activeFy.end
                ? t
                : (t > activeFy.end ? activeFy.end : activeFy.start)
            setAsOfDate(next)
        }
    }, [activeFy.isExplicit, activeFy.mode, activeFy.start, activeFy.end])

    // Safety net: if the as-of drifts outside the FY window (stale state,
    // URL share, etc.) snap it back in-range.
    useEffect(() => {
        if (!fyBounds || !asOfDate) return
        if (asOfDate < fyBounds.start) setAsOfDate(fyBounds.start)
        else if (asOfDate > fyBounds.end) setAsOfDate(fyBounds.end)
    }, [fyBounds, asOfDate])

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Build the fetch argument: null when "all time" so backend drops the
    // upper bound; otherwise a noon-local Date to avoid UTC rollover to the
    // previous day. (The backend still upgrades as_of to end-of-day.)
    const toFetchDate = (iso: string) => {
        if (!iso) return null
        const [y, m, d] = iso.split('-').map(Number)
        return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0)
    }

    const fyStartForFetch = fyBounds ? toFetchDate(fyBounds.start) : null

    const handleRefresh = () => {
        startTransition(async () => {
            const d = await getTrialBalanceReport(toFetchDate(asOfDate), fyStartForFetch, viewScope)
            setAccounts(d)
        })
    }

    // Auto-refresh on as-of-date, fy-start, or scope change (preset pick, FY
    // switch, manual, or OFFICIAL/INTERNAL toggle). Skip the very first render
    // since SSR already hydrated the page.
    const didMountRef = useRef(false)
    useEffect(() => {
        if (!didMountRef.current) { didMountRef.current = true; return }
        const t = setTimeout(() => {
            startTransition(async () => {
                const d = await getTrialBalanceReport(toFetchDate(asOfDate), fyStartForFetch, viewScope)
                setAccounts(d)
            })
        }, 150)
        return () => clearTimeout(t)
    }, [asOfDate, fyBounds?.start, viewScope])

    // Subtotals per type
    const typeSubtotals = useMemo(() => {
        const out: Record<string, { debit: number; credit: number; count: number }> = {}
        accounts.filter(a => !a.parentId).forEach(a => {
            const key = a.type
            if (!out[key]) out[key] = { debit: 0, credit: 0, count: 0 }
            const bal = a.balance ?? 0
            if (bal > 0) out[key].debit += bal
            else out[key].credit += Math.abs(bal)
            out[key].count += 1
        })
        return out
    }, [accounts])

    const totals = useMemo(() => {
        let dr = 0, cr = 0
        accounts.filter(a => !a.parentId).forEach(a => {
            if (a.balance > 0) dr += a.balance; else cr += Math.abs(a.balance)
        })
        return { dr, cr, diff: Math.abs(dr - cr) }
    }, [accounts])
    const ok = totals.diff < 0.01

    const withBalance = accounts.filter(a => !a.parentId && Math.abs(a.balance ?? 0) > 0.001).length
    const rootCount = accounts.filter(a => !a.parentId).length
    const largest = useMemo(() => accounts.filter(a => !a.parentId)
        .slice().sort((a, b) => Math.abs(b.balance || 0) - Math.abs(a.balance || 0))[0], [accounts])

    // Grouped & filtered
    const grouped = useMemo(() => {
        let list = accounts.filter(a => !a.parentId)
        if (typeFilter) list = list.filter(a => a.type === typeFilter)
        if (search.trim()) {
            const q = search.toLowerCase()
            const matches = (a: any): boolean => {
                if ((a.name || '').toLowerCase().includes(q) || (a.code || '').toLowerCase().includes(q)) return true
                if (a.children) return a.children.some((c: any) => {
                    const child = typeof c === 'object' ? c : accounts.find(x => x.id === c)
                    return child && matches(child)
                })
                return false
            }
            list = list.filter(matches)
        }
        return ORDER.map(type => ({
            type,
            items: list.filter(a => a.type === type).sort((a, b) => a.code.localeCompare(b.code)),
        })).filter(g => g.items.length > 0)
    }, [accounts, typeFilter, search])

    const handleExport = () => {
        const rows: any[] = []
        grouped.forEach(g => {
            rows.push({ code: '', name: `— ${TYPE_CONFIG[g.type].label.toUpperCase()} —`, debit: '', credit: '' })
            flattenAccounts(g.items, accounts).forEach(r => {
                rows.push({
                    code: r.code, name: r.name,
                    debit: r.balance > 0 ? r.balance.toFixed(2) : '',
                    credit: r.balance < 0 ? Math.abs(r.balance).toFixed(2) : '',
                })
            })
        })
        rows.push({ code: '', name: 'STATEMENT TOTALS', debit: totals.dr.toFixed(2), credit: totals.cr.toFixed(2) })
        exportCSV({
            filename: `trial-balance_${asOfDate || 'all-time'}.csv`,
            columns: [
                { header: 'Code', get: (r: any) => r.code },
                { header: 'Account', get: (r: any) => r.name },
                { header: 'Debit', get: (r: any) => r.debit },
                { header: 'Credit', get: (r: any) => r.credit },
            ],
            rows,
        })
    }

    return (
        <div className="report-print-root flex flex-col overflow-hidden relative"
            style={{ height: 'calc(100dvh - 6rem)' }}>


            {/* Header */}
            {!focusMode && (
                <div className="flex items-start justify-between gap-4 mb-3 flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6 print:hidden">
                    <div className="flex items-center gap-3">
                        <Link href="/finance/reports"
                            className="p-2 rounded-xl transition-all"
                            style={{
                                color: 'var(--app-muted-foreground)',
                                background: 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}
                            aria-label="Back">
                            <ArrowLeft size={16} />
                        </Link>
                        <div className="page-header-icon bg-app-primary"
                            style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Scale size={20} className="text-white" />
                        </div>
                        <div>
                            <h1>Trial Balance</h1>
                            <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">
                                {rootCount} accounts · {withBalance} with balance · {
                                    fyBounds
                                        ? `${activeFy.fy?.name || `FY ${fyBounds.start.slice(0, 4)}`} · opening + movement thru ${new Date(asOfDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                                        : asOfDate
                                            ? `cumulative as of ${new Date(asOfDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                                            : 'all time'
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <FiscalYearSelector fiscalYears={fiscalYears} />
                        <button onClick={handleExport} className="toolbar-btn text-app-muted-foreground">
                            <Download size={13} /> <span className="hidden sm:inline">Export CSV</span>
                        </button>
                        <button onClick={() => window.print()} className="toolbar-btn text-app-muted-foreground">
                            <Printer size={13} /> <span className="hidden sm:inline">Print PDF</span>
                        </button>
                        <button onClick={handleRefresh} disabled={isPending} className="toolbar-btn-primary disabled:opacity-60">
                            <RefreshCcw size={13} style={{ animation: isPending ? 'spin 0.9s linear infinite' : undefined }} />
                            {isPending ? 'Updating…' : 'Refresh'}
                        </button>
                    </div>
                </div>
            )}

            {/* KPI strip — money, not counts */}
            {!focusMode && (
                <div className="flex-shrink-0 mb-3 px-4 md:px-6 grid gap-2 print:hidden"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <MoneyKpi label="Total Debits" value={fmt(totals.dr)}
                        icon={<TrendingUp size={13} />} color="var(--app-success)" />
                    <MoneyKpi label="Total Credits" value={fmt(totals.cr)}
                        icon={<TrendingDown size={13} />} color="var(--app-error)" />
                    <MoneyKpi label={ok ? 'Difference' : 'Out of Balance'} value={fmt(totals.diff)}
                        icon={ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        color={ok ? 'var(--app-success)' : 'var(--app-error)'}
                        tone={ok ? 'soft' : 'strong'} />
                    <MoneyKpi label={`Largest · ${TYPE_CONFIG[largest?.type]?.label || '—'}`}
                        value={largest ? fmt(Math.abs(largest.balance || 0)) : '—'}
                        sub={largest?.name}
                        icon={<Sigma size={13} />}
                        color={TYPE_CONFIG[largest?.type]?.color || 'var(--app-primary)'} />
                    <MoneyKpi label="Activity" value={`${withBalance}/${rootCount}`}
                        sub={`${accounts.length} total incl. sub-accounts`}
                        icon={<Layers size={13} />}
                        color="var(--app-info)" />
                </div>
            )}

            {/* Type filter pills — use COA's TYPE_CONFIG */}
            {!focusMode && (
                <div className="flex-shrink-0 flex items-center gap-1.5 mb-3 px-4 md:px-6 overflow-x-auto print:hidden"
                    style={{ scrollbarWidth: 'none' }}>
                    <FilterPill label="All" active={typeFilter === null}
                        onClick={() => setTypeFilter(null)} />
                    {ORDER.map(type => {
                        const st = typeSubtotals[type]
                        if (!st) return null
                        const conf = TYPE_CONFIG[type]
                        return (
                            <FilterPill key={type} label={conf.label} icon={conf.icon}
                                count={st.count} accent={conf.color}
                                active={typeFilter === type}
                                onClick={() => setTypeFilter(typeFilter === type ? null : type)} />
                        )
                    })}
                </div>
            )}

            {/* Controls: period + search + expand + hide-zero */}
            <div className="flex-shrink-0 flex flex-wrap items-center gap-2 mb-3 px-4 md:px-6 print:hidden">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                    style={{
                        background: `color-mix(in srgb, ${ok ? 'var(--app-success)' : 'var(--app-error)'} 8%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${ok ? 'var(--app-success)' : 'var(--app-error)'} 30%, transparent)`,
                        color: ok ? 'var(--app-success)' : 'var(--app-error)',
                    }}>
                    {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    <span className="text-tp-xs font-bold uppercase tracking-wide">
                        {ok ? 'Balanced' : `Δ ${fmt(totals.diff)}`}
                    </span>
                </div>
                <PeriodPicker value={asOfDate} bounds={fyBounds}
                    onChange={(v) => {
                        if (v === asOfDate) handleRefresh() // same value → force-fetch anyway
                        else setAsOfDate(v)                 // different → auto-refresh effect picks it up
                    }} />

                <div className="flex-1 min-w-[180px] relative ml-auto">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search account… (Ctrl+K)"
                        className="w-full pl-8 pr-3 py-1.5 text-tp-sm rounded-xl border border-app-border bg-app-surface/50 outline-none"
                        style={{ color: 'var(--app-foreground)' }} />
                </div>
                <button onClick={() => { setExpandAll(v => !v); setExpandKey(k => k + 1) }}
                    className="toolbar-btn text-app-primary border-app-primary/30 bg-app-primary/5">
                    {expandAll ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                    <span className="hidden sm:inline">{expandAll ? 'Collapse' : 'Expand'}</span>
                </button>
                <button onClick={() => setHideZero(p => !p)}
                    className={`toolbar-btn ${hideZero ? 'text-app-muted-foreground' : 'text-app-warning border-app-warning/30 bg-app-warning/10'}`}>
                    {hideZero ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span className="hidden sm:inline">Zero</span>
                </button>
                {/* Focus-mode toggle — always visible in the search row so
                 *  the user has a predictable way back when focus mode is on. */}
                <button onClick={() => setFocusMode(p => !p)}
                    className={`toolbar-btn ${focusMode ? 'text-app-primary border-app-primary/30 bg-app-primary/10' : 'text-app-muted-foreground'}`}
                    title={focusMode ? 'Exit focus mode (Ctrl+Q)' : 'Focus mode — hide header (Ctrl+Q)'}
                    aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}>
                    {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span className="hidden sm:inline">{focusMode ? 'Exit focus' : 'Focus'}</span>
                </button>
            </div>

            {/* Framed tree — reuses ReportAccountNode + ReportAccountHeader */}
            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col mx-4 md:mx-6 border border-app-border bg-app-surface/30 print:border-0 print:rounded-none print:mx-0">
                <ReportAccountHeader columns="debit-credit" />
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {grouped.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-12 gap-2">
                            <Layers size={24} style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} />
                            <p className="text-tp-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                {search ? 'No accounts match your search' : 'No accounts to show'}
                            </p>
                        </div>
                    ) : grouped.map(g => {
                        const conf = TYPE_CONFIG[g.type]
                        const st = typeSubtotals[g.type] || { debit: 0, credit: 0, count: 0 }
                        return (
                            <div key={g.type}>
                                {/* Section header with inline subtotal */}
                                <div className="flex items-center px-3 py-1.5 text-tp-xxs font-black uppercase tracking-widest"
                                    style={{
                                        background: `color-mix(in srgb, ${conf.color} 5%, transparent)`,
                                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                                        borderLeft: `3px solid ${conf.color}`,
                                        color: conf.color,
                                    }}>
                                    <div className="w-5 flex-shrink-0" />
                                    <div className="w-7 flex-shrink-0" />
                                    <div className="flex-1 flex items-center gap-2">
                                        <span>{conf.label}</span>
                                        <span className="opacity-60 font-mono normal-case tracking-normal">
                                            · {st.count}
                                        </span>
                                    </div>
                                    <div className="w-24 hidden sm:block" />
                                    <div className="w-28 text-right font-mono tabular-nums"
                                        style={{ color: st.debit > 0 ? conf.color : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)' }}>
                                        {st.debit > 0 ? fmt(st.debit) : '—'}
                                    </div>
                                    <div className="w-28 text-right font-mono tabular-nums"
                                        style={{ color: st.credit > 0 ? conf.color : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)' }}>
                                        {st.credit > 0 ? fmt(st.credit) : '—'}
                                    </div>
                                </div>
                                {g.items.map(acc => (
                                    <ReportAccountNode key={acc.id}
                                        node={acc} level={0} accounts={accounts}
                                        formatAmount={fmt}
                                        columns="debit-credit"
                                        forceOpen={expandAll} forceOpenKey={expandKey}
                                        hideZero={hideZero} />
                                ))}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-tp-sm font-bold mx-4 md:mx-6 rounded-b-2xl border border-app-border border-t-0 bg-app-surface/70 text-app-muted-foreground mb-2 print:hidden">
                <div className="uppercase tracking-widest text-tp-xxs font-black opacity-70">Statement totals</div>
                <div className="flex items-center gap-4 font-mono tabular-nums">
                    <span>
                        <span className="opacity-60 uppercase tracking-wide text-tp-xxs mr-2">Debit</span>
                        <span className="text-app-foreground">{fmt(totals.dr)}</span>
                    </span>
                    <span style={{ color: 'var(--app-border)' }}>=</span>
                    <span>
                        <span className="opacity-60 uppercase tracking-wide text-tp-xxs mr-2">Credit</span>
                        <span className="text-app-foreground">{fmt(totals.cr)}</span>
                    </span>
                    {!ok && (
                        <>
                            <span style={{ color: 'var(--app-error)' }}>·</span>
                            <span style={{ color: 'var(--app-error)' }}>Δ {fmt(totals.diff)}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Print-only header */}
            <div className="report-only-print px-6 py-4 text-center">
                <h2 className="report-statement-title">Trial Balance</h2>
                <p className="text-sm mt-1">
                    {fyBounds
                        ? `${activeFy.fy?.name || `FY ${fyBounds.start.slice(0, 4)}`} — opening + movement through ${new Date(asOfDate + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
                        : asOfDate
                            ? `Cumulative as of ${new Date(asOfDate + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
                            : 'All time'}
                </p>
            </div>

            <style jsx>{`
                .toolbar-btn {
                    display: inline-flex; align-items: center; gap: 0.375rem;
                    font-size: 0.6875rem; font-weight: 700;
                    border: 1px solid var(--app-border);
                    padding: 0.375rem 0.625rem; border-radius: 0.75rem;
                    transition: all 0.2s;
                }
                .toolbar-btn:hover { background: var(--app-surface); color: var(--app-foreground); }
                .toolbar-btn-primary {
                    display: inline-flex; align-items: center; gap: 0.375rem;
                    font-size: 0.6875rem; font-weight: 700;
                    padding: 0.375rem 0.75rem; border-radius: 0.75rem;
                    background: var(--app-primary); color: #fff;
                    box-shadow: 0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent);
                    transition: all 0.2s;
                }
                .toolbar-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.1); }
            `}</style>
        </div>
    )
}

/* ─── Small helpers ─── */

function MoneyKpi({ label, value, sub, icon, color, tone = 'soft' }: any) {
    return (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{
                background: tone === 'strong'
                    ? `color-mix(in srgb, ${color} 12%, var(--app-surface))`
                    : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: tone === 'strong'
                    ? `1.5px solid ${color}`
                    : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                boxShadow: tone === 'strong'
                    ? `0 2px 10px color-mix(in srgb, ${color} 22%, transparent)`
                    : 'none',
            }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-tp-xxs font-bold uppercase tracking-wider truncate"
                    style={{ color: tone === 'strong' ? color : 'var(--app-muted-foreground)' }}>
                    {label}
                </div>
                <div className="font-mono font-black tabular-nums truncate"
                    style={{ color: 'var(--app-foreground)', fontSize: 'var(--tp-md, 13px)' }}>
                    {value}
                </div>
                {sub && (
                    <div className="text-tp-xxs truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                        {sub}
                    </div>
                )}
            </div>
        </div>
    )
}

function FilterPill({ label, icon, count, accent, active, onClick }: any) {
    return (
        <button onClick={onClick} type="button"
            className="flex-shrink-0 flex items-center gap-1.5 text-tp-xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-xl transition-all"
            style={active ? {
                background: accent ? `color-mix(in srgb, ${accent} 14%, transparent)` : 'var(--app-primary)',
                color: accent || 'white',
                border: accent ? `1.5px solid ${accent}` : '1.5px solid var(--app-primary)',
            } : {
                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                color: 'var(--app-muted-foreground)',
            }}>
            {icon}
            <span>{label}</span>
            {count != null && (
                <span className="font-mono tabular-nums px-1.5 py-0.5 rounded-full text-tp-xxs"
                    style={{
                        background: active
                            ? `color-mix(in srgb, ${accent || 'white'} 20%, transparent)`
                            : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                        color: active ? (accent || 'white') : 'var(--app-muted-foreground)',
                    }}>
                    {count}
                </span>
            )}
        </button>
    )
}

/* ─── PeriodPicker — one chip, presets + native calendar merged ─── */
function todayLocalIso() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function PeriodPicker({ value, onChange, bounds }: {
    value: string
    onChange: (v: string) => void
    bounds: { start: string; end: string } | null
}) {
    const [open, setOpen] = useState(false)
    const btnRef = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    const dateRef = useRef<HTMLInputElement>(null)

    // Local-date ISO — avoids UTC shifting "today" to yesterday/tomorrow
    // for users away from UTC.
    const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const now = new Date()
    const allPresets = [
        { key: 'today', label: 'Today', date: iso(now) },
        { key: 'this_month', label: 'This month', date: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) },
        { key: 'last_month', label: 'Last month', date: iso(new Date(now.getFullYear(), now.getMonth(), 0)) },
        { key: 'ytd', label: 'YTD', date: iso(now) },
        { key: 'last_year', label: 'Last year', date: iso(new Date(now.getFullYear() - 1, 11, 31)) },
    ] as const

    // When an FY is selected, only presets inside the window are offered —
    // and the FY end is always available as an explicit preset.
    const presets = useMemo(() => {
        if (!bounds) return allPresets as readonly { key: string; label: string; date: string }[]
        const inRange = (d: string) => d >= bounds.start && d <= bounds.end
        const filtered = allPresets.filter(p => inRange(p.date))
        return [
            ...filtered,
            { key: 'fy_end', label: 'FY end', date: bounds.end },
            { key: 'fy_start', label: 'FY start', date: bounds.start },
        ]
    }, [bounds])

    const activeKey = useMemo(() => presets.find(p => p.date === value)?.key ?? 'custom', [value, presets])
    const formatted = useMemo(() => {
        if (!value) return 'Pick a date'
        const d = new Date(value + 'T00:00:00')
        return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    }, [value])

    useEffect(() => {
        if (!open) return
        const onDoc = (e: MouseEvent) => {
            if (panelRef.current?.contains(e.target as Node)) return
            if (btnRef.current?.contains(e.target as Node)) return
            setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', onDoc)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDoc)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const pickDate = (v: string) => {
        // When a FY is active, reject clicks that fall outside the window —
        // opening balance semantics only make sense inside the chosen FY.
        if (bounds && v) {
            if (v < bounds.start) v = bounds.start
            else if (v > bounds.end) v = bounds.end
        }
        onChange(v); setOpen(false)
    }
    const openNativePicker = () => {
        const el = dateRef.current
        if (!el) return
        if (typeof (el as any).showPicker === 'function') {
            try { (el as any).showPicker(); return } catch { /* fall-through */ }
        }
        el.focus(); el.click()
    }

    return (
        <div className="relative inline-block">
            <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all hover:brightness-110"
                style={{
                    background: open
                        ? 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))'
                        : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                    border: open
                        ? '1px solid color-mix(in srgb, var(--app-primary) 35%, transparent)'
                        : '1px solid var(--app-border)',
                    color: open ? 'var(--app-primary)' : 'var(--app-foreground)',
                    height: 32,
                }}>
                <Calendar size={12}
                    style={{ color: open ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                <span className="text-tp-sm font-medium tabular-nums">{formatted}</span>
                {activeKey !== 'custom' && (
                    <span className="text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            color: 'var(--app-primary)',
                        }}>
                        {presets.find(p => p.key === activeKey)?.label}
                    </span>
                )}
                <ChevronDown size={11}
                    style={{
                        color: 'var(--app-muted-foreground)',
                        transform: open ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                    }} />
            </button>

            {open && (
                <div ref={panelRef}
                    className="absolute z-50 mt-1.5 left-0 rounded-2xl p-2 animate-in fade-in slide-in-from-top-1 duration-150"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                        boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                        minWidth: 220,
                    }}>
                    <div className="text-tp-xxs font-black uppercase tracking-widest px-2 py-1"
                        style={{ color: 'var(--app-muted-foreground)' }}>Presets</div>
                    <div className="grid grid-cols-2 gap-1">
                        {presets.map(p => {
                            const isActive = activeKey === p.key
                            return (
                                <button key={p.key} type="button" onClick={() => pickDate(p.date)}
                                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-tp-sm font-medium transition-all text-left"
                                    style={isActive ? {
                                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                        color: 'var(--app-primary)',
                                        border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                    } : {
                                        background: 'transparent', color: 'var(--app-foreground)',
                                        border: '1px solid transparent',
                                    }}>
                                    <span>{p.label}</span>
                                    {isActive && <Check size={11} />}
                                </button>
                            )
                        })}
                    </div>
                    <div className="h-px my-2"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
                    <div className="text-tp-xxs font-black uppercase tracking-widest px-2 py-1"
                        style={{ color: 'var(--app-muted-foreground)' }}>Custom date</div>
                    <button type="button" onClick={openNativePicker}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-tp-sm font-medium transition-all text-left"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-foreground)',
                        }}>
                        <Calendar size={12} style={{ color: 'var(--app-muted-foreground)' }} />
                        <span className="flex-1 tabular-nums">{formatted}</span>
                        <span className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>
                            Open calendar
                        </span>
                    </button>
                    <input ref={dateRef} type="date" value={value}
                        min={bounds?.start}
                        max={bounds?.end}
                        onChange={e => pickDate(e.target.value)}
                        aria-label="Custom date"
                        className="absolute w-px h-px opacity-0 pointer-events-none"
                        tabIndex={-1} />
                    {bounds && (
                        <p className="px-2 pt-1.5 text-tp-xxs"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            Constrained to {bounds.start} → {bounds.end} (selected fiscal year)
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
