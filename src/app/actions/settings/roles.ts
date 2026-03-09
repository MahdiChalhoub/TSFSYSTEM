'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getPermissionsMatrix() {
    return await erpFetch('users/permissions-matrix/')
}

export async function updateUserPermissions(userId: number, permissions: string[]) {
    const result = await erpFetch('users/update-permissions/', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, permissions })
    })
    revalidatePath('/settings/roles')
    return result
}
