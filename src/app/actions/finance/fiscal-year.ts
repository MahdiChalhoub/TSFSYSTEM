'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

import { erpFetch } from '@/lib/erp-api'

export async function getFiscalYears() {
    try {
        return await erpFetch('fiscal-years/')
    } catch (error) {
        console.error("Failed to fetch fiscal years:", error)
        return []
    }
}

export async function getLatestFiscalYear() {
    try {
        const years = await erpFetch('fiscal-years/?limit=1&ordering=-end_date')
        return years[0] || null
    } catch (error) {
        console.error("Failed to fetch latest fiscal year:", error)
        return null
    }
}

export type FiscalYearConfig = {
    name: string
    startDate: Date
    endDate: Date
    frequency: 'MONTHLY' | 'QUARTERLY'
    defaultPeriodStatus: 'OPEN' | 'FUTURE' | 'LOCKED'
    includeAuditPeriod?: boolean
}

export async function createFiscalYear(config: FiscalYearConfig) {
    try {
        const result = await erpFetch('fiscal-years/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        })
        revalidatePath('/admin/finance/fiscal-years')
        return { success: true, id: result.id }
    } catch (error: any) {
        console.error("Failed to create fiscal year:", error)
        throw error
    }
}

export async function closeFiscalYear(id: number) {
    try {
        await erpFetch(`fiscal-years/${id}/close/`, {
            method: 'POST'
        })
        revalidatePath('/admin/finance/fiscal-years')
        return { success: true }
    } catch (error: any) {
        console.error("Failed to close fiscal year:", error)
        throw error
    }
}

export async function deleteFiscalYear(id: number) {
    try {
        await erpFetch(`fiscal-years/${id}/`, {
            method: 'DELETE'
        })
        revalidatePath('/admin/finance/fiscal-years')
        return { success: true }
    } catch (error: any) {
        console.error("Failed to delete fiscal year:", error)
        throw error
    }
}

export async function updatePeriod(periodId: number, data: any) {
    try {
        await erpFetch(`fiscal-periods/${periodId}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/admin/finance/fiscal-years')
        return { success: true }
    } catch (error: any) {
        console.error("Failed to update period:", error)
        throw error
    }
}

export async function updatePeriodStatus(periodId: number, newStatus: string) {
    try {
        await erpFetch(`fiscal-periods/${periodId}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        })
        revalidatePath('/admin/finance/fiscal-years')
        return { success: true }
    } catch (error: any) {
        console.error("Failed to update period status:", error)
        throw error
    }
}

export async function hardLockFiscalYear(id: number) {
    try {
        await erpFetch(`fiscal-years/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_hard_locked: true, status: 'CLOSED' })
        })
        revalidatePath('/admin/finance/fiscal-years')
        return { success: true }
    } catch (error: any) {
        console.error("Failed to hard lock fiscal year:", error)
        throw error
    }
}

export async function getFiscalGaps() {
    // This could remain client-side logic or be moved to Django.
    // For now, let's keep it simple and return empty or implement in Django if needed.
    return []
}

export async function transferBalancesToNextYear(fromYearId: number, toYearId: number) {
    try {
        await erpFetch(`fiscal-years/${fromYearId}/transfer-balances/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_year_id: toYearId })
        })
        revalidatePath('/admin/finance/fiscal-years')
        return { success: true }
    } catch (error: any) {
        console.error("Failed to transfer balances:", error)
        throw error
    }
}
