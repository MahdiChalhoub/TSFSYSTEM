'use server'

import { erpFetch } from "@/lib/erp-api"

export async function searchProductsSimple(
    query: string,
    siteId?: number,
    supplierId?: number,
    opts?: { stockScope?: 'branch' | 'all'; warehouseId?: number },
) {
    if (!query || query.length < 2) return []

    try {
        const q = new URLSearchParams({ query })
        if (siteId) q.append('site_id', siteId.toString())
        if (supplierId) q.append('supplier_id', supplierId.toString())
        if (opts?.stockScope) q.append('stock_scope', opts.stockScope)
        if (opts?.warehouseId) q.append('warehouse_id', opts.warehouseId.toString())

        return await erpFetch(`products/search_enhanced/?${q.toString()}`)
    } catch (error) {
        console.error("Failed to search products:", error)
        return []
    }
}

export async function getCatalogueProducts(params: Record<string, string> = {}) {
    try {
        const q = new URLSearchParams(params)
        return await erpFetch(`dashboard/catalogue_list/?${q.toString()}`)
    } catch (error) {
        console.error("Failed to fetch catalogue products:", error)
        return { results: [], count: 0 }
    }
}

export async function getCatalogueFilters() {
    try {
        return await erpFetch(`dashboard/catalogue_filters/`)
    } catch (error) {
        console.error("Failed to fetch catalogue filters:", error)
        return { categories: [], brands: [], types: [] }
    }
}