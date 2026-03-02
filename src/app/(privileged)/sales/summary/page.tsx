'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect } from "react"
import type { SalesAnalyticsData } from '@/types/erp'
import { getSalesAnalytics } from "@/app/actions/pos/sales-analytics"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 CalendarDays, DollarSign, TrendingUp, ShoppingCart, Users,
 Package, CreditCard, Receipt, Clock, BarChart3
} from "lucide-react"

const PAYMENT_ICONS: Record<string, string> = {
 CASH: '💵', CARD: '💳', MOBILE: '📱', TRANSFER: '🏦', CHECK: '📝', CREDIT: '🧾'
}

import { useAdmin } from "@/context/AdminContext"

export default function DailySummaryPage() {
 const { viewScope } = useAdmin()
 const { fmt } = useCurrency()
 const [data, setData] = useState<SalesAnalyticsData | null>(null)
 const [loading, setLoading] = useState(true)

 useEffect(() => { loadData() }, [viewScope])

 async function loadData() {
 setLoading(true)
 try {
 const result = await getSalesAnalytics(1) // Today only
 setData(result)
 } catch {
 toast.error("Failed to load daily summary")
 } finally {
 setLoading(false)
 }
 }

 if (loading || !data) {
 return (
 <div className="space-y-8 p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
 <Skeleton className="h-12 w-72" />
 <div className="grid grid-cols-4 gap-6">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-[2rem]" />)}</div>
 <Skeleton className="h-64 rounded-[2rem]" />
 <div className="grid grid-cols-2 gap-6">{[1, 2].map(i => <Skeleton key={i} className="h-64 rounded-[2rem]" />)}</div>
 </div>
 )
 }

 const { overall, top_products, top_customers, payment_methods } = data
 const today = new Date()
 const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
 const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

 return (
 <div className="space-y-8 p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
 {/* Header */}
 <header className="flex items-center justify-between">
 <div>
 <h1 className="text-4xl lg:page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
 <CalendarDays size={28} className="text-app-text" />
 </div>
 Daily <span className="text-emerald-600">Summary</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest flex items-center gap-2">
 <Clock size={14} /> {dateStr} · Last updated {timeStr}
 </p>
 </div>
 <button
 onClick={loadData}
 className="px-6 py-3 bg-emerald-600 text-app-text rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
 >
 <BarChart3 size={16} /> Refresh
 </button>
 </header>

 {/* Hero KPIs */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
 <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-[2rem] text-app-text shadow-xl shadow-emerald-100 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-32 h-32 bg-app-text/5 rounded-full -translate-y-10 translate-x-10" />
 <div className="relative">
 <DollarSign size={24} className="mb-3 opacity-80" />
 <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Today's Revenue</div>
 <div className="text-3xl font-black tracking-tight">{fmt(overall?.revenue || 0)}</div>
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm">
 <ShoppingCart size={24} className="text-blue-500 mb-3" />
 <div className="text-[10px] font-black text-app-text-faint uppercase tracking-widest mb-1">Total Orders</div>
 <div className="text-3xl font-black text-app-text tracking-tight">{overall?.orders || 0}</div>
 </div>

 <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm">
 <TrendingUp size={24} className="text-violet-500 mb-3" />
 <div className="text-[10px] font-black text-app-text-faint uppercase tracking-widest mb-1">Avg. Order</div>
 <div className="text-3xl font-black text-app-text tracking-tight">{fmt(overall?.avg_order || 0)}</div>
 </div>

 <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm">
 <Receipt size={24} className="text-rose-500 mb-3" />
 <div className="text-[10px] font-black text-app-text-faint uppercase tracking-widest mb-1">Tax Collected</div>
 <div className="text-3xl font-black text-app-text tracking-tight">{fmt(overall?.tax || 0)}</div>
 </div>
 </div>

 {/* Revenue Breakdown Banner */}
 <div className="bg-gray-900 text-app-text p-8 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
 <div className="flex gap-10">
 <div>
 <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Gross Revenue</div>
 <div className="text-2xl font-bold">{fmt((overall?.revenue || 0) + (overall?.discount || 0))}</div>
 </div>
 <div>
 <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Discounts</div>
 <div className="text-2xl font-bold text-orange-400">−{fmt(overall?.discount || 0)}</div>
 </div>
 <div>
 <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Tax</div>
 <div className="text-2xl font-bold text-rose-400">{fmt(overall?.tax || 0)}</div>
 </div>
 </div>
 <div className="text-right">
 <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Net Revenue</div>
 <div className="text-4xl font-black text-emerald-400 tracking-tighter">{fmt(overall?.revenue || 0)}</div>
 </div>
 </div>

 <div className="grid lg:grid-cols-2 gap-8">
 {/* Top Products Today */}
 <Card className="rounded-[2rem] border shadow-sm overflow-hidden">
 <CardHeader className="py-4 bg-app-bg border-b">
 <CardTitle className="text-base flex items-center gap-2 font-black">
 <Package size={18} className="text-emerald-500" /> Top Products Today
 </CardTitle>
 </CardHeader>
 <CardContent className="p-0">
 <Table>
 <TableHeader>
 <TableRow className="bg-gray-50/50 text-[10px] uppercase tracking-widest text-app-text-faint">
 <TableHead className="font-black">#</TableHead>
 <TableHead className="font-black">Product</TableHead>
 <TableHead className="text-right font-black">Qty</TableHead>
 <TableHead className="text-right font-black">Revenue</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {top_products?.map((p: Record<string, any>, i: number) => (
 <TableRow key={i} className="hover:bg-emerald-50/30 transition-colors">
 <TableCell className="font-bold text-gray-300">{i + 1}</TableCell>
 <TableCell className="font-semibold text-app-text">{p.name || 'Unknown'}</TableCell>
 <TableCell className="text-right text-sm text-app-text-muted">{Math.round(p.qty)}</TableCell>
 <TableCell className="text-right font-bold text-emerald-600">{fmt(p.revenue)}</TableCell>
 </TableRow>
 ))}
 {(!top_products?.length) && (
 <TableRow>
 <TableCell colSpan={4} className="text-center py-12 text-app-text-faint">
 <Package size={32} className="mx-auto mb-2 text-gray-200" />
 No sales recorded today
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </CardContent>
 </Card>

 {/* Top Customers Today */}
 <Card className="rounded-[2rem] border shadow-sm overflow-hidden">
 <CardHeader className="py-4 bg-app-bg border-b">
 <CardTitle className="text-base flex items-center gap-2 font-black">
 <Users size={18} className="text-blue-500" /> Top Customers Today
 </CardTitle>
 </CardHeader>
 <CardContent className="p-0">
 <Table>
 <TableHeader>
 <TableRow className="bg-gray-50/50 text-[10px] uppercase tracking-widest text-app-text-faint">
 <TableHead className="font-black">#</TableHead>
 <TableHead className="font-black">Customer</TableHead>
 <TableHead className="text-right font-black">Orders</TableHead>
 <TableHead className="text-right font-black">Spent</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {top_customers?.map((c: Record<string, any>, i: number) => (
 <TableRow key={i} className="hover:bg-blue-50/30 transition-colors">
 <TableCell className="font-bold text-gray-300">{i + 1}</TableCell>
 <TableCell className="font-semibold text-app-text">{c.name || 'Walk-in'}</TableCell>
 <TableCell className="text-right text-sm text-app-text-muted">{c.orders}</TableCell>
 <TableCell className="text-right font-bold text-blue-600">{fmt(c.spent)}</TableCell>
 </TableRow>
 ))}
 {(!top_customers?.length) && (
 <TableRow>
 <TableCell colSpan={4} className="text-center py-12 text-app-text-faint">
 <Users size={32} className="mx-auto mb-2 text-gray-200" />
 No customer data today
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </div>

 {/* Payment Methods */}
 <Card className="rounded-[2rem] border shadow-sm overflow-hidden">
 <CardHeader className="py-4 bg-app-bg border-b">
 <CardTitle className="text-base flex items-center gap-2 font-black">
 <CreditCard size={18} className="text-violet-500" /> Payment Methods
 </CardTitle>
 </CardHeader>
 <CardContent className="p-6">
 <div className="grid md:grid-cols-3 gap-6">
 {payment_methods?.map((p: Record<string, any>, i: number) => {
 const totalRev = overall?.revenue || 1
 const pct = (p.total / totalRev * 100)
 return (
 <div key={i} className="bg-app-bg rounded-2xl p-5 flex items-center gap-4 hover:bg-app-surface-2 transition-all">
 <div className="text-3xl">{PAYMENT_ICONS[p.method] || '💳'}</div>
 <div className="flex-1 min-w-0">
 <div className="flex justify-between items-baseline mb-2">
 <span className="font-bold text-app-text">{p.method}</span>
 <span className="text-xs text-app-text-faint font-medium">{p.count} orders</span>
 </div>
 <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
 </div>
 <div className="mt-1 text-right text-sm font-bold text-emerald-600">{fmt(p.total)}</div>
 </div>
 </div>
 )
 })}
 {(!payment_methods?.length) && (
 <div className="col-span-3 text-center py-12 text-app-text-faint">
 <CreditCard size={32} className="mx-auto mb-2 text-gray-200" />
 No payment data today
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 </div>
 )
}
