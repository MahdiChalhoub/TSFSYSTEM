'use client'
import React from 'react'
import type { SectionProps } from '../../../engine/types'
import { ShieldCheck } from 'lucide-react'
/**
 * BrandShowcase — Highlighting the authorized distributors in the Platform.
 */
export default function BrandShowcase({ brands }: SectionProps) {
    if (!brands || brands.length === 0) return null
    return (
        <section className="px-4 py-16">
            <div className="max-w-6xl mx-auto">
                <div className="bg-gradient-to-br from-slate-900 to-black rounded-[4rem] p-10 md:p-20 border border-white/5 relative overflow-hidden">
                    {/* Atmospheric grid background */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                    <div className="flex flex-col md:flex-row items-center gap-16 relative z-10">
                        <div className="text-center md:text-left md:w-1/3">
                            <div className="inline-flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-6 bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20">
                                <ShieldCheck size={14} /> Global Partners
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black text-white leading-[0.9] mb-6 tracking-tighter">
                                OUR TRUSTED <span className="text-indigo-400">BRANDS</span>
                            </h2>
                            <p className="text-slate-500 text-lg font-medium leading-relaxed">
                                Curating the world's most innovative technologies. Integrated directly with our supply chain.
                            </p>
                        </div>
                        <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {brands.slice(0, 6).map(brand => (
                                <div key={brand.id} className="flex items-center justify-center p-8 h-32 bg-slate-800/20 rounded-[2rem] border border-white/[0.03] hover:border-indigo-500/40 hover:bg-slate-800/40 transition-all group cursor-pointer backdrop-blur-sm">
                                    {brand.logo ? (
                                        <img src={brand.logo} alt={brand.name} className="max-h-12 w-auto object-contain transition-all duration-500 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110" />
                                    ) : (
                                        <span className="text-sm font-black text-slate-700 group-hover:text-indigo-400 transition-colors uppercase tracking-[0.2em]">{brand.name}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
