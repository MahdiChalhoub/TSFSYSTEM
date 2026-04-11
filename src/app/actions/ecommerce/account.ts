'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AccountSummary {
    orders_count: number
    total_spent: string
    pending_count: number
    loyalty_points: number
    wallet_balance: string
    currency: string
}

export interface TrackingEntry {
    status: string
    label: string
    date: string
    note: string
}

export interface OrderTracking {
    order_number: string
    status: string
    status_label: string
    estimated_delivery: string | null
    delivered_at: string | null
    timeline: TrackingEntry[]
}

export interface ShippingOption {
    zone_id: number
    zone_name: string
    fee: string
    estimated_days: number
    is_free: boolean
}

export interface ReturnRequestResult {
    status: 'submitted' | 'error'
    ticket_id?: number
    message: string
    error?: string
}

// ── Server Actions ─────────────────────────────────────────────────────────

/**
 * Fetches the customer's account summary (orders, loyalty, wallet).
 * Used on the storefront account dashboard.
 */
export async function getAccountSummary(): Promise<AccountSummary | null> {
    try {
        const res = await erpFetch('client-portal/my-orders/account-summary/', {
            method: 'GET',
        })
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

/**
 * Fetches the timeline for a specific order.
 * Used for the customer order tracking page.
 */
export async function trackOrder(orderId: number): Promise<OrderTracking | null> {
    try {
        const res = await erpFetch(`client-portal/my-orders/${orderId}/track/`, {
            method: 'GET',
        })
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

/**
 * Fetches available shipping zones and fees for a cart order.
 * Call before the customer selects a shipping method at checkout.
 */
export async function getShippingRates(
    orderId: number
): Promise<{ shipping_rates: ShippingOption[]; cart_weight_kg: string } | null> {
    try {
        const res = await erpFetch(`client-portal/my-orders/${orderId}/shipping-rates/`, {
            method: 'GET',
        })
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

/**
 * Submits a return/refund request for a delivered order.
 * Creates a RETURN support ticket on the backend.
 */
export async function requestReturn(
    orderId: number,
    reason: string,
    items: Array<{ line_id: number; qty: number }> = [],
): Promise<ReturnRequestResult> {
    try {
        const res = await erpFetch(`client-portal/my-orders/${orderId}/request-return/`, {
            method: 'POST',
            body: JSON.stringify({ reason, items }),
        })
        const data = await res.json()
        if (!res.ok) {
            return { status: 'error', message: data.error || 'Failed to submit return request.' }
        }
        revalidatePath('/store/account/orders')
        return {
            status: 'submitted',
            ticket_id: data.ticket_id,
            message: data.message,
        }
    } catch (e) {
        return { status: 'error', message: 'Network error. Please try again.' }
    }
}

/**
 * Available cart promotions that would apply — for preview before checkout.
 * Useful to show "You qualify for free shipping!" banners.
 */
export async function previewCartPromotions(
    orderId: number
): Promise<Array<{ name: string; discount: string; description: string }>> {
    try {
        const res = await erpFetch(
            `client-portal/my-orders/${orderId}/preview-promotions/`,
            { method: 'GET' }
        )
        if (!res.ok) return []
        const data = await res.json()
        return data.promotions || []
    } catch {
        return []
    }
}
