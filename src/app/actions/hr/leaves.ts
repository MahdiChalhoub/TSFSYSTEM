'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// LEAVE ACTIONS (Gap 1 Fix)
// Backend: LeaveViewSet with approve/reject actions
// =============================================================================

export async function getLeaves(params?: string) {
    const query = params ? `?${params}` : ''
    return await erpFetch(`hr/leaves/${query}`)
}

export async function getLeave(id: string) {
    return await erpFetch(`hr/leaves/${id}/`)
}

export async function createLeave(data: Record<string, unknown>) {
    return await erpFetch('hr/leaves/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function approveLeave(id: string) {
    return await erpFetch(`hr/leaves/${id}/approve/`, {
        method: 'POST',
    })
}

export async function rejectLeave(id: string, reason?: string) {
    return await erpFetch(`hr/leaves/${id}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    })
}

export async function deleteLeave(id: string) {
    return await erpFetch(`hr/leaves/${id}/`, {
        method: 'DELETE',
    })
}
