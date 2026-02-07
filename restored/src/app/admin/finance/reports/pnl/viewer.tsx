'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { getProfitAndLossReport } from '@/app/actions/finance/accounts'
import { Printer, Calendar, TrendingUp, TrendingDown, ChevronRight, ChevronDown, Download } from 'lucide-react'

export default function PnlViewer({ initialData, fiscalYears }: { initialData: any[], fiscalYears: any[] }) {
    const now = new Date()
    const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0])

    const [data, setData] = useState(initialData)
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleRefresh = () => {
        startTransition(async () => {
            const report = await getProfitAndLossReport(new Date(startDate), new Date(endDate))
            setData(report)
        })
    }

    const { incomes, expenses, netProfit } = useMemo(() => {
        const inc = data.filter(a => a.type === 'INCOME' && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
        const exp = data.filter(a => a.type === 'EXPENSE' && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))

        const totalInc = inc.reduce((sum, a) => sum + a.balance, 0)
        const totalExp = exp.reduce((sum, a) => sum + a.balance, 0)

        return { incomes: inc, expenses: exp, netProfit: totalInc - totalExp }
    }, [data])

    const formatAmount = (val: number) => {
        if (!mounted) return val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        return val.toLocaleString(undefined, { minimumFractionDigits: 2 })
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Controls */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-wrap items-end justify-between gap-4 print:hidden">
                <div className="flex gap-4 items-end">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
                            <Calendar size={12} /> Start Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="border border-stone-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
                            <Calendar size={12} /> End Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="border border-stone-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                        />
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isPending}
                        className="bg-stone-900 text-white px-6 py-2.5 rounded-lg hover:bg-black font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isPending ? 'Calculating...' : 'Update Report'}
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

            {/* Hero Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard
                    title="Total Income"
                    amount={incomes.reduce((sum, a) => sum + a.balance, 0)}
                    icon={<TrendingUp className="text-emerald-500" />}
                    color="emerald"
                    formatAmount={formatAmount}
                />
                <SummaryCard
                    title="Total Expenses"
                    amount={expenses.reduce((sum, a) => sum + a.balance, 0)}
                    icon={<TrendingDown className="text-rose-500" />}
                    color="rose"
                    formatAmount={formatAmount}
                />
                <div className={`p-6 rounded-2xl border-2 flex flex-col justify-center ${netProfit >= 0 ? 'bg-stone-900 border-stone-800 text-white shadow-xl shadow-stone-200' : 'bg-rose-900 border-rose-800 text-white shadow-xl shadow-rose-200'}`}>
                    <p className="text-[10px] font-bold uppercase opacity-60 tracking-[0.2em] mb-1">Net Profit / Loss</p>
                    <p className="text-3xl font-mono font-bold">
                        {formatAmount(netProfit)}
                    </p>
                    <p className="text-xs mt-2 opacity-60 font-medium">Bottom Line for chosen period</p>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-3xl shadow-xl shadow-stone-100 border border-stone-200 overflow-hidden">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-stone-50 text-stone-400 uppercase text-[10px] tracking-[0.2em] font-bold border-b border-stone-100">
                            <th className="p-6 text-left">Account Description</th>
                            <th className="p-6 text-right w-48">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                        {/* Income Section */}
                        <tr className="bg-emerald-50/30">
                            <td colSpan={2} className="px-6 py-3 text-emerald-800 font-black uppercase tracking-widest text-[11px]">Operating Income</td>
                        </tr>
                        {incomes.map(acc => (
                            <ReportRow key={acc.id} account={acc} allAccounts={data} level={0} formatAmount={formatAmount} />
                        ))}
                        <TotalRow title="Total Income" amount={incomes.reduce((sum, a) => sum + a.balance, 0)} color="emerald" formatAmount={formatAmount} />

                        {/* Expense Section */}
                        <tr className="bg-rose-50/30">
                            <td colSpan={2} className="px-6 py-3 text-rose-800 font-black uppercase tracking-widest text-[11px]">Operating Expenses</td>
                        </tr>
                        {expenses.map(acc => (
                            <ReportRow key={acc.id} account={acc} allAccounts={data} level={0} formatAmount={formatAmount} />
                        ))}
                        <TotalRow title="Total Expenses" amount={expenses.reduce((sum, a) => sum + a.balance, 0)} color="rose" formatAmount={formatAmount} />

                        {/* Final Net */}
                        <tr className="bg-stone-900 text-white border-t-4 border-white">
                            <td className="p-8 text-xl font-serif font-bold italic">Net Profit / Loss</td>
                            <td className="p-8 text-right text-2xl font-mono font-bold">
                                {formatAmount(netProfit)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="text-center py-10 opacity-30 text-[10px] font-bold uppercase tracking-[0.3em] font-mono">
                TSF Financial Control System ΓÇó Integrity Confirmed ΓÇó {mounted ? new Date().toLocaleDateString() : ''}
            </div>
        </div>
    )
}

function SummaryCard({ title, amount, icon, color, formatAmount }: any) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">{title}</p>
                <p className="text-2xl font-mono font-bold text-stone-900">{formatAmount(amount)}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${color}-50`}>
                {icon}
            </div>
        </div>
    )
}

function ReportRow({ account, level, allAccounts, formatAmount }: any) {
    const [expanded, setExpanded] = useState(level < 1)
    const isParent = account.children && account.children.length > 0
    const hasBalance = Math.abs(account.balance) > 0.001

    if (!hasBalance && !isParent) return null

    return (
        <>
            <tr className={`group transition-colors ${isParent ? 'bg-stone-50/40 font-bold' : 'hover:bg-stone-50/30'}`}>
                <td className="p-4" style={{ paddingLeft: `${level * 24 + 24}px` }}>
                    <div className="flex items-center gap-3">
                        {isParent && (
                            <button onClick={() => setExpanded(!expanded)} className="text-stone-300 hover:text-stone-900 transition-colors">
                                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                        )}
                        <span className="text-stone-400 font-mono text-[10px] mr-2 opacity-0 group-hover:opacity-100 transition-opacity">{account.code}</span>
                        <span className={isParent ? 'text-stone-900' : 'text-stone-600'}>{account.name}</span>
                    </div>
                </td>
                <td className="p-4 text-right font-mono font-medium text-stone-800">
                    {formatAmount(account.balance)}
                </td>
            </tr>
            {isParent && expanded && account.children.map((childId: any) => {
                const child = typeof childId === 'object' ? childId : allAccounts.find((a: any) => a.id === childId)
                if (!child) return null
                return <ReportRow key={child.id} account={child} level={level + 1} allAccounts={allAccounts} formatAmount={formatAmount} />
            })}
        </>
    )
}

function TotalRow({ title, amount, color, formatAmount }: any) {
    const isEmerald = color === 'emerald'
    return (
        <tr className={isEmerald ? 'bg-emerald-50/50' : 'bg-rose-50/50'}>
            <td className="p-6 text-right font-bold uppercase tracking-widest text-xs text-stone-400">{title}</td>
            <td className={`p-6 text-right font-mono font-black text-lg ${isEmerald ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatAmount(amount)}
            </td>
        </tr>
    )
}