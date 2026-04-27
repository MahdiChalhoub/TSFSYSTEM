'use client'

import { CheckCircle2, XCircle, PlayCircle, Ban } from 'lucide-react'
import {
    approveProcurementRequest, rejectProcurementRequest,
    executeProcurementRequest, cancelProcurementRequest,
    type ProcurementRequestRecord,
} from '@/app/actions/inventory/procurement-requests'
import { STATUS_META, TYPE_META, PRIORITY_META } from '../_lib/meta'

type RunAction = (
    id: number,
    action: (id: number) => Promise<{ success: boolean; message?: string }>,
    verb: string,
) => void

export function RequestRow({ r, pending, runAction }: {
    r: ProcurementRequestRecord
    pending: boolean
    runAction: RunAction
}) {
    const tm = TYPE_META[r.request_type]
    const sm = STATUS_META[r.status]
    const pm = PRIORITY_META[r.priority]
    const TypeIcon = tm.icon
    const StatusIcon = sm.icon
    const requestedAt = new Date(r.requested_at)
    const dateStr = requestedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
        requestedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

    return (
        <div className="group grid items-center gap-2 px-3 py-2.5 border-b border-app-border/30 hover:bg-app-surface transition-all"
            style={{ gridTemplateColumns: '120px 1fr 90px 110px 110px 130px 200px' }}>
            <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${tm.color} 12%, transparent)`, color: tm.color }}>
                    <TypeIcon size={13} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: tm.color }}>{tm.label}</span>
            </div>
            <div className="min-w-0">
                <div className="text-[12px] font-bold text-app-foreground truncate">{r.product_name || `Product #${r.product}`}</div>
                <div className="text-[10px] font-mono text-app-muted-foreground truncate">
                    {r.product_sku || '—'}
                    {r.supplier_name && <span className="ml-2 opacity-70">⎸ {r.supplier_name}</span>}
                    {(r.from_warehouse_name || r.to_warehouse_name) && (
                        <span className="ml-2 opacity-70">
                            ⎸ {r.from_warehouse_name || '?'} → {r.to_warehouse_name || '?'}
                        </span>
                    )}
                </div>
            </div>
            <div className="text-right font-mono text-[12px] font-bold tabular-nums text-app-foreground">
                {Number(r.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div>
                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: `color-mix(in srgb, ${pm.color} 10%, transparent)`, color: pm.color, border: `1px solid color-mix(in srgb, ${pm.color} 20%, transparent)` }}>
                    {pm.label}
                </span>
            </div>
            <div className="flex items-center gap-1">
                <StatusIcon size={11} style={{ color: sm.color }} />
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: sm.color }}>{sm.label}</span>
            </div>
            <div className="min-w-0">
                <div className="text-[11px] font-medium text-app-foreground truncate">{dateStr}</div>
                <div className="text-[9px] font-bold text-app-muted-foreground truncate uppercase tracking-wider">
                    {r.requested_by_name || 'system'}
                </div>
            </div>
            <div className="flex items-center justify-end gap-1">
                {r.status === 'PENDING' && (
                    <>
                        <button onClick={() => runAction(r.id, approveProcurementRequest, 'Approve')} disabled={pending}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all disabled:opacity-50"
                            style={{ borderColor: 'color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                            <CheckCircle2 size={11} /> Approve
                        </button>
                        <button onClick={() => runAction(r.id, rejectProcurementRequest, 'Reject')} disabled={pending}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all disabled:opacity-50"
                            style={{ borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                            <XCircle size={11} /> Reject
                        </button>
                    </>
                )}
                {r.status === 'APPROVED' && (
                    <button onClick={() => runAction(r.id, executeProcurementRequest, 'Execute')} disabled={pending}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all disabled:opacity-50"
                        style={{ borderColor: 'color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                        <PlayCircle size={11} /> Execute
                    </button>
                )}
                {(r.status === 'PENDING' || r.status === 'APPROVED') && (
                    <button onClick={() => runAction(r.id, cancelProcurementRequest, 'Cancel')} disabled={pending}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/30 transition-all disabled:opacity-50">
                        <Ban size={11} /> Cancel
                    </button>
                )}
            </div>
        </div>
    )
}
