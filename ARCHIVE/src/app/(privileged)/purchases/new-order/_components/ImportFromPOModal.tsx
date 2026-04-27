// @ts-nocheck
'use client'

/**
 * ImportFromPOModal — Import lines from a previous Purchase Order
 * ================================================================
 * Fetches recent POs for the selected supplier and lets user
 * pick one to import all its lines into the current PO form.
 */

import { useState, useEffect } from 'react'
import { Loader2, FileDown, Check, X, ClipboardList, ChevronRight } from 'lucide-react'
import { fetchPurchaseOrders, fetchPurchaseOrder } from '@/app/actions/pos/purchases'

interface ImportFromPOProps {
    supplierId: number
    existingProductIds: number[]
    onImportLines: (lines: any[]) => void
    onClose: () => void
}

export function ImportFromPOModal({ supplierId, existingProductIds, onImportLines, onClose }: ImportFromPOProps) {
    const [loading, setLoading] = useState(true)
    const [orders, setOrders] = useState<any[]>([])
    const [loadingDetail, setLoadingDetail] = useState<number | null>(null)
    const [selectedPO, setSelectedPO] = useState<any | null>(null)
    const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set())

    useEffect(() => {
        (async () => {
            setLoading(true)
            try {
                const data = await fetchPurchaseOrders({ supplier: supplierId.toString() })
                const raw = Array.isArray(data) ? data : (data?.results ?? [])
                // Show most recent first, exclude drafts
                setOrders(raw
                    .filter((o: any) => o.status !== 'CANCELLED')
                    .sort((a: any, b: any) => new Date(b.created_at || b.order_date || 0).getTime() - new Date(a.created_at || a.order_date || 0).getTime())
                    .slice(0, 20)
                )
            } catch (e) {
                console.error('ImportFromPO error:', e)
            }
            setLoading(false)
        })()
    }, [supplierId])

    const loadPODetail = async (po: any) => {
        setLoadingDetail(po.id)
        try {
            const detail = await fetchPurchaseOrder(po.id)
            setSelectedPO(detail)
            const lines = detail?.lines || detail?.order_lines || []
            // Pre-select lines that aren't already in the form
            setSelectedLines(new Set(
                lines
                    .filter((l: any) => !existingProductIds.includes(l.product?.id || l.product))
                    .map((l: any) => l.id)
            ))
        } catch (e) {
            console.error('Failed to load PO detail:', e)
        }
        setLoadingDetail(null)
    }

    const handleImport = () => {
        const lines = (selectedPO?.lines || selectedPO?.order_lines || [])
            .filter((l: any) => selectedLines.has(l.id))
        onImportLines(lines)
        onClose()
    }

    const poLines = selectedPO?.lines || selectedPO?.order_lines || []

    const fmt = (n: any) => {
        const v = Number(n || 0)
        return isNaN(v) ? '—' : v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
    }

    const statusColor = (s: string) => {
        const map: Record<string, string> = {
            DRAFT: 'text-app-muted-foreground', SUBMITTED: 'text-amber-500', APPROVED: 'text-blue-500',
            ORDERED: 'text-indigo-500', RECEIVED: 'text-emerald-500', COMPLETED: 'text-emerald-500',
        }
        return map[s] || 'text-app-muted-foreground'
    }

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-app-border/50"
                    style={{ borderLeft: '3px solid #3b82f6' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <FileDown size={16} className="text-blue-500" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-app-foreground">Import from Previous PO</h3>
                            <p className="text-[10px] text-app-muted-foreground">
                                {selectedPO ? `PO-${selectedPO.id} · ${poLines.length} lines` : 'Select a previous order to import'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-background/60 text-app-muted-foreground hover:text-app-foreground transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-app-primary mb-3" />
                            <p className="text-xs text-app-muted-foreground">Loading purchase orders...</p>
                        </div>
                    ) : !selectedPO ? (
                        /* PO List View */
                        orders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <ClipboardList size={24} className="text-app-muted-foreground/40 mb-3" />
                                <p className="font-bold text-sm text-app-foreground/60">No previous orders</p>
                                <p className="text-xs text-app-muted-foreground mt-1">No purchase orders found for this supplier</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-app-border/20">
                                {orders.map(po => (
                                    <button key={po.id} onClick={() => loadPODetail(po)}
                                        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-app-background/30 transition-all group"
                                        disabled={loadingDetail === po.id}>
                                        <div className="w-8 h-8 rounded-lg bg-app-background/60 flex items-center justify-center flex-shrink-0">
                                            {loadingDetail === po.id
                                                ? <Loader2 size={14} className="animate-spin text-blue-500" />
                                                : <ClipboardList size={14} className="text-app-muted-foreground" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-[12px] text-app-foreground">
                                                {po.po_number || `PO-${po.id}`}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[9px] font-black uppercase ${statusColor(po.status)}`}>{po.status}</span>
                                                <span className="text-[9px] text-app-muted-foreground">
                                                    {po.order_date || po.created_at?.split('T')[0] || ''}
                                                </span>
                                                <span className="text-[9px] text-app-muted-foreground">
                                                    {po.line_count || po.lines_count || '?'} items
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="font-black text-xs text-app-foreground">{fmt(po.total_amount)} CFA</div>
                                        </div>
                                        <ChevronRight size={14} className="text-app-muted-foreground/40 group-hover:text-app-foreground transition-all flex-shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )
                    ) : (
                        /* Line Selection View */
                        <div className="divide-y divide-app-border/20">
                            {/* Back button */}
                            <button onClick={() => { setSelectedPO(null); setSelectedLines(new Set()) }}
                                className="w-full flex items-center gap-2 px-5 py-2 text-[11px] font-bold text-app-primary hover:bg-app-primary/5 transition-all">
                                ← Back to order list
                            </button>
                            {/* Select All */}
                            <label className="flex items-center gap-3 px-5 py-2.5 bg-app-background/30 cursor-pointer hover:bg-app-background/50 transition-all">
                                <input type="checkbox"
                                    checked={selectedLines.size === poLines.length}
                                    onChange={() => setSelectedLines(prev => prev.size === poLines.length ? new Set() : new Set(poLines.map((l: any) => l.id)))}
                                    className="w-4 h-4 accent-[var(--app-primary)] cursor-pointer rounded" />
                                <span className="text-[11px] font-bold text-app-muted-foreground">
                                    Select All ({poLines.length} lines)
                                </span>
                            </label>
                            {poLines.map((line: any) => {
                                const alreadyExists = existingProductIds.includes(line.product?.id || line.product)
                                return (
                                    <label key={line.id} className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-app-background/30 transition-all ${alreadyExists ? 'opacity-50' : ''}`}>
                                        <input type="checkbox" checked={selectedLines.has(line.id)}
                                            onChange={() => { const next = new Set(selectedLines); next.has(line.id) ? next.delete(line.id) : next.add(line.id); setSelectedLines(next) }}
                                            className="w-4 h-4 accent-[var(--app-primary)] cursor-pointer rounded flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-[12px] text-app-foreground truncate">
                                                {line.product_name || line.product?.name || `Product #${line.product?.id || line.product}`}
                                            </div>
                                            {alreadyExists && (
                                                <span className="text-[8px] font-bold text-amber-500">Already in order</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-right flex-shrink-0">
                                            <div>
                                                <div className="font-black text-xs text-app-foreground">{Number(line.quantity || 0)}</div>
                                                <div className="text-[8px] text-app-muted-foreground">qty</div>
                                            </div>
                                            <div>
                                                <div className="font-bold text-xs text-app-foreground">{fmt(line.unit_price)} CFA</div>
                                                <div className="text-[8px] text-app-muted-foreground">unit</div>
                                            </div>
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer — only when lines are shown */}
                {selectedPO && poLines.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-app-border/50 bg-app-background/20">
                        <span className="text-[11px] font-bold text-app-muted-foreground">
                            {selectedLines.size} of {poLines.length} lines selected
                        </span>
                        <div className="flex items-center gap-2">
                            <button onClick={onClose}
                                className="px-3 py-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border rounded-lg transition-all">
                                Cancel
                            </button>
                            <button onClick={handleImport} disabled={selectedLines.size === 0}
                                className="px-4 py-1.5 text-[11px] font-black bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all disabled:opacity-40 flex items-center gap-1.5"
                                style={{ boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)' }}>
                                <FileDown size={12} />
                                Import {selectedLines.size} Lines
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
