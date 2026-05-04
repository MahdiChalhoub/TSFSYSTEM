'use server'

/**
 * External-driver roster actions.
 *
 * "External drivers" are one-off / contractor drivers we use occasionally
 * but don't onboard as full Users (no login, no commission ledger). They
 * appear in the PO form when `driver_source = EXTERNAL` so the operator
 * picks from a saved list instead of re-typing name + phone every time.
 *
 * Backend: pos.ExternalDriver via /api/pos/external-drivers/.
 */

import { erpFetch, handleAuthError } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export type ExternalDriver = {
    id: number
    name: string
    phone: string | null
    vehicle_plate: string | null
    vehicle_info: string | null
    notes: string | null
    is_active: boolean
}

/** List active external drivers for the current tenant. */
export async function getExternalDrivers(): Promise<ExternalDriver[]> {
    try {
        const data = await erpFetch('pos/external-drivers/?is_active=true')
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (error) {
        handleAuthError(error)
        return []
    }
}

/** Create a new external driver. Returns the created row (with id) so the
 *  PO form can preselect it after the inline "Add new" submit. */
export async function createExternalDriver(input: {
    name: string
    phone?: string
    vehicle_plate?: string
    vehicle_info?: string
}): Promise<ExternalDriver | { error: string }> {
    const name = input.name?.trim()
    if (!name) return { error: 'Name is required.' }
    try {
        const created = await erpFetch('pos/external-drivers/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                phone: input.phone || null,
                vehicle_plate: input.vehicle_plate || null,
                vehicle_info: input.vehicle_info || null,
            }),
        })
        // Bust the new-PO route caches so the next page render picks up
        // the new row in the picker without a hard refresh.
        revalidatePath('/purchases/purchase-orders/new')
        revalidatePath('/purchases/invoices/new')
        return created as ExternalDriver
    } catch (error: any) {
        handleAuthError(error)
        // Surface the most helpful error message — the unique constraint
        // on (organization, name) is the most likely failure (duplicate).
        const msg = error?.data?.detail || error?.data?.name?.[0] || error?.message || 'Failed to save driver.'
        return { error: typeof msg === 'string' ? msg : 'Failed to save driver.' }
    }
}
