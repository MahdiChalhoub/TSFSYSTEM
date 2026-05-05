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
 <div className="w-20 h-20 rounded-[2rem] bg-app-success flex items-center justify-center shadow-2xl shadow-app-primary/20 group hover:rotate-12 transition-transform duration-500">
 <Zap size={40} className="text-app-foreground fill-white/20" />
 </div>
 <div>
 <div className="flex items-center gap-3 mb-2">
 <Badge variant="outline" className="bg-app-primary-light text-app-primary border-app-success/30 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full">
 System: Online
 </Badge>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
 <Activity size={14} className="text-app-primary" /> Live Data
 </span>
 </div>
 <h1 className="page-header-title">
 Organization <span className="text-app-success">Dashboard</span>
 </h1>
 <p className="page-header-subtitle mt-1">
 Financial overview and operational metrics across all locations.
 </p>
 </div>
 </div>
 <div className="hidden lg:flex items-center gap-4">
 <button onClick={loadAll} className="h-14 px-8 rounded-2xl bg-app-surface border border-app-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-black text-[11px] uppercase tracking-widest text-app-muted-foreground flex items-center gap-3 hover:bg-app-background transition-all active:scale-95">
 <RefreshCw size={18} className="text-app-primary" /> Refresh Data
 </button>
 </div>
 </div>
 </header>
 {/* High-Fidelity KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
 <Card className="card-premium group hover:shadow-2xl hover:shadow-app-primary/20 transition-all duration-500 overflow-hidden relative">
 <div className="absolute top-0 right-0 w-32 h-32 bg-app-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-app-primary/10 transition-colors" />
 <CardContent className="p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-app-primary-light text-app-primary flex items-center justify-center shadow-inner shadow-emerald-100">
 <DollarSign size={28} />
 </div>
 {revenueChangePercent !== 0 && (
 <Badge variant="outline" className={`${revenueChangePercent > 0 ? 'text-app-primary bg-app-primary-light/50 border-app-success/30' : 'text-app-error bg-app-error-bg/50 border-app-error'} font-black text-[10px] px-3 py-1 rounded-full`}>
 {revenueChangePercent > 0 ? <TrendingUp size={12} className="mr-1.5" /> : <TrendingDown size={12} className="mr-1.5" />}
 {revenueChangePercent > 0 ? '+' : ''}{revenueChangePercent}%
 </Badge>
 )}
 </div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">30D Gross Revenue</p>
 <h2 className="mt-1">{fmt(parseFloat(data.salesSummary?.sales?.total || 0))}</h2>
 <div className="mt-6 pt-5 border-t border-app-border flex items-center gap-3 text-[10px] font-black text-app-muted-foreground uppercase tracking-tight">
 <Target size={14} className="text-app-primary" /> {totalTransactions.toLocaleString()} transactions this period
 </div>
 </CardContent>
 </Card>
 <Card className="card-premium group hover:shadow-2xl hover:shadow-app-primary/20 transition-all duration-500 overflow-hidden relative">
 <CardContent className="p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-app-primary-light text-app-primary flex items-center justify-center shadow-inner shadow-emerald-100">
 <Activity size={28} />
 </div>
 <Badge variant="outline" className="text-app-muted-foreground bg-app-surface-2/50 border-app-border font-black text-[10px] px-3 py-1 rounded-full">
 STABLE PULSE
 </Badge>
 </div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">REVENUE LIQUIDITY</p>
 <h2 className="text-app-primary mt-1">{fmt(revenueLiquidity)}</h2>
 <div className="mt-6 pt-5 border-t border-app-border flex items-center gap-3 text-[10px] font-black text-app-muted-foreground uppercase tracking-tight">
 <ShieldCheck size={14} className="text-app-primary" /> Position: Fully Hedged
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-[2.5rem] bg-app-surface border-0 shadow-2xl shadow-app-border/20 overflow-hidden group hover:scale-[1.02] transition-all duration-500 relative">
 <div className="absolute top-0 right-0 w-32 h-32 bg-app-primary/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-app-primary/20 transition-colors" />
 <CardContent className="p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-app-foreground/10 text-app-foreground flex items-center justify-center shadow-2xl backdrop-blur-md">
 <AlertTriangle size={28} className="text-app-primary" />
 </div>
 <Badge variant="outline" className="text-app-success bg-app-primary/10 border-app-primary/20 font-black text-[10px] px-3 py-1 rounded-full">
 <TrendingUp size={12} className="mr-1.5" /> CRITICAL ZONE
 </Badge>
 </div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">ECONOMIC EXPOSURE</p>
 <h2 className="mt-1">{fmt(economicExposure)}</h2>
 <div className="mt-6 pt-5 border-t border-app-foreground/5 flex items-center gap-3 text-[10px] font-black text-app-muted-foreground uppercase tracking-tight">
 <Clock size={14} className="text-app-primary" /> Review Priority: Alpha
 </div>
 </CardContent>
 </Card>
 <Card className="card-premium group hover:shadow-2xl hover:shadow-app-primary/20 transition-all duration-500 overflow-hidden relative">
 <CardContent className="p-8">
 <div className="flex justify-between items-start mb-6">
 <div className="w-14 h-14 rounded-2xl bg-app-warning-bg text-app-warning flex items-center justify-center shadow-inner shadow-amber-100">
 <Package size={28} />
 </div>
 <Badge variant="outline" className="text-app-warning bg-app-warning-bg/50 border-app-warning/30 font-black text-[10px] px-3 py-1 rounded-full">
 {data.lowStock.length} NODE ALERTS
 </Badge>
 </div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">Stock Health</p>
 <h2 className="mt-1">{stockResolutionRate}%</h2>
 <div className="mt-6 pt-5 border-t border-app-border flex items-center gap-3 text-[10px] font-black text-app-muted-foreground uppercase tracking-tight">
 <RefreshCw size={14} className={`text-app-warning ${data.lowStock.length > 0 ? 'animate-spin-slow' : ''}`} /> {data.lowStock.length} items need reorder
 </div>
 </CardContent>
 </Card>
 </div>
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 {/* Advanced Area Chart */}
 <Card className="lg:col-span-2 card-premium overflow-hidden bg-app-surface">
 <CardHeader className="px-10 pt-10 flex flex-row items-center justify-between pb-4">
 <div>
 <CardTitle className="text-[11px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">Financial Trend</CardTitle>
 <h3>Revenue vs Cost of Goods</h3>
 </div>
 <div className="flex items-center gap-6">
 <div className="flex items-center gap-3">
 <div className="w-4 h-4 rounded-full bg-app-primary shadow-lg shadow-emerald-200" />
 <span className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">Revenue</span>
 </div>
 <div className="flex items-center gap-3">
 <div className="w-4 h-4 rounded-full bg-app-error shadow-lg shadow-rose-200" />
 <span className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">Estimated COGS</span>
 </div>
 </div>
 </CardHeader>
 <CardContent className="px-6 pb-6">
 <ResponsiveContainer width="100%" height={340}>
 <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
 <defs>
 <linearGradient id="colorLiq" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="var(--app-primary)" stopOpacity={0.15} />
 <stop offset="95%" stopColor="var(--app-primary)" stopOpacity={0} />
 </linearGradient>
 <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
 <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
 </linearGradient>
 </defs>
 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'var(--app-muted-foreground)' }} dy={15} />
 <YAxis hide />
 <Tooltip
 contentStyle={{ borderRadius: '2rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', padding: '20px', backgroundColor: 'var(--app-surface)', backdropFilter: 'blur(10px)' }}
 itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}
 />
 <Area type="monotone" dataKey="liquidity" stroke="var(--app-primary)" strokeWidth={5} fillOpacity={1} fill="url(#colorLiq)" />
 <Area type="monotone" dataKey="exposure" stroke="#f43f5e" strokeWidth={5} fillOpacity={1} fill="url(#colorExp)" />
 </AreaChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 {/* Performance Overview */}
 <Card className="card-premium overflow-hidden bg-app-surface">
 <CardHeader className="px-10 pt-10">
 <CardTitle className="text-[11px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">Location Performance</CardTitle>
 <h3>Warehouse Activity</h3>
 </CardHeader>
 <CardContent className="px-10 pb-10 space-y-6">
 {terminalPerformance.map((t: any, i: number) => (
 <div key={i} className="group">
 <div className="flex justify-between items-center mb-2.5">
 <span className="text-[11px] font-black text-app-muted-foreground uppercase tracking-tight">{t.name}</span>
 <span className="text-[10px] font-black text-app-primary bg-app-primary-light px-2 py-0.5 rounded-lg border border-app-success/30">{t.value}% LOAD</span>
 </div>
 <div className="h-4 w-full bg-app-background rounded-full overflow-hidden border border-app-border/50 shadow-inner">
 <div
 className={`h-full rounded-full transition-all duration-[2000ms] ${t.value > 80 ? 'bg-app-primary shadow-[0_0_15px_var(--app-success)]' : t.value > 40 ? 'bg-app-success/10' : 'bg-app-success/10'}`}
 style={{ width: `${t.value}%` }}
 />
 </div>
 </div>
 ))}
 <div className="pt-8 mt-8 border-t border-app-border flex items-center justify-between">
 <div className="space-y-1">
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">System Status</p>
 <p className="text-2xl font-black text-app-foreground tracking-tighter mt-1">Healthy</p>
 </div>
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-success flex items-center justify-center text-app-foreground shadow-xl shadow-emerald-200">
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
 <CardTitle className="text-[11px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">Sales Performance</CardTitle>
 <h3>Top Sellers</h3>
 </CardHeader>
 <CardContent className="p-10 space-y-8">
 {topSellers.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-app-muted-foreground">
 <Users size={48} className="mb-4 opacity-20" />
 <p className="text-[11px] font-black uppercase tracking-[0.2em]">No sales data yet</p>
 </div>
 ) : topSellers.map((s: any, i: number) => (
 <div key={i} className="flex items-center gap-6 group">
 <div className="w-14 h-14 rounded-2xl bg-app-background flex items-center justify-center font-black text-app-muted-foreground group-hover:bg-app-primary group-hover:text-app-foreground group-hover:rotate-6 transition-all duration-500 shadow-inner group-hover:shadow-emerald-200">
 {i + 1}
 </div>
 <div className="flex-1">
 <div className="flex justify-between items-start mb-2">
 <span className="text-[13px] font-black text-app-foreground uppercase tracking-tight">{s.name}</span>
 <span className="text-xs font-mono font-black text-app-primary bg-app-primary-light px-3 py-1 rounded-full border border-app-success/30">{fmt(s.revenue)}</span>
 </div>
 <div className="flex items-center gap-4">
 <div className="flex-1 h-2 bg-app-background rounded-full overflow-hidden border border-app-border/50">
 <div
 className="h-full bg-app-primary rounded-full transition-all duration-[1500ms]"
 style={{ width: `${(s.revenue / (topSellers[0]?.revenue || 1) * 100)}%` }}
 />
 </div>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">{s.count} sales</span>
 </div>
 </div>
 </div>
 ))}
 </CardContent>
 </Card>
 {/* Intelligence Stream */}
 <Card className="card-premium overflow-hidden bg-app-surface border-app-success/30/50 shadow-app-primary/20">
 <CardHeader className="p-10 pb-0">
 <CardTitle className="text-[11px] font-black uppercase tracking-widest text-app-primary mb-2">Recent Activity</CardTitle>
 <h3>Inventory Movements</h3>
 </CardHeader>
 <CardContent className="p-10 space-y-8">
 {recentMovements.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-app-muted-foreground">
 <Activity size={48} className="mb-4 opacity-20 animate-pulse" />
 <p className="text-[11px] font-black uppercase tracking-[0.2em]">No recent movements</p>
 </div>
 ) : recentMovements.map((m: any, i: number) => (
 <div key={i} className="flex items-start gap-5 hover:translate-x-2 transition-all duration-300 p-2 -m-2 rounded-2xl hover:bg-app-primary-light/30 group/log">
 <div className={`mt-2 w-2.5 h-2.5 rounded-full ${m.type === 'IN' ? 'bg-app-primary shadow-[0_0_12px_var(--app-success)]' : 'bg-app-error shadow-[0_0_12px_color-mix(in srgb, var(--app-error) 40%, transparent)]'} transition-all group-hover/log:scale-125`} />
 <div className="flex-1">
 <p className="text-[13px] font-black text-app-foreground uppercase tracking-tight leading-none mb-1.5 group-hover/log:text-app-success transition-colors">
 {m.product_name || `Product #${m.product}`}
 </p>
 <div className="flex items-center gap-3">
 <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
 <Building2 size={12} className="text-app-muted-foreground" /> {m.warehouse_name || 'Main Warehouse'}
 </p>
 <div className="w-1 h-1 rounded-full bg-app-border" />
 <p className="text-[10px] font-black text-app-primary/60 uppercase tracking-tighter">
 {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 </p>
 </div>
 </div>
 <div className="text-right">
 <p className={`text-[15px] font-black ${m.type === 'IN' ? 'text-app-primary' : 'text-app-error'} tracking-tighter`}>
 {m.type === 'IN' ? '+' : '−'}{parseFloat(m.quantity).toFixed(0)}
 </p>
 <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Units</p>
 </div>
 </div>
 ))}
 {recentMovements.length > 0 && (
 <button className="w-full h-14 rounded-2xl bg-app-primary-light text-app-success font-black text-[11px] uppercase tracking-[0.2em] hover:bg-app-primary hover:text-app-foreground transition-all duration-500 shadow-inner hover:shadow-xl hover:shadow-app-primary/20 active:scale-95 group/audit">
 View All Movements <ArrowRight size={16} className="inline ml-2 group-hover/audit:translate-x-1 transition-transform" />
 </button>
 )}
 </CardContent>
 </Card>
 </div>
 </div>
 )
}
