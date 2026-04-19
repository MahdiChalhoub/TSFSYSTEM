'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getSalesAnalytics(days: number = 30) {
    return await erpFetch(`pos/pos/sales-analytics/?days=${days}`)
}

export async function getOrderAuditLog(orderId: string | number) {
    try {
        return await erpFetch(`pos/orders/${orderId}/audit-log/`);
    } catch {
        return { results: [] };
    }
}
