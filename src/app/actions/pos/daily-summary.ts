'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getDailySummary(date?: string, days?: number) {
    const params = new URLSearchParams()
    if (date) params.set('date', date)
    if (days) params.set('days', String(days))
    const qs = params.toString() ? `?${params.toString()}` : ''
    return await erpFetch(`pos/pos/daily-summary/${qs}`)
}
