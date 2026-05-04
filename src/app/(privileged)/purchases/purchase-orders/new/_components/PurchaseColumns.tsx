'use client'

import React from 'react'
import type { PurchaseLine } from '@/types/erp'
import { Shield, Info } from 'lucide-react'
import { getPipelineStatus } from '@/lib/procurement-status'

type Props = {
    line: PurchaseLine
    idx: number
    onUpdate: (idx: number, updates: Record<string, any>) => void
}

export function renderPurchaseCell(key: string, line: PurchaseLine, idx: number, onUpdate: (idx: number, updates: Record<string, any>) => void): React.ReactNode {
    // Single source of truth: product.pipeline_status (NONE/REQUESTED/PO_SENT/...)
    // Same vocabulary as /inventory/products and the request mapping on /inventory/requests.
    const procurement = getPipelineStatus(line.pipeline_status as string | undefined)

    switch (key) {
        case 'qty':
            return (
                <input type="number" className="w-12 rounded-lg px-1.5 py-1 text-center font-black text-[11px] outline-none border border-app-border bg-app-surface/50 focus:border-app-primary transition-all"
                    value={Number(line.quantity || 0)}
                    onChange={(e) => onUpdate(idx, { quantity: Number(e.target.value) })}
                    onClick={e => e.stopPropagation()}
                />
            )
        case 'requested':
            return <span className="font-bold text-[11px] text-app-muted-foreground">—</span>
        case 'required':
            return <span className="font-black text-[11px] tabular-nums text-app-foreground">{Number(line.requiredProposed || 0)}</span>
        case 'stock':
            return (
                <div className="flex items-center justify-center gap-1">
                    <span className="text-[11px] font-bold text-app-muted-foreground tabular-nums">{Number(line.stockTransit || 0)}</span>
                    <span className="text-[11px] text-app-border">/</span>
                    <span className="font-black text-[11px] text-app-foreground tabular-nums">{Number(line.stockTotal || 0)}</span>
                </div>
            )
        case 'poCount':
            return (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] font-black tabular-nums"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                    {Number(line.poCount || 0)}
                </span>
            )
        case 'status':
            return (
                <span className="px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border"
                    style={{
                        background: `color-mix(in srgb, ${procurement.color} 12%, transparent)`,
                        color: procurement.color,
                        borderColor: `color-mix(in srgb, ${procurement.color} 30%, transparent)`,
                    }}>
                    {procurement.label}
                </span>
            )
        case 'sales':
            return <span className="font-black text-[11px] tabular-nums text-app-foreground">{Number(line.salesMonthly || 0)}</span>
        case 'score':
            return (
                <div className="flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-app-info" />
                    <span className="font-black text-[11px] tabular-nums text-app-info">{String(line.scoreAdjust || '—')}</span>
                </div>
            )
        case 'purchased':
            return <span className="font-black text-[11px] tabular-nums text-app-foreground">{Number(line.purchasedSold || 0)}</span>
        case 'cost':
            return (
                <div className="flex flex-col items-end">
                    <div className="font-black text-[11px] tabular-nums text-app-foreground">{Number(line.unitCostHT || 0).toLocaleString()}</div>
                    <div className="text-[9px] font-bold text-app-muted-foreground/60 line-through tabular-nums">{Number(line.sellingPriceHT || 0).toLocaleString()}</div>
                </div>
            )
        case 'supplier':
            return <span className="font-black text-[11px] tabular-nums text-app-error">{Number(line.supplierPrice || 0).toLocaleString()}</span>
        case 'expiry':
            return (
                <div className="flex items-center justify-center gap-1 text-app-success">
                    <Shield size={10} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{String(line.expirySafety || '')}</span>
                </div>
            )
        case 'supPlus':
            return <Info size={12} className="text-app-muted-foreground/40 hover:text-app-primary cursor-help transition-colors" />
        default:
            return <span className="text-[11px] text-app-muted-foreground">—</span>
    }
}
