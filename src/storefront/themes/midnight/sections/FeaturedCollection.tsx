// @ts-nocheck
'use client'

import React, { useState, useMemo } from 'react'
import { Search, X, Grid, List } from 'lucide-react'
import MidnightProductCard from '../ProductCard'

export default function MidnightFeaturedCollection({ settings, products, categories }: SectionProps) {
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    const title = settings.title || 'Featured Collection'
    const limit = settings.limit || 8

    const filtered = useMemo(() => {
        let result = products || []
        if (search) {
            const q = search.toLowerCase()
            result = result.filter(p => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
        }
        if (selectedCategory) {
            result = result.filter(p => p.category_name === selectedCategory)
        }
        return result.slice(0, limit)
    }, [products, search, selectedCategory, limit])

    return (
        <section className="bg-slate-950 py-24">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Live Catalog</span>
                        </div>
                        <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter italic">
                            {title}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-emerald-600 text-white shadow-lg' : 'text-app-muted-foreground hover:text-white'}`}
                        >
                            <Grid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-emerald-600 text-white shadow-lg' : 'text-app-muted-foreground hover:text-white'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
                    <div className="lg:col-span-3">
                        <div className="relative group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground group-focus-within:text-emerald-400 transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="Search our collection..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-slate-900/50 border border-white/10 pl-14 pr-12 py-5 rounded-[2rem] text-white outline-none focus:border-emerald-500/30 transition-all placeholder:text-app-muted-foreground font-medium"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative">
                        <select
                            value={selectedCategory || ''}
                            onChange={e => setSelectedCategory(e.target.value || null)}
                            className="w-full appearance-none bg-slate-900/50 border border-white/10 px-6 py-5 rounded-[2rem] text-white outline-none focus:border-emerald-500/30 transition-all font-bold text-xs uppercase tracking-widest cursor-pointer"
                        >
                            <option value="">All Categories</option>
                            {(categories || []).map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-app-muted-foreground">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>

                {/* Grid */}
                {filtered.length > 0 ? (
                    <div className={viewMode === 'grid'
                        ? "grid grid-cols-1 md:grid-cols-2 gap-8"
                        : "flex flex-col gap-4"
                    }>
                        {filtered.map(product => (
                            <MidnightProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="py-32 text-center bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                        <div className="w-20 h-20 bg-slate-900 border border-white/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-app-muted-foreground">
                            <Search size={32} />
                        </div>
                        <h3 className="text-xl font-black text-white italic">No matches found</h3>
                        <p className="text-app-muted-foreground mt-2 font-medium">Try broadening your search or selection.</p>
                    </div>
                )}
            </div>
        </section>
    )
}
