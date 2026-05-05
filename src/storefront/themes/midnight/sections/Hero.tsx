// @ts-nocheck
'use client'

import React from 'react'
import { Sparkles, Store, Package, Grid3x3 } from 'lucide-react'
import { useConfig } from '../../../engine/hooks/useConfig'
import { useStorefrontPath } from '../../../engine/hooks/useStorefrontPath'
import Link from 'next/link'

export default function MidnightHero({ settings, products, categories }: SectionProps) {
    const { slug, orgName, orgLogo, config } = useConfig()
    const { path } = useStorefrontPath()

    // Default settings with overrides from shopify-like config
    const title = settings.title || orgName || slug
    const tagline = settings.tagline || config?.storefront_tagline || 'Premium Store'
    const description = settings.description || 'Browse our catalog, explore our products, and place your orders. Premium quality, delivered to your door.'
    const ctaText = settings.cta_text || 'Shop Now'

    return (
        <section className="relative overflow-hidden bg-slate-950">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-transparent to-indigo-950/20" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[128px]" />

            <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                            <Sparkles size={14} className="text-emerald-400" />
                            <span className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em]">
                                {tagline}
                            </span>
                        </div>

                        <h1 className="text-6xl lg:text-8xl font-black text-white tracking-tighter leading-[0.85]">
                            {title}
                        </h1>

                        <p className="text-xl text-app-muted-foreground leading-relaxed max-w-md font-medium">
                            {description}
                        </p>

                        <div className="flex flex-wrap items-center gap-4">
                            <Link href={path('/search')} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20 active:scale-[0.98]">
                                {ctaText}
                            </Link>

                            <div className="flex items-center gap-6 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-black text-white">{products?.length || 0}</span>
                                    <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Items</span>
                                </div>
                                <div className="w-px h-4 bg-white/10" />
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-black text-white">{categories?.length || 0}</span>
                                    <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Series</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Animated Visual */}
                    <div className="relative hidden lg:block perspective-1000">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-[120px] rounded-full animate-pulse" />
                        <div className="relative bg-slate-900/40 border border-white/10 rounded-[4rem] p-16 text-center aspect-square flex flex-col items-center justify-center overflow-hidden group hover:border-emerald-500/30 transition-colors">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Store size={80} className="text-emerald-500/20 mb-8 transform group-hover:scale-110 transition-transform duration-700" />
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">Original DNA</h3>
                            <p className="text-app-muted-foreground text-sm font-bold uppercase tracking-widest">Verified Multi-Tenant Node</p>

                            {/* Floating decorative cards */}
                            <div className="absolute top-10 right-10 w-24 h-32 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl backdrop-blur-md -rotate-12 animate-float" />
                            <div className="absolute bottom-10 left-10 w-20 h-28 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl backdrop-blur-md rotate-12 animate-float-delayed" />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
