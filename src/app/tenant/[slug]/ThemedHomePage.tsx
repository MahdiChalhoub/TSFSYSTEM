'use client'

import { useTheme } from '@/storefront/engine'
import { useConfig } from '@/storefront/engine/hooks'
import type { Product, Category } from '@/storefront/engine/types'
import dynamic from 'next/dynamic'

// ── Type-specific homepage components (lazy-loaded) ──────────────────────────
const LandingHomePage = dynamic(() => import('@/storefront/components/LandingHomePage'), { ssr: false })
const CatalogueHomePage = dynamic(() => import('@/storefront/components/CatalogueHomePage'), { ssr: false })
const SubscriptionHomePage = dynamic(() => import('@/storefront/components/SubscriptionHomePage'), { ssr: false })
const PortfolioHomePage = dynamic(() => import('@/storefront/components/PortfolioHomePage'), { ssr: false })

/**
 * ThemedHomePage — resolves the homepage based on:
 *  1. storefront_type → picks the layout (product grid, catalogue, subscription, etc.)
 *  2. storefront_theme → picks the visual style (midnight, boutique, etc.)
 *
 * For PRODUCT_STORE, the theme's HomePage component is used.
 * For other types, a specialized component is rendered.
 */
export function ThemedHomePage({
    products,
    categories,
}: {
    products: Product[]
    categories: Category[]
}) {
    const { components, loading } = useTheme()
    const { config } = useConfig()

    if (loading || !components) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const storeType = config?.storefront_type || 'PRODUCT_STORE'

    switch (storeType) {
        case 'LANDING_PAGE':
            return <LandingHomePage />
        case 'CATALOGUE':
            return <CatalogueHomePage products={products} categories={categories} />
        case 'SUBSCRIPTION':
            return <SubscriptionHomePage />
        case 'PORTFOLIO':
            return <PortfolioHomePage />
        case 'PRODUCT_STORE':
        default: {
            // Use the theme's HomePage component (product grid e-commerce)
            const HomePage = components.HomePage
            return <HomePage products={products} categories={categories} />
        }
    }
}
