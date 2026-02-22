'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShoppingBag, ShoppingCart, Star, Heart, ArrowRight, X, FileQuestion, Search } from 'lucide-react'
import { useCart, useConfig, useWishlist } from '../../engine/hooks'
import type { ProductCardProps } from '../../engine/types'

export default function MidnightProductCard({ product }: ProductCardProps) {
    const { addToCart } = useCart()
    const { showPrice, isQuoteMode, slug } = useConfig()
    const { isInWishlist, toggleWishlist } = useWishlist()
    const [added, setAdded] = useState(false)

    const handleQuickAdd = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        addToCart({
            product_id: product.id,
            product_name: product.name,
            unit_price: product.selling_price_ttc,
            quantity: 1,
            image_url: product.image_url,
            tax_rate: product.tax_rate || 0,
        })
        setAdded(true)
        setTimeout(() => setAdded(false), 1500)
    }

    return (
        <Link
            href={`/tenant/${slug}/product/${product.id}`}
            className="group relative bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden hover:border-emerald-500/50 transition-all duration-700 hover:shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)] ring-1 ring-inset ring-white/5 hover:ring-emerald-500/20"
        >
            <div className="aspect-[4/5] bg-[#020617] overflow-hidden relative">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name}
                        className="w-full h-full object-cover transition-all duration-1000 opacity-80 group-hover:opacity-100 group-hover:scale-110 grayscale-[0.3] group-hover:grayscale-0" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-[#020617]">
                        <ShoppingBag size={48} className="text-white/5" />
                    </div>
                )}

                {/* Glass Overlays */}
                <div className="absolute top-6 left-6 px-4 py-1.5 bg-black/40 backdrop-blur-xl rounded-full text-[9px] font-black text-white uppercase tracking-[0.2em] border border-white/10 shadow-xl">
                    {product.category_name || 'Premium'}
                </div>

                <div className="absolute top-6 right-6 flex items-center gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product.id) }}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-2xl backdrop-blur-xl border
                            ${isInWishlist(product.id)
                                ? 'bg-rose-500 text-white border-rose-400'
                                : 'bg-white/10 text-white hover:bg-white/20 border-white/10'
                            }`}>
                        <Heart size={20} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} strokeWidth={isInWishlist(product.id) ? 0 : 2} />
                    </button>
                    <div className="w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 hover:bg-emerald-400">
                        <ArrowRight size={24} strokeWidth={2.5} />
                    </div>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
            </div>

            <div className="p-8 space-y-6 relative overflow-hidden">
                {/* Reflective Shine */}
                <div className="absolute top-0 left-[-100%] w-full h-[200%] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent rotate-45 group-hover:left-[100%] transition-all duration-1000" />

                <div className="space-y-2">
                    <div className="flex justify-between items-start">
                        <h3 className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors tracking-tighter leading-tight">{product.name}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-emerald-500">
                            {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={10} fill="currentColor" />)}
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{product.sku || 'REF:TSF-001'}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    {showPrice ? (
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Price Unit</span>
                            <div className="text-4xl font-black text-white tracking-tighter">
                                <span className="text-xl text-emerald-500 mr-0.5">$</span>
                                {product.selling_price_ttc}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                            <FileQuestion size={16} /> Request Quote
                        </div>
                    )}

                    {isQuoteMode ? (
                        <span className="px-6 py-3 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-black/20">
                            Get Quote
                        </span>
                    ) : (
                        <button
                            onClick={handleQuickAdd}
                            className={`h-14 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl
                                ${added
                                    ? 'bg-emerald-500 text-white border-0'
                                    : 'bg-white/5 hover:bg-white text-white hover:text-black border border-white/10 hover:border-white'
                                }`}>
                            <ShoppingCart size={16} strokeWidth={2.5} />
                            {added ? 'In Cart' : 'Purchase'}
                        </button>
                    )}
                </div>
            </div>
        </Link>
    )
}
