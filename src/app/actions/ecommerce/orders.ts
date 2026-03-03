'use server'

/**
 * eCommerce Admin — Order Server Actions
 * ========================================
 * Server actions for managing orders from the admin UI.
 * These are called from the ecommerce/orders page components.
 */

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TransitionResult {
    success: boolean
    order_number?: string
    previous_status?: string
    new_status?: string
    allowed_next?: string[]
    error?: string
}

export interface CouponResult {
    success: boolean
    coupon_code?: string
    discount_applied?: string
    new_total?: string
    error?: string
}

export interface PaymentConfirmResult {
    success: boolean
    order_number?: string
    payment_status?: string
    message?: string
    error?: string
}

// ── Actions ───────────────────────────────────────────────────────────────

/**
 * Transition an order to a new status.
 * Validates the transition server-side — invalid transitions return an error.
 *
 * @param orderId  - The order's numeric ID
 * @param newStatus - Target status (e.g. 'CONFIRMED', 'SHIPPED')
 * @param note      - Optional admin note appended to order history
 */
export async function transitionOrderStatus(
    orderId: number,
    newStatus: string,
    note?: string,
): Promise<TransitionResult> {
    try {
        const res = await erpFetch(`client-portal/admin-orders/${orderId}/transition/`, {
            method: 'POST',
            body: JSON.stringify({ status: newStatus, note: note ?? '' }),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }))
            return { success: false, error: err.error || `HTTP ${res.status}` }
        }

        const data = await res.json()
        revalidatePath('/ecommerce/orders')
        return {
            success: true,
            order_number: data.order_number,
            previous_status: data.previous_status,
            new_status: data.new_status,
            allowed_next: data.allowed_next,
        }
    } catch (e: unknown) {
        return { success: false, error: String(e) }
    }
}

/**
 * Apply a coupon code to a CART-status order.
 *
 * @param orderId  - The order's numeric ID
 * @param code     - Coupon code string (case-insensitive)
 */
export async function applyOrderCoupon(
    orderId: number,
    code: string,
): Promise<CouponResult> {
    try {
        const res = await erpFetch(`client-portal/my-orders/${orderId}/apply-coupon/`, {
            method: 'POST',
            body: JSON.stringify({ code: code.toUpperCase() }),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }))
            return { success: false, error: err.error || `HTTP ${res.status}` }
        }

        const data = await res.json()
        revalidatePath('/ecommerce/orders')
        return {
            success: true,
            coupon_code: data.coupon_code,
            discount_applied: data.discount_applied,
            new_total: data.new_total,
        }
    } catch (e: unknown) {
        return { success: false, error: String(e) }
    }
}

/**
 * Admin confirms a manual payment (COD or bank transfer).
 * Sets order.payment_status = 'PAID' and posts loyalty points.
 *
 * @param orderId - The order's numeric ID
 */
export async function confirmManualPayment(
    orderId: number,
): Promise<PaymentConfirmResult> {
    try {
        const res = await erpFetch(`client-portal/admin-orders/${orderId}/confirm-payment/`, {
            method: 'POST',
            body: JSON.stringify({}),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }))
            return { success: false, error: err.error || `HTTP ${res.status}` }
        }

        const data = await res.json()
        revalidatePath('/ecommerce/orders')
        return {
            success: true,
            order_number: data.order_number,
            payment_status: data.payment_status,
            message: data.message,
        }
    } catch (e: unknown) {
        return { success: false, error: String(e) }
    }
}
