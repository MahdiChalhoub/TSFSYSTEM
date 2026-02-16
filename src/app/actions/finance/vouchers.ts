'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getVouchers(type?: string, status?: string) {
    const params = new URLSearchParams()
    if (type) params.append('type', type)
    if (status) params.append('status', status)
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
    try {
        const voucher = await erpFetch('vouchers/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath('/finance/vouchers')
        return { success: true, id: voucher.id, reference: voucher.reference }
    } catch (e: any) {
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
    } catch (e: any) {
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
    } catch (e: any) {
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
    } catch (e: any) {
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
    } catch (e: any) {
        console.error("Delete Voucher Failed", e)
        throw e
    }
}
