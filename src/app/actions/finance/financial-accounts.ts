'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getFinancialAccounts() {
    try {
        return await erpFetch('accounts/')
    } catch (error) {
        console.error("Failed to fetch financial accounts:", error)
        return []
    }
}