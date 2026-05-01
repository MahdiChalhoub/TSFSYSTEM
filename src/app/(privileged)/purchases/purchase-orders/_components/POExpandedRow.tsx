'use client'

import { useState, useEffect } from 'react'
import { Eye, Package, Truck, Receipt } from 'lucide-react'
import { fetchPurchaseOrder } from '@/app/actions/pos/purchases'
import { DCell } from '@/components/ui/DCell'
import type { PO } from '../_lib/types'
import { STATUS_CONFIG, fmt } from '../_lib/constants'
import { InlineStatusCell } from './InlineStatusCell'

export function POExpandedRow({ po, onView, onRefresh }: { po: PO; onView: (id: number) => void; onRefresh?: () => void }) {
    const [detail, setDetail] = useState<PO | null>(null)
    useEffect(() => {
        fetchPurchaseOrder(po.id).then(d => setDetail(d)).catch(() => setDetail(po))
    }, [po.id])

    const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'var(--app-muted-foreground)' }
    const supplier = po.supplier?.name || po.supplier_name || po.supplier_display || '—'

    return (
        <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
                <button onClick={() => onView(po.id)}
                    className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all">
                    <Eye size={11} /> View Details
                </button>
                <div className="h-4 w-px bg-app-border/40 mx-0.5" />
                <InlineStatusCell po={po} onRefresh={onRefresh} />
                <div className="h-4 w-px bg-app-border/40 mx-0.5" />
                <button onClick={() => { window.location.href = `/purchases/receipts/new?from_po=${po.id}` }}
                    className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
                    <Truck size={11} style={{ color: 'var(--app-success)' }} /> → Receipt
                </button>
                <button onClick={() => { window.location.href = `/purchases/invoices?from_po=${po.id}` }}
                    className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
                    <Receipt size={11} style={{ color: 'var(--app-warning)' }} /> → Invoice
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                <CardSection color="var(--app-primary)" title="Order Info">
                    <DCell label="PO Number" value={po.po_number || `PO-${po.id}`} mono />
                    <DCell label="Supplier" value={supplier} />
                    <DCell label="Status" value={sc.label} color={sc.color} />
                    <DCell label="Order Date" value={po.order_date} />
                    <DCell label="Expected" value={po.expected_delivery} />
                    <DCell label="Priority" value={po.priority} />
                </CardSection>
                <CardSection color="var(--app-info)" title="Financials">
                    <DCell label="Total" value={fmt(po.total_amount)} mono color="var(--app-success)" />
                    <DCell label="Lines" value={detail?.lines?.length ?? '...'} />
                    <DCell label="Created" value={po.created_at ? new Date(po.created_at).toLocaleDateString() : null} />
                </CardSection>
                {detail?.lines && detail.lines.length > 0 && (
                    <div className="rounded-xl border border-app-border/40 overflow-hidden md:col-span-2 xl:col-span-1" style={{ background: 'var(--app-surface)' }}>
                        <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
                            style={{ background: 'color-mix(in srgb, var(--app-success) 6%, transparent)' }}>
                            <div className="w-1 h-3 rounded-full" style={{ background: 'var(--app-success)' }} />
                            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success)' }}>Lines ({detail.lines.length})</span>
                        </div>
                        <div className="px-3 py-2 space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar">
                            {detail.lines.map((line: any) => (
                                <div key={line.id} className="flex items-center gap-2 text-[10px] py-1 border-b border-app-border/20 last:border-0">
                                    <Package size={10} className="text-app-muted-foreground flex-shrink-0" />
                                    <span className="flex-1 min-w-0 truncate font-bold text-app-foreground">{line.product?.name || line.product_name || '—'}</span>
                                    <span className="font-mono text-app-muted-foreground flex-shrink-0">{line.quantity || line.quantity_ordered || 0} × {fmt(line.unit_price)}</span>
                                    <span className="font-mono font-bold text-app-foreground flex-shrink-0">{fmt(line.line_total || line.subtotal)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {po.notes && (
                <div className="mt-2.5 px-3 py-2 rounded-xl border border-app-border/30" style={{ background: 'var(--app-surface)' }}>
                    <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Notes</span>
                    <div className="text-[10px] font-medium text-app-foreground/80 line-clamp-2 mt-0.5">{po.notes}</div>
                </div>
            )}
        </div>
    )
}

function CardSection({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-app-border/40 overflow-hidden" style={{ background: 'var(--app-surface)' }}>
            <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
                style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
                <div className="w-1 h-3 rounded-full" style={{ background: color }} />
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{title}</span>
            </div>
            <div className="px-3 py-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[10px]">
                {children}
            </div>
        </div>
    )
}
