'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getProducts(params?: Record<string, string>) {
    try {
        const query = params ? '?' + new URLSearchParams(params).toString() : ''
        const data = await erpFetch(`inventory/products/${query}`)
        return Array.isArray(data) ? data : data?.results || []
    } catch (error) {
        console.error("Failed to fetch products:", error)
        return []
    }
}

export async function searchProductsSimple(query: string, siteId?: number, supplierId?: number, warehouseId?: number, stockScope?: string) {
    if (!query || query.length < 2) return []
    try {
        const q = new URLSearchParams({ query })
        if (siteId) q.append('site_id', siteId.toString())
        if (supplierId) q.append('supplier_id', supplierId.toString())
        if (warehouseId) q.append('warehouse_id', warehouseId.toString())
        if (stockScope) q.append('stock_scope', stockScope)
        return await erpFetch(`products/search_enhanced/?${q.toString()}`)
    } catch (error) {
        console.error("Failed to search products:", error)
        return []
    }
}

export async function getCategories() {
    try {
        const data = await erpFetch('inventory/categories/')
        return Array.isArray(data) ? data : data?.results || []
    } catch { return [] }
}

export async function getBrands() {
    try {
        const data = await erpFetch('inventory/brands/')
        return Array.isArray(data) ? data : data?.results || []
    } catch { return [] }
}

export async function getUnits() {
    try {
        const data = await erpFetch('inventory/units/')
        return Array.isArray(data) ? data : data?.results || []
    } catch { return [] }
}

export async function deleteProduct(id: number) {
    return await erpFetch(`inventory/products/${id}/`, { method: 'DELETE' })
}

export async function getCatalogueProducts(params: Record<string, string>) {
    try {
        const q = new URLSearchParams(params).toString()
        const data = await erpFetch(`dashboard/catalogue_list/?${q}`)
        // Backend returns {items, total, page, page_size} — NOT {results, count}
        // to avoid erpFetch auto-unwrap of DRF-style pagination
        if (data && data.items) {
            return { results: data.items, count: data.total || data.items.length }
        }
        // Fallback if auto-unwrap happened or unexpected shape
        if (Array.isArray(data)) {
            return { results: data, count: data.length }
        }
        return { results: [], count: 0 }
    } catch (e) {
        console.error('[getCatalogueProducts] Error:', e)
        return { results: [], count: 0 }
    }
}

export async function getCatalogueFilters() {
    try {
        const data = await erpFetch('dashboard/catalogue_filters/')
        return data || { categories: [], brands: [], types: [] }
    } catch (e) {
        console.error('[getCatalogueFilters] Error:', e)
        return { categories: [], brands: [], types: [] }
    }
}