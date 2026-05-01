'use client'

/**
 * POLifecycle — horizontal stage visualization for a Purchase Order.
 *
 * Two presentations:
 *   - `variant="full"`   → labelled stepper, used inside the configuration
 *                          sidebar so the operator sees what's ahead.
 *   - `variant="compact"` → dot row + current-state label, used in the page
 *                          header alongside the summary chips.
 *
 * Stages mirror `PurchaseOrder.STATUS_CHOICES` on the backend; the
 * "happy path" sits on the main timeline and FAILED is rendered as an
 * alternate terminal branch so it's discoverable but never visually
 * competes with the forward direction.
 */

import { useState } from 'react'
import { Check, AlertTriangle, ChevronDown } from 'lucide-react'

export type POStatus =
    | 'DRAFT'
    | 'APPROVED'
    | 'SENT'
    | 'IN_TRANSIT'
    | 'PARTIAL'
    | 'DELIVERED'
    | 'FAILED'

interface Stage {
    key: POStatus
    label: string
    short: string
}

/* Main-line stages. Order is the natural progression. */
const STAGES: Stage[] = [
    { key: 'DRAFT', label: 'Draft', short: 'DR' },
    { key: 'APPROVED', label: 'Approved', short: 'AP' },
    { key: 'SENT', label: 'Sent', short: 'SE' },
    { key: 'IN_TRANSIT', label: 'In transit', short: 'IT' },
    { key: 'PARTIAL', label: 'Partial', short: 'PT' },
    { key: 'DELIVERED', label: 'Delivered', short: 'DL' },
]

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
    collapsible = true,
    defaultCollapsed = false,
}: Props) {
    const isFailed = current === 'FAILED'
    const currentIdx = isFailed ? -1 : indexOfStatus(current)

    if (variant === 'compact') {
        /* Chip-style wrapper so the lifecycle visually belongs in the same
         * row as the other summary chips (Reference / Supplier / Site).
         * Uses the active stage's color as the tint so the current state
         * is the chip's identity, not just a label inside it. */
        const activeColor = isFailed
            ? PALETTE.failed
            : currentIdx >= 0
                ? PALETTE.current
                : PALETTE.future
        const activeLabel = isFailed
            ? 'Failed'
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
                {isFailed && <AlertTriangle size={9} className="flex-shrink-0" />}
                <span className="flex items-center gap-1 flex-shrink-0">
                    {STAGES.map((s, i) => {
                        const past = !isFailed && i < currentIdx
                        const active = !isFailed && i === currentIdx
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
        isFailed={isFailed}
        onStageChange={onStageChange}
        collapsible={collapsible}
        defaultCollapsed={defaultCollapsed}
    />)
}

function FullTimeline({
    current, currentIdx, isFailed,
    onStageChange, collapsible, defaultCollapsed,
}: {
    current: POStatus
    currentIdx: number
    isFailed: boolean
    onStageChange?: (next: POStatus) => void
    collapsible: boolean
    defaultCollapsed: boolean
}) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed)
    const interactive = !!onStageChange

    /* Full variant — VERTICAL timeline.
     *
     *  The horizontal stepper required 2-letter abbreviations (DR/AP/SE/IT…)
     *  to fit a narrow sidebar — unreadable at a glance. Vertical gives
     *  every stage a full label, turns the connector into a clear rail,
     *  and lets the FAILED branch sit at the end as a proper "or this"
     *  alternate without dangling visually.
     */
    /* Header is a clickable region when collapsible; renders a chevron that
     *  rotates with state. */
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
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="text-tp-xxs font-bold tabular-nums"
                          style={{ color: isFailed ? PALETTE.failed : PALETTE.current }}>
                        {isFailed
                            ? 'Failed'
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
                    const past = !isFailed && i < currentIdx
                    const active = !isFailed && i === currentIdx
                    const dotColor = active ? PALETTE.current : past ? PALETTE.past : PALETTE.future
                    const isLast = i === STAGES.length - 1
                    /* When `interactive`, render the row as a button so
                     *  operators can click any stage to switch. The current
                     *  stage isn't switchable (already there). */
                    const Row: React.ElementType = interactive && !active ? 'button' : 'div'
                    return (
                        <li key={s.key} className="relative" style={{ minHeight: '24px' }}>
                            {/* Vertical rail — connects this dot to the next.
                             *  Hidden on the last item. */}
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
                                {/* Dot — slightly larger when active for visual anchor. */}
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

                                {/* Label */}
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

            {/* Failed alternate-path — sits below the main timeline as
             *  a separate "exit door". Lights up when the PO actually
             *  reaches FAILED, otherwise stays dim as a "this can also
             *  happen" hint. */}
            <div className="flex items-center gap-2 mt-2 pt-2"
                 style={{ borderTop: `1px dashed color-mix(in srgb, ${PALETTE.failed} 30%, transparent)` }}
                 title="A PO can exit the main path to FAILED at any stage (rejected, cancelled, returned).">
                <div className="flex items-center justify-center flex-shrink-0"
                     style={{
                         width: 15,
                         height: 15,
                         borderRadius: '50%',
                         background: isFailed ? PALETTE.failed : 'var(--app-bg)',
                         border: isFailed ? 'none' : `1.5px solid ${PALETTE.failed}`,
                         opacity: isFailed ? 1 : 0.5,
                     }}>
                    {isFailed && <AlertTriangle size={9} className="text-white" />}
                </div>
                <span className="text-tp-xs font-bold"
                      style={{ color: PALETTE.failed, opacity: isFailed ? 1 : 0.7 }}>
                    Failed
                </span>
                {interactive && !isFailed ? (
                    <button type="button" onClick={() => onStageChange?.('FAILED')}
                            className="text-tp-xxs font-bold ml-auto px-1.5 py-px rounded transition-all hover:bg-app-error/10"
                            style={{ color: PALETTE.failed }}>
                        Mark failed →
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
