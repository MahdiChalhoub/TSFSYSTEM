'use server'

import { erpFetch } from "@/lib/erp-api"

export async function searchProductsSimple(query: string, siteId?: number) {
    if (!query || query.length < 2) return []

    try {
        const q = new URLSearchParams({
            query
        })
        if (siteId) q.append('site_id', siteId.toString())

        return await erpFetch(`products/search_enhanced/?${q.toString()}`)
    } catch (error) {
        console.error("Failed to search products:", error)
        return []
    }
}