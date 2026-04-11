'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

const BASE = 'inventory/price-approval-policies'

// ── Price Approval Policy CRUD ──

export async function listPriceApprovalPolicies(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return erpFetch(`${BASE}/${qs}`)
}

export async function getPriceApprovalPolicy(id: number) {
    return erpFetch(`${BASE}/${id}/`)
}

export async function createPriceApprovalPolicy(data: Record<string, any>) {
    const res = await erpFetch(`${BASE}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/price-governance')
    return res
}

export async function updatePriceApprovalPolicy(id: number, data: Record<string, any>) {
    const res = await erpFetch(`${BASE}/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/price-governance')
    return res
}

export async function deletePriceApprovalPolicy(id: number) {
    const res = await erpFetch(`${BASE}/${id}/`, { method: 'DELETE' })
    revalidatePath('/inventory/price-governance')
    return res
}

export async function togglePolicyActive(id: number) {
    const res = await erpFetch(`${BASE}/${id}/toggle_active/`, { method: 'POST' })
    revalidatePath('/inventory/price-governance')
    return res
}
