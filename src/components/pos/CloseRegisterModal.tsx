'use client';

import { useState, useRef } from 'react';
import { Loader2, X, CheckCircle2, AlertTriangle, Printer, ArrowRight, DollarSign, BarChart3, Clock, Hash, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

interface PaymentMethodBreakdown {
 method: string;
 label: string;
 total: number;
 count: number;
}

interface ClosingReport {
 registerName: string;
 siteName: string;
 cashierName: string;
 openedAt: string;
 closedAt: string;
 duration: string;
 openingBalance: number;
 closingBalance: number;
 expectedBalance: number;
 difference: number;
 totalSales: number;
 totalTransactions: number;
 totalCashIn: number;
 paymentBreakdown: PaymentMethodBreakdown[];
}

interface CloseRegisterModalProps {
 sessionId: number;
 registerName: string;
 cashierName: string;
 openingBalance: number;
 currency: string;
 onClose: () => void; // called when session successfully closed (returns to lobby)
 onCancel: () => void; // cancel — stay in POS
}

const fmt = (val: number, cur: string) =>
 `${cur} ${val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDate = (iso: string) => {
 try {
 return new Date(iso).toLocaleString('fr-FR', {
 day: '2-digit', month: 'short', year: 'numeric',
 hour: '2-digit', minute: '2-digit',
 });
 } catch { return iso; }
};

export default function CloseRegisterModal({
 sessionId, registerName, cashierName, openingBalance, currency, onClose, onCancel
}: CloseRegisterModalProps) {
 const [step, setStep] = useState<'form' | 'report'>('form');
 const [cashCounted, setCashCounted] = useState('');
 const [notes, setNotes] = useState('');
 const [loading, setLoading] = useState(false);
 const [report, setReport] = useState<ClosingReport | null>(null);
 const printRef = useRef<HTMLDivElement>(null);

 const handleClose = async () => {
 const closing = parseFloat(cashCounted);
 if (isNaN(closing)) { toast.error('Enter the cash counted'); return; }
 setLoading(true);
 try {
 const { closeRegisterSession } = await import('@/app/(privileged)/sales/register-actions');
 const result = await closeRegisterSession(sessionId, closing, notes);
 if (result.success && result.data?.report) {
 setReport(result.data.report);
 setStep('report');
 toast.success(result.data.message || 'Register closed');
 } else {
 toast.error(result.error || 'Failed to close session');
 }
 } catch { toast.error('Connection error'); }
 setLoading(false);
 };

 const handlePrint = () => {
 const content = printRef.current;
 if (!content) return;
 const w = window.open('', '_blank', 'width=420,height=700');
 if (!w) return;
 w.document.write(`
 <html><head><title>Shift Report — ${report?.registerName}</title>
 <style>
 * { margin:0; padding:0; box-sizing:border-box; font-family: 'Courier New', monospace; }
 body { padding: 20px; font-size: 12px; color: #111; }
 h1 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
 .center { text-align: center; }
 .divider { border-top: 1px dashed #888; margin: 8px 0; }
 .row { display: flex; justify-content: space-between; margin: 3px 0; }
 .row.bold { font-weight: 900; }
 .row.total { font-size: 14px; font-weight: 900; border-top: 2px solid #111; margin-top: 6px; padding-top: 6px; }
 .diff-pos { color: #16a34a; }
 .diff-neg { color: #dc2626; }
 .label { color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; margin-top: 8px; }
 </style></head><body>${content.innerHTML}</body></html>
 `);
 w.document.close();
 w.print();
 };

 return (
 <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && step === 'form' && onCancel()}>
 <div className="w-full max-w-lg bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

 {/* Header */}
 <div className="bg-gradient-to-r from-rose-600/20 to-orange-600/10 px-6 py-5 border-b border-white/5 flex items-center justify-between">
 <div>
 <h2 className="text-white font-black text-lg tracking-tight">
 {step === 'form' ? 'Close Register' : 'Shift Closed ✓'}
 </h2>
 <p className="text-white/40 text-xs font-medium mt-0.5">
 {registerName} · {cashierName}
 </p>
 </div>
 {step === 'form' && (
 <button onClick={onCancel} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition-all">
 <X size={16} />
 </button>
 )}
 </div>

 {step === 'form' && (
 <div className="p-6 space-y-5">
 {/* Opening balance info */}
 <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3 text-sm">
 <DollarSign size={16} className="text-white/30" />
 <span className="text-white/50">Opening balance</span>
 <span className="ml-auto font-bold text-white">{fmt(openingBalance, currency)}</span>
 </div>

 {/* Cash counted */}
 <div>
 <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-2">Cash in Drawer (Counted)</label>
 <input
 type="number"
 value={cashCounted}
 onChange={e => setCashCounted(e.target.value)}
 placeholder="0"
 className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white text-2xl font-black outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/30 text-center transition-all"
 autoFocus
 />
 </div>

 {/* Notes */}
 <div>
 <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-2">Closing Notes (optional)</label>
 <textarea
 value={notes}
 onChange={e => setNotes(e.target.value)}
 rows={2}
 placeholder="Any notes about this shift..."
 className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white/80 text-sm outline-none focus:ring-2 focus:ring-rose-500/40 resize-none"
 />
 </div>

 {/* Action buttons */}
 <div className="flex items-center gap-3 pt-2">
 <button onClick={onCancel} className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 font-bold text-sm transition-all">
 Cancel
 </button>
 <button
 onClick={handleClose}
 disabled={loading || cashCounted === ''}
 className="flex-1 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
 >
 {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
 {loading ? 'Closing…' : 'Close Register'}
 </button>
 </div>
 </div>
 )}

 {step === 'report' && report && (
 <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
 {/* Printable area */}
 <div ref={printRef} id="shift-report">
 <div className="center" style={{ textAlign: 'center', marginBottom: 12 }}>
 <div className="text-white font-black text-xl">{report.registerName}</div>
 <div className="text-white/40 text-xs">{report.siteName} · Shift Report</div>
 </div>

 <div className="divider" style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '12px 0' }} />

 {/* Session info */}
 <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/50 mb-4">
 <div><span className="text-white/30">Cashier</span><div className="text-white/70 font-bold">{report.cashierName}</div></div>
 <div><span className="text-white/30">Duration</span><div className="text-white/70 font-bold">{report.duration}</div></div>
 <div><span className="text-white/30">Opened</span><div className="text-white/70 font-bold">{fmtDate(report.openedAt)}</div></div>
 <div><span className="text-white/30">Closed</span><div className="text-white/70 font-bold">{fmtDate(report.closedAt)}</div></div>
 </div>

 <div className="divider" style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '10px 0' }} />

 {/* Payment breakdown */}
 <div className="label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
 Payment Breakdown
 </div>
 <div className="space-y-1">
 {report.paymentBreakdown.length === 0 ? (
 <div className="text-white/20 text-xs text-center py-2">No sales recorded</div>
 ) : report.paymentBreakdown.map(b => (
 <div key={b.method} className="flex items-center justify-between py-1.5">
 <div>
 <span className="text-white/80 text-sm font-bold">{b.label}</span>
 <span className="text-white/30 text-xs ml-2">×{b.count}</span>
 </div>
 <span className="font-black text-white text-sm">{fmt(b.total, currency)}</span>
 </div>
 ))}
 </div>
 <div className="flex items-center justify-between py-2 border-t border-white/10 mt-2">
 <span className="text-white font-black text-sm">TOTAL SALES</span>
 <span className="font-black text-emerald-400 text-base">{fmt(report.totalSales, currency)}</span>
 </div>
 <div className="text-white/30 text-xs text-right">{report.totalTransactions} transaction{report.totalTransactions !== 1 ? 's' : ''}</div>

 <div className="divider" style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '12px 0' }} />

 {/* Cash reconciliation */}
 <div className="label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
 Cash Reconciliation
 </div>
 <div className="space-y-1 text-sm">
 <div className="flex justify-between text-white/50"><span>Opening balance</span><span className="font-bold text-white/70">{fmt(report.openingBalance, currency)}</span></div>
 <div className="flex justify-between text-white/50"><span>+ Cash sales</span><span className="font-bold text-white/70">{fmt(report.totalCashIn, currency)}</span></div>
 <div className="flex justify-between text-white/50"><span>Expected in drawer</span><span className="font-bold text-white/80">{fmt(report.expectedBalance, currency)}</span></div>
 <div className="flex justify-between text-white/50"><span>Counted in drawer</span><span className="font-bold text-white">{fmt(report.closingBalance, currency)}</span></div>
 <div className={clsx(
 "flex justify-between font-black text-sm border-t border-white/10 pt-2 mt-1",
 Math.abs(report.difference) < 0.01 ? "text-emerald-400" :
 report.difference > 0 ? "text-blue-400" : "text-rose-400"
 )}>
 <span>{Math.abs(report.difference) < 0.01 ? "✓ Balanced" : report.difference > 0 ? "▲ Surplus" : "▼ Shortage"}</span>
 <span>{report.difference > 0 ? '+' : ''}{fmt(report.difference, currency)}</span>
 </div>
 </div>

 {notes && (
 <>
 <div className="divider" style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '12px 0' }} />
 <div className="text-white/30 text-xs">{notes}</div>
 </>
 )}
 </div>

 {/* Actions */}
 <div className="flex gap-3 pt-2 border-t border-white/5">
 <button
 onClick={handlePrint}
 className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 font-bold text-sm transition-all flex items-center justify-center gap-2"
 >
 <Printer size={16} /> Print Report
 </button>
 <button
 onClick={onClose}
 className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm transition-all flex items-center justify-center gap-2"
 >
 <ArrowRight size={16} /> Back to Lobby
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
