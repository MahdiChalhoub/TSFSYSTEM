'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getWarehouses() {
    return await erpFetch('warehouses/')
}

export type WarehouseState = {
    message?: string;
    errors?: {
        name?: string[];
        code?: string[];
        type?: string[];
    };
};

export async function createWarehouse(prevState: WarehouseState, formData: FormData): Promise<WarehouseState> {
    const data = {
        name: formData.get('name') as string,
        code: (formData.get('code') as string)?.toUpperCase(),
        type: formData.get('type') as string,
        can_sell: formData.get('canSell') === 'on',
        is_active: formData.get('isActive') === 'on'
    }

    if (!data.name || data.name.length < 2) {
        return { message: 'Validation Error', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        await erpFetch('warehouses/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/inventory/warehouses')
        return { message: 'success' }
    } catch (e: any) {
        return { message: 'Database Error: ' + e.message }
    }
}

export async function updateWarehouse(id: number, prevState: WarehouseState, formData: FormData): Promise<WarehouseState> {
    const data = {
        name: formData.get('name') as string,
        code: (formData.get('code') as string)?.toUpperCase(),
        type: formData.get('type') as string,
        can_sell: formData.get('canSell') === 'on',
        is_active: formData.get('isActive') === 'on'
    }

    try {
        await erpFetch(`warehouses/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/inventory/warehouses')
        return { message: 'success' }
    } catch (e: any) {
        return { message: 'Database Error: ' + e.message }
    }
}

export async function deleteWarehouse(id: number) {
    try {
        await erpFetch(`warehouses/${id}/`, {
            method: 'DELETE'
        })
        revalidatePath('/inventory/warehouses')
        return { success: true }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
}