'use client'

import { useTheme } from '@/storefront/engine'
import type { Product, Category } from '@/storefront/engine/types'

/**
 * ThemedHomePage — resolves and renders the active theme's HomePage component.
 * Data (products, categories) is passed from the server component.
 */
export function ThemedHomePage({
    products,
    categories,
}: {
    products: Product[]
    categories: Category[]
}) {
    const { components, loading } = useTheme()

    if (loading || !components) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const HomePage = components.HomePage
    return <HomePage products={products} categories={categories} />
}
