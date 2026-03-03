'use client'

import Link from 'next/link'
import { Grid3x3, ArrowRight, Package } from 'lucide-react'
import { useStore } from '../../engine/hooks/useStore'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'

export default function MidnightCategoriesPage() {
    const { path } = useStorefrontPath()
    const { categories, getProductsByCategory } = useStore()

    if (categories.length === 0) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-16 text-center">
                <Grid3x3 size={48} className="mx-auto text-app-text-muted mb-4" />
                <h2 className="text-xl font-bold text-white">No categories yet</h2>
                <p className="text-app-text-faint mt-2 text-sm">Categories will appear here once products are added</p>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-black text-white tracking-tight mb-8">Categories</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(cat => {
                    const catProducts = getProductsByCategory(cat.id)
                    const previewImage = catProducts.find(p => p.image_url)?.image_url
                    return (
                        <Link key={cat.id} href={path(`/?category=${cat.name}`)}
                            className="group bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all duration-300">
                            <div className="aspect-[16/9] bg-slate-950 overflow-hidden relative">
                                {previewImage ? (
                                    <img src={previewImage} alt={cat.name}
                                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Package size={40} className="text-app-text" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                            </div>
                            <div className="p-6 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors">{cat.name}</h3>
                                    <p className="text-xs text-app-text-faint mt-1">{cat.product_count} product{cat.product_count !== 1 ? 's' : ''}</p>
                                </div>
                                <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30 transition-all">
                                    <ArrowRight size={16} className="text-app-text-faint group-hover:text-emerald-400 transition-colors" />
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
