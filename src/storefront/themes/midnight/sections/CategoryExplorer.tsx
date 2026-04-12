// @ts-nocheck
'use client'

import React from 'react'
import { LayoutGrid, ArrowRight } from 'lucide-react'

/**
 * CategoryExplorer — Directly powered by the Platform's Inventory Hierarchy.
 */
export default function CategoryExplorer({ categories }: SectionProps) {
    if (!categories || categories.length === 0) return null

    return (
        <section className="px-4 py-20 bg-slate-900/40 border-y border-white/5">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-end justify-between mb-12">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4 italic">
                            BROWSE BY <span className="text-emerald-500 underline decoration-emerald-500/30 underline-offset-8">CATEGORY</span>
                        </h2>
                        <p className="text-app-text-faint font-medium max-w-md">
                            Directly connected to our inventory engine. Real-time availability across all sectors.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {categories.slice(0, 8).map((cat) => (
                        <div key={cat.id} className="group relative bg-slate-900 border border-white/10 rounded-3xl p-8 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all cursor-pointer overflow-hidden">
                            {/* Decorative background glow */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[40px] -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-all" />

                            <div className="relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-app-text-faint mb-8 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-all rotate-3 group-hover:rotate-0">
                                    <LayoutGrid size={28} />
                                </div>
                                <h3 className="text-xl md:text-2xl font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tighter leading-none mb-3">
                                    {cat.name}
                                </h3>
                                <p className="text-[10px] font-black text-app-text-faint uppercase tracking-[0.2em]">
                                    {cat.product_count || 0} ITEMS IN STOCK
                                </p>
                            </div>

                            <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                <div className="w-10 h-10 rounded-full bg-emerald-500 text-app-text flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <ArrowRight size={20} strokeWidth={3} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
