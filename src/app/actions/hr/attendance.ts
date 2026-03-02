'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// ATTENDANCE ACTIONS (Gap 1 Fix)
// Backend: AttendanceViewSet with check_in/check_out actions
// =============================================================================

export async function getAttendanceRecords(params?: string) {
 const query = params ? `?${params}` : ''
 return await erpFetch(`hr/attendance/${query}`)
}

export async function getAttendanceRecord(id: string) {
 return await erpFetch(`hr/attendance/${id}/`)
}

export async function createAttendance(data: Record<string, unknown>) {
 return await erpFetch('hr/attendance/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function checkIn(id: string) {
 return await erpFetch(`hr/attendance/${id}/check_in/`, {
 method: 'POST',
 })
}

export async function checkOut(id: string) {
 return await erpFetch(`hr/attendance/${id}/check_out/`, {
 method: 'POST',
 })
}

export async function deleteAttendanceRecord(id: string) {
 return await erpFetch(`hr/attendance/${id}/`, {
 method: 'DELETE',
 })
}
