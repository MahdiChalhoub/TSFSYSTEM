'use server'

/**
 * Product Attributes V3 — Server Actions
 * ========================================
 * Tree-based attribute system: root groups (Size, Color, Parfum) with child values.
 * Used for dynamic product classification and variant generation.
 * V3: Brand linking, requires_barcode, product matrix explorer.
 */
import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

const BASE = 'inventory/product-attributes'

// ── Tree & List ──────────────────────────────────────────────

/**
 * Get full attribute tree (roots with nested children + linked categories + brands).
 */
export async function getAttributeTree() {
    try {
        return await erpFetch(`${BASE}/tree/`)
    } catch (e) {
        console.error('Failed to fetch attribute tree', e)
        return []
    }
}

/**
 * List attributes (flat). Supports filters: parent=root|<id>, is_variant=true|false, search=...
 */
export async function listAttributes(params?: Record<string, string>) {
    try {
        const qs = params ? '?' + new URLSearchParams(params).toString() : ''
        return await erpFetch(`${BASE}/${qs}`)
    } catch (e) {
        console.error('Failed to list attributes', e)
        return []
    }
}

/**
 * Get a single attribute by ID.
 */
export async function getAttribute(id: number) {
    try {
        return await erpFetch(`${BASE}/${id}/`)
    } catch (e) {
        console.error('Failed to get attribute', e)
        return null
    }
}

// ── CRUD ─────────────────────────────────────────────────────

/**
 * Create an attribute (root group or child value).
 */
export async function createAttribute(data: {
    name: string
    code?: string
    parent?: number | null
    is_variant?: boolean
    sort_order?: number
    color_hex?: string | null
    image_url?: string | null
    // V3 Nomenclature fields (root groups only)
    show_in_name?: boolean
    name_position?: number
    short_label?: string | null
    is_required?: boolean
    show_by_default?: boolean
    requires_barcode?: boolean
}) {
    try {
        const result = await erpFetch(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(data),
        })
        revalidatePath('/inventory/attributes')
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to create attribute' }
    }
}

/**
 * Update an attribute.
 */
export async function updateAttribute(id: number, data: Partial<{
    name: string
    code: string
    is_variant: boolean
    sort_order: number
    color_hex: string | null
    image_url: string | null
    // V3 Nomenclature fields
    show_in_name: boolean
    name_position: number
    short_label: string | null
    is_required: boolean
    show_by_default: boolean
    requires_barcode: boolean
}>) {
    try {
        const result = await erpFetch(`${BASE}/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        })
        revalidatePath('/inventory/attributes')
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to update attribute' }
    }
}

/**
 * Delete an attribute (and all children if root).
 */
export async function deleteAttribute(id: number) {
    try {
        await erpFetch(`${BASE}/${id}/`, { method: 'DELETE' })
        revalidatePath('/inventory/attributes')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to delete attribute' }
    }
}

// ── Shortcuts ────────────────────────────────────────────────

/**
 * Add a child value to a root attribute group.
 */
export async function addAttributeValue(rootId: number, data: {
    name: string
    code?: string
    color_hex?: string
    image_url?: string
}) {
    try {
        const result = await erpFetch(`${BASE}/${rootId}/add-value/`, {
            method: 'POST',
            body: JSON.stringify(data),
        })
        revalidatePath('/inventory/attributes')
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to add value' }
    }
}

/**
 * Reorder children within a root attribute.
 */
export async function reorderAttributeValues(rootId: number, order: number[]) {
    try {
        await erpFetch(`${BASE}/${rootId}/reorder/`, {
            method: 'POST',
            body: JSON.stringify({ order }),
        })
        revalidatePath('/inventory/attributes')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to reorder' }
    }
}

/**
 * Seed default attributes for the organization.
 */
export async function seedDefaultAttributes() {
    try {
        const result = await erpFetch(`${BASE}/seed-defaults/`, {
            method: 'POST',
        })
        revalidatePath('/inventory/attributes')
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to seed defaults' }
    }
}

// ── Category Linking ─────────────────────────────────────────

/**
 * Set linked categories for an attribute group (replaces existing).
 */
export async function linkCategories(attributeId: number, categoryIds: number[]) {
    try {
        const result = await erpFetch(`${BASE}/${attributeId}/link-categories/`, {
            method: 'POST',
            body: JSON.stringify({ category_ids: categoryIds }),
        })
        revalidatePath('/inventory/attributes')
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to link categories' }
    }
}

/**
 * Add a single category to an attribute group.
 */
export async function addCategoryToAttribute(attributeId: number, categoryId: number) {
    try {
        const result = await erpFetch(`${BASE}/${attributeId}/add-category/`, {
            method: 'POST',
            body: JSON.stringify({ category_id: categoryId }),
        })
        revalidatePath('/inventory/attributes')
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to add category' }
    }
}

/**
 * Remove a single category from an attribute group.
 */
export async function removeCategoryFromAttribute(attributeId: number, categoryId: number) {
    try {
        await erpFetch(`${BASE}/${attributeId}/remove-category/`, {
            method: 'POST',
            body: JSON.stringify({ category_id: categoryId }),
        })
        revalidatePath('/inventory/attributes')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to remove category' }
    }
}

// ── Brand Linking ────────────────────────────────────────────

/**
 * Set linked brands for an attribute group (replaces existing).
 */
export async function linkBrands(attributeId: number, brandIds: number[]) {
    try {
        const result = await erpFetch(`${BASE}/${attributeId}/link-brands/`, {
            method: 'POST',
            body: JSON.stringify({ brand_ids: brandIds }),
        })
        revalidatePath('/inventory/attributes')
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to link brands' }
    }
}

// ── Lookups ──────────────────────────────────────────────────

/**
 * Fetch all categories for the organization (for the category picker).
 */
export async function getAllCategories() {
    try {
        const data = await erpFetch('inventory/categories/')
        return Array.isArray(data) ? data : data?.results || []
    } catch (e) {
        console.error('Failed to fetch categories', e)
        return []
    }
}

/**
 * Fetch all brands for the organization (for the brand picker).
 */
export async function getAllBrands() {
    try {
        const data = await erpFetch('inventory/brands/?page_size=9999')
        return Array.isArray(data) ? data : data?.results || []
    } catch (e) {
        console.error('Failed to fetch brands', e)
        return []
    }
}

/**
 * Fetch product matrix data for the dynamic explorer.
 * Throws on failure so the frontend can show error + retry.
 */
export async function getProductMatrix() {
    try {
        const data = await erpFetch(`${BASE}/product-matrix/`)
        return data || { products: [], dimensions: {}, total: 0 }
    } catch (e) {
        console.error('Failed to fetch product matrix', e)
        // Rethrow so frontend can catch and show retry button
        throw new Error('Failed to load product matrix')
    }
}
