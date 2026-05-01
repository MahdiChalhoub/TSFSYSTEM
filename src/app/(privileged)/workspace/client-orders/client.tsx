'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Truck, Package, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import {
    confirmClientOrder, processClientOrder, shipClientOrder,
    deliverClientOrder, cancelClientOrder,
} from '@/app/actions/client-portal';

const STATUS_FLOW: Record<string, { next: string; action: string; color: string; icon: any }> = {
    'PLACED': { next: 'CONFIRMED', action: 'Confirm', color: 'var(--app-success)', icon: CheckCircle },
    'CONFIRMED': { next: 'PROCESSING', action: 'Process', color: 'var(--app-accent)', icon: Loader2 },
    'PROCESSING': { next: 'SHIPPED', action: 'Ship', color: 'var(--app-accent-cyan)', icon: Truck },
    'SHIPPED': { next: 'DELIVERED', action: 'Deliver', color: 'var(--app-success)', icon: Package },
};

const STATUS_COLORS: Record<string, string> = {
    CART: 'var(--app-muted-foreground)', PLACED: 'var(--app-warning)', CONFIRMED: 'var(--app-accent)', PROCESSING: 'var(--app-accent)',
    SHIPPED: 'var(--app-accent-cyan)', DELIVERED: 'var(--app-success)', CANCELLED: 'var(--app-error)', RETURNED: 'var(--app-warning)',
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
        background: 'linear-gradient(135deg, var(--app-surface-2) 0%, var(--app-bg) 100%)',
        borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', alignItems: 'center' }}>
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem',
                    background: 'var(--app-bg)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <Search size={16} color="var(--app-muted-foreground)" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search orders..."
                        style={{ flex: 1, background: 'none', border: 'none', color: 'var(--app-border)', outline: 'none' }} />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
                    padding: '0.5rem', background: 'var(--app-bg)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, color: 'var(--app-border)',
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
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-faint)' }}>
                                        {expanded === o.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{o.order_number}</div>
                                        <div style={{ color: 'var(--app-faint)', fontSize: '0.85rem' }}>{o.contact_name}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--app-foreground)' }}>
                                            {Number(o.total_amount || 0).toFixed(2)}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--app-faint)' }}>
                                            {o.line_count || 0} items
                                        </div>
                                    </div>
                                    <span style={{
                                        padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                        background: `${STATUS_COLORS[o.status] || 'var(--app-muted-foreground)'}20`,
                                        color: STATUS_COLORS[o.status] || 'var(--app-muted-foreground)',
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
                                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-error)',
                                        }}>
                                            <XCircle size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {expanded === o.id && (
                                <div style={{
                                    marginTop: 12, padding: 12, background: 'var(--app-bg)', borderRadius: 8,
                                    fontSize: '0.85rem', color: 'var(--app-faint)',
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
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--app-muted-foreground)' }}>No client orders found</div>
                )}
            </div>
        </div>
    );
}
