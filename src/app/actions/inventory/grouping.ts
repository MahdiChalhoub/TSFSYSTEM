'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────────────────────────────
// Inventory Groups (Stock Intelligence)
// ─────────────────────────────────────────────────────────────────────

export async function getInventoryGroups(params?: Record<string, string>) {
    try {
        const query = params ? '?' + new URLSearchParams(params).toString() : ''
        const data = await erpFetch(`inventory/inventory-groups/${query}`)
        return { success: true, data: Array.isArray(data) ? data : (data?.results || []) }
    } catch (e: any) {
        return { success: false, error: e.message, data: [] }
    }
}

export async function getInventoryGroup(id: number | string) {
    try {
        const data = await erpFetch(`inventory/inventory-groups/${id}/`)
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function getInventoryGroupSummary(id: number | string) {
    try {
        const data = await erpFetch(`inventory/inventory-groups/${id}/summary/`)
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function createInventoryGroup(payload: Record<string, any>) {
    try {
        const data = await erpFetch('inventory/inventory-groups/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        revalidatePath('/inventory/product-groups')
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function updateInventoryGroup(id: number | string, payload: Record<string, any>) {
    try {
        const data = await erpFetch(`inventory/inventory-groups/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        revalidatePath('/inventory/product-groups')
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function deleteInventoryGroup(id: number | string) {
    try {
        await erpFetch(`inventory/inventory-groups/${id}/`, { method: 'DELETE' })
        revalidatePath('/inventory/product-groups')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// ─── Inventory Group Members ────────────────────────────────────────

export async function addInventoryGroupMember(payload: Record<string, any>) {
    try {
        const data = await erpFetch('inventory/inventory-group-members/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        revalidatePath('/inventory/product-groups')
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function removeInventoryGroupMember(id: number | string) {
    try {
        await erpFetch(`inventory/inventory-group-members/${id}/`, { method: 'DELETE' })
        revalidatePath('/inventory/product-groups')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// ─────────────────────────────────────────────────────────────────────
// Pricing Groups (Commercial Pricing)
// ─────────────────────────────────────────────────────────────────────

export async function getPricingGroups(params?: Record<string, string>) {
    try {
        const query = params ? '?' + new URLSearchParams(params).toString() : ''
        const data = await erpFetch(`inventory/pricing-groups/${query}`)
        return { success: true, data: Array.isArray(data) ? data : (data?.results || []) }
    } catch (e: any) {
        return { success: false, error: e.message, data: [] }
    }
}

export async function getPricingGroup(id: number | string) {
    try {
        const data = await erpFetch(`inventory/pricing-groups/${id}/`)
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function syncPricingGroupPrices(id: number | string, priceTtc?: number, priceHt?: number) {
    try {
        const data = await erpFetch(`inventory/pricing-groups/${id}/sync_prices/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price_ttc: priceTtc, price_ht: priceHt }),
        })
        revalidatePath('/inventory/product-groups')
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function checkBrokenGroup(id: number | string) {
    try {
        const data = await erpFetch(`inventory/pricing-groups/${id}/check_broken/`)
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function marginAnalysis(id: number | string, proposedPriceTtc: number) {
    try {
        const data = await erpFetch(`inventory/pricing-groups/${id}/margin_analysis/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposed_price_ttc: proposedPriceTtc }),
        })
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// ─────────────────────────────────────────────────────────────────────
// Grouping Rules (Auto-generation Engine)
// ─────────────────────────────────────────────────────────────────────

export async function getGroupingRules() {
    try {
        const data = await erpFetch('inventory/grouping-rules/?page_size=9999')
        return { success: true, data: Array.isArray(data) ? data : (data?.results || []) }
    } catch (e: any) {
        return { success: false, error: e.message, data: [] }
    }
}

export async function createGroupingRule(payload: Record<string, any>) {
    try {
        const data = await erpFetch('inventory/grouping-rules/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        revalidatePath('/inventory/product-groups')
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function updateGroupingRule(id: number | string, payload: Record<string, any>) {
    try {
        const data = await erpFetch(`inventory/grouping-rules/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        revalidatePath('/inventory/product-groups')
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function deleteGroupingRule(id: number | string) {
    try {
        await erpFetch(`inventory/grouping-rules/${id}/`, { method: 'DELETE' })
        revalidatePath('/inventory/product-groups')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// ─── Approval Workflow ──────────────────────────────────────────────

export async function approveInventoryGroup(id: number | string, action: 'approve' | 'reject') {
    try {
        const data = await erpFetch(`inventory/inventory-groups/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                approval_status: action === 'approve' ? 'APPROVED' : 'REJECTED',
            }),
        })
        revalidatePath('/inventory/product-groups')
        return { success: true, data }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
