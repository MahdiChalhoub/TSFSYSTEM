'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { usePortal } from '@/context/PortalContext'
import {
    Search, ShoppingBag, Heart, ShoppingCart, ArrowRight, Loader2, Package, X
} from 'lucide-react'

interface Product {
    id: string
    name: string
    sku: string
    selling_price_ttc: number
    image_url?: string
    category_name?: string
    stock_quantity?: number
    tax_rate?: number
}

export default function SearchPage() {
    const { slug } = useParams<{ slug: string }>()
    const searchParams = useSearchParams()
    const initialQ = searchParams.get('q') || ''

    const { config, addToCart, toggleWishlist, isInWishlist } = usePortal()
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState(initialQ)
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

    const storeMode = config?.store_mode || 'HYBRID'
    const showPrice = storeMode !== 'CATALOG_QUOTE'

    useEffect(() => {
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/products/public/?organization_slug=${slug}`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                setProducts(Array.isArray(data) ? data : data.results || [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [slug])

    const results = useMemo(() => {
        if (!query.trim()) return products
        const q = query.toLowerCase()
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.category_name || '').toLowerCase().includes(q)
        )
    }, [products, query])

    const handleQuickAdd = (p: Product) => {
        addToCart({
            product_id: p.id,
            product_name: p.name,
            unit_price: p.selling_price_ttc,
            quantity: 1,
            image_url: p.image_url,
            tax_rate: p.tax_rate || 0,
        })
        setAddedIds(prev => new Set(prev).add(p.id))
        setTimeout(() => setAddedIds(prev => { const next = new Set(prev); next.delete(p.id); return next }), 1500)
    }

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-8">
                {/* Search Header */}
                <div className="space-y-4">
                    <h1 className="text-4xl font-black text-white tracking-tight">Search</h1>
                    <div className="relative">
                        <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input type="text" placeholder="Search products by name, SKU, or category..."
                            value={query} onChange={e => setQuery(e.target.value)}
                            autoFocus
                            className="w-full bg-slate-900/60 border border-white/5 pl-14 pr-12 py-5 rounded-2xl text-white text-lg outline-none focus:border-emerald-500/30 transition-all placeholder:text-slate-700" />
                        {query && (
                            <button onClick={() => setQuery('')}
                                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                <X size={18} />
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 px-1">
                        {loading ? 'Loading...' : `${results.length} product${results.length !== 1 ? 's' : ''} found`}
                        {query && <> matching &quot;<span className="text-white">{query}</span>&quot;</>}
                    </p>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="animate-spin text-emerald-500" size={40} />
                    </div>
                )}

                {/* No results */}
                {!loading && results.length === 0 && (
                    <div className="py-24 text-center space-y-4">
                        <Package size={48} className="mx-auto text-slate-600" />
                        <h2 className="text-xl font-bold text-white">No products found</h2>
                        <p className="text-slate-500">Try adjusting your search query</p>
                    </div>
                )}

                {/* Results Grid */}
                {!loading && results.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {results.map(p => (
                            <div key={p.id} className="group relative bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all">
                                <Link href={`/tenant/${slug}/product/${p.id}`}>
                                    <div className="aspect-square bg-slate-950 overflow-hidden relative">
                                        {p.image_url ? (
                                            <img src={p.image_url} alt={p.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ShoppingBag size={32} className="text-slate-800" />
                                            </div>
                                        )}
                                    </div>
                                </Link>

                                {/* Heart */}
                                <button onClick={() => toggleWishlist(p.id)}
                                    className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all border backdrop-blur-md z-10
                                        ${isInWishlist(p.id)
                                            ? 'bg-rose-500/80 text-white border-rose-500/50'
                                            : 'bg-black/40 text-white/60 hover:text-rose-400 border-white/10'
                                        }`}>
                                    <Heart size={16} fill={isInWishlist(p.id) ? 'currentColor' : 'none'} />
                                </button>

                                <div className="p-4 space-y-2">
                                    <Link href={`/tenant/${slug}/product/${p.id}`}>
                                        <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{p.name}</h3>
                                    </Link>
                                    {p.category_name && (
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{p.category_name}</p>
                                    )}
                                    <div className="flex items-center justify-between pt-1">
                                        {showPrice ? (
                                            <span className="text-white font-black">
                                                <span className="text-emerald-500">$</span>{p.selling_price_ttc}
                                            </span>
                                        ) : (
                                            <span className="text-amber-400 text-xs">Request Quote</span>
                                        )}
                                        {storeMode !== 'CATALOG_QUOTE' && (
                                            <button onClick={() => handleQuickAdd(p)}
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border text-xs
                                                    ${addedIds.has(p.id)
                                                        ? 'bg-emerald-500 text-white border-emerald-500'
                                                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'
                                                    }`}>
                                                <ShoppingCart size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
