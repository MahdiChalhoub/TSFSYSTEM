'use client'

import { useState, useMemo } from 'react'
import { ShoppingBag, Search, X, Sparkles, ArrowRight, Store, Package, Grid3x3 } from 'lucide-react'
import { useStore, useConfig, useCart } from '../../engine/hooks'
import MidnightProductCard from './ProductCard'
import { Badge } from '@/components/ui/badge'
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
            {/* Hero Section */}
            <section className="relative overflow-hidden pt-6 pb-20">
                {/* Immersive Background Layers */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[10%] right-[-5%] w-[35%] h-[35%] bg-indigo-500/10 rounded-full blur-[100px]" />
                    <div className="absolute top-[20%] right-[15%] w-[25%] h-[25%] bg-emerald-400/5 rounded-full blur-[80px]" />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-6">
                    {/* Top Bar / Navigation */}
                    <nav className="flex items-center justify-between mb-20 p-4 bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-3xl">
                        <div className="flex items-center gap-4 pl-2">
                            {orgLogo ? (
                                <img src={orgLogo} alt={orgName} className="w-10 h-10 rounded-xl object-cover border border-white/10 shadow-lg shadow-black/50" />
                            ) : (
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                    <Store size={20} strokeWidth={2.5} />
                                </div>
                            )}
                            <div className="flex flex-col -space-y-1">
                                <span className="font-black text-white text-base tracking-tighter lowercase">{orgName?.toLowerCase().replace(/\s+/g, '') || slug}</span>
                                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-[0.2em]">Node Active</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pr-2">
                            <div className="hidden md:flex items-center gap-1 mr-4">
                                <Link href={`/tenant/${slug}/categories`} className="px-4 py-2 text-xs text-slate-400 hover:text-white font-black uppercase tracking-widest transition-all">
                                    Products
                                </Link>
                                <Link href={`/tenant/${slug}/categories`} className="px-4 py-2 text-xs text-slate-400 hover:text-white font-black uppercase tracking-widest transition-all">
                                    Categories
                                </Link>
                            </div>
                            <div className="flex items-center gap-1">
                                <Link href={`/tenant/${slug}/search`} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-emerald-400 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-white/5">
                                    <Search size={18} />
                                </Link>
                                <Link href={`/tenant/${slug}/cart`} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-emerald-400 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-white/5 relative">
                                    <ShoppingBag size={18} />
                                    <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-slate-950" />
                                </Link>
                            </div>
                            <div className="h-8 w-px bg-white/10 mx-2" />
                            <Link href={`/tenant/${slug}/register`} className="px-6 py-2.5 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 hover:text-black transition-all shadow-xl shadow-black/20">
                                Sign In
                            </Link>
                        </div>
                    </nav>

                    {/* Hero Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
                        <div className="lg:col-span-7 space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000">
                            <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full backdrop-blur-md">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">
                                    {config?.storefront_tagline || 'Platform Authenticated'}
                                </span>
                            </div>
                            <h1 className="text-7xl lg:text-[10rem] font-black text-white tracking-[-0.06em] leading-[0.8] drop-shadow-2xl">
                                {orgName || slug}
                            </h1>
                            <p className="text-xl text-slate-400 leading-relaxed max-w-xl font-medium">
                                Secure enterprise gateway for <span className="text-white font-bold">{orgName}</span>.
                                High-performance infrastructure for modern commerce and real-time inventory management.
                            </p>

                            <div className="flex flex-wrap items-center gap-6 pt-4">
                                <div className="group flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-3xl hover:bg-white/10 transition-all cursor-default backdrop-blur-sm">
                                    <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                        <Package size={22} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-black text-white leading-none">{products.length}</div>
                                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Stock Items</div>
                                    </div>
                                </div>
                                <div className="group flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-3xl hover:bg-white/10 transition-all cursor-default backdrop-blur-sm">
                                    <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                        <Grid3x3 size={22} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-black text-white leading-none">{categories.length}</div>
                                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Clusters</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Immersive Visual Component */}
                        <div className="lg:col-span-5 relative animate-in fade-in slide-in-from-right-12 duration-1000 delay-300">
                            {products.length > 0 && products[0]?.image_url ? (
                                <div className="relative group">
                                    <div className="absolute inset-x-[-10%] inset-y-[-10%] bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 rounded-[4rem] blur-[80px] group-hover:scale-110 transition-transform duration-1000" />
                                    <div className="relative bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[4rem] overflow-hidden aspect-[4/5] shadow-2xl shadow-black/80 ring-1 ring-white/10">
                                        <img
                                            src={products[0].image_url}
                                            alt={products[0].name}
                                            className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-700 opacity-90 group-hover:opacity-100 scale-105 group-hover:scale-100"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/20 to-transparent opacity-80" />
                                        <div className="absolute bottom-0 inset-x-0 p-12 space-y-4">
                                            <div>
                                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-black uppercase tracking-widest text-[9px] mb-3">Featured Item</Badge>
                                                <h3 className="text-4xl font-black text-white tracking-tighter leading-none">{products[0].name}</h3>
                                            </div>
                                            <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/10">
                                                <div className="text-4xl font-black text-emerald-400 tracking-tighter">
                                                    <span className="text-xl mr-0.5">$</span>{products[0].selling_price_ttc}
                                                </div>
                                                <Link
                                                    href={`/tenant/${slug}/product/${products[0].id}`}
                                                    className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center hover:bg-emerald-400 transition-all shadow-xl shadow-black/40 group-hover:rotate-12"
                                                >
                                                    <ArrowRight size={24} strokeWidth={2.5} />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white/[0.02] border border-white/5 rounded-[4rem] p-16 text-center aspect-[4/5] flex flex-col items-center justify-center backdrop-blur-sm">
                                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10">
                                        <ShoppingBag size={48} className="text-slate-700" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">Node Initializing</h3>
                                    <p className="text-slate-500 mt-4 text-sm font-medium leading-relaxed max-w-[200px]">Inventory manifests are currently being synchronized.</p>
                                </div>
                            )}
                        </div>
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
                            <div className="flex flex-wrap gap-4">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`relative px-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all
                                        ${!selectedCategory ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                                    All Clusters
                                    {!selectedCategory && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 rounded-full animate-in zoom-in duration-300" />}
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                                        className={`relative px-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all
                                            ${selectedCategory === cat.name ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                                        {cat.name}
                                        {selectedCategory === cat.name && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 rounded-full animate-in zoom-in duration-300" />}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {filtered.map((p, index) => (
                                <div
                                    key={p.id}
                                    className="animate-in fade-in slide-in-from-bottom-12 duration-1000 fill-mode-both"
                                    style={{ animationDelay: `${index * 150}ms` }}
                                >
                                    <MidnightProductCard product={p} />
                                </div>
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
