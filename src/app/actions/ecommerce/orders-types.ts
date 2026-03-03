// Types and constants for ecommerce orders (no 'use server' directive)

/** Human-readable label for each status */
export const STATUS_LABELS: Record<string, string> = {
    CART: 'In Cart',
    PLACED: 'Order Placed',
    CONFIRMED: 'Confirmed',
    PROCESSING: 'Processing',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    RETURNED: 'Returned',
}

/** Allowed next statuses per current status (mirrors backend ALLOWED_TRANSITIONS) */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    PLACED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED', 'RETURNED'],
    DELIVERED: ['RETURNED'],
    CANCELLED: [],
    RETURNED: [],
}
