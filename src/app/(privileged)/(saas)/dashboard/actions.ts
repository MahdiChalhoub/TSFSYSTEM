'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getSaasStats() {
    try {
        return await erpFetch('dashboard/saas_stats/')
    } catch (error) {
        console.error("Failed to fetch SaaS stats:", error)
        return null
    }
}
