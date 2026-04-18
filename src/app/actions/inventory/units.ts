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
 * Delete a unit
 */
export async function deleteUnit(id: string | number) {
 const result = await erpFetch(`/units/${id}/`, {
 method: 'DELETE'
 })
 revalidatePath('/inventory/units')
 return result
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
