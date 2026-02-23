'use client'

import Link from 'next/link'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, ArrowLeft } from 'lucide-react'
import { useCart } from '../../engine/hooks/useCart'
import { useConfig } from '../../engine/hooks/useConfig'

export default function BoutiqueCartPage() {
    const { cart, cartTotal, removeFromCart, updateQuantity, clearCart } = useCart()
    const { slug } = useConfig()
    const base = `/tenant/${slug}`

    if (cart.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6"
                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <div className="w-20 h-20 rounded-full bg-violet-50 flex items-center justify-center mb-6">
                    <ShoppingBag size={36} className="text-violet-300" />
                </div>
                <h2 className="text-2xl font-bold text-indigo-950 mb-2"
                    style={{ fontFamily: "'Playfair Display', serif" }}>
                    Your bag is empty
                </h2>
                <p className="text-gray-400 text-sm mb-6">Discover our curated collection and find something special.</p>
                <Link href={base}
                    className="px-6 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition shadow-lg shadow-violet-200">
                    Continue Shopping
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto px-6 py-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-indigo-950" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Shopping Bag
                </h1>
                <span className="text-sm text-gray-400">{cart.length} {cart.length === 1 ? 'item' : 'items'}</span>
            </div>

            <div className="space-y-4">
                {cart.map(item => {
                    const imgUrl = item.image_url?.startsWith('http')
                        ? item.image_url
                        : `${process.env.NEXT_PUBLIC_DJANGO_URL || ''}${item.image_url || ''}`

                    return (
                        <div key={item.product_id}
                            className="flex gap-5 p-5 bg-white rounded-2xl border border-violet-100 shadow-sm">
                            {/* Image */}
                            <div className="w-24 h-24 rounded-xl bg-violet-50 overflow-hidden flex-shrink-0">
                                {item.image_url ? (
                                    <img src={imgUrl} alt={item.product_name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ShoppingBag size={24} className="text-violet-200" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-indigo-950 truncate">{item.product_name}</h3>
                                <p className="text-violet-600 font-bold mt-1">${item.unit_price.toFixed(2)}</p>

                                <div className="flex items-center justify-between mt-3">
                                    <div className="flex items-center border border-violet-200 rounded-lg overflow-hidden">
                                        <button onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                                            className="px-2.5 py-1.5 text-gray-500 hover:bg-violet-50 transition">
                                            <Minus size={14} />
                                        </button>
                                        <span className="px-3 text-sm font-bold text-indigo-950">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                            className="px-2.5 py-1.5 text-gray-500 hover:bg-violet-50 transition">
                                            <Plus size={14} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-indigo-950">
                                            ${(item.unit_price * item.quantity).toFixed(2)}
                                        </span>
                                        <button onClick={() => removeFromCart(item.product_id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Summary */}
            <div className="mt-8 p-6 bg-white rounded-2xl border border-violet-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-500 text-sm">Subtotal</span>
                    <span className="text-xl font-bold text-indigo-950">${cartTotal.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400 mb-6">Shipping and taxes calculated at checkout</p>

                <div className="flex gap-3">
                    <Link href={`${base}/checkout`}
                        className="flex-1 py-4 bg-violet-600 text-white text-center rounded-2xl font-bold text-sm hover:bg-violet-700 transition shadow-lg shadow-violet-200 flex items-center justify-center gap-2">
                        Checkout <ArrowRight size={16} />
                    </Link>
                    <button onClick={clearCart}
                        className="px-5 py-4 border border-violet-200 text-gray-500 rounded-2xl text-sm font-medium hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition">
                        Clear
                    </button>
                </div>

                <Link href={base}
                    className="flex items-center justify-center gap-2 text-sm text-violet-600 font-medium mt-4 hover:underline">
                    <ArrowLeft size={14} /> Continue Shopping
                </Link>
            </div>
        </div>
    )
}
