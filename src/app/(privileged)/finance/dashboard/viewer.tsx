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
 viewScope === 'OFFICIAL' ? "bg-app-primary-light border-app-success/30 text-app-success" : "bg-app-background border-app-border text-app-muted-foreground"
 )}>
 {viewScope === 'OFFICIAL' ? 'Official Tax Records' : 'Management View'}
 </div>
 {isLoading && <RefreshCw size={14} className="animate-spin text-app-primary" />}
 </div>
 {/* Primary Metrics Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <MetricCard
 title="Cash on Hand"
 value={stats.totalCash}
 icon={<Wallet className="text-app-primary" />}
 description="Total Bank + Cash"
 />
 <MetricCard
 title="Net Profit (Oct)"
 value={stats.netProfit}
 icon={<TrendingUp className={stats.netProfit >= 0 ? 'text-app-primary' : 'text-rose-500'} />}
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
 icon={<ArrowDownRight className="text-app-warning" />}
 description="Due to Suppliers"
 color="amber"
 />
 <InventoryIntegrityCard status={stats.inventoryStatus} />
 </div>

 {/* Middle Section: Trends & P&L Details */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

 {/* 6-Month Profit Trend (CSS Bars) */}
 <div className="lg:col-span-2 card-premium p-10 bg-app-surface">
 <div className="flex justify-between items-center mb-10">
 <div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">PROFITABILITY</p>
 <h3 className="text-2xl font-black text-app-foreground tracking-tight">Financial Velocity (6M)</h3>
 </div>
 <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest">
 <div className="flex items-center gap-2.5"><div className="w-3 h-3 rounded-full bg-app-primary shadow-lg shadow-emerald-200"></div> Revenue</div>
 <div className="flex items-center gap-2.5"><div className="w-3 h-3 rounded-full bg-app-border"></div> Burn</div>
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
 className="w-1/3 bg-app-primary rounded-t-xl transition-all duration-700 group-hover:bg-app-primary shadow-lg group-hover:shadow-emerald-200"
 style={{ height: `${incHeight}%` }}
 title={`Income: ${t.income.toFixed(0)}`}
 ></div>
 <div
 className="w-1/3 bg-app-surface-2 rounded-t-xl transition-all duration-700 group-hover:bg-app-border"
 style={{ height: `${expHeight}%` }}
 title={`Expense: ${t.expense.toFixed(0)}`}
 ></div>
 </div>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-tighter">{t.month}</span>
 </div>
 )
 })}
 </div>
 </div>

 {/* Monthly Breakdown */}
 <Card className="rounded-[2.5rem] bg-app-surface border-0 shadow-2xl shadow-app-border/20 p-10 text-app-foreground flex flex-col justify-between relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
 <div className="absolute top-0 right-0 w-48 h-48 bg-app-primary/10 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-app-primary/20 transition-colors"></div>
 <div className="relative z-10">
 <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-app-muted-foreground mb-8">P&L Summary: {new Date().toLocaleString('en-US', { month: 'long' })}</h3>
 <div className="space-y-8">
 <div className="flex justify-between items-center group/row">
 <span className="text-app-muted-foreground text-sm font-black uppercase tracking-tight">Monthly Gross</span>
 <span className="text-2xl font-black text-app-primary tracking-tighter">+{stats.monthlyIncome.toLocaleString()}</span>
 </div>
 <div className="flex justify-between items-center group/row">
 <span className="text-app-muted-foreground text-sm font-black uppercase tracking-tight">Operational Burn</span>
 <span className="text-2xl font-black text-rose-400 tracking-tighter">-{stats.monthlyExpense.toLocaleString()}</span>
 </div>
 <div className="border-t border-app-text/5 pt-8 flex justify-between items-end">
 <span className="text-[11px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">NET PROFIT</span>
 <span className="text-5xl font-black text-app-foreground tracking-tighter glow-emerald">{stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
 </div>
 </div>
 </div>

 <Link
 href="/finance/reports/pnl"
 className="mt-10 h-16 bg-app-primary hover:bg-app-primary text-app-foreground rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-app-primary/20 relative z-10 active:scale-95 group/btn"
 >
 Detailed Intelligence <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
 </Link>
 </Card>
 </div>

 {/* Bottom Section: Recent Entries */}
 <div className="card-premium bg-app-surface overflow-hidden">
 <div className="px-10 py-8 border-b border-app-border flex justify-between items-center">
 <div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">TRANSACTIONAL FEED</p>
 <h3 className="text-2xl font-black text-app-foreground tracking-tight">Recent Ledger Activity</h3>
 </div>
 <Link href="/finance/ledger" className="h-10 px-6 rounded-xl bg-app-primary-light text-app-success font-black text-[10px] uppercase tracking-widest flex items-center hover:bg-app-primary hover:text-app-foreground transition-all">All Records</Link>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-app-surface-2/50 text-app-muted-foreground uppercase text-[10px] tracking-[0.2em] font-black">
 <tr>
 <th className="px-10 py-6 text-left">Date</th>
 <th className="px-10 py-6 text-left">Entity</th>
 <th className="px-10 py-6 text-left">Account</th>
 <th className="px-10 py-6 text-right">Verification</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {stats.recentEntries.map((entry: Record<string, any>) => (
 <tr key={entry.id} className="hover:bg-app-primary-light/20 transition-all group/row">
 <td className="px-10 py-8 text-app-muted-foreground font-black text-[11px] uppercase tracking-tighter">
 {entry.transactionDate ? new Date(entry.transactionDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
 </td>
 <td className="px-10 py-8">
 <div className="font-black text-app-foreground uppercase text-[13px] tracking-tight group-hover/row:text-app-success transition-colors">{entry.description}</div>
 <div className="text-[10px] text-app-muted-foreground uppercase font-black tracking-widest mt-1.5 flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-app-success/10/30" /> J-#{entry.id} {entry.reference ? `• ${entry.reference}` : ''}
 </div>
 </td>
 <td className="px-10 py-8">
 <div className="flex gap-2 flex-wrap">
 {entry.lines.map((l: Record<string, any>, i: number) => (
 <span key={i} className="px-3 py-1 bg-app-background text-app-muted-foreground text-[10px] font-black uppercase border border-app-border rounded-lg group-hover/row:border-app-success/30 group-hover/row:text-app-primary transition-all">
 {l.account.name}
 </span>
 ))}
 {entry.lines.length > 2 && <span className="text-[10px] text-app-muted-foreground font-black">...</span>}
 </div>
 </td>
 <td className="px-10 py-8 text-right">
 <Badge variant="outline" className={clsx(
 "font-black text-[10px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full",
 entry.status === 'POSTED' ? 'bg-app-primary-light text-app-primary border-app-success/30' :
 entry.status === 'REVERSED' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-app-background text-app-muted-foreground border-app-border'
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
 <Card className="card-premium group hover:shadow-2xl hover:shadow-app-primary/20 transition-all duration-500 overflow-hidden relative border-0">
 <div className="absolute top-0 right-0 w-32 h-32 bg-app-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-app-primary/10 transition-colors" />
 <CardContent className="p-8">
 <div className="flex justify-between items-start mb-6">
 <div className={clsx(
 "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-all duration-500 group-hover:rotate-6",
 color === 'sky' ? "bg-sky-50 text-sky-600 shadow-sky-100" :
 color === 'amber' ? "bg-app-warning-bg text-app-warning shadow-amber-100" :
 "bg-app-primary-light text-app-primary shadow-emerald-100"
 )}>
 {icon && typeof icon !== 'string' ? icon : null}
 </div>
 <Badge variant="outline" className="bg-app-surface-2/50 border-app-border font-black text-[10px] uppercase tracking-widest text-app-muted-foreground px-3 py-1 rounded-full">
 Live Pulse
 </Badge>
 </div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">{title}</p>
 <div className="flex items-baseline gap-1">
 <h4 className={clsx(
 "text-3xl font-black tracking-tighter",
 isNeg ? 'text-rose-600' : 'text-app-foreground'
 )}>
 {value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
 </h4>
 </div>
 <div className="mt-6 pt-5 border-t border-app-border flex items-center gap-3 text-[10px] font-black text-app-muted-foreground uppercase tracking-tight">
 <div className={clsx("w-2 h-2 rounded-full animate-pulse", isNeg ? 'bg-rose-400 shadow-[0_0_8px_color-mix(in srgb, var(--app-error) 40%, transparent)]' : 'bg-app-success/10 shadow-[0_0_8px_var(--app-success)]')} />
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
 <div className="card-premium p-8 bg-app-surface relative overflow-hidden group">
 <div className="flex justify-between items-start mb-6">
 <div className={clsx(
 "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-all duration-500",
 isOutOfSync ? 'bg-app-warning-bg text-app-warning shadow-amber-100' : 'bg-app-primary-light text-app-primary shadow-emerald-100'
 )}>
 <Package size={28} />
 </div>
 {isOutOfSync && (
 <button
 onClick={() => setShowSyncConfirm(true)}
 disabled={isSyncing}
 className="w-10 h-10 bg-app-warning-bg text-app-warning rounded-xl flex items-center justify-center hover:bg-app-warning hover:text-app-foreground transition-all disabled:opacity-50 shadow-sm"
 title="Sync Ledger to Stock Value"
 >
 <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
 </button>
 )}
 </div>

 <p className="text-[11px] font-black uppercase text-app-muted-foreground tracking-widest mb-1">Inventory Value</p>
 <div className="flex items-end gap-3 mb-6">
 <h4 className="text-3xl font-black text-app-foreground tracking-tighter leading-none">
 {status.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
 </h4>
 {isOutOfSync && (
 <div className="flex items-center gap-1.5 text-[10px] font-black text-app-warning uppercase tracking-tighter mb-1 animate-pulse">
 <AlertCircle size={12} /> Sync Required
 </div>
 )}
 </div>

 <div className="pt-6 border-t border-app-border space-y-3">
 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
 <span className="text-app-muted-foreground">Ledger Balance:</span>
 <span className="text-app-foreground font-mono">{status.ledgerBalance.toLocaleString()}</span>
 </div>
 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
 <span className="text-app-muted-foreground">Discrepancy:</span>
 <span className={clsx("px-2 py-0.5 rounded-md font-mono", isOutOfSync ? 'bg-rose-50 text-rose-600' : 'bg-app-primary-light text-app-primary')}>
 {isOutOfSync ? (status.discrepancy > 0 ? '+' : '') + status.discrepancy.toLocaleString() : 'Match'}
 </span>
 </div>
 </div>

 <ConfirmDialog
 open={showSyncConfirm}
 onOpenChange={setShowSyncConfirm}
 onConfirm={handleSync}
 title="Synchronize Inventory Asset Mapping?"
 description="This will run a Ledger Reconciliation to align asset valuations with current stock levels."
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
 className="flex items-center gap-6 bg-app-surface p-8 rounded-[2rem] border border-app-border shadow-[0_10px_40px_var(--app-border)] hover:shadow-2xl hover:shadow-app-primary/20 hover:border-app-primary transition-all duration-500 group"
 >
 <div className="w-16 h-16 rounded-2xl bg-app-background flex items-center justify-center text-app-muted-foreground group-hover:bg-app-success group-hover:text-app-foreground group-hover:rotate-6 transition-all duration-500 shadow-inner group-hover:shadow-app-primary/20">
 {icon}
 </div>
 <div>
 <h5 className="font-black text-app-foreground uppercase text-[15px] tracking-tight group-hover:text-app-success transition-colors">{title}</h5>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest mt-1 opacity-80 group-hover:opacity-100">{desc}</p>
 </div>
 </Link>
 )
}