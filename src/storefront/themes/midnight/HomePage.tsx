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

export default function MidnightHomePage({ products, categories, brands }: HomePageProps) {
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

            <main>
                <SectionRenderer
                    layout={layout}
                    themeComponents={components}
                    sectionsRegistry={sections}
                    products={products}
                    categories={categories}
                    brands={brands}
                />
            </main>
        </div>
    )
}
