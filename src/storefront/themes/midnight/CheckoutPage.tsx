'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, MapPin, CreditCard, Wallet, Package, ArrowRight } from 'lucide-react'
import { useCart } from '../../engine/hooks/useCart'
import { useAuth } from '../../engine/hooks/useAuth'
import { useConfig } from '../../engine/hooks/useConfig'
import { createOrder } from '@/app/tenant/[slug]/actions'
import { StripePayment } from '../../engine/components/StripePayment'

export default function MidnightCheckoutPage() {
    const { slug } = useParams<{ slug: string }>()
    const router = useRouter()
    const { cart, cartTotal, clearCart } = useCart()
    const { user, isAuthenticated } = useAuth()
    const { config } = useConfig()

    const [step, setStep] = useState<'details' | 'review' | 'complete'>('details')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [orderId, setOrderId] = useState('')
    const [stripeClientSecret, setStripeClientSecret] = useState('')

    // Form
    const [form, setForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: '',
        address: '',
        city: '',
        notes: '',
        paymentMethod: 'cash',
    })

    const formatPrice = (n: number) => `$${n.toFixed(2)}`

    if (!isAuthenticated) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-6">
                    <CreditCard size={32} className="text-slate-600" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Sign in to checkout</h2>
                <p className="text-sm text-slate-500 mb-8">You need to be signed in to place an order</p>
                <Link href={`/tenant/${slug}/register`}
                    className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/30">
                    Sign In
                </Link>
            </div>
        )
    }

    if (cart.length === 0 && step !== 'complete' && !stripeClientSecret) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
                <Package size={48} className="text-slate-700 mb-4" />
                <h2 className="text-xl font-black text-white mb-2">Your cart is empty</h2>
                <Link href={`/tenant/${slug}`} className="text-emerald-400 text-sm hover:underline">Browse products</Link>
            </div>
        )
    }

    const handlePlaceOrder = async () => {
        setLoading(true)
        setError('')
        try {
            const token = localStorage.getItem('portal_session')
            const parsed = token ? JSON.parse(token) : null
            const authToken = parsed?.token

            if (!authToken) {
                setError('Session expired. Please sign in again.')
                setLoading(false)
                return
            }

            const result = await createOrder(authToken, {
                status: 'PLACED',
                currency: 'USD',
                lines: cart.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                })),
                delivery_address: form.address ? `${form.address}, ${form.city}` : undefined,
                delivery_notes: form.notes || undefined,
                payment_method: form.paymentMethod.toUpperCase(),
                delivery_phone: form.phone || undefined,
            })

            if (result.success) {
                setOrderId(result.data?.order_number || result.data?.id || 'NEW')
                if (result.data?.stripe_client_secret) {
                    setStripeClientSecret(result.data.stripe_client_secret)
                } else {
                    clearCart()
                    setStep('complete')
                }
            } else {
                setError(result.error || 'Failed to place order')
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    const handleStripeSuccess = () => {
        clearCart()
        setStripeClientSecret('')
        setStep('complete')
    }

    if (step === 'complete') {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
                {/* Celebration background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />

                <div className="relative z-10 space-y-8 animate-in fade-in zoom-in duration-700">
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40 rotate-12 hover:rotate-0 transition-transform duration-500">
                        <CheckCircle2 size={48} className="text-white" />
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter">Order Success!</h2>
                        <p className="text-slate-400 max-w-sm mx-auto">
                            Your order has been placed in our secure ledger and is currently being processed by the tenant.
                        </p>
                    </div>

                    <div className="bg-slate-950/80 border border-white/5 rounded-3xl p-6 backdrop-blur-xl inline-block min-w-[300px]">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 text-center">Reference Identification</p>
                        <div className="bg-white/5 rounded-xl py-3 px-6 flex items-center justify-center gap-3">
                            <span className="text-white font-mono font-bold tracking-widest">{orderId}</span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                        <Link href={`/tenant/${slug}/account/orders`}
                            className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all hover:scale-105">
                            Track Order
                        </Link>
                        <Link href={`/tenant/${slug}`}
                            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/40 hover:scale-105">
                            Back to Store
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (stripeClientSecret) {
        return (
            <div className="max-w-xl mx-auto px-4 py-8">
                <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-8 space-y-6">
                    <div className="text-center space-y-2 mb-4">
                        <CreditCard size={40} className="text-emerald-500 mx-auto" />
                        <h2 className="text-2xl font-black text-white">Secure Payment</h2>
                        <p className="text-slate-400 text-sm">Order #{orderId}</p>
                    </div>

                    <div className="flex justify-between items-center py-4 border-y border-white/5 mb-6">
                        <span className="text-slate-400 text-sm">Amount to Pay</span>
                        <span className="text-2xl font-black text-white">${cartTotal.toFixed(2)}</span>
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
                        className="w-full text-slate-500 text-xs font-bold hover:text-white transition-colors py-2"
                    >
                        Back to Billing Details
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-xs text-slate-500 hover:text-white mb-4 transition-colors">
                <ArrowLeft size={14} /> Back to Cart
            </button>
            {/* Progress Indicator */}
            <div className="flex gap-2 mb-8">
                {['Info', 'Review', 'Payment'].map((s, i) => (
                    <div key={s} className="flex-1 flex flex-col gap-2">
                        <div className={`h-1 rounded-full transition-colors duration-500 ${i === 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/5'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${i === 0 ? 'text-emerald-500' : 'text-slate-700'}`}>{s}</span>
                    </div>
                ))}
            </div>

            <h1 className="text-4xl font-black text-white tracking-tighter mb-8 uppercase italic">Secure Checkout</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Delivery Info */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin size={16} className="text-emerald-400" />
                            <h3 className="text-sm font-bold text-white">Delivery Information</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Full Name</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/30" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Email</label>
                                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/30" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Phone</label>
                                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Optional"
                                    className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/30 placeholder:text-slate-800" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">City</label>
                                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Optional"
                                    className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/30 placeholder:text-slate-800" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Address</label>
                            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Delivery address (optional)"
                                className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/30 placeholder:text-slate-800" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Order Notes</label>
                            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Special instructions..."
                                rows={2}
                                className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/30 placeholder:text-slate-800 resize-none" />
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <CreditCard size={16} className="text-indigo-400" />
                            <h3 className="text-sm font-bold text-white">Payment Method</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'cash', label: 'Cash on Delivery', icon: Wallet },
                                { id: 'card', label: 'Credit Card', icon: CreditCard },
                            ].map(method => (
                                <button key={method.id}
                                    onClick={() => setForm({ ...form, paymentMethod: method.id })}
                                    className={`p-4 rounded-xl border text-left transition-all flex items-center gap-3
                                        ${form.paymentMethod === method.id
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                            : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10'
                                        }`}>
                                    <method.icon size={18} />
                                    <span className="text-xs font-bold">{method.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="space-y-4">
                    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 space-y-4 sticky top-24">
                        <h3 className="text-sm font-bold text-white">Order Summary</h3>
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                            {cart.map(item => (
                                <div key={item.product_id} className="flex justify-between text-xs">
                                    <span className="text-slate-400 truncate mr-2">{item.product_name} × {item.quantity}</span>
                                    <span className="text-white font-bold shrink-0">{formatPrice(item.unit_price * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3 pt-4 border-t border-white/5">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Subtotal</span>
                                <span className="text-slate-300 font-mono">${cartTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Shipping</span>
                                <span className="text-emerald-500 font-bold uppercase tracking-widest text-[9px]">Calculated Live: Free</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Dynamic Tax (VAT)</span>
                                <span className="text-slate-300 font-mono italic">Included</span>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-between items-end">
                            <span className="text-white font-black uppercase text-xs tracking-widest mb-1">Total Due</span>
                            <span className="text-3xl font-black text-white">
                                <span className="text-emerald-500 mr-1">$</span>{cartTotal.toFixed(2)}
                            </span>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{error}</div>
                        )}

                        <button
                            onClick={handlePlaceOrder}
                            disabled={loading}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm uppercase tracking-wider hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? (
                                <><Loader2 size={18} className="animate-spin" /> Processing...</>
                            ) : (
                                <>Place Order <ArrowRight size={16} /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
