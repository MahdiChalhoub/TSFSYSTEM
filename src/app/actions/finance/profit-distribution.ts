'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getProfitDistributions() {
    return await erpFetch('profit-distribution/')
}

export async function getProfitDistribution(id: number) {
    return await erpFetch(`profit-distribution/${id}/`)
}

export async function calculateDistribution(fiscalYearId: number, allocations: Record<string, number>) {
    try {
        const result = await erpFetch('profit-distribution/calculate/', {
            method: 'POST',
            body: JSON.stringify({
                fiscal_year_id: fiscalYearId,
                allocations
            })
        })
        return { success: true, data: result }
    } catch (e: any) {
        console.error("Calculate Distribution Failed", e)
        throw e
    }
}

export type DistributionInput = {
    fiscal_year_id: number
    allocations: Record<string, number>
    distribution_date: string
    notes?: string
}

export async function createDistribution(data: DistributionInput) {
    try {
        const dist = await erpFetch('profit-distribution/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath('/finance/profit-distribution')
        return { success: true, id: dist.id }
    } catch (e: any) {
        console.error("Create Distribution Failed", e)
        throw e
    }
}

export async function postDistribution(
    id: number,
    retainedEarningsCOAId: number,
    allocationCOAMap: Record<string, number>
) {
    try {
        const result = await erpFetch(`profit-distribution/${id}/post_distribution/`, {
            method: 'POST',
            body: JSON.stringify({
                retained_earnings_coa_id: retainedEarningsCOAId,
                allocation_coa_map: allocationCOAMap
            })
        })
        revalidatePath('/finance/profit-distribution')
        return { success: true, data: result }
    } catch (e: any) {
        console.error("Post Distribution Failed", e)
        throw e
    }
}
