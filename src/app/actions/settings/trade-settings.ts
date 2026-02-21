'use server'

import { erpFetch } from "@/lib/erp-api"

// ── Trade Sub-Type Settings ──────────────────────────────────
// Per-organization toggle for Sales/Purchase sub-type decomposition
// (Retail/Wholesale/Consignee for Sales, Standard/Wholesale/Consignee for Purchases)

export async function getTradeSubTypeSettings() {
    const data = await erpFetch('organizations/')
    if (Array.isArray(data) && data.length > 0) {
        return { enabled: data[0]?.settings?.enable_trade_sub_types ?? false }
    }
    return { enabled: false }
}

export async function updateTradeSubTypeSettings(enabled: boolean) {
    // Get current org
    const orgs = await erpFetch('organizations/')
    if (!Array.isArray(orgs) || orgs.length === 0) return { error: 'No organization found' }
    const org = orgs[0]
    const settings = { ...(org.settings || {}), enable_trade_sub_types: enabled }
    return await erpFetch(`organizations/${org.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ settings })
    })
}
