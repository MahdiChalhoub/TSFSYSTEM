// @ts-nocheck
'use client'

import { useState, useTransition, useMemo, useEffect, useCallback } from 'react'
import { getBalanceSheetReport } from '@/app/actions/finance/accounts'
import {
    Landmark, Scale, ShieldCheck, Target, AlertTriangle, Sparkles, ChevronRight,
} from 'lucide-react'
import { diagnoseFinancialDiscrepancy, healLedgerResidues } from '@/app/actions/finance/diagnostics'
import { useRouter } from 'next/navigation'
import {
    ReportHeader, StatementHeader, ReportControls, DateField, PeriodPresets, StatusBanner,
    ReportPanel, ReportTableHead, AccountRow, TotalRow,
    ReportFootnote, useMoneyFormatter, exportCSV, flattenAccounts,
} from '../_shared/components'

/* ═══════════════════════════════════════════════════════════
 *  BALANCE SHEET
 *  Assets | (Liabilities + Equity) side by side, identity
 *  reconciled across the fold. Inline diagnostics highlight the
 *  account(s) whose balance changed most between points so the
 *  user can see the suspect while looking at the numbers.
 * ═══════════════════════════════════════════════════════════ */

const ASSET = 'var(--app-success)'
const LIAB = 'var(--app-warning)'
const EQUITY = 'var(--app-info)'

export default function BalanceSheetViewer({ initialData, fiscalYears }: {
    initialData: any
    fiscalYears: any[]
}) {
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
    const [data, setData] = useState(initialData)
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)
    const [showDiag, setShowDiag] = useState(false)
    const [diag, setDiag] = useState<any[]>([])
    const [healing, setHealing] = useState(false)
    const router = useRouter()
    const formatAmount = useMoneyFormatter(mounted)
    useEffect(() => { setMounted(true) }, [])

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
        const ass = acc.filter(a => a.type === 'ASSET' && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
        const liab = acc.filter(a => a.type === 'LIABILITY' && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
        const eq = acc.filter(a => a.type === 'EQUITY' && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
        const tA = ass.reduce((s, a) => s + a.balance, 0)
        const tL = liab.reduce((s, a) => s + a.balance, 0)
        const tE = eq.reduce((s, a) => s + a.balance, 0) + (data.netProfit || 0)
        return { assets: ass, liabilities: liab, equity: eq, totalAssets: tA, totalLiab: tL, totalEq: tE, totalLiabEq: tL + tE }
    }, [data])

    const diff = totalAssets - totalLiabEq
    const isBalanced = Math.abs(diff) < 0.01

    /* ─── Inline diagnostics: pinpoint the likely source.
     * Strategy: when out of balance, flag every ROOT whose balance magnitude
     * equals the discrepancy within 1% (likely a double-booked or missing
     * counterpart). Set of IDs rides down through AccountRow to paint rows red. */
    const issueIds = useMemo(() => {
        if (isBalanced) return new Set<number>()
        const target = Math.abs(diff)
        const candidates: number[] = [];
        [...assets, ...liabilities, ...equity].forEach(acc => {
            const m = Math.abs(acc.balance || 0)
            if (m > 0 && Math.abs(m - target) / target < 0.01) candidates.push(acc.id)
        })
        // If nothing matched exactly, flag the single largest-magnitude root
        if (candidates.length === 0) {
            const all = [...assets, ...liabilities, ...equity]
            if (all.length) {
                const top = all.slice().sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))[0]
                candidates.push(top.id)
            }
        }
        return new Set(candidates)
    }, [isBalanced, diff, assets, liabilities, equity])

    // Auto-expand diagnostics panel on discrepancy
    useEffect(() => {
        if (!isBalanced) runDiag()
    }, [isBalanced, runDiag])

    const handleAction = async (issue: any) => {
        if (issue.action === 'HEAL_RESIDUE') {
            setHealing(true)
            await healLedgerResidues()
            await runDiag()
            handleRefresh()
            setHealing(false)
        } else if (issue.action) {
            router.push(issue.action)
        }
    }

    const handleExport = () => {
        const rows = [
            { code: '', name: '— ASSETS —', balance: null },
            ...flattenAccounts(assets, data.accounts),
            { code: '', name: 'TOTAL ASSETS', balance: totalAssets },
            { code: '', name: '— LIABILITIES —', balance: null },
            ...flattenAccounts(liabilities, data.accounts),
            { code: '', name: 'TOTAL LIABILITIES', balance: totalLiab },
            { code: '', name: '— EQUITY —', balance: null },
            ...flattenAccounts(equity, data.accounts),
            { code: '', name: 'Current-period earnings', balance: data.netProfit || 0 },
            { code: '', name: 'TOTAL EQUITY', balance: totalEq },
            { code: '', name: 'TOTAL LIAB + EQUITY', balance: totalLiabEq },
            { code: '', name: isBalanced ? 'IN BALANCE' : `OUT OF BALANCE by ${diff.toFixed(2)}`, balance: null },
        ]
        exportCSV({
            filename: `balance-sheet_${asOfDate}.csv`,
            columns: [
                { header: 'Code', get: (r: any) => r.code },
                { header: 'Account', get: (r: any) => r.name },
                { header: 'Balance', get: (r: any) => r.balance ?? '' },
            ],
            rows,
        })
    }

    return (
        <div className="report-print-root flex flex-col gap-4 p-4 md:px-6 md:pt-6 md:pb-2 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            <ReportHeader backHref="/finance/reports"
                title="Balance Sheet"
                subtitle="Statement of financial position"
                icon={<Landmark size={20} />}
                iconColor={ASSET} />

            <ReportControls onRefresh={handleRefresh} refreshing={isPending}
                refreshLabel="Generate" onExport={handleExport} onPrint={() => window.print()}>
                <DateField label="Statement as of" value={asOfDate} onChange={setAsOfDate} />
                <div className="flex flex-col gap-1 self-end pb-0.5">
                    <span className="text-tp-xxs font-bold uppercase tracking-wide"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        Preset
                    </span>
                    <PeriodPresets mode="single"
                        onPick={({ end }) => setAsOfDate(end)} />
                </div>
            </ReportControls>

            <StatementHeader reportName="Balance Sheet"
                period={`As of ${new Date(asOfDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`} />

            {!isPending && (
                <StatusBanner ok={isBalanced}
                    okTitle="Statement in balance"
                    okMessage="Assets perfectly match Liabilities and Equity."
                    failTitle="Account discrepancy detected"
                    failMessage={`Assets ${diff > 0 ? 'exceed' : 'trail'} Liabilities + Equity by ${formatAmount(Math.abs(diff))}${issueIds.size ? ' — suspect accounts highlighted below' : ''}.`}
                    action={!isBalanced && (
                        <button onClick={() => setShowDiag(s => !s)}
                            className="flex items-center gap-1.5 text-tp-xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-xl"
                            style={{
                                background: 'var(--app-error)', color: 'white',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-error) 30%, transparent)',
                            }}>
                            <Target size={12} /> {showDiag ? 'Hide' : 'Troubleshoot'}
                        </button>
                    )} />
            )}

            {/* Inline diagnostics panel (no modal) */}
            {!isBalanced && showDiag && (
                <div className="rounded-2xl overflow-hidden print:hidden"
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
                        <h3 className="text-tp-md font-bold uppercase tracking-wide" style={{ color: 'var(--app-error)' }}>
                            Forensic diagnosis · {diag.length} finding{diag.length !== 1 ? 's' : ''}
                        </h3>
                    </div>
                    <div className="p-3 space-y-2">
                        {diag.length === 0 ? (
                            <p className="text-tp-sm italic px-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                No deep structural errors detected — check opening balances or the highlighted rows above.
                            </p>
                        ) : (
                            diag.map((issue, idx) => {
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
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ═══ Two-column grid with locked heights so totals line up across the fold ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                {/* Left: Assets */}
                <div className="flex flex-col">
                    <ReportPanel title="Assets" icon={<Landmark size={14} />} accent={ASSET}>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <ReportTableHead columns="amount" />
                                <tbody>
                                    {assets.map(acc => (
                                        <AccountRow key={acc.id}
                                            account={acc} allAccounts={data.accounts}
                                            formatAmount={formatAmount}
                                            columns="amount" accent={ASSET}
                                            issueIds={issueIds} />
                                    ))}
                                </tbody>
                                <tfoot>
                                    <TotalRow label="Total assets" amount={totalAssets}
                                        accent={ASSET} tone="bold" formatAmount={formatAmount} />
                                </tfoot>
                            </table>
                        </div>
                    </ReportPanel>
                </div>

                {/* Right: Liabilities + Equity — combined into a SINGLE panel so totals
                     line up visually with the Assets panel's Total row across the fold. */}
                <div className="flex flex-col">
                    <ReportPanel title="Liabilities & Equity" icon={<Scale size={14} />} accent={LIAB}>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <ReportTableHead columns="amount" />
                                <tbody>
                                    {/* Liabilities section */}
                                    <tr style={{ background: `color-mix(in srgb, ${LIAB} 6%, transparent)` }}>
                                        <td colSpan={2}
                                            className="px-4 py-2 text-tp-xxs font-bold uppercase tracking-wide"
                                            style={{ color: LIAB, borderLeft: `3px solid ${LIAB}` }}>
                                            Liabilities
                                        </td>
                                    </tr>
                                    {liabilities.map(acc => (
                                        <AccountRow key={acc.id}
                                            account={acc} allAccounts={data.accounts}
                                            formatAmount={formatAmount}
                                            columns="amount" accent={LIAB}
                                            issueIds={issueIds} />
                                    ))}
                                    <TotalRow label="Total liabilities" amount={totalLiab}
                                        accent={LIAB} tone="soft" formatAmount={formatAmount} />

                                    {/* Equity section */}
                                    <tr style={{ background: `color-mix(in srgb, ${EQUITY} 6%, transparent)` }}>
                                        <td colSpan={2}
                                            className="px-4 py-2 text-tp-xxs font-bold uppercase tracking-wide"
                                            style={{ color: EQUITY, borderLeft: `3px solid ${EQUITY}` }}>
                                            Equity
                                        </td>
                                    </tr>
                                    {equity.map(acc => (
                                        <AccountRow key={acc.id}
                                            account={acc} allAccounts={data.accounts}
                                            formatAmount={formatAmount}
                                            columns="amount" accent={EQUITY}
                                            issueIds={issueIds} />
                                    ))}
                                    {/* Virtual current-period earnings */}
                                    <tr style={{
                                        background: 'color-mix(in srgb, var(--app-info) 4%, transparent)',
                                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                                    }}>
                                        <td className="px-3 py-1.5" style={{ paddingLeft: '30px' }}>
                                            <div className="flex flex-col">
                                                <span className="text-tp-sm font-bold" style={{ color: EQUITY }}>
                                                    Current-period earnings
                                                </span>
                                                <span className="text-tp-xxs"
                                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                                    Net profit rolled in from the P&L
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums text-tp-sm"
                                            style={{ color: EQUITY }}>
                                            {formatAmount(data.netProfit || 0)}
                                        </td>
                                    </tr>
                                    <TotalRow label="Total equity" amount={totalEq}
                                        accent={EQUITY} tone="soft" formatAmount={formatAmount} />
                                </tbody>
                                <tfoot>
                                    <TotalRow label="Total liabilities + equity" amount={totalLiabEq}
                                        accent={LIAB} tone="bold" formatAmount={formatAmount} />
                                </tfoot>
                            </table>
                        </div>
                    </ReportPanel>
                </div>
            </div>

            {/* Identity row across the fold */}
            <div className="rounded-2xl p-4 flex items-center justify-between gap-3"
                style={{
                    background: isBalanced
                        ? `color-mix(in srgb, ${ASSET} 6%, transparent)`
                        : 'color-mix(in srgb, var(--app-error) 6%, transparent)',
                    border: `1px solid color-mix(in srgb, ${isBalanced ? ASSET : 'var(--app-error)'} 30%, transparent)`,
                }}>
                <span className="text-tp-xxs font-bold uppercase tracking-[0.25em]"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    Accounting identity
                </span>
                <div className="flex items-center gap-3 font-mono">
                    <span className="text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>Assets</span>
                    <span className="text-tp-lg font-bold tabular-nums"
                        style={{ color: ASSET }}>{formatAmount(totalAssets)}</span>
                    <span className="text-tp-md" style={{ color: 'var(--app-muted-foreground)' }}>=</span>
                    <span className="text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>Liab + Equity</span>
                    <span className="text-tp-lg font-bold tabular-nums"
                        style={{ color: LIAB }}>{formatAmount(totalLiabEq)}</span>
                    {!isBalanced && (
                        <>
                            <span className="text-tp-md" style={{ color: 'var(--app-error)' }}>Δ</span>
                            <span className="text-tp-lg font-bold tabular-nums"
                                style={{ color: 'var(--app-error)' }}>{formatAmount(diff)}</span>
                        </>
                    )}
                </div>
            </div>

            <ReportFootnote mounted={mounted} />
        </div>
    )
}
