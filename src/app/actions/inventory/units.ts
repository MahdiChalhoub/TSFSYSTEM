'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

/**
 * Fetch all units
 */
export async function getUnits() {
    return await erpFetch('/inventory/units/')
}

/**
 * Create a new unit
 */
export async function createUnit(data: any) {
    const result = await erpFetch('/inventory/units/', {
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
    const result = await erpFetch(`/inventory/units/${id}/`, {
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
    const result = await erpFetch(`/inventory/units/${id}/`, {
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
        const data = await erpFetch(`/inventory/products/?unit=${unitId}`)
        return Array.isArray(data) ? data : data?.results || []
    } catch (e) {
        console.error("Failed to fetch products for unit:", e)
        return []
    }
}
