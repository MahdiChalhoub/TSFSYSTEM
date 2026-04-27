'use client'

import React from 'react'
import { ExternalLink } from 'lucide-react'
import type { ProcurementRequestRecord } from '@/app/actions/inventory/procurement-requests'
import { TYPE_META, STATUS_META, PRIORITY_META } from '../_lib/meta'
import { formatRelative, formatDateTime, fmtQty } from '../_lib/format'

export function renderRequestCell(key: string, r: ProcurementRequestRecord): React.ReactNode {
    const tm = TYPE_META[r.request_type]
    const sm = STATUS_META[r.status]
    const pm = PRIORITY_META[r.priority]

    switch (key) {
        case 'type': {
            const Icon = tm.icon
            return (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                        background: `color-mix(in srgb, ${tm.color} 10%, transparent)`,
                        color: tm.color,
                        border: `1px solid color-mix(in srgb, ${tm.color} 25%, transparent)`,
                    }}>
                    <Icon size={10} /> {tm.label}
                </span>
            )
        }

        case 'product':
            return (
                <div className="min-w-0">
                    <div className="text-[12px] font-bold text-app-foreground truncate">
                        {r.product_name || `Product #${r.product}`}
                    </div>
                    {r.product_sku && (
                        <div className="text-[10px] font-mono text-app-muted-foreground truncate">{r.product_sku}</div>
                    )}
                </div>
            )

        case 'quantity':
            return (
                <span className="font-mono text-[12px] font-bold tabular-nums text-app-foreground">
                    {fmtQty(r.quantity)}
                </span>
            )

        case 'priority':
            return (
                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                        background: `color-mix(in srgb, ${pm.color} 10%, transparent)`,
                        color: pm.color,
                        border: `1px solid color-mix(in srgb, ${pm.color} 25%, transparent)`,
                    }}>
                    {pm.label}
                </span>
            )

        case 'status': {
            const Icon = sm.icon
            return (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider"
                    style={{ color: sm.color }}>
                    <Icon size={10} /> {sm.label}
                </span>
            )
        }

        case 'supplier':
            return <span className="text-[11px] text-app-muted-foreground truncate">{r.supplier_name || '—'}</span>

        case 'warehouses':
            if (!r.from_warehouse_name && !r.to_warehouse_name) return <span className="text-app-muted-foreground">—</span>
            return (
                <span className="text-[10px] font-mono text-app-muted-foreground truncate">
                    {r.from_warehouse_name || '?'} → {r.to_warehouse_name || '?'}
                </span>
            )

        case 'requester':
            return <span className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground truncate">{r.requested_by_name || 'system'}</span>

        case 'requestedAt':
            return (
                <div className="min-w-0">
                    <div className="text-[11px] font-medium text-app-foreground truncate">{formatDateTime(r.requested_at)}</div>
                    <div className="text-[9px] text-app-muted-foreground truncate" title={r.requested_at}>{formatRelative(r.requested_at)}</div>
                </div>
            )

        case 'bumpedAt':
            if (!r.last_bumped_at) return <span className="text-[10px] text-app-muted-foreground/50">—</span>
            return (
                <div className="min-w-0" title={r.last_bumped_at}>
                    <div className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: '#8b5cf6' }}>
                        {formatRelative(r.last_bumped_at)}
                    </div>
                    {r.bump_count > 1 && (
                        <div className="text-[9px] font-bold tabular-nums" style={{ color: '#8b5cf6', opacity: 0.7 }}>
                            ×{r.bump_count}
                        </div>
                    )}
                </div>
            )

        case 'reviewer':
            return <span className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground truncate">{r.reviewed_by_name || '—'}</span>

        case 'reviewedAt':
            if (!r.reviewed_at) return <span className="text-app-muted-foreground/50">—</span>
            return <span className="text-[10px] text-app-muted-foreground truncate">{formatRelative(r.reviewed_at)}</span>

        case 'reason':
            return <span className="text-[10px] text-app-muted-foreground truncate">{r.reason || '—'}</span>

        case 'po':
            if (!r.source_po) return <span className="text-app-muted-foreground/50">—</span>
            return (
                <a href={`/purchases/purchase-orders/${r.source_po}`}
                    className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-app-primary hover:underline"
                    onClick={e => e.stopPropagation()}>
                    PO#{r.source_po} <ExternalLink size={9} />
                </a>
            )

        default:
            return <span className="text-app-muted-foreground/50">—</span>
    }
}
