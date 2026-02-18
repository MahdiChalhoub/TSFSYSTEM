'use client'

import { useState } from 'react'
import {
    Wallet,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    FileText,
    Users,
    ArrowRight,
    Search,
    Package,
    AlertCircle,
    CheckCircle,
    RefreshCw
} from 'lucide-react'
import { syncInventoryValueToLedger } from '@/app/actions/finance/inventory-integration'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getFinancialDashboardStats } from '@/app/actions/finance/dashboard'
import { useAdmin } from '@/context/AdminContext'
import { useTransition, useEffect } from 'react'
import clsx from 'clsx'
import { toast } from 'sonner'

export default function FinanceDashboardViewer({ initialStats }: { initialStats: any }) {
    const { viewScope } = useAdmin()
    const [stats, setStats] = useState(initialStats)
    const [isPending, startTransition] = useTransition()

    // Sync with global sidebar scope
    useEffect(() => {
        startTransition(async () => {
            const newStats = await getFinancialDashboardStats(viewScope)
            setStats(newStats)
        })
    }, [viewScope])

    const isLoading = isPending

    return (
        <div className={`space-y-10 transition-opacity duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>

            {/* View Mode Indicator */}
            <div className="flex items-center gap-3">
                <div className={clsx(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                    viewScope === 'OFFICIAL' ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-stone-50 border-stone-200 text-stone-500"
                )}>
                    {viewScope === 'OFFICIAL' ? 'Official View (Tax)' : 'Total View (Management)'}
                </div>
                {isLoading && <RefreshCw size={14} className="animate-spin text-stone-400" />}
            </div>
            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Cash on Hand"
                    value={stats.totalCash}
                    icon={<Wallet className="text-emerald-500" />}
                    description="Total Bank + Cash"
                />
                <MetricCard
                    title="Net Profit (Oct)"
                    value={stats.netProfit}
                    icon={<TrendingUp className={stats.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'} />}
                    description="Monthly Performance"
                    isProfit={true}
                />
                <MetricCard
                    title="Receivables"
                    value={stats.totalAR}
                    icon={<ArrowUpRight className="text-sky-500" />}
                    description="Due from Customers"
                    color="sky"
                />
                <MetricCard
                    title="Payables"
                    value={stats.totalAP}
                    icon={<ArrowDownRight className="text-amber-500" />}
                    description="Due to Suppliers"
                    color="amber"
                />
                <InventoryIntegrityCard status={stats.inventoryStatus} />
            </div>

            {/* Middle Section: Trends & P&L Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* 6-Month Profit Trend (CSS Bars) */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-stone-200 p-8">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-lg font-bold text-stone-900 font-serif lowercase italic">Profit trends (Last 6 Months)</h3>
                        <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Income</div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-stone-300"></div> Expense</div>
                        </div>
                    </div>

                    <div className="h-64 flex items-end justify-between gap-4 px-4">
                        {stats.trends.map((t: any, i: number) => {
                            const maxVal = Math.max(...stats.trends.map((x: any) => Math.max(x.income, x.expense))) || 1
                            const incHeight = (t.income / maxVal) * 100
                            const expHeight = (t.expense / maxVal) * 100

                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                                    <div className="w-full flex justify-center gap-1 h-full items-end">
                                        <div
                                            className="w-1/3 bg-emerald-500 rounded-t-lg transition-all duration-500 group-hover:bg-emerald-600"
                                            style={{ height: `${incHeight}%` }}
                                            title={`Income: ${t.income.toFixed(0)}`}
                                        ></div>
                                        <div
                                            className="w-1/3 bg-stone-100 rounded-t-lg transition-all duration-500 group-hover:bg-stone-200"
                                            style={{ height: `${expHeight}%` }}
                                            title={`Expense: ${t.expense.toFixed(0)}`}
                                        ></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-stone-400 uppercase">{t.month}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Monthly Breakdown */}
                <div className="bg-stone-900 rounded-3xl p-8 text-white flex flex-col justify-between shadow-2xl">
                    <div>
                        <h3 className="text-lg font-bold italic font-serif mb-6 opacity-80">Current Month P&L</h3>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <span className="text-stone-400 text-sm">Monthly Revenue</span>
                                <span className="font-mono text-emerald-400 font-bold">+{stats.monthlyIncome.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-stone-400 text-sm">Monthly Expenses</span>
                                <span className="font-mono text-rose-400 font-bold">-{stats.monthlyExpense.toLocaleString()}</span>
                            </div>
                            <div className="border-t border-stone-800 pt-6 flex justify-between items-center">
                                <span className="text-lg font-bold">Net Profit</span>
                                <span className="text-2xl font-mono font-black">{stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    <Link
                        href="/finance/reports/pnl"
                        className="mt-8 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all border border-white/10"
                    >
                        View Full P&L Report <ArrowRight size={16} />
                    </Link>
                </div>
            </div>

            {/* Bottom Section: Recent Entries */}
            <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-stone-900 font-serif">Recent Ledger Activity</h3>
                    <Link href="/finance/ledger" className="text-xs font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700">All Transactions</Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-stone-50 text-stone-400 uppercase text-[10px] tracking-widest font-bold">
                            <tr>
                                <th className="p-6 text-left">Date</th>
                                <th className="p-6 text-left">Description / Voucher</th>
                                <th className="p-6 text-left">Accounts Involved</th>
                                <th className="p-6 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                            {stats.recentEntries.map((entry: any) => (
                                <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors group">
                                    <td className="p-6 text-stone-500 font-mono text-xs">
                                        {new Date(entry.transactionDate).toLocaleDateString()}
                                    </td>
                                    <td className="p-6">
                                        <div className="font-bold text-stone-900">{entry.description}</div>
                                        <div className="text-[10px] text-stone-400 uppercase font-black">J-#{entry.id} {entry.reference ? `• ${entry.reference}` : ''}</div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex gap-1 flex-wrap">
                                            {entry.lines.map((l: any, i: number) => (
                                                <span key={i} className="px-2 py-0.5 bg-stone-100 text-stone-500 text-[10px] rounded font-bold">
                                                    {l.account.name}
                                                </span>
                                            ))}
                                            {entry.lines.length > 2 && <span className="text-[10px] text-stone-400">...</span>}
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${entry.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700' :
                                            entry.status === 'REVERSED' ? 'bg-rose-50 text-rose-700' : 'bg-stone-100 text-stone-500'
                                            }`}>
                                            {entry.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <QuickLink
                    href="/finance/ledger/new"
                    icon={<FileText size={18} />}
                    title="New Journal"
                    desc="Post manual transaction"
                />
                <QuickLink
                    href="/finance/reports/trial-balance"
                    icon={<Search size={18} />}
                    title="Integrity Check"
                    desc="View trial balance"
                />
                <QuickLink
                    href="/finance/chart-of-accounts"
                    icon={<Users size={18} />}
                    title="Setup Accounts"
                    desc="Manage hierarchy"
                />
            </div>
        </div>
    )
}

function MetricCard({ title, value, icon, description, isProfit, color = 'stone' }: any) {
    const isNeg = isProfit && value < 0
    return (
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 opacity-5 group-hover:scale-110 transition-transform bg-${color}-500 rounded-full`}></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-3 bg-white shadow-sm border border-stone-100 rounded-xl">
                    {icon}
                </div>
            </div>
            <p className="text-[10px] font-bold uppercase text-stone-400 tracking-[0.1em] mb-1">{title}</p>
            <h4 className={`text-2xl font-mono font-bold ${isNeg ? 'text-rose-600' : 'text-stone-900'}`}>
                {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-xs text-stone-500 font-medium mt-1">{description}</p>
        </div>
    )
}

function InventoryIntegrityCard({ status }: { status: any }) {
    const [isSyncing, setIsSyncing] = useState(false)
    const router = useRouter()

    const isOutOfSync = Math.abs(status.discrepancy) > 0.01

    const handleSync = async () => {
        if (!confirm('This will create a Journal Entry to match your ledger to the physical stock value. Continue?')) return
        setIsSyncing(true)
        try {
            const res = await syncInventoryValueToLedger()
            if (res.success) {
                toast.success(res.message)
                window.location.reload()
            }
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-stone-50 border border-stone-100 rounded-xl">
                    <Package className={isOutOfSync ? 'text-amber-500' : 'text-emerald-500'} />
                </div>
                {isOutOfSync && (
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-all disabled:opacity-50"
                        title="Sync Ledger to Stock Value"
                    >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    </button>
                )}
            </div>

            <p className="text-[10px] font-bold uppercase text-stone-400 tracking-[0.1em] mb-1">Inventory Value</p>
            <div className="flex items-baseline gap-2">
                <h4 className="text-2xl font-mono font-bold text-stone-900">
                    {status.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h4>
                {isOutOfSync && (
                    <div className="flex items-center gap-1 text-[9px] font-black text-amber-500 uppercase tracking-tighter">
                        <AlertCircle size={10} /> Sync Required
                    </div>
                )}
            </div>

            <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[10px] font-medium">
                    <span className="text-stone-400">Ledger Balance:</span>
                    <span className="text-stone-600 font-mono">{status.ledgerBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-stone-400">Discrepancy:</span>
                    <span className={isOutOfSync ? 'text-amber-600' : 'text-emerald-600 font-mono'}>
                        {isOutOfSync ? (status.discrepancy > 0 ? '+' : '') + status.discrepancy.toLocaleString() : 'Match'}
                    </span>
                </div>
            </div>
        </div>
    )
}

function QuickLink({ href, icon, title, desc }: any) {
    return (
        <Link
            href={href}
            className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-stone-200 hover:border-stone-900 transition-all group"
        >
            <div className="w-12 h-12 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400 group-hover:bg-stone-900 group-hover:text-white transition-all">
                {icon}
            </div>
            <div>
                <h5 className="font-bold text-stone-900">{title}</h5>
                <p className="text-xs text-stone-500 font-medium">{desc}</p>
            </div>
        </Link>
    )
}