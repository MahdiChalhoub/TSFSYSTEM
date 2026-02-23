'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useCart } from '../../engine/hooks/useCart'
import { useAuth } from '../../engine/hooks/useAuth'
import { useConfig } from '../../engine/hooks/useConfig'
import { CreditCard, Truck, Wallet, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { createOrder } from '@/app/tenant/[slug]/actions'
import { StripePayment } from '../../engine/components/StripePayment'

export default function BoutiqueCheckoutPage() {
    const router = useRouter()
    const params = useParams<{ slug: string }>()
    const { cart, cartTotal, clearCart } = useCart()
    const { user, isAuthenticated } = useAuth()
    const { config } = useConfig()
    const base = `/tenant/${params?.slug}`

    const [form, setForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: '',
        address: '',
        city: '',
        notes: '',
        paymentMethod: 'cash',
    })
    const [submitting, setSubmitting] = useState(false)
    const [orderPlaced, setOrderPlaced] = useState(false)
    const [orderId, setOrderId] = useState('')
    const [stripeClientSecret, setStripeClientSecret] = useState('')
    const [error, setError] = useState('')

    const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (cart.length === 0) return
        setSubmitting(true)
        setError('')

        try {
            const token = localStorage.getItem('portal_session')
            const parsed = token ? JSON.parse(token) : null
            const authToken = parsed?.token

            if (!authToken) {
                setError('Session expired. Please sign in again.')
                setSubmitting(false)
                return
            }

            const result = await createOrder(authToken, {
                lines: cart.map(i => ({
                    product_id: i.product_id,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                })),
                delivery_address: form.address ? `${form.address}, ${form.city}` : undefined,
                notes: form.notes || undefined,
                payment_method: form.paymentMethod.toUpperCase(),
                contact_phone: form.phone || undefined,
                status: 'PLACED'
            })

            if (result.success) {
                setOrderId(result.data?.order_number || result.data?.id || 'NEW')
                if (result.data?.stripe_client_secret) {
                    setStripeClientSecret(result.data.stripe_client_secret)
                } else {
                    clearCart()
                    setOrderPlaced(true)
                }
            } else {
                setError(result.error || 'Failed to place order')
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
        } finally {
            setSubmitting(false)
        }
    }

    const handleStripeSuccess = () => {
        clearCart()
        setStripeClientSecret('')
        setOrderPlaced(true)
    }

    if (orderPlaced) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6"
                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-6">
                    <CheckCircle2 size={40} className="text-green-500" />
                </div>
                <h2 className="text-3xl font-bold text-indigo-950 mb-3"
                    style={{ fontFamily: "'Playfair Display', serif" }}>
                    Thank You!
                </h2>
                <p className="text-gray-500 text-sm mb-1 max-w-sm">
                    Your order has been placed successfully. We&apos;ll send you a confirmation soon.
                </p>
                {orderId && <p className="text-xs text-gray-400 font-mono mb-6">Order #{orderId}</p>}
                <Link href={base}
                    className="px-6 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition">
                    Continue Shopping
                </Link>
            </div>
        )
    }

    if (stripeClientSecret) {
        return (
            <div className="max-w-xl mx-auto px-6 py-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <div className="bg-white rounded-3xl border border-violet-100 p-8 shadow-xl space-y-6">
                    <div className="text-center space-y-2 mb-4">
                        <CreditCard size={40} className="text-violet-600 mx-auto" />
                        <h2 className="text-2xl font-bold text-indigo-950" style={{ fontFamily: "'Playfair Display', serif" }}>
                            Secure Payment
                        </h2>
                        <p className="text-gray-400 text-sm">Order #{orderId}</p>
                    </div>

                    <div className="flex justify-between items-center py-4 border-y border-violet-50 mb-6">
                        <span className="text-gray-500 text-sm">Amount to Pay</span>
                        <span className="text-2xl font-bold text-violet-600">${cartTotal.toFixed(2)}</span>
                    </div>

                    <div className="p-1">
                        <StripePayment
                            clientSecret={stripeClientSecret}
                            publishableKey={config?.stripe_publishable_key || ''}
                            onSuccess={handleStripeSuccess}
                            onError={(e) => setError(e)}
                        />
                    </div>

                    <button
                        onClick={() => setStripeClientSecret('')}
                        className="w-full text-gray-400 text-xs font-bold hover:text-indigo-950 transition-colors py-2"
                    >
                        Back to Billing Details
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-6 py-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Link href={`${base}/cart`}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-violet-600 mb-8 font-medium transition">
                <ArrowLeft size={16} /> Back to Cart
            </Link>

            <h1 className="text-3xl font-bold text-indigo-950 mb-10" style={{ fontFamily: "'Playfair Display', serif" }}>
                Checkout
            </h1>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                {/* Form */}
                <div className="lg:col-span-3 space-y-8">
                    {/* Contact */}
                    <section className="bg-white rounded-2xl border border-violet-100 p-6 shadow-sm">
                        <h3 className="font-bold text-indigo-950 mb-4 flex items-center gap-2">
                            <Truck size={18} className="text-violet-500" /> Delivery Details
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { k: 'name', label: 'Full Name', type: 'text', req: true },
                                { k: 'email', label: 'Email', type: 'email', req: true },
                                { k: 'phone', label: 'Phone', type: 'tel', req: false },
                                { k: 'city', label: 'City', type: 'text', req: false },
                            ].map(f => (
                                <div key={f.k}>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                        {f.label} {f.req && <span className="text-pink-500">*</span>}
                                    </label>
                                    <input
                                        type={f.type}
                                        required={f.req}
                                        value={(form as any)[f.k]}
                                        onChange={e => update(f.k, e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-violet-200 bg-violet-50/30 text-indigo-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 text-sm"
                                    />
                                </div>
                            ))}
                            <div className="sm:col-span-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Address</label>
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={e => update('address', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-violet-200 bg-violet-50/30 text-indigo-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 text-sm"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Notes</label>
                                <textarea
                                    rows={3}
                                    value={form.notes}
                                    onChange={e => update('notes', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-violet-200 bg-violet-50/30 text-indigo-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 text-sm resize-none"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Payment */}
                    <section className="bg-white rounded-2xl border border-violet-100 p-6 shadow-sm">
                        <h3 className="font-bold text-indigo-950 mb-4 flex items-center gap-2">
                            <CreditCard size={18} className="text-violet-500" /> Payment Method
                        </h3>
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">
                                {error}
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { id: 'cash', label: 'Cash', icon: Wallet },
                                { id: 'card', label: 'Card', icon: CreditCard },
                                { id: 'wallet', label: 'Wallet', icon: Wallet },
                            ].map(m => (
                                <button key={m.id} type="button"
                                    onClick={() => update('paymentMethod', m.id)}
                                    className={`p-4 rounded-xl border-2 text-sm font-semibold transition flex items-center gap-2 justify-center ${form.paymentMethod === m.id
                                        ? 'border-violet-500 bg-violet-50 text-violet-600'
                                        : 'border-violet-100 text-gray-500 hover:border-violet-300'
                                        }`}>
                                    <m.icon size={18} /> {m.label}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Summary */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-violet-100 p-6 shadow-sm sticky top-24">
                        <h3 className="font-bold text-indigo-950 mb-4">Order Summary</h3>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {cart.map(item => (
                                <div key={item.product_id} className="flex justify-between text-sm">
                                    <span className="text-gray-600 truncate max-w-[60%]">
                                        {item.product_name} × {item.quantity}
                                    </span>
                                    <span className="text-indigo-950 font-medium">
                                        ${(item.unit_price * item.quantity).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <hr className="my-4 border-violet-100" />

                        <div className="flex justify-between items-center mb-6">
                            <span className="font-bold text-indigo-950">Total</span>
                            <span className="text-2xl font-bold text-violet-600">${cartTotal.toFixed(2)}</span>
                        </div>

                        <button type="submit" disabled={submitting || cart.length === 0}
                            className="w-full py-4 bg-violet-600 text-white rounded-2xl font-bold text-sm hover:bg-violet-700 transition shadow-lg shadow-violet-200 flex items-center justify-center gap-2 disabled:opacity-50">
                            <Lock size={16} />
                            {submitting ? 'Processing...' : 'Place Order'}
                        </button>

                        <p className="text-[10px] text-gray-400 text-center mt-3">
                            Your payment information is secure and encrypted
                        </p>
                    </div>
                </div>
            </form>
        </div>
    )
}
