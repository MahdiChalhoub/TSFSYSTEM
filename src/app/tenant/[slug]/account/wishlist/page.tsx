'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { usePortal } from '@/context/PortalContext'
import {
    Heart, ShoppingCart, Trash2, Package, Loader2, ExternalLink
} from 'lucide-react'

interface Product {
    id: string
    name: string
    price: string
    image_url?: string
    in_stock: boolean
    category_name?: string
}

export default function WishlistPage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated, wishlist, toggleWishlist, addToCart, config } = usePortal()
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)

    const storeMode = config?.store_mode || 'HYBRID'

    useEffect(() => {
        if (wishlist.length === 0) { setLoading(false); return }

        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/products/public/?organization_slug=${slug}`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                const all = Array.isArray(data) ? data : data.results || []
                setProducts(all.filter((p: Product) => wishlist.includes(p.id)))
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [slug, wishlist])

    return (
        <div className="min-h-screen bg-app-bg p-4 lg:p-8 relative">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-app-error/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Heart size={28} className="text-app-error" /> Wishlist
                    </h1>
                    <span className="text-app-muted-foreground text-sm font-medium">{wishlist.length} items</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="animate-spin text-app-error" size={40} />
                    </div>
                ) : wishlist.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <Heart size={48} className="mx-auto text-app-faint" />
                        <h2 className="text-xl font-bold text-white">Your wishlist is empty</h2>
                        <p className="text-app-muted-foreground">Save products you love and come back to them later</p>
                        <Link href={`/tenant/${slug}`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-app-primary-dark text-white rounded-xl font-bold hover:bg-app-primary transition-all">
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {products.map(product => (
                            <div key={product.id}
                                className="group flex items-center gap-5 p-5 bg-app-surface/60 border border-white/5 rounded-2xl hover:border-app-error/20 transition-all">
                                {/* Image */}
                                <Link href={`/tenant/${slug}/product/${product.id}`}
                                    className="w-20 h-20 bg-app-surface-2 rounded-xl overflow-hidden flex-shrink-0">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package size={24} className="text-app-faint" />
                                        </div>
                                    )}
                                </Link>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <Link href={`/tenant/${slug}/product/${product.id}`}
                                        className="text-white font-bold hover:text-app-success transition-colors block truncate">
                                        {product.name}
                                    </Link>
                                    {product.category_name && (
                                        <p className="text-app-muted-foreground text-xs mt-0.5">{product.category_name}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2">
                                        {storeMode !== 'CATALOG_QUOTE' && (
                                            <span className="text-app-success font-black text-lg">${parseFloat(product.price).toFixed(2)}</span>
                                        )}
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${product.in_stock ? 'text-app-success/60' : 'text-app-error/60'}`}>
                                            {product.in_stock ? 'In Stock' : 'Out of Stock'}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {storeMode !== 'CATALOG_QUOTE' && product.in_stock && (
                                        <button onClick={() => addToCart({
                                            product_id: product.id,
                                            product_name: product.name,
                                            unit_price: parseFloat(product.price),
                                            quantity: 1,
                                            image_url: product.image_url,
                                            tax_rate: 0,
                                        })}
                                            className="px-4 py-2.5 bg-app-primary-dark hover:bg-app-primary text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                                            <ShoppingCart size={14} /> Add
                                        </button>
                                    )}
                                    <Link href={`/tenant/${slug}/product/${product.id}`}
                                        className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-white transition-all">
                                        <ExternalLink size={16} />
                                    </Link>
                                    <button onClick={() => toggleWishlist(product.id)}
                                        className="w-10 h-10 bg-app-error/10 border border-app-error/20 rounded-xl flex items-center justify-center text-app-error hover:bg-app-error/20 transition-all">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Products in wishlist but not found in API (deleted/unavailable) */}
                        {wishlist.filter(id => !products.find(p => p.id === id)).length > 0 && (
                            <div className="p-4 bg-app-surface/40 border border-white/5 rounded-xl text-app-muted-foreground text-sm text-center">
                                {wishlist.filter(id => !products.find(p => p.id === id)).length} wishlist item(s) are no longer available
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
