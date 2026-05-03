import { Clock, CheckCircle2, XCircle, PlayCircle, Ban, ShoppingCart, ArrowRightLeft, Truck, AlertTriangle, Package, AlertCircle } from 'lucide-react'
import type {
    ProcurementRequestStatus, ProcurementRequestType, ProcurementRequestPriority,
} from '@/app/actions/inventory/procurement-requests'
import {
    PIPELINE_STATUS_CONFIG,
    type PipelineStatus,
    type ProcurementStatusMeta,
} from '@/lib/procurement-status'

/**
 * THIS FILE NEVER DEFINES PIPELINE LABELS OR COLORS.
 * ──────────────────────────────────────────────────
 * The single source of truth lives in
 *   src/lib/procurement-status.ts → PIPELINE_STATUS_CONFIG
 *
 * Every page (products, requests, purchases/new, ...) reads its
 * pipeline label/color from THAT file. This module's only job is to
 * translate a request-row's (type, internal-status) tuple into the
 * canonical PipelineStatus enum key, then look it up in the shared
 * config. If the user changes a label there, it updates everywhere.
 */

/** Translate (request type, internal status) → canonical pipeline key.
 *  Mirrors the backend's product-level pipeline derivation:
 *    PURCHASE + PENDING/APPROVED → REQUESTED_PURCHASE
 *    PURCHASE + EXECUTED         → PO_SENT
 *    TRANSFER + PENDING/APPROVED → REQUESTED_TRANSFER
 *    TRANSFER + EXECUTED         → IN_TRANSIT
 *    *        + REJECTED/CANCELLED → FAILED
 */
export function toPipelineKey(type: ProcurementRequestType, status: ProcurementRequestStatus): PipelineStatus {
    if (status === 'REJECTED' || status === 'CANCELLED') return 'FAILED'
    if (status === 'EXECUTED') return type === 'TRANSFER' ? 'IN_TRANSIT' : 'PO_SENT'
    // PENDING + APPROVED — both still "Requested" until the PO/TO is issued
    return type === 'TRANSFER' ? 'REQUESTED_TRANSFER' : 'REQUESTED_PURCHASE'
}

/** Resolved meta for a request row — pipeline label/color from the
 *  canonical config + a per-request icon (chosen here because the
 *  canonical config is shared with non-request views). The internal
 *  enum is also surfaced for audit/debug sub-lines. */
export interface RequestStatusMeta extends ProcurementStatusMeta {
    icon: typeof Clock
    /** Internal lifecycle stage (Pending / Approved / Executed / …) —
     *  preserved for tooltips or audit columns. The user-facing chip
     *  uses `label` (canonical) instead. */
    internal: string
}

const ICON_BY_STATUS: Record<ProcurementRequestStatus, typeof Clock> = {
    PENDING:   Clock,
    APPROVED:  CheckCircle2,
    EXECUTED:  PlayCircle,
    REJECTED:  XCircle,
    CANCELLED: Ban,
}
const INTERNAL_LABEL: Record<ProcurementRequestStatus, string> = {
    PENDING: 'Pending', APPROVED: 'Approved', EXECUTED: 'Executed',
    REJECTED: 'Rejected', CANCELLED: 'Cancelled',
}

/** Resolve the pipeline meta for a single request row. The label and
 *  color come straight from the canonical PIPELINE_STATUS_CONFIG —
 *  whatever shows on /inventory/products will show here too. */
export function getRequestStatusMeta(
    type: ProcurementRequestType,
    status: ProcurementRequestStatus,
): RequestStatusMeta {
    const key = toPipelineKey(type, status)
    const meta = PIPELINE_STATUS_CONFIG[key] || PIPELINE_STATUS_CONFIG.NONE
    return {
        ...meta,
        icon: ICON_BY_STATUS[status],
        internal: INTERNAL_LABEL[status],
    }
}

/** @deprecated Use `getRequestStatusMeta(type, status)`. Kept for any
 *  legacy caller that doesn't have the type at hand; defaults to
 *  Purchase semantics. */
export const STATUS_META: Record<ProcurementRequestStatus, RequestStatusMeta> = {
    PENDING:   getRequestStatusMeta('PURCHASE', 'PENDING'),
    APPROVED:  getRequestStatusMeta('PURCHASE', 'APPROVED'),
    EXECUTED:  getRequestStatusMeta('PURCHASE', 'EXECUTED'),
    REJECTED:  getRequestStatusMeta('PURCHASE', 'REJECTED'),
    CANCELLED: getRequestStatusMeta('PURCHASE', 'CANCELLED'),
}

// Re-export icons that consumers still pull from this module
export { Clock, CheckCircle2, XCircle, PlayCircle, Ban, AlertTriangle, Package, AlertCircle }

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
