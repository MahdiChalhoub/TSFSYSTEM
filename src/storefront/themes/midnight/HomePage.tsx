'use client'

import { useState, useMemo } from 'react'
import { ShoppingBag, Search, X, Sparkles, ArrowRight, Store, Package, Grid3x3 } from 'lucide-react'
import { useStore, useConfig, useCart } from '../../engine/hooks'
import MidnightProductCard from './ProductCard'
import type { HomePageProps } from '../../engine/types'
import Link from 'next/link'

export default function MidnightHomePage({ products, categories }: HomePageProps) {
    const { slug, orgName, orgLogo, config } = useConfig()
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    const filtered = useMemo(() => {
        return products.filter(p => {
            const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
            const matchCat = !selectedCategory || p.category_name === selectedCategory
            return matchSearch && matchCat
        })
    }, [products, search, selectedCategory])

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Promo Bar */}
            <div className="bg-emerald-600 py-2 px-4 text-center">
                <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">
                    ⚡️ Global Launch Offer: Free Shipping on all orders this week
                </p>
            </div>

            {/* Hero Section */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-transparent to-indigo-950/20" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[128px]" />

                <div className="relative max-w-6xl mx-auto px-4 pt-8 pb-12">
                    {/* Top Bar */}
                    <nav className="flex items-center justify-between mb-12">
                        <div className="flex items-center gap-3">
                            {orgLogo ? (
                                <img src={orgLogo} alt={orgName} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                            ) : (
                                <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400">
                                    <Store size={20} />
                                </div>
                            )}
                            <span className="font-black text-white text-sm tracking-tight lowercase">{orgName?.toLowerCase().replace(/\s+/g, '') || slug}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href={`/tenant/${slug}/categories`} className="text-sm text-slate-400 hover:text-white font-medium transition-colors">
                                Products
                            </Link>
                            <Link href={`/tenant/${slug}/categories`} className="text-sm text-slate-400 hover:text-white font-medium transition-colors">
                                Categories
                            </Link>
                            <Link href={`/tenant/${slug}/search`} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                                <Search size={20} />
                            </Link>
                            <Link href={`/tenant/${slug}/cart`} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                                <ShoppingBag size={20} />
                            </Link>
                            <Link href={`/tenant/${slug}/register`} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/30">
                                Sign In
                            </Link>
                        </div>
                    </nav>

                    {/* Hero Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <Sparkles size={14} className="text-emerald-400" />
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                    {config?.storefront_tagline || 'Premium Store'}
                                </span>
                            </div>
                            <h1 className="text-6xl lg:text-7xl font-black text-white tracking-tighter leading-[0.9]">
                                {orgName || slug}
                            </h1>
                            <p className="text-lg text-slate-400 leading-relaxed max-w-md">
                                Browse our catalog, explore our products, and place your orders. Premium quality, delivered to your door.
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl">
                                    <Package size={18} className="text-emerald-400" />
                                    <span className="text-sm font-bold text-white">{products.length}</span>
                                    <span className="text-xs text-slate-500">Products</span>
                                </div>
                                <div className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl">
                                    <Grid3x3 size={18} className="text-indigo-400" />
                                    <span className="text-sm font-bold text-white">{categories.length}</span>
                                    <span className="text-xs text-slate-500">Categories</span>
                                </div>
                            </div>
                        </div>

                        {/* Hero Visual — Featured Product or Decorative */}
                        {products.length > 0 && products[0]?.image_url ? (
                            <div className="relative hidden lg:block">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 rounded-[3rem] blur-3xl" />
                                <div className="relative bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[3rem] overflow-hidden aspect-square">
                                    <img src={products[0].image_url} alt={products[0].name}
                                        className="w-full h-full object-cover opacity-80" />
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-8">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="px-2 py-0.5 bg-emerald-500 rounded text-[8px] font-black text-white uppercase tracking-widest">Trending</div>
                                            <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Featured Release</p>
                                        </div>
                                        <h3 className="text-3xl font-black text-white tracking-tighter">{products[0].name}</h3>
                                        <p className="text-2xl font-black text-emerald-400 mt-1">
                                            ${products[0].selling_price_ttc}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="relative hidden lg:block">
                                <div className="bg-slate-900/40 border border-white/5 rounded-[3rem] p-12 text-center aspect-square flex flex-col items-center justify-center">
                                    <ShoppingBag size={64} className="text-slate-800 mb-4" />
                                    <h3 className="text-xl font-bold text-white">Catalog Coming Soon</h3>
                                    <p className="text-slate-500 mt-2 text-sm">Products will appear here</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Catalog Section */}
            {products.length > 0 && (
                <section className="max-w-6xl mx-auto px-4 py-16">
                    {/* Search + Filters */}
                    <div className="space-y-6 mb-12">
                        <div className="flex items-center justify-between">
                            <h2 className="text-3xl font-black text-white tracking-tighter">Featured Collection</h2>
                            <div className="flex gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Inventory</span>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-slate-900/60 border border-white/5 pl-12 pr-10 py-4 rounded-2xl text-white outline-none focus:border-emerald-500/30 transition-all placeholder:text-slate-700"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Category Pills */}
                        {categories.length > 1 && (
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border
                                        ${!selectedCategory
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                            : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
                                        }`}>
                                    All ({products.length})
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border
                                            ${selectedCategory === cat.name
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
                                            }`}>
                                        {cat.name} ({cat.product_count})
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Results info */}
                    {(search || selectedCategory) && (
                        <p className="text-xs text-slate-500 mb-6">
                            Showing {filtered.length} of {products.length} products
                            {search && <> matching &quot;<span className="text-white">{search}</span>&quot;</>}
                            {selectedCategory && <> in <span className="text-emerald-400">{selectedCategory}</span></>}
                        </p>
                    )}

                    {/* Product Grid */}
                    {filtered.length === 0 ? (
                        <div className="py-16 text-center space-y-3">
                            <Search size={36} className="mx-auto text-slate-600" />
                            <p className="text-white font-bold">No products found</p>
                            <p className="text-slate-500 text-sm">Try adjusting your search or filter</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {filtered.map((p) => (
                                <MidnightProductCard key={p.id} product={p} />
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Empty State */}
            {products.length === 0 && (
                <section className="max-w-6xl mx-auto px-4 py-16">
                    <div className="p-12 text-center bg-white/5 rounded-[3rem] border border-white/10 backdrop-blur-xl">
                        <ShoppingBag className="mx-auto text-slate-700 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-white">Catalog Coming Soon</h3>
                        <p className="text-slate-500 mt-2">We are currently updating our inventory. Please check back later.</p>
                    </div>
                </section>
            )}

            {/* Enterprise Footer Badge */}
            <div className="max-w-6xl mx-auto px-4 py-8 text-center">
                <p className="text-[10px] text-slate-800 font-bold uppercase tracking-widest">
                    Enterprise ERP Infrastructure — {orgName} Node
                </p>
            </div>
        </div>
    )
}
