'use client';
import { useState, useEffect, useCallback } from 'react';
import { erpFetch } from '@/lib/erp-api';
import {
 X, Search, RefreshCw, Receipt, User, Calendar,
 ChevronRight, Loader2, Hash, AlertCircle, Printer,
 CheckCircle2, Clock, XCircle, FileText, Package,
 ArrowLeft
} from 'lucide-react';
import clsx from 'clsx';

type Order = {
 id: number;
 ref_code: string;
 invoice_number?: string;
 created_at: string;
 type: string;
 contact_name?: string;
 status: string;
 total_amount: number;
 payment_method?: string;
 items?: { name: string; quantity: number; unit_price: number }[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
 COMPLETED: { label: 'COMPLETED', color: 'text-app-primary bg-app-primary/10 border-app-primary/20', icon: CheckCircle2 },
 INVOICED: { label: 'INVOICED', color: 'text-app-info bg-app-info-bg border-app-info/20', icon: FileText },
 PENDING: { label: 'PENDING', color: 'text-app-warning bg-app-warning-bg border-app-warning/20', icon: Clock },
 CANCELLED: { label: 'CANCELLED', color: 'text-rose-400 bg-app-error/10 border-app-error/20', icon: XCircle },
 DRAFT: { label: 'DRAFT', color: 'text-app-muted-foreground bg-app-foreground/5 border-app-foreground/10', icon: FileText },
};

interface POSSalesHistoryPanelProps {
 isOpen: boolean;
 onClose: () => void;
 currency: string;
 registerName?: string;
 sessionId?: number | null;
}

export function POSSalesHistoryPanel({ isOpen, onClose, currency, registerName, sessionId }: POSSalesHistoryPanelProps) {
 const [orders, setOrders] = useState<Order[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
 const [printingId, setPrintingId] = useState<number | null>(null);
 const [tab, setTab] = useState<'session' | 'all'>(sessionId ? 'session' : 'all');

 const load = useCallback(async () => {
 setLoading(true);
 try {
 const url = (tab === 'session' && sessionId)
 ? `pos/orders/?session=${sessionId}`
 : 'pos/orders/';
 const data = await erpFetch(url);
 setOrders(Array.isArray(data) ? data : data?.results || []);
 } catch {
 // silently fail
 }
 setLoading(false);
 }, [tab, sessionId]);

 useEffect(() => {
 if (isOpen) load();
 }, [isOpen, load, tab]);

 const fmt = (n: number) => `${currency} ${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

 const filtered = orders.filter(o => {
 const q = search.toLowerCase();
 return !q || (o.ref_code || '').toLowerCase().includes(q) ||
 (o.contact_name || '').toLowerCase().includes(q) ||
 (o.invoice_number || '').toLowerCase().includes(q);
 });

 const handlePrint = async (order: Order) => {
 setPrintingId(order.id);
 try {
 const blob = await erpFetch(`pos/${order.id}/invoice-pdf/`);
 if (blob instanceof Blob) {
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `Invoice_${order.ref_code || order.id}.pdf`;
 document.body.appendChild(a);
 a.click();
 window.URL.revokeObjectURL(url);
 document.body.removeChild(a);
 }
 } catch { }
 setPrintingId(null);
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[900] flex" onClick={onClose}>
 {/* Backdrop */}
 <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

 {/* Panel - slides in from right */}
 <div
 className="ml-auto relative w-[520px] max-w-full h-full bg-[#0F172A] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-500 border-l border-app-foreground/5"
 onClick={e => e.stopPropagation()}
 >
 {/* Header */}
 <div className="flex items-center justify-between px-8 py-6 border-b border-app-foreground/10 bg-app-bg/80 backdrop-blur-xl shrink-0 z-20 relative overflow-hidden">
 {/* Glow Effect */}
 <div className="absolute top-0 right-0 w-64 h-64 bg-app-primary/5 blur-[80px] -z-10" />

 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-emerald-gradient flex items-center justify-center shadow-xl shadow-app-primary/20">
 <Receipt size={22} className="text-app-foreground fill-white/20" />
 </div>
 <div>
 <span className="text-[10px] font-black text-app-primary uppercase tracking-[0.3em] block mb-0.5">Operations Ledger</span>
 <h2 className="text-xl font-black text-app-foreground uppercase tracking-tighter">Transaction Audit</h2>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button onClick={load} disabled={loading}
 className="w-10 h-10 rounded-xl bg-app-foreground/5 hover:bg-app-foreground/10 text-app-foreground/40 hover:text-app-primary transition-all disabled:opacity-40 flex items-center justify-center border border-app-foreground/10">
 <RefreshCw size={16} className={loading ? 'animate-spin text-app-primary' : ''} />
 </button>
 <button onClick={onClose}
 className="w-10 h-10 rounded-xl bg-app-foreground/5 hover:bg-app-error/20 text-app-foreground/40 hover:text-app-error transition-all flex items-center justify-center border border-app-foreground/10">
 <X size={18} />
 </button>
 </div>
 </div>

 {/* Tabs */}
 <div className="px-8 pt-4 pb-0 border-b border-app-foreground/5 shrink-0 flex gap-4 bg-app-bg/20">
 {sessionId && (
 <button onClick={() => setTab('session')}
 className={clsx('pb-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all border-b-2',
 tab === 'session'
 ? 'border-app-primary text-app-primary'
 : 'border-transparent text-app-foreground/20 hover:text-app-foreground/40')}>
 Live Session
 </button>
 )}
 <button onClick={() => setTab('all')}
 className={clsx('pb-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all border-b-2',
 tab === 'all'
 ? 'border-app-primary text-app-primary'
 : 'border-transparent text-app-foreground/20 hover:text-app-foreground/40')}>
 Global Archival
 </button>
 </div>

 {/* Search */}
 <div className="px-8 py-5 border-b border-app-foreground/10 shrink-0 bg-app-bg/20">
 <div className="relative group">
 <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-foreground/20 group-focus-within:text-app-primary transition-colors" />
 <input
 type="text"
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="SEARCH TRANSACTION ID, CLIENT OR REFERENCE..."
 className="w-full pl-12 pr-4 py-3 text-[11px] font-black uppercase tracking-widest bg-app-foreground/5 border border-app-foreground/10 rounded-2xl outline-none focus:ring-4 focus:ring-app-primary/10 focus:border-app-primary/30 text-app-foreground placeholder:text-app-foreground/10 transition-all"
 />
 </div>
 </div>

 {/* Stats bar */}
 {!loading && orders.length > 0 && (
 <div className="px-8 py-4 border-b border-app-foreground/10 bg-app-bg/40 flex items-center justify-between shrink-0">
 <div className="flex flex-col">
 <p className="text-[10px] font-black text-app-foreground/30 uppercase tracking-[0.2em] mb-1">Audit Volume</p>
 <p className="text-xl font-black text-app-foreground">{orders.length}</p>
 </div>
 <div className="w-px h-8 bg-app-foreground/10" />
 <div className="flex flex-col text-right">
 <p className="text-[10px] font-black text-app-foreground/30 uppercase tracking-[0.2em] mb-1">Aggregate Revenue</p>
 <p className="text-xl font-black text-app-primary tabular-nums">
 {fmt(orders.reduce((s, o) => s + Number(o.total_amount || 0), 0))}
 </p>
 </div>
 </div>
 )}

 {/* Order List / Detail */}
 <div className="flex-1 overflow-y-auto custom-scrollbar">
 {loading ? (
 <div className="flex flex-col items-center justify-center h-full gap-3 text-app-muted-foreground">
 <Loader2 size={28} className="animate-spin text-indigo-300" />
 <p className="text-xs font-bold">Loading history...</p>
 </div>
 ) : selectedOrder ? (
 /* ── ORDER DETAIL VIEW ── */
 <div className="p-8 space-y-6">
 <button onClick={() => setSelectedOrder(null)}
 className="h-10 px-4 rounded-xl bg-app-foreground/5 border border-app-foreground/10 text-[10px] font-black text-app-primary uppercase tracking-widest hover:bg-app-foreground/10 transition-all flex items-center gap-2 group">
 <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
 Back to POS
 </button>

 {/* Order header */}
 <div className="bg-app-bg/60 border border-app-foreground/5 rounded-3xl p-6 space-y-5 relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-32 h-32 bg-app-primary/5 blur-3xl rounded-full" />

 <div className="flex items-start justify-between relative z-10">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <Hash size={12} className="text-app-primary/50" />
 <p className="text-2xl font-black text-app-foreground tracking-tighter uppercase">{selectedOrder.ref_code || selectedOrder.id}</p>
 </div>
 {selectedOrder.invoice_number && (
 <div className="flex items-center gap-2">
 <Receipt size={10} className="text-app-muted-foreground" />
 <p className="text-[10px] font-mono text-app-primary font-black">{selectedOrder.invoice_number}</p>
 </div>
 )}
 </div>
 {(() => {
 const cfg = STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.DRAFT;
 const Icon = cfg.icon;
 return (
 <span className={clsx("flex items-center gap-2 text-[9px] font-black px-3 py-1.5 rounded-xl border tabular-nums", cfg.color)}>
 <Icon size={12} /> {cfg.label}
 </span>
 );
 })()}
 </div>

 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-app-foreground/5 relative z-10">
 <div className="flex flex-col gap-1">
 <span className="text-[9px] font-black text-app-foreground/20 uppercase tracking-widest">Timestamp</span>
 <div className="flex items-center gap-2 text-[11px] font-bold text-app-muted-foreground">
 <Clock size={12} className="text-app-primary/40" />
 {new Date(selectedOrder.created_at).toLocaleDateString('fr-FR')} {new Date(selectedOrder.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
 </div>
 </div>
 {selectedOrder.contact_name && (
 <div className="flex flex-col gap-1">
 <span className="text-[9px] font-black text-app-foreground/20 uppercase tracking-widest">Counterparty</span>
 <div className="flex items-center gap-2 text-[11px] font-bold text-app-muted-foreground">
 <User size={12} className="text-app-primary/40" />
 {selectedOrder.contact_name}
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Items */}
 {selectedOrder.items && selectedOrder.items.length > 0 && (
 <div className="bg-app-bg/40 border border-app-foreground/5 rounded-3xl overflow-hidden p-1">
 <div className="px-5 py-3 flex items-center gap-3">
 <Package size={14} className="text-app-primary/50" />
 <span className="text-[10px] font-black text-app-foreground/40 uppercase tracking-[0.3em]">Operational manifest</span>
 </div>
 <div className="space-y-1">
 {selectedOrder.items.map((item, i) => (
 <div key={i} className="flex items-center justify-between px-5 py-3 bg-app-surface/[0.02] border border-app-foreground/5 rounded-2xl mx-1 mb-1 group hover:bg-app-surface/[0.05] transition-colors">
 <div className="flex-1 min-w-0">
 <p className="text-[11px] font-black text-app-foreground uppercase italic tracking-tight truncate">{item.name}</p>
 <p className="text-[9px] text-app-muted-foreground font-bold uppercase tracking-wider">{item.quantity} UNIT × {fmt(item.unit_price)}</p>
 </div>
 <p className="text-xs font-black text-app-primary ml-4 tabular-nums">{fmt(item.quantity * item.unit_price)}</p>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Total + Print */}
 <div className="bg-app-bg/80 border border-app-primary/20 rounded-[2.5rem] p-8 flex items-center justify-between shadow-2xl relative overflow-hidden group">
 <div className="absolute inset-0 bg-app-primary/5 group-hover:bg-app-primary/10 transition-colors" />
 <div className="relative z-10">
 <p className="text-[10px] font-black text-app-primary/60 uppercase tracking-[0.4em] mb-1">Total Settlement</p>
 <p className="text-4xl font-black text-app-foreground tracking-tighter tabular-nums">{fmt(selectedOrder.total_amount)}</p>
 </div>
 <button
 onClick={() => handlePrint(selectedOrder)}
 disabled={printingId === selectedOrder.id}
 className="relative z-10 flex flex-col items-center justify-center w-20 h-20 rounded-[2rem] bg-emerald-gradient text-app-foreground shadow-xl shadow-app-primary/20 hover:scale-110 active:scale-95 transition-all border border-app-success/30 group/btn"
 >
 {printingId === selectedOrder.id
 ? <Loader2 size={24} className="animate-spin" />
 : <Printer size={24} />
 }
 <span className="text-[8px] font-black mt-1 uppercase tracking-widest">RE-PRINT</span>
 </button>
 </div>
 </div>
 ) : filtered.length === 0 ? (
 /* ── EMPTY STATE ── */
 <div className="flex flex-col items-center justify-center h-full gap-3 text-app-muted-foreground">
 <Receipt size={36} strokeWidth={1} />
 <p className="text-xs font-bold text-app-muted-foreground">
 {search ? 'No orders match your search' : 'No orders yet this session'}
 </p>
 </div>
 ) : (
 /* ── LIST VIEW ── */
 <div className="divide-y divide-white/[0.03]">
 {filtered.map(order => {
 const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.DRAFT;
 const StatusIcon = cfg.icon;
 return (
 <button
 key={order.id}
 onClick={() => setSelectedOrder(order)}
 className="w-full flex items-center gap-5 px-8 py-5 hover:bg-app-surface/[0.02] transition-all text-left group relative overflow-hidden"
 >
 <div className="absolute inset-y-0 left-0 w-1 bg-app-primary opacity-0 group-hover:opacity-100 transition-opacity" />

 {/* Status Icon */}
 <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all group-hover:scale-110", cfg.color)}>
 <StatusIcon size={20} />
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-1">
 <p className="text-[13px] font-black text-app-foreground tracking-tight uppercase italic">{order.ref_code || order.id}</p>
 {order.invoice_number && (
 <span className="text-[9px] font-mono font-black text-app-primary bg-app-primary/10 px-2 py-0.5 rounded-lg border border-app-primary/20">
 {order.invoice_number}
 </span>
 )}
 </div>
 <div className="flex items-center gap-3">
 {order.contact_name && (
 <span className="text-[10px] text-app-muted-foreground font-bold truncate uppercase tracking-wider">
 {order.contact_name}
 </span>
 )}
 <span className="text-[9px] text-app-muted-foreground font-bold tabular-nums">
 {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 </div>

 {/* Amount */}
 <div className="text-right shrink-0">
 <p className="text-lg font-black text-app-foreground tracking-tighter tabular-nums">{fmt(order.total_amount).split(' ')[1]}</p>
 <p className={clsx("text-[9px] font-black uppercase tracking-[0.2em]", cfg.color.split(' ')[0])}>{cfg.label}</p>
 </div>
 </button>
 );
 })}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
