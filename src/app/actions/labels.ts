'use server'

import { erpFetch } from '@/lib/erp-api'

/** Get products for label printing — returns full product details including barcode */
export async function getProductsForLabels(productIds?: number[]) {
    const products = await erpFetch('/products/')
    const all = Array.isArray(products) ? products : products.results || []
    if (productIds && productIds.length > 0) {
        return all.filter((p: any) => productIds.includes(p.id))
    }
    return all
}

/** Search products by name/sku/barcode */
export async function searchProductsForLabels(query: string) {
    const products = await erpFetch('/products/')
    const all = Array.isArray(products) ? products : products.results || []
    if (!query) return all.slice(0, 50)
    const q = query.toLowerCase()
    return all.filter(
        (p: any) =>
            p.name?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.barcode?.toLowerCase().includes(q),
    ).slice(0, 50)
}
