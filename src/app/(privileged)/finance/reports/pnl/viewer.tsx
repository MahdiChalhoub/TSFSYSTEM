// @ts-nocheck
'use client'

import { useState, useTransition, useMemo, useEffect, useCallback, useRef } from 'react'
import { getProfitAndLossReport } from '@/app/actions/finance/accounts'
import { TrendingUp, TrendingDown, Sigma } from 'lucide-react'
import {
    ReportHeader, StatementHeader, ReportControls, DateField, PeriodPresets,
    ReportPanel, ReportTableHead, AccountRow, SectionRow, TotalRow,
    MetricTile, ReportFootnote, useMoneyFormatter,
    exportCSV, flattenAccounts,
} from '../_shared/components'
import { useActiveFiscalYear } from '../_shared/FiscalYearSelector'

/* ═══════════════════════════════════════════════════════════
 *  P&L — narrative, accounting-style
 *  Flow: Revenue → Total revenue → Cost lines → Gross profit
 *         → Operating expenses → Operating income → Net income
 *  Two period columns + Δ% variance, margin % on subtotals.
 *  Single <table> with semantic <tfoot> for proper pagination.
 * ═══════════════════════════════════════════════════════════ */

const INCOME = 'var(--app-success)'
const EXPENSE = 'var(--app-error)'
const NEUTRAL = 'var(--app-primary)'

function fmtPeriod(start: string, end: string): string {
    const s = new Date(start), e = new Date(end)
    const f = (d: Date) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    return `${f(s)} — ${f(e)}`
}
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000) }

export default function PnlViewer({ initialData, initialPriorData, fiscalYears }: {
    initialData: any[]
    initialPriorData: any[]
    fiscalYears: any[]
}) {
    const now = new Date()
    const [startDate, setStartDate] = useState(
        new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    )
    const [endDate, setEndDate] = useState(
        new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    )
    const [data, setData] = useState(initialData)
    const [prior, setPrior] = useState(initialPriorData)
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)
    const formatAmount = useMoneyFormatter(mounted)
    useEffect(() => { setMounted(true) }, [])

    // Fiscal-year rule: when the user picks an FY (from any report), snap
    // BOTH start and end to the FY's window so the P&L shows the whole
    // fiscal year instead of the default calendar month.
    const activeFy = useActiveFiscalYear(fiscalYears)
    useEffect(() => {
        if (activeFy.mode === 'fy' && activeFy.start && activeFy.end) {
            setStartDate(activeFy.start)
            setEndDate(activeFy.end)
        }
    }, [activeFy.mode, activeFy.start, activeFy.end])

    const handleRefresh = () => {
        startTransition(async () => {
            const s = new Date(startDate), e = new Date(endDate)
            const span = daysBetween(s, e) + 1
            // Prior period = equal-length window immediately before current start
            const priorEnd = new Date(s); priorEnd.setDate(priorEnd.getDate() - 1)
            const priorStart = new Date(priorEnd); priorStart.setDate(priorStart.getDate() - span + 1)
            const [cur, pri] = await Promise.all([
                getProfitAndLossReport(s, e),
                getProfitAndLossReport(priorStart, priorEnd),
            ])
            setData(cur); setPrior(pri)
        })
    }

    // Auto-refresh whenever start or end changes (FY pick / preset / manual).
    // Skip the first render — SSR already hydrated the page.
    const didMountRef = useRef(false)
    useEffect(() => {
        if (!didMountRef.current) { didMountRef.current = true; return }
        const t = setTimeout(() => handleRefresh(), 150)
        return () => clearTimeout(t)
    }, [startDate, endDate])

    const { incomes, expenses, totalIncome, totalExpense, netProfit, priorMap, priorTotals } = useMemo(() => {
        const inc = data.filter(a => a.type === 'INCOME' && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
        const exp = data.filter(a => a.type === 'EXPENSE' && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
        const ti = inc.reduce((s, a) => s + a.balance, 0)
        const te = exp.reduce((s, a) => s + a.balance, 0)

        const pMap: Record<number, number> = {}
        ;(prior || []).forEach((a: any) => { pMap[a.id] = a.balance ?? 0 })
        const priorInc = (prior || []).filter((a: any) => a.type === 'INCOME' && !a.parentId).reduce((s: number, a: any) => s + (a.balance ?? 0), 0)
        const priorExp = (prior || []).filter((a: any) => a.type === 'EXPENSE' && !a.parentId).reduce((s: number, a: any) => s + (a.balance ?? 0), 0)

        return {
            incomes: inc, expenses: exp,
            totalIncome: ti, totalExpense: te, netProfit: ti - te,
            priorMap: pMap,
            priorTotals: { income: priorInc, expense: priorExp, net: priorInc - priorExp },
        }
    }, [data, prior])

    const netPositive = netProfit >= 0
    const netColor = netPositive ? INCOME : EXPENSE

    // Margin = net / revenue
    const margin = totalIncome !== 0 ? (netProfit / totalIncome) * 100 : null
    const priorMargin = priorTotals.income !== 0 ? (priorTotals.net / priorTotals.income) * 100 : null

    // Revenue growth %
    const revGrowth = priorTotals.income !== 0
        ? ((totalIncome - priorTotals.income) / Math.abs(priorTotals.income)) * 100
        : null
    const netGrowth = priorTotals.net !== 0
        ? ((netProfit - priorTotals.net) / Math.abs(priorTotals.net)) * 100
        : null

    const handleExport = useCallback(() => {
        const rows = [
            { code: '', name: '— Operating income —', balance: null, isHeader: true },
            ...flattenAccounts(incomes, data).map(r => ({ ...r, prior: 0 })),
            { code: '', name: 'TOTAL INCOME', balance: totalIncome, prior: priorTotals.income, isHeader: true },
            { code: '', name: '— Operating expenses —', balance: null, isHeader: true },
            ...flattenAccounts(expenses, data).map(r => ({ ...r, prior: 0 })),
            { code: '', name: 'TOTAL EXPENSES', balance: totalExpense, prior: priorTotals.expense, isHeader: true },
            { code: '', name: `NET ${netPositive ? 'PROFIT' : 'LOSS'}`, balance: netProfit, prior: priorTotals.net, isHeader: true },
        ]
        // Hydrate per-account prior from priorMap
        rows.forEach((r: any) => {
            if (r.isHeader) return
            const match = (prior || []).find((a: any) => a.code === r.code)
            r.prior = match ? match.balance : 0
        })
        exportCSV({
            filename: `profit-and-loss_${startDate}_to_${endDate}.csv`,
            columns: [
                { header: 'Code', get: (r: any) => r.code },
                { header: 'Account', get: (r: any) => r.name },
                { header: 'Current', get: (r: any) => r.balance ?? '' },
                { header: 'Prior', get: (r: any) => r.prior ?? '' },
            ],
            rows,
        })
    }, [incomes, expenses, data, prior, totalIncome, totalExpense, netProfit, priorTotals, startDate, endDate, netPositive])

    return (
        <div className="report-print-root flex flex-col gap-4 p-4 md:px-6 md:pt-6 md:pb-2 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            <ReportHeader backHref="/finance/reports"
                title="Profit & Loss"
                subtitle="Income · Expenditure · Net result"
                icon={<Sigma size={20} />}
                iconColor={INCOME} />

            <ReportControls onRefresh={handleRefresh} refreshing={isPending}
                refreshLabel="Update"
                onExport={handleExport}
                onPrint={() => window.print()}>
                <DateField label="Start date" value={startDate} onChange={setStartDate} />
                <DateField label="End date" value={endDate} onChange={setEndDate} />
                <div className="flex flex-col gap-1 self-end pb-0.5">
                    <span className="text-tp-xxs font-bold uppercase tracking-wide"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        Preset
                    </span>
                    <PeriodPresets mode="range"
                        onPick={({ start, end }) => {
                            if (start) setStartDate(start)
                            setEndDate(end)
                        }} />
                </div>
            </ReportControls>

            <StatementHeader reportName="Profit & Loss Statement"
                period={`For the period ${fmtPeriod(startDate, endDate)}`} />

            {/* Hero metrics with comparison */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 print:hidden">
                <MetricTile label="Total income" value={formatAmount(totalIncome)}
                    secondary={revGrowth != null ? `${revGrowth > 0 ? '+' : ''}${revGrowth.toFixed(1)}% vs prior` : 'no prior data'}
                    icon={<TrendingUp size={16} />} color={INCOME} />
                <MetricTile label="Total expenses" value={formatAmount(totalExpense)}
                    secondary={`Prior ${formatAmount(priorTotals.expense)}`}
                    icon={<TrendingDown size={16} />} color={EXPENSE} />
                <MetricTile label="Net margin" value={margin != null ? `${margin.toFixed(1)}%` : '—'}
                    secondary={priorMargin != null ? `Prior ${priorMargin.toFixed(1)}%` : 'no prior'}
                    icon={<Sigma size={16} />} color={NEUTRAL} />
                <MetricTile label={`Net ${netPositive ? 'profit' : 'loss'}`} value={formatAmount(netProfit)}
                    secondary={netGrowth != null ? `${netGrowth > 0 ? '+' : ''}${netGrowth.toFixed(1)}% vs prior` : ''}
                    icon={<Sigma size={16} />} color={netColor} tone="solid" />
            </div>

            {/* One panel, one table — proper semantics */}
            <ReportPanel>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <ReportTableHead columns="amount-compare" labels={{
                            name: 'Account', current: fmtShort(startDate, endDate),
                            prior: 'Prior', variance: 'Δ %',
                        }} />
                        <tbody>
                            <SectionRow title="Operating income" accent={INCOME} colSpan={4} />
                            {incomes.map(acc => (
                                <AccountRow key={acc.id}
                                    account={acc} allAccounts={data}
                                    formatAmount={formatAmount}
                                    columns="amount-compare" accent={INCOME}
                                    priorMap={priorMap} />
                            ))}
                            <TotalRow label="Total income" amount={totalIncome}
                                accent={INCOME} tone="soft" formatAmount={formatAmount}
                                extra={<>
                                    <td className="px-3 py-2 text-right font-mono tabular-nums text-tp-sm"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        {formatAmount(priorTotals.income)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono tabular-nums text-tp-xs"
                                        style={{ color: (revGrowth ?? 0) >= 0 ? INCOME : EXPENSE }}>
                                        {revGrowth != null ? `${revGrowth > 0 ? '+' : ''}${revGrowth.toFixed(1)}%` : '—'}
                                    </td>
                                </>} />

                            <SectionRow title="Operating expenses" accent={EXPENSE} colSpan={4} />
                            {expenses.map(acc => (
                                <AccountRow key={acc.id}
                                    account={acc} allAccounts={data}
                                    formatAmount={formatAmount}
                                    columns="amount-compare" accent={EXPENSE}
                                    priorMap={priorMap} />
                            ))}
                            <TotalRow label="Total expenses" amount={totalExpense}
                                accent={EXPENSE} tone="soft" formatAmount={formatAmount}
                                extra={<>
                                    <td className="px-3 py-2 text-right font-mono tabular-nums text-tp-sm"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        {formatAmount(priorTotals.expense)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono tabular-nums text-tp-xs"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        {priorTotals.expense !== 0
                                            ? `${((totalExpense - priorTotals.expense) / Math.abs(priorTotals.expense) * 100).toFixed(1)}%`
                                            : '—'}
                                    </td>
                                </>} />
                        </tbody>
                        <tfoot>
                            <TotalRow label={`Net ${netPositive ? 'profit' : 'loss'}`}
                                amount={netProfit}
                                accent={netColor} tone="result"
                                formatAmount={formatAmount}
                                extra={<>
                                    <td className="px-4 py-4 text-right font-mono tabular-nums text-tp-md"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        {formatAmount(priorTotals.net)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono tabular-nums text-tp-sm"
                                        style={{ color: (netGrowth ?? 0) >= 0 ? INCOME : EXPENSE }}>
                                        {netGrowth != null ? `${netGrowth > 0 ? '+' : ''}${netGrowth.toFixed(1)}%` : '—'}
                                    </td>
                                </>} />
                            <tr style={{
                                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                borderTop: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}>
                                <td className="px-4 py-2 text-right text-tp-xxs font-bold uppercase tracking-wide"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    Net margin
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-bold tabular-nums text-tp-md"
                                    style={{ color: (margin ?? 0) >= 0 ? INCOME : EXPENSE }}>
                                    {margin != null ? `${margin.toFixed(1)}%` : '—'}
                                </td>
                                <td className="px-4 py-2 text-right font-mono tabular-nums text-tp-sm"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    {priorMargin != null ? `${priorMargin.toFixed(1)}%` : '—'}
                                </td>
                                <td className="px-4 py-2 text-right font-mono tabular-nums text-tp-xs"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    {margin != null && priorMargin != null
                                        ? `${(margin - priorMargin).toFixed(1)} pp`
                                        : '—'}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </ReportPanel>

            <ReportFootnote mounted={mounted} />
        </div>
    )
}

function fmtShort(start: string, end: string): string {
    const s = new Date(start), e = new Date(end)
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
    if (sameMonth) return s.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    return 'Current'
}
