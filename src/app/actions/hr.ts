'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ── Departments ──────────────────────────────────────────────

export async function getDepartments() {
    try { return await erpFetch('departments/') } catch { return [] }
}

export async function getDepartmentTree() {
    try { return await erpFetch('departments/tree/') } catch { return [] }
}

export async function createDepartment(data: Record<string, any>) {
    const res = await erpFetch('departments/', { method: 'POST', body: JSON.stringify(data) })
    revalidatePath('/hr/departments')
    return res
}

export async function updateDepartment(id: string, data: Record<string, any>) {
    const res = await erpFetch(`departments/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })
    revalidatePath('/hr/departments')
    return res
}

export async function deleteDepartment(id: string) {
    await erpFetch(`departments/${id}/`, { method: 'DELETE' })
    revalidatePath('/hr/departments')
}

// ── Shifts ───────────────────────────────────────────────────

export async function getShifts() {
    try { return await erpFetch('shifts/') } catch { return [] }
}

export async function createShift(data: Record<string, any>) {
    const res = await erpFetch('shifts/', { method: 'POST', body: JSON.stringify(data) })
    revalidatePath('/hr/shifts')
    return res
}

export async function updateShift(id: string, data: Record<string, any>) {
    const res = await erpFetch(`shifts/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })
    revalidatePath('/hr/shifts')
    return res
}

export async function deleteShift(id: string) {
    await erpFetch(`shifts/${id}/`, { method: 'DELETE' })
    revalidatePath('/hr/shifts')
}

// ── Attendance ───────────────────────────────────────────────

export async function getAttendance() {
    try { return await erpFetch('attendance/') } catch { return [] }
}

export async function createAttendance(data: Record<string, any>) {
    const res = await erpFetch('attendance/', { method: 'POST', body: JSON.stringify(data) })
    revalidatePath('/hr/attendance')
    return res
}

export async function checkIn(id: string) {
    const res = await erpFetch(`attendance/${id}/check-in/`, { method: 'POST' })
    revalidatePath('/hr/attendance')
    return res
}

export async function checkOut(id: string) {
    const res = await erpFetch(`attendance/${id}/check-out/`, { method: 'POST' })
    revalidatePath('/hr/attendance')
    return res
}

// ── Leave Requests ───────────────────────────────────────────

export async function getLeaves() {
    try { return await erpFetch('leaves/') } catch { return [] }
}

export async function createLeave(data: Record<string, any>) {
    const res = await erpFetch('leaves/', { method: 'POST', body: JSON.stringify(data) })
    revalidatePath('/hr/leaves')
    return res
}

export async function approveLeave(id: string) {
    const res = await erpFetch(`leaves/${id}/approve/`, { method: 'POST' })
    revalidatePath('/hr/leaves')
    return res
}

export async function rejectLeave(id: string) {
    const res = await erpFetch(`leaves/${id}/reject/`, { method: 'POST' })
    revalidatePath('/hr/leaves')
    return res
}
