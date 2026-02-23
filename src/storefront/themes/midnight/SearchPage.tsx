'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Search, X, ShoppingBag } from 'lucide-react'
import { useStore } from '../../engine/hooks/useStore'
import { useConfig } from '../../engine/hooks/useConfig'
import MidnightProductCard from './ProductCard'
import type { SearchPageProps } from '../../engine/types'

export default function MidnightSearchPage({ initialQuery }: SearchPageProps) {
    const { slug } = useParams<{ slug: string }>()
    const { products } = useStore()
    const [search, setSearch] = useState(initialQuery || '')

    const results = useMemo(() => {
        if (!search) return []
        const q = search.toLowerCase()
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.category_name?.toLowerCase().includes(q)
        )
    }, [products, search])

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-black text-white tracking-tight mb-6">Search Products</h1>

            <div className="relative mb-8">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, SKU, or category..."
                    autoFocus
                    className="w-full bg-slate-900/60 border border-white/5 pl-12 pr-10 py-4 rounded-2xl text-white outline-none focus:border-emerald-500/30 transition-all placeholder:text-slate-700 text-lg"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        <X size={18} />
                    </button>
                )}
            </div>

            {search && (
                <p className="text-xs text-slate-500 mb-6">
                    {results.length} result{results.length !== 1 ? 's' : ''} for &quot;<span className="text-white">{search}</span>&quot;
                </p>
            )}

            {search && results.length === 0 && (
                <div className="py-16 text-center space-y-3">
                    <ShoppingBag size={36} className="mx-auto text-slate-600" />
                    <p className="text-white font-bold">No products found</p>
                    <p className="text-slate-500 text-sm">Try a different search term</p>
                </div>
            )}

            {results.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {results.map(p => (
                        <MidnightProductCard key={p.id} product={p} />
                    ))}
                </div>
            )}

            {!search && (
                <div className="py-16 text-center space-y-3">
                    <Search size={36} className="mx-auto text-slate-600" />
                    <p className="text-white font-bold">Start typing to search</p>
                    <p className="text-slate-500 text-sm">Search across all products in the catalog</p>
                </div>
            )}
        </div>
    )
}
