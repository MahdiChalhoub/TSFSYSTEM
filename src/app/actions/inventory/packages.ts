'use server'

import { erpFetch, handleAuthError } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

/**
 * ProductPackaging — the first-class packaging of a product.
 *
 * Each row ties (product, name, ratio, unit) to its OWN barcode + price
 * — so Coca Cola "Pack of 6" has different barcode/price from Sprite
 * "Pack of 6" even though they share the same template shape.
 */
export type ProductPackaging = {
    id?: number
    product: number
    product_name?: string
    product_sku?: string
    product_category_name?: string
    product_brand_name?: string
    name?: string
    display_name?: string
    sku?: string
    barcode?: string | null
    image_url?: string | null
    unit?: number | null
    unit_name?: string
    level?: number
    ratio: number
    custom_selling_price?: number | null
    custom_selling_price_ht?: number | null
    effective_selling_price?: number
    effective_selling_price_ht?: number
    effective_purchase_price?: number
    unit_selling_price?: number
    price_mode?: 'FORMULA' | 'FIXED'
    discount_pct?: number
    purchase_price_ht?: number
    purchase_price_ttc?: number
    weight_kg?: number | null
    length_cm?: number | null
    width_cm?: number | null
    height_cm?: number | null
    volume_cm3?: number | null
    is_default_purchase?: boolean
    is_default_sale?: boolean
    is_active?: boolean
    created_at?: string
}

/** Flat list across ALL products. Filters: product / unit / has_barcode / active. */
export async function listProductPackagings(filters: {
    product?: number | string
    unit?: number | string
    has_barcode?: boolean
    active?: boolean
} = {}) {
    try {
        const params = new URLSearchParams()
        if (filters.product) params.set('product', String(filters.product))
        if (filters.unit) params.set('unit', String(filters.unit))
        if (filters.has_barcode) params.set('has_barcode', '1')
        if (filters.active) params.set('active', '1')
        const qs = params.toString() ? `?${params.toString()}` : ''
        const data = await erpFetch(`product-packaging/${qs}`, { cache: 'no-store' } as any)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (e) {
        handleAuthError(e)
        console.error('Failed to list product packagings:', e)
        return []
    }
}

/** Create via the nested product endpoint. */
export async function createProductPackaging(productId: number, data: Partial<ProductPackaging>) {
    try {
        const res = await erpFetch(`inventory/products/${productId}/packaging/create/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        revalidatePath('/inventory/packages')
        revalidatePath(`/inventory/products/${productId}`)
        return { success: true, packaging: res }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to create packaging' }
    }
}

/** Update via the nested product endpoint. */
export async function updateProductPackaging(productId: number, pkgId: number, data: Partial<ProductPackaging>) {
    try {
        const res = await erpFetch(`inventory/products/${productId}/packaging/${pkgId}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        revalidatePath('/inventory/packages')
        revalidatePath(`/inventory/products/${productId}`)
        return { success: true, packaging: res }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to update packaging' }
    }
}

/** Delete via the nested product endpoint. */
export async function deleteProductPackaging(productId: number, pkgId: number) {
    try {
        await erpFetch(`inventory/products/${productId}/packaging/${pkgId}/delete/`, { method: 'DELETE' })
        revalidatePath('/inventory/packages')
        revalidatePath(`/inventory/products/${productId}`)
        return { success: true }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to delete packaging' }
    }
}

/* ═══════════════════════════════════════════════════════════
 *  Legacy UnitPackage (template) actions — still used by the
 *  suggestion engine and the existing Packaging Rules page.
 * ═══════════════════════════════════════════════════════════ */

export type UnitPackageTemplate = {
    id?: number
    unit: number
    unit_name?: string
    unit_code?: string
    name: string
    code?: string | null
    ratio: number
    is_default?: boolean
    order?: number
    notes?: string | null
}

export async function listUnitPackageTemplates(unitId?: number | string) {
    try {
        const qs = unitId ? `?unit=${unitId}` : ''
        const data = await erpFetch(`unit-packages/${qs}`, { cache: 'no-store' } as any)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (e) {        handleAuthError(e)
 return [] }
}
