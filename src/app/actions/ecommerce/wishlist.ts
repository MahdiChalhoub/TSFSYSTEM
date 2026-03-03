'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export interface WishlistItem {
    id: number
    product: number
    product_name: string
    product_image: string | null
    product_price: string
    created_at: string
}

export async function getWishlist(): Promise<WishlistItem[]> {
    const res = await erpFetch('client-portal/wishlist/?page_size=100', { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
}

export async function addToWishlist(
    productId: number,
): Promise<{ ok: boolean; item?: WishlistItem; error?: string }> {
    const res = await erpFetch('client-portal/wishlist/', {
        method: 'POST',
        body: JSON.stringify({ product: productId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.detail || 'Failed to add to wishlist' }
    revalidatePath('/store/wishlist')
    return { ok: true, item: data }
}

export async function removeFromWishlist(itemId: number): Promise<{ ok: boolean }> {
    const res = await erpFetch(`client-portal/wishlist/${itemId}/`, { method: 'DELETE' })
    if (res.ok) revalidatePath('/store/wishlist')
    return { ok: res.ok }
}

export async function submitReview(payload: {
    product: number
    rating: number
    body: string
}): Promise<{ ok: boolean; error?: string }> {
    const res = await erpFetch('client-portal/reviews/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        const msgs = typeof data === 'object' ? Object.values(data).flat().join(' ') : data
        return { ok: false, error: msgs || 'Failed to submit review' }
    }
    revalidatePath(`/store/catalog/${payload.product}`)
    return { ok: true }
}
