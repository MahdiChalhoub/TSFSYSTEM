'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, ArrowLeft, Package } from 'lucide-react'
import { useCart } from '../../engine/hooks/useCart'
import { useConfig } from '../../engine/hooks/useConfig'

export default function MidnightCartPage() {
    const { slug } = useParams<{ slug: string }>()
    const router = useRouter()
    const { cart, cartTotal, cartCount, removeFromCart, updateQuantity, clearCart } = useCart()
    const { config } = useConfig()

    const formatPrice = (n: number) => `$${n.toFixed(2)}`

    if (cart.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-6">
                    <ShoppingBag size={32} className="text-slate-600" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Your cart is empty</h2>
                <p className="text-sm text-slate-500 mb-8">Browse our collection and add items to your cart</p>
                <Link href={`/tenant/${slug}`}
                    className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/30">
                    Browse Products
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-xs text-slate-500 hover:text-white mb-2 transition-colors">
                        <ArrowLeft size={14} /> Continue Shopping
                    </button>
                    <h1 className="text-3xl font-black text-white tracking-tight">Shopping Cart</h1>
                    <p className="text-xs text-slate-500 mt-1">{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={clearCart} className="px-4 py-2 text-xs text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-all font-bold">
                    Clear Cart
                </button>
            </div>

            {/* Items */}
            <div className="space-y-4">
                {cart.map(item => (
                    <div key={item.product_id} className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 flex items-center gap-6">
                        {/* Image */}
                        <div className="w-20 h-20 bg-slate-950 rounded-xl overflow-hidden shrink-0">
                            {item.image_url ? (
                                <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Package size={24} className="text-slate-800" />
                                </div>
                            )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-white truncate">{item.product_name}</h3>
                            <p className="text-xs text-slate-500 mt-1">{formatPrice(item.unit_price)} each</p>
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl">
                            <button onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                                className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/5 rounded-l-xl transition-colors">
                                <Minus size={12} />
                            </button>
                            <span className="w-10 text-center text-white font-bold text-xs">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/5 rounded-r-xl transition-colors">
                                <Plus size={12} />
                            </button>
                        </div>

                        {/* Line Total */}
                        <div className="text-right shrink-0">
                            <p className="text-sm font-black text-white">{formatPrice(item.unit_price * item.quantity)}</p>
                        </div>

                        {/* Remove */}
                        <button onClick={() => removeFromCart(item.product_id)}
                            className="w-9 h-9 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Summary */}
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-8 space-y-4">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="text-white font-bold">{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Shipping</span>
                    <span className="text-emerald-400 font-bold">Calculated at checkout</span>
                </div>
                <div className="border-t border-white/5 pt-4 flex justify-between">
                    <span className="text-white font-bold">Total</span>
                    <span className="text-2xl font-black text-white">
                        <span className="text-emerald-500 mr-1">$</span>{cartTotal.toFixed(2)}
                    </span>
                </div>
                <Link href={`/tenant/${slug}/checkout`}
                    className="block w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm uppercase tracking-wider text-center hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/30 mt-4">
                    Proceed to Checkout <ArrowRight size={16} className="inline ml-2" />
                </Link>
            </div>
        </div>
    )
}
