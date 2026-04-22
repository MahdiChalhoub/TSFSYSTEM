'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

/** UnitPackage — a first-class packaging template (like a mini product). */
export type Package = {
    id?: number
    unit: number
    unit_name?: string
    unit_code?: string
    unit_type?: string
    name: string
    code?: string | null
    ratio: number
    barcode?: string | null
    selling_price?: number | null
    image_url?: string | null
    is_active?: boolean
    is_default?: boolean
    order?: number
    notes?: string | null
}

export async function listPackages(unitId?: number | string) {
    try {
        const qs = unitId ? `?unit=${unitId}` : ''
        const data = await erpFetch(`unit-packages/${qs}`, { cache: 'no-store' } as any)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (e) {
        console.error('Failed to list packages:', e)
        return []
    }
}

export async function createPackage(data: Omit<Package, 'id'>) {
    try {
        const res = await erpFetch('unit-packages/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        revalidatePath('/inventory/packages')
        revalidatePath('/inventory/units')
        return { success: true, package: res }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to create package' }
    }
}

export async function updatePackage(id: number, data: Partial<Package>) {
    try {
        const res = await erpFetch(`unit-packages/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        revalidatePath('/inventory/packages')
        revalidatePath('/inventory/units')
        return { success: true, package: res }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to update package' }
    }
}

export async function deletePackage(id: number, options: { force?: boolean } = {}) {
    try {
        const url = options.force ? `unit-packages/${id}/?force=1` : `unit-packages/${id}/`
        await erpFetch(url, { method: 'DELETE' })
        revalidatePath('/inventory/packages')
        revalidatePath('/inventory/units')
        return { success: true }
    } catch (e: any) {
        if (e?.status === 409 && e?.data) {
            return { success: false, conflict: e.data, message: e.data.message || 'Cannot delete' }
        }
        return { success: false, message: e?.message || 'Failed to delete package' }
    }
}

/** Rules that currently suggest this package (linked categories/brands/attributes). */
export async function getPackageRules(packageId: number) {
    try {
        const data = await erpFetch(`packaging-suggestions/?packaging=${packageId}`, { cache: 'no-store' } as any)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (e) {
        return []
    }
}
