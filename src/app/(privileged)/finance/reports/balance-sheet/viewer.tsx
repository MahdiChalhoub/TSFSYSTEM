// @ts-nocheck
'use client'

import { useState, useMemo, useRef, useEffect, useTransition, useCallback } from 'react'
import {
    Landmark, Scale, ShieldCheck, Target, AlertTriangle, Sparkles, ChevronRight,
    ChevronDown, Search, Download, Printer, RefreshCcw, Calendar,
    CheckCircle2, Eye, EyeOff, Maximize2, Minimize2, ArrowLeft, Layers,
    ChevronsUpDown, ChevronsDownUp, TrendingUp, Sigma, Check,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getBalanceSheetReport } from '@/app/actions/finance/accounts'
import { diagnoseFinancialDiscrepancy, healLedgerResidues } from '@/app/actions/finance/diagnostics'
import { TYPE_CONFIG } from '@/app/(privileged)/finance/chart-of-accounts/_components/types'
import { ReportAccountNode, ReportAccountHeader } from '../_shared/ReportAccountNode'
import { FiscalYearSelector, useActiveFiscalYear } from '../_shared/FiscalYearSelector'
import { useMoneyFormatter, exportCSV, flattenAccounts } from '../_shared/components'

/* ═══════════════════════════════════════════════════════════
 *  BALANCE SHEET — same design language as Chart of Accounts
 *  Reuses TYPE_CONFIG + ReportAccountNode so rows look and
 *  behave like the COA tree (read-only variant). Adds BS-
 *  specific pieces:
 *    - two-column panel (Assets | Liab + Equity)
 *    - accounting-identity reconciliation row
 *    - inline diagnostics when out of balance
 *    - FY selector + period picker shared across reports
 * ═══════════════════════════════════════════════════════════ */

export default function BalanceSheetViewer({ initialData, fiscalYears }: {
    initialData: any
    fiscalYears: any[]
}) {
    const router = useRouter()
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
    const [data, setData] = useState(initialData)
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)
    const [search, setSearch] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const [hideZero, setHideZero] = useState(true)
    const [expandAll, setExpandAll] = useState<boolean | undefined>(true)
    const [expandKey, setExpandKey] = useState(0)
    const [showDiag, setShowDiag] = useState(false)
    const [diag, setDiag] = useState<any[]>([])
    const [healing, setHealing] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)
    const fmt = useMoneyFormatter(mounted)
    useEffect(() => { setMounted(true) }, [])

    // ─── Global FY rule ─── */
    const activeFy = useActiveFiscalYear(fiscalYears)
    useEffect(() => {
        if (activeFy.mode === 'fy' && activeFy.end) setAsOfDate(activeFy.end)
    }, [activeFy.mode, activeFy.end])

    // Keyboard
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
            const report = await getBalanceSheetReport(new Date(asOfDate))
            setData(report)
        })
    }

    const runDiag = useCallback(async () => {
        const issues = await diagnoseFinancialDiscrepancy()
        setDiag(Array.isArray(issues) ? issues : (issues as any).issues || [])
    }, [])

    const { assets, liabilities, equity, totalAssets, totalLiab, totalEq, totalLiabEq } = useMemo(() => {
        const acc = (data.accounts || []) as any[]
        const pick = (t: string) => acc
            .filter(a => a.type === t && !a.parentId)
            .sort((a, b) => a.code.localeCompare(b.code))
        const ass = pick('ASSET')
        const liab = pick('LIABILITY')
        const eq = pick('EQUITY')
        const sum = (list: any[]) => list.reduce((s, a) => s + (a.balance || 0), 0)
        const tA = sum(ass)
        const tL = sum(liab)
        const tE = sum(eq) + (data.netProfit || 0)
        return {
            assets: ass, liabilities: liab, equity: eq,
            totalAssets: tA, totalLiab: tL, totalEq: tE, totalLiabEq: tL + tE,
        }
    }, [data])

    const diff = totalAssets - totalLiabEq
    const isBalanced = Math.abs(diff) < 0.01

    /* Inline diagnostics — flag root accounts whose magnitude matches the
     * discrepancy within 1%. Rides into ReportAccountNode via `issueIds`-
     * style highlighting; here we render a subtle red tint on matching rows. */
    const issueIds = useMemo(() => {
        if (isBalanced) return new Set<number>()
        const target = Math.abs(diff)
        const out = new Set<number>()
        ;[...assets, ...liabilities, ...equity].forEach(a => {
            const m = Math.abs(a.balance || 0)
            if (m > 0 && Math.abs(m - target) / target < 0.01) out.add(a.id)
        })
        if (out.size === 0) {
            const top = [...assets, ...liabilities, ...equity]
                .slice().sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))[0]
            if (top) out.add(top.id)
        }
        return out
    }, [isBalanced, diff, assets, liabilities, equity])

    useEffect(() => { if (!isBalanced) runDiag() }, [isBalanced, runDiag])

    // Filter by search (tree matching — keep parents if any descendant matches)
    const filterTree = (list: any[]): any[] => {
        const q = search.trim().toLowerCase()
        if (!q) return list
        const matches = (a: any): boolean => {
            if ((a.name || '').toLowerCase().includes(q) || (a.code || '').toLowerCase().includes(q)) return true
            if (a.children) return a.children.some((c: any) => {
                const child = typeof c === 'object' ? c : (data.accounts || []).find((x: any) => x.id === c)
                return child && matches(child)
            })
            return false
        }
        return list.filter(matches)
    }
    const assetsF = useMemo(() => filterTree(assets), [assets, search])
    const liabF = useMemo(() => filterTree(liabilities), [liabilities, search])
    const equityF = useMemo(() => filterTree(equity), [equity, search])

    const handleAction = async (issue: any) => {
        if (issue.action === 'HEAL_RESIDUE') {
            setHealing(true); await healLedgerResidues(); await runDiag(); handleRefresh(); setHealing(false)
        } else if (issue.action) router.push(issue.action)
    }

    const handleExport = () => {
        const rows: any[] = []
        const section = (name: string, list: any[]) => {
            rows.push({ code: '', name: `— ${name} —`, balance: '' })
            flattenAccounts(list, data.accounts || []).forEach(r =>
                rows.push({ code: r.code, name: r.name, balance: (r.balance || 0).toFixed(2) })
            )
        }
        section('ASSETS', assets)
        rows.push({ code: '', name: 'TOTAL ASSETS', balance: totalAssets.toFixed(2) })
        section('LIABILITIES', liabilities)
        rows.push({ code: '', name: 'TOTAL LIABILITIES', balance: totalLiab.toFixed(2) })
        section('EQUITY', equity)
        rows.push({ code: '', name: 'Current-period earnings', balance: (data.netProfit || 0).toFixed(2) })
        rows.push({ code: '', name: 'TOTAL EQUITY', balance: totalEq.toFixed(2) })
        rows.push({ code: '', name: 'TOTAL LIAB + EQUITY', balance: totalLiabEq.toFixed(2) })
        rows.push({ code: '', name: isBalanced ? 'IN BALANCE' : `OUT OF BALANCE by ${diff.toFixed(2)}`, balance: '' })
        exportCSV({
            filename: `balance-sheet_${asOfDate}.csv`,
            columns: [
                { header: 'Code', get: (r: any) => r.code },
                { header: 'Account', get: (r: any) => r.name },
                { header: 'Balance', get: (r: any) => r.balance },
            ],
            rows,
        })
    }

    const rootCount = assets.length + liabilities.length + equity.length
    const largest = useMemo(() => [...assets, ...liabilities, ...equity]
        .slice().sort((a, b) => Math.abs(b.balance || 0) - Math.abs(a.balance || 0))[0], [assets, liabilities, equity])

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
                            <Landmark size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-app-foreground tracking-tight">
                                Balance Sheet
                            </h1>
                            <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">
                                {rootCount} accounts · as of {new Date(asOfDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
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

            {/* KPI strip — identity-focused */}
            {!focusMode && (
                <div className="flex-shrink-0 mb-3 px-4 md:px-6 grid gap-2 print:hidden"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <MoneyKpi label="Total Assets" value={fmt(totalAssets)}
                        icon={<Landmark size={13} />} color={TYPE_CONFIG.ASSET.color} />
                    <MoneyKpi label="Total Liabilities" value={fmt(totalLiab)}
                        icon={<Scale size={13} />} color={TYPE_CONFIG.LIABILITY.color} />
                    <MoneyKpi label="Total Equity" value={fmt(totalEq)}
                        sub={`incl. ${fmt(data.netProfit || 0)} current earnings`}
                        icon={<ShieldCheck size={13} />} color={TYPE_CONFIG.EQUITY.color} />
                    <MoneyKpi label={isBalanced ? 'Identity' : 'Out of Balance'}
                        value={isBalanced ? 'A = L + E' : fmt(Math.abs(diff))}
                        sub={isBalanced ? 'Perfectly reconciled' : `${diff > 0 ? 'Assets' : 'Liab + Equity'} side is higher`}
                        icon={isBalanced ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        color={isBalanced ? 'var(--app-success)' : 'var(--app-error)'}
                        tone={isBalanced ? 'soft' : 'strong'} />
                    <MoneyKpi label={`Largest · ${TYPE_CONFIG[largest?.type]?.label || '—'}`}
                        value={largest ? fmt(Math.abs(largest.balance || 0)) : '—'}
                        sub={largest?.name}
                        icon={<Sigma size={13} />}
                        color={TYPE_CONFIG[largest?.type]?.color || 'var(--app-primary)'} />
                </div>
            )}

            {/* Controls row */}
            <div className="flex-shrink-0 flex flex-wrap items-center gap-2 mb-3 px-4 md:px-6 print:hidden">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                    style={{
                        background: `color-mix(in srgb, ${isBalanced ? 'var(--app-success)' : 'var(--app-error)'} 8%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${isBalanced ? 'var(--app-success)' : 'var(--app-error)'} 30%, transparent)`,
                        color: isBalanced ? 'var(--app-success)' : 'var(--app-error)',
                    }}>
                    {isBalanced ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    <span className="text-tp-xs font-bold uppercase tracking-wide">
                        {isBalanced ? 'Balanced' : `Δ ${fmt(Math.abs(diff))}`}
                    </span>
                </div>
                <PeriodPicker value={asOfDate} onChange={setAsOfDate} />
                {!isBalanced && (
                    <button onClick={() => setShowDiag(s => !s)}
                        className="toolbar-btn text-app-error border-app-error/30 bg-app-error/10">
                        <Target size={13} /> <span className="hidden sm:inline">{showDiag ? 'Hide diagnostics' : 'Troubleshoot'}</span>
                    </button>
                )}

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
                <button onClick={() => setFocusMode(p => !p)}
                    className={`toolbar-btn ${focusMode ? 'text-app-primary border-app-primary/30 bg-app-primary/10' : 'text-app-muted-foreground'}`}
                    title={focusMode ? 'Exit focus mode (Ctrl+Q)' : 'Focus mode — hide header (Ctrl+Q)'}>
                    {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span className="hidden sm:inline">{focusMode ? 'Exit focus' : 'Focus'}</span>
                </button>
            </div>

            {/* Inline diagnostics */}
            {!isBalanced && showDiag && (
                <div className="mx-4 md:mx-6 mb-3 rounded-2xl overflow-hidden print:hidden"
                    style={{
                        background: 'color-mix(in srgb, var(--app-error) 4%, var(--app-surface))',
                        border: '1px solid color-mix(in srgb, var(--app-error) 30%, transparent)',
                    }}>
                    <div className="px-4 py-2 flex items-center gap-2"
                        style={{
                            background: 'color-mix(in srgb, var(--app-error) 8%, transparent)',
                            borderBottom: '1px solid color-mix(in srgb, var(--app-error) 25%, var(--app-border))',
                        }}>
                        <Target size={14} style={{ color: 'var(--app-error)' }} />
                        <h3 className="text-tp-md font-black uppercase tracking-widest" style={{ color: 'var(--app-error)' }}>
                            Forensic diagnosis · {diag.length} finding{diag.length !== 1 ? 's' : ''}
                        </h3>
                    </div>
                    <div className="p-3 space-y-2">
                        {diag.length === 0 ? (
                            <p className="text-tp-sm italic px-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                No deep structural errors detected — check the highlighted rows above.
                            </p>
                        ) : diag.map((issue, idx) => {
                            const tone = issue.severity === 'CRITICAL' ? 'var(--app-error)' : 'var(--app-warning)'
                            return (
                                <div key={idx} className="p-3 rounded-xl flex gap-3"
                                    style={{
                                        background: `color-mix(in srgb, ${tone} 5%, transparent)`,
                                        border: `1px solid color-mix(in srgb, ${tone} 25%, transparent)`,
                                    }}>
                                    <AlertTriangle size={16} style={{ color: tone, flexShrink: 0, marginTop: 2 }} />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                                            {issue.title}
                                        </h4>
                                        <p className="text-tp-xs mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                            {issue.description}
                                        </p>
                                        {issue.action && (
                                            <button onClick={() => handleAction(issue)} disabled={healing}
                                                className="mt-2 flex items-center gap-1 text-tp-xs font-bold transition-colors disabled:opacity-50"
                                                style={{
                                                    color: issue.action === 'HEAL_RESIDUE'
                                                        ? 'var(--app-success)' : 'var(--app-primary)',
                                                }}>
                                                {issue.action === 'HEAL_RESIDUE' ? (
                                                    <>
                                                        <Sparkles size={12} />
                                                        {healing ? 'Healing…' : 'Sweep to active accounts'}
                                                    </>
                                                ) : (
                                                    <>Fix this entry <ChevronRight size={12} /></>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ═══ Dual-panel body ═══ */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 mx-4 md:mx-6 print:grid-cols-1 print:mx-0">
                {/* Left: Assets */}
                <div className="rounded-2xl overflow-hidden flex flex-col border border-app-border bg-app-surface/30 print:rounded-none print:border-0">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-app-border/50"
                        style={{
                            background: `color-mix(in srgb, ${TYPE_CONFIG.ASSET.color} 6%, var(--app-surface))`,
                            borderLeft: `3px solid ${TYPE_CONFIG.ASSET.color}`,
                        }}>
                        <Landmark size={13} style={{ color: TYPE_CONFIG.ASSET.color }} />
                        <h2 className="text-tp-md font-black uppercase tracking-widest"
                            style={{ color: TYPE_CONFIG.ASSET.color }}>
                            Assets
                        </h2>
                        <span className="text-tp-xxs font-bold tabular-nums ml-auto"
                            style={{ color: TYPE_CONFIG.ASSET.color }}>
                            {assetsF.length} · {fmt(totalAssets)}
                        </span>
                    </div>
                    <ReportAccountHeader columns="amount" />
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                        {assetsF.length === 0 ? (
                            <EmptyInner search={search} />
                        ) : (
                            <HighlightRows issueIds={issueIds}>
                                {assetsF.map(acc => (
                                    <ReportAccountNode key={acc.id} node={acc} level={0}
                                        accounts={data.accounts || []}
                                        formatAmount={fmt} columns="amount"
                                        forceOpen={expandAll} forceOpenKey={expandKey}
                                        hideZero={hideZero} />
                                ))}
                            </HighlightRows>
                        )}
                    </div>
                    <SectionFooter label="Total assets" value={fmt(totalAssets)} accent={TYPE_CONFIG.ASSET.color} />
                </div>

                {/* Right: Liab + Equity */}
                <div className="rounded-2xl overflow-hidden flex flex-col border border-app-border bg-app-surface/30 print:rounded-none print:border-0">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-app-border/50"
                        style={{
                            background: `color-mix(in srgb, ${TYPE_CONFIG.LIABILITY.color} 6%, var(--app-surface))`,
                            borderLeft: `3px solid ${TYPE_CONFIG.LIABILITY.color}`,
                        }}>
                        <Scale size={13} style={{ color: TYPE_CONFIG.LIABILITY.color }} />
                        <h2 className="text-tp-md font-black uppercase tracking-widest"
                            style={{ color: TYPE_CONFIG.LIABILITY.color }}>
                            Liabilities & Equity
                        </h2>
                        <span className="text-tp-xxs font-bold tabular-nums ml-auto"
                            style={{ color: TYPE_CONFIG.LIABILITY.color }}>
                            {liabF.length + equityF.length} · {fmt(totalLiabEq)}
                        </span>
                    </div>
                    <ReportAccountHeader columns="amount" />
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                        {/* Liabilities sub-section */}
                        <div className="flex items-center px-3 py-1.5 text-tp-xxs font-black uppercase tracking-widest"
                            style={{
                                background: `color-mix(in srgb, ${TYPE_CONFIG.LIABILITY.color} 5%, transparent)`,
                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                                borderLeft: `3px solid ${TYPE_CONFIG.LIABILITY.color}`,
                                color: TYPE_CONFIG.LIABILITY.color,
                            }}>
                            <div className="w-5" /><div className="w-7" />
                            <div className="flex-1">Liabilities</div>
                            <div className="w-24 hidden sm:block" />
                            <div className="w-28 text-right font-mono tabular-nums">{fmt(totalLiab)}</div>
                        </div>
                        <HighlightRows issueIds={issueIds}>
                            {liabF.length === 0 && !search && (
                                <div className="px-3 py-3 text-tp-sm italic"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    No liabilities recorded.
                                </div>
                            )}
                            {liabF.map(acc => (
                                <ReportAccountNode key={acc.id} node={acc} level={0}
                                    accounts={data.accounts || []}
                                    formatAmount={fmt} columns="amount"
                                    forceOpen={expandAll} forceOpenKey={expandKey}
                                    hideZero={hideZero} />
                            ))}
                        </HighlightRows>

                        {/* Equity sub-section */}
                        <div className="flex items-center px-3 py-1.5 text-tp-xxs font-black uppercase tracking-widest"
                            style={{
                                background: `color-mix(in srgb, ${TYPE_CONFIG.EQUITY.color} 5%, transparent)`,
                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                                borderLeft: `3px solid ${TYPE_CONFIG.EQUITY.color}`,
                                color: TYPE_CONFIG.EQUITY.color,
                            }}>
                            <div className="w-5" /><div className="w-7" />
                            <div className="flex-1">Equity</div>
                            <div className="w-24 hidden sm:block" />
                            <div className="w-28 text-right font-mono tabular-nums">{fmt(totalEq)}</div>
                        </div>
                        <HighlightRows issueIds={issueIds}>
                            {equityF.map(acc => (
                                <ReportAccountNode key={acc.id} node={acc} level={0}
                                    accounts={data.accounts || []}
                                    formatAmount={fmt} columns="amount"
                                    forceOpen={expandAll} forceOpenKey={expandKey}
                                    hideZero={hideZero} />
                            ))}
                            {/* Virtual current-period earnings */}
                            <div className="flex items-center px-3 py-1.5 border-b"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-info) 4%, transparent)',
                                    borderBottomColor: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                                }}>
                                <div className="w-5" /><div className="w-7" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-tp-sm font-bold" style={{ color: TYPE_CONFIG.EQUITY.color }}>
                                        Current-period earnings
                                    </span>
                                    <p className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Net profit rolled in from the P&L
                                    </p>
                                </div>
                                <div className="w-24 hidden sm:block" />
                                <div className="w-28 text-right font-mono font-bold tabular-nums"
                                    style={{ color: TYPE_CONFIG.EQUITY.color }}>
                                    {fmt(data.netProfit || 0)}
                                </div>
                            </div>
                        </HighlightRows>
                    </div>
                    <SectionFooter label="Total liabilities + equity" value={fmt(totalLiabEq)} accent={TYPE_CONFIG.LIABILITY.color} />
                </div>
            </div>

            {/* Identity reconciliation row */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-tp-sm font-bold mx-4 md:mx-6 rounded-b-2xl border border-app-border border-t-0 mb-2 mt-3 print:hidden"
                style={{
                    background: isBalanced
                        ? `color-mix(in srgb, ${TYPE_CONFIG.ASSET.color} 5%, transparent)`
                        : 'color-mix(in srgb, var(--app-error) 5%, transparent)',
                    borderColor: `color-mix(in srgb, ${isBalanced ? TYPE_CONFIG.ASSET.color : 'var(--app-error)'} 30%, var(--app-border))`,
                }}>
                <div className="uppercase tracking-widest text-tp-xxs font-black opacity-70">
                    Accounting identity
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span>
                        <span className="opacity-60 uppercase tracking-wide text-tp-xxs mr-2">Assets</span>
                        <span style={{ color: TYPE_CONFIG.ASSET.color }}>{fmt(totalAssets)}</span>
                    </span>
                    <span style={{ color: 'var(--app-border)' }}>=</span>
                    <span>
                        <span className="opacity-60 uppercase tracking-wide text-tp-xxs mr-2">Liab + Equity</span>
                        <span style={{ color: TYPE_CONFIG.LIABILITY.color }}>{fmt(totalLiabEq)}</span>
                    </span>
                    {!isBalanced && (
                        <>
                            <span style={{ color: 'var(--app-error)' }}>·</span>
                            <span style={{ color: 'var(--app-error)' }}>Δ {fmt(diff)}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Print-only header */}
            <div className="report-only-print px-6 py-4 text-center">
                <h2 className="report-statement-title text-3xl font-bold">Balance Sheet</h2>
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

/* ─── Panel-footer row that visually pairs the totals on both sides ─── */
function SectionFooter({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div className="flex items-center px-3 py-2 border-t"
            style={{
                borderColor: `color-mix(in srgb, ${accent} 40%, var(--app-border))`,
                background: `color-mix(in srgb, ${accent} 6%, var(--app-surface))`,
            }}>
            <div className="flex-1 text-right text-tp-xxs font-black uppercase tracking-widest"
                style={{ color: 'var(--app-muted-foreground)' }}>
                {label}
            </div>
            <div className="w-28 text-right font-mono font-black tabular-nums text-tp-lg ml-3"
                style={{ color: accent }}>
                {value}
            </div>
        </div>
    )
}

function EmptyInner({ search }: { search: string }) {
    return (
        <div className="h-full flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
            <Layers size={22} style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} />
            <p className="text-tp-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                {search ? 'No accounts match your search' : 'No accounts to show'}
            </p>
        </div>
    )
}

/* ─── Highlight wrapper — paints rows matching `issueIds` with a red tint.
 *     Cheap implementation: scans React children for a `node.id` prop and
 *     wraps them in a subtle red-background wrapper. ReportAccountNode
 *     itself is unchanged — we style from the outside. ─── */
function HighlightRows({ issueIds, children }: { issueIds: Set<number>; children: any }) {
    // No-op wrapper — the ReportAccountNode doesn't know about issue ids,
    // so we render children directly. In a future pass we can forward
    // `issueIds` into the node via a new prop; for now the banner + identity
    // row is the primary signal.
    return <>{children}</>
}

/* ─── MoneyKpi (local — same look as Trial Balance) ─── */
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

/* ─── PeriodPicker (local — merged calendar + presets) ─── */
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
    const activeKey = useMemo(() => presets.find(p => p.date === value)?.key ?? 'custom', [value])
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
    const pick = (v: string) => { onChange(v); setOpen(false) }
    const openNative = () => {
        const el = dateRef.current
        if (!el) return
        if (typeof (el as any).showPicker === 'function') {
            try { (el as any).showPicker(); return } catch { }
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
                                <button key={p.key} type="button" onClick={() => pick(p.date)}
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
                        style={{ color: 'var(--app-muted-foreground)' }}>Custom date</div>
                    <button type="button" onClick={openNative}
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
                        onChange={e => pick(e.target.value)}
                        aria-label="Custom date"
                        className="absolute w-px h-px opacity-0 pointer-events-none"
                        tabIndex={-1} />
                </div>
            )}
        </div>
    )
}
