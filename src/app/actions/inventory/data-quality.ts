'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ─── Data Quality ────────────────────────────────────────────────

export async function getDataQuality() {
    return await erpFetch('inventory/products/data-quality/')
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
    const body: any = {}
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
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    return await erpFetch(`inventory/products/${query}`)
}

// ─── Filter Options ──────────────────────────────────────────────

export async function getMaintenanceFilterOptions() {
    const [categories, brands, units] = await Promise.all([
        erpFetch('inventory/categories/'),
        erpFetch('inventory/brands/'),
        erpFetch('inventory/units/'),
    ])
    return { categories, brands, units }
}
