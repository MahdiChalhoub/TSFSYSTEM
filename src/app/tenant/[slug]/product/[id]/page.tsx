'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePortal } from '@/context/PortalContext'
import {
    ArrowLeft, ShoppingCart, FileQuestion, Loader2, CheckCircle2,
    Package, Star, Minus, Plus, Tag, Layers, AlertCircle
} from 'lucide-react'

interface ProductDetail {
    id: string
    name: string
    sku: string
    description: string
    selling_price_ttc: number
    selling_price_ht: number
    tax_rate: number
    image_url?: string
    category_name?: string
    stock_quantity: number
    is_active: boolean
    barcode?: string
    unit_of_measure?: string
}

export default function ProductDetailPage() {
    const { slug, id } = useParams<{ slug: string; id: string }>()
    const router = useRouter()
    const { isAuthenticated, token, config, addToCart, cart } = usePortal()
    const [product, setProduct] = useState<ProductDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [qty, setQty] = useState(1)
    const [added, setAdded] = useState(false)

    const storeMode = config?.store_mode || 'HYBRID'
    const showPrice = storeMode !== 'CATALOG_QUOTE'
    const showStock = config?.show_stock_levels ?? false
    const existingCartItem = cart.find(c => c.product_id === id)

    useEffect(() => {
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/products/storefront/${id}/?organization_slug=${slug}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { setProduct(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [slug, id])

    const handleAddToCart = () => {
        if (!product) return
        addToCart({
            product_id: product.id,
            product_name: product.name,
            unit_price: product.selling_price_ttc,
            quantity: qty,
            image_url: product.image_url,
            tax_rate: product.tax_rate || 0,
        })
        setAdded(true)
        setTimeout(() => setAdded(false), 2000)
    }

    // ─── Loading ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <Loader2 className="animate-spin text-emerald-500" size={40} />
            </div>
        )
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <AlertCircle size={48} className="mx-auto text-slate-600" />
                    <h1 className="text-2xl font-bold text-white">Product Not Found</h1>
                    <Link href={`/tenant/${slug}`}
                        className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium">
                        <ArrowLeft size={16} /> Back to Store
                    </Link>
                </div>
            </div>
        )
    }

    // ─── Product View ────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-8">
                <Link href={`/tenant/${slug}`}
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                    <ArrowLeft size={16} /> Back to Store
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
                    {/* Image */}
                    <div className="aspect-square bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden">
                        {product.image_url ? (
                            <img src={product.image_url} alt={product.name}
                                className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                                <Package size={80} className="text-slate-800" />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="space-y-8">
                        {/* Category Badge */}
                        <div className="flex items-center gap-3">
                            {product.category_name && (
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                    <Tag size={12} /> {product.category_name}
                                </div>
                            )}
                            <div className="flex items-center gap-1 text-amber-500">
                                <Star size={14} fill="currentColor" />
                                <span className="text-xs font-bold">4.9</span>
                            </div>
                        </div>

                        {/* Name + SKU */}
                        <div>
                            <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight">{product.name}</h1>
                            <p className="text-xs text-slate-600 font-mono mt-2 tracking-widest">{product.sku}</p>
                        </div>

                        {/* Description */}
                        {product.description && (
                            <p className="text-slate-400 leading-relaxed">{product.description}</p>
                        )}

                        {/* Price */}
                        {showPrice ? (
                            <div className="space-y-2">
                                <div className="text-4xl font-black text-white">
                                    <span className="text-emerald-500 mr-1">$</span>
                                    {product.selling_price_ttc.toFixed(2)}
                                </div>
                                <p className="text-xs text-slate-600">
                                    HT: ${product.selling_price_ht?.toFixed(2) || '—'} • Tax: {product.tax_rate || 0}%
                                </p>
                            </div>
                        ) : (
                            <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-amber-400 text-sm flex items-center gap-3">
                                <FileQuestion size={18} />
                                <span>Price available upon request — submit a quote request</span>
                            </div>
                        )}

                        {/* Stock */}
                        <div className="flex items-center gap-3">
                            <Layers size={16} className="text-slate-500" />
                            {showStock ? (
                                <span className={`text-sm font-medium ${product.stock_quantity > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                                </span>
                            ) : (
                                <span className={`text-sm font-medium ${product.stock_quantity > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {product.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}
                                </span>
                            )}
                            {product.unit_of_measure && (
                                <span className="text-[10px] text-slate-600 uppercase tracking-widest">per {product.unit_of_measure}</span>
                            )}
                        </div>

                        {existingCartItem && (
                            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                                Already in cart ({existingCartItem.quantity} units)
                            </div>
                        )}

                        {/* Action Buttons */}
                        {storeMode === 'CATALOG_QUOTE' ? (
                            <Link href={`/tenant/${slug}/quote`}
                                className="w-full flex items-center justify-center gap-3 bg-teal-600 hover:bg-teal-500 text-white p-5 rounded-2xl font-black transition-all shadow-xl shadow-teal-900/40 hover:scale-[1.01] active:scale-[0.99] text-lg">
                                <FileQuestion size={22} /> Request a Quote
                            </Link>
                        ) : (
                            <div className="space-y-4">
                                {/* Qty Selector */}
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Quantity</span>
                                    <div className="flex items-center gap-1 bg-slate-900/60 border border-white/5 rounded-xl p-1">
                                        <button onClick={() => setQty(Math.max(1, qty - 1))}
                                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                                            <Minus size={16} />
                                        </button>
                                        <span className="w-12 text-center text-white font-bold">{qty}</span>
                                        <button onClick={() => setQty(qty + 1)}
                                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>

                                <button onClick={handleAddToCart} disabled={product.stock_quantity <= 0}
                                    className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100 text-lg">
                                    {added
                                        ? <><CheckCircle2 size={22} /> Added to Cart!</>
                                        : <><ShoppingCart size={22} /> Add to Cart — ${(product.selling_price_ttc * qty).toFixed(2)}</>
                                    }
                                </button>
                            </div>
                        )}

                        {/* Meta */}
                        {product.barcode && (
                            <div className="pt-4 border-t border-white/5">
                                <p className="text-[10px] text-slate-600 uppercase tracking-widest">Barcode: <span className="text-slate-400 font-mono">{product.barcode}</span></p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
