/**
 * Procurement Status — single source of truth for the lifecycle vocabulary.
 *
 * Every page that displays a "procurement state" must import from here.
 * Previously each page had its own status config (urgency on /purchases/new,
 * request lifecycle on /inventory/requests, procurement lifecycle on
 * /inventory/products) — three different vocabularies for one concept,
 * confusing users.
 *
 * Canonical values come from the backend's `Product.pipeline_status`
 * SerializerMethodField (apps/inventory). That field aggregates linked
 * ProcurementRequest + PurchaseOrder state into a single product-level
 * lifecycle. This module mirrors that vocabulary exactly.
 *
 * Pages must:
 *   - Import `PIPELINE_STATUS_CONFIG` for label + color
 *   - Use `getPipelineStatus(value)` to safely resolve unknown values to NONE
 *   - When showing for a Product: pass `product.pipeline_status`
 *   - When showing for a ProcurementRequest row: pass
 *     `mapRequestStatusToPipeline(request.status)` so the same vocabulary
 *     renders even though the request's internal status enum is different.
 */

/**
 * Canonical product-pipeline vocabulary — the ONLY words a user sees
 * for procurement state, anywhere in the app. Mirrors the physical
 * journey of a product (no financial noise: invoiced/paid live in
 * Finance, the Product chip stops at "Received").
 *
 *   Available  → nothing is happening
 *   Requested  → someone asked for stock (no PO/TO yet)
 *   Approved   → the request was approved (still no PO/TO)
 *   Ordered    → a PO was sent to the supplier
 *   Supplier Confirmed → supplier accepted the PO
 *   In Transit → goods are physically moving (PO IN_TRANSIT or TO IN_TRANSIT)
 *   Partial Receipt → some units have arrived
 *   Received   → all units arrived (cycle done from a stock perspective)
 *   Failed     → request / PO / TO got rejected, cancelled, or aborted
 */
/**
 * Canonical pipeline stages — same set for PURCHASE and TRANSFER.
 * The flow differs by entity but the vocabulary is identical:
 *
 *   Available → Requested → Approved → Ordered → Supplier Confirmed
 *             → In Transit → Partial Receipt → Received
 *             ┊
 *             Rejected · Cancelled · Failed   (terminal at any stage)
 *
 * REJECTED / CANCELLED / FAILED are kept distinct (each carries
 * different operational meaning) — collapsing them into a single
 * "Failed" lost the audit trail. Use `formatPipelineLabel(status, type)`
 * to append "· Purchase" / "· Transfer" so users see both the stage
 * AND the flow at a glance.
 */
export type PipelineStatus =
    | 'NONE'
    | 'REQUESTED'
    | 'APPROVED'
    | 'ORDERED'
    | 'SUPPLIER_CONFIRMED'
    | 'IN_TRANSIT'
    | 'PARTIALLY_RECEIVED'
    | 'RECEIVED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'FAILED'

    // ── Type-qualified variants kept for the Product page where the
    //    chip needs to embed the flow type into the SAME label
    //    (no separate "type" badge). Internally they're (status, type)
    //    pairs collapsed into one key. ──
    | 'REQUESTED_PURCHASE'
    | 'REQUESTED_TRANSFER'
    | 'REQUESTED_BOTH'

    // ── Legacy aliases (callers still mid-migration) ──
    | 'PO_SENT'
    | 'PO_ACCEPTED'

/** Flow type — drives the "· Purchase" / "· Transfer" suffix. */
export type FlowType = 'PURCHASE' | 'TRANSFER'

export interface ProcurementStatusMeta {
    label: string
    color: string
}

// Permissive `Record<string, ...>` so legacy call sites that index with a
// raw `string` (e.g. `PIPELINE_STATUS_CONFIG[product.pipeline_status]`)
// still type-check. Use `getPipelineStatus()` below for safe lookup with
// fallback.
export const PIPELINE_STATUS_CONFIG: Record<string, ProcurementStatusMeta> = {
    NONE:               { label: 'Available',            color: 'var(--app-success, #22c55e)' },
    REQUESTED:          { label: 'Requested',            color: 'var(--app-warning, #f59e0b)' },
    APPROVED:           { label: 'Approved',             color: 'var(--app-info, #3b82f6)' },
    ORDERED:            { label: 'Ordered',              color: 'var(--app-info, #3b82f6)' },
    SUPPLIER_CONFIRMED: { label: 'Supplier Confirmed',   color: 'var(--app-info, #3b82f6)' },
    IN_TRANSIT:         { label: 'In Transit',           color: 'var(--app-accent, #8b5cf6)' },
    PARTIALLY_RECEIVED: { label: 'Partial Receipt',      color: 'var(--app-warning, #f59e0b)' },
    RECEIVED:           { label: 'Received',             color: 'var(--app-success, #22c55e)' },
    // Distinct terminal stages — different colors so a glance separates
    // a supplier-rejection from an operator-cancel from a system-failure.
    REJECTED:           { label: 'Rejected',             color: 'var(--app-error, #ef4444)' },
    CANCELLED:          { label: 'Cancelled',            color: 'var(--app-muted-foreground)' },
    FAILED:             { label: 'Failed',               color: 'var(--app-error, #ef4444)' },

    // ── Type-qualified variants (Product page uses these) ──
    REQUESTED_PURCHASE: { label: 'Requested · Purchase', color: 'var(--app-warning, #f59e0b)' },
    REQUESTED_TRANSFER: { label: 'Requested · Transfer', color: 'var(--app-warning, #f59e0b)' },
    REQUESTED_BOTH:     { label: 'Requested · P+T',      color: 'var(--app-warning, #f59e0b)' },

    // ── Legacy aliases ──
    PO_SENT:            { label: 'Ordered',              color: 'var(--app-info, #3b82f6)' },
    PO_ACCEPTED:        { label: 'Supplier Confirmed',   color: 'var(--app-info, #3b82f6)' },
}

/**
 * Format a pipeline status with the flow-type suffix appended.
 *   formatPipelineLabel('REJECTED', 'PURCHASE')  → "Rejected · Purchase"
 *   formatPipelineLabel('IN_TRANSIT', 'TRANSFER') → "In Transit · Transfer"
 *   formatPipelineLabel('NONE')                   → "Available" (no suffix)
 *
 * Use this in any chip that knows BOTH the stage and the flow — request
 * rows, PO lines, TO lines, the per-line breakdown on Product detail.
 * Pages that only know the stage (e.g. an aggregated Product chip with
 * mixed flows) just look up `PIPELINE_STATUS_CONFIG[key].label`.
 */
export function formatPipelineLabel(
    status: PipelineStatus | string,
    type?: FlowType,
): string {
    const meta = PIPELINE_STATUS_CONFIG[status] || PIPELINE_STATUS_CONFIG.NONE
    // NONE / aggregated keys never take a suffix — the suffix only makes
    // sense for an active, single-flow stage.
    if (!type || status === 'NONE'
        || status === 'REQUESTED_PURCHASE' || status === 'REQUESTED_TRANSFER' || status === 'REQUESTED_BOTH') {
        return meta.label
    }
    const typeLabel = type === 'PURCHASE' ? 'Purchase' : 'Transfer'
    return `${meta.label} · ${typeLabel}`
}

/**
 * Backend-label → canonical enum mapping.
 *
 * The Python service `apps/inventory/services/procurement_status_service.py`
 * returns human-friendly strings like "Requested to Purchase" / "Pending PO"
 * / "Ordered" / "In Transit" / "Received" — NOT the enum keys above. We
 * normalize those into our canonical vocabulary so the UI shows consistent
 * labels everywhere. The mapping mirrors the priority chain in the service
 * (request lifecycle → PO lifecycle → received).
 */
const BACKEND_LABEL_TO_ENUM: Record<string, PipelineStatus> = {
    // Procurement Requests
    'Requested to Purchase':  'REQUESTED_PURCHASE',
    'Approved to Purchase':   'APPROVED',
    'Requested to Transfer':  'REQUESTED_TRANSFER',
    'Approved to Transfer':   'APPROVED',
    'Requested · P+T':        'REQUESTED_BOTH',
    'Adjustment Pending':     'REQUESTED',
    'Adjustment Approved':    'APPROVED',
    'Requested':              'REQUESTED',
    'Approved':               'APPROVED',
    // PO lifecycle
    'Pending PO':             'REQUESTED',
    'Pending Approval':       'REQUESTED',
    'PO Approved':            'APPROVED',
    'Ordered':                'ORDERED',
    'Sent':                   'ORDERED',
    'Confirmed':              'SUPPLIER_CONFIRMED',
    'Supplier Confirmed':     'SUPPLIER_CONFIRMED',
    'In Transit':             'IN_TRANSIT',
    'Partially Received':     'PARTIALLY_RECEIVED',
    'Partial Receipt':        'PARTIALLY_RECEIVED',
    // Terminal — physical journey complete
    'Received':               'RECEIVED',
    'Completed':              'RECEIVED',  // PO/TO closure ≡ goods landed
    // Invoice/payment events do NOT change product pipeline (already
    // received once invoice exists). They surface elsewhere in Finance.
    'Invoiced':               'RECEIVED',
    'Paid':                   'RECEIVED',
    'Posted':                 'RECEIVED',
    // Failure terminals
    'Failed':                 'FAILED',
    'Rejected':               'FAILED',
    'PO Rejected':            'FAILED',
    'Cancelled':              'FAILED',
}

/**
 * Translate a Purchase Order's native lifecycle state into the
 * canonical Product/Request pipeline. Use this on the Product detail
 * line breakdown ("3 units PO Sent · 5 units In Transit") and on
 * the Request page when the underlying request was EXECUTED-via-PO.
 *
 * Invoice/Complete states roll up to Received because — from a stock
 * perspective — invoiced means the goods already landed.
 */
const PO_STATUS_TO_PIPELINE: Record<string, PipelineStatus> = {
    DRAFT:               'REQUESTED',
    SUBMITTED:           'REQUESTED',
    APPROVED:            'APPROVED',
    ORDERED:             'ORDERED',
    SENT:                'ORDERED',
    CONFIRMED:           'SUPPLIER_CONFIRMED',
    IN_TRANSIT:          'IN_TRANSIT',
    PARTIALLY_RECEIVED:  'PARTIALLY_RECEIVED',
    RECEIVED:            'RECEIVED',
    INVOICED:            'RECEIVED',  // invoicing implies received earlier
    PARTIALLY_INVOICED:  'RECEIVED',
    COMPLETED:           'RECEIVED',
    // Distinct terminals — same wording everywhere
    REJECTED:            'REJECTED',
    CANCELLED:           'CANCELLED',
    FAILED:              'FAILED',
}

/** Transfer Order → canonical pipeline. Same set of stages as Purchase. */
const TO_STATUS_TO_PIPELINE: Record<string, PipelineStatus> = {
    DRAFT:               'REQUESTED',
    SUBMITTED:           'REQUESTED',
    APPROVED:            'APPROVED',
    IN_TRANSIT:          'IN_TRANSIT',
    PARTIALLY_RECEIVED:  'PARTIALLY_RECEIVED',
    RECEIVED:            'RECEIVED',
    COMPLETED:           'RECEIVED',
    REJECTED:            'REJECTED',
    CANCELLED:           'CANCELLED',
    FAILED:              'FAILED',
}

/** Procurement Request → canonical pipeline (status only — no flow
 *  qualifier; pass it via formatPipelineLabel(key, type)). */
const REQUEST_STATUS_TO_PIPELINE: Record<string, PipelineStatus> = {
    PENDING:    'REQUESTED',
    APPROVED:   'APPROVED',
    EXECUTED:   'ORDERED',
    ORDERED:    'ORDERED',
    SUPPLIER_CONFIRMED: 'SUPPLIER_CONFIRMED',
    IN_TRANSIT: 'IN_TRANSIT',
    PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
    RECEIVED:   'RECEIVED',
    COMPLETED:  'RECEIVED',
    REJECTED:   'REJECTED',
    CANCELLED:  'CANCELLED',
    FAILED:     'FAILED',
}

// ═══════════════════════════════════════════════════════════════════
// Recovery Policy — auto-recycle terminal states back to AVAILABLE
// ═══════════════════════════════════════════════════════════════════
//
// Terminal states (RECEIVED, CANCELLED, REJECTED, FAILED) aren't truly
// terminal — once enough time passes (or a specific reason resolves),
// the product should be ready for the next request. Hard-coding would
// trap operators; this config lets every tenant pick the cadence.
//
// The defaults below are conservative — the org admin can tune via the
// settings UI (or by editing the JSON in /finance/settings/regional →
// Procurement Recovery in a future ticket).

/** Per-terminal-state recovery rule. `autoRecoverAfterDays = null` means
 *  "stays terminal forever, only manual action clears it". */
export interface RecoveryRule {
    autoRecoverAfterDays: number | null
    /** For REJECTED only — per-reason override. A reason listed here
     *  uses its own days value; reasons not listed use the top-level
     *  `autoRecoverAfterDays`. Map keys are the reason category strings
     *  emitted by the backend (e.g. 'PRICE_HIGH', 'NO_STOCK'). */
    perReasonDays?: Record<string, number | null>
}

export interface PipelineRecoveryPolicy {
    RECEIVED:  RecoveryRule
    CANCELLED: RecoveryRule
    REJECTED:  RecoveryRule
    FAILED:    RecoveryRule
}

/** Sensible defaults — applied when the tenant hasn't configured their own.
 *
 *   RECEIVED  → 0 days  — once the goods landed, the cycle is complete;
 *                         the product chip flips back to Available
 *                         immediately so the next request can start.
 *   CANCELLED → 7 days  — short cooldown so operators can see the
 *                         "Cancelled" stamp briefly, then the row
 *                         disappears from the active filters.
 *   REJECTED  → 30 days — longer because rejections often require human
 *                         follow-up (price renegotiation, finding a new
 *                         supplier). Per-reason overrides:
 *                           NO_STOCK        →  3 days (stock returns fast)
 *                           PRICE_HIGH      → 14 days (renegotiation)
 *                           NEEDS_REVISION  →  3 days (operator re-issues)
 *                           DAMAGED         → null  (manual decision)
 *                           OTHER           → 30 days
 *   FAILED    → null    — manual review only. System failures usually
 *                         indicate a deeper problem we don't want to
 *                         silently retry without a human looking.
 */
export const DEFAULT_RECOVERY_POLICY: PipelineRecoveryPolicy = {
    RECEIVED:  { autoRecoverAfterDays: 0 },
    CANCELLED: { autoRecoverAfterDays: 7 },
    REJECTED:  {
        autoRecoverAfterDays: 30,
        perReasonDays: {
            NO_STOCK:       3,
            PRICE_HIGH:     14,
            NEEDS_REVISION: 3,
            DAMAGED:        null,
            OTHER:          30,
        },
    },
    FAILED:    { autoRecoverAfterDays: null },
}

/** Apply a recovery policy to a possibly-terminal pipeline state. If
 *  the row has been in the terminal state long enough (per the rule),
 *  return NONE (=Available); otherwise return the input unchanged.
 *
 *  Pure function — no side effects. The caller passes when the row
 *  entered the terminal state and the active policy. Use this in the
 *  pipeline chip renderer so the same row "ages out" of Failed/Cancelled
 *  on its own without a backend cron.
 */
export function applyRecoveryPolicy(
    status: PipelineStatus,
    terminalSince: Date | string | null,
    policy: PipelineRecoveryPolicy = DEFAULT_RECOVERY_POLICY,
    rejectionReason?: string,
): PipelineStatus {
    if (status !== 'RECEIVED' && status !== 'CANCELLED' && status !== 'REJECTED' && status !== 'FAILED') {
        return status
    }
    const rule = policy[status]
    let days = rule.autoRecoverAfterDays
    if (status === 'REJECTED' && rejectionReason && rule.perReasonDays && rejectionReason in rule.perReasonDays) {
        days = rule.perReasonDays[rejectionReason]
    }
    if (days === null) return status              // never auto-recover
    if (!terminalSince) return status              // can't compute age
    const ageMs = Date.now() - new Date(terminalSince).getTime()
    const ageDays = ageMs / (24 * 60 * 60 * 1000)
    return ageDays >= days ? 'NONE' : status
}

/** Translate a single underlying entity's state into the canonical
 *  pipeline. Pass the entity kind so we pick the right table. */
export function entityStatusToPipeline(
    entity: 'request' | 'po' | 'to' | 'receipt' | 'invoice',
    status: string | null | undefined,
): PipelineStatus {
    if (!status) return 'NONE'
    const s = status.toUpperCase()
    switch (entity) {
        case 'request': return REQUEST_STATUS_TO_PIPELINE[s] || 'NONE'
        case 'po':      return PO_STATUS_TO_PIPELINE[s] || 'NONE'
        case 'to':      return TO_STATUS_TO_PIPELINE[s] || 'NONE'
        case 'receipt':
            // GRN: exists → goods landed. Distinct REJECTED/CANCELLED.
            if (s === 'POSTED' || s === 'RECEIVED' || s === 'COMPLETED') return 'RECEIVED'
            if (s === 'PARTIALLY_RECEIVED') return 'PARTIALLY_RECEIVED'
            if (s === 'REJECTED')  return 'REJECTED'
            if (s === 'CANCELLED') return 'CANCELLED'
            if (s === 'FAILED')    return 'FAILED'
            return 'IN_TRANSIT'
        case 'invoice':
            // Invoice doesn't move product state — its existence implies
            // the goods landed earlier, so we map all live invoice states
            // (DRAFT/POSTED/PAID) to RECEIVED. Cancelled invoices don't
            // un-receive the goods either; treat as RECEIVED too.
            return 'RECEIVED'
    }
}

/**
 * Safe resolver — accepts either:
 *   - a canonical enum key ('REQUESTED', 'PO_SENT', ...)
 *   - a backend human label ('Requested to Purchase', 'Ordered', ...)
 *   - null / undefined / unknown → NONE fallback
 *
 * Always returns a valid ProcurementStatusMeta.
 */
export function getPipelineStatus(value: string | null | undefined): ProcurementStatusMeta {
    if (!value) return PIPELINE_STATUS_CONFIG.NONE
    // First try direct enum-key match (frontend-only paths use this)
    const direct = PIPELINE_STATUS_CONFIG[value]
    if (direct) return direct
    // Then try backend-label mapping (most API responses go through this)
    const mapped = BACKEND_LABEL_TO_ENUM[value]
    if (mapped) return PIPELINE_STATUS_CONFIG[mapped]
    return PIPELINE_STATUS_CONFIG.NONE
}

/**
 * Map a ProcurementRequest's internal status enum to the canonical
 * product-level procurement vocabulary. Used by /inventory/requests so each
 * row displays the same status labels as /inventory/products.
 *
 * Internal request lifecycle → product procurement state:
 *   PENDING   → REQUESTED   (waiting for approval)
 *   APPROVED  → REQUESTED   (approved but PO not yet sent)
 *   EXECUTED  → PO_SENT     (request closed because a PO was created)
 *   REJECTED  → FAILED      (request denied; product no longer being procured via this path)
 *   CANCELLED → FAILED      (operator cancelled; same effect)
 */
export type ProcurementRequestStatus =
    | 'PENDING' | 'APPROVED' | 'EXECUTED' | 'REJECTED' | 'CANCELLED'

export function mapRequestStatusToPipeline(
    requestStatus: ProcurementRequestStatus | string | null | undefined,
): PipelineStatus {
    switch (requestStatus) {
        case 'PENDING':
        case 'APPROVED':
            return 'REQUESTED'
        case 'EXECUTED':
            return 'PO_SENT'
        case 'REJECTED':
        case 'CANCELLED':
            return 'FAILED'
        default:
            return 'NONE'
    }
}
