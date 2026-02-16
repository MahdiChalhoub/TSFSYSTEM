'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getVouchers(type?: string) {
    let url = 'vouchers/'
    if (type) url += `?type=${type}`
    return await erpFetch(url)
}

export async function getVoucher(id: number) {
    return await erpFetch(`vouchers/${id}/`)
}

export type VoucherInput = {
    voucher_type: 'TRANSFER' | 'RECEIPT' | 'PAYMENT'
    amount: number
    date: string
    reference?: string
    description?: string
    source_account_id?: number
    destination_account_id?: number
    financial_event_id?: number
    contact_id?: number
    scope?: string
}

export async function createVoucher(data: VoucherInput) {
    try {
        const voucher = await erpFetch('vouchers/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath('/finance/vouchers')
        return { success: true, id: voucher.id }
    } catch (e: any) {
        console.error("Create Voucher Failed", e)
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
