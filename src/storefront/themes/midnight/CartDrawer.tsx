// @ts-nocheck
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Minus, Plus, ShoppingBag, ArrowRight, Package, Trash2 } from 'lucide-react'
import { usePortal } from '@/context/PortalContext'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'

export default function MidnightCartDrawer() {
    const { path } = useStorefrontPath()
    const router = useRouter()
    const {
        cart, cartTotal, isCartOpen, setCartOpen,
        removeFromCart, updateCartQuantity
    } = usePortal()

    if (!isCartOpen) return null

    const formatPrice = (n: number) => `$${n.toFixed(2)}`

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={() => setCartOpen(false)}
            />

            {/* Panel */}
            <div className="relative w-full max-w-md bg-slate-950 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 border-l border-white/5">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShoppingBag className="text-app-success" size={24} />
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">Your Cart</h2>
                            <p className="text-[10px] text-app-muted-foreground uppercase font-black tracking-widest">
                                {cart.length} item{cart.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setCartOpen(false)}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-app-muted-foreground hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/5">
                                <ShoppingBag size={24} className="text-app-muted-foreground" />
                            </div>
                            <p className="text-app-muted-foreground text-sm font-bold">Your cart is empty</p>
                            <button
                                onClick={() => setCartOpen(false)}
                                className="mt-4 text-xs text-emerald-400 font-black uppercase tracking-widest"
                            >
                                Start Shopping
                            </button>
                        </div>
                    ) : (
                        cart.map(item => {
                            const itemKey = `${item.product_id}-${item.variant_id || 'base'}`
                            return (
                                <div key={itemKey} className="group flex gap-4">
                                    <div className="w-20 h-20 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-white/5">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package size={20} className="text-app-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                        <div>
                                            <h3 className="text-xs font-black text-white truncate group-hover:text-emerald-400 transition-colors">
                                                {item.product_name}
                                            </h3>
                                            <p className="text-[10px] text-app-muted-foreground font-bold mt-1 uppercase tracking-wider">
                                                {formatPrice(item.unit_price)}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center bg-white/5 rounded-lg border border-white/5">
                                                <button
                                                    onClick={() => updateCartQuantity(item.product_id, Math.max(1, item.quantity - 1), item.variant_id)}
                                                    className="p-1.5 text-app-muted-foreground hover:text-white transition-colors"
                                                >
                                                    <Minus size={12} />
                                                </button>
                                                <span className="w-8 text-center text-[10px] font-black text-white">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateCartQuantity(item.product_id, item.quantity + 1, item.variant_id)}
                                                    className="p-1.5 text-app-muted-foreground hover:text-white transition-colors"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.product_id, item.variant_id)}
                                                className="text-app-muted-foreground hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={14} />
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
                    <div className="p-6 border-t border-white/5 bg-slate-900/40 backdrop-blur-xl">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <p className="text-[10px] text-app-muted-foreground font-black uppercase tracking-widest mb-1">Subtotal</p>
                                <p className="text-2xl font-black text-white">{formatPrice(cartTotal)}</p>
                            </div>
                            <p className="text-[10px] text-emerald-400 font-bold">Tax & shipping calculated at checkout</p>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    setCartOpen(false)
                                    router.push(path('/checkout'))
                                }}
                                className="w-full py-4 bg-app-success hover:bg-app-success text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2 group"
                            >
                                Checkout Now
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <Link
                                href={path('/cart')}
                                onClick={() => setCartOpen(false)}
                                className="block w-full py-4 border border-white/5 hover:bg-white/5 text-app-muted-foreground hover:text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-center transition-all"
                            >
                                View Detailed Cart
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
