/**
 * Sales Module — Shared Types & Constants
 * =========================================
 * Gap 1 (ERP Roadmap): 4-axis layered status model replacing the flat
 * legacy single status field. Each axis is independently tracked.
 */

// ─── Legacy (backward compat) ─────────────────────────────────────────────

/** @deprecated Use order_status / delivery_status / payment_status / invoice_status */
export type SalesOrderStatus =
    | 'DRAFT' | 'PENDING' | 'AUTHORIZED' | 'RECEIVED'
    | 'INVOICED' | 'COMPLETED' | 'CANCELLED';

export type SalesOrderType = 'SALE' | 'PURCHASE' | 'RETURN';

// ─── Gap 1: 4-Axis Workflow Status ────────────────────────────────────────

/** Lifecycle state of the order itself */
export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'PROCESSING' | 'CLOSED' | 'CANCELLED';

/** Physical delivery/shipment state */
export type DeliveryStatus = 'PENDING' | 'PARTIAL' | 'DELIVERED' | 'RETURNED' | 'NA';

/** Financial payment collection state */
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID' | 'WRITTEN_OFF';

/** Invoice generation/dispatch state */
export type InvoiceStatus = 'NOT_GENERATED' | 'GENERATED' | 'SENT' | 'DISPUTED';

// ─── Display Configs ─────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<SalesOrderStatus, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'bg-app-surface-2 text-app-muted-foreground' },
    PENDING: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    AUTHORIZED: { label: 'Authorized', color: 'bg-violet-50 text-violet-700 border-violet-100' },
    RECEIVED: { label: 'Received', color: 'bg-sky-50 text-sky-700 border-sky-100' },
    COMPLETED: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    INVOICED: { label: 'Invoiced', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-100' },
};

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'bg-app-surface-2 text-app-muted-foreground' },
    CONFIRMED: { label: 'Confirmed', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    PROCESSING: { label: 'Processing', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    CLOSED: { label: 'Closed', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-100' },
};

export const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string }> = {
    PENDING: { label: 'Pending', color: 'bg-app-surface-2 text-app-muted-foreground' },
    PARTIAL: { label: 'Partial', color: 'bg-amber-50 text-amber-700' },
    DELIVERED: { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700' },
    RETURNED: { label: 'Returned', color: 'bg-rose-50 text-rose-700' },
    NA: { label: 'N/A', color: 'bg-app-bg text-app-muted-foreground' },
};

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
    UNPAID: { label: 'Unpaid', color: 'bg-rose-50 text-rose-700 border-rose-100' },
    PARTIAL: { label: 'Partial', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    PAID: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    OVERPAID: { label: 'Overpaid', color: 'bg-violet-50 text-violet-700 border-violet-100' },
    WRITTEN_OFF: { label: 'Written Off', color: 'bg-app-surface-2 text-app-muted-foreground' },
};

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
    NOT_GENERATED: { label: 'No Invoice', color: 'bg-app-surface-2 text-app-muted-foreground' },
    GENERATED: { label: 'Generated', color: 'bg-blue-50 text-blue-700' },
    SENT: { label: 'Sent', color: 'bg-indigo-50 text-indigo-700' },
    DISPUTED: { label: 'Disputed', color: 'bg-orange-50 text-orange-700' },
};

export const TYPE_CONFIG: Record<SalesOrderType, { label: string; color: string }> = {
    SALE: { label: 'Sale', color: 'text-indigo-600' },
    PURCHASE: { label: 'Purchase', color: 'text-emerald-600' },
    RETURN: { label: 'Return', color: 'text-rose-600' },
};

// ─── Gap 5: Payment Status ───────────────────────────────────────────────

export type SalesPaymentStatus = 'PAID' | 'PARTIAL' | 'DUE';
