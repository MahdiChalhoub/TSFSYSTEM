// @ts-nocheck
'use client'

import React from 'react'
import { ArrowRight, Zap } from 'lucide-react'

/**
 * MidnightPromoBanner — A high-impact promotional section.
 */
export default function MidnightPromoBanner({ settings }: SectionProps) {
    const title = settings.title || 'Elite Performance'
    const subtitle = settings.subtitle || 'Experience the next generation of commerce technology. Fast, secured, and modular.'
    const buttonText = settings.buttonText || 'Discover More'

    return (
        <section className="px-4 py-8">
            <div className="max-w-6xl mx-auto bg-gradient-to-br from-emerald-600/10 to-indigo-600/10 border border-white/5 rounded-[3rem] p-10 md:p-16 backdrop-blur-3xl relative overflow-hidden group">
                {/* Background flare */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] -mr-64 -mt-64 transition-all group-hover:bg-emerald-500/10" />

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                    <div className="text-center md:text-left flex-1">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[11px] font-black uppercase tracking-[0.2em] border border-emerald-500/20 mb-6">
                            <Zap size={14} fill="currentColor" /> System Performance: 100%
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6 leading-[0.9]">
                            {title.toUpperCase()}
                        </h2>
                        <p className="text-app-muted-foreground font-medium text-lg max-w-xl leading-relaxed">
                            {subtitle}
                        </p>
                    </div>

                    <button className="h-20 px-12 bg-app-surface text-app-foreground font-black text-lg rounded-3xl flex items-center gap-4 hover:bg-emerald-400 hover:scale-110 transition-all shadow-2xl shadow-emerald-900/20 active:scale-95 shrink-0 group/btn">
                        {buttonText}
                        <ArrowRight size={24} className="group-hover/btn:translate-x-2 transition-transform" />
                    </button>
                </div>
            </div>
        </section>
    )
}
