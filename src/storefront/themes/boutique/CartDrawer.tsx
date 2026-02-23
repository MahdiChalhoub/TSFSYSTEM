'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Minus, Plus, ShoppingBag, ArrowRight, Package, Trash2, Heart } from 'lucide-react'
import { usePortal } from '@/context/PortalContext'

export default function BoutiqueCartDrawer() {
    const { slug } = useParams<{ slug: string }>()
    const router = useRouter()
    const {
        cart, cartTotal, isCartOpen, setCartOpen,
        removeFromCart, updateCartQuantity
    } = usePortal()

    if (!isCartOpen) return null

    const formatPrice = (n: number) => `$${n.toFixed(2)}`

    return (
        <div className="fixed inset-0 z-[100] flex justify-end font-serif">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-violet-900/20 backdrop-blur-[4px] animate-in fade-in duration-500"
                onClick={() => setCartOpen(false)}
            />

            {/* Panel */}
            <div className="relative w-full max-w-md bg-[#faf5ff] h-full shadow-[0_0_50px_rgba(139,92,246,0.15)] flex flex-col animate-in slide-in-from-right duration-700">
                {/* Header */}
                <div className="p-8 border-b border-violet-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-light text-violet-950 italic tracking-tight">Your Selection</h2>
                        <p className="text-[10px] text-violet-400 uppercase font-medium tracking-[0.2em] mt-1 font-sans">
                            {cart.length} exquisite item{cart.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={() => setCartOpen(false)}
                        className="p-3 hover:bg-violet-100/50 rounded-full transition-all text-violet-300 hover:text-violet-600 border border-transparent hover:border-violet-100"
                    >
                        <X size={20} strokeWidth={1} />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar font-sans">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-violet-50">
                                <ShoppingBag size={18} className="text-violet-200" />
                            </div>
                            <h3 className="text-violet-950 font-light text-xl italic">The bag is empty</h3>
                            <p className="text-violet-400 text-sm mt-2 max-w-[200px] leading-relaxed">Discover our curated series of premium pieces.</p>
                            <button
                                onClick={() => setCartOpen(false)}
                                className="mt-8 px-10 py-3 bg-violet-600 text-white rounded-full text-[11px] font-bold uppercase tracking-[0.3em] hover:bg-violet-700 transition-all shadow-lg shadow-violet-200"
                            >
                                Shop Trends
                            </button>
                        </div>
                    ) : (
                        cart.map(item => {
                            const itemKey = `${item.product_id}-${item.variant_id || 'base'}`
                            return (
                                <div key={itemKey} className="group relative flex gap-6">
                                    <div className="w-24 h-32 bg-white rounded-2xl overflow-hidden shrink-0 shadow-sm border border-violet-50 p-1 transition-transform group-hover:-translate-y-1">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover rounded-xl" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-violet-50/50 rounded-xl">
                                                <Package size={20} strokeWidth={1} className="text-violet-200" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col py-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 pr-4">
                                                <h3 className="text-sm font-medium text-violet-950 truncate font-serif">
                                                    {item.product_name}
                                                </h3>
                                                <p className="text-[10px] text-violet-400 mt-1 uppercase tracking-widest">
                                                    Design No. {item.product_id.slice(-6).toUpperCase()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.product_id, item.variant_id)}
                                                className="text-violet-200 hover:text-rose-400 transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>

                                        <p className="text-sm font-semibold text-violet-900 mt-auto">
                                            {formatPrice(item.unit_price)}
                                        </p>

                                        <div className="flex items-center gap-6 mt-4">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => updateCartQuantity(item.product_id, Math.max(1, item.quantity - 1), item.variant_id)}
                                                    className="w-6 h-6 flex items-center justify-center text-violet-300 hover:text-violet-600 border border-violet-100 rounded-full transition-colors"
                                                >
                                                    <Minus size={10} />
                                                </button>
                                                <span className="text-xs font-bold text-violet-950 w-4 text-center">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateCartQuantity(item.product_id, item.quantity + 1, item.variant_id)}
                                                    className="w-6 h-6 flex items-center justify-center text-violet-300 hover:text-violet-600 border border-violet-100 rounded-full transition-colors"
                                                >
                                                    <Plus size={10} />
                                                </button>
                                            </div>

                                            <div className="w-px h-3 bg-violet-100" />

                                            <button className="text-violet-300 hover:text-violet-500 transition-colors">
                                                <Heart size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div className="p-8 border-t border-violet-100 bg-white shadow-[0_-10px_30px_rgba(139,92,246,0.03)] font-sans">
                        <div className="flex justify-between items-baseline mb-8">
                            <div>
                                <p className="text-[9px] text-violet-400 font-bold uppercase tracking-[0.2em] mb-2 pl-1">Estimated Total</p>
                                <p className="text-4xl font-light text-violet-950 font-serif leading-none italic">
                                    {formatPrice(cartTotal)}
                                </p>
                            </div>
                            <p className="text-[10px] text-violet-400 italic">Complimentary Packaging Incl.</p>
                        </div>
                        <div className="space-y-4">
                            <button
                                onClick={() => {
                                    setCartOpen(false)
                                    router.push(`/tenant/${slug}/checkout`)
                                }}
                                className="w-full py-5 bg-violet-600 hover:bg-violet-700 text-white rounded-none font-bold text-[10px] uppercase tracking-[0.4em] transition-all shadow-xl shadow-violet-200/50 flex items-center justify-center gap-2 group"
                            >
                                Begin Checkout
                                <ArrowRight size={14} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <Link
                                href={`/tenant/${slug}/cart`}
                                onClick={() => setCartOpen(false)}
                                className="block w-full py-5 bg-transparent border border-violet-100 hover:border-violet-300 text-violet-400 hover:text-violet-900 rounded-none font-bold text-[10px] uppercase tracking-[0.4em] text-center transition-all"
                            >
                                Open Shopping Bag
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
