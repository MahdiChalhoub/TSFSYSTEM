// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import { deleteWarehouse } from '@/app/actions/inventory/warehouses'
import { erpFetch } from '@/lib/erp-api'
import WarehouseModal from './form'
import {
    Building2, Store, Warehouse, Cloud, MapPin, Layers, BarChart3,
    Plus, Trash2, Edit3, Phone, ChevronDown, ChevronRight,
    Package, GitBranch, Search, X, Globe, Maximize2, Minimize2,
    ChevronsUpDown, ChevronsDownUp, Settings, Loader2, Box,
    Filter, ArrowRightLeft, Minus, PackagePlus, PackageMinus
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/* ═══════════════════════════════════════════════════════════
 *  TYPE CONFIG
 * ═══════════════════════════════════════════════════════════ */

const TYPE_CONFIG: Record<string, {
    icon: any; label: string; color: string;
}> = {
    BRANCH:    { icon: Building2,  label: 'Branch',    color: 'var(--app-success)' },
    STORE:     { icon: Store,      label: 'Store',     color: 'var(--app-info)' },
    WAREHOUSE: { icon: Warehouse,  label: 'Warehouse', color: 'var(--app-warning)' },
    VIRTUAL:   { icon: Cloud,      label: 'Virtual',   color: 'var(--app-primary)' },
}

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */

interface WarehouseNode {
    id: number; name: string; code: string; location_type: string;
    parent: number | null; parent_name?: string;
    can_sell: boolean; is_active: boolean;
    city?: string; phone?: string; address?: string;
    country?: number | null; country_name?: string; country_iso2?: string;
    inventory_count?: number; children?: WarehouseNode[];
}

/* ═══════════════════════════════════════════════════════════
 *  TREE BUILDER
 * ═══════════════════════════════════════════════════════════ */

function buildTree(flat: WarehouseNode[]): { branches: WarehouseNode[]; orphans: WarehouseNode[] } {
    const map = new Map<number, WarehouseNode>()
    flat.forEach(w => map.set(w.id, { ...w, children: [] }))
    const branches: WarehouseNode[] = []
    const orphans: WarehouseNode[] = []
    flat.forEach(w => {
        const node = map.get(w.id)!
        if (w.parent && map.has(w.parent)) {
            map.get(w.parent)!.children!.push(node)
        } else if (w.location_type === 'BRANCH') {
            branches.push(node)
        } else {
            orphans.push(node)
        }
    })
    return { branches, orphans }
}

/* ═══════════════════════════════════════════════════════════
 *  CHILD ROW (leaf node — indented under branch)
 * ═══════════════════════════════════════════════════════════ */

function ChildRow({ node, onEdit, onDelete, onSkuClick }: {
    node: WarehouseNode; onEdit: (w: WarehouseNode) => void; onDelete: (w: WarehouseNode) => void; onSkuClick?: (w: WarehouseNode) => void;
}) {
    const cfg = TYPE_CONFIG[node.location_type] || TYPE_CONFIG.WAREHOUSE
    const Icon = cfg.icon

    return (
        <div
            className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2"
            style={{
                paddingLeft: '44px',
                paddingRight: '12px',
                borderLeft: `1px solid color-mix(in srgb, var(--app-border) 40%, transparent)`,
                marginLeft: '22px',
            }}
            onClick={() => onEdit(node)}
        >
            {/* Dot */}
            <div className="w-5 flex-shrink-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
            </div>

            {/* Icon */}
            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`,
                    color: cfg.color,
                }}
            >
                <Icon size={13} />
            </div>

            {/* Name + Badges */}
            <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                <span className="text-tp-lg font-medium text-app-foreground truncate">{node.name}</span>
                {node.code && (
                    <span
                        className="hidden md:inline font-mono text-tp-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-background) 60%, transparent)',
                            color: 'var(--app-foreground)',
                        }}
                    >
                        {node.code}
                    </span>
                )}
                {node.can_sell && (
                    <span
                        className="hidden sm:inline text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                            color: 'var(--app-success)',
                            border: '1px solid color-mix(in srgb, var(--app-success) 20%, transparent)',
                        }}
                    >POS</span>
                )}
                {!node.is_active && (
                    <span
                        className="text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                            color: 'var(--app-error)',
                        }}
                    >Inactive</span>
                )}
            </div>

            {/* Code Column */}
            <div className="hidden sm:flex w-16 flex-shrink-0">
                <span
                    className="text-tp-xs font-bold px-1.5 py-0.5 rounded"
                    style={{
                        color: cfg.color,
                        background: `color-mix(in srgb, ${cfg.color} 8%, transparent)`,
                    }}
                >{node.code || `—`}</span>
            </div>

            {/* Type Column */}
            <div className="hidden sm:block w-20 flex-shrink-0 text-tp-sm font-bold text-app-muted-foreground">
                {cfg.label}
            </div>

            {/* City Column */}
            <div className="hidden md:flex w-24 flex-shrink-0 items-center gap-1 text-tp-xs text-app-muted-foreground font-bold truncate">
                {node.city && <><MapPin size={9} />{node.city}</>}
            </div>

            {/* Country Column */}
            <div className="hidden lg:flex w-16 flex-shrink-0 items-center">
                {node.country_name ? (
                    <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                        style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 8%, transparent)' }}>
                        {node.country_iso2 || node.country_name}
                    </span>
                ) : (
                    <span className="text-tp-xxs font-bold" style={{ color: 'var(--app-warning)' }}>—</span>
                )}
            </div>

            {/* SKUs Column */}
            <div className="hidden sm:block w-16 text-right flex-shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); onSkuClick?.(node) }}
                    className="inline-flex items-center gap-1 justify-end text-tp-md font-bold text-app-foreground tabular-nums hover:text-app-primary transition-colors cursor-pointer"
                    title="View inventory"
                >
                    <Settings size={10} className="text-app-muted-foreground" />
                    {node.inventory_count || 0}
                </button>
            </div>

            {/* Actions */}
            <div className="w-16 flex-shrink-0 flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onEdit(node) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors">
                    <Edit3 size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(node) }} className="p-1.5 hover:bg-app-error/10 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  BRANCH ROW (parent — expandable tree-style)
 * ═══════════════════════════════════════════════════════════ */

function BranchRow({ branch, onEdit, onDelete, onAddChild, isExpanded, onToggle, onSkuClick }: {
    branch: WarehouseNode; onEdit: (w: WarehouseNode) => void; onDelete: (w: WarehouseNode) => void;
    onAddChild: (parent: WarehouseNode) => void; isExpanded: boolean; onToggle: () => void; onSkuClick?: (w: WarehouseNode) => void;
}) {
    const children = branch.children || []
    const hasChildren = children.length > 0
    const totalSKUs = branch.inventory_count || 0

    return (
        <div>
            {/* ── BRANCH ROW ── */}
            <div
                className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface py-2.5 md:py-3"
                style={{
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    background: 'color-mix(in srgb, var(--app-success) 4%, var(--app-surface))',
                    borderLeft: '3px solid var(--app-success)',
                }}
                onClick={onToggle}
            >
                {/* Toggle */}
                <button
                    className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${hasChildren ? 'hover:bg-app-border/50 text-app-muted-foreground' : 'text-app-border'}`}
                >
                    {hasChildren ? (
                        isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-success)' }} />
                    )}
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-success) 12%, transparent)',
                        color: 'var(--app-success)',
                    }}
                >
                    <Building2 size={14} />
                </div>

                {/* Name + Badges */}
                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                    <span className="truncate text-tp-lg font-bold text-app-foreground">{branch.name}</span>
                    {branch.code && (
                        <span
                            className="hidden md:inline font-mono text-tp-sm font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-background) 60%, transparent)',
                                color: 'var(--app-foreground)',
                            }}
                        >
                            {branch.code}
                        </span>
                    )}
                    <span
                        className="hidden md:inline text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                            color: 'var(--app-success)',
                            border: '1px solid color-mix(in srgb, var(--app-success) 20%, transparent)',
                        }}
                    >BASE</span>
                </div>

                {/* Code Column */}
                <div className="hidden sm:flex w-16 flex-shrink-0">
                    <span
                        className="text-tp-xs font-bold px-1.5 py-0.5 rounded"
                        style={{
                            color: 'var(--app-success)',
                            background: 'color-mix(in srgb, var(--app-success) 8%, transparent)',
                        }}
                    >{branch.code || `BR`}</span>
                </div>

                {/* Type Column */}
                <div className="hidden sm:block w-20 flex-shrink-0 text-tp-sm font-bold text-app-muted-foreground">
                    Branch
                </div>

                {/* City Column */}
                <div className="hidden md:flex w-24 flex-shrink-0 items-center gap-1 text-tp-xs text-app-muted-foreground font-bold truncate">
                    {branch.city && <><MapPin size={9} />{branch.city}</>}
                </div>

                {/* Country Column */}
                <div className="hidden lg:flex w-16 flex-shrink-0 items-center">
                    {branch.country_name ? (
                        <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                            style={{ color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 8%, transparent)' }}>
                            {branch.country_iso2 || branch.country_name}
                        </span>
                    ) : (
                        <span className="text-tp-xxs font-bold flex items-center gap-0.5" style={{ color: 'var(--app-warning)' }}>
                            ⚠
                        </span>
                    )}
                </div>

                {/* Stats: Children + SKUs */}
                <div className="hidden sm:block w-16 text-right flex-shrink-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); onSkuClick?.(branch) }}
                        className="inline-flex items-center gap-1 justify-end text-tp-md font-bold text-app-foreground tabular-nums hover:text-app-primary transition-colors cursor-pointer"
                        title="View inventory"
                    >
                        <Settings size={10} className="text-app-muted-foreground" />
                        {totalSKUs}
                    </button>
                </div>

                {/* Actions */}
                <div className="w-16 flex-shrink-0 flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(branch) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors">
                        <Edit3 size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(branch) }} className="p-1.5 hover:bg-app-error/10 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* ── CHILDREN ROWS ── */}
            {isExpanded && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {children.map(c => (
                        <ChildRow key={c.id} node={c} onEdit={onEdit} onDelete={onDelete} onSkuClick={onSkuClick} />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  ORPHAN ROW (unassigned — root-level, no parent)
 * ═══════════════════════════════════════════════════════════ */

function OrphanRow({ node, onEdit, onDelete, onSkuClick }: {
    node: WarehouseNode; onEdit: (w: WarehouseNode) => void; onDelete: (w: WarehouseNode) => void; onSkuClick?: (w: WarehouseNode) => void;
}) {
    const cfg = TYPE_CONFIG[node.location_type] || TYPE_CONFIG.WAREHOUSE
    const Icon = cfg.icon

    return (
        <div
            className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2 md:py-2.5"
            style={{
                paddingLeft: '12px',
                paddingRight: '12px',
                borderLeft: '3px solid color-mix(in srgb, var(--app-warning) 50%, transparent)',
                background: 'color-mix(in srgb, var(--app-warning) 2%, var(--app-surface))',
            }}
            onClick={() => onEdit(node)}
        >
            {/* Dot */}
            <div className="w-5 flex-shrink-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-warning)' }} />
            </div>

            {/* Icon */}
            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`,
                    color: cfg.color,
                }}
            >
                <Icon size={13} />
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                <span className="text-tp-lg font-medium text-app-foreground truncate">{node.name}</span>
                {node.code && (
                    <span className="hidden md:inline font-mono text-tp-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', color: 'var(--app-foreground)' }}>
                        {node.code}
                    </span>
                )}
                <span className="text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)' }}>
                    Unassigned
                </span>
            </div>

            {/* Code */}
            <div className="hidden sm:flex w-16 flex-shrink-0">
                <span className="text-tp-xs font-bold px-1.5 py-0.5 rounded"
                    style={{ color: cfg.color, background: `color-mix(in srgb, ${cfg.color} 8%, transparent)` }}>
                    {node.code || '—'}
                </span>
            </div>

            {/* Type */}
            <div className="hidden sm:block w-20 flex-shrink-0 text-tp-sm font-bold text-app-muted-foreground">{cfg.label}</div>

            {/* City */}
            <div className="hidden md:flex w-24 flex-shrink-0 items-center gap-1 text-tp-xs text-app-muted-foreground font-bold truncate">
                {node.city && <><MapPin size={9} />{node.city}</>}
            </div>

            {/* Country */}
            <div className="hidden lg:flex w-16 flex-shrink-0 items-center">
                {node.country_name ? (
                    <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                        style={{ color: cfg.color, background: `color-mix(in srgb, ${cfg.color} 8%, transparent)` }}>
                        {node.country_iso2 || node.country_name}
                    </span>
                ) : (
                    <span className="text-tp-xxs font-bold" style={{ color: 'var(--app-warning)' }}>—</span>
                )}
            </div>

            {/* SKUs */}
            <div className="hidden sm:block w-16 text-right flex-shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); onSkuClick?.(node) }}
                    className="inline-flex items-center gap-1 justify-end text-tp-md font-bold text-app-foreground tabular-nums hover:text-app-primary transition-colors cursor-pointer"
                    title="View inventory"
                >
                    <Settings size={10} className="text-app-muted-foreground" />
                    {node.inventory_count || 0}
                </button>
            </div>

            {/* Actions */}
            <div className="w-16 flex-shrink-0 flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onEdit(node) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors">
                    <Edit3 size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(node) }} className="p-1.5 hover:bg-app-error/10 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  WINDOWED LIST — render only visible rows
 *
 *  Fixed-height rows + a scroll listener keep the DOM tiny no
 *  matter how many items are in the source array. We pick this
 *  over react-window so the page stays dependency-free.
 * ═══════════════════════════════════════════════════════════ */
function useWindowedList<T>(items: T[], rowHeight: number, overscan: number = 8) {
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
        return () => {
            el.removeEventListener('scroll', update)
            ro?.disconnect()
        }
    }, [])

    const viewport = metrics.height || 600  // before first measure, assume ~600px
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

/* ═══════════════════════════════════════════════════════════
 *  SKU SIDE PANEL — Enhanced with search, filters, add/remove
 * ═══════════════════════════════════════════════════════════ */

type SkuPanelState = { open: boolean; location: WarehouseNode | null; items: any[]; loading: boolean }
type FilterMode = 'IN_LOCATION' | 'NOT_IN_OTHER' | 'IN_ALL'

function SkuSidePanel({ skuPanel, setSkuPanel, allLocations, onRefresh }: {
    skuPanel: SkuPanelState;
    setSkuPanel: React.Dispatch<React.SetStateAction<SkuPanelState>>;
    allLocations: WarehouseNode[];
    onRefresh: () => void;
}) {
    const [searchQuery, setSearchQuery] = useState('')
    const [filterMode, setFilterMode] = useState<FilterMode>('IN_LOCATION')
    const [compareLocationId, setCompareLocationId] = useState<number | null>(null)
    const [showAddPicker, setShowAddPicker] = useState(false)
    const [pickerSearch, setPickerSearch] = useState('')
    const [allProducts, setAllProducts] = useState<any[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [removingId, setRemovingId] = useState<number | null>(null)
    const [addingProductId, setAddingProductId] = useState<number | null>(null)
    const [compareItems, setCompareItems] = useState<any[]>([])
    const [loadingCompare, setLoadingCompare] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)

    // Product IDs in the current location (for cross-reference)
    const currentProductIds = useMemo(
        () => new Set(skuPanel.items.map((i: any) => i.product ?? i.product_id)),
        [skuPanel.items]
    )

    // Filtered items based on search
    const filteredItems = useMemo(() => {
        let items = skuPanel.items
        if (filterMode === 'NOT_IN_OTHER' && compareLocationId) {
            const compareProductIds = new Set(compareItems.map((i: any) => i.product ?? i.product_id))
            items = items.filter((item: any) => {
                const pid = item.product ?? item.product_id
                return !compareProductIds.has(pid)
            })
        }
        if (!searchQuery.trim()) return items
        const q = searchQuery.toLowerCase()
        return items.filter((item: any) =>
            (item.product_name || '').toLowerCase().includes(q) ||
            (item.sku || '').toLowerCase().includes(q) ||
            String(item.product ?? item.product_id).includes(q)
        )
    }, [skuPanel.items, searchQuery, filterMode, compareLocationId, compareItems])

    // Fetch compare location inventory when filter changes
    useEffect(() => {
        if (filterMode === 'NOT_IN_OTHER' && compareLocationId) {
            setLoadingCompare(true)
            erpFetch(`inventory/?warehouse=${compareLocationId}&page_size=200`)
                .then(res => {
                    const items = Array.isArray(res) ? res : (res?.results ?? [])
                    setCompareItems(items)
                })
                .catch(() => setCompareItems([]))
                .finally(() => setLoadingCompare(false))
        } else {
            setCompareItems([])
        }
    }, [filterMode, compareLocationId])

    // Fetch all products for the Add picker. `lite=1` drops the
    // variants/packaging/on_hand_qty fields — without it each row
    // triggers ~6 extra DB queries, so a 200-row picker can take
    // seconds. Lite gives us { id, name, sku, barcode, category_name }.
    const openProductPicker = async () => {
        setShowAddPicker(true)
        if (allProducts.length > 0) return // cached
        setLoadingProducts(true)
        try {
            const res = await erpFetch('products/?page_size=500&is_active=true&lite=1')
            const list = Array.isArray(res) ? res : (res?.results ?? [])
            setAllProducts(list)
        } catch { setAllProducts([]) }
        setLoadingProducts(false)
    }

    // Add product to this location
    const handleAddProduct = async (productId: number) => {
        if (!skuPanel.location) return
        setAddingProductId(productId)
        try {
            await erpFetch('inventory/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product: productId,
                    warehouse: skuPanel.location.id,
                    quantity: 0,
                })
            })
            toast.success('Product added to location')
            setShowAddPicker(false)
            onRefresh()
        } catch (err: any) {
            toast.error(err?.message || 'Failed to add product')
        }
        setAddingProductId(null)
    }

    // Remove product from location
    const handleRemove = async (inventoryId: number) => {
        setRemovingId(inventoryId)
        try {
            await erpFetch(`inventory/${inventoryId}/`, { method: 'DELETE' })
            toast.success('Product removed from location')
            onRefresh()
        } catch (err: any) {
            toast.error(err?.message || 'Failed to remove')
        }
        setRemovingId(null)
    }

    // Other locations (for the compare dropdown)
    const otherLocations = allLocations.filter(l => l.id !== skuPanel.location?.id)

    // Products available to add (not already in this location).
    // No artificial cap — virtualization renders only visible rows,
    // so 500+ candidates stay responsive.
    const addableProducts = useMemo(() => {
        const list = allProducts.filter(p => !currentProductIds.has(p.id))
        if (!pickerSearch.trim()) return list
        const q = pickerSearch.toLowerCase()
        return list.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q) ||
            (p.barcode || '').toLowerCase().includes(q)
        )
    }, [allProducts, currentProductIds, pickerSearch])

    // Virtualized rows for the two long lists inside this panel.
    const INVENTORY_ROW_HEIGHT = 48
    const PICKER_ROW_HEIGHT = 48
    const inventoryVirt = useWindowedList(filteredItems, INVENTORY_ROW_HEIGHT)
    const pickerVirt = useWindowedList(addableProducts, PICKER_ROW_HEIGHT)

    return (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setSkuPanel(p => ({ ...p, open: false }))}>
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />
            <div
                className="relative w-full max-w-md h-full flex flex-col animate-in slide-in-from-right duration-200"
                style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)', boxShadow: '-8px 0 30px rgba(0,0,0,0.15)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))' }}>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <Box size={13} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-tp-md font-bold text-app-foreground truncate">{skuPanel.location?.name}</h3>
                            <p className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wider">
                                {filteredItems.length} of {skuPanel.items.length} products
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={openProductPicker}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                            style={{ color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}
                            title="Add product to location"
                        >
                            <PackagePlus size={13} />
                        </button>
                        <button
                            onClick={() => setSkuPanel(p => ({ ...p, open: false }))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* ── Search + Filter Bar ── */}
                <div className="flex-shrink-0 px-3 py-2 space-y-2" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    {/* Search */}
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search products..."
                            className="w-full pl-8 pr-7 py-1.5 text-tp-sm rounded-lg outline-none transition-all"
                            style={{
                                background: 'color-mix(in srgb, var(--app-bg) 50%, var(--app-surface))',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                color: 'var(--app-foreground)',
                            }}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-foreground">
                                <X size={11} />
                            </button>
                        )}
                    </div>

                    {/* Filter Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                            { key: 'IN_LOCATION' as FilterMode, label: 'This Location', icon: <MapPin size={10} /> },
                            { key: 'NOT_IN_OTHER' as FilterMode, label: 'Not In...', icon: <ArrowRightLeft size={10} /> },
                            { key: 'IN_ALL' as FilterMode, label: 'All Locations', icon: <Layers size={10} /> },
                        ].map(f => {
                            const active = filterMode === f.key
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setFilterMode(f.key)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-tp-xxs font-bold uppercase tracking-wider transition-all"
                                    style={{
                                        background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                        color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                        border: active ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)' : '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                    }}
                                >
                                    {f.icon} {f.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* Compare location selector (when "Not In..." filter active) */}
                    {filterMode === 'NOT_IN_OTHER' && (
                        <select
                            value={compareLocationId || ''}
                            onChange={e => setCompareLocationId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full text-tp-sm px-2.5 py-1.5 rounded-lg outline-none"
                            style={{
                                background: 'color-mix(in srgb, var(--app-bg) 50%, var(--app-surface))',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                color: 'var(--app-foreground)',
                            }}
                        >
                            <option value="">Select location to compare...</option>
                            {otherLocations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* ── Panel Body (virtualized) ── */}
                <div ref={inventoryVirt.scrollRef} className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    {(skuPanel.loading || loadingCompare) ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-app-primary mb-3" />
                            <p className="text-tp-sm font-bold text-app-muted-foreground">Loading inventory...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                                <Package size={20} style={{ color: 'var(--app-primary)', opacity: 0.5 }} />
                            </div>
                            <p className="text-tp-md font-bold text-app-muted-foreground">
                                {searchQuery ? 'No matches' : filterMode === 'NOT_IN_OTHER' ? 'All products are shared' : 'No inventory found'}
                            </p>
                            <p className="text-tp-xs text-app-muted-foreground mt-1">
                                {searchQuery ? 'Try a different search term' : filterMode === 'NOT_IN_OTHER' ? 'Every product in this location also exists in the selected location' : 'Click + to add products to this location'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ height: inventoryVirt.totalHeight, position: 'relative' }}>
                            <div style={{ transform: `translateY(${inventoryVirt.offsetY}px)` }}>
                                {inventoryVirt.visibleItems.map((item: any, i: number) => {
                                    const idx = inventoryVirt.startIndex + i
                                    return (
                                        <div
                                            key={item.id || idx}
                                            className="group flex items-center gap-2 px-3 hover:bg-app-surface/60 transition-colors"
                                            style={{
                                                height: INVENTORY_ROW_HEIGHT,
                                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                                            }}
                                        >
                                            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                                <Package size={11} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-tp-sm font-bold text-app-foreground truncate">
                                                    {item.product_name || item.product?.name || `Product #${item.product ?? item.product_id}`}
                                                </p>
                                                <p className="text-tp-xxs font-mono text-app-muted-foreground truncate">
                                                    {item.sku || item.product?.sku || ''}
                                                    {item.batch_number && ` · Batch: ${item.batch_number}`}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0 mr-1">
                                                <p className="text-tp-md font-bold text-app-foreground tabular-nums">
                                                    {typeof item.quantity === 'number' ? Number(item.quantity).toLocaleString() : 0}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleRemove(item.id)}
                                                disabled={removingId === item.id}
                                                className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                                style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)' }}
                                                title="Remove from location"
                                            >
                                                {removingId === item.id ? <Loader2 size={10} className="animate-spin" /> : <Minus size={10} />}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer Stats ── */}
                <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between text-tp-xxs font-bold text-app-muted-foreground"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)' }}>
                    <span>{filteredItems.length} product{filteredItems.length !== 1 ? 's' : ''}</span>
                    <span className="tabular-nums">
                        Total qty: {filteredItems.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0).toLocaleString()}
                    </span>
                </div>

                {/* ── Product Picker Overlay ── */}
                {showAddPicker && (
                    <div className="absolute inset-0 flex flex-col" style={{ background: 'var(--app-surface)', zIndex: 10 }}>
                        {/* Picker Header */}
                        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-success) 4%, var(--app-surface))' }}>
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ background: 'var(--app-success)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-success) 25%, transparent)' }}>
                                    <PackagePlus size={13} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-tp-md font-bold text-app-foreground">Add Product</h3>
                                    <p className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wider">
                                        to {skuPanel.location?.name}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowAddPicker(false)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                                <X size={14} />
                            </button>
                        </div>

                        {/* Picker Search */}
                        <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    type="text"
                                    value={pickerSearch}
                                    onChange={e => setPickerSearch(e.target.value)}
                                    placeholder="Search by name, SKU, barcode..."
                                    autoFocus
                                    className="w-full pl-8 pr-3 py-1.5 text-tp-sm rounded-lg outline-none"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-bg) 50%, var(--app-surface))',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                        color: 'var(--app-foreground)',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Picker Body (virtualized) */}
                        <div ref={pickerVirt.scrollRef} className="flex-1 overflow-y-auto min-h-0">
                            {loadingProducts ? (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <Loader2 size={24} className="animate-spin text-app-success mb-3" />
                                    <p className="text-tp-sm font-bold text-app-muted-foreground">Loading products...</p>
                                </div>
                            ) : addableProducts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                    <p className="text-tp-md font-bold text-app-muted-foreground">
                                        {pickerSearch ? 'No matching products' : 'All products already assigned'}
                                    </p>
                                </div>
                            ) : (
                                <div style={{ height: pickerVirt.totalHeight, position: 'relative' }}>
                                    <div style={{ transform: `translateY(${pickerVirt.offsetY}px)` }}>
                                        {pickerVirt.visibleItems.map((p: any) => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleAddProduct(p.id)}
                                                disabled={addingProductId === p.id}
                                                className="w-full flex items-center gap-2 px-3 text-left hover:bg-app-surface/60 transition-colors disabled:opacity-50"
                                                style={{
                                                    height: PICKER_ROW_HEIGHT,
                                                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 20%, transparent)',
                                                }}
                                            >
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
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════ */

export function WarehouseClient({ initialWarehouses, countries = [], defaultCountryId = null }: { initialWarehouses: any[]; countries?: { id: number; name: string; iso2: string }[]; defaultCountryId?: number | null }) {
    const router = useRouter()
    const searchRef = useRef<HTMLInputElement>(null)
    const [data, setData] = useState<WarehouseNode[]>(initialWarehouses)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingWarehouse, setEditingWarehouse] = useState<any>(null)
    const [deleteTarget, setDeleteTarget] = useState<any>(null)
    const [defaultParent, setDefaultParent] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    // Start collapsed so we don't paint every child row on initial load.
    // Without this, a tenant with 100 branches × 20 children = 2000+ row
    // components mounted synchronously, locking the main thread. User can
    // still expand all via the toolbar toggle.
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
    // Progressive render: cap visible rows on first paint, "Show more"
    // reveals additional batches. Keeps TTI snappy even with 500+ nodes.
    const BATCH_SIZE = 30
    const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE)
    const [focusMode, setFocusMode] = useState(false)
    const [activeFilter, setActiveFilter] = useState<string | null>(null)

    /* ─── SKU Side Panel state ─── */
    const [skuPanel, setSkuPanel] = useState<{ open: boolean; location: WarehouseNode | null; items: any[]; loading: boolean }>({
        open: false, location: null, items: [], loading: false
    })

    const openSkuPanel = useCallback(async (loc: WarehouseNode) => {
        setSkuPanel({ open: true, location: loc, items: [], loading: true })
        try {
            const res = await erpFetch(`inventory/?warehouse=${loc.id}&page_size=50`)
            const items = Array.isArray(res) ? res : (res?.results ?? [])
            setSkuPanel(prev => ({ ...prev, items, loading: false }))
        } catch {
            setSkuPanel(prev => ({ ...prev, items: [], loading: false }))
        }
    }, [])

    const { branches, orphans } = useMemo(() => buildTree(data), [data])

    /* ─── Reset the progressive-render window whenever the list shape
     * changes. Otherwise switching filters would show a stale "Showing
     * 30 of 120" label. ─── */
    useEffect(() => { setVisibleCount(BATCH_SIZE) }, [searchQuery, activeFilter])

    /* ─── Keyboard shortcuts (Ctrl+K search, Ctrl+Q focus mode) ─── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Stats
    const totalNodes = data.length
    const branchCount = branches.length
    const storeCount = data.filter(w => w.location_type === 'STORE').length
    const warehouseCount = data.filter(w => w.location_type === 'WAREHOUSE').length
    const retailActive = data.filter(w => w.can_sell).length
    const globalSKUCount = data.reduce((sum, w) => sum + (w.inventory_count || 0), 0)

    // Defer the search input so fast typing doesn't force a full
    // re-filter + re-render on every keystroke — React 18+ scheduler
    // interleaves the filter pass with input updates.
    const deferredSearch = useDeferredValue(searchQuery)

    // Filter — composes search + KPI type filter
    const filteredBranches = useMemo(() => {
        let result = branches
        if (activeFilter === 'BRANCH') { /* pass through */ }
        else if (activeFilter === 'STORE' || activeFilter === 'WAREHOUSE' || activeFilter === 'VIRTUAL') {
            result = result.map(b => ({ ...b, children: b.children?.filter(c => c.location_type === activeFilter) || [] })).filter(b => (b.children?.length || 0) > 0)
        } else if (activeFilter === 'RETAIL') {
            result = result.map(b => ({ ...b, children: b.children?.filter(c => c.can_sell) || [] })).filter(b => b.can_sell || (b.children?.length || 0) > 0)
        }
        if (deferredSearch.trim()) {
            const q = deferredSearch.toLowerCase()
            result = result.filter(b => {
                const branchMatch = b.name.toLowerCase().includes(q) || b.code?.toLowerCase().includes(q) || b.city?.toLowerCase().includes(q)
                const childMatch = b.children?.some(c => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q))
                return branchMatch || childMatch
            })
        }
        return result
    }, [branches, deferredSearch, activeFilter])

    const filteredOrphans = useMemo(() => {
        let result = orphans
        if (activeFilter === 'BRANCH') { result = [] }
        else if (activeFilter === 'STORE' || activeFilter === 'WAREHOUSE' || activeFilter === 'VIRTUAL') { result = result.filter(o => o.location_type === activeFilter) }
        else if (activeFilter === 'RETAIL') { result = result.filter(o => o.can_sell) }
        if (deferredSearch.trim()) {
            const q = deferredSearch.toLowerCase()
            result = result.filter(o => o.name.toLowerCase().includes(q) || o.code?.toLowerCase().includes(q) || o.city?.toLowerCase().includes(q))
        }
        return result
    }, [orphans, deferredSearch, activeFilter])

    const parentOptions = data.filter(w => w.location_type === 'BRANCH').map(w => ({ id: w.id, name: w.name, country: w.country, country_name: w.country_name }))

    const handleDelete = async () => {
        const target = deleteTarget
        if (!target) return
        try {
            const result = await deleteWarehouse(target.id)
            if (!result.success) {
                toast.error(result.message || 'Failed to remove location')
            } else if (result.deactivated) {
                setData(prev => prev.map(w => w.id === target.id ? { ...w, is_active: false } : w))
                toast.warning(result.message || `"${target.name}" deactivated — has active data`, {
                    description: result.blockers?.join(', '),
                    duration: 6000,
                })
            } else {
                setData(prev => prev.filter(w => w.id !== target.id))
                toast.success('Location permanently removed')
            }
            router.refresh()
        } catch (err) {
            toast.error('Failed to remove location')
        }
        setDeleteTarget(null)
    }

    const handleAddChild = (parent: WarehouseNode) => {
        setEditingWarehouse(null)
        setDefaultParent(parent.id)
        setIsFormOpen(true)
    }

    const handleAdd = () => {
        setEditingWarehouse(null)
        setDefaultParent(null)
        setIsFormOpen(true)
    }

    const toggleExpand = useCallback((id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }, [])

    const allExpanded = branches.length > 0 && branches.every(b => expandedIds.has(b.id))

    const toggleExpandAll = useCallback(() => {
        if (allExpanded) {
            setExpandedIds(new Set())
        } else {
            setExpandedIds(new Set(branches.map(b => b.id)))
        }
    }, [allExpanded, branches])

    /* ─── KPI config ──────────────────────────── */
    const kpis = [
        { label: 'Total', value: totalNodes, color: 'var(--app-primary)', icon: Layers, filterKey: 'ALL' },
        { label: 'Branches', value: branchCount, color: 'var(--app-success)', icon: Building2, filterKey: 'BRANCH' },
        { label: 'Stores', value: storeCount, color: 'var(--app-info)', icon: Store, filterKey: 'STORE' },
        { label: 'Warehouses', value: warehouseCount, color: 'var(--app-warning)', icon: Warehouse, filterKey: 'WAREHOUSE' },
        { label: 'Retail', value: retailActive, color: 'var(--app-primary)', icon: Package, filterKey: 'RETAIL' },
        { label: 'Showing', value: filteredBranches.length + filteredOrphans.length, color: 'var(--app-muted-foreground)', icon: Search, filterKey: null },
    ]

    return (
        <div className="flex flex-col p-4 md:px-6 md:pt-6 md:pb-2 animate-in fade-in duration-300 overflow-hidden" style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ═══════════════ HEADER ═══════════════ */}
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {focusMode ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}>
                                <GitBranch size={14} className="text-white" />
                            </div>
                            <span className="text-tp-md font-bold text-app-foreground hidden sm:inline">Locations</span>
                            <span className="text-tp-xs font-bold text-app-muted-foreground">{filteredBranches.length + filteredOrphans.length}/{totalNodes}</span>
                        </div>

                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-tp-md bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                        </div>

                        <button onClick={handleAdd}
                            className="flex items-center gap-1 text-tp-xs font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
                            <Plus size={12} /><span className="hidden sm:inline">New</span>
                        </button>

                        <button onClick={() => setFocusMode(false)} title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Title Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <GitBranch size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg md:text-xl font-bold text-app-foreground tracking-tight">
                                        Branch <span style={{ color: 'var(--app-primary)' }}>Hierarchy</span>
                                    </h1>
                                    <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">
                                        {totalNodes} Locations · {branchCount} Branches · {retailActive} Retail Points
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <button
                                    onClick={handleAdd}
                                    className="flex items-center gap-1.5 text-tp-sm font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                >
                                    <Plus size={14} />
                                    <span className="hidden sm:inline">New Location</span>
                                </button>
                                <button onClick={() => setFocusMode(true)} title="Focus mode — maximize tree"
                                    className="flex items-center gap-1 text-tp-sm font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* KPI Strip */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                            {kpis.map(kpi => {
                                const KIcon = kpi.icon
                                const c = kpi.color
                                const isActive = kpi.filterKey === 'ALL' ? !activeFilter : (kpi.filterKey && activeFilter === kpi.filterKey)
                                const isClickable = !!kpi.filterKey
                                return (
                                    <div
                                        key={kpi.label}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left ${isClickable ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''} ${isActive ? 'ring-2 shadow-md scale-[1.02]' : ''}`}
                                        style={{
                                            background: isActive
                                                ? `color-mix(in srgb, ${c} 15%, var(--app-surface))`
                                                : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                            border: `1px solid color-mix(in srgb, ${isActive ? c : 'var(--app-border)'} ${isActive ? '50' : '50'}%, transparent)`,
                                            ...(isActive ? { '--tw-ring-color': `color-mix(in srgb, ${c} 30%, transparent)` } as any : {}),
                                        }}
                                        onClick={isClickable ? () => setActiveFilter(prev => kpi.filterKey === 'ALL' ? null : (prev === kpi.filterKey ? null : kpi.filterKey)) : undefined}
                                    >
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{
                                                background: isActive ? c : `color-mix(in srgb, ${c} 10%, transparent)`,
                                                color: isActive ? 'white' : c,
                                            }}>
                                            <KIcon size={11} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-tp-xxs font-bold uppercase tracking-wider"
                                                style={{ color: isActive ? c : 'var(--app-muted-foreground)' }}>{kpi.label}</div>
                                            <div className="text-sm font-bold text-app-foreground tabular-nums">{kpi.value}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Search Bar */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search by name, code, or city... (Ctrl+K)"
                                    className="w-full pl-9 pr-3 py-2 text-tp-md md:text-tp-lg bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                            </div>

                            <button
                                onClick={toggleExpandAll}
                                className="flex items-center gap-1 text-tp-sm font-bold px-2.5 py-2 rounded-xl border transition-all flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                    color: 'var(--app-primary)',
                                    borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}
                            >
                                {allExpanded ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                                <span className="hidden sm:inline">{allExpanded ? 'Collapse' : 'Expand'}</span>
                            </button>

                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')}
                                    className="text-tp-sm font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══════════════ ACTIVE FILTER INDICATOR ═══════════════ */}
            {activeFilter && (
                <div className="flex-shrink-0 flex items-center gap-2 mb-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <span className="text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wider">Filtering:</span>
                    <span
                        className="inline-flex items-center gap-1.5 text-tp-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                        style={{
                            color: kpis.find(k => k.filterKey === activeFilter)?.color || 'var(--app-primary)',
                            background: `color-mix(in srgb, ${kpis.find(k => k.filterKey === activeFilter)?.color || 'var(--app-primary)'} 12%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${kpis.find(k => k.filterKey === activeFilter)?.color || 'var(--app-primary)'} 25%, transparent)`,
                        }}
                        onClick={() => setActiveFilter(null)}
                    >
                        {kpis.find(k => k.filterKey === activeFilter)?.label || activeFilter}
                        <X size={10} />
                    </span>
                    <span className="text-tp-xs font-bold text-app-muted-foreground">
                        {filteredBranches.length + filteredOrphans.length} result{filteredBranches.length + filteredOrphans.length !== 1 ? 's' : ''}
                    </span>
                </div>
            )}

            {/* ═══════════════ TREE TABLE ═══════════════ */}
            <div className="flex-1 min-h-0 rounded-t-2xl overflow-hidden flex flex-col"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>

                {/* Column Headers */}
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wider"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <div className="w-5 flex-shrink-0" />
                    <div className="w-7 flex-shrink-0" />
                    <div className="flex-1 min-w-0">Location</div>
                    <div className="hidden sm:block w-16 flex-shrink-0">Code</div>
                    <div className="hidden sm:block w-20 flex-shrink-0">Type</div>
                    <div className="hidden md:block w-24 flex-shrink-0">City</div>
                    <div className="hidden lg:block w-16 flex-shrink-0">Country</div>
                    <div className="hidden sm:block w-16 flex-shrink-0 text-right">SKUs</div>
                    <div className="w-16 flex-shrink-0" />
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {filteredBranches.length === 0 && filteredOrphans.length === 0 && !searchQuery && !activeFilter ? (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                                style={{
                                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 15%, transparent), color-mix(in srgb, var(--app-primary) 5%, transparent))',
                                    border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}
                            >
                                <GitBranch size={28} style={{ color: 'var(--app-primary)', opacity: 0.7 }} />
                            </div>
                            <p className="text-base font-bold text-app-muted-foreground mb-1">No Locations Yet</p>
                            <p className="text-xs text-app-muted-foreground mb-6 max-w-xs">
                                Create your first branch to start organizing your stores, warehouses, and virtual stock points.
                            </p>
                            <button
                                onClick={handleAdd}
                                className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold hover:brightness-110 transition-all"
                                style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                            >
                                <Plus size={16} className="inline mr-1.5" />Create First Branch
                            </button>
                        </div>
                    ) : filteredBranches.length === 0 && filteredOrphans.length === 0 ? (
                        /* Search / Filter empty */
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Search size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No matching locations</p>
                            <p className="text-tp-sm text-app-muted-foreground mt-1">Try a different search term or clear filters</p>
                        </div>
                    ) : (
                        <>
                            {/* Branches (tree rows) — sliced for progressive render */}
                            {filteredBranches.slice(0, visibleCount).map(branch => (
                                <BranchRow
                                    key={branch.id}
                                    branch={branch}
                                    isExpanded={expandedIds.has(branch.id)}
                                    onToggle={() => toggleExpand(branch.id)}
                                    onEdit={(w) => { setEditingWarehouse(w); setDefaultParent(null); setIsFormOpen(true) }}
                                    onDelete={(w) => setDeleteTarget(w)}
                                    onAddChild={handleAddChild}
                                    onSkuClick={openSkuPanel}
                                />
                            ))}

                            {/* Orphans — allow a proportional slice once branches are exhausted */}
                            {(() => {
                                const branchesShown = Math.min(filteredBranches.length, visibleCount)
                                const remaining = Math.max(0, visibleCount - branchesShown)
                                return filteredOrphans.slice(0, remaining).map(node => (
                                    <OrphanRow
                                        key={node.id}
                                        node={node}
                                        onEdit={(w) => { setEditingWarehouse(w); setDefaultParent(null); setIsFormOpen(true) }}
                                        onDelete={(w) => setDeleteTarget(w)}
                                        onSkuClick={openSkuPanel}
                                    />
                                ))
                            })()}

                            {/* Show-more sentinel — cheap button, no IntersectionObserver needed */}
                            {(() => {
                                const totalShowable = filteredBranches.length + filteredOrphans.length
                                const remaining = totalShowable - visibleCount
                                if (remaining <= 0) return null
                                return (
                                    <div className="flex flex-col items-center gap-2 py-6">
                                        <p className="text-tp-sm text-app-muted-foreground">
                                            Showing {Math.min(visibleCount, totalShowable)} of {totalShowable} · rendering in batches to keep things snappy
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setVisibleCount(v => v + BATCH_SIZE)}
                                                className="px-3 py-1.5 rounded-lg text-tp-sm font-bold bg-app-primary text-white hover:brightness-110 transition-all"
                                            >
                                                Show {Math.min(remaining, BATCH_SIZE)} more
                                            </button>
                                            {remaining > BATCH_SIZE && (
                                                <button
                                                    onClick={() => setVisibleCount(totalShowable)}
                                                    className="px-3 py-1.5 rounded-lg text-tp-sm font-bold border border-app-border text-app-foreground hover:bg-app-surface transition-all"
                                                >
                                                    Show all {totalShowable}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })()}
                        </>
                    )}
                </div>
            </div>

            {/* ── Footer ──────────────────────────────────────── */}
            <div
                className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-tp-sm font-bold rounded-b-2xl"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    borderTop: 'none',
                    marginTop: '-1px',
                    color: 'var(--app-muted-foreground)',
                    backdropFilter: 'blur(10px)',
                }}
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <span>{data.filter(w => w.is_active).length} active locations</span>
                    <span style={{ color: 'var(--app-border)' }}>·</span>
                    <span>{globalSKUCount.toLocaleString()} unique SKUs</span>
                    {activeFilter && (
                        <>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span style={{ color: 'var(--app-primary)' }}>Filtered: {activeFilter}</span>
                            <button
                                onClick={() => setActiveFilter(null)}
                                className="underline hover:opacity-80 transition-opacity"
                                style={{ color: 'var(--app-primary)' }}
                            >
                                Clear
                            </button>
                        </>
                    )}
                    {searchQuery && (
                        <>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span style={{ color: 'var(--app-info)' }}>Search active</span>
                            <button
                                onClick={() => setSearchQuery('')}
                                className="underline hover:opacity-80 transition-opacity"
                                style={{ color: 'var(--app-info)' }}
                            >
                                Clear
                            </button>
                        </>
                    )}
                </div>
                <div className="tabular-nums font-bold" style={{ color: 'var(--app-foreground)' }}>
                    System Status: <span style={{ color: 'var(--app-success)' }}>Operational</span>
                </div>
            </div>

            {/* ═══════════════ SKU SIDE PANEL ═══════════════ */}
            {skuPanel.open && (
                <SkuSidePanel
                    skuPanel={skuPanel}
                    setSkuPanel={setSkuPanel}
                    allLocations={data}
                    onRefresh={() => openSkuPanel(skuPanel.location!)}
                />
            )}

            {/* ═══════════════ MODALS ═══════════════ */}
            {isFormOpen && (
                <WarehouseModal
                    warehouse={editingWarehouse}
                    onClose={() => { setIsFormOpen(false); setDefaultParent(null) }}
                    parentOptions={parentOptions}
                    defaultParent={defaultParent}
                    countries={countries}
                    defaultCountryId={defaultCountryId}
                    onSaved={async () => {
                        try {
                            const { getWarehouses } = await import('@/app/actions/inventory/warehouses');
                            const fresh = await getWarehouses();
                            const list = Array.isArray(fresh) ? fresh : (fresh?.results ?? []);
                            setData(list);
                        } catch { /* router.refresh fallback already called */ }
                    }}
                />
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleDelete}
                title="Remove Location?"
                description={
                    deleteTarget?.location_type === 'BRANCH'
                        ? "This will permanently remove this branch AND all locations under it. Stock data may be lost."
                        : "This will permanently remove this location and all associated data."
                }
                confirmText="Confirm Remove"
                variant="danger"
            />
        </div>
    )
}
