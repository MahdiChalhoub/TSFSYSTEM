'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// SHIFT ACTIONS (Gap 1 Fix)
// Backend: ShiftViewSet — shift definition CRUD
// =============================================================================

export async function getShifts() {
 return await erpFetch('hr/shifts/')
}

export async function getShift(id: string) {
 return await erpFetch(`hr/shifts/${id}/`)
}

export async function createShift(data: Record<string, unknown>) {
 return await erpFetch('hr/shifts/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function updateShift(id: string, data: Record<string, unknown>) {
 return await erpFetch(`hr/shifts/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(data),
 })
}

export async function deleteShift(id: string) {
 return await erpFetch(`hr/shifts/${id}/`, {
 method: 'DELETE',
 })
}
