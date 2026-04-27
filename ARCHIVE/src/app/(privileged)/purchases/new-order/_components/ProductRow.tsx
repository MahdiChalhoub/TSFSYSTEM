// @ts-nocheck
'use client'

/**
 * ProductRow — Desktop table row for PO intelligence grid
 * =========================================================
 */

import React, { memo } from 'react'
import { Trash2 } from 'lucide-react'
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

export const ProductRow = memo(function ProductRow({ line, updateLine, removeLine, onTransfer, onPurchaseRequest, vc, isSelected, onToggleSelect }: {
    line: OrderLine, updateLine: (id: string, u: Partial<OrderLine>) => void, removeLine: (id: string) => void,
    onTransfer: (l: OrderLine) => void, onPurchaseRequest: (l: OrderLine) => void,
    vc: Record<string, boolean>,
    isSelected?: boolean, onToggleSelect?: (id: string) => void,
}) {
    const stockColor = line.stockOnLocation <= 0 ? 'text-rose-500' : line.stockOnLocation < line.monthlyAverage ? 'text-amber-500' : 'text-emerald-600'
    const fsColor = line.financialScore >= 100 ? 'text-emerald-600' : line.financialScore >= 50 ? 'text-amber-500' : 'text-app-foreground'
    const lineTotal = line.actionQty * line.unitCost

    // Conditional row tinting
    const rowBg = isSelected
        ? 'bg-app-primary/[0.06]'
        : line.stockOnLocation <= 0
            ? 'bg-rose-500/[0.03] hover:bg-rose-500/[0.06]'
            : line.stockOnLocation < line.monthlyAverage
                ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]'
                : line.marginPct >= 25
                    ? 'bg-emerald-500/[0.02] hover:bg-emerald-500/[0.05]'
                    : 'hover:bg-app-background/30'

    return (
        <tr className={`${rowBg} transition-colors group`}>
            {/* Product Info — always visible */}
            <td className="py-2.5 px-4">
                <div className="flex items-start gap-2">
                    {onToggleSelect && (
                        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect(line.id)}
                            className="mt-1 w-3.5 h-3.5 accent-[var(--app-primary)] cursor-pointer rounded flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                <div className="font-bold text-[11px] text-app-foreground truncate max-w-[200px]">{line.productName}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-app-muted-foreground font-mono">{line.barcode}</span>
                    {line.unit && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 uppercase">{line.unit}</span>}
                    {line.category && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-md bg-app-primary/10 text-app-primary">{line.category}</span>}
                </div>
                    </div>
                </div>
            </td>
            {/* Qty */}
            {vc.qty && (
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className="flex items-center gap-1 justify-center">
                    <input type="number" min={0}
                        className="w-12 text-center text-[10px] font-black h-7 bg-app-background/60 border border-app-border/40 rounded-md outline-none focus:ring-2 focus:ring-app-primary/30"
                        value={line.actionQty || ''} onChange={e => updateLine(line.id, { actionQty: Number(e.target.value) })} />
                    <button type="button" onClick={() => removeLine(line.id)}
                        className="p-1 text-app-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={11} />
                    </button>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <button type="button"
                        className="text-[8px] font-bold text-app-primary hover:underline"
                        onClick={() => updateLine(line.id, { actionQty: line.qtyProposed, qtyRequired: line.qtyProposed })}
                        title="Apply proposed quantity">
                        ↗ {line.qtyProposed}
                    </button>
                    {lineTotal > 0 && (
                        <span className="text-[8px] font-bold text-app-muted-foreground tabular-nums">
                            = {lineTotal > 999999 ? `${(lineTotal / 1000000).toFixed(1)}M` : lineTotal > 999 ? `${(lineTotal / 1000).toFixed(1)}K` : lineTotal.toLocaleString()}
                        </span>
                    )}
                </div>
            </td>
            )}
            {/* Stock */}
            {vc.stock && (
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className={`text-xs font-black ${stockColor}`}>{line.stockOnLocation}</div>
                <div className="text-[8px] text-app-muted-foreground">
                    {line.stockTotal !== line.stockOnLocation ? <span>{line.stockTotal} total</span> : <span>—</span>}
                    {line.stockInTransit > 0 && <span className="ml-1 text-amber-500">⟳ {line.stockInTransit}</span>}
                </div>
            </td>
            )}
            {/* Status + PO Count */}
            {vc.productStatus && (
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className={`text-[9px] font-black uppercase ${
                    line.productStatus === 'Available' ? 'text-emerald-500' :
                    line.productStatus === 'Requested to Purchase' ? 'text-sky-500' :
                    line.productStatus === 'Requested to Transfer' ? 'text-sky-400' :
                    line.productStatus === 'Approved to Purchase' ? 'text-blue-500' :
                    line.productStatus === 'Approved to Transfer' ? 'text-blue-400' :
                    line.productStatus === 'Adjustment Pending' ? 'text-orange-400' :
                    line.productStatus === 'Pending PO' ? 'text-blue-500' :
                    line.productStatus === 'Pending Approval' ? 'text-blue-400' :
                    line.productStatus === 'PO Approved' ? 'text-indigo-500' :
                    line.productStatus === 'PO Rejected' ? 'text-rose-500' :
                    line.productStatus === 'Ordered' ? 'text-violet-500' :
                    line.productStatus === 'In Transit' ? 'text-amber-500' :
                    line.productStatus === 'Partially Received' ? 'text-cyan-500' :
                    line.productStatus === 'Received' ? 'text-emerald-600' :
                    line.productStatus === 'Low Stock' ? 'text-amber-600' :
                    line.productStatus === 'Out of Stock' ? 'text-rose-500' :
                    line.productStatus === 'Failed' ? 'text-rose-600' : 'text-rose-500'
                }`}>{line.productStatus}</div>
                {line.statusDetail && (
                    <div className="text-[7px] text-app-muted-foreground mt-0.5 truncate max-w-[80px]" title={line.statusDetail}>
                        {line.statusDetail}
                    </div>
                )}
                {!line.statusDetail && (
                    <div className="text-[8px] text-app-muted-foreground mt-0.5">{line.purchaseCount} PO{line.purchaseCount !== 1 ? 's' : ''}</div>
                )}
            </td>
            )}
            {/* Trend */}
            {vc.trend && (
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className={`text-sm font-black ${line.trend === 'UP' ? 'text-emerald-500' : line.trend === 'DOWN' ? 'text-rose-500' : 'text-app-muted-foreground'}`}>
                    {line.trend === 'UP' ? '↑' : line.trend === 'DOWN' ? '↓' : '→'}
                </div>
                <div className="text-[7px] text-app-muted-foreground font-bold">{line.trend}</div>
            </td>
            )}
            {/* Sales Periods */}
            {vc.salesWindows && (
            <td className="py-1.5 px-1 border-l border-app-border/20">
                {line.salesWindows.length > 0 ? (
                    <div className="flex items-center gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        {line.salesWindows.slice().reverse().map((w, i) => (
                            <div key={i} className="flex-shrink-0 group/sw relative">
                                <div className={`w-[30px] h-[22px] rounded flex items-center justify-center text-[9px] font-black border transition-all cursor-help ${
                                    w.qty === 0 ? 'bg-app-background/30 border-app-border/20 text-app-muted-foreground/50' :
                                    w.qty >= (line.dailySales * line.salesWindowSizeDays * 1.3) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' :
                                    w.qty <= (line.dailySales * line.salesWindowSizeDays * 0.5) ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' :
                                    'bg-app-background/50 border-app-border/40 text-app-foreground'
                                }`}>
                                    {w.qty > 999 ? `${(w.qty / 1000).toFixed(1)}k` : Math.round(w.qty)}
                                </div>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/sw:block z-[60] pointer-events-none">
                                    <div className="bg-app-surface border border-app-border rounded-md shadow-lg px-2 py-1 whitespace-nowrap text-[8px]">
                                        <div className="font-bold text-app-foreground">{w.start} → {w.end}</div>
                                        <div className="text-app-muted-foreground">Sold: {Math.round(w.qty)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <span className="text-[8px] text-app-muted-foreground/50">—</span>}
            </td>
            )}
            {/* Sales / monthly */}
            {vc.dailySales && (
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className="font-bold text-xs text-app-foreground">{line.dailySales.toFixed(1)}</div>
                <div className="text-[8px] text-app-muted-foreground">
                    {line.monthlyAverage.toFixed(0)}/mo
                    <span className="ml-0.5 opacity-60">
                        ({line.salesPeriodDays >= 365 ? '1Y' : line.salesPeriodDays >= 180 ? '6M' : line.salesPeriodDays >= 90 ? '3M' : `${line.salesPeriodDays}d`})
                    </span>
                </div>
            </td>
            )}
            {/* Score */}
            {vc.financialScore && (
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className={`font-black text-xs ${fsColor}`}>{line.financialScore}</div>
                <div className={`text-[8px] font-bold ${line.adjustmentScore >= 500 ? 'text-rose-500' : 'text-app-muted-foreground'}`}>{line.adjustmentScore}</div>
            </td>
            )}
            {/* Cost */}
            {vc.unitCost && (
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className="font-bold text-[10px] text-app-foreground">{Number(line.unitCost).toLocaleString()}</div>
                <div className="text-[8px] text-app-muted-foreground">
                    {Number(line.sellingPrice).toLocaleString()}
                    {line.marginPct > 0 && (
                        <span className={`ml-1 font-bold ${line.marginPct >= 20 ? 'text-emerald-500' : line.marginPct >= 10 ? 'text-amber-500' : 'text-rose-400'}`}>
                            {line.marginPct.toFixed(0)}%
                        </span>
                    )}
                </div>
            </td>
            )}
            {/* Supplier */}
            {vc.bestSupplier && (
            <td className="py-2 px-2 border-l border-app-border/20">
                <div className="font-bold text-[10px] text-app-foreground truncate max-w-[100px]">{line.bestSupplier || '—'}</div>
                <div className="text-[9px] text-app-muted-foreground">{line.bestPrice ? line.bestPrice.toLocaleString() : '—'}</div>
            </td>
            )}
            {/* Expiry */}
            {vc.expiry && (
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                {line.isExpiryTracked && line.expiryInfo ? (
                    <>
                        <div className="text-[9px] font-bold text-app-foreground">
                            {line.expiryInfo.nearest_days > 0 ? `${line.expiryInfo.nearest_days}d` : 'Expired'}
                        </div>
                        <SafetyBadge tag={line.safetyTag} />
                    </>
                ) : <span className="text-[8px] text-app-muted-foreground/50">—</span>}
            </td>
            )}
            {/* Sup+ */}
            {vc.suppliers && (
            <td className="py-2 px-2 text-center border-l border-app-border/20 relative">
                {line.availableSuppliers.length > 0 ? (
                    <div className="relative inline-block group/sup">
                        <span className="text-[10px] font-black text-app-primary cursor-help">Sup {line.availableSuppliers.length}</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/sup:block z-[60] pointer-events-none">
                            <div className="bg-app-surface border border-app-border rounded-lg shadow-xl px-3 py-2 min-w-[160px] max-w-[220px] pointer-events-auto">
                                <div className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-wider mb-1.5">Available Suppliers</div>
                                {line.availableSuppliers.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2 py-0.5 border-b border-app-border/20 last:border-0">
                                        <span className="text-[9px] font-semibold text-app-foreground truncate">{s.name || 'Unknown'}</span>
                                        {s.price != null && <span className="text-[8px] font-mono text-app-muted-foreground whitespace-nowrap">{s.price.toLocaleString()}</span>}
                                    </div>
                                ))}
                            </div>
                            <div className="w-2 h-2 bg-app-surface border-r border-b border-app-border rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
                        </div>
                    </div>
                ) : <span className="text-[8px] text-app-muted-foreground/50">—</span>}
            </td>
            )}
        </tr>
    )
})
