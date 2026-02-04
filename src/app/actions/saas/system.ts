'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getSystemStatus() {
    return await erpFetch('saas/updates/status/')
}

export async function getUpdateHistory() {
    return await erpFetch('saas/updates/history/')
}

export async function uploadKernelUpdate(formData: FormData) {
    const res = await erpFetch('saas/updates/upload/', {
        method: 'POST',
        body: formData
    })
    revalidatePath('/saas/updates')
    return res
}

export async function applyKernelUpdate(id: number) {
    const res = await erpFetch('saas/updates/apply/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    })
    revalidatePath('/saas/updates')
    return res
}
