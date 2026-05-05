// @ts-nocheck
'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Minus, Plus, ShoppingBag, ArrowRight, Package, Trash2 } from 'lucide-react'
import { usePortal } from '@/context/PortalContext'

export default function EmporiumCartDrawer() {
    const { slug } = useParams<{ slug: string }>()
    const router = useRouter()
    const {
        cart, cartTotal, isCartOpen, setCartOpen,
        removeFromCart, updateCartQuantity
    } = usePortal()

    if (!isCartOpen) return null

    const formatPrice = (n: number) => `$${n.toFixed(2)}`

    return (
        <div className="fixed inset-0 z-[100] flex justify-end font-outfit">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300"
                onClick={() => setCartOpen(false)}
            />

            {/* Panel */}
            <div className="relative w-full max-w-md bg-app-surface h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 border-l border-app-border">
                {/* Header */}
                <div className="p-6 border-b border-app-border flex items-center justify-between bg-app-bg">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400 flex items-center justify-center rounded-xl shadow-sm text-app-foreground">
                            <ShoppingBag size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-app-foreground tracking-tight">Shopping Cart</h2>
                            <p className="text-[11px] text-app-muted-foreground uppercase font-bold tracking-widest">
                                {cart.length} item{cart.length !== 1 ? 's' : ''} reserved
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setCartOpen(false)}
                        className="p-2 hover:bg-app-border rounded-lg transition-colors text-app-muted-foreground hover:text-app-muted-foreground"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-app-bg rounded-full flex items-center justify-center mb-4 border border-app-border">
                                <ShoppingBag size={32} className="text-slate-200" />
                            </div>
                            <h3 className="text-app-foreground font-bold">Your cart is empty</h3>
                            <p className="text-app-muted-foreground text-sm mt-1">Browse our massive catalog to add items.</p>
                            <button
                                onClick={() => setCartOpen(false)}
                                className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-all"
                            >
                                Start Browsing
                            </button>
                        </div>
                    ) : (
                        cart.map(item => {
                            const itemKey = `${item.product_id}-${item.variant_id || 'base'}`
                            return (
                                <div key={itemKey} className="group flex gap-4 p-3 rounded-xl border border-app-border hover:border-app-warning hover:bg-app-warning-soft/30 transition-all">
                                    <div className="w-20 h-20 bg-app-bg rounded-lg overflow-hidden shrink-0 border border-app-border p-1">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover rounded-md" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-app-surface-2 rounded-md">
                                                <Package size={24} className="text-app-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-app-foreground truncate">
                                                {item.product_name}
                                            </h3>
                                            <p className="text-xs font-bold text-app-muted-foreground mt-0.5">
                                                {formatPrice(item.unit_price)}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center bg-app-surface rounded-lg border border-app-border shadow-sm overflow-hidden">
                                                <button
                                                    onClick={() => updateCartQuantity(item.product_id, Math.max(1, item.quantity - 1), item.variant_id)}
                                                    className="px-2 py-1 text-app-muted-foreground hover:bg-app-bg hover:text-app-foreground transition-colors"
                                                >
                                                    <Minus size={12} />
                                                </button>
                                                <span className="w-8 text-center text-xs font-bold text-app-foreground bg-app-bg py-1 border-x border-app-border">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateCartQuantity(item.product_id, item.quantity + 1, item.variant_id)}
                                                    className="px-2 py-1 text-app-muted-foreground hover:bg-app-bg hover:text-app-foreground transition-colors"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.product_id, item.variant_id)}
                                                className="p-1.5 text-app-muted-foreground hover:text-app-error hover:bg-app-error-soft rounded-md transition-all"
                                            >
                                                <Trash2 size={16} />
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
                    <div className="p-6 border-t border-app-border bg-slate-50/80 backdrop-blur-xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <p className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-widest">Grand Total</p>
                                <p className="text-3xl font-black text-app-foreground leading-none mt-1">
                                    <span className="text-sm font-bold mr-1">$</span>
                                    {cartTotal.toFixed(2)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-bold text-app-success bg-app-success-soft px-2 py-1 rounded-md inline-block">Free Shipping Applied</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    setCartOpen(false)
                                    router.push(`/tenant/${slug}/checkout`)
                                }}
                                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 group"
                            >
                                Secure Checkout
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <Link
                                href={`/tenant/${slug}/cart`}
                                onClick={() => setCartOpen(false)}
                                className="block w-full py-4 bg-app-surface border border-app-border hover:border-app-border text-app-muted-foreground hover:text-app-foreground rounded-xl font-bold text-sm uppercase tracking-wider text-center transition-all"
                            >
                                Edit Order
                            </Link>
                        </div>
                        <p className="text-[10px] text-app-muted-foreground text-center mt-4 uppercase font-bold tracking-widest">
                            Built with Emporium Engine™
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
