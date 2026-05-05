'use client'

import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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

export default function FinanceDashboardViewer({ initialStats }: { initialStats: Record<string, any> }) {
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
                    viewScope === 'OFFICIAL' ? "bg-app-success-bg border-app-success text-app-success" : "bg-app-surface border-app-border text-app-muted-foreground"
                )}>
                    {viewScope === 'OFFICIAL' ? 'Official View (Tax)' : 'Total View (Management)'}
                </div>
                {isLoading && <RefreshCw size={14} className="animate-spin text-app-muted-foreground" />}
            </div>
            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Cash on Hand"
                    value={stats.totalCash}
                    icon={<Wallet className="text-app-success" />}
                    description="Total Bank + Cash"
                />
                <MetricCard
                    title="Net Profit (Oct)"
                    value={stats.netProfit}
                    icon={<TrendingUp className={stats.netProfit >= 0 ? 'text-app-success' : 'text-app-error'} />}
                    description="Monthly Performance"
                    isProfit={true}
                />
                <MetricCard
                    title="Receivables"
                    value={stats.totalAR}
                    icon={<ArrowUpRight className="text-app-info" />}
                    description="Due from Customers"
                    color="sky"
                />
                <MetricCard
                    title="Payables"
                    value={stats.totalAP}
                    icon={<ArrowDownRight className="text-app-warning" />}
                    description="Due to Suppliers"
                    color="amber"
                />
                <InventoryIntegrityCard status={stats.inventoryStatus} />
            </div>

            {/* Middle Section: Trends & P&L Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* 6-Month Profit Trend (CSS Bars) */}
                <div className="lg:col-span-2 bg-app-surface rounded-3xl shadow-sm border border-app-border p-8">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="font-serif lowercase italic">Profit trends (Last 6 Months)</h3>
                        <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-app-success"></div> Income</div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-stone-300"></div> Expense</div>
                        </div>
                    </div>

                    <div className="h-64 flex items-end justify-between gap-4 px-4">
                        {stats.trends.map((t: Record<string, any>, i: number) => {
                            const maxVal = Math.max(...stats.trends.map((x: Record<string, any>) => Math.max(x.income, x.expense))) || 1
                            const incHeight = (t.income / maxVal) * 100
                            const expHeight = (t.expense / maxVal) * 100

                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                                    <div className="w-full flex justify-center gap-1 h-full items-end">
                                        <div
                                            className="w-1/3 bg-app-success rounded-t-lg transition-all duration-500 group-hover:bg-app-success"
                                            style={{ height: `${incHeight}%` }}
                                            title={`Income: ${t.income.toFixed(0)}`}
                                        ></div>
                                        <div
                                            className="w-1/3 bg-app-surface-2 rounded-t-lg transition-all duration-500 group-hover:bg-app-surface-2"
                                            style={{ height: `${expHeight}%` }}
                                            title={`Expense: ${t.expense.toFixed(0)}`}
                                        ></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-app-muted-foreground uppercase">{t.month}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Monthly Breakdown */}
                <div className="bg-app-bg rounded-3xl p-8 text-white flex flex-col justify-between shadow-2xl">
                    <div>
                        <h3 className="italic font-serif mb-6 opacity-80">Current Month P&L</h3>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <span className="text-app-muted-foreground text-sm">Monthly Revenue</span>
                                <span className="font-mono text-emerald-400 font-bold">+{stats.monthlyIncome.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-app-muted-foreground text-sm">Monthly Expenses</span>
                                <span className="font-mono text-app-error font-bold">-{stats.monthlyExpense.toLocaleString()}</span>
                            </div>
                            <div className="border-t border-stone-800 pt-6 flex justify-between items-center">
                                <span className="text-lg font-bold">Net Profit</span>
                                <span className="text-2xl font-mono font-black">{stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    <Link
                        href="/finance/reports/pnl"
                        className="mt-8 bg-app-surface/5 hover:bg-app-surface/10 text-white py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all border border-white/10"
                    >
                        View Full P&L Report <ArrowRight size={16} />
                    </Link>
                </div>
            </div>

            {/* Bottom Section: Recent Entries */}
            <div className="bg-app-surface rounded-3xl shadow-sm border border-app-border overflow-hidden">
                <div className="p-8 border-b border-app-border flex justify-between items-center">
                    <h3 className="font-serif">Recent Ledger Activity</h3>
                    <Link href="/finance/ledger" className="text-xs font-bold uppercase tracking-widest text-app-success hover:text-app-success">All Transactions</Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-app-surface text-app-muted-foreground uppercase text-[10px] tracking-widest font-bold">
                            <tr>
                                <th className="p-6 text-left">Date</th>
                                <th className="p-6 text-left">Description / Voucher</th>
                                <th className="p-6 text-left">Accounts Involved</th>
                                <th className="p-6 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border">
                            {stats.recentEntries.map((entry: Record<string, any>) => (
                                <tr key={entry.id} className="hover:bg-app-surface/50 transition-colors group">
                                    <td className="p-6 text-app-muted-foreground font-mono text-xs">
                                        {new Date(entry.transactionDate).toLocaleDateString()}
                                    </td>
                                    <td className="p-6">
                                        <div className="font-bold text-app-foreground">{entry.description}</div>
                                        <div className="text-[10px] text-app-muted-foreground uppercase font-black">J-#{entry.id} {entry.reference ? `• ${entry.reference}` : ''}</div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex gap-1 flex-wrap">
                                            {entry.lines.map((l: Record<string, any>, i: number) => (
                                                <span key={i} className="px-2 py-0.5 bg-app-surface-2 text-app-muted-foreground text-[10px] rounded font-bold">
                                                    {l.account.name}
                                                </span>
                                            ))}
                                            {entry.lines.length > 2 && <span className="text-[10px] text-app-muted-foreground">...</span>}
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${entry.status === 'POSTED' ? 'bg-app-success-bg text-app-success' :
                                            entry.status === 'REVERSED' ? 'bg-app-error-bg text-app-error' : 'bg-app-surface-2 text-app-muted-foreground'
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

function MetricCard({ title, value, icon, description, isProfit, color = 'stone' }: Record<string, any>) {
    const isNeg = isProfit && value < 0
    return (
        <div className="bg-app-surface p-6 rounded-3xl border border-app-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 opacity-5 group-hover:scale-110 transition-transform bg-${color}-500 rounded-full`}></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-3 bg-app-surface shadow-sm border border-app-border rounded-xl">
                    {icon}
                </div>
            </div>
            <p className="text-[10px] font-bold uppercase text-app-muted-foreground tracking-[0.1em] mb-1">{title}</p>
            <h4 className={`text-2xl font-mono font-bold ${isNeg ? 'text-app-error' : 'text-app-foreground'}`}>
                {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-xs text-app-muted-foreground font-medium mt-1">{description}</p>
        </div>
    )
}

function InventoryIntegrityCard({ status }: { status: Record<string, any> }) {
    const [isSyncing, setIsSyncing] = useState(false)
    const router = useRouter()

    const isOutOfSync = Math.abs(status.discrepancy) > 0.01

    const [showSyncConfirm, setShowSyncConfirm] = useState(false)

    const handleSync = async () => {
        setShowSyncConfirm(false)
        setIsSyncing(true)
        try {
            const res = await syncInventoryValueToLedger()
            if (res.success) {
                toast.success(res.message)
                window.location.reload()
            }
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <div className="bg-app-surface p-6 rounded-3xl border border-app-border shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-app-surface border border-app-border rounded-xl">
                    <Package className={isOutOfSync ? 'text-app-warning' : 'text-app-success'} />
                </div>
                {isOutOfSync && (
                    <button
                        onClick={() => setShowSyncConfirm(true)}
                        disabled={isSyncing}
                        className="p-2 bg-app-warning-bg text-app-warning rounded-lg hover:bg-app-warning-bg transition-all disabled:opacity-50"
                        title="Sync Ledger to Stock Value"
                    >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    </button>
                )}
            </div>

            <p className="text-[10px] font-bold uppercase text-app-muted-foreground tracking-[0.1em] mb-1">Inventory Value</p>
            <div className="flex items-baseline gap-2">
                <h4 className="text-2xl font-mono font-bold text-app-foreground">
                    {status.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h4>
                {isOutOfSync && (
                    <div className="flex items-center gap-1 text-[9px] font-black text-app-warning uppercase tracking-tighter">
                        <AlertCircle size={10} /> Sync Required
                    </div>
                )}
            </div>

            <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[10px] font-medium">
                    <span className="text-app-muted-foreground">Ledger Balance:</span>
                    <span className="text-app-muted-foreground font-mono">{status.ledgerBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-app-muted-foreground">Discrepancy:</span>
                    <span className={isOutOfSync ? 'text-app-warning' : 'text-app-success font-mono'}>
                        {isOutOfSync ? (status.discrepancy > 0 ? '+' : '') + status.discrepancy.toLocaleString() : 'Match'}
                    </span>
                </div>
            </div>

            <ConfirmDialog
                open={showSyncConfirm}
                onOpenChange={setShowSyncConfirm}
                onConfirm={handleSync}
                title="Sync Inventory to Ledger?"
                description="This will create a Journal Entry to match your ledger to the physical stock value."
                confirmText="Sync Now"
                variant="warning"
            />
        </div>
    )
}

function QuickLink({ href, icon, title, desc }: Record<string, any>) {
    return (
        <Link
            href={href}
            className="flex items-center gap-4 bg-app-surface p-6 rounded-2xl border border-app-border hover:border-stone-900 transition-all group"
        >
            <div className="w-12 h-12 rounded-xl bg-app-surface flex items-center justify-center text-app-muted-foreground group-hover:bg-app-bg group-hover:text-white transition-all">
                {icon}
            </div>
            <div>
                <h5 className="font-bold text-app-foreground">{title}</h5>
                <p className="text-xs text-app-muted-foreground font-medium">{desc}</p>
            </div>
        </Link>
    )
}