'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

// ── Types ─────────────────────────────────────────────────────────────────

export interface StorefrontConfig {
    storefront_enabled: boolean
    storefront_name: string
    storefront_tagline: string
    banner_headline: string
    banner_subtitle: string
    primary_color: string
    logo_url: string | null
    currency: string
}

export interface CartLine {
    id: number
    product: number
    product_name: string
    product_image: string | null
    quantity: number
    unit_price: string
    line_total: string
}

export interface CartOrder {
    id: number
    order_number: string
    status: 'CART'
    subtotal: string
    total_amount: string
    discount_amount: string
    coupon_code: string | null
    lines: CartLine[]
}

// ── Storefront Config ─────────────────────────────────────────────────────

export async function getStorefrontConfig(): Promise<StorefrontConfig | null> {
    try {
        const res = await erpFetch('storefront/config/', { method: 'GET' })
        if (!res.ok) return null
        return await res.json()
    } catch { return null }
}

// ── Cart ──────────────────────────────────────────────────────────────────

export async function getCart(): Promise<CartOrder | null> {
    try {
        const res = await erpFetch('client-portal/my-orders/?status=CART&page_size=1', { method: 'GET' })
        if (!res.ok) return null
        const data = await res.json()
        const orders = data.results ?? data
        return Array.isArray(orders) && orders.length > 0 ? orders[0] : null
    } catch { return null }
}

export async function addToCart(
    productId: number,
    qty: number = 1,
): Promise<{ ok: boolean; cart?: CartOrder; error?: string }> {
    // Get or create CART order, then add/update line
    try {
        // First check if a CART order exists
        let cart = await getCart()

        if (!cart) {
            // Create a new CART order
            const res = await erpFetch('client-portal/my-orders/', {
                method: 'POST',
                body: JSON.stringify({ status: 'CART' }),
            })
            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                return { ok: false, error: d.error || 'Failed to create cart' }
            }
            cart = await res.json()
        }

        // Add line
        const lineRes = await erpFetch('client-portal/order-lines/', {
            method: 'POST',
            body: JSON.stringify({
                order: cart!.id,
                product: productId,
                quantity: qty,
            }),
        })
        if (!lineRes.ok) {
            const d = await lineRes.json().catch(() => ({}))
            return { ok: false, error: d.error || d.detail || 'Failed to add item' }
        }
        revalidatePath('/store/cart')
        const updatedCart = await getCart()
        return { ok: true, cart: updatedCart ?? undefined }
    } catch (e: unknown) {
        return { ok: false, error: String(e) }
    }
}

export async function removeFromCart(lineId: number): Promise<{ ok: boolean }> {
    const res = await erpFetch(`client-portal/order-lines/${lineId}/`, { method: 'DELETE' })
    if (res.ok) revalidatePath('/store/cart')
    return { ok: res.ok }
}

export async function updateCartQty(lineId: number, qty: number): Promise<{ ok: boolean }> {
    const res = await erpFetch(`client-portal/order-lines/${lineId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: qty }),
    })
    if (res.ok) revalidatePath('/store/cart')
    return { ok: res.ok }
}

export async function applyCoupon(
    orderId: number,
    code: string,
): Promise<{ ok: boolean; discount?: string; error?: string }> {
    const res = await erpFetch(`client-portal/my-orders/${orderId}/apply-coupon/`, {
        method: 'POST',
        body: JSON.stringify({ code }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || data.detail || 'Invalid coupon' }
    revalidatePath('/store/cart')
    return { ok: true, discount: data.discount_amount }
}

export async function previewCartPromotions(
    orderId: number,
): Promise<{ promotions: Array<{ name: string; discount: string }> }> {
    try {
        const res = await erpFetch(`client-portal/my-orders/${orderId}/preview-promotions/`, {
            method: 'GET',
        })
        if (!res.ok) return { promotions: [] }
        return await res.json()
    } catch { return { promotions: [] } }
}

export async function getShippingRatesForZone(zoneId: number) {
    try {
        const res = await erpFetch(`client-portal/my-orders/shipping-rates/?zone_id=${zoneId}`, {
            method: 'GET',
        })
        if (!res.ok) return []
        return await res.json()
    } catch { return [] }
}

export async function placeOrder(orderId: number, payload: {
    delivery_address: string
    delivery_phone: string
    delivery_notes?: string
    payment_method: string
    shipping_zone_id?: number
    coupon_code?: string
}): Promise<{ ok: boolean; order_number?: string; payment_url?: string; error?: string }> {
    const res = await erpFetch(`client-portal/my-orders/${orderId}/place-order/`, {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || data.detail || 'Failed to place order' }
    revalidatePath('/store/account/orders')
    return {
        ok: true,
        order_number: data.order_number,
        payment_url: data.payment_url,
    }
}
