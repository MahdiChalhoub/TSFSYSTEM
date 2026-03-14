'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getUsers() {
    try {
        const data = await erpFetch('users/')
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}
