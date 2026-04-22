'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

/**
 * Fetch all units
 */
export async function getUnits() {
 return await erpFetch('/units/')
}

/**
 * Create a new unit
 */
export async function createUnit(data: any) {
 const result = await erpFetch('/units/', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify(data)
 })
 revalidatePath('/inventory/units')
 return result
}

/**
 * Update an existing unit
 */
export async function updateUnit(id: string | number, data: any) {
 const result = await erpFetch(`/units/${id}/`, {
 method: 'PATCH',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify(data)
 })
 revalidatePath('/inventory/units')
 return result
}

/**
 * Delete a unit. Backend returns 409 with a conflict payload if products
 * reference this unit; the caller is expected to show a Migrate / Force
 * dialog and re-call with { force: true } on confirmation.
 */
export async function deleteUnit(id: string | number, options: { force?: boolean } = {}) {
    try {
        const url = options.force ? `/units/${id}/?force=1` : `/units/${id}/`
        await erpFetch(url, { method: 'DELETE' })
        revalidatePath('/inventory/units')
        return { success: true }
    } catch (e: any) {
        // 409 = conflict (products assigned) — caller shows the migrate dialog
        if (e?.status === 409 && e?.data) {
            return {
                success: false,
                conflict: e.data,
                message: e.data.message || 'Cannot delete: products are assigned to this unit',
            }
        }
        // 500 / generic server error — try to give the user something actionable
        const raw = e?.message || ''
        const isGenericServer = e?.status === 500 || raw.includes('Server error')
        if (isGenericServer) {
            return {
                success: false,
                message: 'The server refused to delete this unit. This usually means products, packages, or derived units are still linked to it. Migrate them first, then try again.',
                actionHint: 'Open the unit → Products tab → move them to another unit, then delete.',
            }
        }
        if (e?.status === 403 || e?.status === 401) {
            return { success: false, message: 'You don\'t have permission to delete units.' }
        }
        return { success: false, message: e?.message || 'Failed to delete unit' }
    }
}

/**
 * Fetch products assigned to a specific unit
 */
export async function getUnitProducts(unitId: number | string) {
 try {
 const data = await erpFetch(`/units/${unitId}/products/`)
 return Array.isArray(data) ? data : data?.results || []
 } catch (e) {
 console.error("Failed to fetch products for unit:", e)
 return []
 }
}

/**
 * Fetch products with search/filter/sort/pagination
 */
export async function getUnitProductsAdvanced(unitId: number | string, params: {
 search?: string; category?: string; brand?: string; status?: string;
 sort?: string; page?: number; page_size?: number;
} = {}) {
 try {
 const qs = new URLSearchParams()
 if (params.search) qs.set('search', params.search)
 if (params.category) qs.set('category', params.category)
 if (params.brand) qs.set('brand', params.brand)
 if (params.status) qs.set('status', params.status)
 if (params.sort) qs.set('sort', params.sort)
 if (params.page) qs.set('page', String(params.page))
 if (params.page_size) qs.set('page_size', String(params.page_size))
 const data = await erpFetch(`/units/${unitId}/products/?${qs.toString()}`)
 return data
 } catch (e) {
 console.error("Failed to fetch products for unit:", e)
 return { results: [], count: 0, page: 1, page_size: 50 }
 }
}

/**
 * Fetch packaging levels linked to a unit
 */
export async function getUnitPackaging(unitId: number | string) {
 try {
 const data = await erpFetch(`/units/${unitId}/linked_packaging/`)
 return Array.isArray(data) ? data : []
 } catch (e) {
 console.error("Failed to fetch packaging for unit:", e)
 return []
 }
}

/**
 * Move products to a different unit
 */
export async function moveUnitProducts(
  productIds: number[],
  targetUnitId: number,
  preview = false
) {
  const result = await erpFetch('/units/move_products/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_ids: productIds,
      target_unit_id: targetUnitId,
      preview,
    }),
  })
  if (!preview) revalidatePath('/inventory/units')
  return result
}

/* ═══════════════════════════════════════════════════════════
 *  UNIT PACKAGES — per-unit package templates
 * ═══════════════════════════════════════════════════════════ */

export type UnitPackage = {
    id?: number
    unit?: number
    name: string
    code?: string | null
    ratio: number
    is_default?: boolean
    order?: number
    notes?: string | null
}

export async function listUnitPackages(unitId: number | string) {
    try {
        const data = await erpFetch(`unit-packages/?unit=${unitId}`, { cache: 'no-store' } as any)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (e) {
        console.error('Failed to fetch unit packages:', e)
        return []
    }
}

export async function createUnitPackage(data: UnitPackage) {
    const result = await erpFetch('unit-packages/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/units')
    return result
}

export async function updateUnitPackage(id: number, data: Partial<UnitPackage>) {
    const result = await erpFetch(`unit-packages/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/units')
    return result
}

export async function deleteUnitPackage(id: number) {
    await erpFetch(`unit-packages/${id}/`, { method: 'DELETE' })
    revalidatePath('/inventory/units')
    return { success: true }
}
