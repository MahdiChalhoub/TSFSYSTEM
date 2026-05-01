'use server'

import { erpFetch, handleAuthError } from "@/lib/erp-api"

export async function getFinancialAccounts() {
    try {
        return await erpFetch('accounts/')
    } catch (error) {
        handleAuthError(error)
        console.error("Failed to fetch financial accounts:", error)
        return []
    }
}