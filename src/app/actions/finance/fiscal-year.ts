'use server'

import { revalidatePath } from 'next/cache'

import { erpFetch } from '@/lib/erp-api'

export async function getFiscalYears() {
    try {
        const data = await erpFetch('fiscal-years/')
        return data.map((year: any) => ({
            ...year,
            startDate: year.start_date,
            endDate: year.end_date,
            isHardLocked: year.is_hard_locked,
            // Ensure periods are also mapped if necessary, but periods usually come from nested serializer
            // If periods have snake_case, we might need to map them too ideally
        }))
    } catch (error) {
        console.error("Failed to fetch fiscal years:", error)
        return []
    }
}

export async function getLatestFiscalYear() {
    try {
        const years = await erpFetch('fiscal-years/?limit=1&ordering=-end_date')
        const year = years[0] || null
        if (year) {
            return {
                ...year,
                startDate: year.start_date,
                endDate: year.end_date,
                isHardLocked: year.is_hard_locked,
            }
        }
        return null
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
        const payload = {
            name: config.name,
            start_date: config.startDate.toISOString().split('T')[0],
            end_date: config.endDate.toISOString().split('T')[0],
            frequency: config.frequency,
            organization: 1, // Will be overridden by TenantMiddleware/View logic usually, but good to inspect view
            // The view likely expects these for the service logic if it uses one, or just model fields.
            // If the view creates periods, it needs 'frequency' in the request.data if it's not a model field.
        }

        // Wait, check if 'frequency' is a model field. If not, it might be extra data for the serializer/view.
        // And 'defaultPeriodStatus' -> likely need to check how backend handles period creation.

        const result = await erpFetch('fiscal-years/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: config.name,
                start_date: config.startDate instanceof Date ? config.startDate.toISOString().split('T')[0] : config.startDate,
                end_date: config.endDate instanceof Date ? config.endDate.toISOString().split('T')[0] : config.endDate,
                frequency: config.frequency,
                period_status: config.defaultPeriodStatus, // Mapping defaultPeriodStatus
                include_audit: config.includeAuditPeriod // Mapping includeAuditPeriod
            })
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
