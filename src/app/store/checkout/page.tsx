'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getCart, placeOrder, getShippingRatesForZone, CartOrder } from '@/app/actions/ecommerce/cart'
import { getDeliveryZones } from '@/app/actions/ecommerce/shipping'
import { CheckCircle, Truck, CreditCard, Wallet } from 'lucide-react'

const PAYMENT_METHODS = [
    { value: 'CARD', label: 'Credit/Debit Card', icon: CreditCard, desc: 'Pay securely online' },
    { value: 'CASH_ON_DELIVERY', label: 'Cash on Delivery', icon: Truck, desc: 'Pay when you receive' },
    { value: 'WALLET', label: 'Wallet Balance', icon: Wallet, desc: 'Use your loyalty wallet' },
]

export default function CheckoutPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const orderId = searchParams.get('orderId')

    const [cart, setCart] = useState<CartOrder | null>(null)
    const [zones, setZones] = useState<any[]>([])
    const [shippingOptions, setShippingOptions] = useState<any[]>([])
    const [form, setForm] = useState({
        delivery_address: '',
        delivery_phone: '',
        delivery_notes: '',
        payment_method: 'CARD',
        shipping_zone_id: '',
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [isPending, startTransition] = useTransition()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const [c, z] = await Promise.all([getCart(), getDeliveryZones()])
            setCart(c)
            setZones(z)
            setLoading(false)
        }
        load()
    }, [])

    useEffect(() => {
        if (!form.shipping_zone_id) return
        getShippingRatesForZone(+form.shipping_zone_id).then(setShippingOptions)
    }, [form.shipping_zone_id])

    const fmt = (v: string | number) => parseFloat(String(v)).toLocaleString(undefined, { minimumFractionDigits: 2 })

    const handleSubmit = () => {
        if (!cart || !orderId) return
        if (!form.delivery_address.trim()) { setError('Delivery address is required'); return }
        if (!form.delivery_phone.trim()) { setError('Phone number is required'); return }
        setError('')
        startTransition(async () => {
            const res = await placeOrder(Number(orderId), {
                ...form,
                shipping_zone_id: form.shipping_zone_id ? +form.shipping_zone_id : undefined,
            })
            if (!res.ok) { setError(res.error ?? 'Failed to place order'); return }
            if (res.payment_url) {
                window.location.href = res.payment_url
            } else {
                setSuccess(`Order ${res.order_number} placed successfully!`)
                setTimeout(() => router.push('/store/account/orders'), 2000)
            }
        })
    }

    if (loading) return <div className="store-section store-container" style={{ textAlign: 'center', paddingTop: '4rem' }}><p style={{ color: 'var(--app-faint)' }}>Loading…</p></div>

    if (success) return (
        <div className="store-section">
            <div className="store-container" style={{ textAlign: 'center', paddingTop: '3rem' }}>
                <CheckCircle size={64} style={{ color: 'var(--app-primary)', margin: '0 auto 1rem' }} />
                <h2 style={{ fontWeight: 800, color: 'var(--app-surface-2)', marginBottom: '0.5rem' }}>{success}</h2>
                <p style={{ color: 'var(--app-muted-foreground)' }}>Redirecting to your orders…</p>
            </div>
        </div>
    )

    return (
        <div className="store-section">
            <div className="store-container">
                <h1 className="store-section-title">Checkout</h1>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '0.625rem', fontSize: '0.9375rem' }}>{error}</div>}

                        {/* Delivery Details */}
                        <div className="store-card">
                            <h3 style={{ fontWeight: 700, color: 'var(--app-surface-2)', marginBottom: '1rem' }}>Delivery Details</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                <div>
                                    <label className="store-label">Full Delivery Address *</label>
                                    <textarea id="checkout-address" className="store-input" rows={2}
                                        value={form.delivery_address}
                                        onChange={e => setForm(p => ({ ...p, delivery_address: e.target.value }))}
                                        placeholder="Street, City, Postal Code" />
                                </div>
                                <div>
                                    <label className="store-label">Phone Number *</label>
                                    <input id="checkout-phone" className="store-input" type="tel"
                                        value={form.delivery_phone}
                                        onChange={e => setForm(p => ({ ...p, delivery_phone: e.target.value }))}
                                        placeholder="+1 555 000 0000" />
                                </div>
                                <div>
                                    <label className="store-label">Delivery Notes (optional)</label>
                                    <input id="checkout-notes" className="store-input"
                                        value={form.delivery_notes}
                                        onChange={e => setForm(p => ({ ...p, delivery_notes: e.target.value }))}
                                        placeholder="Leave at door, call on arrival, etc." />
                                </div>
                            </div>
                        </div>

                        {/* Delivery Zone */}
                        {zones.length > 0 && (
                            <div className="store-card">
                                <h3 style={{ fontWeight: 700, color: 'var(--app-surface-2)', marginBottom: '1rem' }}>Delivery Zone</h3>
                                <select id="checkout-zone" className="store-input"
                                    value={form.shipping_zone_id}
                                    onChange={e => setForm(p => ({ ...p, shipping_zone_id: e.target.value }))}>
                                    <option value="">Select your zone</option>
                                    {zones.map(z => (
                                        <option key={z.id} value={z.id}>
                                            {z.name} — {z.estimated_days}d delivery
                                        </option>
                                    ))}
                                </select>
                                {shippingOptions.length > 0 && (
                                    <div style={{ marginTop: '0.75rem' }}>
                                        {shippingOptions.map((opt: any, i) => (
                                            <div key={i} style={{ fontSize: '0.875rem', color: '#475569', padding: '0.25rem 0' }}>
                                                <Truck size={12} style={{ display: 'inline', marginRight: '0.375rem' }} />
                                                {parseFloat(opt.fee) === 0 ? 'Free shipping' : `${fmt(opt.fee)} shipping`}
                                                {opt.estimated_days && ` · ${opt.estimated_days}d`}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Payment Method */}
                        <div className="store-card">
                            <h3 style={{ fontWeight: 700, color: 'var(--app-surface-2)', marginBottom: '1rem' }}>Payment Method</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {PAYMENT_METHODS.map(m => {
                                    const Icon = m.icon
                                    const selected = form.payment_method === m.value
                                    return (
                                        <button key={m.value} onClick={() => setForm(p => ({ ...p, payment_method: m.value }))}
                                            id={`pay-${m.value}`}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.875rem', borderRadius: '0.75rem', border: `2px solid ${selected ? 'var(--store-accent, #10b981)' : 'var(--app-border)'}`,
                                                background: selected ? 'rgba(16,185,129,0.05)' : '#fff',
                                                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                                            }}>
                                            <Icon size={20} style={{ color: selected ? 'var(--store-accent, #10b981)' : 'var(--app-faint)', flexShrink: 0 }} />
                                            <div>
                                                <p style={{ fontWeight: 600, color: 'var(--app-surface-2)', fontSize: '0.9375rem' }}>{m.label}</p>
                                                <p style={{ color: 'var(--app-faint)', fontSize: '0.8125rem' }}>{m.desc}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Summary sidebar */}
                    {cart && (
                        <div className="store-card" style={{ position: 'sticky', top: '80px' }}>
                            <h3 style={{ fontWeight: 700, color: 'var(--app-surface-2)', marginBottom: '1rem' }}>Order Summary</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9375rem' }}>
                                {cart.lines?.map(l => (
                                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--app-muted-foreground)' }}>
                                        <span>{l.product_name} ×{l.quantity}</span>
                                        <span style={{ fontWeight: 600 }}>{fmt(l.line_total)}</span>
                                    </div>
                                ))}
                                {parseFloat(cart.discount_amount) > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                                        <span>Discount</span>
                                        <span style={{ fontWeight: 600 }}>−{fmt(cart.discount_amount)}</span>
                                    </div>
                                )}
                                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 700 }}>Total</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--store-accent, #10b981)' }}>{fmt(cart.total_amount)}</span>
                                </div>
                            </div>
                            <button onClick={handleSubmit} disabled={isPending}
                                className="store-btn store-btn-primary"
                                style={{ width: '100%', marginTop: '1.25rem', padding: '0.875rem', fontSize: '1rem' }}
                                id="place-order-btn">
                                {isPending ? 'Placing Order…' : 'Place Order'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
