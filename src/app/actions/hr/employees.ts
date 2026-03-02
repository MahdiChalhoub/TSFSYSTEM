'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getEmployees() {
 return await erpFetch('hr/employees/')
}

export async function getEmployee(id: string) {
 return await erpFetch(`hr/employees/${id}/`)
}
