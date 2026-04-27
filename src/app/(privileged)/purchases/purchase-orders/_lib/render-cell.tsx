import type { PO } from './types'
import { STATUS_CONFIG, fmt } from './constants'

export function renderPOCell(key: string, po: PO): React.ReactNode {
    const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'var(--app-muted-foreground)' }
    switch (key) {
        case 'date': return <span className="text-[11px] text-app-muted-foreground">{po.order_date || '—'}</span>
        case 'expected': return <span className="text-[11px] text-app-muted-foreground">{po.expected_delivery || '—'}</span>
        case 'amount': return <span className="text-[12px] font-mono font-bold tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>{fmt(po.total_amount)}</span>
        case 'lines': {
            const count = (po as any).line_count ?? (po as any).lines?.length ?? '—'
            return <span className="text-[11px] font-mono font-bold text-app-foreground">{count}</span>
        }
        case 'receiving': {
            const pct = Number((po as any).receipt_progress || 0)
            const lineCount = (po as any).line_count || 0
            if (lineCount === 0) return <span className="text-[9px] text-app-muted-foreground">—</span>
            const barColor = pct >= 100 ? 'var(--app-success)' : pct > 0 ? 'var(--app-warning)' : 'var(--app-muted-foreground)'
            return (
                <div className="flex items-center gap-1.5 w-full">
                    <div className="flex-1 h-1.5 rounded-full bg-app-border/30 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                    </div>
                    <span className="text-[9px] font-bold font-mono flex-shrink-0" style={{ color: barColor }}>{pct}%</span>
                </div>
            )
        }
        case 'warehouse': return <span className="text-[10px] text-app-foreground truncate">{po.warehouse?.name || '—'}</span>
        case 'priority': {
            const p = po.priority?.toUpperCase()
            const pColor = p === 'URGENT' ? 'var(--app-error)' : p === 'HIGH' ? 'var(--app-warning)' : 'var(--app-muted-foreground)'
            return <span className="text-[9px] font-black uppercase" style={{ color: pColor }}>{po.priority || '—'}</span>
        }
        case 'subtype': return <span className="text-[9px] font-bold text-app-muted-foreground uppercase">{po.purchase_sub_type || '—'}</span>
        case 'scope': {
            const s = po.po_number?.startsWith('IPO-') ? 'INT' : 'OFF'
            const sColor = s === 'INT' ? 'var(--app-warning)' : 'var(--app-info)'
            return <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded" style={{ color: sColor, background: `color-mix(in srgb, ${sColor} 10%, transparent)` }}>{s}</span>
        }
        case 'currency': return <span className="text-[10px] font-mono text-app-muted-foreground">{po.currency || '—'}</span>
        case 'supplierRef': return <span className="text-[10px] font-mono text-app-muted-foreground truncate">{po.supplier_ref || '—'}</span>
        case 'subtotal': return <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmt(po.subtotal)}</span>
        case 'tax': return <span className="text-[10px] font-mono tabular-nums text-app-muted-foreground">{fmt(po.tax_amount)}</span>
        case 'shipping': return <span className="text-[10px] font-mono tabular-nums text-app-muted-foreground">{fmt(po.shipping_cost)}</span>
        case 'discount': return <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--app-error, #ef4444)' }}>{fmt(po.discount_amount)}</span>
        case 'invoicePolicy': return <span className="text-[9px] font-bold text-app-muted-foreground uppercase truncate">{po.invoice_policy === 'RECEIVED_QTY' ? 'Received' : po.invoice_policy === 'ORDERED_QTY' ? 'Ordered' : po.invoice_policy || '—'}</span>
        case 'received': return <span className="text-[9px] text-app-muted-foreground">{po.received_date || '—'}</span>
        case 'created': return <span className="text-[9px] text-app-muted-foreground">{po.created_at ? new Date(po.created_at).toLocaleDateString() : '—'}</span>
        case 'createdBy': return <span className="text-[9px] text-app-muted-foreground truncate">{(po as any).created_by_name || (po as any).created_by?.username || '—'}</span>
        case 'status':
            return <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>{sc.label}</span>
        default: return <span className="text-[10px] text-app-muted-foreground">—</span>
    }
}
