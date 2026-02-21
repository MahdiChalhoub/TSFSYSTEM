'use server'

import { erpFetch } from '@/lib/erp-api'

export async function getDiscountRules() {
    return erpFetch('/discount-rules/')
}

export async function getActiveDiscountRules() {
    return erpFetch('/discount-rules/active-rules/')
}

export async function createDiscountRule(data: Record<string, unknown>) {
    return erpFetch('/discount-rules/', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateDiscountRule(id: number, data: Record<string, unknown>) {
    return erpFetch(`/discount-rules/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteDiscountRule(id: number) {
    return erpFetch(`/discount-rules/${id}/`, { method: 'DELETE' })
}

export async function toggleDiscountRule(id: number) {
    return erpFetch(`/discount-rules/${id}/toggle/`, { method: 'POST' })
}

export async function getDiscountUsageLog(ruleId: number) {
    return erpFetch(`/discount-rules/${ruleId}/usage-log/`)
}
