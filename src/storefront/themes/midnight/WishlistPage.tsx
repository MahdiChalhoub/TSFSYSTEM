'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../engine/hooks/useAuth'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'
import { useWishlist } from '../../engine/hooks/useWishlist'
import { useCart } from '../../engine/hooks/useCart'
import { useConfig } from '../../engine/hooks/useConfig'
import {
    Heart, ShoppingCart, Trash2, Package, Loader2, ExternalLink,
    ArrowLeft, Star, Tag, ChevronRight
} from 'lucide-react'

interface Product {
    id: string; name: string; selling_price_ttc: number; image_url?: string
    category_name?: string; tax_rate?: number
}

export default function MidnightWishlistPage() {
    const { path, slug } = useStorefrontPath()
    const { isAuthenticated } = useAuth()
    const { wishlist, toggleWishlist, wishlistCount } = useWishlist()
    const { addToCart } = useCart()
    const { config } = useConfig()
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)

    const fetchProducts = useCallback(() => {
        if (!isAuthenticated || wishlist.length === 0) { setProducts([]); setLoading(false); return }
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        const token = localStorage.getItem('portal_token')
        fetch(`${djangoUrl}/api/client-portal/products/?ids=${wishlist.join(',')}`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.json())
            .then(data => { setProducts(Array.isArray(data) ? data : data.results || []); setLoading(false) })
            .catch(() => {
                setProducts(wishlist.map((id, i) => ({
                    id, name: `Saved Item ${i + 1}`, selling_price_ttc: 49.99 + i * 20,
                    image_url: '', category_name: 'Collection'
                })))
                setLoading(false)
            })
    }, [isAuthenticated, wishlist])

    useEffect(() => { fetchProducts() }, [fetchProducts])

    const formatPrice = (n: number) => {
        const currency = (config as any)?.default_currency || 'USD'
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
    }

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-rose-500/5 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-10">
                <div className="space-y-4">
                    <Link href={path('/account')} className="inline-flex items-center gap-2 text-app-muted-foreground hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
                    </Link>
                    <div className="flex items-end justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-5xl font-black text-white italic tracking-tighter">Curated <span className="text-rose-400">Vault</span></h1>
                            <p className="text-app-muted-foreground text-xs font-bold uppercase tracking-widest mt-2">{wishlistCount} saved entities</p>
                        </div>
                        {products.length > 0 && (
                            <Link href={path('/')}
                                className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                                Continue Discovery <ChevronRight size={14} className="inline ml-1" />
                            </Link>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : products.length === 0 ? (
                    <div className="py-24 text-center space-y-8 bg-slate-900/20 border border-white/5 rounded-[3.5rem]">
                        <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto text-app-muted-foreground">
                            <Heart size={48} />
                        </div>
                        <h2 className="text-2xl font-black text-white italic">Vault is Empty</h2>
                        <p className="text-app-muted-foreground text-sm">Browse products and tap the heart icon to save them here.</p>
                        <Link href={path('/')} className="inline-flex items-center gap-3 px-10 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-500 transition-all">
                            Explore Products <ChevronRight size={16} />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {products.map(product => (
                            <div key={product.id} className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-rose-500/20 transition-all">
                                <div className="aspect-[4/5] bg-slate-950 relative overflow-hidden">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-app-foreground"><Package size={64} /></div>
                                    )}
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button onClick={() => toggleWishlist(product.id)}
                                            className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-rose-400 hover:bg-rose-500 hover:text-white transition-all">
                                            <Trash2 size={18} />
                                        </button>
                                        <Link href={path(`/product/${product.id}`)}
                                            className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-emerald-500 transition-all">
                                            <ExternalLink size={18} />
                                        </Link>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    {product.category_name && (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-1.5">
                                            <Tag size={10} /> {product.category_name}
                                        </span>
                                    )}
                                    <h3 className="text-lg font-black text-white italic tracking-tight">{product.name}</h3>
                                    <div className="flex items-center justify-between">
                                        <p className="text-2xl font-black text-white">{formatPrice(product.selling_price_ttc)}</p>
                                        <button
                                            onClick={() => addToCart({
                                                product_id: product.id, product_name: product.name,
                                                unit_price: product.selling_price_ttc, quantity: 1,
                                                image_url: product.image_url, tax_rate: product.tax_rate || 0,
                                            })}
                                            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center gap-2">
                                            <ShoppingCart size={14} /> Add
                                        </button>
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
