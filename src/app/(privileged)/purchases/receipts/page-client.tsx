'use client'

import { useState, useEffect } from 'react'
import { getPurchaseOrders, getPurchaseOrder } from '@/app/actions/inventory/locations'
import {
 ShoppingBag, RefreshCw, ChevronRight, Clock, CheckCircle,
 XCircle, Package, Truck, Calendar, Building2, FileText,
 ArrowUpRight, Database, Search, Filter, ShieldCheck,
 AlertCircle, ListRestart, MoreHorizontal
} from 'lucide-react';
import { Plus } from 'lucide-react';
import ReceiveLineDialog from './ReceiveLineDialog'

type PO = {
 id: number
 po_number?: string
 supplier?: { id: number; name: string }
 supplier_name?: string
 status: string
 order_date: string
 expected_date?: string
 total_amount: number
 notes?: string
 lines?: POLine[]
}

type POLine = {
 id: number
 product?: { id: number; name: string; sku?: string }
 product_name?: string
 quantity: number
 qty_received: number
 unit_price: number
 line_total: number
}

const STATUS_STYLES: Record<string, { bg: string, text: string, border: string, icon: any }> = {
 DRAFT: { bg: 'bg-app-background', text: 'text-app-muted-foreground', border: 'border-app-border', icon: Clock },
 SUBMITTED: { bg: 'bg-app-info-bg', text: 'text-app-info', border: 'border-app-info/30', icon: ArrowUpRight },
 APPROVED: { bg: 'bg-app-primary/5', text: 'text-app-primary', border: 'border-app-primary/30', icon: CheckCircle },
 ORDERED: { bg: 'bg-app-warning-bg', text: 'text-app-warning', border: 'border-app-warning/30', icon: Truck },
 CONFIRMED: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100', icon: CheckCircle },
 PARTIALLY_RECEIVED: { bg: 'bg-app-primary-light/50', text: 'text-app-success', border: 'border-app-success', icon: AlertCircle },
 RECEIVED: { bg: 'bg-app-primary-light', text: 'text-app-success', border: 'border-app-success', icon: ShieldCheck },
 INVOICED: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', icon: FileText },
 COMPLETED: { bg: 'bg-app-info-bg', text: 'text-app-info', border: 'border-app-info/30', icon: Database },
 CANCELLED: { bg: 'bg-app-error-bg', text: 'text-app-error', border: 'border-app-error/30', icon: XCircle },
}

export default function ReceiptsPage() {
 const [orders, setOrders] = useState<PO[]>([])
 const [selected, setSelected] = useState<PO | null>(null)
 const [detail, setDetail] = useState<PO | null>(null)
 const [loading, setLoading] = useState(true)
 const [receivingLine, setReceivingLine] = useState<POLine | null>(null)
 const [searchTerm, setSearchTerm] = useState('')

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 try {
 const data = await getPurchaseOrders()
 const raw = Array.isArray(data) ? data : (data?.results ?? [])
 // Filter to only show records in receivable states
 const receivable = raw.filter((o: PO) =>
 ['ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(o.status)
 )
 setOrders(receivable)
 } catch (err) {
 console.error(err)
 } finally {
 setLoading(false)
 }
 }

 async function openDetail(po: PO) {
 setSelected(po)
 setDetail(null)
 try {
 const d = await getPurchaseOrder(po.id)
 setDetail(d)
 } catch (err) { console.error(err) }
 }

 const pendingCount = orders.filter(o => ['ORDERED', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(o.status)).length
 const totalValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
 const receivedCount = orders.filter(o => o.status === 'RECEIVED').length

 const filteredOrders = orders.filter(o =>
 (o.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
 (o.supplier?.name || o.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase())
 )

 return (
 <div className="p-8 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700 pb-24">
 {/* Header Section */}
 <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-app-foreground/40 p-8 rounded-[3rem] border border-app-text/60 shadow-xl shadow-app-border/20 backdrop-blur-xl">
 <div className="flex items-center gap-6">
 <div className="w-20 h-20 rounded-[2.5rem] bg-app-primary flex items-center justify-center shadow-2xl shadow-app-primary/20 text-app-foreground transform hover:rotate-6 transition-transform">
 <Truck size={38} strokeWidth={2.5} />
 </div>
 <div>
 <div className="flex items-center gap-3">
 <button onClick={() => window.location.href = '/purchases/new'} className="h-14 px-8 rounded-2xl bg-app-primary text-app-foreground font-black text-xs uppercase tracking-widest hover:bg-app-primary transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2">
 <Plus size={16} />
 Direct Operations
 </button>
 <h1 className="text-5xl font-black tracking-tighter text-app-foreground leading-tight">
 Stock <span className="text-app-primary">Reception</span>
 </h1>
 <div className="px-3 py-1 bg-app-primary-light text-app-success rounded-full text-[10px] font-black uppercase tracking-widest border border-app-success shadow-sm">
 Fulfillment Center
 </div>
 </div>
 <p className="text-sm font-bold text-app-muted-foreground mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
 <ShieldCheck size={14} className="text-app-primary" />
 Inventory Arrival and Quality Verification
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <button onClick={() => window.location.href = '/purchases/new'} className="h-14 px-8 rounded-2xl bg-app-primary text-app-foreground font-black text-xs uppercase tracking-widest hover:bg-app-primary transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2">
 <Plus size={16} />
 Direct Operations
 </button>
 <button onClick={load} className="h-14 px-8 rounded-2xl bg-app-surface border-2 border-app-border text-app-muted-foreground font-black text-xs uppercase tracking-widest hover:bg-app-background hover:border-app-border shadow-sm transition-all flex items-center gap-2 active:scale-95 group">
 <RefreshCw size={16} className="group-active:rotate-180 transition-transform" />
 Sync Data
 </button>
 <div className="w-px h-10 bg-app-surface-2 mx-2 hidden lg:block" />
 <div className="flex flex-col items-end">
 <div className="text-2xl font-black text-app-primary tracking-tighter">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Total Committed Pipeline</div>
 </div>
 </div>
 </div>

 {/* Stats Dashboard */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {[
 { label: 'Inbound Pipeline', value: orders.length, icon: Package, color: 'emerald', desc: 'Current Active POs' },
 { label: 'Pending Receipt', value: pendingCount, icon: Clock, color: 'amber', desc: 'Awaiting Fulfillment' },
 { label: 'Recently Completed', value: receivedCount, icon: CheckCircle, color: 'blue', desc: '100% Stocked & Verified' },
 ].map(s => (
 <div key={s.label} className="bg-app-surface p-6 rounded-[2.5rem] border border-app-border shadow-2xl shadow-app-border/20 hover:-translate-y-2 transition-all group overflow-hidden relative">
 <div className={`absolute top-0 right-0 w-32 h-32 bg-${s.color}-50/30 rounded-full -mr-16 -mt-16 blur-3xl`} />
 <div className="flex items-center gap-5 relative z-10">
 <div className={`w-14 h-14 rounded-2xl bg-${s.color}-50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm`}>
 <s.icon size={24} className={`text-${s.color}-600`} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">{s.label}</p>
 <p className={`text-3xl font-black text-app-foreground mt-0.5 tracking-tight`}>{s.value}</p>
 </div>
 </div>
 <p className="text-[11px] font-bold text-app-muted-foreground mt-4 px-1">{s.desc}</p>
 </div>
 ))}
 </div>

 <div className="flex flex-col xl:flex-row gap-8 min-h-[600px]">
 {/* Left Panel: List */}
 <div className="w-full xl:w-[450px] space-y-4">
 <div className="bg-app-surface p-4 rounded-[2rem] border border-app-border shadow-xl shadow-app-border/20 flex items-center gap-3">
 <Search size={18} className="text-app-muted-foreground ml-3" />
 <input
 type="text"
 placeholder="Find by PO#, Supplier..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="flex-1 bg-transparent border-none outline-none font-bold text-sm text-app-muted-foreground placeholder:text-app-muted-foreground"
 />
 <button className="p-2.5 rounded-xl bg-app-background text-app-muted-foreground hover:text-app-primary transition-colors">
 <Filter size={16} />
 </button>
 </div>

 <div className="flex flex-col gap-3 overflow-y-auto max-h-[800px] pr-2 scrollbar-thin scrollbar-thumb-gray-200">
 {loading ? Array.from({ length: 5 }).map((_, i) => (
 <div key={i} className="h-24 bg-app-foreground/50 border border-app-border rounded-[2rem] animate-pulse" />
 )) : filteredOrders.length === 0 ? (
 <div className="bg-app-foreground/50 rounded-[2rem] border-2 border-dashed border-app-border p-12 text-center opacity-40">
 <ShoppingBag size={40} className="mx-auto mb-4" />
 <p className="text-sm font-black uppercase tracking-widest text-app-success">No Orders Found</p>
 </div>
 ) : filteredOrders.map(po => {
 const style = STATUS_STYLES[po.status] || STATUS_STYLES.DRAFT;
 const Icon = style.icon;
 return (
 <button
 key={po.id}
 onClick={() => openDetail(po)}
 className={`w-full text-left p-6 rounded-[2rem] border-2 transition-all group relative overflow-hidden active:scale-95 ${selected?.id === po.id ? 'bg-app-surface border-app-primary shadow-2xl shadow-app-primary/20 ring-8 ring-app-primary/5' : 'bg-app-foreground/60 border-transparent hover:border-app-border hover:bg-app-surface hover:shadow-xl hover:shadow-app-border/20'}`}
 >
 {selected?.id === po.id && <div className="absolute top-0 right-0 w-24 h-24 bg-app-primary/5 rounded-full -mr-12 -mt-12" />}
 <div className="flex justify-between items-start mb-4">
 <div className={`p-2 rounded-xl ${style.bg} ${style.text} border ${style.border}`}>
 <Icon size={16} />
 </div>
 <div className="text-right">
 <div className="text-lg font-black text-app-foreground tracking-tighter">${po.total_amount.toLocaleString()}</div>
 <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-[0.2em] mt-0.5">Grand Total</div>
 </div>
 </div>

 <div className="font-mono font-black text-lg text-app-foreground tracking-tighter group-hover:text-app-success transition-colors">
 {po.po_number || `PO-${po.id}`}
 </div>

 <div className="flex items-center gap-2 mt-2">
 <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${style.bg} ${style.text} ${style.border}`}>
 {po.status.replace('_', ' ')}
 </span>
 </div>

 <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-app-border/50">
 <div className="flex items-center gap-2 text-[10px] font-bold text-app-muted-foreground truncate">
 <Building2 size={12} className="text-app-muted-foreground" />
 {po.supplier?.name || po.supplier_name}
 </div>
 <div className="flex items-center gap-2 text-[10px] font-bold text-app-muted-foreground justify-end">
 <Calendar size={12} className="text-app-muted-foreground" />
 {po.order_date}
 </div>
 </div>
 </button>
 );
 })}
 </div>
 </div>

 {/* Right Panel: Detail Workspace */}
 <div className="flex-1 bg-app-surface rounded-[3.5rem] border border-app-border shadow-2xl shadow-app-border/20 overflow-hidden flex flex-col min-h-[800px]">
 {!selected ? (
 <div className="flex-1 flex flex-col items-center justify-center text-app-muted-foreground gap-6 opacity-40">
 <div className="w-32 h-32 rounded-[3.5rem] bg-app-background flex items-center justify-center">
 <ListRestart size={48} />
 </div>
 <div>
 <p className="text-xl font-black uppercase tracking-widest text-center">Ready for Processing</p>
 <p className="text-sm font-medium text-center mt-2">Select an order shipment to review its contents</p>
 </div>
 </div>
 ) : (
 <div className="flex flex-col h-full animate-in slide-in-from-right-10 duration-500">
 {/* Detail Header */}
 <div className="p-10 border-b border-app-border bg-app-surface-2/30">
 <div className="flex justify-between items-start">
 <div className="space-y-4">
 <div className="flex items-center gap-4">
 <h2 className="text-4xl font-black text-app-foreground tracking-tighter">{selected.po_number || `PO-${selected.id}`}</h2>
 <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${STATUS_STYLES[selected.status]?.bg} ${STATUS_STYLES[selected.status]?.text} ${STATUS_STYLES[selected.status]?.border}`}>
 {selected.status.replace('_', ' ')}
 </span>
 </div>
 <div className="flex flex-wrap items-center gap-6">
 <div className="flex items-center gap-3">
 <button onClick={() => window.location.href = '/purchases/new'} className="h-14 px-8 rounded-2xl bg-app-primary text-app-foreground font-black text-xs uppercase tracking-widest hover:bg-app-primary transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2">
 <Plus size={16} />
 Direct Operations
 </button>
 <div className="w-10 h-10 rounded-xl bg-app-surface border border-app-border flex items-center justify-center shadow-sm">
 <Building2 size={18} className="text-app-muted-foreground" />
 </div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Supplier</div>
 <div className="text-sm font-black text-app-foreground">{selected.supplier?.name || selected.supplier_name}</div>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <button onClick={() => window.location.href = '/purchases/new'} className="h-14 px-8 rounded-2xl bg-app-primary text-app-foreground font-black text-xs uppercase tracking-widest hover:bg-app-primary transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2">
 <Plus size={16} />
 Direct Operations
 </button>
 <div className="w-10 h-10 rounded-xl bg-app-surface border border-app-border flex items-center justify-center shadow-sm">
 <Calendar size={18} className="text-app-muted-foreground" />
 </div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Shipment Logic</div>
 <div className="text-sm font-black text-app-foreground">{selected.expected_date || 'STANDARD ETA'}</div>
 </div>
 </div>
 </div>
 </div>
 <div className="text-right">
 <div className="text-5xl font-black text-app-foreground tracking-tighter tabular-nums">${selected.total_amount.toLocaleString()}</div>
 <p className="text-[11px] font-black text-app-primary uppercase tracking-[0.3em] mt-3">Verified Document</p>
 </div>
 </div>

 {selected.notes && (
 <div className="mt-8 flex items-start gap-4 p-5 bg-app-surface rounded-3xl border border-app-border shadow-sm relative overflow-hidden group">
 <div className="absolute top-0 left-0 w-1 h-full bg-app-primary" />
 <FileText size={20} className="text-app-muted-foreground mt-1 shrink-0" />
 <p className="text-sm font-bold text-app-muted-foreground leading-relaxed italic">{selected.notes}</p>
 </div>
 )}
 </div>

 {/* Lines Table Section */}
 <div className="flex-1 p-10 overflow-y-auto">
 <h3 className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
 <Package size={14} /> Shipment Documentation Check-in
 </h3>

 <div className="space-y-4">
 {!detail ? Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="h-28 bg-app-background rounded-3xl animate-pulse" />
 )) : detail.lines?.length === 0 ? (
 <div className="p-12 bg-app-background rounded-3xl text-center font-bold text-app-muted-foreground">
 No shipment data attached to this PO.
 </div>
 ) : detail.lines?.map(line => {
 const received = Number(line.qty_received || 0);
 const ordered = Number(line.quantity || 0);
 const pct = ordered > 0 ? Math.min((received / ordered) * 100, 100) : 0;
 const isReceivable = ['ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(selected.status) && received < ordered;

 return (
 <div key={line.id} className="group bg-app-surface p-6 rounded-[2.5rem] border border-app-border hover:border-app-success hover:shadow-2xl hover:shadow-app-border/20 transition-all flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
 <div className="flex items-center gap-6 flex-1 min-w-0">
 <div className="w-16 h-16 rounded-2xl bg-app-background group-hover:bg-app-primary-light flex items-center justify-center transition-colors shrink-0">
 <Package size={28} className="text-app-muted-foreground group-hover:text-app-primary transition-colors" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-lg font-black text-app-foreground truncate group-hover:text-app-success transition-colors">{line.product_name}</div>
 <div className="flex items-center gap-4 mt-1.5">
 <div className="text-xs font-mono font-black text-app-muted-foreground bg-app-background px-2 py-0.5 rounded-lg border border-app-border">{line.product?.sku}</div>
 <div className="text-xs font-bold text-app-muted-foreground">Unit Basis: ${Number(line.unit_price).toFixed(2)}</div>
 </div>
 </div>
 </div>

 <div className="w-full md:w-64 space-y-3">
 <div className="flex justify-between items-end px-1">
 <div className="flex flex-col">
 <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Progress</span>
 <span className="text-sm font-black text-app-foreground">{received} <span className="text-app-muted-foreground font-medium">/</span> {ordered}</span>
 </div>
 <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${pct >= 100 ? 'bg-app-primary-light text-app-success' : 'bg-app-warning-bg text-app-warning'}`}>
 {pct.toFixed(0)}%
 </span>
 </div>
 <div className="h-3 bg-app-background rounded-full overflow-hidden border border-app-border relative">
 <div
 className={`h-full rounded-full transition-all duration-1000 ${pct >= 100 ? 'bg-app-primary shadow-[0_0_10px_var(--app-success)]' : 'bg-app-primary'}`}
 style={{ width: `${pct}%` }}
 />
 </div>
 </div>

 <div className="flex items-center gap-4 shrink-0">
 <div className="text-right mr-4 hidden sm:block">
 <div className="text-lg font-black text-app-foreground">${Number(line.line_total).toLocaleString()}</div>
 <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Post-Tax Value</div>
 </div>

 {isReceivable && (
 <button
 onClick={() => setReceivingLine(line)}
 className="h-14 px-8 bg-app-primary text-app-foreground rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-app-primary/20 hover:bg-app-success hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-2"
 >
 <CheckCircle size={16} />
 Receive
 </button>
 )}

 {!isReceivable && received >= ordered && (
 <div className="h-14 px-8 bg-app-background text-app-muted-foreground rounded-2xl font-black text-xs uppercase tracking-widest border border-app-border flex items-center gap-2">
 <ShieldCheck size={16} className="text-app-primary" />
 Completed
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Sticky Footer Audit Control */}
 <div className="p-8 bg-app-surface border-t border-app-border flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-background flex items-center justify-center text-app-muted-foreground border border-app-border">
 <AlertCircle size={24} />
 </div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">Status</div>
 <div className="text-sm font-black text-app-muted-foreground mt-1 uppercase tracking-tighter">Awaiting Review</div>
 </div>
 </div>
 <div className="flex gap-4">
 <button className="h-14 w-14 rounded-2xl border-2 border-app-border flex items-center justify-center text-app-muted-foreground hover:text-app-muted-foreground hover:bg-app-background transition-all">
 <MoreHorizontal size={24} />
 </button>
 <button
 onClick={() => setSelected(null)}
 className="h-14 px-8 rounded-2xl bg-app-surface text-app-foreground font-black text-xs uppercase tracking-widest hover:bg-app-background transition-all shadow-xl shadow-app-border/20"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Modals */}
 {receivingLine && selected && (
 <ReceiveLineDialog
 po={selected}
 line={receivingLine}
 onClose={() => setReceivingLine(null)}
 onSuccess={(updatedPo) => {
 setDetail(updatedPo);
 setOrders(prev => prev.map(o => o.id === updatedPo.id ? updatedPo : o));
 }}
 />
 )}
 </div>
 )
}
