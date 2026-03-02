'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// CREDIT NOTE ACTIONS (Gap 4 Fix)
// Backend: CreditNoteViewSet
// =============================================================================

export async function getCreditNotes(params?: string) {
 const query = params ? `?${params}` : ''
 return await erpFetch(`pos/credit-notes/${query}`)
}

export async function getCreditNote(id: string) {
 return await erpFetch(`pos/credit-notes/${id}/`)
}

export async function createCreditNote(data: Record<string, unknown>) {
 return await erpFetch('pos/credit-notes/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function updateCreditNote(id: string, data: Record<string, unknown>) {
 return await erpFetch(`pos/credit-notes/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(data),
 })
}
