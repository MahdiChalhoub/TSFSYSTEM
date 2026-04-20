// @ts-nocheck
'use client';

/**
 * PurchaseRequestDialog — Request purchase of this product from a DIFFERENT supplier
 * ===================================================================================
 * Part of the original March 8 Intelligence Grid philosophy. When the current
 * supplier's price is uncompetitive or out of stock, the buyer queues a request
 * to source from another supplier. Fires ProcurementRequest(type=PURCHASE).
 */

import { useState } from 'react';
import { X, Send, Loader2, User } from 'lucide-react';
import { createProcurementRequest } from '@/app/actions/commercial/procurement-requests';

interface PurchaseRequestDialogProps {
    productId: number;
    productName: string;
    currentQty: number;
    suggestedPrice?: number;
    suppliers: Array<{ id: number; name?: string; company_name?: string }>;
    excludeSupplierId?: number;
    onClose: () => void;
    onSubmitted?: () => void;
}

export function PurchaseRequestDialog({
    productId,
    productName,
    currentQty,
    suggestedPrice,
    suppliers,
    excludeSupplierId,
    onClose,
    onSubmitted,
}: PurchaseRequestDialogProps) {
    const candidates = suppliers.filter(s => s.id !== excludeSupplierId);
    const [supplierId, setSupplierId] = useState<number | ''>(candidates[0]?.id ?? '');
    const [quantity, setQuantity] = useState<number>(Math.max(1, Math.ceil(currentQty)));
    const [unitPrice, setUnitPrice] = useState<number>(Number(suggestedPrice ?? 0));
    const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!supplierId) { setError('Pick a supplier.'); return; }
        if (quantity <= 0) { setError('Quantity must be > 0.'); return; }

        setSubmitting(true);
        setError(null);
        try {
            await createProcurementRequest({
                requestType: 'PURCHASE',
                productId,
                quantity,
                supplierId: Number(supplierId),
                suggestedUnitPrice: unitPrice || undefined,
                priority,
                reason: reason || undefined,
            });
            onSubmitted?.();
            onClose();
        } catch (e: any) {
            setError(e?.message || 'Failed to submit request.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/40 z-50" onClick={() => !submitting && onClose()} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div className="relative w-full max-w-md rounded-2xl shadow-2xl pointer-events-auto flex flex-col"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

                    <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
                        style={{ borderBottom: '1px solid var(--app-border)' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                                <Send size={14} />
                            </div>
                            <div>
                                <h3 className="text-[14px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                    Request from Other Supplier
                                </h3>
                                <p className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {productName}
                                </p>
                            </div>
                        </div>
                        <button type="button" onClick={() => !submitting && onClose()}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            <X size={15} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                        {candidates.length === 0 ? (
                            <div className="p-4 rounded-lg text-[11px] font-bold text-center"
                                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                                No alternative suppliers available.
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        Alternative supplier
                                    </label>
                                    <select value={supplierId}
                                        onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full px-3 py-2 rounded-lg text-[12px] font-bold outline-none"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        <option value="">— Pick a supplier —</option>
                                        {candidates.map(s => (
                                            <option key={s.id} value={s.id}>{s.name || s.company_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                            Quantity
                                        </label>
                                        <input type="number" min={1} value={quantity}
                                            onChange={e => setQuantity(Number(e.target.value))}
                                            className="w-full px-3 py-2 rounded-lg text-[13px] font-bold outline-none"
                                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                            Suggested price
                                        </label>
                                        <input type="number" min={0} step="0.01" value={unitPrice}
                                            onChange={e => setUnitPrice(Number(e.target.value))}
                                            className="w-full px-3 py-2 rounded-lg text-[13px] font-mono tabular-nums outline-none"
                                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        Priority
                                    </label>
                                    <div className="grid grid-cols-4 gap-1">
                                        {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map(p => (
                                            <button key={p} type="button" onClick={() => setPriority(p)}
                                                className="py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                                style={priority === p ? {
                                                    background: p === 'URGENT' ? 'var(--app-error, #ef4444)'
                                                        : p === 'HIGH' ? 'var(--app-warning, #f59e0b)'
                                                        : p === 'NORMAL' ? 'var(--app-primary)'
                                                        : 'var(--app-muted-foreground)',
                                                    color: 'white',
                                                } : {
                                                    background: 'var(--app-background)',
                                                    border: '1px solid var(--app-border)',
                                                    color: 'var(--app-muted-foreground)',
                                                }}>
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        Reason (optional)
                                    </label>
                                    <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                                        placeholder="e.g. primary supplier out of stock"
                                        className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                </div>

                                {error && (
                                    <div className="px-3 py-2 rounded-lg text-[11px] font-bold"
                                        style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                                        {error}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0"
                        style={{ borderTop: '1px solid var(--app-border)' }}>
                        <button type="button" onClick={() => !submitting && onClose()}
                            className="px-4 py-2 rounded-lg text-[11px] font-bold transition-all"
                            style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                            Cancel
                        </button>
                        <button type="button" onClick={submit}
                            disabled={submitting || candidates.length === 0 || !supplierId}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                                background: 'var(--app-primary)',
                                color: 'white',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}>
                            {submitting ? <><Loader2 size={12} className="animate-spin" /> Submitting…</> : <>Submit Request</>}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
