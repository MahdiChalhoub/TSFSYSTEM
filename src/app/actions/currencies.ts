'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from 'next/cache'

export type Currency = {
    id: number
    name: string
    code: string
    symbol: string
}

export async function getCurrencies(): Promise<Currency[]> {
    try {
        const result = await erpFetch('currencies/')
        return Array.isArray(result) ? result : (result.results || [])
    } catch (error) {
        console.error("Failed to fetch currencies:", error)
        return []
    }
}

export async function createCurrency(data: { name: string; code: string; symbol: string }) {
    try {
        await erpFetch('currencies/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/saas/currencies')
        return { success: true }
    } catch (error: unknown) {
        console.error("Failed to create currency:", error)
        return { success: false, error: (error instanceof Error ? error.message : String(error)) || 'Failed to create currency' }
    }
}

export async function updateCurrency(id: number, data: { name: string; code: string; symbol: string }) {
    try {
        await erpFetch(`currencies/${id}/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/saas/currencies')
        return { success: true }
    } catch (error: unknown) {
        console.error("Failed to update currency:", error)
        return { success: false, error: (error instanceof Error ? error.message : String(error)) || 'Failed to update currency' }
    }
}

export async function deleteCurrency(id: number) {
    try {
        await erpFetch(`currencies/${id}/`, {
            method: 'DELETE'
        })
        revalidatePath('/saas/currencies')
        return { success: true }
    } catch (error: unknown) {
        console.error("Failed to delete currency:", error)
        return { success: false, error: (error instanceof Error ? error.message : String(error)) || 'Failed to delete currency' }
    }
}
