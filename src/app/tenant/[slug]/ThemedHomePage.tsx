'use client'

import { useTheme } from '@/storefront/engine/ThemeProvider'
import { useConfig } from '@/storefront/engine/hooks/useConfig'
import type { Product, Category, Brand } from '@/storefront/engine/types'
import dynamic from 'next/dynamic'

// ── Type-specific homepage components (lazy-loaded) ──────────────────────────
const LandingHomePage = dynamic(() => import('@/storefront/components/LandingHomePage'), { ssr: false })
const CatalogueHomePage = dynamic(() => import('@/storefront/components/CatalogueHomePage'), { ssr: false })
const SubscriptionHomePage = dynamic(() => import('@/storefront/components/SubscriptionHomePage'), { ssr: false })
const PortfolioHomePage = dynamic(() => import('@/storefront/components/PortfolioHomePage'), { ssr: false })

/**
 * ThemedHomePage — resolves the homepage based on:
 * 1. storefront_type → picks the layout (product grid, catalogue, subscription, etc.)
 * 2. storefront_theme → picks the visual style (midnight, boutique, etc.)
 *
 * For PRODUCT_STORE, the theme's HomePage component is used.
 * For other types, a specialized component is rendered.
 */
export function ThemedHomePage({
 products,
 categories,
 brands,
}: {
 products: Product[]
 categories: Category[]
 brands: Brand[]
}) {
 const { components, loading } = useTheme()
 const { config } = useConfig()

 // Single source of truth for loading is now in ThemeLayout/ThemeShell
 if (loading || !components) return null

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
 return <HomePage products={products} categories={categories} brands={brands} />
 }
 }
}
