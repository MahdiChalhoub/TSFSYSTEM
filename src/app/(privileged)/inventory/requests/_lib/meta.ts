import { Clock, CheckCircle2, XCircle, PlayCircle, Ban, ShoppingCart, ArrowRightLeft } from 'lucide-react'
import type {
    ProcurementRequestStatus, ProcurementRequestType, ProcurementRequestPriority,
} from '@/app/actions/inventory/procurement-requests'

/**
 * STATUS_META maps a request's *internal* status enum to the
 * **canonical procurement vocabulary** shared with /inventory/products
 * (PIPELINE_STATUS_CONFIG). Same product, same word — no more "PO Sent"
 * on one page and "Executed" on another.
 *
 * Canonical labels (from src/lib/procurement-status.ts):
 *   Available · Requested · PO Sent · PO Accepted · In Transit · Failed
 *
 * Internal request status → canonical mapping (mirrors
 * `mapRequestStatusToPipeline` in the same module):
 *   PENDING/APPROVED → Requested  (waiting for PO)
 *   EXECUTED         → PO Sent    (request closed because a PO was issued)
 *   REJECTED         → Failed     (request denied)
 *   CANCELLED        → Failed     (operator stopped it)
 *
 * When the user needs the *internal* state (audit, debugging), the
 * `internal` field below carries it. Display as a sub-line if needed.
 */
export const STATUS_META: Record<ProcurementRequestStatus, { label: string; internal: string; color: string; icon: typeof Clock }> = {
    PENDING:   { label: 'Requested', internal: 'Pending',   color: 'var(--app-warning, #f59e0b)', icon: Clock },
    APPROVED:  { label: 'Requested', internal: 'Approved',  color: 'var(--app-warning, #f59e0b)', icon: CheckCircle2 },
    EXECUTED:  { label: 'PO Sent',   internal: 'Executed',  color: 'var(--app-info, #3b82f6)',    icon: PlayCircle },
    REJECTED:  { label: 'Failed',    internal: 'Rejected',  color: 'var(--app-error, #ef4444)',   icon: XCircle },
    CANCELLED: { label: 'Failed',    internal: 'Cancelled', color: 'var(--app-error, #ef4444)',   icon: Ban },
}

export const TYPE_META: Record<ProcurementRequestType, { label: string; color: string; icon: typeof ShoppingCart }> = {
    PURCHASE: { label: 'Purchase', color: 'var(--app-info, #3b82f6)',    icon: ShoppingCart },
    TRANSFER: { label: 'Transfer', color: 'var(--app-warning, #f59e0b)', icon: ArrowRightLeft },
}

export const PRIORITY_META: Record<ProcurementRequestPriority, { label: string; color: string }> = {
    LOW:    { label: 'Low',    color: 'var(--app-muted-foreground)' },
    NORMAL: { label: 'Normal', color: 'var(--app-info, #3b82f6)' },
    HIGH:   { label: 'High',   color: 'var(--app-warning, #f59e0b)' },
    URGENT: { label: 'Urgent', color: 'var(--app-error, #ef4444)' },
}
