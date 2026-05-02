'use client'

import type { PurchaseLine } from '@/types/erp'
import type { ColumnKey } from '../_lib/columns'
import { Package, Trash2, Shield, AlertCircle } from 'lucide-react'
import { getStatusStyle } from '../_lib/status-styles'

type Props = {
    line: PurchaseLine
    idx: number
    onUpdate: (idx: number, updates: Record<string, any>) => void
    onRemove: (idx: number) => void
    visibleColumns: Set<ColumnKey>
}

export function LineRowDesktop({ line, idx, onUpdate, onRemove, visibleColumns }: Props) {
    const statusStyle = getStatusStyle(line.statusText as string)
    
    return (
        <div className="group flex items-center gap-0 transition-all"
            style={{ 
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                background: 'transparent'
            }}>
            {/* Product */}
            <div className="px-5 py-3 w-[240px] flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                        <Package size={16} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="truncate text-[13px] font-bold tracking-tight text-app-foreground leading-tight">{String(line.productName || '')}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono font-bold text-app-muted-foreground uppercase tracking-widest bg-app-surface/50 px-1.5 py-0.5 rounded-md border border-app-border/40">
                                {String(line.productId || 0).padStart(4, '0')}
                            </span>
                            {!!line.categoryName && (
                                <span className="text-[9px] font-black text-app-muted-foreground/60 uppercase tracking-tighter">
                                    • {String(line.categoryName)}
                                </span>
                            )}
                        </div>
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
                    value={Number(line.quantity || 0)}
                    onChange={(e) => onUpdate(idx, { quantity: Number(e.target.value) })}
                />
            </div>

            {/* Requested */}
            {visibleColumns.has('requested') && (
                <div className="px-2 py-3 w-[75px] flex-shrink-0 text-center font-bold text-[11px] text-app-muted-foreground hidden xl:block">—</div>
            )}

            {/* Required */}
            {visibleColumns.has('required') && (
                <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center">
                    <span className="font-black text-[11px] tabular-nums text-app-foreground">{Number(line.requiredProposed || 0)}</span>
                </div>
            )}

            {/* Stock */}
            {visibleColumns.has('stock') && (
                <div className="px-2 py-3 w-[90px] flex-shrink-0 text-center hidden lg:block">
                    <div className="flex items-center justify-center gap-1">
                        <span className="text-[11px] font-bold text-app-muted-foreground tabular-nums">{Number(line.stockTransit || 0)}</span>
                        <span className="text-[11px] text-app-border">/</span>
                        <span className="font-black text-[11px] text-app-foreground tabular-nums">{Number(line.stockTotal || 0)}</span>
                    </div>
                </div>
            )}

            {/* PO Count */}
            {visibleColumns.has('poCount') && (
                <div className="px-2 py-3 w-[65px] flex-shrink-0 text-center hidden lg:block">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-black tabular-nums"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                        {Number(line.poCount || 0)}
                    </span>
                </div>
            )}

            {/* Status */}
            {visibleColumns.has('status') && (
                <div className="px-2 py-3 w-[70px] flex-shrink-0 text-center">
                    <span className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border"
                        style={{ background: `color-mix(in srgb, ${statusStyle.bg} 15%, transparent)`, color: statusStyle.text, borderColor: `color-mix(in srgb, ${statusStyle.text} 30%, transparent)` }}>
                        {String(line.statusText || 'OPTIONAL')}
                    </span>
                </div>
            )}

            {/* Sales */}
            {visibleColumns.has('sales') && (
                <div className="px-2 py-3 w-[70px] flex-shrink-0 text-center hidden xl:block">
                    <span className="font-black text-[11px] tabular-nums text-app-foreground">{Number(line.salesMonthly || 0)}</span>
                </div>
            )}

            {/* Score */}
            {visibleColumns.has('score') && (
                <div className="px-2 py-3 w-[65px] flex-shrink-0 text-center hidden xl:block">
                    <div className="flex items-center justify-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-app-info" />
                        <span className="font-black text-[11px] tabular-nums text-app-info">{String(line.scoreAdjust || '—')}</span>
                    </div>
                </div>
            )}

            {/* Purchased */}
            {visibleColumns.has('purchased') && (
                <div className="px-2 py-3 w-[75px] flex-shrink-0 text-center hidden xl:block">
                    <span className="font-black text-[11px] tabular-nums text-app-foreground">{Number(line.purchasedSold || 0)}</span>
                </div>
            )}

            {/* Cost */}
            {visibleColumns.has('cost') && (
                <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center">
                    <div className="font-black text-[11px] tabular-nums text-app-foreground">{Number(line.unitCostHT || 0).toLocaleString()}</div>
                    <div className="text-[9px] font-bold text-app-muted-foreground/60 line-through tabular-nums">{Number(line.sellingPriceHT || 0).toLocaleString()}</div>
                </div>
            )}

            {/* Supplier Price */}
            {visibleColumns.has('supplier') && (
                <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center hidden lg:block">
                    <span className="font-black text-[11px] tabular-nums text-app-error">{Number(line.supplierPrice || 0).toLocaleString()}</span>
                </div>
            )}

            {/* Expiry */}
            {visibleColumns.has('expiry') && (
                <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center hidden lg:block">
                    <div className="flex items-center justify-center gap-1 text-app-success">
                        <Shield size={10} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{String(line.expirySafety || '')}</span>
                    </div>
                </div>
            )}

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
