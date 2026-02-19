'use client'

import { useState } from 'react'
import { usePortal } from '@/context/PortalContext'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2, MapPin, CreditCard, Wallet, Package, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function CheckoutPage() {
    const { slug } = useParams<{ slug: string }>()
    const router = useRouter()
    const { cart, cartTotal, isAuthenticated, token, clearCart, contact, config } = usePortal()

    const [step, setStep] = useState<'delivery' | 'payment' | 'confirm' | 'success'>('delivery')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [orderNumber, setOrderNumber] = useState('')

    // Delivery form
    const [address, setAddress] = useState('')
    const [phone, setPhone] = useState('')
    const [notes, setNotes] = useState('')

    // Payment
    const [paymentMethod, setPaymentMethod] = useState('WALLET')
    const [walletAmount, setWalletAmount] = useState(0)

    const formatPrice = (n: number) => `$${n.toFixed(2)}`

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-6">
                    <h1 className="text-3xl font-black text-white">Please Log In</h1>
                    <p className="text-slate-400">You must be logged in to checkout</p>
                    <Link href={`/tenant/${slug}`}
                        className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold">
                        <ArrowLeft size={18} /> Back to Store
                    </Link>
                </div>
            </div>
        )
    }

    if (cart.length === 0 && step !== 'success') {
        router.push(`/tenant/${slug}/cart`)
        return null
    }

    const handlePlaceOrder = async () => {
        setLoading(true)
        setError('')

        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'

        try {
            // Step 1: Create cart order
            const createRes = await fetch(`${djangoUrl}/api/client-portal/my-orders/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                },
                body: JSON.stringify({ status: 'CART' }),
            })
            const order = await createRes.json()
            if (!createRes.ok) throw new Error(order.error || 'Failed to create order')

            // Step 2: Add lines
            for (const item of cart) {
                await fetch(`${djangoUrl}/api/client-portal/my-orders/${order.id}/add_to_cart/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`,
                    },
                    body: JSON.stringify({
                        product: item.product_id,
                        product_name: item.product_name,
                        quantity: item.quantity,
                        unit_price: item.unit_price.toString(),
                        tax_rate: item.tax_rate.toString(),
                    }),
                })
            }

            // Step 3: Place order
            const placeRes = await fetch(`${djangoUrl}/api/client-portal/my-orders/${order.id}/place_order/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                },
                body: JSON.stringify({
                    delivery_address: address,
                    delivery_phone: phone,
                    delivery_notes: notes,
                    payment_method: paymentMethod,
                    wallet_amount: walletAmount,
                }),
            })
            const result = await placeRes.json()
            if (!placeRes.ok) throw new Error(result.error || 'Failed to place order')

            setOrderNumber(result.order_number)
            setStep('success')
            clearCart()
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    const steps = ['delivery', 'payment', 'confirm']

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-3xl mx-auto relative z-10 space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <Link href={`/tenant/${slug}/cart`}
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> Back to Cart
                    </Link>
                    <h1 className="text-4xl font-black text-white">Checkout</h1>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-4">
                    {steps.map((s, i) => (
                        <div key={s} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${steps.indexOf(step) >= i
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-white/5 text-slate-600'
                                }`}>
                                {i + 1}
                            </div>
                            <span className={`text-sm font-medium capitalize ${steps.indexOf(step) >= i ? 'text-white' : 'text-slate-600'
                                }`}>
                                {s}
                            </span>
                            {i < steps.length - 1 && (
                                <div className={`w-12 h-px ${steps.indexOf(step) > i ? 'bg-emerald-500' : 'bg-white/10'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}

                {/* Step: Delivery */}
                {step === 'delivery' && (
                    <div className="p-8 bg-slate-900/60 border border-white/5 rounded-3xl space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3">
                            <MapPin size={24} className="text-emerald-400" />
                            <h2 className="text-xl font-bold text-white">Delivery Details</h2>
                        </div>
                        <textarea
                            placeholder="Delivery Address"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700 resize-none"
                        />
                        <input
                            type="tel"
                            placeholder="Phone Number"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                        />
                        <textarea
                            placeholder="Delivery Notes (optional)"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700 resize-none"
                        />
                        <button onClick={() => setStep('payment')}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3">
                            Continue to Payment <ArrowRight size={20} />
                        </button>
                    </div>
                )}

                {/* Step: Payment */}
                {step === 'payment' && (
                    <div className="p-8 bg-slate-900/60 border border-white/5 rounded-3xl space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3">
                            <CreditCard size={24} className="text-blue-400" />
                            <h2 className="text-xl font-bold text-white">Payment Method</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                { id: 'WALLET', label: 'Digital Wallet', icon: Wallet, color: 'text-amber-400' },
                                { id: 'CASH', label: 'Cash on Delivery', icon: Package, color: 'text-emerald-400' },
                                { id: 'CARD', label: 'Credit / Debit Card', icon: CreditCard, color: 'text-blue-400' },
                            ].map(method => (
                                <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id)}
                                    className={`p-5 rounded-2xl border flex items-center gap-4 transition-all ${paymentMethod === method.id
                                            ? 'bg-white/10 border-emerald-500/50'
                                            : 'bg-white/5 border-white/5 hover:border-white/10'
                                        }`}>
                                    <method.icon size={22} className={method.color} />
                                    <span className="text-white font-semibold">{method.label}</span>
                                    {paymentMethod === method.id && (
                                        <CheckCircle2 size={20} className="text-emerald-400 ml-auto" />
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setStep('delivery')}
                                className="flex-1 bg-white/5 border border-white/10 text-white p-5 rounded-2xl font-bold transition-all hover:bg-white/10">
                                Back
                            </button>
                            <button onClick={() => setStep('confirm')}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3">
                                Review Order <ArrowRight size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Confirm */}
                {step === 'confirm' && (
                    <div className="p-8 bg-slate-900/60 border border-white/5 rounded-3xl space-y-6 animate-in fade-in duration-300">
                        <h2 className="text-xl font-bold text-white">Order Summary</h2>
                        <div className="space-y-3">
                            {cart.map(item => (
                                <div key={item.product_id} className="flex justify-between items-center">
                                    <div>
                                        <p className="text-white font-medium">{item.product_name}</p>
                                        <p className="text-slate-500 text-sm">× {item.quantity}</p>
                                    </div>
                                    <p className="text-white font-bold">{formatPrice(item.unit_price * item.quantity)}</p>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-white/5 pt-4 space-y-2">
                            {address && <p className="text-slate-400 text-sm"><span className="text-slate-500">Delivery:</span> {address}</p>}
                            <p className="text-slate-400 text-sm"><span className="text-slate-500">Payment:</span> {paymentMethod}</p>
                            <div className="flex justify-between pt-2">
                                <span className="text-white font-bold text-lg">Total</span>
                                <span className="text-emerald-400 font-black text-2xl">{formatPrice(cartTotal)}</span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setStep('payment')}
                                className="flex-1 bg-white/5 border border-white/10 text-white p-5 rounded-2xl font-bold transition-all hover:bg-white/10">
                                Back
                            </button>
                            <button onClick={handlePlaceOrder} disabled={loading}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 disabled:opacity-60 shadow-xl shadow-emerald-900/40">
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <>Place Order <CheckCircle2 size={20} /></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Success */}
                {step === 'success' && (
                    <div className="p-12 bg-slate-900/60 border border-emerald-500/20 rounded-3xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 size={48} className="text-emerald-400" />
                        </div>
                        <h2 className="text-3xl font-black text-white">Order Placed!</h2>
                        <p className="text-slate-400">Your order <span className="text-emerald-400 font-bold">{orderNumber}</span> has been submitted successfully.</p>
                        <div className="flex gap-3 justify-center">
                            <Link href={`/tenant/${slug}/account`}
                                className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-all">
                                View My Orders
                            </Link>
                            <Link href={`/tenant/${slug}`}
                                className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold hover:bg-white/10 transition-all">
                                Continue Shopping
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
