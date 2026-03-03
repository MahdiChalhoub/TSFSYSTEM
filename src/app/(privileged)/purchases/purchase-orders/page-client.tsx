'use client'

import { useState, useEffect } from 'react'
import { getPurchaseOrders, getPurchaseOrder } from '@/app/actions/inventory/locations'
import { ShoppingBag, RefreshCw, ChevronRight, Clock, CheckCircle, XCircle, Package, Truck, Calendar, User, Building2, FileText, ClipboardList, BookOpen } from 'lucide-react'

type PO = {
 id: number
 po_number?: string
 supplier?: { id: number; name: string }
 supplier_name?: string
 status: string
 order_date: string
 expected_delivery?: string
 total_amount: number
 notes?: string
 lines?: POLine[]
}

type POLine = {
 id: number
 product?: { id: number; name: string; sku?: string }
 product_name?: string
 quantity_ordered: number
 quantity_received?: number
 unit_price: number
 subtotal: number
}

const STATUS_STYLES: Record<string, string> = {
 DRAFT: 'bg-app-surface-2 text-app-muted-foreground border-app-border',
 SENT: 'bg-app-info/40 text-app-info border-app-info/30',
 PARTIALLY_RECEIVED: 'bg-app-warning/40 text-app-warning border-app-warning/30',
 RECEIVED: 'bg-app-success/40 text-app-primary border-app-success/30',
 CANCELLED: 'bg-app-error/40 text-app-error border-app-error/30',
}

export default function PurchaseOrdersPage() {
 const [orders, setOrders] = useState<PO[]>([])
 const [selected, setSelected] = useState<PO | null>(null)
 const [detail, setDetail] = useState<PO | null>(null)
 const [loading, setLoading] = useState(true)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 const data = await getPurchaseOrders()
 const raw = Array.isArray(data) ? data : (data?.results ?? [])
 setOrders(raw.filter((o: PO) => !['RECEIVED', 'INVOICED', 'COMPLETED'].includes(o.status)))
 setLoading(false)
 }

 async function openDetail(po: PO) {
 setSelected(po)
 const d = await getPurchaseOrder(po.id)
 setDetail(d)
 }

 const pending = orders.filter(o => ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED'].includes(o.status))
 const totalValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
 const received = orders.filter(o => o.status === 'RECEIVED').length

 return (
 <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div>
 <h1 className="text-4xl font-black tracking-tighter text-app-foreground flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-info flex items-center justify-center shadow-lg shadow-blue-200">
 <ClipboardList size={28} className="text-app-foreground" />
 </div>
 Purchase <span className="text-app-info">Orders</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Order Management & Fulfillment Tracking</p>
 </div>
 <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-surface border border-app-border hover:bg-app-background text-app-muted-foreground font-medium text-sm shadow-sm transition-all">
 <RefreshCw size={14} />
 Refresh
 </button>
 </div>

 {/* Stats */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {[
 { label: 'Total PO Value', value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: ShoppingBag, color: 'blue' },
 { label: 'In Progress', value: pending.length, icon: Clock, color: 'amber' },
 { label: 'Received', value: received, icon: CheckCircle, color: 'emerald' },
 ].map(s => (
 <div key={s.label} className="bg-app-surface p-5 rounded-2xl border border-app-border shadow-sm flex items-center gap-4 group">
 <div className={`w-12 h-12 rounded-xl bg-${s.color}-50 flex items-center justify-center group-hover:bg-${s.color}-100 transition-colors`}>
 <s.icon size={22} className={`text-${s.color}-600`} />
 </div>
 <div>
 <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">{s.label}</p>
 <p className={`text-2xl font-black text-${s.color}-600 mt-0.5`}>{s.value}</p>
 </div>
 </div>
 ))}
 </div>

 <div className="flex gap-6">
 {/* Orders list */}
 <div className="w-1/2 flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2">
 {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-app-surface-2 rounded-xl animate-pulse" />) :
 orders.length === 0 ? (
 <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center text-app-muted-foreground font-medium text-sm shadow-sm">No purchase orders found.</div>
 ) : orders.map(po => (
 <button key={po.id} onClick={() => openDetail(po)} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all shadow-sm ${selected?.id === po.id ? 'bg-app-info-bg border-app-info' : 'bg-app-surface border-app-border hover:border-app-border hover:bg-app-background'}`}>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-mono font-bold text-sm text-app-foreground">{po.po_number || `PO-${po.id}`}</span>
 <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[po.status] || 'bg-app-surface-2 text-app-muted-foreground border-app-border'}`}>{po.status.replace('_', ' ')}</span>
 </div>
 <div className="flex items-center gap-3 mt-0.5 text-xs text-app-muted-foreground">
 <span className="flex items-center gap-1"><Building2 size={10} />{po.supplier?.name || po.supplier_name || '—'}</span>
 <span className="flex items-center gap-1"><Calendar size={10} />{po.order_date}</span>
 </div>
 </div>
 <div className="text-sm font-black text-app-foreground shrink-0">${Number(po.total_amount || 0).toFixed(2)}</div>
 <ChevronRight size={14} className="text-app-muted-foreground shrink-0" />
 </button>
 ))}
 </div>

 {/* Detail panel */}
 <div className="w-1/2 bg-app-surface rounded-2xl border border-app-border p-6 flex flex-col gap-5 shadow-sm">
 {!selected ? (
 <div className="flex-1 flex flex-col items-center justify-center text-app-muted-foreground gap-3 py-12">
 <ShoppingBag size={48} className="text-app-foreground" />
 <p className="text-sm font-medium">Select a purchase order to view details</p>
 </div>
 ) : (
 <>
 <div className="flex justify-between items-start">
 <div>
 <h2 className="text-xl font-black text-app-foreground">{selected.po_number || `PO-${selected.id}`}</h2>
 <div className="flex items-center gap-3 text-sm font-bold text-app-muted-foreground mt-1">
 <span className="flex items-center gap-1.5"><Building2 size={14} className="text-app-muted-foreground" /> {selected.supplier?.name || selected.supplier_name}</span>
 </div>
 <div className="flex items-center gap-3 text-xs text-app-muted-foreground mt-1">
 <span className="flex items-center gap-1"><Calendar size={10} />Ordered: {selected.order_date}</span>
 {selected.expected_delivery && <span className="flex items-center gap-1"><Truck size={10} />Expected: {selected.expected_delivery}</span>}
 </div>
 </div>
 <div className="text-right flex flex-col items-end gap-2">
 <div className="text-2xl font-black text-app-foreground">${Number(selected.total_amount || 0).toFixed(2)}</div>
 <div className="flex gap-2 items-center">
 <a href={`/finance/ledger?q=${selected.po_number || selected.id}`} className="px-3 py-1 bg-app-primary/5 text-app-primary rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-app-primary/10 transition-colors">
 <BookOpen size={12} /> Ledger
 </a>
 <span className={`px-2 py-0.5 inline-block rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[selected.status] || ''}`}>{selected.status.replace('_', ' ')}</span>
 </div>
 </div>
 </div>

 {selected.notes && (
 <div className="flex items-start gap-2 bg-app-background rounded-xl p-4 border border-app-border">
 <FileText size={14} className="text-app-muted-foreground shrink-0 mt-0.5" />
 <p className="text-sm font-medium text-app-muted-foreground leading-relaxed">{selected.notes}</p>
 </div>
 )}

 {/* Order lines */}
 {detail?.lines && detail.lines.length > 0 && (
 <div>
 <h3 className="text-xs font-semibold text-app-muted-foreground uppercase tracking-wider mb-2">Order Lines</h3>
 <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
 {detail.lines.map(line => {
 const received = Number(line.quantity_received || 0)
 const ordered = Number(line.quantity_ordered || 0)
 const pct = ordered > 0 ? Math.min((received / ordered) * 100, 100) : 0
 return (
 <div key={line.id} className="bg-[#070D1B] rounded-xl border border-app-border p-3">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-app-info-bg flex items-center justify-center shrink-0">
 <Package size={14} className="text-app-info" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-sm font-bold text-app-foreground truncate">{line.product?.name || line.product_name || '—'}</div>
 {line.product?.sku && <div className="text-xs text-app-muted-foreground font-mono mt-0.5 font-medium">{line.product.sku}</div>}
 </div>
 <div className="text-right text-sm">
 <div className="text-app-muted-foreground font-medium">{ordered} × ${Number(line.unit_price || 0).toFixed(2)}</div>
 <div className="font-black text-app-foreground mt-0.5">${Number(line.subtotal || 0).toFixed(2)}</div>
 </div>
 </div>
 {line.quantity_received != null && (
 <div className="mt-2">
 <div className="flex justify-between text-[10px] font-bold text-app-muted-foreground mb-1.5 uppercase tracking-wider">
 <span>Received: {received} / {ordered}</span>
 <span>{pct.toFixed(0)}%</span>
 </div>
 <div className="h-1.5 bg-app-surface-2 rounded-full overflow-hidden">
 <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-app-primary' : pct > 0 ? 'bg-app-warning' : 'bg-app-surface-hover'}`} style={{ width: `${pct}%` }} />
 </div>
 </div>
 )}
 </div>
 )
 })}
 </div>
 </div>
 )}
 </>
 )}
 </div>
 </div>
 </div>
 )
}
