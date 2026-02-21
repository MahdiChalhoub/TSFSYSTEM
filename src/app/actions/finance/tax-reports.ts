'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getTaxGroups() {
    return await erpFetch('finance/tax-groups/')
}

export async function getTaxSummary() {
    // Aggregate tax data from POS orders
    return await erpFetch('pos/pos/daily-summary/?days=30')
}
