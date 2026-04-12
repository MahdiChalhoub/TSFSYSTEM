'use client'

import { useState, useEffect, useMemo } from 'react'
import { useCurrency } from '@/lib/utils/currency'
import Link from 'next/link'
import {
 Shield, ShieldCheck, ShieldAlert, RefreshCw, Search, ArrowLeft,
 CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink, Zap,
 Filter, Download
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type FNEOrder = {
 id: number
 ref_code: string
 type: string
 invoice_number: string
 contact_name: string
 total_amount: number | string
 created_at: string
 payment_method: string
 fne_status: string | null
 fne_reference: string | null
 fne_token: string | null
 fne_error: string | null
}

export default function FNEMonitorClient() {
 const { fmt } = useCurrency()
 const [orders, setOrders] = useState<FNEOrder[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [filter, setFilter] = useState<'ALL' | 'CERTIFIED' | 'FAILED' | 'PENDING' | 'NONE'>('ALL')
 const [retryingIds, setRetryingIds] = useState<Set<number>>(new Set())
 const [bulkRetrying, setBulkRetrying] = useState(false)

 useEffect(() => { loadOrders() }, [])

 async function loadOrders() {
 setLoading(true)
 try {
 const { erpFetch } = await import('@/lib/erp-api')
 const data = await erpFetch('pos/orders/?limit=500', { cache: 'no-store' })
 const ordersList: FNEOrder[] = Array.isArray(data) ? data : data.results || []
 setOrders(ordersList)
 } catch {
 toast.error('Failed to load orders')
 } finally {
 setLoading(false)
 }
 }

 async function retryFne(orderId: number) {
 setRetryingIds(prev => new Set(prev).add(orderId))
 try {
 const { erpFetch } = await import('@/lib/erp-api')
 const res = await erpFetch(`pos/orders/${orderId}/retry-fne/`, { method: 'POST' })
 if (res.success) {
 toast.success(`✓ Certifié: ${res.fne_reference}`)
 // Update local state
 setOrders(prev => prev.map(o =>
 o.id === orderId
  ? { ...o, fne_status: 'CERTIFIED', fne_reference: res.fne_reference, fne_token: res.fne_token, fne_error: null }
  : o
 ))
 } else {
 toast.error(res.error || 'Certification échouée')
 }
 } catch (e: any) {
 toast.error(e?.message || 'Retry failed')
 } finally {
 setRetryingIds(prev => { const next = new Set(prev); next.delete(orderId); return next })
 }
 }

 async function bulkRetryFailed() {
 const failedOrders = filtered.filter(o => o.fne_status === 'FAILED')
 if (failedOrders.length === 0) return toast.info('No failed orders to retry')

 setBulkRetrying(true)
 let successCount = 0
 let failCount = 0

 for (const order of failedOrders) {
 try {
 const { erpFetch } = await import('@/lib/erp-api')
 const res = await erpFetch(`pos/orders/${order.id}/retry-fne/`, { method: 'POST' })
 if (res.success) {
  successCount++
  setOrders(prev => prev.map(o =>
  o.id === order.id
   ? { ...o, fne_status: 'CERTIFIED', fne_reference: res.fne_reference, fne_token: res.fne_token, fne_error: null }
   : o
  ))
 } else {
  failCount++
 }
 } catch {
 failCount++
 }
 }

 setBulkRetrying(false)
 toast.success(`Bulk retry: ${successCount} certified, ${failCount} failed`)
 }

 const filtered = useMemo(() => {
 return orders
 .filter(o => {
 if (filter === 'ALL') return true
 if (filter === 'NONE') return !o.fne_status
 return o.fne_status === filter
 })
 .filter(o =>
 !search ||
 (o.ref_code || '').toLowerCase().includes(search.toLowerCase()) ||
 (o.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
 (o.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
 (o.fne_reference || '').toLowerCase().includes(search.toLowerCase())
 )
 }, [orders, filter, search])

 const stats = useMemo(() => {
 const certified = orders.filter(o => o.fne_status === 'CERTIFIED').length
 const failed = orders.filter(o => o.fne_status === 'FAILED').length
 const pending = orders.filter(o => o.fne_status === 'PENDING').length
 const none = orders.filter(o => !o.fne_status).length
 const rate = orders.length > 0 ? Math.round((certified / orders.length) * 100) : 0
 return { certified, failed, pending, none, total: orders.length, rate }
 }, [orders])

 const statusIcon = (s: string | null) => {
 if (s === 'CERTIFIED') return <CheckCircle2 size={14} className="text-emerald-500" />
 if (s === 'FAILED') return <XCircle size={14} className="text-rose-500" />
 if (s === 'PENDING') return <Clock size={14} className="text-amber-500" />
 return <AlertTriangle size={14} className="text-app-muted-foreground" />
 }

 const statusBadge = (s: string | null) => {
 if (s === 'CERTIFIED') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-black">CERTIFIÉ</Badge>
 if (s === 'FAILED') return <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px] font-black">ÉCHOUÉ</Badge>
 if (s === 'PENDING') return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-black">EN ATTENTE</Badge>
 return <Badge className="bg-app-surface-2 text-app-muted-foreground border-app-border text-[10px] font-black">NON SOUMIS</Badge>
 }

 return (
 <div className="min-h-screen p-8 space-y-8 animate-in fade-in duration-500">
 {/* Header */}
 <header className="flex justify-between items-end">
 <div>
 <Link href="/settings/e-invoicing" className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-primary transition-all mb-4">
  <ArrowLeft size={14} /> Back to E-Invoicing Settings
 </Link>
 <div className="flex items-center gap-3 mb-2">
  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
  🇨🇮 Côte d&apos;Ivoire
  </Badge>
  <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-1">
  <Zap size={12} /> Direction Générale des Impôts
  </span>
 </div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
  <div className="w-16 h-16 rounded-[1.8rem] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-200">
  <ShieldCheck size={32} className="text-white" />
  </div>
  FNE <span className="text-emerald-600">Monitor</span>
 </h1>
 </div>
 <div className="flex items-center gap-3">
  <button
  onClick={bulkRetryFailed}
  disabled={bulkRetrying || stats.failed === 0}
  className="h-12 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-200 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
  >
  {bulkRetrying ? <RefreshCw size={18} className="animate-spin" /> : <Shield size={18} />}
  {bulkRetrying ? 'Certification...' : `Retry All Failed (${stats.failed})`}
  </button>
  <button
  onClick={loadOrders}
  className="h-12 w-12 rounded-2xl bg-app-surface border border-app-border flex items-center justify-center text-app-muted-foreground hover:text-app-primary transition-all"
  >
  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
  </button>
 </div>
 </header>

 {/* KPI Cards */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
 {[
 { label: 'Total Orders', value: stats.total, icon: <Shield size={20} />, bg: 'bg-app-surface', color: 'text-app-text' },
 { label: 'Certified', value: stats.certified, icon: <ShieldCheck size={20} />, bg: 'bg-emerald-50', color: 'text-emerald-700', border: 'border-emerald-200' },
 { label: 'Failed', value: stats.failed, icon: <ShieldAlert size={20} />, bg: 'bg-rose-50', color: 'text-rose-700', border: 'border-rose-200' },
 { label: 'Pending', value: stats.pending, icon: <Clock size={20} />, bg: 'bg-amber-50', color: 'text-amber-700', border: 'border-amber-200' },
 { label: 'Compliance Rate', value: `${stats.rate}%`, icon: <CheckCircle2 size={20} />,
 bg: stats.rate >= 90 ? 'bg-emerald-50' : stats.rate >= 60 ? 'bg-amber-50' : 'bg-rose-50',
 color: stats.rate >= 90 ? 'text-emerald-700' : stats.rate >= 60 ? 'text-amber-700' : 'text-rose-700',
 border: stats.rate >= 90 ? 'border-emerald-200' : stats.rate >= 60 ? 'border-amber-200' : 'border-rose-200',
 },
 ].map(({ label, value, icon, bg, color, border }) => (
 <div key={label} className={`${bg} p-5 rounded-[2rem] border ${border || 'border-app-border'} shadow-sm`}>
 <div className={`${color} mb-2`}>{icon}</div>
 <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">{label}</div>
 <div className={`text-2xl font-black ${color}`}>{value}</div>
 </div>
 ))}
 </div>

 {/* Filter + Search */}
 <div className="flex items-center gap-3">
 <div className="relative flex-1 max-w-md">
 <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
 <input
  value={search}
  onChange={e => setSearch(e.target.value)}
  placeholder="Search by ref, invoice, client, FNE reference..."
  className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm font-bold bg-app-surface border border-app-border outline-none focus:border-app-primary transition-all"
 />
 </div>
 <div className="flex gap-1 bg-app-surface rounded-2xl border border-app-border p-1">
 {(['ALL', 'CERTIFIED', 'FAILED', 'PENDING', 'NONE'] as const).map(f => (
  <button
  key={f}
  onClick={() => setFilter(f)}
  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
  filter === f
   ? 'bg-app-primary text-white shadow-sm'
   : 'text-app-muted-foreground hover:bg-app-bg'
  }`}
  >
  {f === 'ALL' ? 'All' : f === 'NONE' ? 'No FNE' : f}
  </button>
 ))}
 </div>
 </div>

 {/* Orders Table */}
 <div className="bg-app-surface rounded-[2.5rem] border border-app-border shadow-xl overflow-hidden">
 <div className="p-6 border-b border-app-border flex items-center justify-between">
 <div className="flex items-center gap-3">
  <ShieldCheck size={18} className="text-emerald-600" />
  <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
  FNE Certification Registry
  </span>
  <Badge className="bg-app-bg text-app-muted-foreground border-app-border text-[10px]">
  {filtered.length} records
  </Badge>
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full">
  <thead>
  <tr className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest border-b border-app-border">
  <th className="p-4 text-left">Status</th>
  <th className="p-4 text-left">Reference</th>
  <th className="p-4 text-left">Client</th>
  <th className="p-4 text-left">Date</th>
  <th className="p-4 text-left">Payment</th>
  <th className="p-4 text-right">Amount</th>
  <th className="p-4 text-left">FNE Ref</th>
  <th className="p-4 text-center">Actions</th>
  </tr>
  </thead>
  <tbody className="divide-y divide-app-border/50">
  {loading ? (
  Array.from({ length: 8 }).map((_, i) => (
  <tr key={i}>
   <td colSpan={8} className="p-4"><div className="h-10 bg-app-bg rounded-xl animate-pulse" /></td>
  </tr>
  ))
  ) : filtered.length === 0 ? (
  <tr>
  <td colSpan={8} className="p-16 text-center text-app-muted-foreground">
   <div className="flex flex-col items-center gap-3 opacity-50">
   <Shield size={40} strokeWidth={1} />
   <p className="text-sm font-bold">No matching orders</p>
   </div>
  </td>
  </tr>
  ) : filtered.map(order => (
  <tr key={order.id} className="hover:bg-app-bg/50 transition-colors group">
  <td className="p-4">
   <div className="flex items-center gap-2">
   {statusIcon(order.fne_status)}
   {statusBadge(order.fne_status)}
   </div>
  </td>
  <td className="p-4">
   <Link href={`/sales/${order.id}`} className="flex items-center gap-1 text-sm font-bold text-app-text hover:text-app-primary transition-colors">
   {order.type === 'RETURN' ? '🔄 ' : ''}{order.invoice_number || order.ref_code || `#${order.id}`}
   <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition" />
   </Link>
  </td>
  <td className="p-4 text-sm text-app-text-muted font-medium">{order.contact_name || 'Walk-In'}</td>
  <td className="p-4 text-xs text-app-muted-foreground">
   {order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : '—'}
  </td>
  <td className="p-4">
   <Badge className="bg-app-bg text-app-muted-foreground border-app-border text-[10px] font-bold">
   {order.payment_method || '—'}
   </Badge>
  </td>
  <td className="p-4 text-right">
   <span className="text-sm font-black text-app-text tabular-nums">
   {fmt(parseFloat(String(order.total_amount || 0)))}
   </span>
  </td>
  <td className="p-4">
   {order.fne_reference ? (
   <span className="text-xs font-bold text-emerald-600 font-mono">{order.fne_reference}</span>
   ) : order.fne_error ? (
   <span className="text-[10px] text-rose-500 font-medium truncate max-w-[200px] block" title={order.fne_error}>
    {order.fne_error}
   </span>
   ) : (
   <span className="text-xs text-app-muted-foreground">—</span>
   )}
  </td>
  <td className="p-4 text-center">
   {order.fne_status === 'FAILED' || !order.fne_status ? (
   <button
    onClick={() => retryFne(order.id)}
    disabled={retryingIds.has(order.id)}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-200 transition-all disabled:opacity-50"
   >
    {retryingIds.has(order.id) ? <RefreshCw size={12} className="animate-spin" /> : <Shield size={12} />}
    Certify
   </button>
   ) : order.fne_status === 'CERTIFIED' ? (
   <span className="text-emerald-500"><CheckCircle2 size={16} /></span>
   ) : (
   <span className="text-amber-500"><Clock size={16} /></span>
   )}
  </td>
  </tr>
  ))}
  </tbody>
 </table>
 </div>
 </div>
 </div>
 )
}
