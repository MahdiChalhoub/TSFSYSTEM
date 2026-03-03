'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'
import type { CartPromotion, PromotionPayload } from './promotions-types'

// Re-export types for convenience (type-only re-exports are allowed from 'use server' files)
export type { RuleType, CartPromotion, PromotionPayload } from './promotions-types'

export async function getPromotions(): Promise<CartPromotion[]> {
    const res = await erpFetch('client-portal/cart-promotions/', { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
}

export async function createPromotion(
    payload: PromotionPayload
): Promise<{ ok: boolean; promotion?: CartPromotion; error?: string }> {
    const res = await erpFetch('client-portal/cart-promotions/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.detail || JSON.stringify(data) }
    revalidatePath('/ecommerce/promotions')
    return { ok: true, promotion: data }
}

export async function updatePromotion(
    id: number,
    payload: Partial<PromotionPayload>
): Promise<{ ok: boolean; error?: string }> {
    const res = await erpFetch(`client-portal/cart-promotions/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
    if (!res.ok) {
        const data = await res.json()
        return { ok: false, error: data.detail || JSON.stringify(data) }
    }
    revalidatePath('/ecommerce/promotions')
    return { ok: true }
}

export async function togglePromotion(id: number, isActive: boolean): Promise<{ ok: boolean }> {
    return updatePromotion(id, { is_active: isActive })
}

export async function deletePromotion(id: number): Promise<{ ok: boolean }> {
    const res = await erpFetch(`client-portal/cart-promotions/${id}/`, { method: 'DELETE' })
    if (res.ok) revalidatePath('/ecommerce/promotions')
    return { ok: res.ok }
}
