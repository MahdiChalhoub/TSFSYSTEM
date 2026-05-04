import { Clock, CheckCircle2, XCircle, PlayCircle, Ban, ShoppingCart, ArrowRightLeft, Truck, AlertTriangle, Package, AlertCircle } from 'lucide-react'
import type {
    ProcurementRequestStatus, ProcurementRequestType, ProcurementRequestPriority,
} from '@/app/actions/inventory/procurement-requests'
import {
    PIPELINE_STATUS_CONFIG,
    formatPipelineLabel,
    applyRecoveryPolicy,
    DEFAULT_RECOVERY_POLICY,
    type PipelineStatus,
    type ProcurementStatusMeta,
    type PipelineRecoveryPolicy,
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

/** Translate (type, request status) → canonical pipeline key.
 *  Same set of stages for PURCHASE and TRANSFER; REJECTED / CANCELLED /
 *  FAILED stay distinct so the chip says exactly what happened.
 *  The flow-type suffix is appended later by `formatPipelineLabel`.
 *
 *    PENDING             → REQUESTED
 *    APPROVED            → APPROVED
 *    ORDERED / EXECUTED  → ORDERED   (purchase) / IN_TRANSIT (transfer)
 *    SUPPLIER_CONFIRMED  → SUPPLIER_CONFIRMED
 *    IN_TRANSIT          → IN_TRANSIT
 *    PARTIALLY_RECEIVED  → PARTIALLY_RECEIVED
 *    RECEIVED/COMPLETED  → RECEIVED
 *    REJECTED            → REJECTED   ← distinct
 *    CANCELLED           → CANCELLED  ← distinct
 *    FAILED              → FAILED     ← distinct
 */
export function toPipelineKey(type: ProcurementRequestType, status: ProcurementRequestStatus): PipelineStatus {
    switch (status) {
        case 'REJECTED':  return 'REJECTED'
        case 'CANCELLED': return 'CANCELLED'
        case 'FAILED':    return 'FAILED'
        case 'PENDING':   return 'REQUESTED'
        case 'APPROVED':  return 'APPROVED'
        case 'EXECUTED':       // legacy alias for ORDERED
        case 'ORDERED':
            return type === 'TRANSFER' ? 'IN_TRANSIT' : 'ORDERED'
        case 'SUPPLIER_CONFIRMED': return 'SUPPLIER_CONFIRMED'
        case 'IN_TRANSIT':         return 'IN_TRANSIT'
        case 'PARTIALLY_RECEIVED': return 'PARTIALLY_RECEIVED'
        case 'RECEIVED':
        case 'COMPLETED': return 'RECEIVED'
        default: return 'NONE'
    }
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
    PENDING:            Clock,
    APPROVED:           CheckCircle2,
    ORDERED:            ShoppingCart,
    EXECUTED:           PlayCircle,
    SUPPLIER_CONFIRMED: Package,
    IN_TRANSIT:         Truck,
    PARTIALLY_RECEIVED: AlertCircle,
    RECEIVED:           CheckCircle2,
    COMPLETED:          CheckCircle2,
    REJECTED:           XCircle,
    CANCELLED:          Ban,
    FAILED:             AlertTriangle,
}
const INTERNAL_LABEL: Record<ProcurementRequestStatus, string> = {
    PENDING:            'Pending',
    APPROVED:           'Approved',
    ORDERED:            'Ordered',
    EXECUTED:           'Executed',
    SUPPLIER_CONFIRMED: 'Supplier Confirmed',
    IN_TRANSIT:         'In Transit',
    PARTIALLY_RECEIVED: 'Partial Receipt',
    RECEIVED:           'Received',
    COMPLETED:          'Completed',
    REJECTED:           'Rejected',
    CANCELLED:          'Cancelled',
    FAILED:             'Failed',
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
        // Append "· Purchase" / "· Transfer" so each chip carries BOTH
        // the stage and the flow type at a glance — Rejected · Purchase
        // is easily distinguished from Rejected · Transfer.
        label: formatPipelineLabel(key, type),
        icon: ICON_BY_STATUS[status],
        internal: INTERNAL_LABEL[status],
    }
}

/** Live resolver that applies the org's procurement recovery policy
 *  before formatting the chip. Use this in the row renderer so
 *  REJECTED / CANCELLED / FAILED rows age out to "Available" on their
 *  own per the per-tenant cooldown.
 *
 *  - `terminalSince`: when the row entered the terminal state. The
 *    request record exposes `reviewed_at` (set on approve/reject/cancel)
 *    — pass that. Falls back to `requested_at` if reviewed_at is null.
 *  - `policy`: load via useProcurementRecoveryPolicy() in the component.
 *  - `rejectionReason`: optional; lets per-reason overrides apply.
 */
export function getLiveRequestStatusMeta(
    type: ProcurementRequestType,
    status: ProcurementRequestStatus,
    terminalSince: string | null | undefined,
    policy: PipelineRecoveryPolicy = DEFAULT_RECOVERY_POLICY,
    rejectionReason?: string,
): RequestStatusMeta {
    const rawKey = toPipelineKey(type, status)
    const liveKey = applyRecoveryPolicy(rawKey, terminalSince ?? null, policy, rejectionReason)
    const meta = PIPELINE_STATUS_CONFIG[liveKey] || PIPELINE_STATUS_CONFIG.NONE
    return {
        ...meta,
        // No type suffix on NONE — Available is type-neutral.
        label: liveKey === 'NONE' ? meta.label : formatPipelineLabel(liveKey, type),
        // Reuse the original icon set so the row keeps its stage indicator.
        // When recovered to NONE, swap to a check-style icon (CheckCircle2).
        icon: liveKey === 'NONE' ? CheckCircle2 : ICON_BY_STATUS[status],
        internal: INTERNAL_LABEL[status],
    }
}

/** @deprecated Use `getRequestStatusMeta(type, status)`. Kept for any
 *  legacy caller that doesn't have the type at hand; defaults to
 *  Purchase semantics. */
export const STATUS_META: Record<ProcurementRequestStatus, RequestStatusMeta> = {
    PENDING:            getRequestStatusMeta('PURCHASE', 'PENDING'),
    APPROVED:           getRequestStatusMeta('PURCHASE', 'APPROVED'),
    ORDERED:            getRequestStatusMeta('PURCHASE', 'ORDERED'),
    EXECUTED:           getRequestStatusMeta('PURCHASE', 'EXECUTED'),
    SUPPLIER_CONFIRMED: getRequestStatusMeta('PURCHASE', 'SUPPLIER_CONFIRMED'),
    IN_TRANSIT:         getRequestStatusMeta('PURCHASE', 'IN_TRANSIT'),
    PARTIALLY_RECEIVED: getRequestStatusMeta('PURCHASE', 'PARTIALLY_RECEIVED'),
    RECEIVED:           getRequestStatusMeta('PURCHASE', 'RECEIVED'),
    COMPLETED:          getRequestStatusMeta('PURCHASE', 'COMPLETED'),
    REJECTED:           getRequestStatusMeta('PURCHASE', 'REJECTED'),
    CANCELLED:          getRequestStatusMeta('PURCHASE', 'CANCELLED'),
    FAILED:             getRequestStatusMeta('PURCHASE', 'FAILED'),
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
