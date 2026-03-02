'use client';
import { useState, useEffect, useCallback } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import { X, Truck, CheckCircle, DollarSign, AlertCircle, RefreshCw, Hash, ExternalLink, Copy, KeyRound } from 'lucide-react';
import clsx from 'clsx';

interface PendingDelivery {
 id: number;
 recipient_name: string | null;
 phone: string | null;
 address_line1: string | null;
 amount_due: string;
 amount_collected: string;
 payment_mode: 'IMMEDIATE' | 'HOLD' | 'CREDIT';
 payment_status: 'PENDING' | 'PAID' | 'CREDITED' | 'CANCELLED';
 confirmed_by_driver: boolean;
 confirmed_by_pos: boolean;
 status: string;
 zone?: { name: string } | null;
 driver?: { full_name?: string; username?: string } | null;
 order?: { id: number } | null;
 // Code 1: Register ↔ Driver
 require_pos_return_code: boolean;
 pos_return_code: string | null;
 // Code 2: Driver ↔ Client
 require_client_delivery_code: boolean;
 client_delivery_code: string | null;
 // URL
 tracking_code: string | null;
}

interface Props {
 sessionId: number;
 onClose: () => void;
 currency?: string;
}

export function POSPendingDeliveriesPanel({ sessionId, onClose, currency = '$' }: Props) {
 const [deliveries, setDeliveries] = useState<PendingDelivery[]>([]);
 const [loading, setLoading] = useState(true);
 const [confirming, setConfirming] = useState<number | null>(null);
 // Per-delivery return code input (cashier types driver's code)
 const [returnCodes, setReturnCodes] = useState<Record<number, string>>({});

 const load = useCallback(async () => {
 try {
 const data = await erpFetch(`pos/deliveries/pending_holds/?session=${sessionId}`);
 setDeliveries(Array.isArray(data) ? data : data?.results ?? []);
 } catch {
 // silent
 } finally {
 setLoading(false);
 }
 }, [sessionId]);

 useEffect(() => {
 load();
 const interval = setInterval(load, 30_000);
 return () => clearInterval(interval);
 }, [load]);

 const handleDriverPaid = async (id: number, amountDue: number) => {
 setConfirming(id);
 try {
 await erpFetch(`pos/deliveries/${id}/driver_paid/`, {
 method: 'POST',
 body: JSON.stringify({ amount_collected: amountDue }),
 });
 toast.success('Driver payment recorded');
 load();
 } catch {
 toast.error('Failed to record driver payment');
 } finally {
 setConfirming(null);
 }
 };

 const handlePosConfirm = async (delivery: PendingDelivery) => {
 setConfirming(delivery.id);
 try {
 const body: any = {};
 if (delivery.require_pos_return_code) {
 body.code = returnCodes[delivery.id] || '';
 }
 await erpFetch(`pos/deliveries/${delivery.id}/pos_confirm/`, {
 method: 'POST',
 body: JSON.stringify(body),
 });
 toast.success('Cash received — delivery cleared ✅', { duration: 3000 });
 load();
 } catch (e: any) {
 toast.error(e?.message || 'Confirmation failed');
 } finally {
 setConfirming(null);
 }
 };

 return (
 <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
 <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

 <div className="relative w-full max-w-lg bg-app-surface rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
 {/* Header */}
 <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
 <Truck size={16} />
 </div>
 <div>
 <h2 className="text-sm font-black tracking-tight">Pending Deliveries</h2>
 <p className="text-[11px] text-amber-100">Cash-on-delivery orders awaiting return</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button onClick={load} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
 <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
 </button>
 <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
 <X size={12} />
 </button>
 </div>
 </div>

 {/* Body */}
 <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100">
 {loading ? (
 <div className="flex items-center justify-center py-12 text-app-text-faint">
 <RefreshCw className="animate-spin mr-2" size={16} />
 <span className="text-sm">Loading...</span>
 </div>
 ) : deliveries.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
 <CheckCircle className="text-emerald-500" size={24} />
 </div>
 <p className="text-sm font-bold text-gray-700">All clear!</p>
 <p className="text-xs text-app-text-faint mt-0.5">No pending deliveries for this session</p>
 </div>
 ) : (
 deliveries.map(d => {
 const amountDue = parseFloat(d.amount_due || '0');
 const isConfirming = confirming === d.id;
 const needsReturnCode = d.require_pos_return_code && !d.confirmed_by_pos;

 return (
 <div key={d.id} className="p-4 hover:bg-app-bg transition-colors">
 <div className="flex items-start justify-between gap-3">
 {/* Left info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-[10px] font-black text-app-text-faint uppercase tracking-widest">
 #{d.order?.id ?? d.id}
 </span>
 <span className={clsx(
 'text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest',
 d.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-600' :
 d.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-600' :
 'bg-amber-100 text-amber-600'
 )}>
 {d.status}
 </span>
 </div>
 <p className="text-sm font-bold text-app-text truncate">
 {d.recipient_name || 'Unknown Recipient'}
 </p>
 {d.phone && <p className="text-xs text-app-text-faint">{d.phone}</p>}
 {d.address_line1 && (
 <p className="text-xs text-app-text-faint truncate">
 {d.address_line1}{d.zone ? ` — ${d.zone.name}` : ''}
 </p>
 )}
 {d.driver && (
 <p className="text-xs text-indigo-500 mt-0.5">
 🚴 {d.driver.full_name || d.driver.username}
 </p>
 )}

 {/*
 * Code A: client_delivery_code
 * Generated at order creation → shown on client receipt
 * Driver enters it on mobile to prove delivery happened
 */}
 {d.require_client_delivery_code && d.client_delivery_code && (
 <div className="mt-2 flex items-center gap-2">
 <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1">
 <Hash size={10} className="text-orange-500" />
 <span className="text-base font-black text-orange-600 tracking-widest">
 {d.client_delivery_code}
 </span>
 </div>
 <div className="flex-1 min-w-0">
 <span className="text-[10px] text-app-text-muted font-medium">
 Client receipt code
 </span>
 </div>
 <button
 onClick={() => navigator.clipboard?.writeText(d.client_delivery_code!)}
 className="w-5 h-5 flex items-center justify-center text-app-text-faint hover:text-orange-500 transition-all"
 title="Copy"
 >
 <Copy size={10} />
 </button>
 </div>
 )}

 {/* Driver tracking link */}
 {d.tracking_code && (
 <a
 href={`/delivery/${d.id}?token=${d.tracking_code}`}
 target="_blank"
 rel="noopener noreferrer"
 className="mt-1 flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-600 transition-all"
 >
 <ExternalLink size={9} />
 Driver link
 </a>
 )}
 </div>

 {/* Right: Amount */}
 <div className="text-right shrink-0">
 <p className="text-base font-black text-app-text">
 {currency}{amountDue.toFixed(2)}
 </p>
 <p className="text-[10px] text-app-text-faint">due</p>
 </div>
 </div>

 {/* Cash Return Flow */}
 <div className="mt-3 space-y-2">
 {!d.confirmed_by_driver ? (
 <button
 disabled={isConfirming}
 onClick={() => handleDriverPaid(d.id, amountDue)}
 className="w-full py-2 px-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-all text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
 >
 <Truck size={12} />
 Driver Returned Cash
 </button>
 ) : !d.confirmed_by_pos ? (
 <div className="space-y-2">
 <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
 <CheckCircle size={12} />
 Driver confirmed payment
 </div>
 {/*
 * Code B: pos_return_code
 * Shown on driver's mobile page
 * Cashier asks driver for this code and enters it here
 * Protects driver: cashier cannot assign cash without driver's code
 */}
 {needsReturnCode && (
 <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
 <KeyRound size={12} className="text-indigo-500 shrink-0" />
 <input
 type="number"
 inputMode="numeric"
 maxLength={6}
 placeholder="Driver's code"
 value={returnCodes[d.id] || ''}
 onChange={e => setReturnCodes(prev => ({
 ...prev,
 [d.id]: e.target.value.slice(0, 6)
 }))}
 className="flex-1 bg-transparent text-sm font-black tracking-widest text-indigo-700 placeholder:text-indigo-300 focus:outline-none"
 />
 </div>
 )}
 <button
 disabled={isConfirming || (needsReturnCode && (returnCodes[d.id] || '').length < 4)}
 onClick={() => handlePosConfirm(d)}
 className="w-full py-2 px-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md shadow-emerald-200"
 >
 <DollarSign size={12} />
 I Received the Cash ✓
 </button>
 </div>
 ) : (
 <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-bold">
 <CheckCircle size={14} />
 Fully resolved
 </div>
 )}
 </div>
 </div>
 );
 })
 )}
 </div>

 {/* Footer warning */}
 {deliveries.length > 0 && (
 <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
 <AlertCircle size={12} className="text-amber-500 shrink-0" />
 <p className="text-[11px] text-amber-700 font-medium">
 The register cannot be closed while deliveries are pending cash return.
 </p>
 </div>
 )}
 </div>
 </div>
 );
}
