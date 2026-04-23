'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ─── Data Quality ────────────────────────────────────────────────

export async function getDataQuality() {
    try {
        return await erpFetch('inventory/products/data-quality/')
    } catch (e) {
        console.error('[data-quality] getDataQuality failed', e)
        return null
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
    // Use the flat route — the `inventory/` prefix variant was 404 on this
    // tenant's URL resolver. The viewset is also registered at the top-level
    // router so `products/` works identically.
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    try {
        return await erpFetch(`products/${query}`)
    } catch (e) {
        console.error('[data-quality] getProductsForMaintenance failed', e)
        return []
    }
}

// ─── Filter Options ──────────────────────────────────────────────

export async function getMaintenanceFilterOptions() {
    // Use the flat routes — `inventory/categories/` etc. are 404; the
    // actual viewsets are registered at the top-level (see erp/urls.py).
    // Resilient to individual failures so one missing lookup doesn't
    // take down the whole page.
    const [categories, brands, units] = await Promise.all([
        erpFetch('categories/').catch(() => []),
        erpFetch('brands/').catch(() => []),
        erpFetch('units/').catch(() => []),
    ])
    return { categories, brands, units }
}
