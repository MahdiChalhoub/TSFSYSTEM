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

export async function searchProductsSimple(query: string, siteId?: number) {
    if (!query || query.length < 2) return []
    try {
        const q = new URLSearchParams({ query })
        if (siteId) q.append('site_id', siteId.toString())
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