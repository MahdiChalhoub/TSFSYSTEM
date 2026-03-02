'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getVouchers(type?: string, lifecycle_status?: string) {
 const params = new URLSearchParams()
 if (type) params.append('type', type)
 if (lifecycle_status) params.append('lifecycle_status', lifecycle_status)
 const qs = params.toString()
 return await erpFetch(`vouchers/${qs ? `?${qs}` : ''}`)
}

export async function getVoucher(id: number) {
 return await erpFetch(`vouchers/${id}/`)
}

export type VoucherInput = {
 voucher_type: 'TRANSFER' | 'RECEIPT' | 'PAYMENT'
 amount: number
 date: string
 description?: string
 source_account_id?: number
 destination_account_id?: number
 financial_event_id?: number
 contact_id?: number
 scope?: string
}

export type VoucherUpdateInput = {
 amount?: number
 date?: string
 description?: string
 source_account_id?: number
 destination_account_id?: number
 financial_event_id?: number
 contact_id?: number
}

export async function createVoucher(data: VoucherInput) {
 if (!data.amount || data.amount <= 0) {
 throw new Error('Voucher amount must be greater than zero.')
 }
 try {
 const voucher = await erpFetch('vouchers/', {
 method: 'POST',
 body: JSON.stringify(data)
 })
 revalidatePath('/finance/vouchers')
 return { success: true, id: voucher.id, reference: voucher.reference }
 } catch (e: unknown) {
 console.error("Create Voucher Failed", e)
 throw e
 }
}

export async function updateVoucher(id: number, data: VoucherUpdateInput) {
 try {
 const voucher = await erpFetch(`vouchers/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(data)
 })
 revalidatePath('/finance/vouchers')
 return { success: true, data: voucher }
 } catch (e: unknown) {
 console.error("Update Voucher Failed", e)
 throw e
 }
}

export async function postVoucher(id: number) {
 try {
 const result = await erpFetch(`vouchers/${id}/post_voucher/`, {
 method: 'POST'
 })
 revalidatePath('/finance/vouchers')
 return { success: true, data: result }
 } catch (e: unknown) {
 console.error("Post Voucher Failed", e)
 throw e
 }
}

export async function cancelVoucher(id: number) {
 try {
 const result = await erpFetch(`vouchers/${id}/cancel_voucher/`, {
 method: 'POST'
 })
 revalidatePath('/finance/vouchers')
 return { success: true, data: result }
 } catch (e: unknown) {
 console.error("Cancel Voucher Failed", e)
 throw e
 }
}

export async function deleteVoucher(id: number) {
 try {
 await erpFetch(`vouchers/${id}/`, {
 method: 'DELETE'
 })
 revalidatePath('/finance/vouchers')
 return { success: true }
 } catch (e: unknown) {
 console.error("Delete Voucher Failed", e)
 throw e
 }
}

// ─── Lifecycle Actions ──────────────────────────────────────────

export async function lockVoucher(id: number, comment?: string) {
 const result = await erpFetch(`vouchers/${id}/lock/`, {
 method: 'POST',
 body: JSON.stringify({ comment: comment || '' })
 })
 revalidatePath('/finance/vouchers')
 return result
}

export async function unlockVoucher(id: number, comment: string) {
 const result = await erpFetch(`vouchers/${id}/unlock/`, {
 method: 'POST',
 body: JSON.stringify({ comment })
 })
 revalidatePath('/finance/vouchers')
 return result
}

export async function verifyVoucher(id: number, comment?: string) {
 const result = await erpFetch(`vouchers/${id}/verify/`, {
 method: 'POST',
 body: JSON.stringify({ comment: comment || '' })
 })
 revalidatePath('/finance/vouchers')
 return result
}

export async function confirmVoucher(id: number, comment?: string) {
 const result = await erpFetch(`vouchers/${id}/confirm/`, {
 method: 'POST',
 body: JSON.stringify({ comment: comment || '' })
 })
 revalidatePath('/finance/vouchers')
 return result
}

export async function getVoucherHistory(id: number) {
 return await erpFetch(`vouchers/${id}/lifecycle_history/`)
}
