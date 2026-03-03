'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export interface Coupon {
    id: number
    code: string
    discount_type: 'PERCENT' | 'FIXED'
    value: string
    min_order_amount: string
    max_uses: number | null
    used_count: number
    valid_from: string | null
    valid_until: string | null
    is_active: boolean
    created_at: string
}

export interface CouponPayload {
    code: string
    discount_type: 'PERCENT' | 'FIXED'
    value: string
    min_order_amount?: string
    max_uses?: number | null
    valid_from?: string | null
    valid_until?: string | null
    is_active?: boolean
}

export async function getCoupons(): Promise<Coupon[]> {
    const res = await erpFetch('client-portal/coupons/', { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
}

export async function createCoupon(payload: CouponPayload): Promise<{ ok: boolean; coupon?: Coupon; error?: string }> {
    const res = await erpFetch('client-portal/coupons/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.detail || JSON.stringify(data) }
    revalidatePath('/ecommerce/coupons')
    return { ok: true, coupon: data }
}

export async function updateCoupon(
    id: number,
    payload: Partial<CouponPayload>
): Promise<{ ok: boolean; error?: string }> {
    const res = await erpFetch(`client-portal/coupons/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
    if (!res.ok) {
        const data = await res.json()
        return { ok: false, error: data.detail || JSON.stringify(data) }
    }
    revalidatePath('/ecommerce/coupons')
    return { ok: true }
}

export async function toggleCoupon(id: number, isActive: boolean): Promise<{ ok: boolean }> {
    return updateCoupon(id, { is_active: isActive })
}

export async function deleteCoupon(id: number): Promise<{ ok: boolean }> {
    const res = await erpFetch(`client-portal/coupons/${id}/`, { method: 'DELETE' })
    if (res.ok) revalidatePath('/ecommerce/coupons')
    return { ok: res.ok }
}
