'use client'

import { useState, useEffect, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { trackOrder, requestReturn } from '@/app/actions/ecommerce/account'
import Link from 'next/link'
import { ArrowLeft, Package, Truck, CheckCircle, Clock, XCircle, RotateCcw } from 'lucide-react'

const STATUS_ICON: Record<string, any> = {
    PLACED: Clock, CONFIRMED: CheckCircle, PROCESSING: Package,
    SHIPPED: Truck, DELIVERED: CheckCircle, CANCELLED: XCircle, RETURNED: RotateCcw,
}

const STATUS_CLASS: Record<string, string> = {
    CART: 'badge-placed', PLACED: 'badge-placed', CONFIRMED: 'badge-confirmed',
    PROCESSING: 'badge-processing', SHIPPED: 'badge-shipped', DELIVERED: 'badge-delivered',
    CANCELLED: 'badge-cancelled', RETURNED: 'badge-returned',
}

export default function OrderDetailPage() {
    const params = useParams()
    const orderId = params.id as string
    const [order, setOrder] = useState<any>(null)
    const [tracking, setTracking] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [returnReason, setReturnReason] = useState('')
    const [returnMsg, setReturnMsg] = useState('')
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        async function load() {
            setLoading(true)
            const [orderData, trackData] = await Promise.all([
                erpFetch(`client-portal/my-orders/${orderId}/`).then(d => d).catch(() => null),
                trackOrder(+orderId).catch(() => null),
            ])
            setOrder(orderData)
            setTracking(trackData)
            setLoading(false)
        }
        load()
    }, [orderId])

    const handleReturn = () => {
        if (!returnReason.trim()) return
        startTransition(async () => {
            const res = await requestReturn(+orderId, returnReason)
            if (res.status === 'submitted') setReturnMsg('Return request submitted ✓')
            else setReturnMsg('Error: ' + (res.message ?? 'Failed'))
        })
    }

    const fmt = (v: string | number) => parseFloat(String(v)).toLocaleString(undefined, { minimumFractionDigits: 2 })

    if (loading) return <div className="store-section store-container" style={{ textAlign: 'center', paddingTop: '4rem' }}><p style={{ color: '#94a3b8' }}>Loading…</p></div>
    if (!order) return <div className="store-section store-container" style={{ textAlign: 'center', paddingTop: '4rem' }}><p style={{ color: '#dc2626' }}>Order not found.</p></div>

    const StatusIcon = STATUS_ICON[order.status] ?? Package

    return (
        <div className="store-section">
            <div className="store-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Link href="/store/account/orders" className="store-btn store-btn-ghost" style={{ padding: '0.5rem' }}><ArrowLeft size={16} /></Link>
                    <h1 className="store-section-title" style={{ margin: 0 }}>Order #{order.order_number}</h1>
                    <span className={`store-badge ${STATUS_CLASS[order.status] ?? 'badge-placed'}`}>{order.status}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Timeline */}
                        {tracking?.timeline?.length > 0 && (
                            <div className="store-card">
                                <h3 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>Tracking</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {tracking.timeline.map((step: any, i: number) => {
                                        const Icon = STATUS_ICON[step.status] ?? Clock
                                        const isCurrent = i === tracking.timeline.length - 1
                                        return (
                                            <div key={i} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: isCurrent ? 'var(--store-accent, #10b981)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Icon size={14} style={{ color: isCurrent ? '#fff' : '#94a3b8' }} />
                                                </div>
                                                <div>
                                                    <p style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9375rem' }}>{step.status}</p>
                                                    {step.note && <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>{step.note}</p>}
                                                    {step.timestamp && <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{new Date(step.timestamp).toLocaleString()}</p>}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Line items */}
                        <div className="store-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                                <h3 style={{ fontWeight: 700, color: '#1e293b' }}>Items</h3>
                            </div>
                            {(order.lines ?? []).map((line: any) => (
                                <div key={line.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 600, color: '#1e293b' }}>{line.product_name}</p>
                                        <p style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Qty: {line.quantity} × {fmt(line.unit_price)}</p>
                                    </div>
                                    <p style={{ fontWeight: 700, color: 'var(--store-accent, #10b981)' }}>{fmt(line.line_total)}</p>
                                </div>
                            ))}
                        </div>

                        {/* Return request */}
                        {order.status === 'DELIVERED' && !returnMsg && (
                            <div className="store-card">
                                <h3 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                                    <RotateCcw size={16} style={{ display: 'inline', marginRight: '0.375rem' }} />
                                    Request Return
                                </h3>
                                <textarea id="return-reason" className="store-input" rows={2}
                                    placeholder="Describe the reason for the return…"
                                    value={returnReason}
                                    onChange={e => setReturnReason(e.target.value)}
                                    style={{ marginBottom: '0.75rem' }} />
                                <button onClick={handleReturn} disabled={isPending || !returnReason.trim()}
                                    className="store-btn store-btn-outline" id="submit-return-btn">
                                    {isPending ? 'Submitting…' : 'Submit Return Request'}
                                </button>
                            </div>
                        )}
                        {returnMsg && (
                            <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.875rem 1rem', borderRadius: '0.75rem', fontWeight: 600 }}>
                                {returnMsg}
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="store-card" style={{ position: 'sticky', top: '80px' }}>
                        <h3 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>Summary</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9375rem' }}>
                            {[
                                ['Order Number', `#${order.order_number}`],
                                ['Date', new Date(order.created_at).toLocaleDateString()],
                                ['Subtotal', fmt(order.subtotal ?? order.total_amount)],
                                ...(parseFloat(order.discount_amount ?? '0') > 0 ? [['Discount', `−${fmt(order.discount_amount)}`]] : []),
                                ['Total', fmt(order.total_amount)],
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b' }}>{k}</span>
                                    <span style={{ fontWeight: k === 'Total' ? 800 : 600, color: k === 'Total' ? 'var(--store-accent, #10b981)' : '#1e293b' }}>{v}</span>
                                </div>
                            ))}
                        </div>
                        {order.delivery_address && (
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Delivery Address</p>
                                <p style={{ fontSize: '0.9375rem', color: '#475569' }}>{order.delivery_address}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
