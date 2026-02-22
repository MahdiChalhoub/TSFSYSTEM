'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ─── Data Quality ────────────────────────────────────────────────

export async function getDataQuality() {
    try {
        return await erpFetch('inventory/products/data-quality/')
    } catch {
        return {
            total_products: 0, missing_barcode: 0, missing_category: 0,
            missing_brand: 0, zero_tva: 0, zero_cost_price: 0,
            zero_selling_price: 0, missing_name: 0,
        }
    }
}

// ─── Bulk Update ─────────────────────────────────────────────────

export type ProductUpdate = {
    id: number
    name?: string
    barcode?: string | null
    tva_rate?: number
    category?: number | null
    brand?: number | null
    unit?: number | null
    parfum?: number | null
    cost_price_ht?: number
    cost_price_ttc?: number
    selling_price_ht?: number
    selling_price_ttc?: number
    size?: number | null
}

export async function bulkUpdateProducts(updates: ProductUpdate[]) {
    const result = await erpFetch('inventory/products/bulk_update/', {
        method: 'POST',
        body: JSON.stringify({ updates })
    })
    revalidatePath('/inventory/maintenance/data-quality')
    return result
}

// ─── Barcode Generation ──────────────────────────────────────────

export async function generateBarcodes(productIds?: number[]) {
    const body: Record<string, any> = {}
    if (productIds && productIds.length > 0) {
        body.product_ids = productIds
    } else {
        body.all_missing = true
    }
    const result = await erpFetch('inventory/products/generate_barcodes/', {
        method: 'POST',
        body: JSON.stringify(body)
    })
    revalidatePath('/inventory/maintenance/data-quality')
    return result
}

// ─── Fetch Products with missing data filters ───────────────────

export async function getProductsForMaintenance(params?: Record<string, string>) {
    try {
        const query = params ? '?' + new URLSearchParams(params).toString() : ''
        return await erpFetch(`inventory/products/${query}`)
    } catch {
        return []
    }
}

// ─── Filter Options ──────────────────────────────────────────────

export async function getMaintenanceFilterOptions() {
    const safeFetch = async (endpoint: string) => {
        try {
            const data = await erpFetch(endpoint)
            return Array.isArray(data) ? data : data?.results || []
        } catch {
            return []
        }
    }
    const [categories, brands, units] = await Promise.all([
        safeFetch('inventory/categories/'),
        safeFetch('inventory/brands/'),
        safeFetch('inventory/units/'),
    ])
    return { categories, brands, units }
}
