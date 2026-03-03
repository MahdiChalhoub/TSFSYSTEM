'use client'

import { useState, useMemo } from 'react'
import { Grid3X3, Tag, ArrowRight } from 'lucide-react'
import { useStore } from '../../engine/hooks/useStore'
import { useConfig } from '../../engine/hooks/useConfig'
import type { Product, Category } from '../../engine/types'
import BoutiqueProductCard from './ProductCard'
import Link from 'next/link'

export default function BoutiqueCategoriesPage() {
    const { products, categories, loading, getProductsByCategory } = useStore()
    const { slug } = useConfig()
    const [activeCat, setActiveCat] = useState<string | null>(null)

    const displayProducts = useMemo(() => {
        if (!activeCat) return []
        return getProductsByCategory(activeCat)
    }, [activeCat, getProductsByCategory])

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-violet-50/30 to-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="max-w-7xl mx-auto px-6 py-10">
                <h1 className="text-3xl font-bold text-indigo-950 mb-2"
                    style={{ fontFamily: "'Playfair Display', serif" }}>
                    Collections
                </h1>
                <p className="text-app-text-faint text-sm mb-10">Browse our curated collections and find your style.</p>

                {categories.length === 0 ? (
                    <div className="text-center py-20">
                        <Grid3X3 size={48} className="mx-auto text-violet-200 mb-4" />
                        <p className="text-app-text-faint text-lg">No collections available yet</p>
                        <Link href={`/tenant/${slug}/search`}
                            className="inline-flex items-center gap-2 mt-4 text-violet-600 text-sm font-semibold hover:underline">
                            Browse all products <ArrowRight size={16} />
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Category Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
                            {categories.map(cat => (
                                <button key={cat.id}
                                    onClick={() => setActiveCat(activeCat === cat.id ? null : cat.id)}
                                    className={`group p-6 rounded-2xl border-2 text-left transition-all ${activeCat === cat.id
                                        ? 'border-violet-500 bg-violet-50 shadow-lg shadow-violet-100'
                                        : 'border-violet-100 bg-app-surface hover:border-violet-300 hover:shadow-md'
                                        }`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition ${activeCat === cat.id
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-violet-50 text-violet-500 group-hover:bg-violet-100'
                                        }`}>
                                        <Tag size={20} />
                                    </div>
                                    <h3 className="font-bold text-indigo-950 text-sm"
                                        style={{ fontFamily: "'Playfair Display', serif" }}>
                                        {cat.name}
                                    </h3>
                                    <p className="text-xs text-app-text-faint mt-1">
                                        {cat.product_count || 0} {(cat.product_count || 0) === 1 ? 'item' : 'items'}
                                    </p>
                                </button>
                            ))}
                        </div>

                        {/* Products for selected category */}
                        {activeCat && (
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-indigo-950"
                                        style={{ fontFamily: "'Playfair Display', serif" }}>
                                        {categories.find(c => c.id === activeCat)?.name || 'Products'}
                                    </h2>
                                    <span className="text-sm text-app-text-faint">
                                        {displayProducts.length} {displayProducts.length === 1 ? 'item' : 'items'}
                                    </span>
                                </div>

                                {displayProducts.length === 0 ? (
                                    <p className="text-center py-10 text-app-text-faint">No products in this collection</p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                                        {displayProducts.map(product => (
                                            <BoutiqueProductCard key={product.id} product={product} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
