'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// DISCOUNT RULES ACTIONS (Gap 4 Fix)
// Backend: DiscountRuleViewSet
// =============================================================================

export async function getDiscountRules(params?: string) {
 const query = params ? `?${params}` : ''
 return await erpFetch(`pos/discount-rules/${query}`)
}

export async function getDiscountRule(id: string) {
 return await erpFetch(`pos/discount-rules/${id}/`)
}

export async function createDiscountRule(data: Record<string, unknown>) {
 return await erpFetch('pos/discount-rules/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function updateDiscountRule(id: string, data: Record<string, unknown>) {
 return await erpFetch(`pos/discount-rules/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(data),
 })
}

export async function deleteDiscountRule(id: string) {
 return await erpFetch(`pos/discount-rules/${id}/`, {
 method: 'DELETE',
 })
}
