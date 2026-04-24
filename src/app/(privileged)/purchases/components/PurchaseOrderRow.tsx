// @ts-nocheck
'use client'

import {
    FileText, Clock, CheckCircle2, XCircle, Truck, Package, AlertTriangle,
    Calendar, User,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
 *  PURCHASE ORDER ROW — flat list row for TreeMasterPage.
 *  Same visual grammar as UnitRow / WarehouseRow: icon tile,
 *  name block, secondary chips, right-aligned stats, hover actions.
 * ═══════════════════════════════════════════════════════════ */

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    DRAFT:              { label: 'Draft',             color: 'var(--app-muted-foreground)', icon: FileText },
    SUBMITTED:          { label: 'Pending Approval',  color: 'var(--app-warning)',          icon: Clock },
    APPROVED:           { label: 'Approved',          color: 'var(--app-info)',             icon: CheckCircle2 },
    REJECTED:           { label: 'Rejected',          color: 'var(--app-error)',            icon: XCircle },
    ORDERED:            { label: 'Sent to Supplier',  color: 'var(--app-info)',             icon: Truck },
    CONFIRMED:          { label: 'Confirmed',         color: 'var(--app-info)',             icon: CheckCircle2 },
    IN_TRANSIT:         { label: 'In Transit',        color: 'var(--app-warning)',          icon: Truck },
    PARTIALLY_RECEIVED: { label: 'Partial Receipt',   color: 'var(--app-warning)',          icon: Package },
    RECEIVED:           { label: 'Fully Received',    color: 'var(--app-success)',          icon: Package },
    INVOICED:           { label: 'Invoiced',          color: 'var(--app-primary)',          icon: FileText },
    COMPLETED:          { label: 'Completed',         color: 'var(--app-success)',          icon: CheckCircle2 },
    CANCELLED:          { label: 'Cancelled',         color: 'var(--app-muted-foreground)', icon: XCircle },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    LOW:    { label: 'Low',    color: 'var(--app-muted-foreground)' },
    NORMAL: { label: 'Normal', color: 'var(--app-info)' },
    HIGH:   { label: 'High',   color: 'var(--app-warning)' },
    URGENT: { label: 'Urgent', color: 'var(--app-error)' },
}

function formatDate(iso?: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(v: any, currency = 'USD') {
    const n = Number(v || 0)
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
    } catch {
        return `${n.toLocaleString()} ${currency}`
    }
}

export function PurchaseOrderRow({
    node, onSelect, isSelected,
}: {
    node: any
    onSelect: (n: any) => void
    isSelected?: boolean
}) {
    const status = STATUS_CONFIG[node.status] || {
        label: node.status, color: 'var(--app-muted-foreground)', icon: FileText,
    }
    const priority = PRIORITY_CONFIG[node.priority] || {
        label: node.priority, color: 'var(--app-muted-foreground)',
    }
    const StatusIcon = status.icon
    const isUrgent = node.priority === 'URGENT'

    return (
        <div
            className={`group flex items-center gap-2 transition-colors duration-150 cursor-pointer
                py-2.5 hover:bg-app-surface-hover ${isSelected ? 'bg-app-primary/[0.04]' : ''}`}
            onClick={() => onSelect(node)}
            style={{
                paddingLeft: '12px',
                paddingRight: '12px',
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                position: 'relative',
            }}
        >
            {/* Urgent accent bar */}
            {isUrgent && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                    style={{ background: 'var(--app-error)' }} />
            )}

            {/* Status icon tile */}
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: `color-mix(in srgb, ${status.color} 12%, transparent)`,
                    color: status.color,
                }}>
                <StatusIcon size={13} />
            </div>

            {/* PO number + created date + supplier */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-tp-lg text-app-foreground truncate">
                        {node.po_number || `PO-${node.id}`}
                    </span>
                    <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                        style={{
                            background: `color-mix(in srgb, ${status.color} 12%, transparent)`,
                            color: status.color,
                        }}>
                        {status.label}
                    </span>
                    {isUrgent && (
                        <span className="flex items-center gap-0.5 text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-error) 12%, transparent)',
                                color: 'var(--app-error)',
                            }}>
                            <AlertTriangle size={9} />Urgent
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-tp-xxs text-app-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                        <User size={9} />
                        <span className="truncate max-w-[160px]">{node.supplier_display || node.supplier_name || '—'}</span>
                    </span>
                    <span className="opacity-50">·</span>
                    <span className="flex items-center gap-1 font-medium">
                        <Calendar size={9} />
                        {formatDate(node.created_at)}
                    </span>
                </div>
            </div>

            {/* Priority — small column */}
            <div className="hidden md:flex w-16 flex-shrink-0 justify-center">
                <span className="text-tp-xs font-bold uppercase tracking-wide"
                    style={{ color: priority.color }}>
                    {priority.label}
                </span>
            </div>

            {/* Expected date — small column */}
            <div className="hidden lg:flex w-24 flex-shrink-0 justify-center text-tp-xs text-app-muted-foreground font-medium">
                {formatDate(node.expected_date)}
            </div>

            {/* Amount */}
            <div className="flex w-28 flex-shrink-0 justify-end text-right">
                <span className="font-bold text-app-foreground tabular-nums text-tp-md">
                    {formatMoney(node.total_amount, node.currency)}
                </span>
            </div>
        </div>
    )
}
