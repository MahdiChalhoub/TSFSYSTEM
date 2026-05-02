'use client'

/**
 * Products Tab — lazy-loaded product list for a specific brand.
 * Fetches from /inventory/brands/{id}/hierarchy/ which returns
 * the brand data including associated products.
 */

import { useEffect, useState } from 'react'
import { Loader2, Package, ExternalLink, Search } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import Link from 'next/link'

interface Product {
    id: number
    name: string
    sku?: string
    barcode?: string
    category_name?: string
    sell_price?: number
    [key: string]: unknown
}

export function ProductsTab({ brandId, brandName }: { brandId: number; brandName: string }) {
    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState<Product[]>([])
    const [search, setSearch] = useState('')

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        erpFetch(`inventory/brands/${brandId}/hierarchy/`)
            .then((res: any) => {
                if (cancelled) return
                setProducts(Array.isArray(res?.products) ? res.products : [])
            })
            .catch(() => { if (!cancelled) setProducts([]) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [brandId])

    const filtered = search.trim()
        ? products.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())))
        : products

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-success)' }} />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-tp-sm font-medium text-app-muted-foreground">
                    {products.length} product{products.length !== 1 ? 's' : ''}
                </p>
                {products.length > 5 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                        <Search size={11} style={{ color: 'var(--app-muted-foreground)' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Filter..." className="text-tp-xs bg-transparent outline-none w-24 text-app-foreground" />
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Package size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-tp-md font-semibold text-app-muted-foreground">
                            {search ? 'No matching products' : `No products under "${brandName}"`}
                        </p>
                        <p className="text-tp-sm text-app-muted-foreground mt-1">
                            {search ? 'Try a different filter' : 'Products will appear when assigned to this brand.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {filtered.map(p => (
                            <Link key={p.id} href={`/inventory/products/${p.id}`}
                                className="flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-app-surface-hover cursor-pointer">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                    <Package size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-tp-md font-semibold text-app-foreground truncate">{p.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {p.sku && (
                                            <span className="font-mono text-tp-xxs font-bold text-app-muted-foreground">{p.sku}</span>
                                        )}
                                        {p.category_name && (
                                            <span className="text-tp-xxs text-app-muted-foreground">· {p.category_name}</span>
                                        )}
                                    </div>
                                </div>
                                {p.sell_price != null && (
                                    <span className="text-tp-xs font-bold tabular-nums flex-shrink-0"
                                        style={{ color: 'var(--app-foreground)' }}>
                                        {Number(p.sell_price).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </span>
                                )}
                                <ExternalLink size={11} className="text-app-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
