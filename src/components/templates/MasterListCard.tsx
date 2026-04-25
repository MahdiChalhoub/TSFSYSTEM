// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MasterListCard — shared card primitive for list rows.
 *
 *  Uses the SAME visual grammar as the KPI filter chips inside
 *  TreeMasterPage so every page in the app gets a consistent
 *  "card in a list" shape:
 *
 *    ┌────────────────────────────────────────────────────┐
 *    │ [icon] Title                  badge   [right slot] │
 *    │        Subtitle / metadata line                    │
 *    └────────────────────────────────────────────────────┘
 *
 *  Props are intentionally dumb — consumers compose title /
 *  subtitle / badges / right content themselves. The card
 *  owns only layout, hover affordances, selection state, and
 *  the left-accent bar (used for urgency / status hints).
 *
 *  Used by: Purchase Orders list; extend to Units / Warehouses /
 *  Categories rows by swapping their top-level row shell for this.
 * ═══════════════════════════════════════════════════════════ */

import type { ReactNode, MouseEvent } from 'react'

export type MasterListBadge = {
    label: ReactNode
    color?: string                   // text + tinted background
    icon?: ReactNode
}

export type MasterListCardProps = {
    /** Optional slot rendered before the icon tile — use for tree-row
     *  chevrons, multi-select checkboxes, drag handles. Leave unset on
     *  flat lists. */
    leadingSlot?: ReactNode
    /** Icon rendered inside the tinted tile on the left. */
    icon?: ReactNode
    /** Icon-tile color. Defaults to `var(--app-primary)`. */
    accentColor?: string
    /** Primary line of text (usually a code or short name). */
    title: ReactNode
    /** Secondary line — metadata, tags, timestamps. */
    subtitle?: ReactNode
    /** Inline badges rendered next to the title (wraps). */
    badges?: MasterListBadge[]
    /** Right-aligned content, e.g. amount / counter / chevron. */
    rightSlot?: ReactNode
    /** Left-edge vertical bar — used for urgency / alert hints. */
    leftAccent?: string
    /** Shows a stronger border + subtle shadow when truthy. */
    isSelected?: boolean
    /** Rendered in the row's action tray (hover-revealed). */
    actions?: ReactNode
    /** Extra className hook for wrapping containers. */
    className?: string
    /** Padding preset. `comfortable` is the default. */
    density?: 'compact' | 'comfortable'
    onClick?: (e: MouseEvent<HTMLDivElement>) => void
    onDoubleClick?: (e: MouseEvent<HTMLDivElement>) => void
}

export function MasterListCard({
    leadingSlot,
    icon,
    accentColor = 'var(--app-primary)',
    title,
    subtitle,
    badges,
    rightSlot,
    leftAccent,
    isSelected = false,
    actions,
    className = '',
    density = 'comfortable',
    onClick,
    onDoubleClick,
}: MasterListCardProps) {
    const pad = density === 'compact' ? 'py-2' : 'py-2.5'
    return (
        <div
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            className={`group relative flex items-center gap-2 transition-colors duration-150 cursor-pointer ${pad} hover:bg-app-surface-hover ${className}`}
            style={{
                paddingLeft: '12px',
                paddingRight: '12px',
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                background: isSelected
                    ? `color-mix(in srgb, ${accentColor} 6%, transparent)`
                    : undefined,
                boxShadow: isSelected
                    ? `inset 0 0 0 1.5px color-mix(in srgb, ${accentColor} 35%, transparent)`
                    : undefined,
            }}
        >
            {/* Left-edge accent bar — optional status / urgency hint. */}
            {leftAccent && (
                <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                    style={{ background: leftAccent }}
                    aria-hidden
                />
            )}

            {/* Leading slot — e.g. tree chevron, checkbox, drag handle. */}
            {leadingSlot}

            {/* Icon tile — same rounded-lg 7x7 tinted pattern as the filter chips. */}
            {icon && (
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                        color: accentColor,
                    }}
                >
                    {icon}
                </div>
            )}

            {/* Title + subtitle block. Tight mapping of the KPI card's label/value. */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-tp-lg text-app-foreground truncate">
                        {title}
                    </span>
                    {badges?.map((b, i) => (
                        <span
                            key={i}
                            className="flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                            style={{
                                background: `color-mix(in srgb, ${b.color || accentColor} 12%, transparent)`,
                                color: b.color || accentColor,
                            }}
                        >
                            {b.icon}
                            {b.label}
                        </span>
                    ))}
                </div>
                {subtitle && (
                    <div className="mt-0.5 text-tp-xxs text-app-muted-foreground flex items-center gap-2 min-w-0">
                        {subtitle}
                    </div>
                )}
            </div>

            {/* Right slot — free-form content aligned to the row end. */}
            {rightSlot && (
                <div className="flex items-center flex-shrink-0 gap-2">
                    {rightSlot}
                </div>
            )}

            {/* Actions tray — reveals on hover. */}
            {actions && (
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {actions}
                </div>
            )}
        </div>
    )
}
