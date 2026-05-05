// @ts-nocheck
'use client';

import { useState, useRef } from 'react';
import { Search, X, Loader2, RotateCcw, CheckCircle2, Package, AlertTriangle, ArrowLeft, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';
import clsx from 'clsx';

interface OrderLine {
 productId: number;
 productName: string;
 quantity: number;
 unitPrice: number;
 totalPrice: number;
}

interface FoundOrder {
 id: number;
 ref: string;
 date: string;
 cashierName: string;
 totalAmount: number;
 paymentMethod: string;
 lines: OrderLine[];
}

interface ReturnItem {
 productId: number;
 productName: string;
 unitPrice: number;
 maxQty: number;
 returnQty: number;
 selected: boolean;
}

interface ReturnOrderModalProps {
 currency: string;
 onClose: () => void;
}

const fmt = (val: number, cur: string) =>
 `${cur} ${val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDate = (iso: string) => {
 try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
 catch { return iso; }
};

export default function ReturnOrderModal({ currency, onClose }: ReturnOrderModalProps) {
 const [step, setStep] = useState<'search' | 'items' | 'confirm' | 'done'>('search');
 const [refInput, setRefInput] = useState('');
 const [searching, setSearching] = useState(false);
 const [foundOrder, setFoundOrder] = useState<FoundOrder | null>(null);
 const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
 const [reason, setReason] = useState('');
 const [processing, setProcessing] = useState(false);
 const [result, setResult] = useState<{
  return_ref: string; total_returned: number;
  fne_status?: string; fne_reference?: string; fne_token?: string;
 } | null>(null);

 const handleSearch = async () => {
 if (!refInput.trim()) return;
 setSearching(true);
 try {
 const data = await erpFetch(`pos-registers/lookup-order/?ref=${encodeURIComponent(refInput.trim())}`);
 if (data?.id) {
 setFoundOrder(data);
 setReturnItems(data.lines.map((l: OrderLine) => ({
 productId: l.productId,
 productName: l.productName,
 unitPrice: l.unitPrice,
 maxQty: l.quantity,
 returnQty: l.quantity,
 selected: true,
 })));
 setStep('items');
 } else {
 toast.error(data?.error || 'Order not found');
 }
 } catch { toast.error('Search failed'); }
 setSearching(false);
 };

 const totalReturn = returnItems
 .filter(i => i.selected)
 .reduce((sum, i) => sum + i.returnQty * i.unitPrice, 0);

 const handleProcess = async () => {
 const items = returnItems
 .filter(i => i.selected && i.returnQty > 0)
 .map(i => ({ product_id: i.productId, quantity: i.returnQty, unit_price: i.unitPrice }));
 if (!items.length) { toast.error('Select at least one item to return'); return; }
 setProcessing(true);
 try {
 const res = await erpFetch('pos-registers/process-return/', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ order_ref: foundOrder!.ref, items, reason }),
 });
 if (res?.return_ref) {
 setResult({
	 return_ref: res.return_ref, total_returned: res.total_returned,
	 fne_status: res.fne_status, fne_reference: res.fne_reference, fne_token: res.fne_token,
	});
 setStep('done');
 const fneInfo = res.fne_status === 'CERTIFIED' ? ` — FNE: ${res.fne_reference}` : '';
	toast.success(`Return ${res.return_ref} processed${fneInfo}`);
 } else {
 toast.error(res?.error || 'Return failed');
 }
 } catch { toast.error('Return failed'); }
 setProcessing(false);
 };

 const handlePrint = () => {
 if (!result || !foundOrder) return;
 const w = window.open('', '_blank', 'width=380,height=500');
 if (!w) return;
 const itemRows = returnItems.filter(i => i.selected && i.returnQty > 0)
 .map(i => `<div class="row"><span>${i.productName} ×${i.returnQty}</span><span>${fmt(i.returnQty * i.unitPrice, currency)}</span></div>`).join('');
 w.document.write(`<html><head><title>Return ${result.return_ref}</title>
 <style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Courier New',mono;font-size:12px}body{padding:20px;color:#111}
 h1{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px}
 .center{text-align:center}.divider{border-top:1px dashed #888;margin:8px 0}
 .row{display:flex;justify-content:space-between;margin:3px 0}.bold{font-weight:900}
 .total{font-size:14px;font-weight:900;border-top:2px solid #111;margin-top:6px;padding-top:6px;display:flex;justify-content:space-between}</style></head>
 <body><div class="center"><h1>RETURN RECEIPT</h1><p>${result.return_ref}</p></div>
 <div class="divider"></div>
 <div class="row"><span>Original</span><span>${foundOrder.ref}</span></div>
 <div class="row"><span>Date</span><span>${new Date().toLocaleDateString()}</span></div>
 ${reason ? `<div class="row"><span>Reason</span><span>${reason}</span></div>` : ''}
 ${result.fne_status === 'CERTIFIED' ? `<div class="row"><span>FNE Avoir</span><span>${result.fne_reference || ''}</span></div>` : ''}
 <div class="divider"></div>
 ${itemRows}
 <div class="total"><span>TOTAL RETURNED</span><span>${fmt(result.total_returned, currency)}</span></div>
 ${result.fne_token ? `<div class="center" style="margin-top:12px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120\&data=${encodeURIComponent(result.fne_token)}" width="120" height="120" /><p style="font-size:9px;margin-top:4px">FNE Verified</p></div>` : ''}
 </body></html>`);
 w.document.close(); w.print();
 };

 return (
 <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && step !== 'processing' && onClose()}>
 <div className="w-full max-w-lg bg-app-surface rounded-3xl border border-app-foreground/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

 {/* Header */}
 <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/10 px-6 py-5 border-b border-app-foreground/5 flex items-center gap-3">
 {step === 'items' && (
 <button onClick={() => setStep('search')} className="w-8 h-8 rounded-xl bg-app-foreground/5 flex items-center justify-center text-app-foreground/40 hover:text-app-foreground">
 <ArrowLeft size={14} />
 </button>
 )}
 <div className="flex-1">
 <h2 className="text-app-foreground font-black text-lg">Return / Refund</h2>
 <p className="text-app-foreground/40 text-xs mt-0.5">
 {step === 'search' ? 'Enter the invoice number' :
 step === 'items' ? `Order ${foundOrder?.ref} — Select items to return` :
 step === 'done' ? 'Return processed ✓' : ''}
 </p>
 </div>
 {step !== 'processing' && (
 <button onClick={onClose} className="w-9 h-9 rounded-xl bg-app-foreground/5 hover:bg-app-foreground/10 text-app-foreground/40 hover:text-app-foreground flex items-center justify-center">
 <X size={16} />
 </button>
 )}
 </div>

 {/* Step: Search */}
 {step === 'search' && (
 <div className="p-6 space-y-4">
 <div>
 <label className="block text-xs font-black text-app-foreground/40 uppercase tracking-widest mb-2">Invoice Number</label>
 <div className="flex gap-2">
 <input
 autoFocus
 type="text"
 value={refInput}
 onChange={e => setRefInput(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleSearch()}
 placeholder="e.g. INV-00042"
 className="flex-1 px-4 py-3 bg-app-foreground/5 border border-app-foreground/10 rounded-2xl text-app-foreground font-bold outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-app-warning/30"
 />
 <button onClick={handleSearch} disabled={searching || !refInput.trim()} className="px-5 py-3 rounded-2xl bg-app-warning hover:bg-app-warning text-app-foreground font-black text-sm transition-all disabled:opacity-40 flex items-center gap-2">
 {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
 Find
 </button>
 </div>
 </div>
 <p className="text-app-foreground/20 text-xs text-center">Search by invoice number printed on the original receipt</p>
 </div>
 )}

 {/* Step: Select items */}
 {step === 'items' && foundOrder && (
 <div className="p-6 space-y-4">
 {/* Order info */}
 <div className="grid grid-cols-3 gap-2 text-xs">
 <div className="bg-app-foreground/5 rounded-xl p-3">
 <div className="text-app-foreground/30 mb-1">Date</div>
 <div className="text-app-foreground font-bold">{fmtDate(foundOrder.date)}</div>
 </div>
 <div className="bg-app-foreground/5 rounded-xl p-3">
 <div className="text-app-foreground/30 mb-1">Cashier</div>
 <div className="text-app-foreground font-bold">{foundOrder.cashierName || '—'}</div>
 </div>
 <div className="bg-app-foreground/5 rounded-xl p-3">
 <div className="text-app-foreground/30 mb-1">Total</div>
 <div className="text-app-foreground font-bold">{fmt(foundOrder.totalAmount, currency)}</div>
 </div>
 </div>

 {/* Items */}
 <div className="space-y-2 max-h-52 overflow-y-auto">
 {returnItems.map((item, idx) => (
 <div key={item.productId} className={clsx("flex items-center gap-3 p-3 rounded-2xl border transition-all", item.selected ? "bg-app-warning-bg border-app-warning/30" : "bg-app-foreground/3 border-app-foreground/5")}>
 <button onClick={() => setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it))}
 className={clsx("w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all", item.selected ? "bg-app-warning border-app-warning" : "border-app-foreground/20")}>
 {item.selected && <CheckCircle2 size={12} className="text-app-foreground" />}
 </button>
 <div className="flex-1 min-w-0">
 <p className="text-app-foreground text-sm font-bold truncate">{item.productName}</p>
 <p className="text-app-foreground/40 text-xs">{fmt(item.unitPrice, currency)} / unit</p>
 </div>
 <div className="flex items-center gap-1">
 <button onClick={() => setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, returnQty: Math.max(1, it.returnQty - 1) } : it))} className="w-6 h-6 rounded-lg bg-app-foreground/10 text-app-foreground/60 flex items-center justify-center text-xs hover:bg-app-foreground/20">−</button>
 <span className="w-8 text-center text-sm font-black text-app-foreground">{item.returnQty}</span>
 <button onClick={() => setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, returnQty: Math.min(it.maxQty, it.returnQty + 1) } : it))} className="w-6 h-6 rounded-lg bg-app-foreground/10 text-app-foreground/60 flex items-center justify-center text-xs hover:bg-app-foreground/20">+</button>
 <span className="text-app-foreground/30 text-xs ml-1">/{item.maxQty}</span>
 </div>
 </div>
 ))}
 </div>

 {/* Reason */}
 <div>
 <label className="block text-xs font-black text-app-foreground/40 uppercase tracking-widest mb-2">Reason (optional)</label>
 <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Defective, size mismatch, etc." className="w-full px-4 py-2.5 bg-app-foreground/5 border border-app-foreground/10 rounded-2xl text-app-foreground/80 text-sm outline-none focus:ring-2 focus:ring-amber-500/40" />
 </div>

 {/* Total + confirm */}
 <div className="flex items-center justify-between pt-2 border-t border-app-foreground/5">
 <div>
 <div className="text-app-foreground/30 text-xs">Total to refund</div>
 <div className="text-app-warning font-black text-xl">{fmt(totalReturn, currency)}</div>
 </div>
 <button onClick={handleProcess} disabled={processing || totalReturn === 0} className="px-6 py-3 rounded-2xl bg-app-warning hover:bg-app-warning text-app-foreground font-black text-sm transition-all disabled:opacity-40 flex items-center gap-2">
 {processing ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
 {processing ? 'Processing…' : 'Process Return'}
 </button>
 </div>
 </div>
 )}

 {/* Step: Done */}
 {step === 'done' && result && (
 <div className="p-6 text-center space-y-6">
 <div className="w-16 h-16 rounded-2xl bg-app-primary/20 flex items-center justify-center mx-auto">
 <CheckCircle2 size={32} className="text-app-primary" />
 </div>
 <div>
 <div className="text-app-foreground font-black text-2xl">{fmt(result.total_returned, currency)}</div>
 <div className="text-app-foreground/50 text-sm mt-1">Return processed — {result.return_ref}</div>
 </div>

	{/* FNE Credit Note Badge + QR */}
	{result.fne_status === 'CERTIFIED' && (
	<div className="bg-app-success/10 border border-app-success/20 rounded-2xl p-4 space-y-3">
	<div className="flex items-center justify-center gap-2">
	<span className="text-[10px] font-black uppercase tracking-widest bg-app-success/20 text-emerald-400 px-2.5 py-1 rounded-lg">FNE Avoir Certifié ✓</span>
	</div>
	<div className="text-emerald-300 text-xs font-mono font-bold">{result.fne_reference}</div>
	{result.fne_token && (
	<img
	src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(result.fne_token)}`}
	alt="FNE Credit Note QR"
	className="w-[100px] h-[100px] mx-auto rounded-lg bg-white p-1"
	/>
	)}
	</div>
	)}
	{result.fne_status === 'FAILED' && (
	<div className="bg-app-error/10 border border-app-error/20 rounded-2xl px-4 py-3">
	<div className="flex items-center justify-center gap-2">
	<AlertTriangle size={14} className="text-red-400" />
	<span className="text-red-400 text-xs font-bold">FNE Avoir — Certification échouée</span>
	</div>
	</div>
	)}

 <div className="flex gap-3">
 <button onClick={handlePrint} className="flex-1 py-3 rounded-2xl bg-app-foreground/5 hover:bg-app-foreground/10 text-app-foreground/70 font-bold text-sm flex items-center justify-center gap-2">
 <Printer size={16} /> Print
 </button>
 <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-app-primary hover:bg-app-primary text-app-foreground font-black text-sm">
 Done
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
