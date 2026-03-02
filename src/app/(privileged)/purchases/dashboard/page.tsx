'use client'
import { useCurrency } from '@/lib/utils/currency'
import { safeDateSort } from '@/lib/utils/safe-date'
import { useState, useEffect, useMemo } from "react"
import type { PurchaseOrder } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 ShoppingCart, Package, DollarSign, TrendingUp, Clock,
 Search, CheckCircle, AlertCircle, Truck, RefreshCw,
 ArrowUpRight, Target, Activity, Zap, Building, Plus
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
 PENDING: { label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 border-amber-100' },
 CONFIRMED: { label: 'Confirmed', color: 'bg-blue-50 text-blue-700 border-blue-100' },
 COMPLETED: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
 CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-100' },
 DRAFT: { label: 'Draft', color: 'bg-app-bg text-app-text-muted border-app-border' },
}
export default function PurchaseDashboardPage() {
 const { fmt } = useCurrency()
 const [orders, setOrders] = useState<PurchaseOrder[]>([])
 const [loading, setLoading] = useState(true)
 const [statusFilter, setStatusFilter] = useState<string | null>(null)
 const settings = useListViewSettings('purch_dashboard', {
 columns: ['ref_code', 'created_at', 'supplier_name', 'status', 'payment_method', 'total_amount'],
 pageSize: 15, sortKey: 'created_at', sortDir: 'desc'
 })
 useEffect(() => { loadOrders() }, [])
 async function loadOrders() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const data = await erpFetch('pos/purchase/')
 setOrders(Array.isArray(data) ? data : data.results || [])
 } catch {
 toast.error("Failed to load orders")
 } finally {
 setLoading(false)
 }
 }
 const filteredOrders = useMemo(() => {
 if (!statusFilter) return orders
 return orders.filter(o => o.status === statusFilter)
 }, [orders, statusFilter])
 const stats = useMemo(() => {
 const total = orders.reduce((s, o) => s + parseFloat(String(o.total_amount || 0)), 0)
 const completed = orders.filter(o => o.status === 'COMPLETED').reduce((s, o) => s + parseFloat(String(o.total_amount || 0)), 0)
 const pending = orders.filter(o => ['PENDING', 'CONFIRMED'].includes(o.status ?? '')).reduce((s, o) => s + parseFloat(String(o.total_amount || 0)), 0)
 return { total, completed, pending, count: orders.length }
 }, [orders])
 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'ref_code',
 label: 'Order #',
 render: (o) => (
 <div className="flex items-center gap-2">
 <span className="font-mono text-[10px] font-black tracking-[0.1em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 shadow-sm">
 {o.ref_code || `PO-${o.id}`}
 </span>
 </div>
 )
 },
 {
 key: 'created_at',
 label: 'Posting Date',
 sortable: true,
 render: (o) => (
 <span className="text-xs font-bold text-app-text-muted">
 {o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '—'}
 </span>
 )
 },
 {
 key: 'supplier_name',
 label: 'Supplier',
 render: (o) => (
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl bg-app-bg border border-app-border flex items-center justify-center text-app-text-faint">
 <Building size={14} />
 </div>
 <span className="text-sm font-semibold text-gray-700 tracking-tight">{o.supplier_name || o.contact_name || 'Unknown'}</span>
 </div>
 )
 },
 {
 key: 'status',
 label: 'Status',
 render: (o) => (
 <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest border ${STATUS_CONFIG[o.status ?? '']?.color || 'bg-app-bg text-app-text-muted'}`}>
 {STATUS_CONFIG[o.status ?? '']?.label || o.status}
 </Badge>
 )
 },
 {
 key: 'payment_method',
 label: 'Payment',
 render: (o) => <span className="text-[10px] font-black uppercase tracking-tighter text-app-text-faint">{o.payment_method || 'PENDING'}</span>
 },
 {
 key: 'total_amount',
 label: 'Total',
 align: 'right',
 render: (o) => (
 <span className="font-black text-app-text tracking-tighter">{fmt(parseFloat(o.total_amount || 0))}</span>
 )
 }
 ], [fmt])
 if (loading && orders.length === 0) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-4 gap-6">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
 <Skeleton className="h-96 rounded-3xl" />
 </div>
 )
 }
 return (
 <div className="page-container animate-in fade-in duration-700">
 {/* Header: Procurement Dashboard */}
 <header className="flex flex-col gap-8 mb-10">
 <div className="flex justify-between items-end">
 <div className="flex items-center gap-6">
 <div className="w-20 h-20 rounded-[2rem] bg-emerald-gradient flex items-center justify-center shadow-2xl shadow-emerald-700/20 group hover:rotate-12 transition-transform duration-500">
 <ShoppingCart size={40} className="text-white fill-white/20" />
 </div>
 <div>
 <div className="flex items-center gap-3 mb-2">
 <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full">
 Active
 </Badge>
 <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
 <Activity size={14} className="text-emerald-400" /> Live
 </span>
 </div>
 <h1 className="page-header-title">
 Procurement <span className="text-emerald-700">Dashboard</span>
 </h1>
 <p className="page-header-subtitle mt-1">
 Supplier tracking and purchase order analytics.
 </p>
 </div>
 </div>
 <div className="hidden lg:flex items-center gap-4">
 <Button onClick={loadOrders} variant="outline" className="h-14 px-8 rounded-2xl bg-app-surface border border-app-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-black text-[11px] uppercase tracking-widest text-app-text-muted flex items-center gap-3 hover:bg-app-bg transition-all active:scale-95">
 <RefreshCw size={18} className={`text-emerald-500 ${loading ? 'animate-spin' : ''}`} /> Refresh
 </Button>
 <Button className="h-14 px-8 rounded-2xl bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 border-b-4 border-b-slate-950">
 New Order <Plus size={18} className="text-emerald-400" />
 </Button>
 </div>
 </div>
 </header>
 {/* Premium Analytics Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
 <Card className="rounded-[2.5rem] bg-slate-900 border-0 shadow-2xl shadow-slate-900/30 overflow-hidden group hover:scale-[1.02] transition-all duration-500 relative p-8 text-white min-h-[160px]">
 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
 <div className="relative z-10">
 <p className="text-[11px] font-black text-app-text-faint uppercase tracking-widest">TOTAL SPEND</p>
 <h2 className="text-4xl font-black text-white tracking-tighter mt-2">{fmt(stats.total)}</h2>
 <div className="mt-6 flex items-center gap-3">
 <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[9px] font-black px-3 py-1 rounded-full">{stats.count} ACTIVE POs</Badge>
 </div>
 </div>
 </Card>
 <Card className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative border-0 p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner shadow-emerald-100 transition-transform group-hover:rotate-6">
 <CheckCircle size={28} />
 </div>
 </div>
 <div>
 <p className="text-[11px] font-black text-app-text-faint uppercase tracking-widest">Completed</p>
 <h4 className="text-3xl font-black text-app-text tracking-tighter mt-1">{fmt(stats.completed)}</h4>
 </div>
 <div className="mt-6 h-2 w-full bg-app-bg rounded-full overflow-hidden border border-slate-100/50 shadow-inner">
 <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }} />
 </div>
 </Card>
 <Card className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative border-0 p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner shadow-amber-100 transition-transform group-hover:rotate-6">
 <Clock size={28} />
 </div>
 </div>
 <div>
 <p className="text-[11px] font-black text-app-text-faint uppercase tracking-widest">Pending</p>
 <h4 className="text-3xl font-black text-app-text tracking-tighter mt-1">{fmt(stats.pending)}</h4>
 </div>
 <div className="mt-6 h-2 w-full bg-app-bg rounded-full overflow-hidden border border-slate-100/50 shadow-inner">
 <div className="h-full bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)]" style={{ width: `${(stats.pending / (stats.total || 1)) * 100}%` }} />
 </div>
 </Card>
 <Card className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative border-0 p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner shadow-emerald-100 transition-transform group-hover:rotate-6">
 <Activity size={28} />
 </div>
 </div>
 <div>
 <p className="text-[11px] font-black text-app-text-faint uppercase tracking-widest">Average Order</p>
 <h4 className="text-3xl font-black text-app-text tracking-tighter mt-1">{orders.length > 0 ? fmt(stats.total / orders.length) : fmt(0)}</h4>
 </div>
 <div className="mt-6 pt-5 border-t border-slate-50 flex items-center gap-2 text-[10px] font-black text-app-text-faint uppercase tracking-tight">
 <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Avg. per Order
 </div>
 </Card>
 </div>
 <TypicalListView
 title="Purchase Orders"
 data={filteredOrders}
 loading={loading}
 getRowId={(o) => o.id}
 columns={columns}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 headerExtra={
 <div className="flex items-center gap-2 bg-app-bg p-1.5 rounded-2xl border border-slate-100/50 shadow-inner">
 <Button
 variant={!statusFilter ? 'secondary' : 'ghost'}
 size="sm"
 onClick={() => setStatusFilter(null)}
 className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${!statusFilter ? 'bg-app-surface shadow-md text-emerald-600' : 'text-app-text-faint hover:text-app-text-muted'}`}
 >
 All Logs
 </Button>
 {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
 const count = orders.filter(o => o.status === key).length
 if (count === 0) return null
 return (
 <Button
 key={key}
 variant={statusFilter === key ? 'secondary' : 'ghost'}
 size="sm"
 onClick={() => setStatusFilter(key)}
 className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${statusFilter === key ? 'bg-app-surface shadow-md text-emerald-600' : 'text-app-text-faint hover:text-emerald-600'}`}
 >
 {cfg.label}
 </Button>
 )
 })}
 </div>
 }
 />
 </div>
 )
}
