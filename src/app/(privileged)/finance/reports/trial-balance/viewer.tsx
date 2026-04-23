// @ts-nocheck
'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { getTrialBalanceReport } from '@/app/actions/finance/accounts'
import { FileText, Scale } from 'lucide-react'
import {
    ReportHeader, StatementHeader, ReportControls, DateField, PeriodPresets, StatusBanner,
    ReportPanel, ReportTableHead, AccountRow, SectionRow,
    ReportFootnote, useMoneyFormatter, exportCSV, flattenAccounts,
} from '../_shared/components'

const TYPE_META: Record<string, { label: string; accent: string }> = {
    ASSET: { label: 'Assets', accent: 'var(--app-success)' },
    LIABILITY: { label: 'Liabilities', accent: 'var(--app-warning)' },
    EQUITY: { label: 'Equity', accent: 'var(--app-info)' },
    INCOME: { label: 'Income', accent: 'var(--app-primary)' },
    EXPENSE: { label: 'Expenses', accent: 'var(--app-error)' },
}

export default function TrialBalanceViewer({ initialAccounts, fiscalYears }: {
    initialAccounts: any[]; fiscalYears: any[]
}) {
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
    const [accounts, setAccounts] = useState(initialAccounts)
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)
    const formatAmount = useMoneyFormatter(mounted)
    useEffect(() => { setMounted(true) }, [])

    const handleRefresh = () => {
        startTransition(async () => {
            const data = await getTrialBalanceReport(new Date(asOfDate))
            setAccounts(data)
        })
    }

    const grouped = useMemo(() => {
        const order = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
        return order.map(type => ({
            type,
            items: accounts
                .filter(a => a.type === type && !a.parentId)
                .sort((a, b) => a.code.localeCompare(b.code)),
        }))
    }, [accounts])

    const totals = useMemo(() => {
        let debit = 0, credit = 0
        accounts.filter(a => !a.parentId).forEach(acc => {
            if (acc.balance > 0) debit += acc.balance
            else credit += Math.abs(acc.balance)
        })
        return { debit, credit, diff: Math.abs(debit - credit) }
    }, [accounts])
    const isBalanced = totals.diff < 0.01

    const handleExport = () => {
        const rows: any[] = []
        grouped.forEach(g => {
            if (g.items.length === 0) return
            rows.push({ code: '', name: `— ${TYPE_META[g.type].label.toUpperCase()} —`, debit: '', credit: '' })
            flattenAccounts(g.items, accounts).forEach(r => {
                const bal = r.balance
                rows.push({
                    code: r.code, name: r.name,
                    debit: bal > 0 ? bal.toFixed(2) : '',
                    credit: bal < 0 ? Math.abs(bal).toFixed(2) : '',
                })
            })
        })
        rows.push({ code: '', name: 'STATEMENT TOTALS', debit: totals.debit.toFixed(2), credit: totals.credit.toFixed(2) })
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
        <div className="report-print-root flex flex-col gap-4 p-4 md:px-6 md:pt-6 md:pb-2 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            <ReportHeader backHref="/finance/reports"
                title="Trial Balance"
                subtitle="General-ledger integrity report"
                icon={<Scale size={20} />}
                iconColor="var(--app-primary)" />

            <ReportControls onRefresh={handleRefresh} refreshing={isPending}
                refreshLabel="Generate"
                onExport={handleExport}
                onPrint={() => window.print()}>
                <DateField label="Balance as of" value={asOfDate} onChange={setAsOfDate} />
                <div className="flex flex-col gap-1 self-end pb-0.5">
                    <span className="text-tp-xxs font-bold uppercase tracking-wide"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        Preset
                    </span>
                    <PeriodPresets mode="single"
                        onPick={({ end }) => setAsOfDate(end)} />
                </div>
            </ReportControls>

            <StatementHeader reportName="Trial Balance"
                period={`As of ${new Date(asOfDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`} />

            {!isPending && (
                <StatusBanner ok={isBalanced}
                    okTitle="Trial Balance verified"
                    okMessage="All accounts net to zero — integrity check passed."
                    failTitle="System out of balance"
                    failMessage={`Total Debits do not match Total Credits. Difference: ${formatAmount(totals.diff)}`} />
            )}

            <ReportPanel title="Balance by account" icon={<FileText size={13} />} accent="var(--app-primary)">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <ReportTableHead columns="debit-credit" />
                        <tbody>
                            {grouped.map(group => {
                                if (group.items.length === 0) return null
                                const meta = TYPE_META[group.type]
                                return [
                                    <SectionRow key={`head-${group.type}`}
                                        title={meta.label} accent={meta.accent} colSpan={4} />,
                                    ...group.items.map(acc => (
                                        <AccountRow key={acc.id}
                                            account={acc} allAccounts={accounts}
                                            formatAmount={formatAmount}
                                            columns="debit-credit" accent={meta.accent} />
                                    )),
                                ]
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{
                                background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                                borderTop: '2px solid color-mix(in srgb, var(--app-primary) 40%, var(--app-border))',
                            }}>
                                <td colSpan={2} className="px-4 py-3 text-right text-tp-xxs font-bold uppercase tracking-wide"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    Statement totals
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-tp-xl tabular-nums"
                                    style={{ color: 'var(--app-foreground)' }}>
                                    {formatAmount(totals.debit)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-tp-xl tabular-nums"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    {formatAmount(totals.credit)}
                                </td>
                            </tr>
                            {!isBalanced && (
                                <tr style={{
                                    background: 'color-mix(in srgb, var(--app-error) 8%, transparent)',
                                    borderTop: '1px solid color-mix(in srgb, var(--app-error) 30%, transparent)',
                                }}>
                                    <td colSpan={2} className="px-4 py-2 text-right text-tp-xxs font-bold uppercase tracking-wide"
                                        style={{ color: 'var(--app-error)' }}>
                                        Difference
                                    </td>
                                    <td colSpan={2} className="px-4 py-2 text-right font-mono font-bold text-tp-md tabular-nums"
                                        style={{ color: 'var(--app-error)' }}>
                                        {formatAmount(totals.diff)}
                                    </td>
                                </tr>
                            )}
                        </tfoot>
                    </table>
                </div>
            </ReportPanel>

            <ReportFootnote mounted={mounted} />
        </div>
    )
}
