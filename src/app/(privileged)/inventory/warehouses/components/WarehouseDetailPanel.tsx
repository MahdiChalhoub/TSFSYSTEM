// @ts-nocheck
'use client'

import { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import {
    X, Pencil, Trash2, Bookmark, Building2, Store, Warehouse as WarehouseIcon, Cloud,
    Layers, Package, PackagePlus, Search, Loader2, Plus, Minus, MapPin,
    ArrowRightLeft, Box,
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

/* ═══════════════════════════════════════════════════════════
 *  WAREHOUSE DETAIL PANEL
 *  Slots into TreeMasterPage's detailPanel prop — renders in the
 *  split pane / pinned sidebar / modal drawer automatically.
 *  Two tabs:
 *    Overview — location metadata
 *    Inventory — virtualized product list + Add-Product picker
 * ═══════════════════════════════════════════════════════════ */

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
    BRANCH:    { icon: Building2,     label: 'Branch',    color: 'var(--app-success)' },
    STORE:     { icon: Store,         label: 'Store',     color: 'var(--app-info)' },
    WAREHOUSE: { icon: WarehouseIcon, label: 'Warehouse', color: 'var(--app-warning)' },
    VIRTUAL:   { icon: Cloud,         label: 'Virtual',   color: 'var(--app-primary)' },
}

/* Lightweight windowing — only renders visible rows. Same shape we
 * use elsewhere so the list stays snappy regardless of item count. */
function useWindowedList<T>(items: T[], rowHeight: number, overscan = 8) {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [metrics, setMetrics] = useState({ top: 0, height: 0 })
    useLayoutEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const update = () => setMetrics({ top: el.scrollTop, height: el.clientHeight })
        update()
        el.addEventListener('scroll', update, { passive: true })
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
        ro?.observe(el)
        return () => { el.removeEventListener('scroll', update); ro?.disconnect() }
    }, [])
    const viewport = metrics.height || 600
    const start = Math.max(0, Math.floor(metrics.top / rowHeight) - overscan)
    const visible = Math.ceil(viewport / rowHeight) + overscan * 2
    const end = Math.min(items.length, start + visible)
    return {
        scrollRef,
        visibleItems: items.slice(start, end),
        startIndex: start,
        offsetY: start * rowHeight,
        totalHeight: items.length * rowHeight,
    }
}

type Tab = 'overview' | 'inventory'

export function WarehouseDetailPanel({
    node, initialTab, onClose, onPin, onEdit, onDelete, allLocations,
}: any) {
    const [tab, setTab] = useState<Tab>((initialTab as Tab) ?? 'overview')
    useEffect(() => { setTab((initialTab as Tab) ?? 'overview') }, [node.id, initialTab])

    const cfg = TYPE_CONFIG[node.location_type] || TYPE_CONFIG.WAREHOUSE
    const Icon = cfg.icon

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--app-surface)' }}>
            {/* ── Header ── */}
            <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3"
                style={{
                    borderBottom: '1px solid var(--app-border)',
                    background: `color-mix(in srgb, ${cfg.color} 4%, var(--app-surface))`,
                }}>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: cfg.color, boxShadow: `0 2px 8px color-mix(in srgb, ${cfg.color} 25%, transparent)` }}>
                        <Icon size={13} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-tp-md font-bold text-app-foreground truncate">{node.name}</h3>
                        <p className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wider">
                            {cfg.label}{node.code ? ` · ${node.code}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onEdit(node)} title="Edit"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <Pencil size={12} />
                    </button>
                    <button onClick={() => onDelete(node)} title="Delete"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                        style={{ color: 'var(--app-error)' }}>
                        <Trash2 size={12} />
                    </button>
                    {onPin && (
                        <button onClick={() => onPin(node)} title="Pin to sidebar"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-primary hover:bg-app-border/50 transition-all">
                            <Bookmark size={12} />
                        </button>
                    )}
                    <button onClick={onClose} title="Close"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                {[
                    { key: 'overview' as Tab, label: 'Overview', icon: <Layers size={11} /> },
                    { key: 'inventory' as Tab, label: 'Inventory', icon: <Package size={11} /> },
                ].map(t => {
                    const active = tab === t.key
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-tp-xxs font-bold uppercase tracking-wider transition-all"
                            style={active ? {
                                background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
                                color: cfg.color,
                                border: `1px solid color-mix(in srgb, ${cfg.color} 30%, transparent)`,
                            } : {
                                background: 'transparent',
                                color: 'var(--app-muted-foreground)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}>
                            {t.icon}{t.label}
                        </button>
                    )
                })}
            </div>

            {/* ── Body ── */}
            {tab === 'overview' ? (
                <OverviewTab node={node} />
            ) : (
                <InventoryTab node={node} allLocations={allLocations} />
            )}
        </div>
    )
}

/* ─── Overview tab ─── */
function OverviewTab({ node }: any) {
    const rows = [
        ['Type', TYPE_CONFIG[node.location_type]?.label || node.location_type],
        ['Code', node.code],
        ['Reference', node.reference_code],
        ['City', node.city],
        ['Country', node.country_name],
        ['Address', node.address],
        ['Phone', node.phone],
        ['POS Enabled', node.can_sell ? 'Yes' : 'No'],
        ['Active', node.is_active === false ? 'No' : 'Yes'],
    ].filter(([, v]) => v != null && v !== '')
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {rows.map(([k, v]) => (
                <div key={k as string} className="flex items-start gap-3 px-3 py-2 rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                    <span className="text-tp-xxs font-bold uppercase tracking-wide w-24 flex-shrink-0 pt-0.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>{k}</span>
                    <span className="text-tp-sm font-bold text-app-foreground flex-1">{v as any}</span>
                </div>
            ))}
            {rows.length === 0 && (
                <p className="text-tp-sm text-app-muted-foreground text-center py-8">No metadata.</p>
            )}
        </div>
    )
}

/* ─── Inventory tab — list + add-product picker ─── */
type FilterMode = 'IN_LOCATION' | 'NOT_IN_OTHER' | 'IN_ALL'

function InventoryTab({ node, allLocations }: any) {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterMode, setFilterMode] = useState<FilterMode>('IN_LOCATION')
    const [compareLocationId, setCompareLocationId] = useState<number | null>(null)
    const [compareItems, setCompareItems] = useState<any[]>([])
    const [loadingCompare, setLoadingCompare] = useState(false)

    const [showPicker, setShowPicker] = useState(false)
    const [pickerSearch, setPickerSearch] = useState('')
    const [allProducts, setAllProducts] = useState<any[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [addingProductId, setAddingProductId] = useState<number | null>(null)
    const [removingId, setRemovingId] = useState<number | null>(null)

    /* Load inventory for this location */
    const loadInventory = useCallback(async () => {
        setLoading(true)
        try {
            const res = await erpFetch(`inventory/?warehouse=${node.id}&page_size=50`)
            setItems(Array.isArray(res) ? res : (res?.results ?? []))
        } catch { setItems([]) }
        setLoading(false)
    }, [node.id])

    useEffect(() => { loadInventory() }, [loadInventory])

    /* Compare-location fetch */
    useEffect(() => {
        if (filterMode === 'NOT_IN_OTHER' && compareLocationId) {
            setLoadingCompare(true)
            erpFetch(`inventory/?warehouse=${compareLocationId}&page_size=500`)
                .then(res => setCompareItems(Array.isArray(res) ? res : (res?.results ?? [])))
                .catch(() => setCompareItems([]))
                .finally(() => setLoadingCompare(false))
        } else {
            setCompareItems([])
        }
    }, [filterMode, compareLocationId])

    const currentIds = useMemo(
        () => new Set(items.map((i: any) => i.product ?? i.product_id)),
        [items]
    )

    const filteredItems = useMemo(() => {
        let list = items
        if (filterMode === 'NOT_IN_OTHER' && compareLocationId) {
            const cmp = new Set(compareItems.map((i: any) => i.product ?? i.product_id))
            list = list.filter((i: any) => !cmp.has(i.product ?? i.product_id))
        }
        if (!searchQuery.trim()) return list
        const q = searchQuery.toLowerCase()
        return list.filter((i: any) =>
            (i.product_name || '').toLowerCase().includes(q) ||
            (i.sku || '').toLowerCase().includes(q) ||
            String(i.product ?? i.product_id).includes(q)
        )
    }, [items, searchQuery, filterMode, compareLocationId, compareItems])

    /* Add-product picker */
    const openPicker = async () => {
        setShowPicker(true)
        if (allProducts.length > 0) return
        setLoadingProducts(true)
        try {
            // `lite=1` drops nested serializers + on_hand_qty etc. —
            // ~1 query instead of ~1200 for a 200-row list.
            const res = await erpFetch('products/?page_size=500&is_active=true&lite=1')
            setAllProducts(Array.isArray(res) ? res : (res?.results ?? []))
        } catch { setAllProducts([]) }
        setLoadingProducts(false)
    }

    const addProduct = async (productId: number) => {
        setAddingProductId(productId)
        try {
            await erpFetch('inventory/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product: productId, warehouse: node.id, quantity: 0 }),
            })
            toast.success('Product added')
            setShowPicker(false)
            loadInventory()
        } catch (err: any) { toast.error(err?.message || 'Failed to add product') }
        setAddingProductId(null)
    }

    const removeProduct = async (inventoryId: number) => {
        setRemovingId(inventoryId)
        try {
            await erpFetch(`inventory/${inventoryId}/`, { method: 'DELETE' })
            toast.success('Removed')
            loadInventory()
        } catch (err: any) { toast.error(err?.message || 'Failed to remove') }
        setRemovingId(null)
    }

    const otherLocations = useMemo(
        () => (allLocations || []).filter((l: any) => l.id !== node.id),
        [allLocations, node.id]
    )

    const addableProducts = useMemo(() => {
        const list = allProducts.filter((p: any) => !currentIds.has(p.id))
        if (!pickerSearch.trim()) return list
        const q = pickerSearch.toLowerCase()
        return list.filter((p: any) =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q) ||
            (p.barcode || '').toLowerCase().includes(q)
        )
    }, [allProducts, currentIds, pickerSearch])

    const ROW = 48
    const invVirt = useWindowedList(filteredItems, ROW)
    const pickVirt = useWindowedList(addableProducts, ROW)

    return (
        <div className="flex-1 min-h-0 flex flex-col relative">
            {/* Search + filter + add */}
            <div className="flex-shrink-0 px-3 py-2 space-y-2"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                <div className="flex items-center gap-1.5">
                    <div className="flex-1 relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input type="text" value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search products..."
                            className="w-full pl-8 pr-3 py-1.5 text-tp-sm rounded-lg outline-none"
                            style={{
                                background: 'color-mix(in srgb, var(--app-bg) 50%, var(--app-surface))',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                color: 'var(--app-foreground)',
                            }} />
                    </div>
                    <button onClick={openPicker}
                        className="flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wide px-2 py-1.5 rounded-lg transition-all"
                        style={{ color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}>
                        <PackagePlus size={11} />Add
                    </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                        { key: 'IN_LOCATION' as FilterMode, label: 'This', icon: <MapPin size={10} /> },
                        { key: 'NOT_IN_OTHER' as FilterMode, label: 'Not in…', icon: <ArrowRightLeft size={10} /> },
                        { key: 'IN_ALL' as FilterMode, label: 'All', icon: <Layers size={10} /> },
                    ].map(f => {
                        const active = filterMode === f.key
                        return (
                            <button key={f.key} onClick={() => setFilterMode(f.key)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-tp-xxs font-bold uppercase tracking-wider transition-all"
                                style={{
                                    background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                    color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                    border: active ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)' : '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                }}>
                                {f.icon}{f.label}
                            </button>
                        )
                    })}
                </div>
                {filterMode === 'NOT_IN_OTHER' && (
                    <select value={compareLocationId || ''}
                        onChange={e => setCompareLocationId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full text-tp-sm px-2.5 py-1.5 rounded-lg outline-none"
                        style={{
                            background: 'color-mix(in srgb, var(--app-bg) 50%, var(--app-surface))',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            color: 'var(--app-foreground)',
                        }}>
                        <option value="">Select location to compare...</option>
                        {otherLocations.map((loc: any) => (
                            <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Inventory list (virtualized) */}
            <div ref={invVirt.scrollRef} className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                {(loading || loadingCompare) ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 size={20} className="animate-spin text-app-primary mb-2" />
                        <p className="text-tp-xs font-bold text-app-muted-foreground">Loading…</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Package size={20} style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} className="mb-2" />
                        <p className="text-tp-sm font-bold text-app-muted-foreground">
                            {searchQuery ? 'No matches' : 'No inventory'}
                        </p>
                    </div>
                ) : (
                    <div style={{ height: invVirt.totalHeight, position: 'relative' }}>
                        <div style={{ transform: `translateY(${invVirt.offsetY}px)` }}>
                            {invVirt.visibleItems.map((item: any, i: number) => {
                                const idx = invVirt.startIndex + i
                                return (
                                    <div key={item.id || idx}
                                        className="group flex items-center gap-2 px-3 hover:bg-app-surface/60 transition-colors"
                                        style={{
                                            height: ROW,
                                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                                        }}>
                                        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                            <Package size={11} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-tp-sm font-bold text-app-foreground truncate">
                                                {item.product_name || `Product #${item.product ?? item.product_id}`}
                                            </p>
                                            <p className="text-tp-xxs font-mono text-app-muted-foreground truncate">
                                                {item.sku || ''}{item.batch_number && ` · Batch: ${item.batch_number}`}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0 mr-1">
                                            <p className="text-tp-md font-bold text-app-foreground tabular-nums">
                                                {typeof item.quantity === 'number' ? Number(item.quantity).toLocaleString() : 0}
                                            </p>
                                        </div>
                                        <button onClick={() => removeProduct(item.id)}
                                            disabled={removingId === item.id}
                                            className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                            style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)' }}>
                                            {removingId === item.id ? <Loader2 size={10} className="animate-spin" /> : <Minus size={10} />}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between text-tp-xxs font-bold text-app-muted-foreground"
                style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)' }}>
                <span>{filteredItems.length} product{filteredItems.length !== 1 ? 's' : ''}</span>
                <span className="tabular-nums">
                    Total qty: {filteredItems.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0).toLocaleString()}
                </span>
            </div>

            {/* ── Add Product Picker Overlay ── */}
            {showPicker && (
                <div className="absolute inset-0 flex flex-col z-20"
                    style={{ background: 'var(--app-surface)' }}>
                    <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2"
                        style={{
                            borderBottom: '1px solid var(--app-border)',
                            background: 'color-mix(in srgb, var(--app-success) 4%, var(--app-surface))',
                        }}>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center"
                                style={{ background: 'var(--app-success)' }}>
                                <PackagePlus size={11} className="text-white" />
                            </div>
                            <span className="text-tp-sm font-bold text-app-foreground">Add product</span>
                        </div>
                        <button onClick={() => setShowPicker(false)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                            <X size={12} />
                        </button>
                    </div>
                    <div className="flex-shrink-0 px-3 py-2"
                        style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input type="text" value={pickerSearch} autoFocus
                                onChange={e => setPickerSearch(e.target.value)}
                                placeholder="Search by name, SKU, barcode..."
                                className="w-full pl-8 pr-3 py-1.5 text-tp-sm rounded-lg outline-none"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-bg) 50%, var(--app-surface))',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    color: 'var(--app-foreground)',
                                }} />
                        </div>
                    </div>
                    <div ref={pickVirt.scrollRef} className="flex-1 overflow-y-auto min-h-0">
                        {loadingProducts ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 size={20} className="animate-spin text-app-success mb-2" />
                                <p className="text-tp-xs font-bold text-app-muted-foreground">Loading…</p>
                            </div>
                        ) : addableProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                <Box size={20} style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} className="mb-2" />
                                <p className="text-tp-sm font-bold text-app-muted-foreground">
                                    {pickerSearch ? 'No matches' : 'All products already assigned'}
                                </p>
                            </div>
                        ) : (
                            <div style={{ height: pickVirt.totalHeight, position: 'relative' }}>
                                <div style={{ transform: `translateY(${pickVirt.offsetY}px)` }}>
                                    {pickVirt.visibleItems.map((p: any) => (
                                        <button key={p.id} onClick={() => addProduct(p.id)}
                                            disabled={addingProductId === p.id}
                                            className="w-full flex items-center gap-2 px-3 text-left hover:bg-app-surface/60 transition-colors disabled:opacity-50"
                                            style={{
                                                height: ROW,
                                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 20%, transparent)',
                                            }}>
                                            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>
                                                {addingProductId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-tp-sm font-bold text-app-foreground truncate">{p.name}</p>
                                                <p className="text-tp-xxs font-mono text-app-muted-foreground truncate">
                                                    {p.sku || p.barcode || ''}
                                                    {p.category_name && ` · ${p.category_name}`}
                                                </p>
                                            </div>
                                            <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                                                style={{ background: 'color-mix(in srgb, var(--app-success) 8%, transparent)', color: 'var(--app-success)' }}>
                                                Add
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
