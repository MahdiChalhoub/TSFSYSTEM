'use client';

import { useState, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';
import {
    Truck, Package, AlertTriangle, ArrowRight, CheckCircle2, FileText,
    XCircle, UserX, ShoppingBag, HardHat
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface Operation {
    id: string
    type: 'PURCHASE' | 'MANIFEST' | 'TRANSFER'
    status: string
    reference: string
    quantity: number
    source: string
    destination: string
    date: string | null
    failed_by?: string | null
    reason?: string | null
    failure_type?: 'INTERNAL_REJECTION' | 'SUPPLIER_FAILURE' | null
    discrepancies?: {
        missing: number
        damaged: number
        rejected: number
        notes: string | null
    } | null
}

export function ProductActivityFeed({ productId }: { productId: number | string }) {
    const [operations, setOperations] = useState<Operation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOps() {
            try {
                const res = await erpFetch(`inventory/products/${productId}/active_operations/`);
                setOperations(Array.isArray(res) ? res : []);
            } catch (e) {
                console.error("Failed to load operations", e);
            } finally {
                setLoading(false);
            }
        }
        if (productId) fetchOps();
    }, [productId]);

    if (loading) {
        return <div className="animate-pulse space-y-3">
            <div className="h-14 bg-app-surface-2 rounded-xl w-full" />
            <div className="h-14 bg-app-surface-2 rounded-xl w-full" />
        </div>
    }

    if (operations.length === 0) return null;

    const isFailed = (op: Operation) => ['FAILED', 'CANCELLED', 'REJECTED'].includes(op.status);
    const isDone = (op: Operation) => ['RECEIVED', 'DONE', 'COMPLETED'].includes(op.status);

    const getTypeIcon = (op: Operation) => {
        if (op.failure_type === 'SUPPLIER_FAILURE') return <ShoppingBag size={15} className="text-rose-500" />;
        if (op.failure_type === 'INTERNAL_REJECTION') return <UserX size={15} className="text-orange-500" />;
        if (isFailed(op)) return <XCircle size={15} className="text-app-error" />;
        if (isDone(op)) return <CheckCircle2 size={15} className="text-app-primary" />;
        if (op.type === 'PURCHASE') return <Package size={15} className="text-app-info" />;
        if (op.type === 'MANIFEST') return <FileText size={15} className="text-purple-500" />;
        return <Truck size={15} className="text-app-warning" />;
    };

    const getColors = (op: Operation): string => {
        if (op.failure_type === 'SUPPLIER_FAILURE') return 'bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800/40';
        if (op.failure_type === 'INTERNAL_REJECTION') return 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800/40';
        if (isFailed(op)) return 'bg-app-error-bg border-app-error';
        if (isDone(op)) return 'bg-app-primary-light/50 border-emerald-100';
        if (op.type === 'PURCHASE') return 'bg-app-info-bg/50 border-blue-100';
        if (op.type === 'MANIFEST') return 'bg-purple-50/50 border-purple-100';
        return 'bg-app-warning-bg/50 border-amber-100';
    };

    const getFailureLabel = (op: Operation): string => {
        if (op.failure_type === 'SUPPLIER_FAILURE') return '⚠️ Supplier Failure';
        if (op.failure_type === 'INTERNAL_REJECTION') return '🚫 Internal Rejection';
        return '';
    };

    const getTotalDiscrepancies = (op: Operation) => {
        if (!op.discrepancies) return 0;
        return op.discrepancies.missing + op.discrepancies.damaged + op.discrepancies.rejected;
    };

    return (
        <Card className="shadow-none border-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-app-primary animate-pulse" />
                    Active Logistics Pipeline
                </CardTitle>
                <CardDescription className="text-xs">
                    Live tracking of purchasing, transfers, and discrepancies for this product.
                </CardDescription>
            </CardHeader>

            <CardContent className="px-0 pb-0 space-y-2.5">
                {operations.map((op) => (
                    <div
                        key={op.id}
                        className={`flex flex-col p-3.5 rounded-xl border transition-all hover:shadow-sm ${getColors(op)}`}
                    >
                        {/* ── Main row ── */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-app-surface/70 border border-white/50 flex-shrink-0 shadow-sm">
                                    {getTypeIcon(op)}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-black text-app-foreground flex items-center gap-1.5 uppercase tracking-wider truncate">
                                        {op.failure_type ? getFailureLabel(op) : op.type}
                                        <ArrowRight size={10} className="text-app-muted-foreground flex-shrink-0" />
                                        <span className="truncate font-mono">{op.reference}</span>
                                    </span>
                                    <span className="text-[10px] text-app-muted-foreground font-medium mt-0.5 truncate">
                                        {op.source} <ArrowRight size={8} className="inline opacity-40 mx-0.5" /> {op.destination}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end text-right flex-shrink-0 ml-2">
                                <span className={`text-sm font-black ${isFailed(op) ? 'line-through opacity-50 text-app-foreground' : 'text-app-foreground'}`}>
                                    {Number(op.quantity).toLocaleString()} Units
                                </span>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md mt-1 ${op.failure_type === 'SUPPLIER_FAILURE' ? 'bg-rose-100 text-rose-700' :
                                        op.failure_type === 'INTERNAL_REJECTION' ? 'bg-orange-100 text-orange-700' :
                                            isFailed(op) ? 'bg-app-error-bg text-app-error' :
                                                isDone(op) ? 'bg-app-primary-light text-app-success' :
                                                    'bg-app-surface/70 text-app-muted-foreground'
                                    }`}>
                                    {op.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>

                        {/* ── Failure details ── */}
                        {(op.reason || op.failed_by) && (
                            <div className="mt-2.5 pt-2 border-t border-black/5 space-y-1">
                                {op.failed_by && (
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                                        <AlertTriangle size={10} />
                                        {op.failure_type === 'SUPPLIER_FAILURE' ? 'Logged by:' : 'Rejected by:'}
                                        <span className="font-semibold capitalize">{op.failed_by}</span>
                                    </div>
                                )}
                                {op.reason && (
                                    <div className="text-[10px] text-app-muted-foreground bg-black/5 px-2 py-1 rounded leading-tight">
                                        <b className="uppercase text-[9px] tracking-wider mr-1">Reason:</b>
                                        "{op.reason}"
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Receipt discrepancies ── */}
                        {op.discrepancies && getTotalDiscrepancies(op) > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-app-warning/60">
                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-app-warning mb-1.5">
                                    <HardHat size={11} />
                                    Receipt Discrepancies
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {op.discrepancies.damaged > 0 && (
                                        <span className="text-[9px] bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded font-bold">
                                            ⚠️ {op.discrepancies.damaged} Damaged
                                        </span>
                                    )}
                                    {op.discrepancies.missing > 0 && (
                                        <span className="text-[9px] bg-app-warning-bg text-app-warning border border-app-warning px-2 py-0.5 rounded font-bold">
                                            📦 {op.discrepancies.missing} Missing
                                        </span>
                                    )}
                                    {op.discrepancies.rejected > 0 && (
                                        <span className="text-[9px] bg-app-error-bg text-app-error border border-app-error px-2 py-0.5 rounded font-bold">
                                            ✕ {op.discrepancies.rejected} Rejected
                                        </span>
                                    )}
                                </div>
                                {op.discrepancies.notes && (
                                    <div className="mt-1 text-[10px] text-app-muted-foreground bg-black/5 px-2 py-1 rounded leading-tight">
                                        <b className="text-[9px] uppercase tracking-wider mr-1">Notes:</b>
                                        {op.discrepancies.notes}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
