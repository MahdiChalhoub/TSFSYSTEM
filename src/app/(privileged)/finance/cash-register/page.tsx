'use client'

import { useState, useEffect, useMemo } from "react"
import { useCurrency } from '@/lib/utils/currency'
import { getDailySummary } from "@/app/actions/pos/daily-summary"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 Banknote, ShoppingCart, RotateCcw, CreditCard,
 Users, Clock, TrendingUp, Calendar, DollarSign, Receipt, ArrowRight, RefreshCw, BarChart3
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

const PAYMENT_ICONS: Record<string, string> = {
 CASH: '💵',
 CARD: '💳',
 MOBILE: '📱',
 BANK: '🏦',
 CREDIT: '📝',
}

const TYPE_CONFIG: Record<string, { color: string, bg: string }> = {
 SALE: { color: 'text-app-success', bg: 'bg-app-primary-light' },
 PURCHASE: { color: 'text-app-info', bg: 'bg-app-info-bg' },
 RETURN: { color: 'text-orange-700', bg: 'bg-orange-50' },
}

export default function CashRegisterPage() {
 const { fmt } = useCurrency()
 const [data, setData] = useState<Record<string, any> | null>(null)
 const [loading, setLoading] = useState(true)
 const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
 const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')
 const settings = useListViewSettings('fin_cash_register', {
 columns: ['ref_code', 'type', 'total', 'payment_method', 'user', 'time'],
 pageSize: 25, sortKey: 'time', sortDir: 'desc'
 })

 useEffect(() => { loadData() }, [selectedDate, period])

 async function loadData() {
 setLoading(true)
 try {
 if (period === 'today') {
 setData(await getDailySummary(selectedDate))
 } else if (period === 'week') {
 setData(await getDailySummary(undefined, 7))
 } else {
 setData(await getDailySummary(undefined, 30))
 }
 } catch {
 toast.error("Failed to load daily summary")
 } finally {
 setLoading(false)
 }
 }

 const sales = data?.sales || { count: 0, total: 0, tax: 0, discount: 0 }
 const returns = data?.returns || { count: 0, total: 0 }
 const paymentMethods = data?.payment_methods || {}
 const userStats = data?.user_stats || {}
 const hourly = data?.hourly || Array(24).fill(0)
 const recent = data?.recent || []
 const maxHourly = Math.max(...hourly, 1)

 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'ref_code',
 label: 'Reference',
 sortable: true,
 render: (t) => <span className="font-mono text-xs font-bold text-app-muted-foreground">#{t.ref_code || t.id}</span>
 },
 {
 key: 'type',
 label: 'Type',
 sortable: true,
 render: (t) => {
 const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.SALE
 return <Badge className={`${cfg.bg} ${cfg.color} border-none shadow-none text-[10px] font-black uppercase px-2 h-5 rounded-lg`}>{t.type}</Badge>
 }
 },
 {
 key: 'total',
 label: 'Amount',
 align: 'right',
 sortable: true,
 render: (t) => <span className="font-black text-app-foreground text-sm">{fmt(t.total)}</span>
 },
 {
 key: 'payment_method',
 label: 'Payment',
 sortable: true,
 render: (t) => (
 <div className="app-page flex items-center gap-2">
 <span className="text-base leading-none">{PAYMENT_ICONS[t.payment_method] || '💰'}</span>
 <span className="text-xs font-medium text-app-muted-foreground uppercase tracking-tighter">{t.payment_method}</span>
 </div>
 )
 },
 {
 key: 'user',
 label: 'Cashier',
 sortable: true,
 render: (t) => (
 <div className="flex items-center gap-2">
 <div className="w-5 h-5 rounded-full bg-app-surface-2 flex items-center justify-center">
 <Users size={10} className="text-app-muted-foreground" />
 </div>
 <span className="text-xs font-medium text-app-muted-foreground">{t.user}</span>
 </div>
 )
 },
 {
 key: 'time',
 label: 'Timestamp',
 sortable: true,
 render: (t) => (
 <div className="flex flex-col">
 <span className="text-[10px] font-black text-app-muted-foreground">
 {t.time ? new Date(t.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
 </span>
 </div>
 )
 }
 ], [fmt])

 if (loading && !data) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <div className="flex justify-between items-center">
 <div><Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-48 mt-2" /></div>
 <Skeleton className="h-10 w-64" />
 </div>
 <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
 <Skeleton className="h-96 rounded-3xl" />
 </div>
 )
 }

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 {/* Standard Header */}
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Banknote size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Cash <span className="text-app-primary">Register</span>
          </h1>
        </div>
      </div>
    </header>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <TrendingUp size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Total Revenue</p>
 <p className="text-2xl font-black mt-1 tracking-tighter text-app-primary">{fmt(sales.total)}</p>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mt-1">{sales.count} Txns</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <RotateCcw size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Returns</p>
 <p className="text-2xl font-black mt-1 tracking-tighter text-orange-600">{fmt(returns.total)}</p>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mt-1">{returns.count} Items</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-app-info-bg text-app-info flex items-center justify-center group-hover:scale-110 transition-transform">
 <Banknote size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Net Position</p>
 <p className="text-2xl font-black mt-1 tracking-tighter text-app-info">{fmt(data?.net_revenue || 0)}</p>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mt-1">Adjusted Balance</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <DollarSign size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Tax Collected</p>
 <p className="text-2xl font-black mt-1 tracking-tighter text-purple-600">{fmt(sales.tax)}</p>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mt-1">VAT/Service Tax</p>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Middle Row: Payment Methods + User Stats + Hourly */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* Payment Methods */}
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface">
 <CardHeader className="pb-2 pt-6 px-6">
 <CardTitle className="text-xs font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-2">
 <CreditCard size={14} className="text-app-muted-foreground" /> Revenue Split
 </CardTitle>
 </CardHeader>
 <CardContent className="px-6 pb-6 space-y-4">
 {Object.keys(paymentMethods).length === 0 ? (
 <div className="py-8 text-center"><p className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest italic">No Data logged</p></div>
 ) : Object.entries(paymentMethods).map(([method, stats]: [string, any]) => (
 <div key={method} className="flex items-center justify-between group">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-app-background flex items-center justify-center text-xl group-hover:scale-110 transition-transform shadow-inner">
 {PAYMENT_ICONS[method] || '💰'}
 </div>
 <div>
 <p className="text-sm font-bold text-app-foreground">{method}</p>
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-tighter">{stats.count} Transactions</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-sm font-black text-app-foreground">{fmt(stats.total)}</p>
 </div>
 </div>
 ))}
 </CardContent>
 </Card>

 {/* User Stats */}
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface">
 <CardHeader className="pb-2 pt-6 px-6">
 <CardTitle className="text-xs font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-2">
 <Users size={14} className="text-app-muted-foreground" /> Cashier Rank
 </CardTitle>
 </CardHeader>
 <CardContent className="px-6 pb-6 space-y-4">
 {Object.keys(userStats).length === 0 ? (
 <div className="py-8 text-center"><p className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest italic">No activity</p></div>
 ) : Object.entries(userStats)
 .sort(([, a]: [string, any], [, b]: [string, any]) => b.total - a.total)
 .map(([name, stats]: [string, any]) => (
 <div key={name} className="flex items-center justify-between group">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-app-background border border-app-border flex items-center justify-center text-app-muted-foreground font-black group-hover:bg-app-primary/5 group-hover:text-app-primary transition-all shadow-inner">
 {name.charAt(0).toUpperCase()}
 </div>
 <div>
 <p className="text-sm font-bold text-app-foreground">{name}</p>
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-tighter">{stats.count} Sales</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-sm font-black text-app-foreground">{fmt(stats.total)}</p>
 </div>
 </div>
 ))}
 </CardContent>
 </Card>

 {/* Hourly Distribution */}
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden">
 <CardHeader className="pb-4 pt-6 px-6">
 <CardTitle className="text-xs font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-2">
 <BarChart3 size={14} className="text-app-muted-foreground" /> Hourly Pulse
 </CardTitle>
 </CardHeader>
 <CardContent className="px-6 pb-4">
 <div className="flex items-end gap-[3px] h-32 mb-2">
 {hourly.map((val: number, i: number) => {
 const pct = (val / maxHourly) * 100
 const isActive = val > 0
 return (
 <div
 key={i}
 className="flex-1 group relative"
 title={`${i}:00 — ${fmt(val)}`}
 >
 <div
 className={`w-full rounded-t-sm transition-all duration-500 ease-out ${isActive ? 'bg-app-primary hover:bg-app-primary shadow-[0_0_10px_var(--app-success)]' : 'bg-app-background'
 }`}
 style={{ height: `${Math.max(pct, 4)}%` }}
 />
 </div>
 )
 })}
 </div>
 <div className="flex justify-between mt-1 text-[8px] font-black text-app-muted-foreground uppercase tracking-tighter">
 <span>00h</span><span>08h</span><span>12h</span><span>16h</span><span>23h</span>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Recent Transactions Table */}
 <TypicalListView
 title="Recent Register Activity"
 data={recent}
 loading={loading}
 getRowId={(t) => t.id}
 columns={columns}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 headerExtra={
 <div className="flex items-center gap-3">
 <Badge variant="outline" className="rounded-xl px-3 py-1 text-app-muted-foreground border-app-border">
 {recent.length} Records
 </Badge>
 <button onClick={loadData} className="p-2 hover:bg-app-background rounded-xl transition-colors text-app-muted-foreground hover:text-app-foreground">
 <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
 </button>
 </div>
 }
 />
 </div>
 )
}
