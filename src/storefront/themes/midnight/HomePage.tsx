import { useTheme } from '../../engine/ThemeProvider'
import { useConfig } from '../../engine/hooks/useConfig'
import { SectionRenderer } from '../../engine/SectionRenderer'
import { Sparkles } from 'lucide-react'
import type { HomePageProps, StorefrontPageLayout } from '../../engine/types'

const DEFAULT_LAYOUT: StorefrontPageLayout = {
    sections: [
        { type: 'hero', id: 'hero-1', settings: {} },
        { type: 'featured_collection', id: 'featured-1', settings: { title: 'Trending Now', limit: 4 } }
    ]
}

export default function MidnightHomePage({ products, categories }: HomePageProps) {
    const { components, sections } = useTheme()
    const { config } = useConfig()

    // Use layout from config or fallback to default
    const layout = config?.layout || DEFAULT_LAYOUT

    if (!components) return null

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Promo Bar */}
            <div className="bg-emerald-600 py-2.5 px-4 text-center sticky top-0 z-50 shadow-lg backdrop-blur-md">
                <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">
                    ⚡️ PLATFORM INTEGRITY: Active Node
                </p>
            </div>

            <components.Header />

            <main>
                <SectionRenderer
                    layout={layout}
                    themeComponents={components}
                    sectionsRegistry={sections}
                    products={products}
                    categories={categories}
                />
            </main>

            <components.Footer />

            {/* Platform Badge */}
            <div className="py-12 flex flex-col items-center gap-4 bg-slate-950/50 border-t border-white/5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <Sparkles size={16} />
                </div>
                <p className="text-[9px] font-black text-slate-800 uppercase tracking-[0.5em]">
                    Enterprise commerce via TSF PLATFORM
                </p>
            </div>
        </div>
    )
}
