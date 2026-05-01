'use client'

import type { PurchaseLine } from '@/types/erp'
import { Package, Trash2, Shield, AlertCircle } from 'lucide-react'
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
        <div className="group flex items-center gap-0 transition-all"
            style={{ 
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                background: 'transparent'
            }}>
            {/* Product */}
            <div className="px-5 py-3 w-[200px] flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                        <Package size={14} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="truncate text-[12px] font-black tracking-tight text-app-foreground">{line.productName as string}</span>
                        <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">SKU-{String(line.productId).padStart(4, '0')}</span>
                    </div>
                </div>
            </div>

            {/* Qty */}
            <div className="px-2 py-3 w-[60px] flex-shrink-0 text-center">
                <input type="number" className="w-full rounded-xl px-2 py-1.5 text-center font-black text-[12px] outline-none border transition-all"
                    style={{ 
                        background: 'var(--app-background)', 
                        borderColor: 'var(--app-border)', 
                        color: 'var(--app-foreground)' 
                    }}
                    value={line.quantity}
                    onChange={(e) => onUpdate(idx, { quantity: Number(e.target.value) })}
                />
            </div>

            {/* Requested */}
            <div className="px-2 py-3 w-[75px] flex-shrink-0 text-center font-bold text-[11px] text-app-muted-foreground hidden xl:block">—</div>

            {/* Required */}
            <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center">
                <span className="font-black text-[11px] tabular-nums text-app-foreground">{line.requiredProposed as number}</span>
            </div>

            {/* Stock */}
            <div className="px-2 py-3 w-[90px] flex-shrink-0 text-center hidden lg:block">
                <div className="flex items-center justify-center gap-1">
                    <span className="text-[11px] font-bold text-app-muted-foreground tabular-nums">{line.stockTransit as number}</span>
                    <span className="text-[11px] text-app-border">/</span>
                    <span className="font-black text-[11px] text-app-foreground tabular-nums">{line.stockTotal as number}</span>
                </div>
            </div>

            {/* PO Count */}
            <div className="px-2 py-3 w-[65px] flex-shrink-0 text-center hidden lg:block">
                <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-black tabular-nums"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                    {line.poCount as number}
                </span>
            </div>

            {/* Status */}
            <div className="px-2 py-3 w-[70px] flex-shrink-0 text-center">
                <span className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border"
                    style={{ background: `color-mix(in srgb, ${statusStyle.bg} 15%, transparent)`, color: statusStyle.text, borderColor: `color-mix(in srgb, ${statusStyle.text} 30%, transparent)` }}>
                    {line.statusText as string}
                </span>
            </div>

            {/* Sales */}
            <div className="px-2 py-3 w-[70px] flex-shrink-0 text-center hidden xl:block">
                <span className="font-black text-[11px] tabular-nums text-app-foreground">{line.salesMonthly as number}</span>
            </div>

            {/* Score */}
            <div className="px-2 py-3 w-[65px] flex-shrink-0 text-center hidden xl:block">
                <div className="flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-app-info" />
                    <span className="font-black text-[11px] tabular-nums text-app-info">{line.scoreAdjust as string}</span>
                </div>
            </div>

            {/* Purchased */}
            <div className="px-2 py-3 w-[75px] flex-shrink-0 text-center hidden xl:block">
                <span className="font-black text-[11px] tabular-nums text-app-foreground">{line.purchasedSold as number}</span>
            </div>

            {/* Cost */}
            <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center">
                <div className="font-black text-[11px] tabular-nums text-app-foreground">{Number(line.unitCostHT).toLocaleString()}</div>
                <div className="text-[9px] font-bold text-app-muted-foreground/60 line-through tabular-nums">{Number(line.sellingPriceHT).toLocaleString()}</div>
            </div>

            {/* Supplier Price */}
            <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center hidden lg:block">
                <span className="font-black text-[11px] tabular-nums text-app-error">{Number(line.supplierPrice).toLocaleString()}</span>
            </div>

            {/* Expiry */}
            <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center hidden lg:block">
                <div className="flex items-center justify-center gap-1 text-app-success">
                    <Shield size={10} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{line.expirySafety as string}</span>
                </div>
            </div>

            {/* Delete */}
            <div className="px-2 py-3 w-[45px] flex-shrink-0 text-center" style={{ borderLeft: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                <button type="button" onClick={() => onRemove(idx)}
                    className="p-2 rounded-xl text-app-muted-foreground/40 hover:text-app-error hover:bg-app-error/10 transition-all">
                    <Trash2 size={15} />
                </button>
            </div>
        </div>
    )
}
