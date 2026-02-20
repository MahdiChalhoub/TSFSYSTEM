'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { usePortal } from '@/context/PortalContext'
import {
    Grid3X3, ShoppingBag, ArrowRight, Loader2, Search, Package
} from 'lucide-react'

interface Category {
    id: string
    name: string
    slug: string
    description?: string
    product_count: number
    image_url?: string
    parent_name?: string
}

export default function CategoriesPage() {
    const { slug } = useParams<{ slug: string }>()
    const { config } = usePortal()
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/products/categories/?organization_slug=${slug}`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                setCategories(Array.isArray(data) ? data : data.results || [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [slug])

    const filtered = useMemo(() => {
        if (!search) return categories
        return categories.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase())
        )
    }, [categories, search])

    // Color palette for category cards
    const COLORS = [
        { from: 'from-emerald-600/20', to: 'to-emerald-900/20', border: 'border-emerald-500/20', text: 'text-emerald-400', hover: 'hover:border-emerald-500/40' },
        { from: 'from-blue-600/20', to: 'to-blue-900/20', border: 'border-blue-500/20', text: 'text-blue-400', hover: 'hover:border-blue-500/40' },
        { from: 'from-purple-600/20', to: 'to-purple-900/20', border: 'border-purple-500/20', text: 'text-purple-400', hover: 'hover:border-purple-500/40' },
        { from: 'from-amber-600/20', to: 'to-amber-900/20', border: 'border-amber-500/20', text: 'text-amber-400', hover: 'hover:border-amber-500/40' },
        { from: 'from-rose-600/20', to: 'to-rose-900/20', border: 'border-rose-500/20', text: 'text-rose-400', hover: 'hover:border-rose-500/40' },
        { from: 'from-cyan-600/20', to: 'to-cyan-900/20', border: 'border-cyan-500/20', text: 'text-cyan-400', hover: 'hover:border-cyan-500/40' },
    ]

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-8">
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                                <Grid3X3 size={32} className="text-purple-400" /> Categories
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">
                                Browse our collection by category
                            </p>
                        </div>
                        <Link href={`/tenant/${slug}`}
                            className="px-5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition-all">
                            All Products
                        </Link>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input type="text" placeholder="Search categories..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-900/60 border border-white/5 pl-12 pr-4 py-4 rounded-2xl text-white outline-none focus:border-purple-500/30 transition-all placeholder:text-slate-700" />
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i =>
                            <div key={i} className="h-48 bg-slate-900/60 border border-white/5 rounded-3xl animate-pulse" />
                        )}
                    </div>
                )}

                {/* Empty State */}
                {!loading && filtered.length === 0 && (
                    <div className="py-24 text-center space-y-4">
                        <Package size={48} className="mx-auto text-slate-600" />
                        <h2 className="text-xl font-bold text-white">
                            {search ? 'No matching categories' : 'No categories available'}
                        </h2>
                        <p className="text-slate-500">
                            {search ? 'Try adjusting your search' : 'Check back soon for our curated collections'}
                        </p>
                    </div>
                )}

                {/* Category Grid */}
                {!loading && filtered.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((cat, idx) => {
                            const c = COLORS[idx % COLORS.length]
                            return (
                                <Link key={cat.id} href={`/tenant/${slug}?category=${encodeURIComponent(cat.name)}`}
                                    className={`group p-6 bg-gradient-to-br ${c.from} ${c.to} ${c.border} ${c.hover} border rounded-3xl transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] block`}>
                                    <div className="space-y-4">
                                        {cat.image_url ? (
                                            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10">
                                                <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className={`w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center ${c.text}`}>
                                                <ShoppingBag size={24} />
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors">
                                                {cat.name}
                                            </h3>
                                            {cat.parent_name && (
                                                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mt-0.5">{cat.parent_name}</p>
                                            )}
                                            {cat.description && (
                                                <p className="text-slate-400 text-sm mt-1 line-clamp-2">{cat.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500 text-xs font-medium">
                                                {cat.product_count} {cat.product_count === 1 ? 'product' : 'products'}
                                            </span>
                                            <ArrowRight size={16} className={`${c.text} opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-1`} />
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
