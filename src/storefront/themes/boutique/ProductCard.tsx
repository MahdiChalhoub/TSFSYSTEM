'use client'

import Link from 'next/link'
import { Heart, ShoppingBag, Eye } from 'lucide-react'
import { useCart, useConfig, useWishlist } from '../../engine'
import type { ProductCardProps } from '../../engine/types'

export default function BoutiqueProductCard({ product }: ProductCardProps) {
    const { addToCart, cart } = useCart()
    const { slug, showPrice, isQuoteMode } = useConfig()
    const { isInWishlist, toggleWishlist } = useWishlist()
    const inWishlist = isInWishlist(product.id)
    const inCart = cart.some(i => i.product_id === product.id)

    const price = product.selling_price_ttc
    const imgUrl = product.image_url?.startsWith('http')
        ? product.image_url
        : `${process.env.NEXT_PUBLIC_DJANGO_URL || ''}${product.image_url || ''}`
    const hasImage = !!product.image_url

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

    return (
        <Link href={`/tenant/${slug}/product/${product.id}`}
            className="group block bg-white rounded-3xl overflow-hidden border border-violet-100/60 hover:border-violet-300 transition-all duration-300 hover:shadow-xl hover:shadow-violet-100/50"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {/* Image */}
            <div className="relative aspect-square bg-gradient-to-br from-violet-50 to-pink-50 overflow-hidden">
                {hasImage ? (
                    <img src={imgUrl} alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={48} className="text-violet-200" />
                    </div>
                )}

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                        {showPrice && !isQuoteMode && (
                            <button onClick={handleAddToCart}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${inCart
                                        ? 'bg-app-success text-white'
                                        : 'bg-white text-violet-700 hover:bg-violet-600 hover:text-white'
                                    }`}>
                                {inCart ? '✓ In Cart' : 'Add to Cart'}
                            </button>
                        )}
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                            className="p-2.5 rounded-xl bg-white/90 text-app-muted-foreground hover:text-violet-600 transition shadow-lg">
                            <Eye size={16} />
                        </button>
                    </div>
                </div>

                {/* Wishlist */}
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product.id) }}
                    className={`absolute top-3 right-3 p-2 rounded-full transition-all ${inWishlist
                            ? 'bg-app-error text-white shadow-lg shadow-pink-200'
                            : 'bg-white/80 text-app-muted-foreground hover:text-app-error hover:bg-white shadow'
                        }`}>
                    <Heart size={16} fill={inWishlist ? 'currentColor' : 'none'} />
                </button>

                {/* Category badge */}
                {product.category_name && (
                    <span className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest text-violet-600 rounded-full shadow">
                        {product.category_name}
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="p-5">
                <h3 className="text-sm font-semibold text-indigo-950 line-clamp-1 group-hover:text-violet-600 transition"
                    style={{ fontFamily: "'Playfair Display', serif" }}>
                    {product.name}
                </h3>
                {product.sku && (
                    <p className="text-[10px] text-app-muted-foreground mt-0.5 font-mono uppercase">{product.sku}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                    {showPrice ? (
                        <span className="text-lg font-bold text-violet-600">
                            ${price?.toFixed(2)}
                        </span>
                    ) : (
                        <span className="text-xs font-semibold text-violet-500 bg-violet-50 px-3 py-1 rounded-full">
                            Request Quote
                        </span>
                    )}
                    {product.stock_quantity !== undefined && product.stock_quantity <= 5 && product.stock_quantity > 0 && (
                        <span className="text-[10px] text-app-warning font-bold uppercase">
                            Only {product.stock_quantity} left
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}
