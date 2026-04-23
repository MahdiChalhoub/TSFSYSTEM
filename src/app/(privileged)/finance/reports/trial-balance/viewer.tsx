// @ts-nocheck
'use client'

import { useState, useMemo, useRef, useEffect, useTransition } from 'react'
import {
    Scale, ChevronDown, ChevronRight, Search, Download, Printer,
    RefreshCcw, Calendar, CheckCircle2, AlertTriangle, Eye, EyeOff,
    Maximize2, Minimize2, ArrowLeft, Layers,
    ChevronsUpDown, ChevronsDownUp, TrendingUp, TrendingDown, Sigma, Check,
} from 'lucide-react'
import Link from 'next/link'
import { getTrialBalanceReport } from '@/app/actions/finance/accounts'
import { useMoneyFormatter, exportCSV, flattenAccounts } from '../_shared/components'

/* ═══════════════════════════════════════════════════════════
 *  TRIAL BALANCE — redesign
 *  - KPIs are MONEY (debit total / credit total / Δ / …), not
 *    pointless account counts (was "1 · 1 · 1 · 1 · 3").
 *  - Type column dropped (section header already communicates it).
 *  - Section headers carry inline subtotals so users see the
 *    accounting identity at a glance.
 *  - Tree auto-expands on load; zero rows hidden by default.
 *  - Column widths tightened so data fills the viewport instead
 *    of drifting across empty space.
 * ═══════════════════════════════════════════════════════════ */

const TYPE_META: Record<string, { label: string; accent: string }> = {
    ASSET: { label: 'Assets', accent: 'var(--app-info)' },
    LIABILITY: { label: 'Liabilities', accent: 'var(--app-error)' },
    EQUITY: { label: 'Equity', accent: '#8b5cf6' },
    INCOME: { label: 'Income', accent: 'var(--app-success)' },
    EXPENSE: { label: 'Expenses', accent: 'var(--app-warning)' },
}

/* ─── Row ─── */
function Row({ a, all, fmt, lvl = 0, accent, expandAll, expandKey, showZero }: any) {
    const [open, setOpen] = useState(true) // auto-expand by default
    useEffect(() => {
        if (expandAll !== undefined) setOpen(expandAll)
    }, [expandAll, expandKey])

    const kids = a.children?.length > 0
    const bal = a.balance ?? 0
    if (!showZero && Math.abs(bal) < 0.001 && !kids) return null

    const debit = bal > 0 ? fmt(bal) : ''
    const credit = bal < 0 ? fmt(Math.abs(bal)) : ''

    return (
        <>
            <div className="flex items-center px-3 py-1 text-tp-sm"
                style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 18%, transparent)',
                    background: kids ? 'color-mix(in srgb, var(--app-surface) 35%, transparent)' : 'transparent',
                }}>
                <div className="w-5 flex-shrink-0" style={{ paddingLeft: lvl * 14 }}>
                    {kids ? (
                        <button onClick={() => setOpen(!open)}
                            className="w-4 h-4 flex items-center justify-center rounded"
                            style={{ color: open ? accent : 'var(--app-muted-foreground)' }}>
                            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        </button>
                    ) : (
                        <span className="w-1 h-1 rounded-full inline-block"
                            style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
                    )}
                </div>
                <div className="font-mono text-tp-xxs tabular-nums flex-shrink-0 w-14 pr-2"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    {a.code}
                </div>
                <div className="flex-1 min-w-0 truncate"
                    style={{ color: kids ? accent : 'var(--app-foreground)', fontWeight: kids ? 700 : 500 }}>
                    {a.name}
                </div>
                <div className="w-28 text-right font-mono tabular-nums"
                    style={{
                        color: debit ? 'var(--app-foreground)' : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)',
                        fontWeight: kids ? 700 : 400,
                    }}>
                    {debit || '—'}
                </div>
                <div className="w-28 text-right font-mono tabular-nums"
                    style={{
                        color: credit ? 'var(--app-foreground)' : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)',
                        fontWeight: kids ? 700 : 400,
                    }}>
                    {credit || '—'}
                </div>
            </div>
            {kids && open && a.children.map((c: any) => {
                const child = typeof c === 'object' ? c : all.find(x => x.id === c)
                return child ? (
                    <Row key={child.id} a={child} all={all} fmt={fmt} lvl={lvl + 1}
                        accent={accent} expandAll={expandAll} expandKey={expandKey}
                        showZero={showZero} />
                ) : null
            })}
        </>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  Viewer
 * ═══════════════════════════════════════════════════════════ */
export default function TrialBalanceViewer({ initialAccounts, fiscalYears }: {
    initialAccounts: any[]; fiscalYears: any[]
}) {
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
    const [accounts, setAccounts] = useState(initialAccounts)
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string | null>(null)
    const [showZero, setShowZero] = useState(false)
    const [focusMode, setFocusMode] = useState(false)
    const [expandAll, setExpandAll] = useState<boolean | undefined>(true)
    const [expandKey, setExpandKey] = useState(0)
    const searchRef = useRef<HTMLInputElement>(null)
    const fmt = useMoneyFormatter(mounted)
    useEffect(() => { setMounted(true) }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const handleRefresh = () => {
        startTransition(async () => {
            const d = await getTrialBalanceReport(new Date(asOfDate))
            setAccounts(d)
        })
    }

    /* ─── Per-type subtotals (debit / credit side) ─── */
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
    const leafCount = accounts.length
    const rootCount = accounts.filter(a => !a.parentId).length
    const largestAccount = useMemo(() => {
        return accounts.filter(a => !a.parentId)
            .slice().sort((a, b) => Math.abs(b.balance || 0) - Math.abs(a.balance || 0))[0]
    }, [accounts])

    /* ─── Group & filter ─── */
    const grouped = useMemo(() => {
        const order = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
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
        return order
            .map(type => ({
                type,
                items: list.filter(a => a.type === type).sort((a, b) => a.code.localeCompare(b.code)),
            }))
            .filter(g => g.items.length > 0)
    }, [accounts, typeFilter, search])

    const handleExport = () => {
        const rows: any[] = []
        grouped.forEach(g => {
            rows.push({ code: '', name: `— ${TYPE_META[g.type].label.toUpperCase()} —`, debit: '', credit: '' })
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
            filename: `trial-balance_${asOfDate}.csv`,
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
        <div className="report-print-root flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ═══ Header ═══ */}
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
                            <h1 className="text-lg md:text-xl font-bold text-app-foreground tracking-tight">Trial Balance</h1>
                            <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">
                                {rootCount} accounts · {withBalance} with balance · as of {new Date(asOfDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
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
                        <button onClick={() => setFocusMode(p => !p)}
                            className="p-1.5 rounded-xl border border-app-border text-app-muted-foreground">
                            {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ KPI strip — MONEY, not counts ═══ */}
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
                    <MoneyKpi label={`Largest · ${TYPE_META[largestAccount?.type]?.label || '—'}`}
                        value={largestAccount ? fmt(Math.abs(largestAccount.balance || 0)) : '—'}
                        sub={largestAccount?.name}
                        icon={<Sigma size={13} />}
                        color={TYPE_META[largestAccount?.type]?.accent || 'var(--app-primary)'} />
                    <MoneyKpi label="Activity" value={`${withBalance}/${rootCount}`}
                        sub={`${leafCount} total incl. sub-accounts`}
                        icon={<Layers size={13} />}
                        color="var(--app-info)" />
                </div>
            )}

            {/* ═══ Type filter pills (compact replacement for old KPIStrip filter) ═══ */}
            {!focusMode && (
                <div className="flex-shrink-0 flex items-center gap-1.5 mb-3 px-4 md:px-6 overflow-x-auto print:hidden"
                    style={{ scrollbarWidth: 'none' }}>
                    <FilterPill label="All" active={typeFilter === null}
                        onClick={() => setTypeFilter(null)} />
                    {Object.entries(TYPE_META).map(([type, meta]) => {
                        const st = typeSubtotals[type]
                        if (!st) return null
                        return (
                            <FilterPill key={type} label={meta.label}
                                count={st.count} accent={meta.accent}
                                active={typeFilter === type}
                                onClick={() => setTypeFilter(typeFilter === type ? null : type)} />
                        )
                    })}
                </div>
            )}

            {/* ═══ Controls: date / presets / search / expand / zero-toggle ═══ */}
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
                <PeriodPicker value={asOfDate} onChange={setAsOfDate} />

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
                <button onClick={() => setShowZero(p => !p)}
                    className={`toolbar-btn ${showZero ? 'text-app-warning border-app-warning/30 bg-app-warning/10' : 'text-app-muted-foreground'}`}>
                    {showZero ? <Eye size={13} /> : <EyeOff size={13} />}
                    <span className="hidden sm:inline">Zero</span>
                </button>
            </div>

            {/* ═══ Framed tree ═══ */}
            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col mx-4 md:mx-6 border border-app-border bg-app-surface/30 print:border-0 print:rounded-none print:mx-0">
                <div className="flex-shrink-0 flex items-center px-3 py-2 border-b border-app-border/50 text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground bg-app-surface/60">
                    <div className="w-5 flex-shrink-0" />
                    <div className="w-14 pr-2">Code</div>
                    <div className="flex-1">Account</div>
                    <div className="w-28 text-right">Debit</div>
                    <div className="w-28 text-right">Credit</div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {grouped.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-12 gap-2">
                            <Layers size={24} style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} />
                            <p className="text-tp-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                {search ? 'No accounts match your search' : 'No accounts to show'}
                            </p>
                        </div>
                    ) : grouped.map(g => {
                        const meta = TYPE_META[g.type]
                        const st = typeSubtotals[g.type] || { debit: 0, credit: 0, count: 0 }
                        return (
                            <div key={g.type}>
                                {/* Section header — inline subtotals, no redundant pill */}
                                <div className="flex items-center px-3 py-1.5 text-tp-xxs font-black uppercase tracking-widest"
                                    style={{
                                        background: `color-mix(in srgb, ${meta.accent} 6%, transparent)`,
                                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                                        borderLeft: `3px solid ${meta.accent}`,
                                        color: meta.accent,
                                    }}>
                                    <div className="w-5 flex-shrink-0" />
                                    <div className="w-14" />
                                    <div className="flex-1 flex items-center gap-2">
                                        <span>{meta.label}</span>
                                        <span className="opacity-60 font-mono normal-case tracking-normal">
                                            · {st.count} account{st.count !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="w-28 text-right font-mono tabular-nums"
                                        style={{ color: st.debit > 0 ? meta.accent : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)' }}>
                                        {st.debit > 0 ? fmt(st.debit) : '—'}
                                    </div>
                                    <div className="w-28 text-right font-mono tabular-nums"
                                        style={{ color: st.credit > 0 ? meta.accent : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)' }}>
                                        {st.credit > 0 ? fmt(st.credit) : '—'}
                                    </div>
                                </div>

                                {g.items.map(acc => (
                                    <Row key={acc.id} a={acc} all={accounts} fmt={fmt}
                                        accent={meta.accent}
                                        expandAll={expandAll} expandKey={expandKey}
                                        showZero={showZero} />
                                ))}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ═══ Footer totals ═══ */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-tp-sm font-bold mx-4 md:mx-6 rounded-b-2xl border border-app-border border-t-0 bg-app-surface/70 text-app-muted-foreground mb-2 print:hidden">
                <div>
                    <span className="uppercase tracking-widest text-tp-xxs font-black opacity-70">Statement totals</span>
                </div>
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

            {/* Print-only statement header */}
            <div className="report-only-print px-6 py-4 text-center">
                <h2 className="report-statement-title text-3xl font-bold">Trial Balance</h2>
                <p className="text-sm mt-1">
                    As of {new Date(asOfDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
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

/* ─── MoneyKpi — shows a money value + optional sub-caption ─── */
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
                    style={{
                        color: 'var(--app-foreground)',
                        fontSize: 'var(--tp-md, 13px)',
                    }}>
                    {value}
                </div>
                {sub && (
                    <div className="text-tp-xxs truncate"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        {sub}
                    </div>
                )}
            </div>
        </div>
    )
}

/* ─── PeriodPicker — one themed chip that reveals a popover
 *     containing preset buttons (Today · This month · Last month · YTD
 *     · Last year) AND the native calendar picker. Replaces two
 *     separate controls that used to live side-by-side. ─── */
function PeriodPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false)
    const btnRef = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    const dateRef = useRef<HTMLInputElement>(null)

    const iso = (d: Date) => d.toISOString().split('T')[0]
    const now = new Date()
    const presets = [
        { key: 'today', label: 'Today', date: iso(now) },
        { key: 'this_month', label: 'This month', date: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) },
        { key: 'last_month', label: 'Last month', date: iso(new Date(now.getFullYear(), now.getMonth(), 0)) },
        { key: 'ytd', label: 'YTD', date: iso(now) },
        { key: 'last_year', label: 'Last year', date: iso(new Date(now.getFullYear() - 1, 11, 31)) },
    ] as const

    // Identify which preset the current value matches (if any)
    const activeKey = useMemo(() => {
        return presets.find(p => p.date === value)?.key ?? 'custom'
    }, [value])

    const formatted = useMemo(() => {
        if (!value) return 'Pick a date'
        const d = new Date(value + 'T00:00:00')
        return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    }, [value])

    // Close on outside click / Esc
    useEffect(() => {
        if (!open) return
        const onDoc = (e: MouseEvent) => {
            if (
                panelRef.current?.contains(e.target as Node) ||
                btnRef.current?.contains(e.target as Node)
            ) return
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

    const pickDate = (v: string) => { onChange(v); setOpen(false) }
    const openNativePicker = () => {
        const el = dateRef.current
        if (!el) return
        if (typeof (el as any).showPicker === 'function') {
            try { (el as any).showPicker(); return } catch { /* fall through */ }
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
                    className="transition-transform"
                    style={{
                        color: 'var(--app-muted-foreground)',
                        transform: open ? 'rotate(180deg)' : 'none',
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
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        Presets
                    </div>
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
                                        background: 'transparent',
                                        color: 'var(--app-foreground)',
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
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        Custom date
                    </div>
                    <button type="button" onClick={openNativePicker}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-tp-sm font-medium transition-all text-left"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-foreground)',
                        }}>
                        <Calendar size={12} style={{ color: 'var(--app-muted-foreground)' }} />
                        <span className="flex-1 tabular-nums">{formatted}</span>
                        <span className="text-tp-xxs"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            Open calendar
                        </span>
                    </button>
                    <input ref={dateRef} type="date" value={value}
                        onChange={e => pickDate(e.target.value)}
                        aria-label="Custom date"
                        className="absolute w-px h-px opacity-0 pointer-events-none"
                        tabIndex={-1} />
                </div>
            )}
        </div>
    )
}

/* ─── FilterPill — type filter chip with count + accent ─── */
function FilterPill({ label, count, accent, active, onClick }: any) {
    return (
        <button onClick={onClick}
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
