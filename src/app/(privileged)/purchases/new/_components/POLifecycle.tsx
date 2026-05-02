'use client'

/**
 * POLifecycle — vertical stage visualization for a Purchase Order.
 *
 * Two presentations:
 *   - `variant="full"`   → labelled stepper, used inside the configuration
 *                          sidebar so the operator sees what's ahead.
 *   - `variant="compact"` → dot row + current-state label, used in the page
 *                          header alongside the summary chips.
 *
 * Stages mirror `PurchaseOrder.STATUS_CHOICES` on the backend (13-state
 * lifecycle). The "happy path" sits on the main timeline; CANCELLED and
 * REJECTED are rendered as alternate terminal branches.
 *
 * Backend state machine (purchase_order_models.py):
 *   DRAFT → SUBMITTED → APPROVED → SENT → CONFIRMED → IN_TRANSIT →
 *   PARTIALLY_RECEIVED → RECEIVED → PARTIALLY_INVOICED → INVOICED → COMPLETED
 *   (+ REJECTED from SUBMITTED, + CANCELLED from most states)
 */

import { useState } from 'react'
import { Check, AlertTriangle, ChevronDown, Loader2, Ban } from 'lucide-react'

export type POStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'SENT'
    | 'CONFIRMED'
    | 'IN_TRANSIT'
    | 'PARTIALLY_RECEIVED'
    | 'RECEIVED'
    | 'PARTIALLY_INVOICED'
    | 'INVOICED'
    | 'COMPLETED'
    | 'CANCELLED'

interface Stage {
    key: POStatus
    label: string
    short: string
}

/* Main-line stages. Order is the natural progression (happy path). */
const STAGES: Stage[] = [
    { key: 'DRAFT', label: 'Draft', short: 'DR' },
    { key: 'SUBMITTED', label: 'Submitted', short: 'SB' },
    { key: 'APPROVED', label: 'Approved', short: 'AP' },
    { key: 'SENT', label: 'Sent', short: 'SE' },
    { key: 'CONFIRMED', label: 'Confirmed', short: 'CF' },
    { key: 'IN_TRANSIT', label: 'In transit', short: 'IT' },
    { key: 'PARTIALLY_RECEIVED', label: 'Partial receipt', short: 'PR' },
    { key: 'RECEIVED', label: 'Received', short: 'RC' },
    { key: 'INVOICED', label: 'Invoiced', short: 'IV' },
    { key: 'COMPLETED', label: 'Completed', short: 'CP' },
]

/** Terminal / alternate-path statuses shown separately. */
const TERMINAL_STATUSES: POStatus[] = ['REJECTED', 'CANCELLED']

const indexOfStatus = (s: POStatus) => STAGES.findIndex(stage => stage.key === s)

const PALETTE = {
    past: 'var(--app-success, #22c55e)',
    current: 'var(--app-primary)',
    future: 'var(--app-muted-foreground)',
    failed: 'var(--app-error, #ef4444)',
} as const

interface Props {
    /** Current PO status. For a draft form this is `'DRAFT'`. */
    current: POStatus
    variant?: 'full' | 'compact'
    /** When provided on the `full` variant, stages render as buttons
     *  and clicking one calls this callback. Use it for editing flows
     *  where the operator can transition the PO between stages. Leave
     *  undefined on read-only views (e.g. the New PO form, which is
     *  always DRAFT). */
    onStageChange?: (next: POStatus) => void
    /** True while a transition request is in flight. */
    transitioning?: boolean
    /** When true on the `full` variant, the timeline is collapsible
     *  via the header. Defaults to true. */
    collapsible?: boolean
    /** Initial collapsed state when `collapsible`. Defaults to false. */
    defaultCollapsed?: boolean
}

export function POLifecycle({
    current,
    variant = 'full',
    onStageChange,
    transitioning = false,
    collapsible = true,
    defaultCollapsed = false,
}: Props) {
    const isTerminal = TERMINAL_STATUSES.includes(current)
    const currentIdx = isTerminal ? -1 : indexOfStatus(current)

    if (variant === 'compact') {
        const activeColor = isTerminal
            ? PALETTE.failed
            : currentIdx >= 0
                ? PALETTE.current
                : PALETTE.future
        const activeLabel = isTerminal
            ? (current === 'CANCELLED' ? 'Cancelled' : 'Rejected')
            : STAGES[Math.max(0, currentIdx)]?.label || ''
        return (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold"
                 title={`Lifecycle · ${activeLabel}`}
                 style={{
                     fontSize: 'var(--tp-xxs)',
                     background: `color-mix(in srgb, ${activeColor} 10%, transparent)`,
                     color: activeColor,
                     border: `1px solid color-mix(in srgb, ${activeColor} 22%, transparent)`,
                 }}>
                {isTerminal && <AlertTriangle size={9} className="flex-shrink-0" />}
                {transitioning && <Loader2 size={9} className="flex-shrink-0 animate-spin" />}
                <span className="flex items-center gap-1 flex-shrink-0">
                    {STAGES.map((s, i) => {
                        const past = !isTerminal && i < currentIdx
                        const active = !isTerminal && i === currentIdx
                        const dotColor = active ? activeColor : past ? PALETTE.past : activeColor
                        return (
                            <span key={s.key}
                                  className="inline-block rounded-full transition-all"
                                  style={{
                                      width: active ? 7 : 5,
                                      height: active ? 7 : 5,
                                      background: past || active ? dotColor : 'transparent',
                                      border: past || active ? 'none' : `1px solid ${dotColor}`,
                                      opacity: past || active ? 1 : 0.4,
                                  }} />
                        )
                    })}
                </span>
                <span className="uppercase tracking-widest truncate">
                    {activeLabel}
                </span>
            </div>
        )
    }

    return (<FullTimeline
        current={current}
        currentIdx={currentIdx}
        isTerminal={isTerminal}
        onStageChange={onStageChange}
        transitioning={transitioning}
        collapsible={collapsible}
        defaultCollapsed={defaultCollapsed}
    />)
}

function FullTimeline({
    current, currentIdx, isTerminal,
    onStageChange, transitioning, collapsible, defaultCollapsed,
}: {
    current: POStatus
    currentIdx: number
    isTerminal: boolean
    onStageChange?: (next: POStatus) => void
    transitioning: boolean
    collapsible: boolean
    defaultCollapsed: boolean
}) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed)
    const interactive = !!onStageChange && !transitioning

    return (
        <div className="rounded-xl p-3"
             style={{
                 background: 'var(--app-bg)',
                 border: '1px solid color-mix(in srgb, var(--app-border) 35%, transparent)',
             }}>
            <button type="button"
                    onClick={() => collapsible && setCollapsed(c => !c)}
                    disabled={!collapsible}
                    className={`w-full flex items-center justify-between ${collapsed ? '' : 'mb-2.5'} disabled:cursor-default`}>
                <span className="flex items-center gap-1.5 text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground">
                    Lifecycle
                    {interactive && (
                        <span className="font-bold normal-case tracking-normal px-1 py-px rounded"
                              style={{
                                  background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                  color: 'var(--app-primary)',
                                  fontSize: '10px',
                              }}>
                            click to switch
                        </span>
                    )}
                    {transitioning && (
                        <Loader2 size={10} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                    )}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="text-tp-xxs font-bold tabular-nums"
                          style={{ color: isTerminal ? PALETTE.failed : PALETTE.current }}>
                        {isTerminal
                            ? (current === 'CANCELLED' ? 'Cancelled' : 'Rejected')
                            : `${current === 'DRAFT' && currentIdx === 0 ? 'Draft' : (currentIdx + 1) + ' of ' + STAGES.length}`}
                    </span>
                    {collapsible && (
                        <ChevronDown size={12}
                                     className="text-app-muted-foreground transition-transform"
                                     style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }} />
                    )}
                </span>
            </button>

            {collapsed ? null : (
            <>
            <ol className="relative">
                {STAGES.map((s, i) => {
                    const past = !isTerminal && i < currentIdx
                    const active = !isTerminal && i === currentIdx
                    const dotColor = active ? PALETTE.current : past ? PALETTE.past : PALETTE.future
                    const isLast = i === STAGES.length - 1
                    const Row: React.ElementType = interactive && !active ? 'button' : 'div'
                    return (
                        <li key={s.key} className="relative" style={{ minHeight: '24px' }}>
                            {!isLast && (
                                <div className="absolute left-[7px] top-4 w-px h-full"
                                     style={{
                                         background: past
                                             ? PALETTE.past
                                             : `color-mix(in srgb, ${PALETTE.future} 30%, transparent)`,
                                     }} />
                            )}

                            <Row
                                {...(Row === 'button'
                                    ? {
                                        type: 'button' as const,
                                        onClick: () => onStageChange?.(s.key),
                                        title: `Switch to ${s.label}`,
                                    }
                                    : {})}
                                className={`flex items-start w-full text-left rounded-md transition-all ${interactive && !active ? 'hover:bg-app-surface-hover active:scale-[0.99] -mx-1 px-1' : ''}`}
                            >
                                <div className="relative z-10 flex-shrink-0 flex items-center justify-center transition-all"
                                     style={{
                                         width: 15,
                                         height: 15,
                                         borderRadius: '50%',
                                         background: past ? PALETTE.past : active ? PALETTE.current : 'var(--app-bg)',
                                         border: past || active ? 'none' : `1.5px solid ${dotColor}`,
                                         color: 'white',
                                         opacity: past || active ? 1 : 0.5,
                                         boxShadow: active
                                             ? `0 0 0 3px color-mix(in srgb, ${PALETTE.current} 18%, transparent)`
                                             : undefined,
                                     }}>
                                    {past && <Check size={9} strokeWidth={3} />}
                                </div>

                                <div className="ml-2.5 pb-2 leading-tight">
                                    <div className="text-tp-sm font-bold"
                                         style={{
                                             color: active ? PALETTE.current : past ? 'var(--app-foreground)' : PALETTE.future,
                                             opacity: past || active ? 1 : 0.7,
                                         }}>
                                        {s.label}
                                    </div>
                                    {active && (
                                        <div className="text-tp-xxs font-bold uppercase tracking-widest mt-0.5"
                                             style={{ color: PALETTE.current, opacity: 0.7 }}>
                                            Current stage
                                        </div>
                                    )}
                                </div>
                            </Row>
                        </li>
                    )
                })}
            </ol>

            {/* Terminal alternate-path — REJECTED / CANCELLED */}
            <div className="flex items-center gap-2 mt-2 pt-2"
                 style={{ borderTop: `1px dashed color-mix(in srgb, ${PALETTE.failed} 30%, transparent)` }}
                 title="A PO can exit the main path to Cancelled at any stage.">
                <div className="flex items-center justify-center flex-shrink-0"
                     style={{
                         width: 15,
                         height: 15,
                         borderRadius: '50%',
                         background: isTerminal ? PALETTE.failed : 'var(--app-bg)',
                         border: isTerminal ? 'none' : `1.5px solid ${PALETTE.failed}`,
                         opacity: isTerminal ? 1 : 0.5,
                     }}>
                    {isTerminal && <Ban size={9} className="text-white" />}
                </div>
                <span className="text-tp-xs font-bold"
                      style={{ color: PALETTE.failed, opacity: isTerminal ? 1 : 0.7 }}>
                    {current === 'REJECTED' ? 'Rejected' : current === 'CANCELLED' ? 'Cancelled' : 'Cancelled / Rejected'}
                </span>
                {interactive && !isTerminal ? (
                    <button type="button" onClick={() => onStageChange?.('CANCELLED')}
                            className="text-tp-xxs font-bold ml-auto px-1.5 py-px rounded transition-all hover:bg-app-error/10"
                            style={{ color: PALETTE.failed }}>
                        Cancel →
                    </button>
                ) : (
                    <span className="text-tp-xxs font-medium ml-auto"
                          style={{ color: PALETTE.failed, opacity: 0.5 }}>
                        alt path
                    </span>
                )}
            </div>
            </>
            )}
        </div>
    )
}
