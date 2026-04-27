import type { PurchaseLine } from '@/types/erp'
import { Package, Trash2, Shield } from 'lucide-react'
import { getStatusStyle } from '../_lib/status-styles'

type Props = {
    line: PurchaseLine
    idx: number
    onUpdate: (idx: number, updates: Record<string, any>) => void
    onRemove: (idx: number) => void
}

export function LineRowDesktop({ line, idx, onUpdate, onRemove }: Props) {
    const statusStyle = getStatusStyle(line.statusText as string)
    return (
        <div className="group flex items-center gap-0 transition-colors"
            style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 3%, transparent)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            {/* Product */}
            <div className="px-4 py-2.5 w-[200px] flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                        <Package size={13} />
                    </div>
                    <span className="truncate text-[13px] font-bold" style={{ color: 'var(--app-foreground)' }}>{line.productName as string}</span>
                </div>
                <input type="hidden" name={`lines[${idx}][productId]`} value={String(line.productId)} />
                <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
            </div>
            {/* Qty */}
            <div className="px-2 py-2 w-[60px] flex-shrink-0 text-center">
                <input type="number" className="w-full rounded-lg p-1.5 text-center font-bold text-[12px] outline-none transition-all"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                    value={line.quantity}
                    onChange={(e) => onUpdate(idx, { quantity: Number(e.target.value) })}
                    name={`lines[${idx}][quantity]`} />
            </div>
            {/* Requested */}
            <div className="px-2 py-2.5 w-[75px] flex-shrink-0 text-center font-semibold text-[12px] hidden xl:block" style={{ color: 'var(--app-muted-foreground)' }}>—</div>
            {/* Required */}
            <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center">
                <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.requiredProposed as number}</span>
            </div>
            {/* Stock */}
            <div className="px-2 py-2.5 w-[90px] flex-shrink-0 text-center hidden lg:block">
                <span className="text-[12px] tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{line.stockTransit as number}</span>
                <span className="text-[12px] mx-0.5" style={{ color: 'var(--app-border)' }}>·</span>
                <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.stockTotal as number}</span>
            </div>
            {/* PO Count */}
            <div className="px-2 py-2.5 w-[65px] flex-shrink-0 text-center hidden lg:block">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold tabular-nums"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                    {line.poCount as number}
                </span>
            </div>
            {/* Status */}
            <div className="px-2 py-2.5 w-[70px] flex-shrink-0 text-center">
                <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider"
                    style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                    {line.statusText as string}
                </span>
            </div>
            {/* Sales */}
            <div className="px-2 py-2.5 w-[70px] flex-shrink-0 text-center hidden xl:block">
                <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.salesMonthly as number}</span>
            </div>
            {/* Score */}
            <div className="px-2 py-2.5 w-[65px] flex-shrink-0 text-center hidden xl:block">
                <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{line.scoreAdjust as string}</span>
            </div>
            {/* Purchased */}
            <div className="px-2 py-2.5 w-[75px] flex-shrink-0 text-center hidden xl:block">
                <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.purchasedSold as number}</span>
            </div>
            {/* Cost */}
            <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center">
                <div className="font-bold font-mono text-[11px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{Number(line.unitCostHT).toFixed(2)}</div>
                <div className="text-[10px] font-bold line-through tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{Number(line.sellingPriceHT).toFixed(2)}</div>
                <input type="hidden" name={`lines[${idx}][unitCostHT]`} value={line.unitCostHT} />
                <input type="hidden" name={`lines[${idx}][unitCostTTC]`} value={line.unitCostTTC ?? Number(line.unitCostHT) * (1 + Number(line.taxRate || 0))} />
            </div>
            {/* Supplier Price */}
            <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center hidden lg:block">
                <span className="font-bold font-mono text-[11px] tabular-nums" style={{ color: 'var(--app-error, #ef4444)' }}>{Number(line.supplierPrice).toFixed(2)}</span>
            </div>
            {/* Expiry */}
            <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center hidden lg:block">
                <div className="flex items-center justify-center gap-1">
                    <Shield size={10} style={{ color: 'var(--app-success, #22c55e)' }} />
                    <span className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>{line.expirySafety as string}</span>
                </div>
            </div>
            {/* Delete */}
            <div className="px-2 py-2.5 w-[45px] flex-shrink-0 text-center" style={{ borderLeft: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                <button type="button" onClick={() => onRemove(idx)}
                    className="opacity-20 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
                    style={{ color: 'var(--app-error, #ef4444)' }}>
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    )
}
