'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { erpFetch } from '@/lib/erp-api'
import { Package, ChevronRight, RefreshCw } from 'lucide-react'

const STATUS_CLASS: Record<string, string> = {
    CART: 'badge-placed', PLACED: 'badge-placed', CONFIRMED: 'badge-confirmed',
    PROCESSING: 'badge-processing', SHIPPED: 'badge-shipped', DELIVERED: 'badge-delivered',
    CANCELLED: 'badge-cancelled', RETURNED: 'badge-returned',
}

export default function OrderHistoryPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const load = async () => {
        setLoading(true)
        try {
            const data = await erpFetch('client-portal/my-orders/?ordering=-created_at&page_size=50')
            setOrders(Array.isArray(data) ? data : data?.results ?? [])
        } catch { }
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    const fmt = (v: string | number) => parseFloat(String(v)).toLocaleString(undefined, { minimumFractionDigits: 2 })

    return (
        <div className="store-section">
            <div className="store-container">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h1 className="store-section-title" style={{ margin: 0 }}>My Orders</h1>
                    <button onClick={load} className="store-btn store-btn-ghost" id="refresh-orders">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {loading && !orders.length && (
                    <p style={{ color: 'var(--app-faint)', textAlign: 'center', padding: '3rem 0' }}>Loading…</p>
                )}

                {!loading && orders.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                        <Package size={56} style={{ color: '#cbd5e1', margin: '0 auto 1rem' }} />
                        <p style={{ color: 'var(--app-faint)', marginBottom: '1rem' }}>You haven't placed any orders yet.</p>
                        <Link href="/store/catalog" className="store-btn store-btn-primary">Start Shopping</Link>
                    </div>
                )}

                {orders.filter(o => o.status !== 'CART').map(order => (
                    <div key={order.id} className="store-card" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, color: 'var(--app-surface-2)', fontSize: '0.9375rem' }}>
                                    #{order.order_number}
                                </span>
                                <span className={`store-badge ${STATUS_CLASS[order.status] ?? 'badge-placed'}`}>
                                    {order.status}
                                </span>
                            </div>
                            <p style={{ color: 'var(--app-faint)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                                {new Date(order.created_at).toLocaleDateString()} · {order.lines?.length ?? 0} item(s)
                            </p>
                        </div>
                        <p style={{ fontWeight: 700, color: 'var(--store-accent, #10b981)', flexShrink: 0 }}>
                            {fmt(order.total_amount)}
                        </p>
                        <Link href={`/store/account/orders/${order.id}`}
                            className="store-btn store-btn-ghost"
                            style={{ flexShrink: 0, padding: '0.5rem' }}
                            id={`order-detail-${order.id}`}>
                            <ChevronRight size={16} />
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    )
}
