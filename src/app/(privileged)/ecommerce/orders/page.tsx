'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Clock, CheckCircle, Truck, Package, Search, Filter } from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    PLACED: { bg: '#fef3c7', text: '#92400e', label: 'Placed' },
    CONFIRMED: { bg: '#dbeafe', text: '#1e40af', label: 'Confirmed' },
    PROCESSING: { bg: '#e0e7ff', text: '#3730a3', label: 'Processing' },
    SHIPPED: { bg: '#ede9fe', text: '#5b21b6', label: 'Shipped' },
    DELIVERED: { bg: '#d1fae5', text: '#065f46', label: 'Delivered' },
    CANCELLED: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
};

export default function EcommerceOrdersPage() {
    const [orders] = useState<any[]>([]);
    const [filter, setFilter] = useState('ALL');

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Online Orders</h1>
                    <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Manage eCommerce orders from your storefront.</p>
                </div>
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {['ALL', 'PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].map(s => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '20px',
                            border: '1px solid ' + (filter === s ? '#6366f1' : '#e2e8f0'),
                            background: filter === s ? '#6366f1' : '#fff',
                            color: filter === s ? '#fff' : '#475569',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                        }}
                    >
                        {s === 'ALL' ? 'All Orders' : STATUS_COLORS[s]?.label || s}
                    </button>
                ))}
            </div>

            {/* Orders table */}
            {orders.length === 0 ? (
                <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '3rem',
                    textAlign: 'center',
                    color: '#94a3b8',
                }}>
                    <ShoppingCart size={48} style={{ margin: '0 auto 1rem' }} />
                    <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>No orders yet</p>
                    <p>Online orders from your storefront will appear here.</p>
                </div>
            ) : (
                <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    overflow: 'hidden',
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>Order #</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>Customer</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>Status</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>Total</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order: any) => {
                                const sc = STATUS_COLORS[order.status] || { bg: '#f1f5f9', text: '#475569', label: order.status };
                                return (
                                    <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{order.order_number}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>{order.contact_name}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: sc.bg, color: sc.text }}>
                                                {sc.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>${order.total}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                                            {new Date(order.placed_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
