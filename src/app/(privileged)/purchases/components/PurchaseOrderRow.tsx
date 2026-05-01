'use client'

import type { ComponentType } from 'react'
import {
    FileText, Clock, CheckCircle2, XCircle, Truck, Package, AlertTriangle,
    Calendar, User,
} from 'lucide-react'

type IconComponent = ComponentType<{ size?: number | string; className?: string }>
import { MasterListCard, type MasterListBadge } from '@/components/templates/MasterListCard'

/* ═══════════════════════════════════════════════════════════
 *  PURCHASE ORDER ROW — thin consumer of MasterListCard.
 *  No layout logic of its own anymore; this file only maps PO
 *  fields onto the shared card primitive (same shape as the
 *  KPI filter chips in TreeMasterPage).
 * ═══════════════════════════════════════════════════════════ */

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: IconComponent }> = {
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

function formatMoney(v: number | string | null | undefined, currency = 'USD') {
    const n = Number(v || 0)
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
    } catch {
        return `${n.toLocaleString()} ${currency}`
    }
}

export interface PurchaseOrderNode {
    id: number
    po_number?: string
    status: string
    priority?: string
    supplier_display?: string
    supplier_name?: string
    created_at?: string | null
    expected_date?: string | null
    total_amount?: number | string | null
    currency?: string
    [key: string]: unknown
}

export function PurchaseOrderRow({
    node, onSelect, isSelected,
}: {
    node: PurchaseOrderNode
    onSelect: (n: PurchaseOrderNode) => void
    isSelected?: boolean
}) {
    const status = STATUS_CONFIG[node.status] || {
        label: node.status, color: 'var(--app-muted-foreground)', icon: FileText,
    }
    const priority = PRIORITY_CONFIG[node.priority || 'NORMAL'] || {
        label: node.priority || '', color: 'var(--app-muted-foreground)',
    }
    const StatusIcon = status.icon
    const isUrgent = node.priority === 'URGENT'

    const badges: MasterListBadge[] = [{ label: status.label, color: status.color }]
    if (isUrgent) {
        badges.push({
            label: 'Urgent',
            color: 'var(--app-error)',
            icon: <AlertTriangle size={9} />,
        })
    }

    return (
        <MasterListCard
            icon={<StatusIcon size={13} />}
            accentColor={status.color}
            leftAccent={isUrgent ? 'var(--app-error)' : undefined}
            isSelected={isSelected}
            onClick={() => onSelect(node)}
            title={node.po_number || `PO-${node.id}`}
            badges={badges}
            subtitle={
                <>
                    <span className="flex items-center gap-1 font-medium min-w-0">
                        <User size={9} />
                        <span className="truncate max-w-[180px]">
                            {node.supplier_display || node.supplier_name || '—'}
                        </span>
                    </span>
                    <span className="opacity-50">·</span>
                    <span className="flex items-center gap-1 font-medium">
                        <Calendar size={9} />
                        {formatDate(node.created_at)}
                    </span>
                </>
            }
            rightSlot={
                <>
                    <div className="hidden md:flex w-16 flex-shrink-0 justify-center">
                        <span className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: priority.color }}>
                            {priority.label}
                        </span>
                    </div>
                    <div className="hidden lg:flex w-24 flex-shrink-0 justify-center text-tp-xs text-app-muted-foreground font-medium">
                        {formatDate(node.expected_date)}
                    </div>
                    <div className="flex w-28 flex-shrink-0 justify-end text-right">
                        <span className="font-bold text-app-foreground tabular-nums text-tp-md">
                            {formatMoney(node.total_amount, node.currency)}
                        </span>
                    </div>
                </>
            }
        />
    )
}
