// @ts-nocheck
'use client'

/**
 * MobileCard — Mobile-friendly order line card
 * ================================================
 */

import React, { useState, memo } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import type { OrderLine } from '../_lib/types'

function SafetyBadge({ tag }: { tag: string }) {
    const c: Record<string, { bg: string; text: string; label: string }> = {
        SAFE: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600', label: '✓ SAFE' },
        CAUTION: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600', label: '⚠ CAUTION' },
        RISKY: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600', label: '✕ RISKY' },
    }
    const cfg = c[tag] || c.SAFE
    return <span className={`${cfg.bg} ${cfg.text} text-[7px] font-black px-1.5 py-0.5 rounded-full`}>{cfg.label}</span>
}

function Stat({ label, value, className = 'text-app-foreground' }: { label: string, value: any, className?: string }) {
    return (
        <div className="text-center p-1.5 rounded-lg bg-app-surface/50">
            <div className="text-app-muted-foreground/60 text-[6px] font-bold uppercase tracking-wider">{label}</div>
            <div className={`font-black text-[10px] ${className} truncate`}>{value}</div>
        </div>
    )
}

export const MobileCard = memo(function MobileCard({ line, updateLine, removeLine, onTransfer, onPurchaseRequest }: {
    line: OrderLine, updateLine: (id: string, u: Partial<OrderLine>) => void, removeLine: (id: string) => void,
    onTransfer: (l: OrderLine) => void, onPurchaseRequest: (l: OrderLine) => void,
}) {
    const [expanded, setExpanded] = useState(false)
    const stockColor = line.stockOnLocation <= 0 ? 'text-rose-500' : line.stockOnLocation < line.monthlyAverage ? 'text-amber-500' : 'text-emerald-500'

    return (
        <div className="bg-app-background/40 rounded-xl border border-app-border/40 overflow-hidden">
            <div className="flex items-center gap-3 p-3">
                <button type="button" onClick={() => setExpanded(!expanded)} className="shrink-0 p-1 text-app-muted-foreground">
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-app-foreground truncate">{line.productName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] text-app-muted-foreground font-mono">{line.barcode}</span>
                        {line.isExpiryTracked && <SafetyBadge tag={line.safetyTag} />}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <input type="number" min={0}
                        className="w-14 text-center text-xs font-black h-8 bg-app-surface border border-app-border rounded-lg outline-none"
                        value={line.actionQty || ''} onChange={e => updateLine(line.id, { actionQty: Number(e.target.value) })} />
                    <button type="button" onClick={() => removeLine(line.id)} className="p-1.5 text-app-muted-foreground hover:text-rose-500">
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>
            {/* Stats Strip */}
            <div className="px-3 pb-2 text-[8px]" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: '6px' }}>
                <Stat label="Stock" value={line.stockOnLocation} className={stockColor} />
                <Stat label="Sales/d" value={line.dailySales.toFixed(1)} />
                <Stat label="Score" value={line.financialScore} className={line.financialScore >= 100 ? 'text-emerald-500' : 'text-amber-500'} />
                <Stat label="Cost" value={line.unitCost.toFixed(0)} />
            </div>
            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-app-border/30 text-[8px]" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: '6px' }}>
                    <Stat label="Transit" value={line.stockInTransit} />
                    <Stat label="Total" value={line.stockTotal} />
                    <Stat label="PO Count" value={line.purchaseCount} />
                    <Stat label="Monthly" value={line.monthlyAverage.toFixed(0)} />
                    <Stat label="Adj Score" value={line.adjustmentScore} />
                    <Stat label="Margin" value={`${line.marginPct.toFixed(0)}%`} />
                    <Stat label="Sell Price" value={line.sellingPrice.toFixed(0)} />
                    <Stat label="Supplier" value={line.bestSupplier || '—'} />
                    <Stat label="Best $" value={line.bestPrice.toFixed(0)} />
                    {line.productStatus !== 'Available' && (
                        <Stat label="Status" value={line.productStatus} className={line.productStatus === 'Out of Stock' ? 'text-rose-500' : 'text-amber-500'} />
                    )}
                    {line.isExpiryTracked && line.expiryInfo && (
                        <Stat label="Expiry" value={`${line.expiryInfo.nearest_days}d`} className={line.safetyTag === 'RISKY' ? 'text-rose-500' : 'text-emerald-500'} />
                    )}
                </div>
            )}
        </div>
    )
})
