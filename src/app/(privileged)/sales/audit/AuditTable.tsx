'use client';

import { useState, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { format } from 'date-fns';
import {
 CheckCircle, AlertOctagon, Archive, PenTool, Search,
 CreditCard, PackageX, Filter, RefreshCw, ChevronDown, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

// ── Event type appearance map ───────────────────────────────────────────────
const EVENT_CONFIG: Record<string, {
 label: string;
 icon: React.ReactNode;
 badge: string;
 row: string;
}> = {
 PRICE_OVERRIDE: {
 label: 'Price Override',
 icon: <AlertOctagon size={15} className="text-rose-500" />,
 badge: 'bg-rose-50 text-rose-700 border-rose-200',
 row: 'border-l-2 border-l-rose-400',
 },
 GLOBAL_DISCOUNT: {
 label: 'Global Discount',
 icon: <AlertOctagon size={15} className="text-orange-500" />,
 badge: 'bg-orange-50 text-orange-700 border-orange-200',
 row: 'border-l-2 border-l-orange-400',
 },
 CLEAR_CART: {
 label: 'Clear Cart',
 icon: <Archive size={15} className="text-amber-500" />,
 badge: 'bg-amber-50 text-amber-700 border-amber-200',
 row: 'border-l-2 border-l-amber-400',
 },
 REMOVE_ITEM: {
 label: 'Remove Item',
 icon: <Archive size={15} className="text-amber-500" />,
 badge: 'bg-amber-50 text-amber-700 border-amber-200',
 row: 'border-l-2 border-l-amber-400',
 },
 DECREASE_QTY: {
 label: 'Decrease Qty',
 icon: <PenTool size={15} className="text-blue-500" />,
 badge: 'bg-blue-50 text-blue-700 border-blue-200',
 row: 'border-l-2 border-l-blue-400',
 },
 CREDIT_SALE: {
 label: 'Credit Sale',
 icon: <CreditCard size={15} className="text-amber-600" />,
 badge: 'bg-amber-50 text-amber-800 border-amber-300',
 row: 'border-l-2 border-l-amber-500 bg-amber-50/30',
 },
 NEGATIVE_STOCK_OVERRIDE: {
 label: 'Negative Stock',
 icon: <PackageX size={15} className="text-red-500" />,
 badge: 'bg-red-50 text-red-700 border-red-200',
 row: 'border-l-2 border-l-red-500 bg-red-50/30',
 },
};

const getConfig = (type: string) => EVENT_CONFIG[type] || {
 label: type,
 icon: <Search size={15} className="text-app-text-faint" />,
 badge: 'bg-app-surface-2 text-app-text-muted border-app-border',
 row: 'border-l-2 border-l-gray-300',
};

// ── Human-readable details ──────────────────────────────────────────────────
function DetailsCell({ details, type }: { details: any; type: string }) {
 const [expanded, setExpanded] = useState(false);

 // Build a human-readable summary line per event type
 let summary = '';
 if (type === 'PRICE_OVERRIDE' || type === 'GLOBAL_DISCOUNT') {
 summary = details.product
 ? `${details.product} — sold at ${details.sold_price} (base: ${details.base_price})`
 : `Discount: ${details.discount_amount}`;
 } else if (type === 'CREDIT_SALE') {
 summary = `Total: ${details.total}${details.contact_id ? ` · Client #${details.contact_id}` : ''}`;
 } else if (type === 'NEGATIVE_STOCK_OVERRIDE') {
 summary = `${details.product} — stock was ${details.stock_at_sale}, sold ${details.qty_sold}`;
 } else if (type === 'REMOVE_ITEM' || type === 'CLEAR_CART') {
 summary = details.product ? details.product : 'Cart cleared';
 } else if (type === 'DECREASE_QTY') {
 summary = details.product ? `${details.product}: ${details.old_qty} → ${details.new_qty}` : '';
 }

 return (
 <td className="p-3 max-w-xs">
 <div className="flex items-start gap-1">
 <button
 onClick={() => setExpanded(e => !e)}
 className="mt-0.5 text-app-text-faint hover:text-app-text-muted transition-colors shrink-0"
 >
 {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
 </button>
 <div>
 {summary && (
 <div className="text-xs text-gray-700 font-medium leading-tight">{summary}</div>
 )}
 {expanded && (
 <pre className="mt-1 text-[10px] bg-app-surface-2 px-2 py-1 rounded text-app-text-muted whitespace-pre-wrap break-all">
 {JSON.stringify(details, null, 2)}
 </pre>
 )}
 </div>
 </div>
 </td>
 );
}

const ALL_EVENT_TYPES = Object.keys(EVENT_CONFIG);

export default function AuditTable() {
 const [events, setEvents] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [tab, setTab] = useState<'ALL' | 'UNREVIEWED' | 'REVIEWED'>('UNREVIEWED');
 const [typeFilter, setTypeFilter] = useState<string>('ALL');

 const loadEvents = async () => {
 setLoading(true);
 try {
 const params = new URLSearchParams();
 if (tab !== 'ALL') params.set('is_reviewed', tab === 'REVIEWED' ? 'true' : 'false');
 if (typeFilter !== 'ALL') params.set('event_type', typeFilter);
 const data = await erpFetch(`pos-audit-events/?${params.toString()}`);
 setEvents(data || []);
 } catch (e) {
 toast.error("Failed to load audit events");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { loadEvents(); }, [tab, typeFilter]);

 const markReviewed = async (id: number) => {
 try {
 await erpFetch(`pos-audit-events/${id}/mark_reviewed/`, { method: 'POST' });
 toast.success("Event marked as reviewed");
 loadEvents();
 } catch (e) {
 toast.error("Failed to review event");
 }
 };

 const unreviewed = events.filter(e => !e.is_reviewed).length;

 return (
 <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden flex flex-col h-full">
 {/* Header */}
 <div className="px-4 py-3 border-b bg-gray-50/50 flex items-center justify-between gap-4 flex-wrap">
 {/* Review Status Tabs */}
 <div className="flex bg-app-surface-2 p-1 rounded-lg">
 {(['UNREVIEWED', 'REVIEWED', 'ALL'] as const).map(t => (
 <button
 key={t}
 onClick={() => setTab(t)}
 className={clsx(
 'px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5',
 tab === t ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-muted hover:text-gray-700'
 )}
 >
 {t}
 {t === 'UNREVIEWED' && unreviewed > 0 && (
 <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black">
 {unreviewed}
 </span>
 )}
 </button>
 ))}
 </div>

 {/* Event Type Filter */}
 <div className="flex items-center gap-2">
 <Filter size={13} className="text-app-text-faint" />
 <select
 value={typeFilter}
 onChange={e => setTypeFilter(e.target.value)}
 className="text-xs font-bold text-gray-700 bg-app-surface-2 border-0 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
 >
 <option value="ALL">All Event Types</option>
 {ALL_EVENT_TYPES.map(t => (
 <option key={t} value={t}>{EVENT_CONFIG[t].label}</option>
 ))}
 </select>
 <button
 onClick={loadEvents}
 disabled={loading}
 className="p-1.5 rounded-lg bg-app-surface-2 text-app-text-muted hover:bg-indigo-50 hover:text-indigo-600 transition-all"
 title="Refresh"
 >
 <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
 </button>
 </div>
 </div>

 {/* Table */}
 <div className="flex-1 overflow-auto">
 <table className="w-full text-left text-sm whitespace-nowrap">
 <thead className="bg-app-bg text-app-text-muted sticky top-0 uppercase text-[10px] font-bold tracking-wider border-b border-app-border">
 <tr>
 <th className="p-3 w-8"></th>
 <th className="p-3 w-32">Time</th>
 <th className="p-3 w-36">Type</th>
 <th className="p-3">Event / Details</th>
 <th className="p-3 w-28">User</th>
 <th className="p-3 w-24 text-center">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {loading ? (
 <tr><td colSpan={6} className="p-8 text-center text-app-text-faint">Loading events...</td></tr>
 ) : events.length === 0 ? (
 <tr><td colSpan={6} className="p-8 text-center text-app-text-faint">No events found</td></tr>
 ) : events.map(ev => {
 const cfg = getConfig(ev.event_type);
 return (
 <tr
 key={ev.id}
 className={clsx(
 'hover:bg-gray-50/80 transition-colors',
 cfg.row,
 ev.is_reviewed && 'opacity-50'
 )}
 >
 <td className="p-3 text-center">{cfg.icon}</td>
 <td className="p-3 font-mono text-[10px] text-app-text-muted tabular-nums">
 {format(new Date(ev.created_at), 'dd MMM HH:mm')}
 </td>
 <td className="p-3">
 <span className={clsx(
 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
 cfg.badge
 )}>
 {cfg.label}
 </span>
 </td>
 <DetailsCell details={ev.details || {}} type={ev.event_type} />
 <td className="p-3 text-xs text-app-text-muted font-medium">
 {ev.user_name || 'System'}
 </td>
 <td className="p-3 text-center">
 {!ev.is_reviewed ? (
 <button
 onClick={() => markReviewed(ev.id)}
 className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all"
 >
 Review
 </button>
 ) : (
 <div className="flex items-center justify-center gap-1 text-[10px] text-app-text-faint">
 <CheckCircle size={11} /> {ev.reviewed_by_name || '✓'}
 </div>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 );
}
