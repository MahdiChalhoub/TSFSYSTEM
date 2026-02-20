'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, ShoppingCart, FileQuestion, Loader2, CheckCircle2,
    Package, Star, Minus, Plus, Tag, Layers, AlertCircle, Heart
} from 'lucide-react'
import { useCart, useConfig, useWishlist } from '../../engine/hooks'
import type { ProductDetailProps, Product } from '../../engine/types'

export default function MidnightProductDetail({ product }: ProductDetailProps) {
    const router = useRouter()
    const { slug } = useParams<{ slug: string }>()
    const { addToCart } = useCart()
    const { showPrice, isQuoteMode } = useConfig()
    const { isInWishlist, toggleWishlist } = useWishlist()

    const [quantity, setQuantity] = useState(1)
    const [added, setAdded] = useState(false)

    const handleAddToCart = () => {
        addToCart({
            product_id: product.id,
            product_name: product.name,
            unit_price: product.selling_price_ttc,
            quantity,
            image_url: product.image_url,
            tax_rate: product.tax_rate || 0,
        })
        setAdded(true)
        setTimeout(() => setAdded(false), 2000)
    }

    const detail = product as Product & {
        description?: string
        selling_price_ht?: number
        stock_quantity?: number
        barcode?: string
        unit_of_measure?: string
    }

    return (
        <div className="min-h-screen bg-slate-950 py-8">
            <div className="max-w-5xl mx-auto px-4">
                {/* Back */}
                <button onClick={() => router.back()}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Image */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden aspect-square">
                        {detail.image_url ? (
                            <img src={detail.image_url} alt={detail.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                                <Package size={64} className="text-slate-800" />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="space-y-6">
                        {detail.category_name && (
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                                <Tag size={10} /> {detail.category_name}
                            </span>
                        )}

                        <h1 className="text-4xl font-black text-white tracking-tight">{detail.name}</h1>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-emerald-400">
                                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} fill="currentColor" />)}
                            </div>
                            <span className="text-xs text-slate-500">Premium Quality</span>
                        </div>

                        <p className="text-[10px] text-slate-600 font-mono tracking-widest">SKU: {detail.sku}</p>

                        {detail.description && (
                            <p className="text-slate-400 leading-relaxed">{detail.description}</p>
                        )}

                        {/* Price */}
                        {showPrice ? (
                            <div className="space-y-1">
                                <div className="text-4xl font-black text-white">
                                    <span className="text-emerald-500 mr-1">$</span>{detail.selling_price_ttc}
                                </div>
                                {detail.selling_price_ht && detail.selling_price_ht !== detail.selling_price_ttc && (
                                    <p className="text-xs text-slate-600">Before tax: ${detail.selling_price_ht}</p>
                                )}
                            </div>
                        ) : (
                            <div className="text-amber-400 flex items-center gap-2 text-lg font-bold">
                                <FileQuestion size={20} /> Price on Request
                            </div>
                        )}

                        {/* Stock */}
                        {detail.stock_quantity !== undefined && (
                            <div className={`flex items-center gap-2 text-xs font-bold
                                ${detail.stock_quantity > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {detail.stock_quantity > 0 ? (
                                    <><CheckCircle2 size={14} /> {detail.stock_quantity} in stock</>
                                ) : (
                                    <><AlertCircle size={14} /> Out of stock</>
                                )}
                            </div>
                        )}

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-3">
                            {detail.barcode && (
                                <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                                    <p className="text-[10px] text-slate-600 mb-1">Barcode</p>
                                    <p className="text-xs text-white font-mono">{detail.barcode}</p>
                                </div>
                            )}
                            {detail.unit_of_measure && (
                                <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                                    <p className="text-[10px] text-slate-600 mb-1">Unit</p>
                                    <p className="text-xs text-white font-bold">{detail.unit_of_measure}</p>
                                </div>
                            )}
                        </div>

                        {/* Quantity + Add to Cart */}
                        {!isQuoteMode && (
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Qty</span>
                                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl">
                                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/5 rounded-l-xl transition-colors">
                                            <Minus size={14} />
                                        </button>
                                        <span className="w-12 text-center text-white font-bold text-sm">{quantity}</span>
                                        <button onClick={() => setQuantity(quantity + 1)}
                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/5 rounded-r-xl transition-colors">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleAddToCart}
                                        disabled={detail.stock_quantity !== undefined && detail.stock_quantity <= 0}
                                        className={`flex-1 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2
                                            ${added
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                                            } disabled:opacity-40 disabled:cursor-not-allowed`}>
                                        {added ? <><CheckCircle2 size={18} /> Added to Cart</> : <><ShoppingCart size={18} /> Add to Cart</>}
                                    </button>
                                    <button
                                        onClick={() => toggleWishlist(product.id)}
                                        className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all
                                            ${isInWishlist(product.id)
                                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                                : 'bg-white/5 text-slate-400 border-white/10 hover:text-rose-400'
                                            }`}>
                                        <Heart size={20} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {isQuoteMode && (
                            <Link href={`/tenant/${slug}/quote`}
                                className="block w-full py-4 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-2xl font-bold text-sm uppercase tracking-wider text-center hover:bg-teal-500/20 transition-all">
                                <FileQuestion size={18} className="inline mr-2" /> Request a Quote
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
