'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { getTrialBalanceReport } from '@/app/actions/finance/accounts'
import { FileText, Printer, Calendar, AlertCircle, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react'

export default function TrialBalanceViewer({ initialAccounts, fiscalYears }: { initialAccounts: any[], fiscalYears: any[] }) {
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
    const [accounts, setAccounts] = useState(initialAccounts)
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleRefresh = () => {
        startTransition(async () => {
            const data = await getTrialBalanceReport(new Date(asOfDate))
            setAccounts(data)
        })
    }

    const grouped = useMemo(() => {
        const types = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
        return types.map(type => ({
            type,
            items: accounts.filter(a => a.type === type && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
        }))
    }, [accounts])

    // Strict Summary Calculation (Only Leaf Nodes for true TB, but rollup works too if we only use roots)
    // Actually, Trial Balance usually shows EVERY account with a balance.
    // Professional TB: Sum of all accounts MUST be 0.
    const totals = useMemo(() => {
        let debit = 0
        let credit = 0

        // We only sum ROOT nodes to avoid double counting, as they contain rollups
        // OR we sum only LEAF nodes. Let's sum ROOT nodes for easier grouping logic.
        accounts.filter(a => !a.parentId).forEach(acc => {
            if (acc.balance > 0) debit += acc.balance
            else credit += Math.abs(acc.balance)
        })

        return { debit, credit, diff: Math.abs(debit - credit) }
    }, [accounts])

    const formatAmount = (val: number | null) => {
        if (val === null) return '-'
        if (!mounted) return val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        return val.toLocaleString(undefined, { minimumFractionDigits: 2 })
    }

    const isBalanced = totals.diff < 0.01

    return (
        <div className="space-y-8 print:space-y-4">
            {/* Controls */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-wrap items-end justify-between gap-4 print:hidden">
                <div className="flex gap-4 items-end">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
                            <Calendar size={12} /> Balance As Of Date
                        </label>
                        <input
                            type="date"
                            value={asOfDate}
                            onChange={e => setAsOfDate(e.target.value)}
                            className="border border-stone-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                        />
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isPending}
                        className="bg-stone-900 text-white px-6 py-2.5 rounded-lg hover:bg-black font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isPending ? 'Updating...' : 'Generate Report'}
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => window.print()}
                        className="bg-white text-stone-600 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 font-bold text-sm shadow-sm flex items-center gap-2"
                    >
                        <Printer size={18} /> Print PDF
                    </button>
                </div>
            </div>

            {/* Status Banner */}
            {!isPending && (
                <div className={`p-4 rounded-xl border flex items-center justify-between ${isBalanced ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                    <div className="flex items-center gap-3">
                        {isBalanced ? <CheckCircle2 className="text-emerald-500" /> : <AlertCircle className="text-rose-500" />}
                        <div>
                            <p className="font-bold text-sm">
                                {isBalanced ? 'Trial Balance Verified' : 'System Out of Balance'}
                            </p>
                            <p className="text-xs opacity-80">
                                {isBalanced ? 'All accounts net to zero. Integrity check passed.' : `Warning: Total Debits do not match Total Credits. Difference: ${totals.diff.toFixed(2)}`}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-bold uppercase opacity-60">Status</div>
                        <div className="font-mono font-bold">{isBalanced ? 'HEALTHY' : 'CRITICAL'}</div>
                    </div>
                </div>
            )}

            {/* Trial Balance Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden print:border-none print:shadow-none">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-stone-900 text-white uppercase text-[10px] tracking-[0.2em] font-bold">
                            <th className="p-4 text-left w-24">Code</th>
                            <th className="p-4 text-left">Description</th>
                            <th className="p-4 text-right w-36">Debit</th>
                            <th className="p-4 text-right w-36">Credit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {grouped.map(group => (
                            <GroupRows key={group.type} group={group} allAccounts={accounts} level={0} formatAmount={formatAmount} />
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-stone-50 font-bold border-t-2 border-stone-900">
                            <td colSpan={2} className="p-4 text-right uppercase tracking-widest text-xs text-stone-500">Statement Totals</td>
                            <td className="p-4 text-right font-mono text-lg border-double border-b-4 border-stone-900">
                                {formatAmount(totals.debit)}
                            </td>
                            <td className="p-4 text-right font-mono text-lg border-double border-b-4 border-stone-900 text-stone-400">
                                {formatAmount(totals.credit)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="text-[10px] text-stone-400 text-center font-medium uppercase tracking-widest py-8">
                Generated by TSF-ERP Financial Engine ΓÇó {mounted ? new Date().toLocaleString() : ''}
            </div>
        </div>
    )
}

function GroupRows({ group, allAccounts, formatAmount, level = 0 }: { group: any, allAccounts: any[], formatAmount: any, level: number }) {
    if (group.items.length === 0) return null

    return (
        <>
            <tr className="bg-stone-50/50">
                <td colSpan={4} className="p-3 text-[11px] font-black text-stone-400 uppercase tracking-widest border-l-4 border-stone-900">
                    {group.type}s
                </td>
            </tr>
            {group.items.map((acc: any) => (
                <AccountRow key={acc.id} account={acc} level={level} allAccounts={allAccounts} formatAmount={formatAmount} />
            ))}
        </>
    )
}

function AccountRow({ account, level, allAccounts, formatAmount }: { account: any, level: number, allAccounts: any[], formatAmount: any }) {
    const [expanded, setExpanded] = useState(level < 1) // Expand roots by default
    const isParent = account.children && account.children.length > 0
    const hasBalance = Math.abs(account.balance) > 0.001

    if (!hasBalance && !isParent) return null

    return (
        <>
            <tr className={`hover:bg-stone-50/50 transition-colors group ${isParent ? 'font-bold' : ''}`}>
                <td className="p-3 font-mono text-stone-400 text-xs pl-4">
                    {account.code}
                </td>
                <td className="p-3" style={{ paddingLeft: `${level * 24 + 12}px` }}>
                    <div className="flex items-center gap-2">
                        {isParent && (
                            <button onClick={() => setExpanded(!expanded)} className="text-stone-300 hover:text-stone-900">
                                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        )}
                        <span className={isParent ? 'text-stone-900' : 'text-stone-600'}>{account.name}</span>
                    </div>
                </td>
                <td className="p-3 text-right font-mono font-medium">
                    {account.balance > 0 ? formatAmount(account.balance) : '-'}
                </td>
                <td className="p-3 text-right font-mono font-medium text-stone-500">
                    {account.balance < 0 ? formatAmount(Math.abs(account.balance)) : '-'}
                </td>
            </tr>
            {isParent && expanded && account.children.map((childId: any) => {
                const child = typeof childId === 'object' ? childId : allAccounts.find(a => a.id === childId)
                if (!child) return null
                return <AccountRow key={child.id} account={child} level={level + 1} allAccounts={allAccounts} formatAmount={formatAmount} />
            })}
        </>
    )
}