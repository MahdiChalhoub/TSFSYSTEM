'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../engine/hooks/useAuth'
import { useWishlist } from '../../engine/hooks/useWishlist'
import { useCart } from '../../engine/hooks/useCart'
import { useConfig } from '../../engine/hooks/useConfig'
import {
    Heart, ShoppingCart, Trash2, Package, Loader2, ExternalLink,
    ArrowLeft, Star, Tag, ChevronRight
} from 'lucide-react'

interface Product {
    id: string
    name: string
    price: string
    image_url?: string
    in_stock: boolean
    category_name?: string
    rating?: number
}

export default function MidnightWishlistPage() {
    const router = useRouter()
    const { slug } = useParams<{ slug: string }>()
    const { wishlist, toggleWishlist, wishlistCount } = useWishlist()
    const { addToCart } = useCart()
    const { config } = useConfig()
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)

    const storeMode = config?.store_mode || 'HYBRID'

    const fetchWishlistProducts = useCallback(() => {
        if (wishlist.length === 0) { setProducts([]); setLoading(false); return }
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || ''
        fetch(`${djangoUrl}/api/products/public/?organization_slug=${slug}`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                const all = Array.isArray(data) ? data : data.results || []
                setProducts(all.filter((p: Product) => wishlist.includes(String(p.id))))
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [slug, wishlist])

    useEffect(() => { fetchWishlistProducts() }, [fetchWishlistProducts])

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            {/* Header Banner */}
            <div className="relative h-72 bg-slate-900 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(244,63,94,0.08),transparent_50%)]" />

                <div className="max-w-7xl mx-auto px-6 h-full flex flex-col justify-end pb-12 relative z-10">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-white transition-all mb-8 text-[10px] font-black uppercase tracking-[0.3em] group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
                    </button>
                    <div className="flex items-end justify-between">
                        <div>
                            <h1 className="text-6xl font-black text-white italic tracking-tighter">
                                Curated <span className="text-rose-500">Collection</span>
                            </h1>
                            <p className="text-slate-500 mt-3 text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">
                                <Heart size={14} className="text-rose-500" fill="currentColor" /> {wishlistCount} Saved Assets
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 -mt-8 relative z-20">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin shadow-2xl shadow-rose-500/20" />
                        <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-[9px]">Synchronizing Vault...</p>
                    </div>
                ) : wishlist.length === 0 ? (
                    <div className="bg-slate-900/40 border-2 border-dashed border-white/5 rounded-[3.5rem] py-32 flex flex-col items-center text-center px-6">
                        <div className="w-28 h-28 bg-slate-900 border border-white/10 rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl rotate-12">
                            <Heart size={48} className="text-slate-800" />
                        </div>
                        <h2 className="text-4xl font-black text-white uppercase italic tracking-tight">Your vault is <span className="text-slate-700">empty</span></h2>
                        <p className="text-slate-500 mt-6 max-w-sm font-medium leading-relaxed">
                            Every great collection starts with a single choice. Explore our curated selection and save your favorites here.
                        </p>
                        <Link href={`/tenant/${slug}`}
                            className="mt-14 group flex items-center gap-3 px-12 py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20">
                            Initialize Explorer <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {products.map(product => (
                            <div key={product.id} className="group relative bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden hover:border-rose-500/30 transition-all hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-rose-500/10">
                                <div className="aspect-[4/5] relative overflow-hidden bg-slate-900">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package size={64} className="text-slate-800" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60" />

                                    <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                                        <button onClick={() => toggleWishlist(product.id)}
                                            className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-rose-400 hover:bg-rose-500 hover:text-white transition-all">
                                            <Trash2 size={18} />
                                        </button>
                                        <Link href={`/tenant/${slug}/product/${product.id}`}
                                            className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-emerald-500 transition-all">
                                            <ExternalLink size={18} />
                                        </Link>
                                    </div>

                                    <div className="absolute bottom-6 left-6 right-6">
                                        {product.category_name && (
                                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-500/30 mb-3">
                                                <Tag size={10} /> {product.category_name}
                                            </span>
                                        )}
                                        <h3 className="text-xl font-black text-white line-clamp-1 italic">{product.name}</h3>
                                        <div className="flex items-center gap-1 text-emerald-400 mt-2">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <Star key={i} size={10} fill={i <= (product.rating || 5) ? 'currentColor' : 'none'} />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 space-y-6">
                                    <div className="flex items-center justify-between">
                                        {storeMode !== 'CATALOG_QUOTE' ? (
                                            <div className="text-3xl font-black text-white italic tracking-tighter">
                                                <span className="text-emerald-500 mr-1">$</span>{parseFloat(product.price).toFixed(2)}
                                            </div>
                                        ) : (
                                            <span className="text-amber-400 text-[10px] font-black uppercase tracking-[0.3em]">Request Quote</span>
                                        )}
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${product.in_stock ? 'text-emerald-500/60 border-emerald-500/20 bg-emerald-500/5' : 'text-red-500/60 border-red-500/20 bg-red-500/5'}`}>
                                            {product.in_stock ? 'Available' : 'Depleted'}
                                        </span>
                                    </div>

                                    {storeMode !== 'CATALOG_QUOTE' && product.in_stock && (
                                        <button
                                            onClick={() => addToCart({
                                                product_id: product.id,
                                                product_name: product.name,
                                                unit_price: parseFloat(product.price),
                                                quantity: 1,
                                                image_url: product.image_url,
                                                tax_rate: 0,
                                            })}
                                            className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-[0.2em] text-[10px] hover:bg-emerald-500 hover:border-emerald-500 transition-all flex items-center justify-center gap-3">
                                            <ShoppingCart size={16} /> Add to Cart
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
