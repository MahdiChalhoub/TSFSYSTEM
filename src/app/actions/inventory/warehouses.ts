'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getWarehouses() {
    return await erpFetch('warehouses/')
}

export type WarehouseState = {
    message?: string;
    errors?: Record<string, string[]>;
};

export async function createWarehouse(prevState: WarehouseState, formData: FormData): Promise<WarehouseState> {
    const name = formData.get('name') as string
    if (!name || name.length < 2) {
        return { message: 'Validation Error', errors: { name: ['Name must be at least 2 characters'] } }
    }

    const data: Record<string, any> = {
        name,
        code: (formData.get('code') as string)?.toUpperCase() || undefined,
        location_type: formData.get('location_type') || 'BRANCH',
        can_sell: formData.get('can_sell') === 'true',
        is_active: formData.get('is_active') !== 'false',
        parent: formData.get('parent') && formData.get('parent') !== 'null' ? Number(formData.get('parent')) : null,
        address: formData.get('address') || undefined,
        city: formData.get('city') || undefined,
        phone: formData.get('phone') || undefined,
        country: formData.get('country') ? Number(formData.get('country')) : undefined,
        vat_number: formData.get('vat_number') || undefined,
    }

    // Clean undefined values
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k])

    try {
        await erpFetch('warehouses/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })

        // Auto-create child locations for branches
        if (data.location_type === 'BRANCH' && formData.get('auto_create_store') === 'true') {
            try {
                // Get the newly created branch to use as parent
                const all = await erpFetch('warehouses/')
                const list = Array.isArray(all) ? all : (all?.results ?? [])
                const branch = list.find((w: any) => w.name === name && w.location_type === 'BRANCH')
                if (branch) {
                    await erpFetch('warehouses/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: `${name} Store`,
                            location_type: 'STORE',
                            parent: branch.id,
                            can_sell: true,
                            is_active: true,
                            country: data.country,
                            city: data.city,
                        })
                    })
                }
                if (formData.get('auto_create_warehouse') === 'true' && branch) {
                    await erpFetch('warehouses/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: `${name} Warehouse`,
                            location_type: 'WAREHOUSE',
                            parent: branch.id,
                            can_sell: false,
                            is_active: true,
                            country: data.country,
                            city: data.city,
                        })
                    })
                }
            } catch {
                // Non-critical — branch was created, auto-children failed silently
            }
        }

        revalidatePath('/inventory/warehouses')
        return { message: 'success' }
    } catch (e: unknown) {
        return { message: 'Database Error: ' + (e instanceof Error ? e.message : String(e)) }
    }
}

export async function updateWarehouse(id: number, prevState: WarehouseState, formData: FormData): Promise<WarehouseState> {
    const data: Record<string, any> = {
        name: formData.get('name') as string,
        code: (formData.get('code') as string)?.toUpperCase() || undefined,
        location_type: formData.get('location_type') || undefined,
        can_sell: formData.get('can_sell') === 'true',
        is_active: formData.get('is_active') !== 'false',
        parent: formData.get('parent') && formData.get('parent') !== 'null' ? Number(formData.get('parent')) : null,
        address: formData.get('address') || undefined,
        city: formData.get('city') || undefined,
        phone: formData.get('phone') || undefined,
        country: formData.get('country') ? Number(formData.get('country')) : undefined,
        vat_number: formData.get('vat_number') || undefined,
    }

    Object.keys(data).forEach(k => data[k] === undefined && delete data[k])

    try {
        await erpFetch(`warehouses/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/inventory/warehouses')
        return { message: 'success' }
    } catch (e: unknown) {
        return { message: 'Database Error: ' + (e instanceof Error ? e.message : String(e)) }
    }
}

export async function deleteWarehouse(id: number) {
    try {
        await erpFetch(`warehouses/${id}/`, {
            method: 'DELETE'
        })
        revalidatePath('/inventory/warehouses')
        return { success: true }
    } catch (e: unknown) {
        return { success: false, message: (e instanceof Error ? e.message : String(e)) }
    }
}