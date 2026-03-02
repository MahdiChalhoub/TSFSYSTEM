'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

const BASE = 'inventory/counting-sessions'
const LINES = 'inventory/counting-lines'

// ─── Sessions ────────────────────────────────────────────────────

export async function getCountingSessions(params?: Record<string, string>) {
 const query = params ? '?' + new URLSearchParams(params).toString() : ''
 return await erpFetch(`${BASE}/${query}`)
}

export async function getCountingSession(id: number) {
 return await erpFetch(`${BASE}/${id}/`)
}

export type CreateSessionInput = {
 location: string
 section: string
 warehouse?: number
 session_date: string
 person1_name?: string
 person2_name?: string
 category_filter?: string
 supplier_filter?: number
 qty_filter?: string
 qty_min?: number
 qty_max?: number
 assigned_users?: { user_id: number; user_name: string }[]
}

export async function createCountingSession(data: CreateSessionInput) {
 const result = await erpFetch(`${BASE}/`, {
 method: 'POST',
 body: JSON.stringify(data)
 })
 revalidatePath('/inventory/stock-count')
 return result
}

export async function deleteCountingSession(id: number) {
 await erpFetch(`${BASE}/${id}/`, { method: 'DELETE' })
 revalidatePath('/inventory/stock-count')
}

// ─── Session Workflow ────────────────────────────────────────────

export async function completeSession(id: number) {
 const result = await erpFetch(`${BASE}/${id}/complete/`, { method: 'POST' })
 revalidatePath('/inventory/stock-count')
 return result
}

export async function verifySession(id: number) {
 const result = await erpFetch(`${BASE}/${id}/verify/`, { method: 'POST' })
 revalidatePath('/inventory/stock-count')
 return result
}

export async function adjustSession(id: number) {
 const result = await erpFetch(`${BASE}/${id}/adjust/`, { method: 'POST' })
 revalidatePath('/inventory/stock-count')
 return result
}

// ─── Filter Options & Product Preview ────────────────────────────

export async function getFilterOptions() {
 return await erpFetch(`${BASE}/filter-options/`)
}

export async function getProductCount(params?: Record<string, string>) {
 const query = params ? '?' + new URLSearchParams(params).toString() : ''
 return await erpFetch(`${BASE}/product-count/${query}`)
}

// ─── Counting Lines ──────────────────────────────────────────────

export async function getSessionLines(sessionId: number) {
 return await erpFetch(`${LINES}/?session_id=${sessionId}`)
}

export async function submitCount(lineId: number, person: 1 | 2, physical_qty: number) {
 const result = await erpFetch(`${LINES}/${lineId}/submit-count/`, {
 method: 'PATCH',
 body: JSON.stringify({ person, physical_qty })
 })
 revalidatePath('/inventory/stock-count')
 return result
}

export async function verifyLine(lineId: number) {
 const result = await erpFetch(`${LINES}/${lineId}/verify-line/`, { method: 'POST' })
 revalidatePath('/inventory/stock-count')
 return result
}

export async function unverifyLine(lineId: number) {
 const result = await erpFetch(`${LINES}/${lineId}/unverify-line/`, { method: 'POST' })
 revalidatePath('/inventory/stock-count')
 return result
}

// ─── Internal Session Populator (Inspired by Standalone Sync) ────
const SYNC = 'inventory/sync'

export async function populateSessionLines(sessionId: number, lastId = 0) {
 const result = await erpFetch(`${SYNC}/populate/`, {
 method: 'POST',
 body: JSON.stringify({ session_id: sessionId, last_id: lastId })
 })
 revalidatePath('/inventory/stock-count')
 return result
}

export async function getLiveQty(barcode: string, warehouseId?: number) {
 const whParam = warehouseId ? `&warehouse_id=${warehouseId}` : ''
 return await erpFetch(`${SYNC}/live-qty/?barcode=${barcode}${whParam}`)
}
