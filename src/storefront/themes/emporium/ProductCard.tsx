'use client'
import { ShoppingCart, Star, Plus, ShieldCheck, Truck, Package } from 'lucide-react'
import type { Product } from '../../engine/types'
import { useCart } from '../../engine/hooks/useCart'
import { useConfig } from '../../engine/hooks/useConfig'
import Link from 'next/link'
export default function EmporiumProductCard({
    product,
    layout = 'grid'
}: {
    product: Product,
    layout?: 'grid' | 'compact'
}) {
    const { slug, orgName } = useConfig()
    const { addToCart } = useCart()
    const price = typeof product.selling_price_ttc === 'number'
        ? product.selling_price_ttc
        : parseFloat(product.selling_price_ttc as any) || 0
    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        addToCart({
            product_id: product.id,
            product_name: product.name,
            unit_price: price,
            quantity: 1,
            image_url: product.image_url,
            tax_rate: product.tax_rate || 0,
        })
    }
    // Simulated Rating for Marketplace Vibe
    const rating = 4.5
    const reviews = Math.floor(Math.random() * 500) + 50
    if (layout === 'compact') {
        return (
            <div className="group bg-app-surface rounded-2xl border border-app-border p-4 flex gap-6 hover:shadow-xl hover:shadow-slate-200/50 hover:border-yellow-400/50 transition-all">
                <div className="w-32 h-32 bg-app-bg rounded-xl overflow-hidden shrink-0 border border-app-border flex items-center justify-center relative">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-app-bg text-slate-200">
                            <Package size={48} strokeWidth={1} />
                            <span className="text-[10px] font-black uppercase tracking-widest mt-2">{orgName || 'TSF'} Node</span>
                        </div>
                    )}
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Verified Vendor</span>
                            <span className="text-[10px] font-black bg-app-surface-2 text-app-text-faint px-2 py-0.5 rounded-full uppercase">{product.category_name || 'General'}</span>
                        </div>
                        <Link href={`/tenant/${slug}/product/${product.id}`}>
                            <h3 className="text-lg font-black text-app-text leading-tight hover:text-indigo-600 transition-colors">{product.name}</h3>
                        </Link>
                        <div className="flex items-center gap-1 mt-1 text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} size={12} fill={i < 4 ? "currentColor" : "none"} className={i < 4 ? "fill-yellow-400" : "text-slate-300"} />
                            ))}
                            <span className="text-xs text-app-text-faint font-bold ml-1">({reviews})</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-app-text">${price.toFixed(2)}</span>
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 uppercase tracking-wider">
                                <Truck size={10} /> Fast Delivery 2-3 Days
                            </span>
                        </div>
                        <button
                            onClick={handleAddToCart}
                            className="bg-yellow-400 hover:bg-yellow-500 text-app-text px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-yellow-200 active:scale-95 transition-all"
                        >
                            <ShoppingCart size={14} /> ADD TO CART
                        </button>
                    </div>
                </div>
            </div>
        )
    }
    return (
        <div className="group bg-app-surface rounded-2xl border border-app-border overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 hover:border-yellow-400/50 transition-all flex flex-col">
            <div className="aspect-square bg-app-bg relative overflow-hidden flex items-center justify-center border-b border-app-border">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                    <Package size={48} className="text-slate-200" />
                )}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                    <div className="bg-white/90 backdrop-blur-sm border border-app-border rounded-lg p-1.5 shadow-sm">
                        <ShieldCheck size={14} className="text-emerald-500" />
                    </div>
                </div>
                <button
                    onClick={handleAddToCart}
                    className="absolute bottom-3 right-3 w-10 h-10 bg-yellow-400 text-app-text rounded-xl flex items-center justify-center shadow-lg transform translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 active:scale-90"
                >
                    <ShoppingCart size={18} />
                </button>
            </div>
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-app-text-faint uppercase tracking-widest leading-none">SKU: {product.sku || 'N/A'}</span>
                        <div className="flex items-center gap-1 text-yellow-400">
                            <Star size={10} fill="currentColor" />
                            <span className="text-[10px] font-black text-app-text-muted">{rating}</span>
                        </div>
                    </div>
                    <Link href={`/tenant/${slug}/product/${product.id}`}>
                        <h3 className="text-sm font-black text-app-text leading-snug hover:text-indigo-600 transition-colors line-clamp-2">
                            {product.name}
                        </h3>
                    </Link>
                </div>
                <div className="mt-4 space-y-1">
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-app-text">${price.toFixed(2)}</span>
                        {price > 100 && (
                            <span className="text-xs text-app-text-faint line-through font-bold">${(price * 1.25).toFixed(2)}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Truck size={12} className="text-emerald-500" />
                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Free Delivery</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
