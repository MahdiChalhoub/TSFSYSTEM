'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getLowStockAlerts() {
    return await erpFetch('inventory/low-stock/')
}
