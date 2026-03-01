'use client'

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                    viewScope === 'OFFICIAL' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-500"
                )}>
                    {viewScope === 'OFFICIAL' ? 'Official Node (Tax)' : 'Aggregate Node (Management)'}
                </div>
                {isLoading && <RefreshCw size={14} className="animate-spin text-emerald-400" />}
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
                <div className="lg:col-span-2 card-premium p-10 bg-white">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">PROFIT ARCHITECTURE</p>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Financial Velocity (6M)</h3>
                        </div>
                        <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest">
                            <div className="flex items-center gap-2.5"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200"></div> Revenue</div>
                            <div className="flex items-center gap-2.5"><div className="w-3 h-3 rounded-full bg-slate-200"></div> Burn</div>
                        </div>
                    </div>

                    <div className="h-64 flex items-end justify-between gap-6 px-4">
                        {stats.trends.map((t: Record<string, any>, i: number) => {
                            const maxVal = Math.max(...stats.trends.map((x: Record<string, any>) => Math.max(x.income, x.expense))) || 1
                            const incHeight = (t.income / maxVal) * 100
                            const expHeight = (t.expense / maxVal) * 100

                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                                    <div className="w-full flex justify-center gap-1.5 h-full items-end">
                                        <div
                                            className="w-1/3 bg-emerald-500 rounded-t-xl transition-all duration-700 group-hover:bg-emerald-600 shadow-lg group-hover:shadow-emerald-200"
                                            style={{ height: `${incHeight}%` }}
                                            title={`Income: ${t.income.toFixed(0)}`}
                                        ></div>
                                        <div
                                            className="w-1/3 bg-slate-100 rounded-t-xl transition-all duration-700 group-hover:bg-slate-200"
                                            style={{ height: `${expHeight}%` }}
                                            title={`Expense: ${t.expense.toFixed(0)}`}
                                        ></div>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{t.month}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Monthly Breakdown */}
                <Card className="rounded-[2.5rem] bg-slate-900 border-0 shadow-2xl shadow-slate-900/40 p-10 text-white flex flex-col justify-between relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-emerald-500/20 transition-colors"></div>
                    <div className="relative z-10">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-8">Node P&L Matrix: {new Date().toLocaleString('en-US', { month: 'long' })}</h3>
                        <div className="space-y-8">
                            <div className="flex justify-between items-center group/row">
                                <span className="text-slate-400 text-sm font-black uppercase tracking-tight">Monthly Gross</span>
                                <span className="text-2xl font-black text-emerald-400 tracking-tighter">+{stats.monthlyIncome.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center group/row">
                                <span className="text-slate-400 text-sm font-black uppercase tracking-tight">Operational Burn</span>
                                <span className="text-2xl font-black text-rose-400 tracking-tighter">-{stats.monthlyExpense.toLocaleString()}</span>
                            </div>
                            <div className="border-t border-white/5 pt-8 flex justify-between items-end">
                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">NET PROFIT</span>
                                <span className="text-5xl font-black text-white tracking-tighter glow-emerald">{stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>

                    <Link
                        href="/finance/reports/pnl"
                        className="mt-10 h-16 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-900/20 relative z-10 active:scale-95 group/btn"
                    >
                        Detailed Intelligence <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                </Card>
            </div>

            {/* Bottom Section: Recent Entries */}
            <div className="card-premium bg-white overflow-hidden">
                <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center">
                    <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">TRANSACTIONAL FEED</p>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Recent Ledger Activity</h3>
                    </div>
                    <Link href="/finance/ledger" className="h-10 px-6 rounded-xl bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-widest flex items-center hover:bg-emerald-600 hover:text-white transition-all">All Records</Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 text-slate-400 uppercase text-[10px] tracking-[0.2em] font-black">
                            <tr>
                                <th className="px-10 py-6 text-left">Date Node</th>
                                <th className="px-10 py-6 text-left">Entity Dispatch</th>
                                <th className="px-10 py-6 text-left">Account Matrix</th>
                                <th className="px-10 py-6 text-right">Verification</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {stats.recentEntries.map((entry: Record<string, any>) => (
                                <tr key={entry.id} className="hover:bg-emerald-50/20 transition-all group/row">
                                    <td className="px-10 py-8 text-slate-400 font-black text-[11px] uppercase tracking-tighter">
                                        {entry.transactionDate ? new Date(entry.transactionDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="font-black text-slate-800 uppercase text-[13px] tracking-tight group-hover/row:text-emerald-700 transition-colors">{entry.description}</div>
                                        <div className="text-[10px] text-slate-300 uppercase font-black tracking-widest mt-1.5 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/30" /> J-#{entry.id} {entry.reference ? `• ${entry.reference}` : ''}
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex gap-2 flex-wrap">
                                            {entry.lines.map((l: Record<string, any>, i: number) => (
                                                <span key={i} className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-black uppercase border border-slate-100 rounded-lg group-hover/row:border-emerald-100 group-hover/row:text-emerald-600 transition-all">
                                                    {l.account.name}
                                                </span>
                                            ))}
                                            {entry.lines.length > 2 && <span className="text-[10px] text-slate-300 font-black">...</span>}
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        <Badge variant="outline" className={clsx(
                                            "font-black text-[10px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full",
                                            entry.status === 'POSTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                entry.status === 'REVERSED' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-400 border-slate-200'
                                        )}>
                                            {entry.status}
                                        </Badge>
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

function MetricCard({ title, value, icon, description, isProfit, color = 'emerald' }: Record<string, any>) {
    const isNeg = isProfit && value < 0
    return (
        <Card className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative border-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
            <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                    <div className={clsx(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-all duration-500 group-hover:rotate-6",
                        color === 'sky' ? "bg-sky-50 text-sky-600 shadow-sky-100" :
                            color === 'amber' ? "bg-amber-50 text-amber-600 shadow-amber-100" :
                                "bg-emerald-50 text-emerald-600 shadow-emerald-100"
                    )}>
                        {icon && typeof icon !== 'string' ? icon : null}
                    </div>
                    <Badge variant="outline" className="bg-slate-50/50 border-slate-100 font-black text-[10px] uppercase tracking-widest text-slate-400 px-3 py-1 rounded-full">
                        Live Pulse
                    </Badge>
                </div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <div className="flex items-baseline gap-1">
                    <h4 className={clsx(
                        "text-3xl font-black tracking-tighter",
                        isNeg ? 'text-rose-600' : 'text-slate-800'
                    )}>
                        {value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </h4>
                </div>
                <div className="mt-6 pt-5 border-t border-slate-50 flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-tight">
                    <div className={clsx("w-2 h-2 rounded-full animate-pulse", isNeg ? 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]')} />
                    {description}
                </div>
            </CardContent>
        </Card>
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
        <div className="card-premium p-8 bg-white relative overflow-hidden group">
            <div className="flex justify-between items-start mb-6">
                <div className={clsx(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-all duration-500",
                    isOutOfSync ? 'bg-amber-50 text-amber-600 shadow-amber-100' : 'bg-emerald-50 text-emerald-600 shadow-emerald-100'
                )}>
                    <Package size={28} />
                </div>
                {isOutOfSync && (
                    <button
                        onClick={() => setShowSyncConfirm(true)}
                        disabled={isSyncing}
                        className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all disabled:opacity-50 shadow-sm"
                        title="Sync Ledger to Stock Value"
                    >
                        <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                    </button>
                )}
            </div>

            <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-1">Inventory Value</p>
            <div className="flex items-end gap-3 mb-6">
                <h4 className="text-3xl font-black text-slate-800 tracking-tighter leading-none">
                    {status.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                </h4>
                {isOutOfSync && (
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-tighter mb-1 animate-pulse">
                        <AlertCircle size={12} /> Sync Required
                    </div>
                )}
            </div>

            <div className="pt-6 border-t border-slate-50 space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                    <span className="text-slate-400">Ledger Balance:</span>
                    <span className="text-slate-800 font-mono">{status.ledgerBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                    <span className="text-slate-400">Discrepancy:</span>
                    <span className={clsx("px-2 py-0.5 rounded-md font-mono", isOutOfSync ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600')}>
                        {isOutOfSync ? (status.discrepancy > 0 ? '+' : '') + status.discrepancy.toLocaleString() : 'Match'}
                    </span>
                </div>
            </div>

            <ConfirmDialog
                open={showSyncConfirm}
                onOpenChange={setShowSyncConfirm}
                onConfirm={handleSync}
                title="Synchronize Inventory Asset Mapping?"
                description="This will orchestrate a Ledger Reconciliation event to align asset valuations with current node stock states."
                confirmText="Execute Sync"
                variant="warning"
            />
        </div>
    )
}

function QuickLink({ href, icon, title, desc }: Record<string, any>) {
    return (
        <Link
            href={href}
            className="flex items-center gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.03)] hover:shadow-2xl hover:shadow-emerald-700/10 hover:border-emerald-500 transition-all duration-500 group"
        >
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-gradient group-hover:text-white group-hover:rotate-6 transition-all duration-500 shadow-inner group-hover:shadow-emerald-500/20">
                {icon}
            </div>
            <div>
                <h5 className="font-black text-slate-800 uppercase text-[15px] tracking-tight group-hover:text-emerald-700 transition-colors">{title}</h5>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-80 group-hover:opacity-100">{desc}</p>
            </div>
        </Link>
    )
}