'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export async function calculateProductPrice(productId: number, customerGroupId?: number) {
    try {
        // 1. Get Product Baseline
        const product = await erpFetch(`/inventory/products/${productId}/`)

        if (!product) throw new Error('Product not found')

        // Default Price (Fallback)
        // Backend returns snake_case
        const basePrice = Number(product.selling_price_ttc || 0)
        let finalPrice = basePrice
        const appliedRule = null

        // TODO: Port PricingRule logic to Django Backend (PricingService)
        // For now, we return the base price.

        return {
            basePrice: basePrice,
            finalPrice: Math.max(0, finalPrice), // No negative prices
            appliedRule: appliedRule
        }
    } catch (error) {
        console.error("Error calculating price:", error)
        throw error
    }
}

export async function getPriceLists() {
    // TODO: Implement PriceList model in Django
    return []
}

export async function createPriceList(name: string) {
    // TODO: Implement PriceList creation in Django
    console.warn("createPriceList not yet implemented in backend")
    revalidatePath('/admin/finance/pricing')
}