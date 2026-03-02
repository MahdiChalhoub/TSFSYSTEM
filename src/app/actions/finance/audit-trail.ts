'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getAuditLogs(filters?: {
 model_name?: string
 change_type?: string
 page?: number
}) {
 const params = new URLSearchParams()
 if (filters?.model_name) params.set('model_name', filters.model_name)
 if (filters?.change_type) params.set('change_type', filters.change_type)
 if (filters?.page) params.set('page', String(filters.page))
 params.set('page_size', '50')
 const qs = params.toString() ? `?${params.toString()}` : ''
 try {
 const data = await erpFetch(`finance/audit-logs/${qs}`)
 // Handle paginated vs non-paginated response
 if (Array.isArray(data)) return { results: data, count: data.length }
 return data
 } catch {
 return { results: [], count: 0 }
 }
}
