'use server'

import { erpFetch } from '@/lib/erp-api'

interface ListResponse {
    results?: unknown[]
}

interface ActionResultOk<T = unknown> {
    success: true
    data: T
}

interface ActionResultErr {
    success: false
    error: string
    data?: unknown[]
}

type ActionResult<T = unknown> = ActionResultOk<T> | ActionResultErr

interface PolicyPayload {
    id: number | string
    [key: string]: unknown
}

function asList(data: unknown): unknown[] {
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object' && 'results' in data) {
        const r = (data as ListResponse).results
        return Array.isArray(r) ? r : []
    }
    return []
}

// ── Barcode Policy ──────────────────────────────────────────────────
export async function getBarcodePolicy(): Promise<ActionResult> {
    try {
        return { success: true, data: await erpFetch('inventory/barcode-policy/current/') }
    } catch { return { success: false, error: 'Failed to fetch barcode policy' } }
}

export async function updateBarcodePolicy(data: PolicyPayload): Promise<ActionResult> {
    try {
        const res = await erpFetch(`inventory/barcode-policy/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
        return { success: true, data: res }
    } catch { return { success: false, error: 'Failed to update barcode policy' } }
}

// ── Label Policy ────────────────────────────────────────────────────
export async function getLabelPolicy(): Promise<ActionResult> {
    try {
        return { success: true, data: await erpFetch('inventory/label-policy/current/') }
    } catch { return { success: false, error: 'Failed to fetch label policy' } }
}

export async function updateLabelPolicy(data: PolicyPayload): Promise<ActionResult> {
    try {
        const res = await erpFetch(`inventory/label-policy/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
        return { success: true, data: res }
    } catch { return { success: false, error: 'Failed to update label policy' } }
}

export async function printLabel(data: Record<string, unknown>): Promise<ActionResult> {
    try {
        const res = await erpFetch('inventory/label-records/print/', { method: 'POST', body: JSON.stringify(data) })
        return { success: true, data: res }
    } catch { return { success: false, error: 'Failed to print label' } }
}

export async function invalidateLabels(data: Record<string, unknown>): Promise<ActionResult> {
    try {
        const res = await erpFetch('inventory/label-records/invalidate/', { method: 'POST', body: JSON.stringify(data) })
        return { success: true, data: res }
    } catch { return { success: false, error: 'Failed to invalidate labels' } }
}

export async function getLabelRecords(productId?: number): Promise<ActionResult<unknown[]>> {
    try {
        const url = productId ? `inventory/label-records/?product=${productId}` : 'inventory/label-records/'
        const data = await erpFetch(url)
        return { success: true, data: asList(data) }
    } catch { return { success: false, error: 'Failed to fetch label records', data: [] } }
}

// ── Category Rules ──────────────────────────────────────────────────
export async function getCategoryRules(): Promise<ActionResult<unknown[]>> {
    try {
        const data = await erpFetch('inventory/category-rules/')
        return { success: true, data: asList(data) }
    } catch { return { success: false, error: 'Failed to fetch category rules', data: [] } }
}

export async function getCategoryRule(id: number): Promise<ActionResult> {
    try {
        return { success: true, data: await erpFetch(`inventory/category-rules/${id}/`) }
    } catch { return { success: false, error: 'Category rule not found' } }
}

export async function getRuleForCategory(categoryId: number): Promise<ActionResult> {
    try {
        return { success: true, data: await erpFetch(`inventory/category-rules/for-category/${categoryId}/`) }
    } catch { return { success: false, error: 'No rule for category' } }
}

export async function createCategoryRule(data: Record<string, unknown>): Promise<ActionResult> {
    try {
        const res = await erpFetch('inventory/category-rules/', { method: 'POST', body: JSON.stringify(data) })
        return { success: true, data: res }
    } catch { return { success: false, error: 'Failed to create category rule' } }
}

export async function updateCategoryRule(id: number, data: Record<string, unknown>): Promise<ActionResult> {
    try {
        const res = await erpFetch(`inventory/category-rules/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })
        return { success: true, data: res }
    } catch { return { success: false, error: 'Failed to update category rule' } }
}

export async function deleteCategoryRule(id: number): Promise<ActionResult<undefined>> {
    try {
        await erpFetch(`inventory/category-rules/${id}/`, { method: 'DELETE' })
        return { success: true, data: undefined }
    } catch { return { success: false, error: 'Failed to delete category rule' } }
}

// ── Product Readiness ───────────────────────────────────────────────
export async function getReadinessSummary(): Promise<ActionResult> {
    try {
        return { success: true, data: await erpFetch('inventory/product-readiness/summary/') }
    } catch { return { success: false, error: 'Failed to fetch readiness summary' } }
}

export async function getReadinessRecords(): Promise<ActionResult<unknown[]>> {
    try {
        const data = await erpFetch('inventory/product-readiness/')
        return { success: true, data: asList(data) }
    } catch { return { success: false, error: 'Failed to fetch readiness records', data: [] } }
}

export async function refreshReadiness(productId: number): Promise<ActionResult> {
    try {
        const res = await erpFetch(`inventory/product-readiness/refresh/${productId}/`, { method: 'POST' })
        return { success: true, data: res }
    } catch { return { success: false, error: 'Failed to refresh readiness' } }
}

// ── Weight Policy ───────────────────────────────────────────────────
export async function getWeightPolicy(): Promise<ActionResult> {
    try {
        return { success: true, data: await erpFetch('inventory/weight-policy/current/') }
    } catch { return { success: false, error: 'Failed to fetch weight policy' } }
}

export async function updateWeightPolicy(data: PolicyPayload): Promise<ActionResult> {
    try {
        const res = await erpFetch(`inventory/weight-policy/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
        return { success: true, data: res }
    } catch { return { success: false, error: 'Failed to update weight policy' } }
}

// ── Fresh Profiles ──────────────────────────────────────────────────
export async function getFreshProfiles(): Promise<ActionResult<unknown[]>> {
    try {
        const data = await erpFetch('inventory/fresh-profiles/')
        return { success: true, data: asList(data) }
    } catch { return { success: false, error: 'Failed to fetch fresh profiles', data: [] } }
}

export async function getFreshProfile(productId: number): Promise<ActionResult> {
    try {
        return { success: true, data: await erpFetch(`inventory/fresh-profiles/for-product/${productId}/`) }
    } catch { return { success: false, error: 'No fresh profile for this product' } }
}

export async function createFreshProfile(data: Record<string, unknown>): Promise<ActionResult> {
    try {
        const res = await erpFetch('inventory/fresh-profiles/', { method: 'POST', body: JSON.stringify(data) })
        return { success: true, data: res }
    } catch { return { success: false, error: 'Failed to create fresh profile' } }
}

export async function updateFreshProfile(id: number, data: Record<string, unknown>): Promise<ActionResult> {
    try {
        const res = await erpFetch(`inventory/fresh-profiles/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })
        return { success: true, data: res }
    } catch { return { success: false, error: 'Failed to update fresh profile' } }
}

// ── Supplier Package Prices ─────────────────────────────────────────
export async function getSupplierPricesForProduct(productId: number): Promise<ActionResult<unknown[]>> {
    try {
        const data = await erpFetch(`pos/supplier-package-prices/for-product/${productId}/`)
        return { success: true, data: asList(data) }
    } catch { return { success: false, error: 'Failed to fetch supplier prices', data: [] } }
}

export async function getBestPrice(productId: number, packagingId?: number): Promise<ActionResult> {
    try {
        let url = `pos/supplier-package-prices/best-price/${productId}/`
        if (packagingId) url += `?packaging=${packagingId}`
        return { success: true, data: await erpFetch(url) }
    } catch { return { success: false, error: 'No best price found' } }
}
