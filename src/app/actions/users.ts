'use server'

import { erpFetch, handleAuthError } from "@/lib/erp-api"

export async function getUsers() {
    try {
        const data = await erpFetch('users/')
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (error) {
        handleAuthError(error)
        return []
    }
}
