'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// DEPARTMENT ACTIONS (Gap 1 Fix)
// Backend: DepartmentViewSet with tree hierarchy support
// =============================================================================

export async function getDepartments() {
 return await erpFetch('hr/departments/')
}

export async function getDepartment(id: string) {
 return await erpFetch(`hr/departments/${id}/`)
}

export async function getDepartmentTree() {
 return await erpFetch('hr/departments/tree/')
}

export async function createDepartment(data: Record<string, unknown>) {
 return await erpFetch('hr/departments/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function updateDepartment(id: string, data: Record<string, unknown>) {
 return await erpFetch(`hr/departments/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(data),
 })
}

export async function deleteDepartment(id: string) {
 return await erpFetch(`hr/departments/${id}/`, {
 method: 'DELETE',
 })
}
