'use client'

import { usePortal, CartItem } from '@/context/PortalContext'
import { useParams, useRouter } from 'next/navigation'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, ArrowLeft, Package } from 'lucide-react'
import Link from 'next/link'

export default function CartPage() {
    const { slug } = useParams<{ slug: string }>()
    const router = useRouter()
    const { cart, cartTotal, isAuthenticated, removeFromCart, updateCartQuantity, clearCart, config } = usePortal()

    const formatPrice = (n: number) => `$${n.toFixed(2)}`

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            {/* Ambient Background */}
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Link href={`/tenant/${slug}`}
                            className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                            <ArrowLeft size={16} /> Back to Store
                        </Link>
                        <h1 className="text-4xl font-black text-white">Shopping Cart</h1>
                    </div>
                    {cart.length > 0 && (
                        <button onClick={clearCart}
                            className="text-red-400 hover:text-red-300 text-sm font-bold flex items-center gap-2 transition-colors">
                            <Trash2 size={16} /> Clear All
                        </button>
                    )}
                </div>

                {/* Empty State */}
                {cart.length === 0 ? (
                    <div className="py-24 text-center space-y-6">
                        <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mx-auto text-slate-600">
                            <ShoppingBag size={40} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Your cart is empty</h2>
                            <p className="text-slate-500 mt-2">Browse the catalog and add products to get started</p>
                        </div>
                        <Link href={`/tenant/${slug}`}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-all">
                            <Package size={18} /> Browse Products
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Cart Items */}
                        {cart.map((item: CartItem) => (
                            <div key={item.product_id}
                                className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex items-center gap-6 group hover:border-white/10 transition-all">
                                {/* Product Image Placeholder */}
                                <div className="w-20 h-20 bg-white/5 rounded-xl flex items-center justify-center text-slate-600 shrink-0">
                                    <Package size={32} />
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-bold text-lg truncate">{item.product_name}</h3>
                                    <p className="text-emerald-400 font-bold">{formatPrice(item.unit_price)}</p>
                                    {item.tax_rate > 0 && (
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Tax: {item.tax_rate}%</p>
                                    )}
                                </div>

                                {/* Quantity Controls */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                                        className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all">
                                        <Minus size={16} />
                                    </button>
                                    <span className="text-white font-bold text-lg w-8 text-center">{item.quantity}</span>
                                    <button
                                        onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                                        className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all">
                                        <Plus size={16} />
                                    </button>
                                </div>

                                {/* Line Total */}
                                <div className="text-right min-w-[80px]">
                                    <p className="text-white font-black text-lg">{formatPrice(item.unit_price * item.quantity)}</p>
                                </div>

                                {/* Remove */}
                                <button
                                    onClick={() => removeFromCart(item.product_id)}
                                    className="text-slate-600 hover:text-red-400 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}

                        {/* Summary */}
                        <div className="p-8 bg-slate-900/80 border border-white/5 rounded-3xl space-y-4 mt-8">
                            <div className="flex justify-between text-slate-400 text-sm">
                                <span>Subtotal ({cart.length} items)</span>
                                <span className="text-white font-bold">{formatPrice(cartTotal)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400 text-sm">
                                <span>Delivery</span>
                                <span className="text-slate-500">Calculated at checkout</span>
                            </div>
                            <div className="border-t border-white/5 pt-4 flex justify-between">
                                <span className="text-white font-bold text-lg">Estimated Total</span>
                                <span className="text-emerald-400 font-black text-2xl">{formatPrice(cartTotal)}</span>
                            </div>

                            {!isAuthenticated ? (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm font-medium text-center">
                                    Please log in from the store page to proceed to checkout
                                </div>
                            ) : (
                                <button
                                    onClick={() => router.push(`/tenant/${slug}/checkout`)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3">
                                    Proceed to Checkout <ArrowRight size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
