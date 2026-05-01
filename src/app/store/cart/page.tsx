'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { Trash2, Tag, ShoppingCart, ArrowRight, Minus, Plus } from 'lucide-react'
import { getCart, removeFromCart, updateCartQty, applyCoupon, CartOrder } from '@/app/actions/ecommerce/cart'

export default function CartPage() {
    const [cart, setCart] = useState<CartOrder | null>(null)
    const [loading, setLoading] = useState(true)
    const [coupon, setCoupon] = useState('')
    const [couponMsg, setCouponMsg] = useState('')
    const [isPending, startTransition] = useTransition()

    const loadCart = async () => {
        setLoading(true)
        const c = await getCart()
        setCart(c)
        setLoading(false)
    }

    useEffect(() => { loadCart() }, [])

    const handleRemove = (lineId: number) => {
        startTransition(async () => {
            await removeFromCart(lineId)
            await loadCart()
        })
    }

    const handleQty = (lineId: number, qty: number) => {
        if (qty < 1) return
        startTransition(async () => {
            await updateCartQty(lineId, qty)
            await loadCart()
        })
    }

    const handleCoupon = () => {
        if (!cart || !coupon.trim()) return
        startTransition(async () => {
            const res = await applyCoupon(cart.id, coupon.trim())
            if (res.ok) {
                setCouponMsg(`Coupon applied! Discount: ${parseFloat(res.discount ?? '0').toLocaleString()}`)
                await loadCart()
            } else {
                setCouponMsg(res.error ?? 'Invalid coupon')
            }
        })
    }

    const fmt = (v: string | number) => parseFloat(String(v)).toLocaleString(undefined, { minimumFractionDigits: 2 })

    if (loading) return (
        <div className="store-section store-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
            <p style={{ color: 'var(--app-faint)' }}>Loading cart…</p>
        </div>
    )

    if (!cart || !cart.lines?.length) return (
        <div className="store-section">
            <div className="store-container" style={{ textAlign: 'center', paddingTop: '3rem' }}>
                <ShoppingCart size={64} style={{ color: '#cbd5e1', margin: '0 auto 1rem' }} />
                <h2 style={{ fontWeight: 700, color: 'var(--app-surface-2)', marginBottom: '0.5rem' }}>Your cart is empty</h2>
                <p style={{ color: 'var(--app-faint)', marginBottom: '1.5rem' }}>Browse our catalog to find something you like.</p>
                <Link href="/store/catalog" className="store-btn store-btn-primary">Continue Shopping</Link>
            </div>
        </div>
    )

    return (
        <div className="store-section">
            <div className="store-container">
                <h1 className="store-section-title">Your Cart</h1>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', alignItems: 'start' }}>
                    {/* Line items */}
                    <div className="store-card" style={{ padding: 0, overflow: 'hidden' }}>
                        {cart.lines.map(line => (
                            <div key={line.id} style={{
                                display: 'grid', gridTemplateColumns: '56px 1fr auto',
                                gap: '1rem', alignItems: 'center',
                                padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9',
                            }}>
                                {/* Image */}
                                <div style={{ width: 56, height: 56, borderRadius: '0.5rem', background: 'var(--app-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                    {line.product_image
                                        ? <img src={line.product_image} alt={line.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <ShoppingCart size={20} style={{ color: '#cbd5e1' }} />}
                                </div>
                                {/* Name + price */}
                                <div>
                                    <p style={{ fontWeight: 600, color: 'var(--app-surface-2)', fontSize: '0.9375rem' }}>{line.product_name}</p>
                                    <p style={{ color: 'var(--app-faint)', fontSize: '0.8125rem' }}>{fmt(line.unit_price)} each</p>
                                </div>
                                {/* Qty + remove */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button onClick={() => handleQty(line.id, line.quantity - 1)} className="store-btn store-btn-ghost" style={{ padding: '0.25rem', borderRadius: '0.375rem' }}><Minus size={12} /></button>
                                        <span style={{ fontWeight: 700, minWidth: '1.5rem', textAlign: 'center' }}>{line.quantity}</span>
                                        <button onClick={() => handleQty(line.id, line.quantity + 1)} className="store-btn store-btn-ghost" style={{ padding: '0.25rem', borderRadius: '0.375rem' }}><Plus size={12} /></button>
                                    </div>
                                    <p style={{ fontWeight: 700, color: 'var(--store-accent, #10b981)', minWidth: '4rem', textAlign: 'right' }}>{fmt(line.line_total)}</p>
                                    <button onClick={() => handleRemove(line.id)} disabled={isPending}
                                        className="store-btn store-btn-ghost" style={{ padding: '0.375rem', color: 'var(--app-error)', borderRadius: '0.375rem' }}
                                        id={`remove-line-${line.id}`}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Order summary */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="store-card">
                            <h3 style={{ fontWeight: 700, color: 'var(--app-surface-2)', marginBottom: '1rem' }}>Order Summary</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9375rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--app-muted-foreground)' }}>Subtotal</span>
                                    <span style={{ fontWeight: 600 }}>{fmt(cart.subtotal)}</span>
                                </div>
                                {parseFloat(cart.discount_amount) > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                                        <span>Discount</span>
                                        <span style={{ fontWeight: 600 }}>−{fmt(cart.discount_amount)}</span>
                                    </div>
                                )}
                                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 700 }}>Total</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--store-accent, #10b981)' }}>{fmt(cart.total_amount)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Coupon */}
                        <div className="store-card">
                            <p style={{ fontWeight: 600, color: 'var(--app-surface-2)', marginBottom: '0.625rem', fontSize: '0.875rem' }}>
                                <Tag size={14} style={{ display: 'inline', marginRight: '0.375rem' }} />Coupon Code
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input id="coupon-input" className="store-input" value={coupon}
                                    onChange={e => setCoupon(e.target.value)} placeholder="Enter code"
                                    style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                                <button onClick={handleCoupon} disabled={isPending || !coupon.trim()}
                                    className="store-btn store-btn-primary" style={{ padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
                                    id="apply-coupon-btn">Apply</button>
                            </div>
                            {couponMsg && <p style={{ fontSize: '0.8125rem', color: couponMsg.includes('applied') ? '#059669' : '#dc2626', marginTop: '0.5rem' }}>{couponMsg}</p>}
                        </div>

                        <Link href={`/store/checkout?orderId=${cart.id}`} className="store-btn store-btn-primary"
                            style={{ textAlign: 'center', padding: '0.875rem', fontSize: '1rem' }} id="checkout-btn">
                            Checkout <ArrowRight size={16} />
                        </Link>
                        <Link href="/store/catalog" className="store-btn store-btn-ghost" style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                            Continue Shopping
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
