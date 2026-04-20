// @ts-nocheck
'use client';

/**
 * TransferRequestDialog — Request a stock transfer from another warehouse
 * =======================================================================
 * Part of the original March 8 Intelligence Grid philosophy. Lets the
 * procurement manager request stock from any warehouse that holds the
 * product, sending a ProcurementRequest(type=TRANSFER, status=PENDING)
 * to the queue for review.
 */

import { useState } from 'react';
import { X, ArrowRight, Warehouse, Loader2 } from 'lucide-react';
import { createProcurementRequest } from '@/app/actions/commercial/procurement-requests';

interface TransferRequestDialogProps {
    productId: number;
    productName: string;
    currentQty: number;
    otherWarehouses: Array<{ warehouse_id: number; warehouse: string; qty: number }>;
    toWarehouseId?: number;
    toWarehouseName?: string;
    onClose: () => void;
    onSubmitted?: () => void;
}

export function TransferRequestDialog({
    productId,
    productName,
    currentQty,
    otherWarehouses,
    toWarehouseId,
    toWarehouseName,
    onClose,
    onSubmitted,
}: TransferRequestDialogProps) {
    const [fromWarehouseId, setFromWarehouseId] = useState<number | null>(
        otherWarehouses[0]?.warehouse_id ?? null
    );
    const [quantity, setQuantity] = useState<number>(Math.max(1, Math.ceil(currentQty)));
    const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selected = otherWarehouses.find(w => w.warehouse_id === fromWarehouseId);
    const availableAtSource = selected?.qty ?? 0;

    const submit = async () => {
        if (!fromWarehouseId) { setError('Pick a source warehouse.'); return; }
        if (quantity <= 0) { setError('Quantity must be > 0.'); return; }
        if (quantity > availableAtSource) { setError(`Only ${availableAtSource} available at source.`); return; }

        setSubmitting(true);
        setError(null);
        try {
            await createProcurementRequest({
                requestType: 'TRANSFER',
                productId,
                quantity,
                fromWarehouseId,
                toWarehouseId,
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

                    {/* Header */}
                    <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
                        style={{ borderBottom: '1px solid var(--app-border)' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                <ArrowRight size={15} />
                            </div>
                            <div>
                                <h3 className="text-[14px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                    Transfer Request
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

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                        {otherWarehouses.length === 0 ? (
                            <div className="p-4 rounded-lg text-[11px] font-bold text-center"
                                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                                No other warehouse has stock for this product.
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        From warehouse
                                    </label>
                                    <div className="space-y-1.5">
                                        {otherWarehouses.map(w => (
                                            <button key={w.warehouse_id} type="button"
                                                onClick={() => setFromWarehouseId(w.warehouse_id)}
                                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all"
                                                style={fromWarehouseId === w.warehouse_id ? {
                                                    background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                                    border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                                    color: 'var(--app-primary)',
                                                } : {
                                                    background: 'var(--app-background)',
                                                    border: '1px solid var(--app-border)',
                                                    color: 'var(--app-foreground)',
                                                }}>
                                                <span className="flex items-center gap-2 text-[12px] font-bold">
                                                    <Warehouse size={13} />
                                                    {w.warehouse}
                                                </span>
                                                <span className="text-[11px] font-mono tabular-nums font-black">
                                                    {w.qty}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {toWarehouseName && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                            To warehouse
                                        </label>
                                        <div className="px-3 py-2 rounded-lg text-[12px] font-bold"
                                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                            {toWarehouseName}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        Quantity to transfer
                                    </label>
                                    <input type="number" min={1} max={availableAtSource}
                                        value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg text-[13px] font-bold outline-none"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                    <p className="text-[10px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Available at source: <strong>{availableAtSource}</strong>
                                    </p>
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
                                        placeholder="e.g. urgent customer order at this branch"
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

                    {/* Footer */}
                    <div className="px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0"
                        style={{ borderTop: '1px solid var(--app-border)' }}>
                        <button type="button" onClick={() => !submitting && onClose()}
                            className="px-4 py-2 rounded-lg text-[11px] font-bold transition-all"
                            style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                            Cancel
                        </button>
                        <button type="button" onClick={submit}
                            disabled={submitting || otherWarehouses.length === 0 || !fromWarehouseId}
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
