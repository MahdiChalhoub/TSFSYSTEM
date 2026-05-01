'use client';

import { useState, useEffect } from 'react';
import { getOrderPayments, processPaymentAction } from '@/app/actions/pos/payments';
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle, RefreshCw, HandCoins, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentLeg {
 id: number;
 payment_method: string;
 amount: string;
 status: 'POSTED' | 'RECONCILED' | 'WRITTEN_OFF' | 'REFUNDED';
 reference: string | null;
 write_off: string;
 write_off_reason: string | null;
 reconciled_at: string | null;
 created_at: string;
}

interface ReconciliationSummary {
 legs: PaymentLeg[];
 total_paid: string;
 total_reconciled: string;
 total_written_off: string;
 total_refunded: string;
 unreconciled: string;
 is_fully_reconciled: boolean;
}

// Maps statuses to color accents
const STATUS_COLORS: Record<string, string> = {
 POSTED: 'text-app-warning bg-app-warning-bg border-app-warning',
 RECONCILED: 'text-app-primary bg-app-primary-light border-app-success',
 WRITTEN_OFF: 'text-app-error bg-app-error-bg border-app-error',
 REFUNDED: 'text-app-primary bg-app-primary/5 border-app-primary/30',
};

const fmtAmount = (val: string | number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(Number(val));

export function PaymentReconciliationPanel({ orderId }: { orderId: string | number }) {
 const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
 const [loading, setLoading] = useState(true);
 const [actionLoading, setActionLoading] = useState<number | null>(null);

 const loadData = async () => {
 setLoading(true);
 try {
 const res = await getOrderPayments(orderId);
 if (res.success) {
 setSummary(res.data);
 }
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadData();
 }, [orderId]);

 const handleAction = async (legId: number, actionType: 'reconcile' | 'write_off' | 'refund') => {
 let payload: any = { leg_id: legId };

 if (actionType === 'reconcile') {
 const ref = prompt("Enter bank statement or mobile money reference (optional):");
 if (ref === null) return; // Cancelled
 payload.reference = ref;
 } else if (actionType === 'write_off') {
 const amt = prompt("Enter amount to write off (shortfall):");
 if (!amt || isNaN(Number(amt))) return;
 const reason = prompt("Enter reason for write-off:");
 if (reason === null) return;
 payload.amount = Number(amt);
 payload.reason = reason;
 } else if (actionType === 'refund') {
 const reason = prompt("Enter reason for refund:");
 if (reason === null) return;
 payload.reason = reason;
 }

 setActionLoading(legId);
 toast.loading(`Processing ${actionType}...`);
 try {
 const res = await processPaymentAction(orderId, actionType, payload);
 toast.dismiss();
 if (res.success) {
 toast.success(`Payment leg updated successfully.`);
 loadData();
 } else {
 toast.error(res.error || `Failed to ${actionType}`);
 }
 } catch (e: any) {
 toast.dismiss();
 toast.error(e.message || "An error occurred");
 } finally {
 setActionLoading(null);
 }
 };

 if (loading && !summary) {
 return (
 <div className="flex items-center gap-2 py-4 text-sm text-app-muted-foreground">
 <Loader2 size={14} className="animate-spin" />
 Loading reconciliation data...
 </div>
 );
 }

 if (!summary || summary.legs.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center p-6 border border-dashed border-app-border rounded-2xl bg-app-surface-2 text-center">
 <ShieldCheck size={24} className="text-app-muted-foreground mb-2" />
 <p className="text-xs font-medium text-app-muted-foreground">No payment lines found.</p>
 <p className="text-[10px] text-app-muted-foreground mt-1">This order might be unpaid or a draft.</p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Summary metrics */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
 <div className="p-3 rounded-xl border border-app-border bg-app-surface shadow-sm">
 <div className="text-[10px] uppercase font-bold text-app-muted-foreground mb-1">Total Paid</div>
 <div className="text-sm font-black text-app-foreground">{fmtAmount(summary.total_paid)}</div>
 </div>
 <div className="p-3 rounded-xl border border-app-success/30 bg-app-primary-light/50 shadow-sm">
 <div className="text-[10px] uppercase font-bold text-app-primary mb-1">Reconciled</div>
 <div className="text-sm font-black text-app-success">{fmtAmount(summary.total_reconciled)}</div>
 </div>
 <div className="p-3 rounded-xl border border-rose-100 bg-app-error-bg/50 shadow-sm">
 <div className="text-[10px] uppercase font-bold text-app-error mb-1">Written Off</div>
 <div className="text-sm font-black text-app-error">{fmtAmount(summary.total_written_off)}</div>
 </div>
 <div className="p-3 rounded-xl border border-app-warning/30 bg-app-warning-bg/50 shadow-sm">
 <div className="text-[10px] uppercase font-bold text-app-warning mb-1">Unreconciled</div>
 <div className="text-sm font-black text-app-warning">{fmtAmount(summary.unreconciled)}</div>
 </div>
 </div>

 {/* Payment Legs List */}
 <div className="space-y-2">
 {summary.legs.map((leg) => {
 const isPosted = leg.status === 'POSTED';
 const isProcessing = actionLoading === leg.id;
 return (
 <div key={leg.id} className="p-4 rounded-xl border border-app-border bg-app-surface shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div className="flex items-start gap-3">
 <div className={`px-2 py-1 text-[10px] font-black rounded uppercase border ${STATUS_COLORS[leg.status]}`}>
 {leg.status}
 </div>
 <div>
 <div className="text-sm font-black text-app-foreground flex items-center gap-2">
 {fmtAmount(leg.amount)}
 <span className="text-[10px] font-bold text-app-muted-foreground px-1.5 py-0.5 rounded-full bg-app-background">
 {leg.payment_method}
 </span>
 </div>
 <div className="text-[10px] text-app-muted-foreground mt-1 leading-relaxed">
 {leg.reference && <span>Ref: <strong className="text-app-foreground">{leg.reference}</strong> • </span>}
 <span>Posted: {new Date(leg.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
 {leg.reconciled_at && <span> • Reconciled: {new Date(leg.reconciled_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
 {leg.write_off !== '0.00' && <span className="text-app-error font-bold block mt-0.5">Written Off: {fmtAmount(leg.write_off)} ({leg.write_off_reason})</span>}
 </div>
 </div>
 </div>

 {/* Actions (Only visible if POSTED) */}
 {isPosted && (
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleAction(leg.id, 'reconcile')}
 disabled={isProcessing}
 className="px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border border-app-success bg-app-primary-light text-app-success hover:bg-app-primary-light transition-colors flex items-center gap-1.5 disabled:opacity-50"
 >
 <CheckCircle2 size={12} /> Reconcile
 </button>
 <button
 onClick={() => handleAction(leg.id, 'write_off')}
 disabled={isProcessing}
 className="px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border border-app-error bg-app-error-bg text-app-error hover:bg-app-error-bg transition-colors flex items-center gap-1.5 disabled:opacity-50"
 >
 <AlertCircle size={12} /> Write Off
 </button>
 <button
 onClick={() => handleAction(leg.id, 'refund')}
 disabled={isProcessing}
 className="px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border border-app-border bg-app-surface-2 text-app-muted-foreground hover:text-app-foreground transition-colors flex items-center gap-1.5 disabled:opacity-50"
 >
 <ArrowRightLeft size={12} /> Refund
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
}
