'use server'

import { erpFetch } from '@/lib/erp-api'

/**
 * Verify a manager override PIN and log the action.
 * @param pin The 4-6 digit manager PIN
 * @param action The reason for override (VOID_ORDER, APPLY_DISCOUNT, etc)
 * @param orderId Optional order ID linked to the override
 * @param details Optional details (e.g. "Overriding price from 500 to 450")
 */
export async function verifyManagerOverride(
    pin: string,
    action: string,
    orderId?: number,
    details?: string
) {
    return erpFetch('/users/verify-override/', {
        method: 'POST',
        body: JSON.stringify({ pin, action, order_id: orderId, details }),
    })
}

/**
 * Get the recent manager override logs.
 */
export async function getManagerOverrideLogs() {
    return erpFetch('/users/override-log/')
}

/**
 * Set a user's manager override PIN (Admin only).
 */
export async function setManagerOverridePin(userId: number, pin: string | null) {
    return erpFetch(`/users/${userId}/set-override-pin/`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
    })
}
