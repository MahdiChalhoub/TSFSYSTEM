'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ArrowRight, Sparkles } from 'lucide-react'
import { useConfig } from '../../engine'
import type { HomePageProps } from '../../engine/types'
import BoutiqueProductCard from './ProductCard'

export default function BoutiqueHomePage({ products = [], categories = [] }: HomePageProps) {
    const { orgName, slug } = useConfig()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    const filteredProducts = useMemo(() => {
        let items = products
        if (selectedCategory) {
            items = items.filter(p => p.category_name === selectedCategory || p.category_id === selectedCategory)
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            items = items.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.category_name?.toLowerCase().includes(q)
            )
        }
        return items
    }, [products, selectedCategory, searchQuery])

    const uniqueCategories = useMemo(() => {
        const cats = new Map<string, string>()
        products.forEach(p => {
            if (p.category_name) cats.set(p.category_name, p.category_id || p.category_name)
        })
        return Array.from(cats, ([name, id]) => ({ name, id }))
    }, [products])

    return (
        <div className="min-h-screen bg-gradient-to-b from-violet-50/50 to-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>

            {/* Hero Section */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-100/40 via-pink-50/30 to-white" />
                <div className="absolute top-10 right-10 w-72 h-72 bg-pink-200/20 rounded-full blur-3xl" />
                <div className="absolute bottom-10 left-10 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl" />

                <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-violet-200 shadow-sm mb-6">
                        <Sparkles size={14} className="text-violet-500" />
                        <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">New Collection</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-indigo-950 leading-tight tracking-tight"
                        style={{ fontFamily: "'Playfair Display', serif" }}>
                        Discover Your
                        <span className="block bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
                            Perfect Style
                        </span>
                    </h1>

                    <p className="mt-6 text-app-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
                        Curated collections from {orgName || 'our boutique'}. Each piece chosen with intention, crafted with passion.
                    </p>

                    {/* Search */}
                    <div className="mt-8 max-w-lg mx-auto relative">
                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-400" />
                        <input
                            type="text"
                            placeholder="Search our collection..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white border border-violet-200 text-indigo-950 placeholder:text-app-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 shadow-lg shadow-violet-100/50 text-sm"
                        />
                    </div>

                    {/* Quick links */}
                    <div className="mt-6 flex justify-center gap-3 flex-wrap">
                        <Link href={`/tenant/${slug}/categories`}
                            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition shadow-lg shadow-violet-200">
                            Browse Collections <ArrowRight size={16} />
                        </Link>
                        <Link href={`/tenant/${slug}/search`}
                            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white text-violet-600 text-sm font-semibold rounded-xl hover:bg-violet-50 transition border border-violet-200">
                            Shop All
                        </Link>
                    </div>
                </div>
            </section>

            {/* Category Filters */}
            {uniqueCategories.length > 0 && (
                <section className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex gap-2 flex-wrap justify-center">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition border ${!selectedCategory
                                    ? 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-200'
                                    : 'bg-white text-app-muted-foreground border-violet-200 hover:border-violet-400 hover:text-violet-600'
                                }`}>
                            All
                        </button>
                        {uniqueCategories.map(cat => (
                            <button key={cat.id}
                                onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition border ${selectedCategory === cat.id
                                        ? 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-200'
                                        : 'bg-white text-app-muted-foreground border-violet-200 hover:border-violet-400 hover:text-violet-600'
                                    }`}>
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Product Grid */}
            <section className="max-w-7xl mx-auto px-6 pb-20">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-indigo-950"
                        style={{ fontFamily: "'Playfair Display', serif" }}>
                        {selectedCategory
                            ? uniqueCategories.find(c => c.id === selectedCategory)?.name || 'Products'
                            : 'Featured Products'}
                    </h2>
                    <span className="text-sm text-app-muted-foreground font-medium">
                        {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
                    </span>
                </div>

                {filteredProducts.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-app-muted-foreground text-lg">No products found</p>
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')}
                                className="mt-3 text-violet-600 text-sm font-semibold hover:underline">
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                        {filteredProducts.map(product => (
                            <BoutiqueProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
