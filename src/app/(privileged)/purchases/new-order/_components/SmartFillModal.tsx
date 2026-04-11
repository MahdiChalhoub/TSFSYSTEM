// @ts-nocheck
'use client'

/**
 * SmartFillModal — Auto-suggest products that need restocking
 * ============================================================
 * Fetches products from the supplier that are below reorder point
 * or have low stock relative to velocity, and lets user review & confirm.
 */

import { useState, useEffect } from 'react'
import { Loader2, Zap, Check, X, Package, TrendingDown, AlertTriangle } from 'lucide-react'
import { searchProductsSimple } from '@/app/actions/inventory/product-actions'

interface SmartFillProps {
    supplierId: number
    siteId: number
    warehouseId: number
    stockScope: string
    existingProductIds: number[]
    onAddProducts: (products: any[]) => void
    onClose: () => void
}

export function SmartFillModal({ supplierId, siteId, warehouseId, stockScope, existingProductIds, onAddProducts, onClose }: SmartFillProps) {
    const [loading, setLoading] = useState(true)
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [selected, setSelected] = useState<Set<number>>(new Set())

    useEffect(() => {
        (async () => {
            setLoading(true)
            try {
                // Use server action instead of direct erpFetch (which is server-only)
                const data = await searchProductsSimple('*', siteId, supplierId, warehouseId, stockScope, 'smart_fill')
                const items = Array.isArray(data) ? data : (data?.results ?? data ?? [])
                
                // Filter out already-added products and sort by urgency
                const filtered = items
                    .filter((p: any) => !existingProductIds.includes(p.id))
                    .sort((a: any, b: any) => {
                        // Sort by urgency: out of stock first, then by stock/reorder ratio
                        const aStock = Number(a.stock_on_location ?? a.stock ?? 0)
                        const bStock = Number(b.stock_on_location ?? b.stock ?? 0)
                        if (aStock <= 0 && bStock > 0) return -1
                        if (bStock <= 0 && aStock > 0) return 1
                        return aStock - bStock
                    })

                setSuggestions(filtered)
                // Pre-select all
                setSelected(new Set(filtered.map((p: any) => p.id)))
            } catch (e) {
                console.error('SmartFill error:', e)
                setSuggestions([])
            }
            setLoading(false)
        })()
    }, [supplierId, siteId, warehouseId, stockScope, existingProductIds])

    const toggleItem = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const handleConfirm = () => {
        const toAdd = suggestions.filter(p => selected.has(p.id))
        onAddProducts(toAdd)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-app-border/50"
                    style={{ borderLeft: '3px solid #8b5cf6' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <Zap size={16} className="text-violet-500" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-app-foreground">Smart Fill</h3>
                            <p className="text-[10px] text-app-muted-foreground">Products needing restocking from this supplier</p>
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
                            <p className="text-xs text-app-muted-foreground">Analyzing stock levels...</p>
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Check size={24} className="text-emerald-500 mb-3" />
                            <p className="font-bold text-sm text-app-foreground">All stocked up!</p>
                            <p className="text-xs text-app-muted-foreground mt-1">No products from this supplier need restocking</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-app-border/20">
                            {/* Select All */}
                            <label className="flex items-center gap-3 px-5 py-2.5 bg-app-background/30 cursor-pointer hover:bg-app-background/50 transition-all">
                                <input type="checkbox"
                                    checked={selected.size === suggestions.length}
                                    onChange={() => setSelected(prev => prev.size === suggestions.length ? new Set() : new Set(suggestions.map(p => p.id)))}
                                    className="w-4 h-4 accent-[var(--app-primary)] cursor-pointer rounded" />
                                <span className="text-[11px] font-bold text-app-muted-foreground">
                                    Select All ({suggestions.length} products)
                                </span>
                            </label>
                            {suggestions.map(p => {
                                const stock = Number(p.stock_on_location ?? p.stock ?? 0)
                                const reorder = Number(p.reorder_point ?? p.min_stock_level ?? 0)
                                const isOut = stock <= 0
                                const isLow = stock > 0 && stock < reorder
                                return (
                                    <label key={p.id} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-app-background/30 transition-all">
                                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleItem(p.id)}
                                            className="w-4 h-4 accent-[var(--app-primary)] cursor-pointer rounded flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-[12px] text-app-foreground truncate">{p.name}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[9px] text-app-muted-foreground font-mono">{p.barcode || p.sku || ''}</span>
                                                {p.category_name && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-app-primary/10 text-app-primary">{p.category_name}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className="text-right">
                                                <div className={`font-black text-xs ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-app-foreground'}`}>
                                                    {stock}
                                                </div>
                                                <div className="text-[8px] text-app-muted-foreground">stock</div>
                                            </div>
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                                                isOut ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' :
                                                isLow ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' :
                                                'bg-violet-100 text-violet-600 dark:bg-violet-900/30'
                                            }`}>
                                                {isOut ? '✕ OUT' : isLow ? '⚠ LOW' : '↓ BELOW'}
                                            </span>
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {suggestions.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-app-border/50 bg-app-background/20">
                        <span className="text-[11px] font-bold text-app-muted-foreground">
                            {selected.size} of {suggestions.length} selected
                        </span>
                        <div className="flex items-center gap-2">
                            <button onClick={onClose}
                                className="px-3 py-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border rounded-lg transition-all">
                                Cancel
                            </button>
                            <button onClick={handleConfirm} disabled={selected.size === 0}
                                className="px-4 py-1.5 text-[11px] font-black bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-all disabled:opacity-40 flex items-center gap-1.5"
                                style={{ boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)' }}>
                                <Zap size={12} />
                                Add {selected.size} Products
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
