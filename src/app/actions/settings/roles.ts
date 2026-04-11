'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getRoles() {
    return await erpFetch('roles/')
}

export async function getPermissions() {
    return await erpFetch('permissions/')
}

export async function updateRolePermissions(roleId: number, permissions: (number | string)[]) {
    // Assuming role update requires a PATCH request to updating `permissions` field.
    const result = await erpFetch(`roles/${roleId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions })
    })
    revalidatePath('/access/roles')
    return result
}

export async function createRole(name: string, description: string = '') {
    const result = await erpFetch('roles/', {
        method: 'POST',
        body: JSON.stringify({ name, description, permissions: [] })
    })
    revalidatePath('/access/roles')
    return result
}

// Backwards compatibility for now
export async function getPermissionsMatrix() {
    return await erpFetch('users/permissions-matrix/')
}
