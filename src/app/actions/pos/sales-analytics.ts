'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getSalesAnalytics(days: number = 30) {
    return await erpFetch(`pos/pos/sales-analytics/?days=${days}`)
}
