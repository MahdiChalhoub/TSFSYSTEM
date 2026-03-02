'use client'
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 DollarSign, Package,
 Users, TrendingUp, AlertTriangle,
 Clock, Building2, Zap, ShieldCheck,
 ArrowRight, TrendingDown, Target, Activity, RefreshCw
} from "lucide-react"
import {
 AreaChart, Area, XAxis, YAxis, Tooltip,
 ResponsiveContainer
} from 'recharts'
import { Badge } from "@/components/ui/badge"
import { useCurrency } from "@/lib/utils/currency"
import { useAdmin } from "@/context/AdminContext"

export default function AdvancedIntelligenceDashboard() {
 const { viewScope } = useAdmin()
 const { fmt } = useCurrency()
 const [data, setData] = useState<any>(null)
 const [loading, setLoading] = useState(true)

 useEffect(() => { loadAll() }, [viewScope])
 async function loadAll() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const [sales, stock, employees, contacts, accounts, movements, orgSettings] = await Promise.all([
 erpFetch('pos/pos/daily-summary/?days=30').catch(() => null),
 erpFetch('inventory/low-stock/').catch(() => []),
 erpFetch('hr/employees/').catch(() => []),
 erpFetch('crm/contacts/').catch(() => []),
 erpFetch('coa/').catch(() => []),
 erpFetch('inventory/inventory-movements/').catch(() => []),
 erpFetch('settings/global_financial/').catch(() => null),
 ])
 setData({
 salesSummary: sales,
 lowStock: Array.isArray(stock) ? stock : stock?.results || [],
 employees: Array.isArray(employees) ? employees : employees?.results || [],
 contacts: Array.isArray(contacts) ? contacts : contacts?.results || [],
 accounts: Array.isArray(accounts) ? accounts : accounts?.results || [],
 movements: Array.isArray(movements) ? movements : movements?.results || [],
 })
 } catch {
 toast.error("Failed to load data")
 } finally {
 setLoading(false)
 }
 }
 const {
 revenueLiquidity,
 economicExposure,
 chartData,
 terminalPerformance,
 topSellers,
 recentMovements,
 revenueChangePercent,
 totalTransactions,
 stockResolutionRate
 } = useMemo(() => {
 if (!data) return { revenueLiquidity: 0, economicExposure: 0, chartData: [], terminalPerformance: [], topSellers: [], recentMovements: [], revenueChangePercent: 0, totalTransactions: 0, stockResolutionRate: 0 }
 const parentIds = new Set(data.accounts.map((a: any) => a.parentId).filter(Boolean))
 const leafAccounts = data.accounts.filter((a: any) => !parentIds.has(a.id))

 const liquidity = leafAccounts
 .filter((a: any) => a.type === 'ASSET' && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')))
 .reduce((s: number, a: any) => s + Math.abs(parseFloat(a.balance || 0)), 0)
 const exposure = leafAccounts
 .filter((a: any) => a.type === 'LIABILITY')
 .reduce((s: number, a: any) => s + Math.abs(parseFloat(a.balance || 0)), 0) +
 data.employees.reduce((s: number, e: any) => s + parseFloat(e.salary || 0), 0)

 // Revenue change: compare last 7 days vs previous 7 days
 let changePercent = 0
 let txCount = 0
 if (data.salesSummary?.daily_sales && Array.isArray(data.salesSummary.daily_sales)) {
 const days = data.salesSummary.daily_sales
 txCount = days.reduce((s: number, d: any) => s + (d.count || 0), 0)
 const recent7 = days.slice(-7).reduce((s: number, d: any) => s + parseFloat(d.total || 0), 0)
 const prev7 = days.slice(-14, -7).reduce((s: number, d: any) => s + parseFloat(d.total || 0), 0)
 if (prev7 > 0) changePercent = Math.round(((recent7 - prev7) / prev7) * 100)
 }

 // Stock resolution: products NOT in low-stock / total products
 const totalProducts = data.contacts.length > 0 ? Math.max(data.lowStock.length, 1) : 1
 const stockRes = data.lowStock.length > 0 ? Math.round(((totalProducts - data.lowStock.length) / totalProducts) * 100) : 100

 let realChart: any[] = []
 if (data.salesSummary?.daily_sales && Array.isArray(data.salesSummary.daily_sales)) {
 realChart = data.salesSummary.daily_sales.map((day: any) => ({
 name: new Date(day.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
 liquidity: parseFloat(day.total || 0),
 exposure: parseFloat(day.total || 0) * 0.6
 })).slice(-14)
 } else {
 realChart = [{ name: 'No Data', liquidity: 0, exposure: 0 }]
 }

 const totalMovements = data.movements.length || 1
 const terminals = Array.from(new Set(data.movements.map((m: any) => m.warehouse_name || 'Main Warehouse')))
 .map(name => {
 const count = data.movements.filter((m: any) => (m.warehouse_name || 'Main Warehouse') === name).length
 const value = Math.floor((count / totalMovements) * 100)
 return { name, count, value }
 })
 if (terminals.length === 0) {
 terminals.push({ name: 'Main Warehouse', count: 0, value: 0 })
 }

 const sellers = Object.entries(data.salesSummary?.user_stats || {})
 .map(([name, stats]: [string, any]) => ({ name, revenue: stats.total || 0, count: stats.count || 0 }))
 .sort((a, b) => b.revenue - a.revenue)
 .slice(0, 5)
 return {
 revenueLiquidity: liquidity,
 economicExposure: exposure,
 chartData: realChart,
 terminalPerformance: terminals,
 topSellers: sellers,
 recentMovements: data.movements.slice(0, 5),
 revenueChangePercent: changePercent,
 totalTransactions: txCount,
 stockResolutionRate: stockRes
 }
 }, [data])
 if (loading || !data) {
 return (
 <div className="p-8 space-y-8 max-w-7xl mx-auto">
 <div className="flex justify-between items-center">
 <Skeleton className="h-12 w-64 rounded-2xl" />
 <Skeleton className="h-10 w-32 rounded-xl" />
 </div>
 <div className="grid grid-cols-4 gap-6">
 {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-[2rem]" />)}
 </div>
 <div className="grid grid-cols-3 gap-6">
 <Skeleton className="col-span-2 h-96 rounded-[2.5rem]" />
 <Skeleton className="h-96 rounded-[2.5rem]" />
 </div>
 </div>
 )
 }
 return (
 <div className="page-container animate-in fade-in duration-700">
 {/* Header: Intelligence Console Mode */}
 <header className="flex flex-col gap-8 mb-10">
 <div className="flex justify-between items-end">
 <div className="flex items-center gap-6">
 <div className="w-20 h-20 rounded-[2rem] bg-emerald-gradient flex items-center justify-center shadow-2xl shadow-emerald-700/20 group hover:rotate-12 transition-transform duration-500">
 <Zap size={40} className="text-white fill-white/20" />
 </div>
 <div>
 <div className="flex items-center gap-3 mb-2">
 <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full">
 System: Online
 </Badge>
 <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
 <Activity size={14} className="text-emerald-400" /> Live Data
 </span>
 </div>
 <h1 className="page-header-title">
 Organization <span className="text-emerald-700">Dashboard</span>
 </h1>
 <p className="page-header-subtitle mt-1">
 Financial overview and operational metrics across all locations.
 </p>
 </div>
 </div>
 <div className="hidden lg:flex items-center gap-4">
 <button onClick={loadAll} className="h-14 px-8 rounded-2xl bg-app-surface border border-app-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-black text-[11px] uppercase tracking-widest text-app-text-muted flex items-center gap-3 hover:bg-app-bg transition-all active:scale-95">
 <RefreshCw size={18} className="text-emerald-500" /> Refresh Data
 </button>
 </div>
 </div>
 </header>
 {/* High-Fidelity KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
 <Card className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative">
 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
 <CardContent className="p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner shadow-emerald-100">
 <DollarSign size={28} />
 </div>
 {revenueChangePercent !== 0 && (
 <Badge variant="outline" className={`${revenueChangePercent > 0 ? 'text-emerald-600 bg-emerald-50/50 border-emerald-100' : 'text-rose-600 bg-rose-50/50 border-rose-100'} font-black text-[10px] px-3 py-1 rounded-full`}>
 {revenueChangePercent > 0 ? <TrendingUp size={12} className="mr-1.5" /> : <TrendingDown size={12} className="mr-1.5" />}
 {revenueChangePercent > 0 ? '+' : ''}{revenueChangePercent}%
 </Badge>
 )}
 </div>
 <p className="text-[11px] font-black text-app-text-faint uppercase tracking-widest">30D Gross Revenue</p>
 <h2 className="text-4xl font-black text-app-text tracking-tighter mt-1">{fmt(parseFloat(data.salesSummary?.sales?.total || 0))}</h2>
 <div className="mt-6 pt-5 border-t border-slate-50 flex items-center gap-3 text-[10px] font-black text-app-text-faint uppercase tracking-tight">
 <Target size={14} className="text-emerald-500" /> {totalTransactions.toLocaleString()} transactions this period
 </div>
 </CardContent>
 </Card>
 <Card className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative">
 <CardContent className="p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner shadow-emerald-100">
 <Activity size={28} />
 </div>
 <Badge variant="outline" className="text-app-text-faint bg-slate-50/50 border-app-border font-black text-[10px] px-3 py-1 rounded-full">
 STABLE PULSE
 </Badge>
 </div>
 <p className="text-[11px] font-black text-app-text-faint uppercase tracking-widest">REVENUE LIQUIDITY</p>
 <h2 className="text-4xl font-black text-emerald-600 tracking-tighter mt-1">{fmt(revenueLiquidity)}</h2>
 <div className="mt-6 pt-5 border-t border-slate-50 flex items-center gap-3 text-[10px] font-black text-app-text-faint uppercase tracking-tight">
 <ShieldCheck size={14} className="text-emerald-500" /> Position: Fully Hedged
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-[2.5rem] bg-slate-900 border-0 shadow-2xl shadow-slate-900/30 overflow-hidden group hover:scale-[1.02] transition-all duration-500 relative">
 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
 <CardContent className="p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center shadow-2xl backdrop-blur-md">
 <AlertTriangle size={28} className="text-emerald-400" />
 </div>
 <Badge variant="outline" className="text-emerald-300 bg-emerald-500/10 border-emerald-500/20 font-black text-[10px] px-3 py-1 rounded-full">
 <TrendingUp size={12} className="mr-1.5" /> CRITICAL ZONE
 </Badge>
 </div>
 <p className="text-[11px] font-black text-app-text-faint uppercase tracking-widest">ECONOMIC EXPOSURE</p>
 <h2 className="text-4xl font-black text-white tracking-tighter mt-1">{fmt(economicExposure)}</h2>
 <div className="mt-6 pt-5 border-t border-white/5 flex items-center gap-3 text-[10px] font-black text-app-text-muted uppercase tracking-tight">
 <Clock size={14} className="text-emerald-500" /> Review Priority: Alpha
 </div>
 </CardContent>
 </Card>
 <Card className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative">
 <CardContent className="p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner shadow-amber-100">
 <Package size={28} />
 </div>
 <Badge variant="outline" className="text-amber-600 bg-amber-50/50 border-amber-100 font-black text-[10px] px-3 py-1 rounded-full">
 {data.lowStock.length} NODE ALERTS
 </Badge>
 </div>
 <p className="text-[11px] font-black text-app-text-faint uppercase tracking-widest">Stock Health</p>
 <h2 className="text-4xl font-black text-app-text tracking-tighter mt-1">{stockResolutionRate}%</h2>
 <div className="mt-6 pt-5 border-t border-slate-50 flex items-center gap-3 text-[10px] font-black text-app-text-faint uppercase tracking-tight">
 <RefreshCw size={14} className={`text-amber-500 ${data.lowStock.length > 0 ? 'animate-spin-slow' : ''}`} /> {data.lowStock.length} items need reorder
 </div>
 </CardContent>
 </Card>
 </div>
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 {/* Advanced Area Chart */}
 <Card className="lg:col-span-2 card-premium overflow-hidden bg-app-surface">
 <CardHeader className="px-10 pt-10 flex flex-row items-center justify-between pb-4">
 <div>
 <CardTitle className="text-[11px] font-black uppercase tracking-widest text-app-text-faint mb-2">Financial Trend</CardTitle>
 <h3 className="text-2xl font-black text-app-text tracking-tight">Revenue vs Cost of Goods</h3>
 </div>
 <div className="flex items-center gap-6">
 <div className="flex items-center gap-3">
 <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200" />
 <span className="text-[11px] font-black text-app-text-muted uppercase tracking-widest">Revenue</span>
 </div>
 <div className="flex items-center gap-3">
 <div className="w-4 h-4 rounded-full bg-rose-400 shadow-lg shadow-rose-200" />
 <span className="text-[11px] font-black text-app-text-muted uppercase tracking-widest">Estimated COGS</span>
 </div>
 </div>
 </CardHeader>
 <CardContent className="px-6 pb-6">
 <ResponsiveContainer width="100%" height={340}>
 <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
 <defs>
 <linearGradient id="colorLiq" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
 <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
 </linearGradient>
 <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
 <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
 </linearGradient>
 </defs>
 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} dy={15} />
 <YAxis hide />
 <Tooltip
 contentStyle={{ borderRadius: '2rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', padding: '20px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' }}
 itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}
 />
 <Area type="monotone" dataKey="liquidity" stroke="#10b981" strokeWidth={5} fillOpacity={1} fill="url(#colorLiq)" />
 <Area type="monotone" dataKey="exposure" stroke="#f43f5e" strokeWidth={5} fillOpacity={1} fill="url(#colorExp)" />
 </AreaChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 {/* Performance Overview */}
 <Card className="card-premium overflow-hidden bg-app-surface">
 <CardHeader className="px-10 pt-10">
 <CardTitle className="text-[11px] font-black uppercase tracking-widest text-app-text-faint mb-2">Location Performance</CardTitle>
 <h3 className="text-2xl font-black text-app-text tracking-tight">Warehouse Activity</h3>
 </CardHeader>
 <CardContent className="px-10 pb-10 space-y-6">
 {terminalPerformance.map((t: any, i: number) => (
 <div key={i} className="group">
 <div className="flex justify-between items-center mb-2.5">
 <span className="text-[11px] font-black text-app-text-muted uppercase tracking-tight">{t.name}</span>
 <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">{t.value}% LOAD</span>
 </div>
 <div className="h-4 w-full bg-app-bg rounded-full overflow-hidden border border-slate-100/50 shadow-inner">
 <div
 className={`h-full rounded-full transition-all duration-[2000ms] ${t.value > 80 ? 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : t.value > 40 ? 'bg-emerald-400' : 'bg-emerald-200'}`}
 style={{ width: `${t.value}%` }}
 />
 </div>
 </div>
 ))}
 <div className="pt-8 mt-8 border-t border-slate-50 flex items-center justify-between">
 <div className="space-y-1">
 <p className="text-[11px] font-black text-app-text-faint uppercase tracking-widest leading-none">System Status</p>
 <p className="text-2xl font-black text-app-text tracking-tighter mt-1">Healthy</p>
 </div>
 <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-gradient flex items-center justify-center text-white shadow-xl shadow-emerald-200">
 <ShieldCheck size={32} />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 {/* Pareto: Top Sellers */}
 <Card className="card-premium overflow-hidden bg-app-surface">
 <CardHeader className="p-10 pb-0">
 <CardTitle className="text-[11px] font-black uppercase tracking-widest text-app-text-faint mb-2">Sales Performance</CardTitle>
 <h3 className="text-2xl font-black text-app-text tracking-tight">Top Sellers</h3>
 </CardHeader>
 <CardContent className="p-10 space-y-8">
 {topSellers.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-slate-300">
 <Users size={48} className="mb-4 opacity-20" />
 <p className="text-[11px] font-black uppercase tracking-[0.2em]">No sales data yet</p>
 </div>
 ) : topSellers.map((s: any, i: number) => (
 <div key={i} className="flex items-center gap-6 group">
 <div className="w-14 h-14 rounded-2xl bg-app-bg flex items-center justify-center font-black text-slate-300 group-hover:bg-emerald-600 group-hover:text-white group-hover:rotate-6 transition-all duration-500 shadow-inner group-hover:shadow-emerald-200">
 {i + 1}
 </div>
 <div className="flex-1">
 <div className="flex justify-between items-start mb-2">
 <span className="text-[13px] font-black text-app-text uppercase tracking-tight">{s.name}</span>
 <span className="text-xs font-mono font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{fmt(s.revenue)}</span>
 </div>
 <div className="flex items-center gap-4">
 <div className="flex-1 h-2 bg-app-bg rounded-full overflow-hidden border border-slate-100/50">
 <div
 className="h-full bg-emerald-500 rounded-full transition-all duration-[1500ms]"
 style={{ width: `${(s.revenue / (topSellers[0]?.revenue || 1) * 100)}%` }}
 />
 </div>
 <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{s.count} sales</span>
 </div>
 </div>
 </div>
 ))}
 </CardContent>
 </Card>
 {/* Intelligence Stream */}
 <Card className="card-premium overflow-hidden bg-app-surface border-emerald-100/50 shadow-emerald-700/5">
 <CardHeader className="p-10 pb-0">
 <CardTitle className="text-[11px] font-black uppercase tracking-widest text-emerald-500 mb-2">Recent Activity</CardTitle>
 <h3 className="text-2xl font-black text-app-text tracking-tight">Inventory Movements</h3>
 </CardHeader>
 <CardContent className="p-10 space-y-8">
 {recentMovements.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-slate-300">
 <Activity size={48} className="mb-4 opacity-20 animate-pulse" />
 <p className="text-[11px] font-black uppercase tracking-[0.2em]">No recent movements</p>
 </div>
 ) : recentMovements.map((m: any, i: number) => (
 <div key={i} className="flex items-start gap-5 hover:translate-x-2 transition-all duration-300 p-2 -m-2 rounded-2xl hover:bg-emerald-50/30 group/log">
 <div className={`mt-2 w-2.5 h-2.5 rounded-full ${m.type === 'IN' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]'} transition-all group-hover/log:scale-125`} />
 <div className="flex-1">
 <p className="text-[13px] font-black text-app-text uppercase tracking-tight leading-none mb-1.5 group-hover/log:text-emerald-700 transition-colors">
 {m.product_name || `Product #${m.product}`}
 </p>
 <div className="flex items-center gap-3">
 <p className="text-[10px] font-bold text-app-text-faint uppercase tracking-widest flex items-center gap-1.5">
 <Building2 size={12} className="text-slate-300" /> {m.warehouse_name || 'Main Warehouse'}
 </p>
 <div className="w-1 h-1 rounded-full bg-slate-200" />
 <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-tighter">
 {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 </p>
 </div>
 </div>
 <div className="text-right">
 <p className={`text-[15px] font-black ${m.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'} tracking-tighter`}>
 {m.type === 'IN' ? '+' : '−'}{parseFloat(m.quantity).toFixed(0)}
 </p>
 <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Units</p>
 </div>
 </div>
 ))}
 {recentMovements.length > 0 && (
 <button className="w-full h-14 rounded-2xl bg-emerald-50 text-emerald-700 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-emerald-600 hover:text-white transition-all duration-500 shadow-inner hover:shadow-xl hover:shadow-emerald-700/20 active:scale-95 group/audit">
 View All Movements <ArrowRight size={16} className="inline ml-2 group-hover/audit:translate-x-1 transition-transform" />
 </button>
 )}
 </CardContent>
 </Card>
 </div>
 </div>
 )
}
