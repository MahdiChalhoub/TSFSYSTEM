'use client'
import { ShieldCheck } from 'lucide-react'

import { useState, useMemo } from 'react'
import {
    Search,
    Menu,
    ChevronRight,
    Zap,
    ShieldCheck,
    Truck,
    Filter,
    ArrowUpDown,
    Grid2X2,
    List,
    LayoutGrid,
    Sparkles
} from 'lucide-react'
import { useConfig } from '../../engine/hooks/useConfig'
import { useCart } from '../../engine/hooks/useCart'
import type { HomePageProps } from '../../engine/types'
import EmporiumProductCard from './ProductCard'
import Link from 'next/link'

export default function EmporiumHomePage({ products = [], categories = [] }: HomePageProps) {
    const { orgName, slug, config } = useConfig()
    const [search, setSearch] = useState('')
    const [layout, setLayout] = useState<'grid' | 'compact'>('grid')
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    const filtered = useMemo(() => {
        return products.filter(p => {
            const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
            const matchCat = !selectedCategory || p.category_name === selectedCategory || p.category_id === selectedCategory
            return matchSearch && matchCat
        })
    }, [products, search, selectedCategory])

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Value Props Bar */}
            <div className="bg-slate-900 text-white py-2 text-[10px] font-bold uppercase tracking-widest px-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
                <div className="max-w-7xl mx-auto flex justify-between items-center gap-8">
                    <div className="flex items-center gap-2"><Truck size={12} className="text-yellow-400" /> Free Shipping on orders over $500</div>
                    <div className="flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-400" /> Secure Payments & Buyer Protection</div>
                    <div className="flex items-center gap-2"><Zap size={12} className="text-orange-400" /> Flash Deals: Up to 70% Off Today</div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-8 lg:px-6">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Left Sidebar — Marketplace Navigation */}
                    <aside className="hidden lg:block w-72 shrink-0 space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                    <Menu size={16} /> Categories
                                </h3>
                            </div>
                            <nav className="p-2">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between group ${!selectedCategory ? 'bg-yellow-400 text-slate-900 shadow-sm' : 'hover:bg-slate-100'}`}
                                >
                                    All Products <span className="text-[10px] opacity-60">({products.length})</span>
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.name)}
                                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between group ${selectedCategory === cat.name ? 'bg-yellow-400 text-slate-900 shadow-sm' : 'hover:bg-slate-100 text-slate-600'}`}
                                    >
                                        {cat.name}
                                        <ChevronRight size={14} className={`transition-transform ${selectedCategory === cat.name ? 'translate-x-0' : 'translate-x-1 opacity-0 group-hover:opacity-100'}`} />
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Marketplace Promo Card */}
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white overflow-hidden relative group">
                            <Sparkles className="absolute -right-2 -top-2 w-24 h-24 text-white/10 rotate-12 group-hover:scale-110 transition-transform" />
                            <h4 className="text-xl font-black leading-tight mb-2">Prime Clearance</h4>
                            <p className="text-sm text-indigo-100 mb-4 font-medium">Get exclusive access to warehouse liquidations.</p>
                            <button className="w-full py-2.5 bg-white text-indigo-700 rounded-xl text-xs font-black shadow-lg shadow-indigo-950/20 active:scale-95 transition-all">
                                VIEW DEALS
                            </button>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <div className="flex-1 space-y-6">
                        {/* Search & Orientation Bar */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4 lg:space-y-0 lg:flex lg:items-center lg:gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search Amazon, AliExpress or Shopify style catalog..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all placeholder:text-slate-400"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button
                                        onClick={() => setLayout('grid')}
                                        className={`p-2 rounded-lg transition-all ${layout === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <LayoutGrid size={18} />
                                    </button>
                                    <button
                                        onClick={() => setLayout('compact')}
                                        className={`p-2 rounded-lg transition-all ${layout === 'compact' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <List size={18} />
                                    </button>
                                </div>
                                <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-all">
                                    <ArrowUpDown size={16} /> Sort
                                </button>
                                <button className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-all">
                                    <Filter size={16} /> Filter
                                </button>
                            </div>
                        </div>

                        {/* Results Heading */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">
                                    {selectedCategory || 'Trending Now'}
                                </h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    {filtered.length} Results in {orgName || 'Platform'}
                                </p>
                            </div>
                        </div>

                        {/* Product Grid / Empty State */}
                        {filtered.length === 0 ? (
                            <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center space-y-4">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                                    <LayoutGrid size={40} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">No matches found</h3>
                                <p className="text-slate-500 max-w-xs mx-auto text-sm">We couldn't find what you're looking for. Try a different category or search term.</p>
                                <button
                                    onClick={() => { setSearch(''); setSelectedCategory(null) }}
                                    className="px-6 py-2.5 bg-yellow-400 text-slate-900 rounded-xl text-sm font-black shadow-lg shadow-yellow-200/50"
                                >
                                    CLEAR ALL FILTERS
                                </button>
                            </div>
                        ) : (
                            <div className={`grid gap-6 ${layout === 'grid' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                                {filtered.map(product => (
                                    <EmporiumProductCard
                                        key={product.id}
                                        product={product}
                                        layout={layout}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Marketplace Pager — Future Implementation */}
                        <div className="flex justify-center pt-8 pb-12">
                            <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1 shadow-sm">
                                <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-yellow-400 text-slate-900 font-black text-sm">1</button>
                                <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-500 font-bold text-sm">2</button>
                                <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-500 font-bold text-sm">3</button>
                                <div className="w-10 h-10 flex items-center justify-center text-slate-300">...</div>
                                <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-500 font-bold text-sm">
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Sticky Mobile Navbar */}
            <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 p-2 flex justify-between items-center shadow-2xl z-50">
                <button className="flex-1 py-3 text-white flex flex-col items-center gap-1">
                    <LayoutGrid size={18} className="text-yellow-400" />
                    <span className="text-[10px] font-black uppercase">Home</span>
                </button>
                <button className="flex-1 py-3 text-white flex flex-col items-center gap-1 opacity-50">
                    <Search size={18} />
                    <span className="text-[10px] font-black uppercase">Search</span>
                </button>
                <button className="flex-1 py-3 text-white flex flex-col items-center gap-1 opacity-50">
                    <Menu size={18} />
                    <span className="text-[10px] font-black uppercase">Categories</span>
                </button>
            </div>
        </div>
    )
}
