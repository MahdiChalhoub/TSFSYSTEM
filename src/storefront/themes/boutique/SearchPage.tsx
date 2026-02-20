'use client'

import { useState, useMemo } from 'react'
import { Search as SearchIcon, X, SlidersHorizontal } from 'lucide-react'
import { useStore, useConfig } from '../../engine'
import BoutiqueProductCard from './ProductCard'

export default function BoutiqueSearchPage() {
    const { products, categories, loading } = useStore()
    const { slug } = useConfig()
    const [query, setQuery] = useState('')
    const [selectedCat, setSelectedCat] = useState<string | null>(null)
    const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc'>('name')

    const results = useMemo(() => {
        let items = [...products]

        if (selectedCat) {
            items = items.filter(p => p.category_name === selectedCat || p.category_id === selectedCat)
        }

        if (query) {
            const q = query.toLowerCase()
            items = items.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.category_name?.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q)
            )
        }

        switch (sortBy) {
            case 'price-asc': items.sort((a, b) => a.selling_price_ttc - b.selling_price_ttc); break
            case 'price-desc': items.sort((a, b) => b.selling_price_ttc - a.selling_price_ttc); break
            default: items.sort((a, b) => a.name.localeCompare(b.name))
        }

        return items
    }, [products, query, selectedCat, sortBy])

    return (
        <div className="min-h-screen bg-gradient-to-b from-violet-50/30 to-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* Header */}
                <h1 className="text-3xl font-bold text-indigo-950 mb-8"
                    style={{ fontFamily: "'Playfair Display', serif" }}>
                    Shop All
                </h1>

                {/* Search + Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <div className="flex-1 relative">
                        <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-400" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full pl-12 pr-10 py-3.5 rounded-xl border border-violet-200 bg-white text-indigo-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 shadow-sm text-sm"
                        />
                        {query && (
                            <button onClick={() => setQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-600">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as any)}
                        className="px-4 py-3.5 rounded-xl border border-violet-200 bg-white text-sm text-indigo-950 focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm">
                        <option value="name">Sort by Name</option>
                        <option value="price-asc">Price: Low → High</option>
                        <option value="price-desc">Price: High → Low</option>
                    </select>
                </div>

                {/* Category pills */}
                {categories.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-8">
                        <button onClick={() => setSelectedCat(null)}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition border ${!selectedCat
                                    ? 'bg-violet-600 text-white border-violet-600'
                                    : 'bg-white text-gray-600 border-violet-200 hover:border-violet-400'
                                }`}>
                            All ({products.length})
                        </button>
                        {categories.map(cat => (
                            <button key={cat.id}
                                onClick={() => setSelectedCat(cat.id === selectedCat ? null : cat.id)}
                                className={`px-4 py-2 rounded-full text-xs font-semibold transition border ${selectedCat === cat.id
                                        ? 'bg-violet-600 text-white border-violet-600'
                                        : 'bg-white text-gray-600 border-violet-200 hover:border-violet-400'
                                    }`}>
                                {cat.name} ({cat.product_count || 0})
                            </button>
                        ))}
                    </div>
                )}

                {/* Results */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : results.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-gray-400 text-lg">No products found</p>
                        {query && (
                            <button onClick={() => setQuery('')}
                                className="mt-3 text-violet-600 text-sm font-semibold hover:underline">
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-400 mb-6">{results.length} {results.length === 1 ? 'result' : 'results'}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                            {results.map(product => (
                                <BoutiqueProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
