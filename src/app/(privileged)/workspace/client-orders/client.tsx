'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Truck, Package, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import {
 confirmClientOrder, processClientOrder, shipClientOrder,
 deliverClientOrder, cancelClientOrder,
} from '@/app/actions/client-portal';

const STATUS_FLOW: Record<string, { next: string; action: string; color: string; icon: any }> = {
 'PLACED': { next: 'CONFIRMED', action: 'Confirm', color: '#22c55e', icon: CheckCircle },
 'CONFIRMED': { next: 'PROCESSING', action: 'Process', color: '#6366f1', icon: Loader2 },
 'PROCESSING': { next: 'SHIPPED', action: 'Ship', color: '#06b6d4', icon: Truck },
 'SHIPPED': { next: 'DELIVERED', action: 'Deliver', color: '#22c55e', icon: Package },
};

const STATUS_COLORS: Record<string, string> = {
 CART: '#64748b', PLACED: '#f59e0b', CONFIRMED: '#6366f1', PROCESSING: '#8b5cf6',
 SHIPPED: '#06b6d4', DELIVERED: '#22c55e', CANCELLED: '#ef4444', RETURNED: '#f97316',
};

export default function ClientOrdersClient({ orders: init }: { orders: any[] }) {
 const [orders, setOrders] = useState<any[]>(init);
 const [search, setSearch] = useState('');
 const [expanded, setExpanded] = useState<number | null>(null);
 const [statusFilter, setStatusFilter] = useState('ALL');

 const filtered = orders.filter(o => {
 const matchSearch = (o.order_number || '').toLowerCase().includes(search.toLowerCase()) ||
 (o.contact_name || '').toLowerCase().includes(search.toLowerCase());
 const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
 return matchSearch && matchStatus;
 });

 async function handleAdvance(order: any) {
 const methods: Record<string, (id: number) => Promise<any>> = {
 PLACED: confirmClientOrder,
 CONFIRMED: processClientOrder,
 PROCESSING: (id) => shipClientOrder(id),
 SHIPPED: deliverClientOrder,
 };
 const fn = methods[order.status];
 if (!fn) return;
 await fn(order.id);
 setOrders(prev => prev.map(o =>
 o.id === order.id ? { ...o, status: STATUS_FLOW[order.status].next } : o
 ));
 }

 async function handleCancel(id: number) {
 await cancelClientOrder(id);
 setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' } : o));
 }

 const cardStyle: React.CSSProperties = {
 background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
 borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
 };

 return (
 <div>
 <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', alignItems: 'center' }}>
 <div style={{
 flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem',
 background: '#0f172a', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
 }}>
 <Search size={16} color="#64748b" />
 <input value={search} onChange={e => setSearch(e.target.value)}
 placeholder="Search orders..."
 style={{ flex: 1, background: 'none', border: 'none', color: '#e2e8f0', outline: 'none' }} />
 </div>
 <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
 padding: '0.5rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
 borderRadius: 8, color: '#e2e8f0',
 }}>
 <option value="ALL">All Statuses</option>
 {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
 </select>
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
 {filtered.map((o: any) => {
 const flow = STATUS_FLOW[o.status];
 return (
 <div key={o.id} style={{ ...cardStyle, padding: '1rem' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <button onClick={() => setExpanded(expanded === o.id ? null : o.id)}
 style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
 {expanded === o.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
 </button>
 <div>
 <div style={{ fontWeight: 600 }}>{o.order_number}</div>
 <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{o.contact_name}</div>
 </div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <div style={{ textAlign: 'right' }}>
 <div style={{ fontWeight: 700, color: '#f1f5f9' }}>
 {Number(o.total_amount || 0).toFixed(2)}
 </div>
 <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
 {o.line_count || 0} items
 </div>
 </div>
 <span style={{
 padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
 background: `${STATUS_COLORS[o.status] || '#64748b'}20`,
 color: STATUS_COLORS[o.status] || '#64748b',
 }}>{o.status}</span>
 {flow && (
 <button onClick={() => handleAdvance(o)} style={{
 display: 'flex', alignItems: 'center', gap: 4,
 padding: '4px 12px', background: flow.color, border: 'none',
 borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
 }}>
 <flow.icon size={14} /> {flow.action}
 </button>
 )}
 {!['DELIVERED', 'CANCELLED'].includes(o.status) && (
 <button onClick={() => handleCancel(o.id)} title="Cancel" style={{
 background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444',
 }}>
 <XCircle size={18} />
 </button>
 )}
 </div>
 </div>

 {expanded === o.id && (
 <div style={{
 marginTop: 12, padding: 12, background: '#0f172a', borderRadius: 8,
 fontSize: '0.85rem', color: '#94a3b8',
 }}>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
 <div><strong>Payment:</strong> {o.payment_status}</div>
 <div><strong>Placed:</strong> {o.placed_at ? new Date(o.placed_at).toLocaleDateString() : '—'}</div>
 <div><strong>Est. Delivery:</strong> {o.estimated_delivery ? new Date(o.estimated_delivery).toLocaleDateString() : '—'}</div>
 </div>
 {o.delivery_rating && (
 <div style={{ marginTop: 8 }}>
 <strong>Rating:</strong> {'⭐'.repeat(o.delivery_rating)}
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 {filtered.length === 0 && (
 <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No client orders found</div>
 )}
 </div>
 </div>
 );
}
