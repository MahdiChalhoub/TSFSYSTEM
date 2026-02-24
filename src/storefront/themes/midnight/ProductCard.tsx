'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ShoppingBag, ShoppingCart, Star, Heart, ArrowRight, X, FileQuestion, Search } from 'lucide-react'
import { useCart } from '../../engine/hooks/useCart'
import { useConfig } from '../../engine/hooks/useConfig'
import { useWishlist } from '../../engine/hooks/useWishlist'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'
import type { ProductCardProps } from '../../engine/types'
export default function MidnightProductCard({ product }: ProductCardProps) {
    const { addToCart } = useCart()
    const { showPrice, isQuoteMode, slug } = useConfig()
    const { isInWishlist, toggleWishlist } = useWishlist()
    const { path } = useStorefrontPath()
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
            href={path(`/product/${product.id}`)}
            className="group relative bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] overflow-hidden hover:border-emerald-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10"
        >
            <div className="aspect-[4/3] bg-slate-950 overflow-hidden relative">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                        <ShoppingBag size={40} className="text-slate-800" />
                    </div>
                )}
                <div className="absolute top-6 left-6 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                    {product.category_name || 'Premium'}
                </div>
                <div className="absolute top-6 right-6 flex items-center gap-2">
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product.id) }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg backdrop-blur-md border
                            ${isInWishlist(product.id)
                                ? 'bg-rose-500/80 text-white border-rose-500/50'
                                : 'bg-black/40 text-white/70 hover:text-rose-400 border-white/10'
                            }`}>
                        <Heart size={18} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
                    </button>
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 shadow-lg shadow-emerald-900/40">
                        <ArrowRight size={20} />
                    </div>
                </div>
            </div>
            <div className="p-8 space-y-4">
                <div className="space-y-1">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{product.name}</h3>
                        <div className="flex items-center gap-1 text-emerald-500">
                            <Star size={12} fill="currentColor" />
                            <span className="text-[10px] font-black">4.9</span>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono tracking-widest">{product.sku}</p>
                </div>
                <div className="flex items-center justify-between pt-2">
                    {showPrice ? (
                        <div className="text-2xl font-black text-white">
                            <span className="text-emerald-500 mr-1">$</span>
                            {product.selling_price_ttc}
                        </div>
                    ) : (
                        <div className="text-sm text-amber-400 flex items-center gap-2">
                            <FileQuestion size={14} /> Request Quote
                        </div>
                    )}
                    {isQuoteMode ? (
                        <span className="px-6 py-2 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest">
                            Get Quote
                        </span>
                    ) : (
                        <button
                            onClick={handleQuickAdd}
                            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2
                                ${added
                                    ? 'bg-emerald-500 text-white border border-emerald-500'
                                    : 'bg-white/5 hover:bg-emerald-500 text-white border border-white/10 hover:border-emerald-500'
                                }`}>
                            <ShoppingCart size={12} />
                            {added ? 'Added!' : 'Add'}
                        </button>
                    )}
                </div>
            </div>
        </Link>
    )
}
