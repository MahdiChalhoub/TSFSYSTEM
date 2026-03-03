// @ts-nocheck
'use client';

import { useState } from 'react';
import { Package, Truck, CheckCircle, X, AlertTriangle, FileText, HardHat } from 'lucide-react';
import { receivePOLine } from '@/app/actions/inventory/locations';
import { toast } from 'sonner';

interface ReceiveLineDialogProps {
    po: any;
    line: any;
    onClose: () => void;
    onSuccess: (updatedPo: any) => void;
}

function DiscrepancyInput({ label, value, onChange, color = 'amber', icon: Icon = AlertTriangle }) {
    return (
        <div>
            <label className="text-[10px] font-black uppercase tracking-widest ml-1 mb-1.5 block flex items-center gap-1.5" style={{ color: `var(--tw-${color}-600, #d97706)` }}>
                <Icon size={10} /> {label}
            </label>
            <div className="relative flex items-center">
                <input
                    type="number"
                    min={0}
                    step="1"
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className={`w-full px-4 h-12 bg-app-background rounded-xl border-2 border-transparent focus:border-app-warning/30 outline-none transition-all font-black text-lg text-app-foreground`}
                    placeholder="0"
                />
            </div>
        </div>
    );
}

export default function ReceiveLineDialog({ po, line, onClose, onSuccess }: ReceiveLineDialogProps) {
    const maxReceivable = Number(line.quantity) - Number(line.qty_received || 0);

    const [qty, setQty] = useState<number>(maxReceivable);
    const [qtyDamaged, setQtyDamaged] = useState<number>(0);
    const [qtyMissing, setQtyMissing] = useState<number>(0);
    const [qtyRejected, setQtyRejected] = useState<number>(0);
    const [receiptNotes, setReceiptNotes] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const hasDiscrepancy = qtyDamaged > 0 || qtyMissing > 0 || qtyRejected > 0;
    const totalProblematic = qtyDamaged + qtyMissing + qtyRejected;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (qty <= 0 && !hasDiscrepancy) return toast.error('Enter a quantity or discrepancy');
        if (qty < 0) return toast.error('Quantity cannot be negative');

        setLoading(true);
        try {
            const res = await receivePOLine(po.id, {
                line_id: line.id,
                quantity: qty,
                qty_damaged: qtyDamaged || undefined,
                qty_rejected: qtyRejected || undefined,
                qty_missing: qtyMissing || undefined,
                receipt_notes: receiptNotes.trim() || undefined,
            });
            if (res?.error) throw new Error(res.error);

            const parts = [`✅ Received ${qty} of ${line.product_name}`];
            if (qtyDamaged) parts.push(`${qtyDamaged} damaged`);
            if (qtyMissing) parts.push(`${qtyMissing} missing`);
            if (qtyRejected) parts.push(`${qtyRejected} rejected`);

            toast.success(parts.join(' · '));
            onSuccess(res);
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Reception failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-app-background/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-app-surface w-full max-w-md rounded-[2rem] shadow-2xl border border-app-border overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="bg-app-primary p-6 text-app-primary-foreground relative">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-app-surface/10 transition-colors">
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-app-surface/20 flex items-center justify-center">
                            <Package size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight">Post Reception</h3>
                            <p className="text-xs font-bold text-app-success uppercase tracking-widest">Receive Stock + Report Discrepancies</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    {/* Product info */}
                    <div className="p-3.5 bg-app-background rounded-xl border border-app-border">
                        <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Item</p>
                        <p className="font-black text-app-foreground">{line.product_name}</p>
                        {line.product_sku && <p className="text-xs text-app-muted-foreground font-mono mt-0.5">{line.product_sku}</p>}
                    </div>

                    {/* Ordered / Already received context */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-app-info-bg rounded-xl border border-app-info/30 text-center">
                            <p className="text-[10px] font-black text-app-info uppercase tracking-widest">Ordered</p>
                            <p className="text-xl font-black text-app-info mt-0.5">{line.quantity}</p>
                        </div>
                        <div className="p-3 bg-app-primary-light rounded-xl border border-app-success/30 text-center">
                            <p className="text-[10px] font-black text-app-primary uppercase tracking-widest">Already Rec.</p>
                            <p className="text-xl font-black text-app-success mt-0.5">{line.qty_received || 0}</p>
                        </div>
                    </div>

                    {/* Main received qty */}
                    <div>
                        <label className="text-xs font-black text-app-muted-foreground uppercase tracking-widest ml-1 mb-2 block flex items-center gap-1.5">
                            <Truck size={11} /> Quantity to Receive
                        </label>
                        <div className="relative flex items-center">
                            <input
                                type="number"
                                autoFocus
                                step="any"
                                min={0}
                                value={qty}
                                onChange={e => setQty(Number(e.target.value))}
                                className="w-full pl-4 pr-20 h-14 bg-app-background rounded-xl border-2 border-transparent focus:border-app-success/30 outline-none transition-all font-black text-xl text-app-foreground"
                                placeholder="0"
                            />
                            <button
                                type="button"
                                onClick={() => setQty(maxReceivable)}
                                className="absolute right-3 px-3 py-1.5 bg-app-primary-light text-app-success rounded-lg text-[9px] font-black hover:bg-app-primary-light transition-colors"
                            >
                                MAX ({maxReceivable})
                            </button>
                        </div>
                    </div>

                    {/* Discrepancy section */}
                    <div className="rounded-xl border border-app-warning bg-app-warning-bg/50 p-4 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <HardHat size={14} className="text-app-warning" />
                            <p className="text-xs font-black text-app-warning uppercase tracking-widest">Discrepancies Observed</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest block mb-1">⚠️ Damaged</label>
                                <input
                                    type="number" min={0} step={1}
                                    value={qtyDamaged}
                                    onChange={e => setQtyDamaged(Math.max(0, Number(e.target.value)))}
                                    className="w-full px-3 h-10 bg-app-surface rounded-lg border border-orange-200 focus:border-orange-400 outline-none font-black text-app-foreground text-sm"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-app-warning uppercase tracking-widest block mb-1">📦 Missing</label>
                                <input
                                    type="number" min={0} step={1}
                                    value={qtyMissing}
                                    onChange={e => setQtyMissing(Math.max(0, Number(e.target.value)))}
                                    className="w-full px-3 h-10 bg-app-surface rounded-lg border border-app-warning focus:border-app-warning/30 outline-none font-black text-app-foreground text-sm"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">✕ Rejected</label>
                                <input
                                    type="number" min={0} step={1}
                                    value={qtyRejected}
                                    onChange={e => setQtyRejected(Math.max(0, Number(e.target.value)))}
                                    className="w-full px-3 h-10 bg-app-surface rounded-lg border border-rose-200 focus:border-rose-400 outline-none font-black text-app-foreground text-sm"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {hasDiscrepancy && (
                            <div>
                                <label className="text-[10px] font-black text-app-warning uppercase tracking-widest block mb-1 flex items-center gap-1.5">
                                    <FileText size={10} /> Receipt Notes
                                    <span className="text-app-warning lowercase font-medium">(required for discrepancies)</span>
                                </label>
                                <textarea
                                    value={receiptNotes}
                                    onChange={e => setReceiptNotes(e.target.value)}
                                    className="w-full px-3 py-2 bg-app-surface rounded-lg border border-app-warning focus:border-app-warning/30 outline-none font-medium text-sm text-app-foreground resize-none"
                                    rows={2}
                                    placeholder="e.g. 3 units arrived with crushed packaging, 2 units short-shipped..."
                                />
                            </div>
                        )}

                        {hasDiscrepancy && (
                            <div className="text-[10px] font-bold text-app-warning bg-app-warning-bg rounded-lg px-3 py-2">
                                ⚠️ {totalProblematic} unit{totalProblematic !== 1 ? 's' : ''} flagged — these will be logged in the Product Activity Feed.
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl font-black text-xs uppercase tracking-widest text-app-muted-foreground hover:text-app-foreground hover:bg-app-background transition-all border border-app-border"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || (qty <= 0 && !hasDiscrepancy)}
                            className="flex-[2] h-12 bg-app-primary text-app-primary-foreground rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-app-primary/20 hover:bg-app-success transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle size={16} />
                                    Post Reception{hasDiscrepancy ? ' + Flag' : ''}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
