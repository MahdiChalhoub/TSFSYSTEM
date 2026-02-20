'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShoppingBag, Heart, Minus, Plus, ArrowLeft, Truck, Shield, RotateCcw, Star } from 'lucide-react'
import { useCart, useConfig, useWishlist } from '../../engine'
import type { ProductDetailProps } from '../../engine/types'

export default function BoutiqueProductDetail({ product }: ProductDetailProps) {
    const { addToCart, cart } = useCart()
    const { slug, showPrice, isQuoteMode } = useConfig()
    const { isInWishlist, toggleWishlist } = useWishlist()
    const [qty, setQty] = useState(1)
    const inCart = cart.some(i => i.product_id === product.id)
    const inWishlist = isInWishlist(product.id)

    const price = product.selling_price_ttc
    const imgUrl = product.image_url?.startsWith('http')
        ? product.image_url
        : `${process.env.NEXT_PUBLIC_DJANGO_URL || ''}${product.image_url || ''}`
    const hasImage = !!product.image_url
    const inStock = product.stock_quantity === undefined || product.stock_quantity > 0

    const handleAdd = () => {
        addToCart({
            product_id: product.id,
            product_name: product.name,
            unit_price: price,
            quantity: qty,
            image_url: product.image_url,
            tax_rate: product.tax_rate || 0,
        })
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-violet-50/30 to-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="max-w-6xl mx-auto px-6 py-10">
                {/* Back */}
                <Link href={`/tenant/${slug}`}
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-violet-600 mb-8 font-medium transition">
                    <ArrowLeft size={16} /> Back to Store
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Image */}
                    <div className="relative">
                        <div className="aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-violet-50 to-pink-50 border border-violet-100 shadow-lg">
                            {hasImage ? (
                                <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ShoppingBag size={80} className="text-violet-200" />
                                </div>
                            )}
                        </div>

                        {product.category_name && (
                            <span className="absolute top-4 left-4 px-4 py-1.5 bg-white/90 backdrop-blur text-xs font-bold uppercase tracking-widest text-violet-600 rounded-full shadow">
                                {product.category_name}
                            </span>
                        )}
                    </div>

                    {/* Details */}
                    <div className="flex flex-col justify-center">
                        {product.sku && (
                            <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">SKU: {product.sku}</p>
                        )}

                        <h1 className="text-3xl md:text-4xl font-bold text-indigo-950 tracking-tight"
                            style={{ fontFamily: "'Playfair Display', serif" }}>
                            {product.name}
                        </h1>

                        {/* Rating placeholder */}
                        <div className="flex items-center gap-1 mt-3">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Star key={i} size={16} className={i <= 4 ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                            ))}
                            <span className="text-xs text-gray-400 ml-2 font-medium">4.0 (Premium Selection)</span>
                        </div>

                        {/* Price */}
                        <div className="mt-6">
                            {showPrice ? (
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-bold text-violet-600">${price?.toFixed(2)}</span>
                                    {product.tax_rate ? (
                                        <span className="text-xs text-gray-400">incl. {product.tax_rate}% tax</span>
                                    ) : null}
                                </div>
                            ) : (
                                <span className="inline-block px-5 py-2.5 bg-violet-50 text-violet-600 font-bold text-sm rounded-xl border border-violet-200">
                                    Request Quote
                                </span>
                            )}
                        </div>

                        {/* Description */}
                        {product.description && (
                            <p className="mt-6 text-gray-500 leading-relaxed text-sm">
                                {product.description}
                            </p>
                        )}

                        {/* Stock */}
                        <div className="mt-6 flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${inStock ? 'bg-green-400' : 'bg-red-400'}`} />
                            <span className={`text-sm font-medium ${inStock ? 'text-green-600' : 'text-red-500'}`}>
                                {inStock
                                    ? product.stock_quantity !== undefined
                                        ? `${product.stock_quantity} in stock`
                                        : 'In Stock'
                                    : 'Out of Stock'}
                            </span>
                        </div>

                        {/* Quantity + Actions */}
                        <div className="mt-8 space-y-4">
                            {showPrice && !isQuoteMode && (
                                <>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-gray-500 font-medium">Quantity</span>
                                        <div className="flex items-center border border-violet-200 rounded-xl overflow-hidden">
                                            <button onClick={() => setQty(Math.max(1, qty - 1))}
                                                className="px-3 py-2.5 text-gray-500 hover:bg-violet-50 transition">
                                                <Minus size={16} />
                                            </button>
                                            <span className="px-5 py-2.5 text-sm font-bold text-indigo-950 min-w-[40px] text-center">
                                                {qty}
                                            </span>
                                            <button onClick={() => setQty(qty + 1)}
                                                className="px-3 py-2.5 text-gray-500 hover:bg-violet-50 transition">
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={handleAdd} disabled={!inStock}
                                            className={`flex-1 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg ${inCart
                                                    ? 'bg-green-500 text-white shadow-green-200'
                                                    : inStock
                                                        ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-200'
                                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                                }`}>
                                            <ShoppingBag size={18} />
                                            {inCart ? '✓ Added to Cart' : 'Add to Cart'}
                                        </button>

                                        <button onClick={() => toggleWishlist(product.id)}
                                            className={`p-4 rounded-2xl border transition ${inWishlist
                                                    ? 'bg-pink-50 border-pink-200 text-pink-500'
                                                    : 'border-violet-200 text-gray-400 hover:text-pink-500 hover:border-pink-200'
                                                }`}>
                                            <Heart size={20} fill={inWishlist ? 'currentColor' : 'none'} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Trust badges */}
                        <div className="mt-10 grid grid-cols-3 gap-4">
                            {[
                                { icon: Truck, label: 'Free Shipping', sub: 'Orders $100+' },
                                { icon: Shield, label: 'Secure Checkout', sub: '256-bit SSL' },
                                { icon: RotateCcw, label: 'Easy Returns', sub: '30-day policy' },
                            ].map((badge, i) => (
                                <div key={i} className="text-center p-3 rounded-xl bg-violet-50/50 border border-violet-100">
                                    <badge.icon size={20} className="mx-auto text-violet-500 mb-1.5" />
                                    <p className="text-xs font-bold text-indigo-950">{badge.label}</p>
                                    <p className="text-[10px] text-gray-400">{badge.sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
