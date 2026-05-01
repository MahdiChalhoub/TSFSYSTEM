'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { use } from 'react';
import { ArrowLeft, CheckCircle2, Truck, XCircle, FileText, Package, Check, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getTransfer, triggerTransferAction } from '@/app/actions/inventory/transfers';
import Link from 'next/link';

type TransferLine = {
 id: number | string
 product?: number | string
 product_name?: string
 quantity: number
 quantity_done?: number
}

type TransferDoc = {
 id?: number | string
 ref_code?: string
 status?: string
 lines?: TransferLine[]
 from_warehouse?: number | string
 from_warehouse_name?: string
 to_warehouse?: number | string
 to_warehouse_name?: string
 scheduled_date?: string
 dispatched_at?: string
 received_at?: string
 notes?: string
}

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
 const resolvedParams = use(params);
 const id = resolvedParams.id;

 const [transfer, setTransfer] = useState<TransferDoc | null>(null);
 const [loading, setLoading] = useState(true);
 const [actionLoading, setActionLoading] = useState<string | null>(null);

 // Specifically for receiving phase overrides
 const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});

 const loadData = async () => {
 setLoading(true);
 try {
 const res = await getTransfer(id) as TransferDoc | null;
 setTransfer(res);

 // Initialize receive quantities dictionary based on planned quantities
 if (res?.lines) {
 const initRecv: Record<string, string> = {};
 res.lines.forEach((l) => {
 initRecv[String(l.id)] = String(l.quantity); // default to same as planned
 });
 setReceiveQuantities(initRecv);
 }
 } catch {
 toast.error("Failed to load transfer document");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadData();
 }, [id]);

 const handleAction = async (action: 'submit' | 'dispatch' | 'receive' | 'cancel') => {
 let reason = '';
 let payloadQs: Record<string, string> | undefined = undefined;

 if (action === 'cancel') {
 const r = prompt("Reason for cancellation?");
 if (r === null) return;
 reason = r;
 }

 if (action === 'receive') {
 if (!confirm("Are you sure you want to receive these quantities? This will increase stock at the destination.")) {
 return;
 }
 payloadQs = receiveQuantities;
 }

 setActionLoading(action);
 toast.loading(`Processing ${action}...`);

 const res = await triggerTransferAction(id, action, reason, payloadQs);

 toast.dismiss();
 if (res.success) {
 toast.success(`Transfer updated successfully: ${action}`);
 loadData();
 } else {
 toast.error(res.error || `Failed to ${action} transfer`);
 }
 setActionLoading(null);
 };

 if (loading) {
 return <div className="app-page p-10 text-center text-app-muted-foreground animate-pulse">Loading transfer details...</div>;
 }

 if (!transfer) {
 return <div className="p-10 text-center font-bold text-app-error">Transfer document not found.</div>;
 }

 const { status } = transfer;
 const isDraft = status === 'DRAFT';
 const isPending = status === 'PENDING';
 const isDispatching = status === 'DISPATCHING'; // Assuming this maps to IN_TRANSIT or intermediate
 const isInTransit = status === 'IN_TRANSIT';
 const isDone = status === 'DONE';
 const isCancelled = status === 'CANCELLED';

 const renderStatusBadge = () => {
 const variants: Record<string, string> = {
 DRAFT: 'bg-app-surface-2 text-app-muted-foreground border-app-border',
 PENDING: 'bg-app-warning-bg text-app-warning border-app-warning',
 IN_TRANSIT: 'bg-app-info-bg text-app-info border-app-info',
 DONE: 'bg-app-primary-light text-app-success border-app-success',
 CANCELLED: 'bg-app-error-bg text-app-error border-app-error',
 };
 const active = variants[status || 'DRAFT'] || variants.DRAFT;
 return <span className={`px-3 py-1 text-xs font-black uppercase rounded-full border ${active}`}>{status}</span>;
 };

 return (
 <div className="min-h-screen p-5 md:p-6 space-y-6 max-w-5xl mx-auto bg-app-background" style={{ color: 'var(--app-foreground)' }}>
 {/* ── Header ────────────────────────────────────────── */}
 <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-app-border pb-6 fade-in-up">
 <div className="flex items-center gap-4">
 <Link href="/inventory/transfers">
 <Button variant="ghost" size="icon" className="rounded-full bg-app-surface border border-app-border text-app-muted-foreground hover:text-app-foreground">
 <ArrowLeft size={18} />
 </Button>
 </Link>
 <div>
 <div className="flex items-center gap-3">
 <h1 className="text-2xl font-black tracking-tight font-mono">{transfer.ref_code}</h1>
 {renderStatusBadge()}
 </div>
 <p className="text-xs mt-1 font-bold text-app-muted-foreground uppercase tracking-widest">
 Multi-Warehouse Transfer
 </p>
 </div>
 </div>

 {/* ── Action Bar ────────────────────────────────────── */}
 <div className="flex items-center gap-2">
 {isDraft && (
 <>
 <Button onClick={() => handleAction('submit')} disabled={!!actionLoading} className="bg-app-warning hover:bg-app-warning text-app-primary-foreground rounded-xl shadow-lg border-none font-bold">
 <FileText size={16} className="mr-2" /> Submit Request
 </Button>
 </>
 )}
 {(isDraft || isPending) && (
 <Button onClick={() => handleAction('cancel')} disabled={!!actionLoading} variant="outline" className="border-app-error text-app-error hover:bg-app-error-bg rounded-xl font-bold">
 <XCircle size={16} className="mr-2" /> Cancel
 </Button>
 )}
 {isPending && (
 <Button onClick={() => handleAction('dispatch')} disabled={!!actionLoading} className="bg-app-info hover:bg-app-info text-app-primary-foreground rounded-xl shadow-lg border-none font-bold">
 <Truck size={16} className="mr-2" /> Dispatch Freight
 </Button>
 )}
 {isInTransit && (
 <Button onClick={() => handleAction('receive')} disabled={!!actionLoading} className="bg-app-primary hover:bg-app-success text-app-primary-foreground rounded-xl shadow-lg border-none font-bold">
 <CheckCircle2 size={16} className="mr-2" /> Receive Goods
 </Button>
 )}
 </div>
 </header>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* ── Left Column: Items ────────────────────────────── */}
 <div className="md:col-span-2 space-y-6">
 <div className="bg-app-surface p-6 rounded-2xl border border-app-border shadow-sm">
 <h2 className="text-sm font-black uppercase tracking-widest text-app-muted-foreground mb-4 flex items-center gap-2">
 <Package size={16} /> Transfer Manifest
 </h2>

 <div className="rounded-xl border border-app-border overflow-hidden">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-app-background text-[10px] uppercase font-black tracking-widest text-app-muted-foreground border-b border-app-border">
 <th className="p-4 w-12 text-center">#</th>
 <th className="p-4">Product</th>
 <th className="p-4 text-center">Planned Qty</th>
 <th className="p-4 text-center">Received</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-app-border bg-app-surface text-sm font-medium">
 {transfer.lines?.map((line, idx: number) => (
 <tr key={line.id} className="hover:bg-app-surface-hover/50 transition-colors">
 <td className="p-4 text-center text-[10px] font-black text-app-muted-foreground">{idx + 1}</td>
 <td className="p-4">
 <div className="font-bold text-app-foreground">{line.product_name || `Product ID: ${line.product}`}</div>
 </td>
 <td className="p-4 text-center">
 <span className="bg-app-background border border-app-border text-app-foreground px-2.5 py-1 rounded-md text-xs font-black">
 {line.quantity}
 </span>
 </td>
 <td className="p-4 text-center">
 {isInTransit ? (
 <Input
 type="number"
 min="0"
 max={line.quantity}
 step="0.01"
 className="w-20 mx-auto h-8 text-center text-xs font-bold border-app-success bg-app-primary-light/50 text-app-success"
 value={receiveQuantities[line.id] ?? line.quantity}
 onChange={e => setReceiveQuantities({ ...receiveQuantities, [line.id]: e.target.value })}
 />
 ) : (
 <span className={`px-2.5 py-1 rounded-md text-xs font-black ${(line.quantity_done || 0) < line.quantity ? 'bg-app-error-bg text-app-error' : 'bg-app-background text-app-muted-foreground border border-app-border'}`}>
 {status === 'DRAFT' || status === 'PENDING' ? '—' : (line.quantity_done || '0.00')}
 </span>
 )}
 </td>
 </tr>
 ))}
 {(!transfer.lines || transfer.lines.length === 0) && (
 <tr>
 <td colSpan={4} className="p-8 text-center text-app-muted-foreground text-xs italic">
 No items assigned to this manifest.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>

 {/* ── Right Column: Info & Routing ──────────────────── */}
 <div className="space-y-6">
 <div className="bg-app-surface p-6 rounded-2xl border border-app-border shadow-sm space-y-5">
 <div className="flex items-start gap-4">
 <div className="p-3 bg-app-warning-bg text-app-warning rounded-2xl shrink-0"><MapPin size={20} /></div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Origin</div>
 <div className="text-sm font-black text-app-foreground">{transfer.from_warehouse_name || `WH-${transfer.from_warehouse}`}</div>
 </div>
 </div>
 <div className="flex items-center gap-2 pl-[1.15rem]">
 <div className="w-0.5 h-6 bg-app-border rounded-full" />
 </div>
 <div className="flex items-start gap-4">
 <div className="p-3 bg-app-primary/5 text-app-primary rounded-2xl shrink-0"><MapPin size={20} /></div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Destination</div>
 <div className="text-sm font-black text-app-foreground">{transfer.to_warehouse_name || `WH-${transfer.to_warehouse}`}</div>
 </div>
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-2xl border border-app-border shadow-sm space-y-4">
 <h3 className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 border-b border-app-border pb-2">Scheduling</h3>
 <div className="flex items-center justify-between text-sm">
 <span className="text-app-muted-foreground flex items-center gap-2 font-medium"><Calendar size={14} /> Scheduled</span>
 <span className="font-bold">{transfer.scheduled_date || 'N/A'}</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className="text-app-muted-foreground flex items-center gap-2 font-medium"><Truck size={14} /> Dispatched</span>
 <span className="font-bold">{transfer.dispatched_at ? new Date(transfer.dispatched_at).toLocaleDateString() : '—'}</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className="text-app-muted-foreground flex items-center gap-2 font-medium"><Check size={14} /> Received</span>
 <span className="font-bold">{transfer.received_at ? new Date(transfer.received_at).toLocaleDateString() : '—'}</span>
 </div>
 </div>

 {transfer.notes && (
 <div className="bg-app-surface p-6 rounded-2xl border border-app-border shadow-sm space-y-2">
 <h3 className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Internal Notes</h3>
 <p className="text-xs text-app-foreground leading-relaxed font-medium">{transfer.notes}</p>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
