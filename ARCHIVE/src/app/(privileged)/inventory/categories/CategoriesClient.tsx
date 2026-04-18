'use client'

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react'
import {
    ChevronRight, ChevronDown, Plus, Folder, FolderOpen,
    Pencil, X, Search, FolderTree,
    Trash2, Layers, Box, GitBranch,
    Maximize2, Minimize2, ChevronsUpDown, ChevronsDownUp, Bookmark, AlertCircle, Wrench,
    Package, Paintbrush, Link2, Unlink, Loader2, ExternalLink, LayoutPanelLeft, PanelLeftClose,
    Hash, Tag, ChevronUp, Info, ArrowRightLeft, Check, AlertTriangle, SlidersHorizontal, Lock as LockIcon,
    Sparkles, MousePointerClick, Keyboard
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { NumericRangeFilter, EMPTY_RANGE, type NumericRange } from '@/components/ui/NumericRangeFilter'
import { deleteCategory } from '@/app/actions/inventory/categories'
import { buildTree } from '@/lib/utils/tree'
import { CategoryFormModal } from '@/components/admin/categories/CategoryFormModal'
import { erpFetch } from '@/lib/erp-api'
import { GuidedTour, TourTriggerButton } from '@/components/ui/GuidedTour'
import { usePageTour } from '@/lib/tours/useTour'
import '@/lib/tours/definitions/inventory-categories'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */
interface CategoryNode {
    id: number; name: string; parent: number | null; code?: string; short_name?: string;
    children?: CategoryNode[]; product_count?: number; brand_count?: number; parfum_count?: number; attribute_count?: number; level?: number;
}

/* ═══════════════════════════════════════════════════════════
 *  PRODUCTS POPUP — shows all products under a category
 * ═══════════════════════════════════════════════════════════ */
function ProductsPopup({ category, onClose }: { category: CategoryNode; onClose: () => void }) {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        erpFetch(`inventory/products/?category=${category.id}&page_size=100`)
            .then((data: any) => {
                if (!cancelled) {
                    setProducts(Array.isArray(data) ? data : data?.results ?? [])
                    setLoading(false)
                }
            })
            .catch(() => { if (!cancelled) { setProducts([]); setLoading(false) } })
        return () => { cancelled = true }
    }, [category.id])

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--app-success)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-success) 30%, transparent)' }}>
                            <Package size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">Products in "{category.name}"</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">
                                {loading ? 'Loading...' : `${products.length} product${products.length !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-app-primary" />
                        </div>
                    ) : products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <Package size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No products linked</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">
                                Assign products to this category from the Products page.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-app-border/30">
                            {products.map((p: any) => (
                                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-app-surface/50 transition-all group">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>
                                        <Package size={13} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-bold text-app-foreground truncate">{p.name}</div>
                                        <div className="flex items-center gap-2 text-[10px] text-app-muted-foreground">
                                            {p.sku && <span className="font-mono">{p.sku}</span>}
                                            {p.barcode && <span>· {p.barcode}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {p.selling_price != null && (
                                            <span className="text-[11px] font-bold text-app-foreground tabular-nums">
                                                {Number(p.selling_price).toLocaleString()} FCFA
                                            </span>
                                        )}
                                        <Link href={`/inventory/products/${p.id}`}
                                            className="p-1 rounded-lg text-app-muted-foreground hover:text-app-primary opacity-0 group-hover:opacity-100 transition-all">
                                            <ExternalLink size={12} />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  BRANDS POPUP — shows linked brands + ability to link new
 * ═══════════════════════════════════════════════════════════ */
function BrandsPopup({ category, onClose }: { category: CategoryNode; onClose: () => void }) {
    const [brands, setBrands] = useState<any[]>([])
    const [allBrands, setAllBrands] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [showLinkForm, setShowLinkForm] = useState(false)
    const router = useRouter()

    const loadBrands = useCallback(() => {
        setLoading(true)
        erpFetch(`inventory/categories/${category.id}/linked_brands/`)
            .then((data: any) => {
                setAllBrands(Array.isArray(data?.all) ? data.all : [])
                setBrands(Array.isArray(data?.linked) ? data.linked : [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [category.id])

    useEffect(() => { loadBrands() }, [loadBrands])

    const linkedIds = useMemo(() => new Set(brands.map(b => b.id)), [brands])

    const unlinkBrand = async (brandId: number) => {
        setLinking(true)
        try {
            await erpFetch(`inventory/categories/${category.id}/unlink_brand/`, {
                method: 'POST',
                body: JSON.stringify({ brand_id: brandId }),
            })
            toast.success('Brand unlinked')
            loadBrands()
            router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to unlink brand')
        } finally {
            setLinking(false)
        }
    }

    const linkBrand = async (brandId: number) => {
        setLinking(true)
        try {
            await erpFetch(`inventory/categories/${category.id}/link_brand/`, {
                method: 'POST',
                body: JSON.stringify({ brand_id: brandId }),
            })
            toast.success('Brand linked')
            loadBrands()
            router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to link brand')
        } finally {
            setLinking(false)
        }
    }


    const unlinkedBrands = allBrands.filter(b => !linkedIds.has(b.id))

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, #8b5cf6 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#8b5cf6', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                            <Paintbrush size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">Brands in "{category.name}"</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">
                                {loading ? 'Loading...' : `${brands.length} linked brand${brands.length !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowLinkForm(!showLinkForm)}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all"
                            style={{
                                background: showLinkForm ? 'color-mix(in srgb, #8b5cf6 10%, transparent)' : 'transparent',
                                color: '#8b5cf6',
                                border: '1px solid color-mix(in srgb, #8b5cf6 20%, transparent)',
                            }}
                        >
                            <Link2 size={11} />
                            Link Brand
                        </button>
                        <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Link New Brand Section */}
                    {showLinkForm && (
                        <div className="px-5 py-3 animate-in slide-in-from-top-2 duration-200"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, #8b5cf6 3%, var(--app-surface))' }}
                        >
                            <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2">
                                Available Brands ({unlinkedBrands.length})
                            </p>
                            {unlinkedBrands.length === 0 ? (
                                <p className="text-[11px] text-app-muted-foreground py-2">All brands are already linked.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                    {unlinkedBrands.map(b => (
                                        <button
                                            key={b.id}
                                            onClick={() => linkBrand(b.id)}
                                            disabled={linking}
                                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
                                            style={{
                                                background: 'color-mix(in srgb, #8b5cf6 8%, transparent)',
                                                color: '#8b5cf6',
                                                border: '1px solid color-mix(in srgb, #8b5cf6 15%, transparent)',
                                            }}
                                        >
                                            <Plus size={10} />
                                            {b.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin" style={{ color: '#8b5cf6' }} />
                        </div>
                    ) : brands.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <Paintbrush size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No brands linked</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">
                                Click "Link Brand" above to associate brands with this category.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-app-border/30">
                            {brands.map((b: any) => (
                                <div key={b.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-app-surface/50 transition-all group">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, #8b5cf6 10%, transparent)', color: '#8b5cf6' }}>
                                        <Paintbrush size={13} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-bold text-app-foreground truncate">{b.name}</div>
                                        {b.short_name && <div className="text-[10px] text-app-muted-foreground">{b.short_name}</div>}
                                    </div>
                                    <button
                                        onClick={() => unlinkBrand(b.id)}
                                        disabled={linking}
                                        className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                                        style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)' }}
                                        title="Unlink brand"
                                    >
                                        <Unlink size={10} />
                                        Unlink
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  RECURSIVE TREE NODE (COA-style)
 * ═══════════════════════════════════════════════════════════ */
const CategoryRow = ({
    node, level, onEdit, onAdd, onDelete, searchQuery, forceExpanded,
    onViewProducts, onViewBrands, onViewAttributes, onSelect,
}: {
    node: CategoryNode; level: number; searchQuery: string; forceExpanded?: boolean;
    onEdit: (n: CategoryNode) => void; onAdd: (parentId?: number) => void; onDelete: (n: CategoryNode) => void;
    onViewProducts: (n: CategoryNode) => void; onViewBrands: (n: CategoryNode) => void; onViewAttributes: (n: CategoryNode) => void;
    onSelect?: (n: CategoryNode) => void;
}) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 2)
    const prevForceExpanded = useRef(forceExpanded)

    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    // Only react to intentional expand-all / collapse-all toggles, not selection re-renders
    useEffect(() => {
        if (forceExpanded !== undefined && forceExpanded !== prevForceExpanded.current) {
            setIsOpen(forceExpanded)
        }
        prevForceExpanded.current = forceExpanded
    }, [forceExpanded])

    const isRoot = level === 0
    const productCount = node.product_count ?? 0
    const brandCount = node.brand_count ?? 0
    const attributeCount = node.attribute_count ?? 0

    return (
        <div>
            {/* ── ROW ── */}
            <div
                className={`
                    group flex items-center gap-2.5 transition-all duration-200 relative
                    cursor-pointer
                    ${level === 0
                        ? 'py-2.5 md:py-3 hover:brightness-105'
                        : 'py-1.5 md:py-2 hover:brightness-105'
                    }
                `}
                onClick={(e) => {
                    e.stopPropagation()
                    if (isParent) { setIsOpen(o => !o) } else { onSelect?.(node) }
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation()
                    onSelect?.(node)
                }}
                style={{
                    paddingLeft: `${12 + (level > 0 ? level * 18 : 0)}px`,
                    paddingRight: '12px',
                    background: isRoot
                        ? 'linear-gradient(90deg, color-mix(in srgb, var(--app-primary) 6%, var(--app-surface)) 0%, var(--app-surface) 100%)'
                        : 'transparent',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                }}
            >
                {/* Left accent bar for root */}
                {isRoot && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                        style={{ background: 'linear-gradient(180deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 40%, transparent))' }} />
                )}

                {/* Indent connector line for children */}
                {level > 0 && (
                    <div className="absolute top-0 bottom-0" style={{ left: `${8 + (level - 1) * 18}px`, width: '1px', background: 'color-mix(in srgb, var(--app-border) 20%, transparent)' }} />
                )}

                {/* Toggle */}
                <button
                    onClick={(e) => { e.stopPropagation(); isParent && setIsOpen(!isOpen) }}
                    className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${isParent ? 'hover:bg-app-border/40' : ''}`}
                >
                    {isParent ? (
                        <div className={`w-2 h-2 rounded-sm transition-all duration-200 ${isOpen ? 'rotate-45 scale-110' : ''}`}
                            style={{ background: isOpen ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-muted-foreground) 60%, transparent)' }} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-primary) 35%, transparent)' }} />
                    )}
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                    style={{
                        background: isRoot
                            ? 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))'
                            : 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                        color: isRoot ? '#fff' : 'var(--app-muted-foreground)',
                        boxShadow: isRoot ? '0 2px 8px color-mix(in srgb, var(--app-primary) 20%, transparent)' : 'none',
                    }}
                >
                    {isRoot
                        ? <Bookmark size={13} strokeWidth={2.5} />
                        : isParent
                            ? (isOpen ? <FolderOpen size={13} /> : <Folder size={13} />)
                            : <Folder size={12} />}
                </div>

                {/* Name block */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={(e) => {
                        e.stopPropagation()
                        if (isParent) { setIsOpen(o => !o) } else { onSelect?.(node) }
                    }}>
                        <div className="flex items-center gap-1.5">
                            <span className={`truncate text-[13px] ${isRoot ? 'font-black text-app-foreground' : 'font-semibold text-app-foreground'}`}>
                                {node.name}
                            </span>
                            {isRoot && (
                                <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-[1px] rounded-full flex-shrink-0"
                                    style={{
                                        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))',
                                        color: '#fff',
                                    }}>
                                    ROOT
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {node.code && (
                                <span className="font-mono text-[9px] font-bold text-app-muted-foreground">
                                    {node.code}
                                </span>
                            )}
                            {node.short_name && (
                                <span className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-wider opacity-60">
                                    {node.short_name}
                                </span>
                            )}
                        </div>
                    </div>

                {/* ── Stat Badges ── */}
                {/* Children */}
                <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md tabular-nums"
                        style={{
                            background: isParent ? 'color-mix(in srgb, var(--app-foreground) 6%, transparent)' : 'transparent',
                            color: isParent ? 'var(--app-foreground)' : 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)',
                        }}>
                        {isParent ? node.children!.length : '–'}
                    </span>
                </div>

                {/* Brands */}
                <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewBrands(node) }}
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 tabular-nums transition-all hover:scale-105"
                        style={brandCount > 0 ? {
                            color: '#8b5cf6',
                            background: 'color-mix(in srgb, #8b5cf6 8%, transparent)',
                        } : {
                            color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)',
                        }}
                        title={`${brandCount} brand${brandCount !== 1 ? 's' : ''}`}
                    >
                        <Paintbrush size={9} />
                        {brandCount}
                    </button>
                </div>

                {/* Attributes */}
                <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewAttributes(node) }}
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 tabular-nums transition-all hover:scale-105"
                        style={attributeCount > 0 ? {
                            color: 'var(--app-warning)',
                            background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)',
                        } : {
                            color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)',
                        }}
                        title={`${attributeCount} attribute${attributeCount !== 1 ? 's' : ''}`}
                    >
                        <Tag size={9} />
                        {attributeCount}
                    </button>
                </div>

                {/* Products */}
                <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewProducts(node) }}
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 tabular-nums transition-all hover:scale-105"
                        style={productCount > 0 ? {
                            color: 'var(--app-success)',
                            background: 'color-mix(in srgb, var(--app-success) 8%, transparent)',
                        } : {
                            color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)',
                        }}
                        title={`${productCount} product${productCount !== 1 ? 's' : ''}`}
                    >
                        <Box size={9} />
                        {productCount}
                    </button>
                </div>

                {/* Actions — appear on hover */}
                <div className="w-[68px] flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(node) }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-all" title="Edit">
                        <Pencil size={11} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onAdd(node.id) }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-primary transition-all" title="Add sub-category">
                        <Plus size={12} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); if (isParent) { toast.error('Delete sub-categories first.'); return; } onDelete(node); }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg transition-all"
                        style={{ color: isParent ? 'var(--app-border)' : 'var(--app-muted-foreground)', cursor: isParent ? 'not-allowed' : 'pointer' }}
                        title={isParent ? 'Delete sub-categories first' : 'Delete'}
                    >
                        {isParent ? <AlertCircle size={11} /> : <Trash2 size={11} />}
                    </button>
                </div>
            </div>

            {/* ── CHILDREN ── */}
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children!.map((child) => (
                        <CategoryRow
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onEdit={onEdit}
                            onAdd={onAdd}
                            onDelete={onDelete}
                            onViewProducts={onViewProducts}
                            onViewBrands={onViewBrands}
                            onViewAttributes={onViewAttributes}
                            onSelect={onSelect}
                            searchQuery={searchQuery}
                            forceExpanded={forceExpanded}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  CATEGORY DETAIL PANEL — V2 Design Language Compliant
 *  Tabs: Overview · Products · Brands · Attributes
 * ═══════════════════════════════════════════════════════════ */
type PanelTab = 'overview' | 'products' | 'brands' | 'attributes'

function CategoryDetailPanel({ node, onEdit, onAdd, onDelete, allCategories, initialTab, onClose, onPin }: {
    node: CategoryNode
    onEdit: (n: CategoryNode) => void
    onAdd: (parentId?: number) => void
    onDelete: (n: CategoryNode) => void
    allCategories: any[]
    initialTab?: PanelTab
    onClose?: () => void
    onPin?: (n: CategoryNode) => void
}) {
    const [activeTab, setActiveTab] = useState<PanelTab>(initialTab ?? 'overview')
    const isParent = (node.children?.length ?? 0) > 0
    const productCount = node.product_count ?? 0
    const brandCount = node.brand_count ?? 0
    const attributeCount = node.attribute_count ?? 0
    const childCount = node.children?.length ?? 0

    useEffect(() => { setActiveTab(initialTab ?? 'overview') }, [node.id, initialTab])

    const tabs: { key: PanelTab; label: string; icon: React.ReactNode; count?: number; color: string }[] = [
        { key: 'overview', label: 'Overview', icon: <Layers size={12} />, color: 'var(--app-primary)' },
        { key: 'products', label: 'Products', icon: <Package size={12} />, count: productCount, color: 'var(--app-success, #22c55e)' },
        { key: 'brands', label: 'Brands', icon: <Paintbrush size={12} />, count: brandCount, color: '#8b5cf6' },
        { key: 'attributes', label: 'Attributes', icon: <Tag size={12} />, count: attributeCount, color: 'var(--app-warning, #f59e0b)' },
    ]

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-surface)' }}>
            {/* ── Panel Header — §11 modal header pattern ── */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                style={{
                    background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                            background: 'var(--app-primary)',
                            boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        }}>
                        {isParent ? <FolderOpen size={15} className="text-white" /> : <Folder size={15} className="text-white" />}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-app-foreground tracking-tight truncate">{node.name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {node.code && (
                                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    {node.code}
                                </span>
                            )}
                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                    color: 'var(--app-primary)',
                                    border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}>
                                {node.parent === null ? 'Root' : 'Child'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {onPin && (
                        <button onClick={() => onPin(node)}
                            className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors"
                            title="Pin to split view">
                            <Bookmark size={14} />
                        </button>
                    )}
                    <button onClick={() => onEdit(node)}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"
                        title="Edit">
                        <Pencil size={13} />
                    </button>
                    <button onClick={() => onAdd(node.id)}
                        className="flex items-center gap-1 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-2 py-1.5 rounded-xl transition-all"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        <Plus size={12} />
                    </button>
                    {onClose && (
                        <button onClick={onClose}
                            className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors ml-1"
                            title="Close">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tab Bar ── */}
            <div data-tour="detail-tabs" className="flex-shrink-0 flex items-center px-3 overflow-x-auto"
                style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {tabs.map(tab => {
                    const isActive = activeTab === tab.key
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2.5 transition-all whitespace-nowrap"
                            style={{
                                color: isActive ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                                borderBottom: isActive ? `2px solid var(--app-primary)` : '2px solid transparent',
                                marginBottom: '-1px',
                            }}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="text-[9px] font-black px-1 py-0.5 rounded min-w-[16px] text-center"
                                    style={{
                                        background: `color-mix(in srgb, ${tab.color} 10%, transparent)`,
                                        color: tab.color,
                                    }}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'overview' && (
                    <PanelOverviewTab node={node} onAdd={onAdd} onDelete={onDelete} isParent={isParent}
                        childCount={childCount} productCount={productCount} brandCount={brandCount}
                        attributeCount={node.attribute_count ?? 0}
                        onTabChange={setActiveTab} />
                )}
                {activeTab === 'products' && <PanelProductsTab categoryId={node.id} categoryName={node.name} allCategories={allCategories} />}
                {activeTab === 'brands' && <PanelBrandsTab categoryId={node.id} categoryName={node.name} />}
                {activeTab === 'attributes' && <PanelAttributesTab categoryId={node.id} categoryName={node.name} />}
            </div>
        </div>
    )
}

/* ── Overview Tab — Compact, fits without scroll ── */
function PanelOverviewTab({ node, onAdd, onDelete, isParent, childCount, productCount, brandCount, attributeCount, onTabChange }: {
    node: CategoryNode; onAdd: (pid?: number) => void; onDelete: (n: CategoryNode) => void;
    isParent: boolean; childCount: number; productCount: number; brandCount: number;
    attributeCount: number; onTabChange: (tab: PanelTab) => void;
}) {
    const isRoot = node.parent === null

    return (
        <div className="p-3 space-y-3 animate-in fade-in duration-150">

            {/* ── Quick Info Strip ── */}
            <div className="flex items-center gap-2 flex-wrap">
                {node.code && (
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                        {node.code}
                    </span>
                )}
                {node.short_name && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                        {node.short_name}
                    </span>
                )}
                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{
                        background: isRoot
                            ? 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))'
                            : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                        color: isRoot ? '#fff' : 'var(--app-muted-foreground)',
                    }}>
                    {isRoot ? 'Root' : `Level ${node.level ?? 1}`}
                </span>
                {(node.parfum_count ?? 0) > 0 && (
                    <span className="text-[9px] font-bold tabular-nums ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>
                        {node.parfum_count} parfums
                    </span>
                )}
            </div>

            {/* ── Stat Grid 2×2 ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {[
                    { label: 'Children', value: childCount, icon: <GitBranch size={12} />, color: 'var(--app-primary)', tab: null as PanelTab | null },
                    { label: 'Products', value: productCount, icon: <Package size={12} />, color: 'var(--app-success, #22c55e)', tab: 'products' as PanelTab },
                    { label: 'Brands', value: brandCount, icon: <Paintbrush size={12} />, color: '#8b5cf6', tab: 'brands' as PanelTab },
                    { label: 'Attrs', value: attributeCount, icon: <Tag size={12} />, color: 'var(--app-warning, #f59e0b)', tab: 'attributes' as PanelTab },
                ].map(s => (
                    <button key={s.label}
                        onClick={() => s.tab && onTabChange(s.tab)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all text-left ${s.tab ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : 'cursor-default'}`}
                        style={{
                            background: s.value > 0
                                ? `color-mix(in srgb, ${s.color} 5%, var(--app-surface))`
                                : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: `1px solid ${s.value > 0 ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                                background: `color-mix(in srgb, ${s.color} ${s.value > 0 ? '12' : '6'}%, transparent)`,
                                color: s.value > 0 ? s.color : 'var(--app-muted-foreground)',
                            }}>
                            {s.icon}
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-black tabular-nums leading-tight"
                                style={{ color: s.value > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                {s.value}
                            </div>
                            <div className="text-[8px] font-bold uppercase tracking-widest leading-none"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                {s.label}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* ── Sub-categories (compact) ── */}
            {childCount > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Sub-categories</p>
                        <button onClick={() => onAdd(node.id)}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all"
                            style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
                            <Plus size={9} /> Add
                        </button>
                    </div>
                    <div className="flex flex-col">
                        {node.children!.map(child => {
                            const cp = child.product_count ?? 0
                            const cb = child.brand_count ?? 0
                            return (
                                <div key={child.id}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:brightness-105 transition-all"
                                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 12%, transparent)' }}>
                                    <Folder size={10} style={{ color: 'var(--app-muted-foreground)', flexShrink: 0 }} />
                                    <span className="flex-1 text-[11px] font-semibold text-app-foreground truncate">{child.name}</span>
                                    {cb > 0 && <span className="text-[9px] font-black tabular-nums" style={{ color: '#8b5cf6' }}>{cb}b</span>}
                                    {cp > 0 && <span className="text-[9px] font-black tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>{cp}p</span>}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Leaf ── */}
            {childCount === 0 && (
                <div className="rounded-xl py-3 px-3 text-center"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 40%, transparent)', border: '1px dashed color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    <p className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Leaf — no sub-categories</p>
                    <button onClick={() => onAdd(node.id)}
                        className="mt-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg mx-auto flex items-center gap-1 transition-all"
                        style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
                        <Plus size={9} /> Add Sub-category
                    </button>
                </div>
            )}

            {/* ── Delete ── */}
            {!isParent && (
                <button onClick={() => onDelete(node)}
                    className="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-xl border transition-all hover:brightness-105"
                    style={{
                        color: 'var(--app-error, #ef4444)',
                        borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)',
                        background: 'color-mix(in srgb, var(--app-error, #ef4444) 4%, transparent)',
                    }}>
                    <Trash2 size={11} /> Delete
                </button>
            )}
        </div>
    )
}

/* ── Products Tab — multi-select + filters + smart move modal ── */
function PanelProductsTab({ categoryId, categoryName, allCategories }: {
    categoryId: number; categoryName: string; allCategories: any[]
}) {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [nextOffset, setNextOffset] = useState<number | null>(null)
    const [totalCount, setTotalCount] = useState(0)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selected, setSelected] = useState<Set<number>>(new Set())
    // Sort
    const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    // Product preview popup
    const [previewProduct, setPreviewProduct] = useState<any>(null)
    // Database-driven filter options
    const [filterOptions, setFilterOptions] = useState<any>({})
    // Filters
    const [filterBrand, setFilterBrand] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterUnit, setFilterUnit] = useState('')
    const [filterTva, setFilterTva] = useState('')
    const [taxGroups, setTaxGroups] = useState<any[]>([])
    const [filterMargin, setFilterMargin] = useState<NumericRange>(EMPTY_RANGE)
    const [filterPrice, setFilterPrice] = useState<NumericRange>(EMPTY_RANGE)
    const [showFilterPopup, setShowFilterPopup] = useState(false)
    const filterRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const sentinelRef = useRef<HTMLDivElement>(null)
    // Move modal
    const [showMoveModal, setShowMoveModal] = useState(false)
    const [moveTarget, setMoveTarget] = useState<number | null>(null)
    const [movePreview, setMovePreview] = useState<any>(null)
    const [moveStep, setMoveStep] = useState<'picking' | 'preview' | 'executing'>('picking')
    const [catSearch, setCatSearch] = useState('')
    const [autoLinkBrands, setAutoLinkBrands] = useState<Set<number>>(new Set())
    const [autoLinkAttrs, setAutoLinkAttrs] = useState<Set<number>>(new Set())
    const [reassignBrands, setReassignBrands] = useState<Record<number, number>>({})
    const [reassignAttrs, setReassignAttrs] = useState<Record<number, number>>({})
    const router = useRouter()

    // Debounce search — 300ms
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300)
        return () => clearTimeout(timer)
    }, [search])

    // Load products (paginated)
    const loadProducts = useCallback((offset = 0, append = false) => {
        if (!append) setLoading(true)
        else setLoadingMore(true)

        const params = new URLSearchParams()
        if (offset > 0) params.set('offset', String(offset))
        if (debouncedSearch) params.set('search', debouncedSearch)
        params.set('sort', sortBy)
        params.set('sort_dir', sortDir)
        const qs = params.toString() ? `?${params.toString()}` : ''

        erpFetch(`inventory/categories/${categoryId}/explore/${qs}`)
            .then((data: any) => {
                const newProducts = data?.products ?? []
                if (append) {
                    setProducts(prev => [...prev, ...newProducts])
                } else {
                    setProducts(newProducts)
                }
                setTotalCount(data?.total_count ?? 0)
                setHasMore(data?.has_more ?? false)
                setNextOffset(data?.next_offset ?? null)
                // On first load (not append), capture filter options from DB
                if (!append && data?.filter_options) {
                    setFilterOptions(data.filter_options)
                }
                setLoading(false)
                setLoadingMore(false)
            })
            .catch(() => {
                if (!append) setProducts([])
                setLoading(false)
                setLoadingMore(false)
            })
    }, [categoryId, debouncedSearch, sortBy, sortDir])

    // Reset and load on category/search change
    useEffect(() => {
        setSelected(new Set())
        loadProducts(0, false)
    }, [loadProducts])

    // Infinite scroll — IntersectionObserver on sentinel
    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && nextOffset !== null) {
                    loadProducts(nextOffset, true)
                }
            },
            { root: scrollRef.current, threshold: 0.1 }
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [hasMore, loadingMore, nextOffset, loadProducts])

    // DB-driven filter option lists (from explore API)
    const uniqueBrands = useMemo(() => (filterOptions.brands || []).map((o: any) => o.value), [filterOptions])
    const uniqueStatuses = useMemo(() => (filterOptions.statuses || []).map((o: any) => o.value), [filterOptions])
    const uniqueTypes = useMemo(() => (filterOptions.types || []).map((o: any) => o.value), [filterOptions])
    const uniqueUnits = useMemo(() => (filterOptions.units || []).map((o: any) => o.value), [filterOptions])
    const uniqueTvaRates = useMemo(() => (filterOptions.tva_rates || []).map((o: any) => o.value), [filterOptions])

    // Fetch tax groups from finance module (source of truth)
    useEffect(() => {
        erpFetch('finance/tax-groups/')
            .then((data: any) => {
                const groups = Array.isArray(data) ? data : data?.results ?? []
                setTaxGroups(groups)
            })
            .catch(() => {})
    }, [])

    const activeFilterCount = (filterBrand ? 1 : 0) + (filterStatus ? 1 : 0) + (filterType ? 1 : 0) +
        (filterUnit ? 1 : 0) + (filterTva ? 1 : 0) +
        (filterMargin.op ? 1 : 0) + (filterPrice.op ? 1 : 0)

    const clearAllFilters = () => {
        setFilterBrand(''); setFilterStatus(''); setFilterType('')
        setFilterUnit(''); setFilterTva('')
        setFilterMargin(EMPTY_RANGE); setFilterPrice(EMPTY_RANGE)
    }

    // Helper: apply NumericRange filter to a value
    const applyRange = (val: number | null | undefined, range: NumericRange): boolean => {
        if (!range.op || val === null || val === undefined) return true
        const a = Number(range.a), b = Number(range.b)
        switch (range.op) {
            case 'eq': return val === a
            case 'gt': return val > a
            case 'gte': return val >= a
            case 'lt': return val < a
            case 'lte': return val <= a
            case 'between': return val >= a && val <= b
            default: return true
        }
    }

    // Client-side filters on loaded data (search is server-side)
    const filtered = useMemo(() => {
        let list = products
        // SearchableDropdown supports NOT mode (value starts with '!')
        const matchFilter = (val: string | undefined, filter: string) => {
            if (!filter) return true
            const isNot = filter.startsWith('!')
            const raw = isNot ? filter.slice(1) : filter
            if (!raw) return true
            return isNot ? val !== raw : val === raw
        }
        if (filterBrand) list = list.filter(p => matchFilter(p.brand_name, filterBrand))
        if (filterStatus) list = list.filter(p => matchFilter(p.status, filterStatus))
        if (filterType) list = list.filter(p => matchFilter(p.product_type, filterType))
        if (filterUnit) list = list.filter(p => matchFilter(p.unit_code, filterUnit))
        if (filterTva) list = list.filter(p => matchFilter(String(p.tva_rate), filterTva))
        if (filterMargin.op) list = list.filter(p => applyRange(p.margin_pct, filterMargin))
        if (filterPrice.op) list = list.filter(p => applyRange(p.selling_price_ttc, filterPrice))
        return list
    }, [products, filterBrand, filterStatus, filterType, filterUnit, filterTva, filterMargin, filterPrice])

    const toggleSelect = (id: number) => {
        const next = new Set(selected)
        next.has(id) ? next.delete(id) : next.add(id)
        setSelected(next)
    }
    const toggleAll = () => {
        if (selected.size === filtered.length) setSelected(new Set())
        else setSelected(new Set(filtered.map(p => p.id)))
    }

    // Move modal
    const openMoveModal = () => {
        setShowMoveModal(true)
        setMoveStep('picking')
        setMoveTarget(null)
        setMovePreview(null)
        setCatSearch('')
    }
    const closeMoveModal = () => {
        setShowMoveModal(false)
        setMoveStep('picking')
        setMoveTarget(null)
        setMovePreview(null)
        setCatSearch('')
        setReassignBrands({})
        setReassignAttrs({})
    }

    const moveTargets = allCategories.filter((c: any) => c.id !== categoryId)
    const filteredTargets = catSearch.trim()
        ? moveTargets.filter((c: any) => c.name?.toLowerCase().includes(catSearch.toLowerCase()) || c.full_path?.toLowerCase().includes(catSearch.toLowerCase()))
        : moveTargets

    const previewMove = async (targetId: number) => {
        setMoveTarget(targetId)
        setMoveStep('preview')
        try {
            const preview = await erpFetch('inventory/categories/move_products/', {
                method: 'POST',
                body: JSON.stringify({ product_ids: Array.from(selected), target_category_id: targetId, preview: true }),
            })
            setMovePreview(preview)
            setAutoLinkBrands(new Set((preview.conflict_brands || []).map((b: any) => b.id)))
            setAutoLinkAttrs(new Set((preview.conflict_attributes || []).map((a: any) => a.id)))
            setReassignBrands({})
            setReassignAttrs({})
        } catch (e: any) {
            toast.error(e?.message || 'Failed to analyze move')
            setMoveStep('picking')
        }
    }

    const executeMove = async () => {
        if (!moveTarget) return
        setMoveStep('executing')
        try {
            await erpFetch('inventory/categories/move_products/', {
                method: 'POST',
                body: JSON.stringify({
                    product_ids: Array.from(selected),
                    target_category_id: moveTarget,
                    reconciliation: {
                        auto_link_brands: Array.from(autoLinkBrands),
                        auto_link_attributes: Array.from(autoLinkAttrs),
                        reassign_brands: reassignBrands,
                        reassign_attributes: reassignAttrs,
                    },
                }),
            })
            toast.success(`Moved ${selected.size} product${selected.size > 1 ? 's' : ''} to "${movePreview?.target_category?.name}"`)
            closeMoveModal()
            setSelected(new Set())
            loadProducts(0, false)
            router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Move failed')
            setMoveStep('preview')
        }
    }
    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            {/* Search + Select All + Filter Button */}
            <div className="flex-shrink-0 px-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-1.5">
                    {!loading && products.length > 0 && (
                        <button onClick={toggleAll}
                            className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all"
                            style={{
                                borderColor: selected.size > 0 ? 'var(--app-primary)' : 'var(--app-border)',
                                background: selected.size === filtered.length && selected.size > 0 ? 'var(--app-primary)' : 'transparent',
                            }}>
                            {selected.size === filtered.length && selected.size > 0 && <Check size={10} className="text-white" />}
                            {selected.size > 0 && selected.size < filtered.length && <div className="w-1.5 h-1.5 rounded-sm bg-app-primary" />}
                        </button>
                    )}
                    <div className="relative flex-1">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={`Search in "${categoryName}"...`}
                            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all" />
                    </div>
                    {/* Sort controls */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        {(['name', 'stock', 'price'] as const).map(s => (
                            <button key={s}
                                onClick={() => { if (sortBy === s) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(s); setSortDir('asc') } }}
                                className="text-[9px] font-bold px-1.5 py-1 rounded-lg transition-all"
                                style={{
                                    background: sortBy === s ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                                    color: sortBy === s ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                }}>
                                {s === 'name' ? 'A-Z' : s === 'stock' ? 'Qty' : '₵'}
                                {sortBy === s && <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                            </button>
                        ))}
                    </div>
                    {/* Filter Button */}
                    <div className="relative" ref={filterRef}>
                        <button onClick={() => setShowFilterPopup(!showFilterPopup)}
                            className="relative p-1.5 rounded-lg transition-all flex-shrink-0"
                            style={{
                                background: activeFilterCount > 0 || showFilterPopup ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                                color: activeFilterCount > 0 || showFilterPopup ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                border: activeFilterCount > 0 ? '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' : '1px solid transparent',
                            }}>
                            <SlidersHorizontal size={14} />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-app-primary text-white text-[8px] font-black flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Filter Popup — Searchable Dropdowns (same as Product Inventory) */}
                        {showFilterPopup && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center animate-in fade-in duration-200"
                                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                                onClick={e => { if (e.target === e.currentTarget) setShowFilterPopup(false) }}>
                                <div className="w-full max-w-md mx-4 rounded-2xl animate-in zoom-in-95 duration-200"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
                                    onClick={e => e.stopPropagation()}>
                                    {/* Header */}
                                    <div className="px-4 py-2.5 flex items-center justify-between"
                                        style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))' }}>
                                        <div className="flex items-center gap-2">
                                            <SlidersHorizontal size={13} className="text-app-primary" />
                                            <span className="text-[11px] font-black uppercase tracking-wider text-app-foreground">Filters</span>
                                            {activeFilterCount > 0 && (
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-app-primary text-white">{activeFilterCount}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {activeFilterCount > 0 && (
                                                <button onClick={clearAllFilters}
                                                    className="text-[10px] font-bold text-app-error hover:underline">Clear all</button>
                                            )}
                                            <button onClick={() => setShowFilterPopup(false)}
                                                className="p-1 rounded-lg hover:bg-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-all">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Filter Grid — SearchableDropdowns */}
                                    <div className="p-3">
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                            <SearchableDropdown label="Type" value={filterType} onChange={setFilterType}
                                                options={uniqueTypes.map((t: string) => ({ value: t, label: t }))} placeholder="All Types" />

                                            <SearchableDropdown label="Brand" value={filterBrand} onChange={setFilterBrand}
                                                options={uniqueBrands.map((b: string) => ({ value: b, label: b }))} placeholder="All Brands" />

                                            <SearchableDropdown label="Status" value={filterStatus} onChange={setFilterStatus}
                                                options={uniqueStatuses.map((s: string) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} placeholder="All Statuses" />

                                            <SearchableDropdown label="Unit" value={filterUnit} onChange={setFilterUnit}
                                                options={uniqueUnits.map((u: string) => ({ value: u, label: u }))} placeholder="All Units" />

                                            <SearchableDropdown label="TVA Rate %" value={filterTva} onChange={setFilterTva}
                                                options={taxGroups.length > 0
                                                    ? taxGroups.map((tg: any) => ({ value: String(tg.rate), label: `${tg.name} (${tg.rate}%)` }))
                                                    : uniqueTvaRates.map((r: any) => ({ value: r, label: `${r}%` }))
                                                } placeholder="All Rates" />

                                            <NumericRangeFilter label="Margin %" value={filterMargin} onChange={setFilterMargin} />

                                            <NumericRangeFilter label="Price TTC" value={filterPrice} onChange={setFilterPrice} />
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="px-4 py-2.5 flex items-center justify-between"
                                        style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, var(--app-surface))' }}>
                                        <span className="text-[10px] font-bold text-app-muted-foreground">
                                            {filtered.length} of {totalCount} products
                                        </span>
                                        <button onClick={() => setShowFilterPopup(false)}
                                            className="text-[11px] font-bold px-4 py-1.5 rounded-xl bg-app-primary text-white hover:brightness-110 transition-all"
                                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <p className="text-[10px] font-bold text-app-muted-foreground mt-1">
                    {loading ? 'Loading...' : selected.size > 0
                        ? `${selected.size} of ${filtered.length} selected`
                        : activeFilterCount > 0
                            ? `${filtered.length} of ${totalCount} (filtered)`
                            : `${products.length} of ${totalCount} product${totalCount !== 1 ? 's' : ''}`}
                </p>
            </div>

            {/* Floating Action Bar */}
            {selected.size > 0 && (
                <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between gap-2 animate-in slide-in-from-top-1 duration-150"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <span className="text-[11px] font-bold text-app-primary">{selected.size} selected</span>
                    <button onClick={openMoveModal}
                        className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary text-white px-3 py-1.5 rounded-xl hover:brightness-110 transition-all"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        <ArrowRightLeft size={12} /> Move to Category
                    </button>
                </div>
            )}

            {/* Product List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" ref={scrollRef}>
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-app-primary" /></div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Package size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">{search || filterBrand || filterStatus ? 'No matching products' : 'No products in this category'}</p>
                        <p className="text-[11px] text-app-muted-foreground mt-1">Assign products from the Products page.</p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-app-border/30">
                            {filtered.map((p: any) => {
                                const isSelected = selected.has(p.id)
                                return (
                                    <div key={p.id}
                                        className="flex items-center gap-2 px-4 py-2 group transition-all cursor-pointer"
                                        style={{ background: isSelected ? 'color-mix(in srgb, var(--app-primary) 6%, transparent)' : 'transparent' }}
                                        onClick={() => toggleSelect(p.id)}>
                                        <button
                                            className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all"
                                            style={{
                                                borderColor: isSelected ? 'var(--app-primary)' : 'var(--app-border)',
                                                background: isSelected ? 'var(--app-primary)' : 'transparent',
                                            }}>
                                            {isSelected && <Check size={10} className="text-white" />}
                                        </button>
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>
                                            <Package size={12} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-app-foreground truncate">{p.name}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-app-muted-foreground">
                                                {p.sku && <span className="font-mono font-bold">{p.sku}</span>}
                                                {p.brand_name && <span>· {p.brand_name}</span>}
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-bold tabular-nums flex-shrink-0"
                                            style={{ color: (p.stock_on_hand ?? 0) > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                                            {Number(p.stock_on_hand ?? 0).toLocaleString()}
                                        </span>
                                        <button
                                            onClick={e => { e.stopPropagation(); setPreviewProduct(p) }}
                                            className="p-1 rounded-lg text-app-muted-foreground hover:text-app-primary opacity-0 group-hover:opacity-100 transition-all">
                                            <Info size={11} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Infinite scroll sentinel */}
                        <div ref={sentinelRef} className="h-1" />
                        {loadingMore && (
                            <div className="flex items-center justify-center py-3 gap-2">
                                <Loader2 size={14} className="animate-spin text-app-primary" />
                                <span className="text-[10px] text-app-muted-foreground">Loading more...</span>
                            </div>
                        )}
                        {!hasMore && products.length > 0 && products.length >= 50 && (
                            <p className="text-[10px] text-app-muted-foreground text-center py-2 opacity-50">
                                All {totalCount} products loaded
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* ═══════════════════ PRODUCT PREVIEW POPUP ═══════════════════ */}
            {previewProduct && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center animate-in fade-in duration-150"
                    style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setPreviewProduct(null)}>
                    <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
                        onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-4 py-3 flex items-center gap-3"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))' }}>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}>
                                <Package size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-black text-app-foreground truncate">{previewProduct.name}</p>
                                {previewProduct.sku && <p className="text-[10px] font-mono font-bold text-app-muted-foreground">{previewProduct.sku}</p>}
                            </div>
                            <button onClick={() => setPreviewProduct(null)}
                                className="p-1 rounded-lg hover:bg-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-all">
                                <X size={14} />
                            </button>
                        </div>

                        {/* Details grid */}
                        <div className="p-4 space-y-2">
                            {[
                                { label: 'Brand', value: previewProduct.brand_name, color: '#8b5cf6' },
                                { label: 'Type', value: previewProduct.product_type },
                                { label: 'Status', value: previewProduct.status?.toUpperCase() },
                                { label: 'Unit', value: previewProduct.unit_code },
                                { label: 'Stock', value: Number(previewProduct.stock_on_hand ?? 0).toLocaleString(), color: (previewProduct.stock_on_hand ?? 0) > 0 ? 'var(--app-success)' : 'var(--app-error)' },
                                { label: 'Price TTC', value: `${Number(previewProduct.selling_price_ttc ?? 0).toLocaleString()} CFA` },
                                { label: 'Price HT', value: `${Number(previewProduct.selling_price_ht ?? 0).toLocaleString()} CFA` },
                                { label: 'Cost', value: `${Number(previewProduct.cost_price ?? 0).toLocaleString()} CFA` },
                                { label: 'TVA', value: previewProduct.tva_rate != null ? `${previewProduct.tva_rate}%` : null },
                                { label: 'Margin', value: previewProduct.margin_pct != null ? `${previewProduct.margin_pct}%` : null, color: (previewProduct.margin_pct ?? 0) > 0 ? 'var(--app-success)' : 'var(--app-error)' },
                            ].filter(r => r.value).map(r => (
                                <div key={r.label} className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{r.label}</span>
                                    <span className="text-[12px] font-bold" style={{ color: r.color || 'var(--app-foreground)' }}>{r.value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2.5 flex items-center justify-end gap-2"
                            style={{ borderTop: '1px solid var(--app-border)' }}>
                            <Link href={`/inventory/products/${previewProduct.id}`}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-app-primary text-white hover:brightness-110 transition-all"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <ExternalLink size={11} /> Open Full Page
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════ MOVE MODAL ═══════════════════ */}
            {showMoveModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 80%, transparent)', backdropFilter: 'blur(8px)' }}
                    onClick={closeMoveModal}>
                    <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
                        }}
                        onClick={e => e.stopPropagation()}>

                        {/* Modal Header */}
                        <div className="px-5 py-3.5 flex items-center justify-between"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <ArrowRightLeft size={15} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-app-foreground">Move Products</h3>
                                    <p className="text-[11px] text-app-muted-foreground">
                                        {selected.size} product{selected.size > 1 ? 's' : ''} from &ldquo;{categoryName}&rdquo;
                                    </p>
                                </div>
                            </div>
                            <button onClick={closeMoveModal}
                                className="p-2 rounded-xl hover:bg-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-all">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-5 py-4" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            {moveStep === 'picking' && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Select target category</p>
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                        <input value={catSearch} onChange={e => setCatSearch(e.target.value)}
                                            placeholder="Search categories..."
                                            autoFocus
                                            className="w-full pl-9 pr-3 py-2 text-[12px] bg-app-background border border-app-border rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary transition-all" />
                                    </div>
                                    <div className="max-h-52 overflow-y-auto custom-scrollbar rounded-xl border border-app-border/50">
                                        {filteredTargets.length === 0 ? (
                                            <p className="text-[11px] text-app-muted-foreground p-4 text-center">No categories found</p>
                                        ) : filteredTargets.map((cat: any) => (
                                            <button key={cat.id} onClick={() => previewMove(cat.id)}
                                                className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-[12px] font-medium text-app-foreground hover:bg-app-border/20 transition-all"
                                                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)' }}>
                                                    <Folder size={12} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold truncate">{cat.name}</p>
                                                    {cat.full_path && cat.full_path !== cat.name && (
                                                        <p className="text-[10px] text-app-muted-foreground truncate">{cat.full_path}</p>
                                                    )}
                                                </div>
                                                <ChevronRight size={13} className="text-app-muted-foreground flex-shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(moveStep === 'preview' || moveStep === 'executing') && movePreview && (
                                <div className="space-y-3">
                                    {/* Move summary — clean transfer indicator */}
                                    <div className="flex items-center gap-2 p-3 rounded-xl"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                                            border: '1px solid var(--app-border)',
                                        }}>
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)' }}>
                                                <Folder size={12} className="text-app-muted-foreground" />
                                            </div>
                                            <span className="text-[12px] font-bold text-app-foreground truncate">{categoryName}</span>
                                        </div>
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}>
                                            <ArrowRightLeft size={11} className="text-app-primary" />
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                            <span className="text-[12px] font-black text-app-primary truncate">{movePreview.target_category?.name}</span>
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}>
                                                <Folder size={12} className="text-app-primary" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* No conflicts — clean success */}
                                    {!movePreview.has_conflicts && (
                                        <div className="flex items-center gap-2.5 p-3 rounded-xl"
                                            style={{
                                                background: 'color-mix(in srgb, var(--app-success) 6%, transparent)',
                                                border: '1px solid color-mix(in srgb, var(--app-success) 15%, transparent)',
                                            }}>
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-success) 15%, transparent)' }}>
                                                <Check size={14} style={{ color: 'var(--app-success)' }} />
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-bold" style={{ color: 'var(--app-success)' }}>Ready to move</p>
                                                <p className="text-[10px] text-app-muted-foreground">All brands and attributes are compatible.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Conflicts */}
                                    {movePreview.has_conflicts && (
                                        <>
                                            {/* Warning banner */}
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                                style={{
                                                    background: 'color-mix(in srgb, var(--app-warning) 6%, transparent)',
                                                    border: '1px solid color-mix(in srgb, var(--app-warning) 12%, transparent)',
                                                }}>
                                                <AlertTriangle size={13} style={{ color: 'var(--app-warning)' }} />
                                                <p className="text-[11px] font-bold" style={{ color: 'var(--app-warning)' }}>Resolve conflicts before moving</p>
                                            </div>

                                            {/* Brand conflicts */}
                                            {movePreview.conflict_brands?.length > 0 && (
                                                <div className="rounded-xl overflow-hidden"
                                                    style={{ border: '1px solid var(--app-border)' }}>
                                                    <div className="px-3 py-2 flex items-center justify-between"
                                                        style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', borderBottom: '1px solid var(--app-border)' }}>
                                                        <div className="flex items-center gap-1.5">
                                                            <Paintbrush size={11} style={{ color: '#8b5cf6' }} />
                                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#8b5cf6' }}>
                                                                Brand Conflicts
                                                            </span>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-app-muted-foreground">
                                                            {movePreview.conflict_brands.length} to resolve
                                                        </span>
                                                    </div>
                                                    <div className="divide-y divide-app-border/30">
                                                        {movePreview.conflict_brands.map((b: any) => {
                                                            const isLinked = autoLinkBrands.has(b.id)
                                                            const isReassigned = b.id in reassignBrands
                                                            const resolved = isLinked || isReassigned
                                                            const reassignedTo = isReassigned
                                                                ? movePreview.target_brands?.find((tb: any) => tb.id === reassignBrands[b.id])?.name
                                                                : null

                                                            return (
                                                                <div key={b.id} className="px-3 py-2.5">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[12px] font-bold text-app-foreground">{b.name}</span>
                                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                                                                style={{
                                                                                    background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                                                                                    color: 'var(--app-muted-foreground)',
                                                                                }}>
                                                                                {b.affected_count} product{b.affected_count > 1 ? 's' : ''}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{
                                                                            background: resolved
                                                                                ? 'color-mix(in srgb, var(--app-success) 10%, transparent)'
                                                                                : 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                                                                            color: resolved ? 'var(--app-success)' : 'var(--app-error)',
                                                                        }}>
                                                                            {isLinked ? '✓ Will link' : isReassigned ? `→ ${reassignedTo}` : '⚠ Unresolved'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button onClick={() => {
                                                                            const next = new Set(autoLinkBrands)
                                                                            if (isLinked) { next.delete(b.id) } else { next.add(b.id) }
                                                                            setAutoLinkBrands(next)
                                                                            if (!isLinked) {
                                                                                const r = { ...reassignBrands }
                                                                                delete r[b.id]
                                                                                setReassignBrands(r)
                                                                            }
                                                                        }}
                                                                            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                                                            style={{
                                                                                background: isLinked ? 'color-mix(in srgb, var(--app-success) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                                                                color: isLinked ? 'var(--app-success)' : 'var(--app-muted-foreground)',
                                                                                border: isLinked ? '1px solid color-mix(in srgb, var(--app-success) 20%, transparent)' : '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                                                                            }}>
                                                                            <Link2 size={10} /> Link to category
                                                                        </button>
                                                                        {!isLinked && (
                                                                            movePreview.all_brands?.length > 0 ? (
                                                                                <select
                                                                                    value={isReassigned ? String(reassignBrands[b.id]) : ''}
                                                                                    onChange={e => {
                                                                                        const val = e.target.value
                                                                                        if (val) {
                                                                                            setReassignBrands({ ...reassignBrands, [b.id]: Number(val) })
                                                                                            const next = new Set(autoLinkBrands)
                                                                                            next.delete(b.id)
                                                                                            setAutoLinkBrands(next)
                                                                                        } else {
                                                                                            const r = { ...reassignBrands }
                                                                                            delete r[b.id]
                                                                                            setReassignBrands(r)
                                                                                        }
                                                                                    }}
                                                                                    className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-app-background text-app-foreground outline-none flex-1 min-w-0 transition-all"
                                                                                    style={{
                                                                                        border: isReassigned
                                                                                            ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)'
                                                                                            : '1px solid color-mix(in srgb, var(--app-error) 40%, transparent)',
                                                                                        color: isReassigned ? 'var(--app-primary)' : undefined,
                                                                                        animation: !isReassigned ? 'pulse 2s ease-in-out infinite' : 'none',
                                                                                    }}>
                                                                                    <option value="">⚠ Reassign to brand...</option>
                                                                                    {movePreview.all_brands
                                                                                        .filter((tb: any) => tb.id !== b.id)
                                                                                        .map((tb: any) => (
                                                                                            <option key={tb.id} value={String(tb.id)}>{tb.name}</option>
                                                                                        ))}
                                                                                </select>
                                                                            ) : (
                                                                                <span className="text-[9px] font-bold px-2 py-1 rounded-lg"
                                                                                    style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)' }}>
                                                                                    No brands available — must link
                                                                                </span>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {movePreview.conflict_attributes?.length > 0 && (
                                                <div className="rounded-xl overflow-hidden"
                                                    style={{ border: '1px solid var(--app-border)' }}>
                                                    <div className="px-3 py-2 flex items-center justify-between"
                                                        style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', borderBottom: '1px solid var(--app-border)' }}>
                                                        <div className="flex items-center gap-1.5">
                                                            <Tag size={11} style={{ color: 'var(--app-warning)' }} />
                                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-warning)' }}>
                                                                Attribute Conflicts
                                                            </span>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-app-muted-foreground">
                                                            {movePreview.conflict_attributes.length} to resolve
                                                        </span>
                                                    </div>
                                                    <div className="divide-y divide-app-border/30">
                                                        {movePreview.conflict_attributes.map((a: any) => {
                                                            const isLinked = autoLinkAttrs.has(a.id)
                                                            const isReassigned = a.id in reassignAttrs
                                                            const resolved = isLinked || isReassigned
                                                            const reassignedTo = isReassigned
                                                                ? movePreview.all_attributes?.find((ta: any) => ta.id === reassignAttrs[a.id])?.name
                                                                : null

                                                            return (
                                                                <div key={a.id} className="px-3 py-2.5">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[12px] font-bold text-app-foreground">{a.name}</span>
                                                                            {a.code && <span className="text-[10px] font-mono text-app-muted-foreground">{a.code}</span>}
                                                                        </div>
                                                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{
                                                                            background: resolved
                                                                                ? 'color-mix(in srgb, var(--app-success) 10%, transparent)'
                                                                                : 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                                                                            color: resolved ? 'var(--app-success)' : 'var(--app-error)',
                                                                        }}>
                                                                            {isLinked ? '✓ Will link' : isReassigned ? `→ ${reassignedTo}` : '⚠ Unresolved'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button onClick={() => {
                                                                            const next = new Set(autoLinkAttrs)
                                                                            if (isLinked) { next.delete(a.id) } else { next.add(a.id) }
                                                                            setAutoLinkAttrs(next)
                                                                            if (!isLinked) {
                                                                                const r = { ...reassignAttrs }
                                                                                delete r[a.id]
                                                                                setReassignAttrs(r)
                                                                            }
                                                                        }}
                                                                            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                                                            style={{
                                                                                background: isLinked ? 'color-mix(in srgb, var(--app-success) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                                                                color: isLinked ? 'var(--app-success)' : 'var(--app-muted-foreground)',
                                                                                border: isLinked ? '1px solid color-mix(in srgb, var(--app-success) 20%, transparent)' : '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                                                                            }}>
                                                                            <Link2 size={10} /> Link to category
                                                                        </button>
                                                                        {!isLinked && (
                                                                            movePreview.all_attributes?.length > 0 ? (
                                                                                <select
                                                                                    value={isReassigned ? String(reassignAttrs[a.id]) : ''}
                                                                                    onChange={e => {
                                                                                        const val = e.target.value
                                                                                        if (val) {
                                                                                            setReassignAttrs({ ...reassignAttrs, [a.id]: Number(val) })
                                                                                            const next = new Set(autoLinkAttrs)
                                                                                            next.delete(a.id)
                                                                                            setAutoLinkAttrs(next)
                                                                                        } else {
                                                                                            const r = { ...reassignAttrs }
                                                                                            delete r[a.id]
                                                                                            setReassignAttrs(r)
                                                                                        }
                                                                                    }}
                                                                                    className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-app-background text-app-foreground outline-none flex-1 min-w-0 transition-all"
                                                                                    style={{
                                                                                        border: isReassigned
                                                                                            ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)'
                                                                                            : '1px solid color-mix(in srgb, var(--app-error) 40%, transparent)',
                                                                                        color: isReassigned ? 'var(--app-primary)' : undefined,
                                                                                        animation: !isReassigned ? 'pulse 2s ease-in-out infinite' : 'none',
                                                                                    }}>
                                                                                    <option value="">⚠ Reassign to attribute...</option>
                                                                                    {movePreview.all_attributes
                                                                                        .filter((ta: any) => ta.id !== a.id)
                                                                                        .map((ta: any) => (
                                                                                            <option key={ta.id} value={String(ta.id)}>{ta.name}</option>
                                                                                        ))}
                                                                                </select>
                                                                            ) : (
                                                                                <span className="text-[9px] font-bold px-2 py-1 rounded-lg"
                                                                                    style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)' }}>
                                                                                    No attributes available — must link
                                                                                </span>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Loading state for preview */}
                            {moveStep === 'preview' && !movePreview && (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin text-app-primary" />
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {(moveStep === 'preview' || moveStep === 'executing') && movePreview && (() => {
                            // Enforce: every conflict brand must be linked OR reassigned
                            const unresolvedBrands = (movePreview.conflict_brands || []).filter((b: any) =>
                                !autoLinkBrands.has(b.id) && !(b.id in reassignBrands)
                            )
                            // Enforce: every conflict attribute must be linked
                            const unresolvedAttrs = (movePreview.conflict_attributes || []).filter((a: any) =>
                                !autoLinkAttrs.has(a.id) && !(a.id in reassignAttrs)
                            )
                            const hasUnresolved = unresolvedBrands.length > 0 || unresolvedAttrs.length > 0
                            const canMove = !hasUnresolved && moveStep !== 'executing'

                            return (
                                <div className="px-5 py-3 space-y-2"
                                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, var(--app-surface))' }}>
                                    {hasUnresolved && (
                                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                                            style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 15%, transparent)' }}>
                                            <AlertTriangle size={12} style={{ color: 'var(--app-error)' }} />
                                            <p className="text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>
                                                {unresolvedBrands.length > 0 && `${unresolvedBrands.length} brand${unresolvedBrands.length > 1 ? 's' : ''} must be linked or reassigned`}
                                                {unresolvedBrands.length > 0 && unresolvedAttrs.length > 0 && ' · '}
                                                {unresolvedAttrs.length > 0 && `${unresolvedAttrs.length} attribute${unresolvedAttrs.length > 1 ? 's' : ''} must be linked`}
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setMoveStep('picking'); setMovePreview(null) }}
                                            className="flex-1 text-[12px] font-bold py-2 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-border/30 transition-all">
                                            ← Back
                                        </button>
                                        <button onClick={executeMove} disabled={!canMove}
                                            className="flex-[2] flex items-center justify-center gap-2 text-[12px] font-bold bg-app-primary text-white py-2 rounded-xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            style={{ boxShadow: canMove ? '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' : 'none' }}>
                                            {moveStep === 'executing' ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                                            {moveStep === 'executing' ? 'Moving...' : `Move ${selected.size} Product${selected.size > 1 ? 's' : ''}`}
                                        </button>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            )}
        </div>
    )
}

/* ── Brands Tab ── */
function PanelBrandsTab({ categoryId, categoryName }: { categoryId: number; categoryName: string }) {
    const [linkedBrands, setLinkedBrands] = useState<any[]>([])
    const [allBrands, setAllBrands] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [showLink, setShowLink] = useState(false)
    const [conflict, setConflict] = useState<any>(null)
    const router = useRouter()

    const loadData = useCallback(() => {
        setLoading(true)
        erpFetch(`inventory/categories/${categoryId}/linked_brands/`)
            .then((data: any) => {
                setLinkedBrands(Array.isArray(data?.linked) ? data.linked : [])
                setAllBrands(Array.isArray(data?.all) ? data.all : [])
                setLoading(false)
            }).catch(() => setLoading(false))
    }, [categoryId])

    useEffect(() => { loadData() }, [loadData])

    const linkedIds = useMemo(() => new Set(linkedBrands.map(b => b.id)), [linkedBrands])
    const unlinkedBrands = allBrands.filter(b => !linkedIds.has(b.id))

    const linkBrand = async (brandId: number) => {
        // Optimistic: immediately show in linked list
        const brandObj = allBrands.find(b => b.id === brandId)
        if (brandObj) {
            setLinkedBrands(prev => [...prev, { ...brandObj, product_count: 0, source: 'explicit' }])
        }
        try {
            await erpFetch(`inventory/categories/${categoryId}/link_brand/`, {
                method: 'POST',
                body: JSON.stringify({ brand_id: brandId }),
            })
            toast.success('Brand pre-registered')
            loadData() // Sync with server
        } catch (e: any) {
            toast.error(e?.message || 'Failed to link')
            loadData() // Rollback
        }
    }

    const unlinkBrand = async (brandId: number) => {
        setLinking(true)
        setConflict(null)
        try {
            await erpFetch(`inventory/categories/${categoryId}/unlink_brand/`, {
                method: 'POST',
                body: JSON.stringify({ brand_id: brandId }),
            })
            // Optimistic: remove from list instantly
            setLinkedBrands(prev => prev.filter(b => b.id !== brandId))
            toast.success('Brand unlinked')
            loadData()
        } catch (e: any) {
            const conflictData = e?.data || e
            if (conflictData?.error === 'conflict' && conflictData?.products) {
                setConflict({ ...conflictData, _brandId: brandId })
            } else {
                toast.error(e?.message || 'Failed to unlink')
            }
        }
        finally { setLinking(false) }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-[10px] font-bold text-app-muted-foreground">
                    {loading ? 'Loading...' : `${linkedBrands.length} brand${linkedBrands.length !== 1 ? 's' : ''} linked`}
                </p>
                <button onClick={() => setShowLink(!showLink)}
                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all"
                    style={showLink ? {
                        background: 'color-mix(in srgb, #8b5cf6 10%, transparent)',
                        color: '#8b5cf6',
                    } : {
                        color: 'var(--app-muted-foreground)',
                    }}>
                    <Plus size={11} /> Pre-register
                </button>
            </div>

            {showLink && (
                <div className="flex-shrink-0 px-4 py-2.5 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, #8b5cf6 3%, var(--app-surface))' }}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">
                        Available ({unlinkedBrands.length})
                    </p>
                    {unlinkedBrands.length === 0 ? (
                        <p className="text-[11px] text-app-muted-foreground">All brands are already linked.</p>
                    ) : (
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                            {unlinkedBrands.map(b => (
                                <button key={b.id} onClick={() => linkBrand(b.id)} disabled={linking}
                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
                                    style={{ background: 'color-mix(in srgb, #8b5cf6 8%, transparent)', color: '#8b5cf6', border: '1px solid color-mix(in srgb, #8b5cf6 15%, transparent)' }}>
                                    <Plus size={9} />{b.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Conflict Dialog — shows affected products with inline brand reassignment */}
            {conflict && (
                <div className="flex-shrink-0 px-4 py-3 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-error) 4%, var(--app-surface))' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} style={{ color: 'var(--app-error)' }} />
                        <span className="text-[11px] font-black text-app-error">Cannot Unlink — {conflict.affected_count} product{conflict.affected_count !== 1 ? 's' : ''} affected</span>
                    </div>
                    <p className="text-[10px] text-app-muted-foreground mb-2">{conflict.message}</p>

                    {/* Bulk reassign all to one brand */}
                    <div className="flex items-center gap-2 mb-2 py-1.5 px-2 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                        <span className="text-[10px] font-bold text-app-foreground whitespace-nowrap">Reassign all to:</span>
                        <select
                            id="bulk-brand-select"
                            className="flex-1 text-[10px] font-bold rounded-md px-2 py-1 bg-transparent border border-app-border text-app-foreground"
                            defaultValue="">
                            <option value="" disabled>Select brand...</option>
                            {allBrands
                                .filter(b => b.id !== conflict._brandId)
                                .map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <button
                            onClick={async () => {
                                const sel = document.getElementById('bulk-brand-select') as HTMLSelectElement
                                const newBrandId = parseInt(sel?.value)
                                if (!newBrandId) { toast.error('Select a target brand'); return }
                                setLinking(true)
                                let ok = 0
                                for (const p of conflict.products || []) {
                                    try {
                                        await erpFetch(`inventory/products/${p.id}/`, {
                                            method: 'PATCH',
                                            body: JSON.stringify({ brand: newBrandId }),
                                        })
                                        ok++
                                    } catch { /* skip */ }
                                }
                                toast.success(`${ok} product${ok !== 1 ? 's' : ''} reassigned`)
                                setConflict(null)
                                setLinking(false)
                                loadData()
                            }}
                            disabled={linking}
                            className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            {linking ? 'Working...' : 'Reassign All'}
                        </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                        {(conflict.products || []).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 text-[10px] py-1.5 px-2 rounded-lg"
                                style={{ background: 'color-mix(in srgb, var(--app-error) 4%, transparent)' }}>
                                <span className="font-mono font-bold text-app-muted-foreground flex-shrink-0">{p.sku}</span>
                                <span className="font-bold text-app-foreground truncate flex-1">{p.name}</span>
                                <select
                                    id={`brand-sel-${p.id}`}
                                    className="text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-transparent border border-app-border text-app-foreground max-w-[100px]"
                                    defaultValue="">
                                    <option value="" disabled>Brand...</option>
                                    {allBrands
                                        .filter(b => b.id !== conflict._brandId)
                                        .map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <button
                                    onClick={async () => {
                                        const sel = document.getElementById(`brand-sel-${p.id}`) as HTMLSelectElement
                                        const newBrandId = parseInt(sel?.value)
                                        if (!newBrandId) { toast.error('Select a brand'); return }
                                        try {
                                            await erpFetch(`inventory/products/${p.id}/`, {
                                                method: 'PATCH',
                                                body: JSON.stringify({ brand: newBrandId }),
                                            })
                                            toast.success(`${p.name} reassigned`)
                                            // Remove from conflict list
                                            setConflict((prev: any) => {
                                                if (!prev) return null
                                                const remaining = prev.products.filter((x: any) => x.id !== p.id)
                                                if (remaining.length === 0) {
                                                    loadData()
                                                    return null
                                                }
                                                return { ...prev, products: remaining, affected_count: remaining.length }
                                            })
                                        } catch (e: any) { toast.error(e?.message || 'Failed to reassign') }
                                    }}
                                    className="text-[9px] font-black px-1.5 py-0.5 rounded transition-all flex-shrink-0"
                                    style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    ✓
                                </button>
                            </div>
                        ))}
                        {conflict.affected_count > 20 && (
                            <p className="text-[10px] font-bold text-app-muted-foreground px-2">...and {conflict.affected_count - 20} more</p>
                        )}
                    </div>
                    <button onClick={() => setConflict(null)}
                        className="mt-2 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all">
                        Dismiss
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: '#8b5cf6' }} /></div>
                ) : linkedBrands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Paintbrush size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">No brands linked</p>
                        <p className="text-[11px] text-app-muted-foreground mt-1">
                            Brands appear automatically when products use them.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {linkedBrands.map((b: any) => (
                            <div key={b.id} className="flex items-center gap-3 px-4 py-2 group transition-all hover:bg-app-surface/50">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, #8b5cf6 10%, transparent)', color: '#8b5cf6' }}>
                                    <Paintbrush size={12} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[12px] font-bold text-app-foreground truncate">{b.name}</p>
                                        <span className="text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                                            style={b.source === 'auto' || b.source === 'both' ? {
                                                background: 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                                                color: 'var(--app-success)',
                                            } : {
                                                background: 'color-mix(in srgb, #8b5cf6 10%, transparent)',
                                                color: '#8b5cf6',
                                            }}>
                                            {b.source === 'auto' ? 'AUTO' : b.source === 'both' ? 'AUTO' : 'PRE-REG'}
                                        </span>
                                    </div>
                                    {b.product_count != null && (
                                        <p className="text-[10px] font-bold text-app-muted-foreground">{b.product_count} product{b.product_count !== 1 ? 's' : ''}</p>
                                    )}
                                </div>
                                {/* Unlink available on ALL brands — conflict dialog protects data */}
                                <button onClick={() => unlinkBrand(b.id)} disabled={linking}
                                    className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                                    style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)' }}>
                                    <Unlink size={10} />Unlink
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

/* ── Attributes Tab — fetches attribute groups linked to this category ── */
function PanelAttributesTab({ categoryId, categoryName }: { categoryId: number; categoryName: string }) {
    const [linkedAttrs, setLinkedAttrs] = useState<any[]>([])
    const [allAttrs, setAllAttrs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [showLink, setShowLink] = useState(false)
    const [conflict, setConflict] = useState<any>(null)
    const router = useRouter()

    const loadData = useCallback(() => {
        setLoading(true)
        erpFetch(`inventory/categories/${categoryId}/linked_attributes/`)
            .then((data: any) => {
                setLinkedAttrs(Array.isArray(data?.linked) ? data.linked : [])
                setAllAttrs(Array.isArray(data?.all) ? data.all : [])
                setLoading(false)
            }).catch(() => setLoading(false))
    }, [categoryId])

    useEffect(() => { loadData() }, [loadData])

    const linkedIds = useMemo(() => new Set(linkedAttrs.map(a => a.id)), [linkedAttrs])
    const unlinkedAttrs = allAttrs.filter(a => !linkedIds.has(a.id))

    const linkAttr = async (attrId: number) => {
        // Optimistic: immediately show in linked list
        const attrObj = allAttrs.find(a => a.id === attrId)
        if (attrObj) {
            setLinkedAttrs(prev => [...prev, { ...attrObj, source: 'explicit' }])
        }
        try {
            await erpFetch(`inventory/categories/${categoryId}/link_attribute/`, {
                method: 'POST',
                body: JSON.stringify({ attribute_id: attrId }),
            })
            toast.success('Attribute pre-registered')
            loadData()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to link')
            loadData()
        }
    }

    const unlinkAttr = async (attrId: number) => {
        setLinking(true)
        setConflict(null)
        try {
            await erpFetch(`inventory/categories/${categoryId}/unlink_attribute/`, {
                method: 'POST',
                body: JSON.stringify({ attribute_id: attrId }),
            })
            // Optimistic: remove from list instantly
            setLinkedAttrs(prev => prev.filter(a => a.id !== attrId))
            toast.success('Attribute unlinked')
            loadData()
        } catch (e: any) {
            const conflictData = e?.data || e
            if (conflictData?.error === 'conflict' && conflictData?.products) {
                setConflict(conflictData)
            } else {
                toast.error(e?.message || 'Failed to unlink')
            }
        }
        finally { setLinking(false) }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-[10px] font-bold text-app-muted-foreground">
                    {loading ? 'Loading...' : `${linkedAttrs.length} attribute group${linkedAttrs.length !== 1 ? 's' : ''} linked`}
                </p>
                <button onClick={() => setShowLink(!showLink)}
                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all"
                    style={showLink ? {
                        background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)',
                        color: 'var(--app-warning)',
                    } : {
                        color: 'var(--app-muted-foreground)',
                    }}>
                    <Plus size={11} /> Pre-register
                </button>
            </div>

            {showLink && (
                <div className="flex-shrink-0 px-4 py-2.5 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-warning) 3%, var(--app-surface))' }}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">
                        Available ({unlinkedAttrs.length})
                    </p>
                    {unlinkedAttrs.length === 0 ? (
                        <p className="text-[11px] text-app-muted-foreground">All attribute groups are already linked.</p>
                    ) : (
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                            {unlinkedAttrs.map(a => (
                                <button key={a.id} onClick={() => linkAttr(a.id)} disabled={linking}
                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
                                    style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)' }}>
                                    <Plus size={9} />{a.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Conflict Dialog — shows affected products with edit access */}
            {conflict && (
                <div className="flex-shrink-0 px-4 py-3 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-error) 4%, var(--app-surface))' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} style={{ color: 'var(--app-error)' }} />
                        <span className="text-[11px] font-black text-app-error">
                            Cannot Unlink — {conflict.affected_count} product{conflict.affected_count !== 1 ? 's' : ''} affected
                        </span>
                        {conflict.barcode_count > 0 && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                                style={{ background: 'color-mix(in srgb, var(--app-error) 12%, transparent)', color: 'var(--app-error)' }}>
                                🔒 {conflict.barcode_count} with barcodes
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-app-muted-foreground mb-2">
                        {conflict.message} Open each product to reassign its attribute values.
                    </p>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                        {(conflict.products || []).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 text-[10px] py-1.5 px-2 rounded-lg"
                                style={{ background: 'color-mix(in srgb, var(--app-error) 4%, transparent)' }}>
                                <span className="font-mono font-bold text-app-muted-foreground flex-shrink-0">{p.sku}</span>
                                <span className="font-bold text-app-foreground truncate flex-1">{p.name}</span>
                                {p.has_barcode && (
                                    <span className="text-[8px] font-black px-1 py-0.5 rounded flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>
                                        BARCODE
                                    </span>
                                )}
                                <button
                                    onClick={() => {
                                        window.open(`/inventory/products/${p.id}`, '_blank')
                                    }}
                                    className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded transition-all flex-shrink-0"
                                    style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    <Pencil size={9} /> Edit
                                </button>
                            </div>
                        ))}
                        {conflict.affected_count > 20 && (
                            <p className="text-[10px] font-bold text-app-muted-foreground px-2">...and {conflict.affected_count - 20} more</p>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => { setConflict(null); loadData() }}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            Refresh & Retry
                        </button>
                        <button onClick={() => setConflict(null)}
                            className="text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all">
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-warning)' }} /></div>
                ) : linkedAttrs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Tag size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">No attribute groups linked</p>
                        <p className="text-[11px] text-app-muted-foreground mt-1">
                            Attribute groups appear automatically when products use them.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {linkedAttrs.map((group: any) => (
                            <div key={group.id} className="flex items-center gap-3 px-4 py-2.5 group transition-all hover:bg-app-surface/50">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>
                                    <Tag size={12} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[12px] font-bold text-app-foreground truncate">{group.name}</p>
                                        <span className="text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                                            style={group.source === 'auto' || group.source === 'both' ? {
                                                background: 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                                                color: 'var(--app-success)',
                                            } : {
                                                background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)',
                                                color: 'var(--app-warning)',
                                            }}>
                                            {group.source === 'auto' ? 'AUTO' : group.source === 'both' ? 'AUTO' : 'PRE-REG'}
                                        </span>
                                    </div>
                                    {group.code && <p className="text-[10px] font-mono font-bold text-app-muted-foreground">{group.code}</p>}
                                </div>
                                {/* Unlink available on ALL attributes — conflict dialog protects data */}
                                <button onClick={() => unlinkAttr(group.id)} disabled={linking}
                                    className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                                    style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)' }}>
                                    <Unlink size={10} />Unlink
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export function CategoriesClient({ initialCategories }: { initialCategories: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [modalState, setModalState] = useState<{ open: boolean; category?: CategoryNode; parentId?: number }>({ open: false })
    const [searchQuery, setSearchQuery] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const [splitPanel, setSplitPanel] = useState(false)
    const [pinnedSidebar, setPinnedSidebar] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<CategoryNode | null>(null)
    const [panelTab, setPanelTab] = useState<PanelTab>('overview')
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)
    const [expandKey, setExpandKey] = useState(0)
    const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null)
    const [productsTarget, setProductsTarget] = useState<CategoryNode | null>(null)
    const [brandsTarget, setBrandsTarget] = useState<CategoryNode | null>(null)
    // Right sidebar drawer (tree-only mode)
    const [sidebarNode, setSidebarNode] = useState<CategoryNode | null>(null)
    const [sidebarTab, setSidebarTab] = useState<PanelTab>('overview')
    const searchRef = useRef<HTMLInputElement>(null)
    const data = initialCategories

    // ── Tour system ── 
    const { start: startTour } = usePageTour('inventory-categories')

    // Keyboard shortcuts: Cmd+K (search), Ctrl+Q (focus mode)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Build tree with search filter
    const { tree, stats } = useMemo(() => {
        let filtered = data

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(a =>
                a.name?.toLowerCase().includes(q) ||
                a.code?.toLowerCase().includes(q) ||
                a.short_name?.toLowerCase().includes(q)
            )
        }

        const builtTree = buildTree(filtered)

        const leafCount = filtered.filter(d => !filtered.some(c => c.parent === d.id)).length
        const totalProducts = filtered.reduce((sum: number, d: any) => sum + (d.product_count || 0), 0)
        const totalBrands = filtered.reduce((sum: number, d: any) => sum + (d.brand_count || 0), 0)

        return {
            tree: builtTree,
            stats: { total: data.length, filtered: filtered.length, roots: builtTree.length, leafCount, totalProducts, totalBrands }
        }
    }, [data, searchQuery])

    // Interactive tour step actions (must be after tree is defined)
    const tourStepActions = useMemo(() => ({
        5: () => { setExpandAll(true); setExpandKey(k => k + 1) },
        6: () => { const n = tree[0]; if (n) { setSidebarNode(n); setSidebarTab('overview') } },
        8: () => { setSidebarTab('brands') },
        9: () => { setSidebarTab('attributes') },
        10: () => { setSidebarTab('products') },
        11: () => { setSidebarNode(null) },
    }), [tree])


    // Actions
    const openAddModal = useCallback((parentId?: number) => { setModalState({ open: true, parentId }) }, [])
    const openEditModal = useCallback((cat: CategoryNode) => { setModalState({ open: true, category: cat }) }, [])
    const requestDelete = useCallback((cat: CategoryNode) => { setDeleteTarget(cat) }, [])

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        startTransition(async () => {
            const result = await deleteCategory(deleteTarget.id)
            if (result?.success) {
                toast.success(`"${deleteTarget.name}" deleted`)
                router.refresh()
            } else {
                toast.error(result?.message || 'Failed to delete')
            }
            setDeleteTarget(null)
        })
    }

    const closeModal = useCallback(() => { setModalState({ open: false }) }, [])

    return (
        <div className="flex flex-col p-4 md:px-6 md:pt-6 md:pb-2 animate-in fade-in duration-300 transition-all overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)', paddingRight: pinnedSidebar ? '34rem' : undefined }}>

            {/* ═══════════════ HEADER ═══════════════ */}
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {focusMode ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}>
                                <FolderTree size={14} style={{ color: '#fff' }} />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Categories</span>
                            <span className="text-[10px] font-bold text-app-muted-foreground">{stats.filtered}/{stats.total}</span>
                        </div>

                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                        </div>

                        <button onClick={() => openAddModal()}
                            className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
                            <Plus size={12} /><span className="hidden sm:inline">New</span>
                        </button>

                        <button onClick={() => setFocusMode(false)} title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Action Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <FolderTree size={20} className="text-white" />
                                </div>
                                <div data-tour="page-title">
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Categories</h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        {stats.total} Nodes · Hierarchical Tree
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <TourTriggerButton onClick={startTour} />
                                <Link
                                    href="/inventory/maintenance?tab=category"
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Wrench size={13} />
                                    <span className="hidden md:inline">Cleanup</span>
                                </Link>
                                {/* Split Panel toggle */}
                                <button
                                    data-tour="split-panel-btn"
                                    onClick={() => { setSplitPanel(p => !p); if (splitPanel) setSelectedCategory(null) }}
                                    title={splitPanel ? 'Exit split panel' : 'Split panel view'}
                                    className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all"
                                    style={splitPanel ? {
                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                        color: 'var(--app-primary)',
                                        borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                    } : {
                                        color: 'var(--app-muted-foreground)',
                                        borderColor: 'var(--app-border)',
                                    }}
                                >
                                    {splitPanel ? <PanelLeftClose size={13} /> : <LayoutPanelLeft size={13} />}
                                    <span className="hidden md:inline">{splitPanel ? 'Tree Only' : 'Split Panel'}</span>
                                </button>
                                <button
                                    data-tour="add-category-btn"
                                    onClick={() => openAddModal()}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                >
                                    <Plus size={14} />
                                    <span className="hidden sm:inline">New Category</span>
                                </button>
                                <button onClick={() => setFocusMode(true)} title="Focus mode (Ctrl+Q)"
                                    className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* KPI Strip — adaptive auto-fit grid */}
                        <div data-tour="kpi-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                            {[
                                { label: 'Total', value: stats.total, icon: <Layers size={11} />, color: 'var(--app-primary)' },
                                { label: 'Root', value: stats.roots, icon: <FolderTree size={11} />, color: 'var(--app-success)' },
                                { label: 'Leaf', value: stats.leafCount, icon: <GitBranch size={11} />, color: '#8b5cf6' },
                                { label: 'Products', value: stats.totalProducts, icon: <Box size={11} />, color: 'var(--app-info)' },
                                { label: 'Brands', value: stats.totalBrands, icon: <Paintbrush size={11} />, color: 'var(--app-warning)' },
                                { label: 'Showing', value: stats.filtered, icon: <Search size={11} />, color: 'var(--app-muted-foreground)' },
                            ].map(s => (
                                <div key={s.label}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}
                                >
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                        {s.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Search Bar */}
                        <div className="flex items-center gap-2" data-tour="search-bar">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search by name, code, or short name... (Ctrl+K)"
                                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                            </div>

                            <button
                                onClick={() => { setExpandAll(prev => !prev); setExpandKey(k => k + 1) }}
                                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl border transition-all flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                    color: 'var(--app-primary)',
                                    borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}
                            >
                                {expandAll ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                                <span className="hidden sm:inline">{expandAll ? 'Collapse' : 'Expand'}</span>
                            </button>

                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')}
                                    className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══════════════ MODALS ═══════════════ */}
            <CategoryFormModal
                isOpen={modalState.open}
                onClose={closeModal}
                category={modalState.category}
                parentId={modalState.parentId}
                potentialParents={data}
            />

            {/* ── Guided Tour (interactive) ── */}
            <GuidedTour tourId="inventory-categories" stepActions={tourStepActions} />

            {productsTarget && (
                <ProductsPopup category={productsTarget} onClose={() => setProductsTarget(null)} />
            )}

            {brandsTarget && (
                <BrandsPopup category={brandsTarget} onClose={() => setBrandsTarget(null)} />
            )}

            {/* ═══════════════ TREE TABLE ═══════════════ */}
            <div className={`flex-1 min-h-0 flex gap-3 ${splitPanel ? 'flex-row' : 'flex-col'} animate-in fade-in duration-200`}>

                {/* Left: Tree */}
                <div data-tour="category-tree" className={`${splitPanel ? 'flex-[4] min-w-0' : 'flex-1'} min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col transition-all duration-300`}>
                    {/* Column Headers */}
                    <div className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 text-[9px] font-black text-app-muted-foreground uppercase tracking-widest"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                            borderBottom: '2px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                        }}>
                        <div className="w-5 flex-shrink-0" />
                        <div className="w-7 flex-shrink-0" />
                        <div className="flex-1 min-w-0">Category</div>
                        <div className="hidden sm:block w-12 flex-shrink-0 text-center">Sub</div>
                        <div className="hidden sm:block w-14 flex-shrink-0 text-center" style={{ color: '#8b5cf6' }}>Brands</div>
                        <div className="hidden sm:block w-12 flex-shrink-0 text-center" style={{ color: 'var(--app-warning)' }}>Attrs</div>
                        <div className="hidden sm:block w-14 flex-shrink-0 text-center" style={{ color: 'var(--app-success)' }}>Products</div>
                        <div className="w-[68px] flex-shrink-0" />
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                        {tree.length > 0 ? (
                            tree.map((node) => (
                                <div key={`${node.id}-${expandKey}`}
                                    className={`
                                        rounded-xl transition-all duration-300
                                        ${((splitPanel || pinnedSidebar) ? selectedCategory?.id === node.id : sidebarNode?.id === node.id) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}
                                    `}
                                >
                                    <CategoryRow
                                        node={node}
                                        level={0}
                                        onEdit={openEditModal}
                                        onAdd={openAddModal}
                                        onDelete={requestDelete}
                                        onSelect={(n) => {
                                            if (splitPanel || pinnedSidebar) {
                                                setSelectedCategory(n)
                                            } else {
                                                setSidebarNode(n)
                                                setSidebarTab('overview')
                                            }
                                        }}
                                        onViewProducts={(n) => {
                                            if (splitPanel || pinnedSidebar) {
                                                setSelectedCategory(n)
                                                setPanelTab('products')
                                            } else {
                                                setSidebarNode(n)
                                                setSidebarTab('products')
                                            }
                                        }}
                                        onViewBrands={(n) => {
                                            if (splitPanel || pinnedSidebar) {
                                                setSelectedCategory(n)
                                                setPanelTab('brands')
                                            } else {
                                                setSidebarNode(n)
                                                setSidebarTab('brands')
                                            }
                                        }}
                                        onViewAttributes={(n) => {
                                            if (splitPanel || pinnedSidebar) {
                                                setSelectedCategory(n)
                                                setPanelTab('attributes')
                                            } else {
                                                setSidebarNode(n)
                                                setSidebarTab('attributes')
                                            }
                                        }}
                                        searchQuery={searchQuery}
                                        forceExpanded={expandAll}
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                <FolderTree size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                                <p className="text-sm font-bold text-app-muted-foreground mb-1">
                                    {searchQuery ? 'No matching categories' : 'No categories defined yet'}
                                </p>
                                <p className="text-[11px] text-app-muted-foreground mb-5 max-w-xs">
                                    {searchQuery ? 'Try a different search term or clear filters.' : 'Create a root category to start organizing your product catalog.'}
                                </p>
                                {!searchQuery && (
                                    <button onClick={() => openAddModal()}
                                        className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold hover:brightness-110 transition-all"
                                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                        <Plus size={16} className="inline mr-1.5" />Create First Category
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
            </div>

            {/* ═══════════════ INLINE SPLIT PANEL (Split Panel button) ═══════════════ */}
            {splitPanel && (
                <div className="flex-[6] min-w-0 min-h-0 border border-app-border/50 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
                    {selectedCategory ? (
                        <CategoryDetailPanel
                            node={selectedCategory}
                            onEdit={openEditModal}
                            onAdd={openAddModal}
                            onDelete={requestDelete}
                            allCategories={data}
                            initialTab={panelTab}
                            onClose={() => setSelectedCategory(null)}
                            onPin={() => {
                                setSplitPanel(false)
                                setPinnedSidebar(true)
                                toast.success('Sidebar Pinned')
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center"
                            style={{ background: 'var(--app-surface)' }}>
                            <LayoutPanelLeft size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">Select a category</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">
                                Click any row to view details in split view.
                            </p>
                        </div>
                    )}
                </div>
            )}
            </div>

            {/* ═══════════════ PINNED SIDEBAR (fixed, same as drawer but no backdrop) ═══════════════ */}
            {pinnedSidebar && (
                <div className="fixed top-0 right-0 z-[90] w-full max-w-lg h-full flex flex-col animate-in slide-in-from-right-4 duration-300 shadow-2xl"
                    style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>
                    {selectedCategory ? (
                        <CategoryDetailPanel
                            node={selectedCategory}
                            onEdit={openEditModal}
                            onAdd={openAddModal}
                            onDelete={requestDelete}
                            allCategories={data}
                            initialTab={panelTab}
                            onClose={() => { setPinnedSidebar(false); setSelectedCategory(null) }}
                            onPin={() => { setPinnedSidebar(false); setSelectedCategory(null) }}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                            <LayoutPanelLeft size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">Select a category</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">
                                Click any row to view details here.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════ MODAL DRAWER (Standard Mode) ═══════════════ */}
            {sidebarNode && !splitPanel && !pinnedSidebar && (
                <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-200"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', backdropFilter: 'blur(4px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setSidebarNode(null) }}>
                    <div data-tour="detail-drawer" className="w-full max-w-lg h-full flex flex-col animate-in slide-in-from-right-4 duration-300 shadow-2xl"
                        style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>
                        <CategoryDetailPanel
                            node={sidebarNode}
                            onEdit={openEditModal}
                            onAdd={openAddModal}
                            onDelete={requestDelete}
                            allCategories={data}
                            initialTab={sidebarTab}
                            onClose={() => setSidebarNode(null)}
                            onPin={(node) => {
                                setSelectedCategory(node)
                                setPanelTab(sidebarTab)
                                setPinnedSidebar(true)
                                setSidebarNode(null)
                                toast.success('Sidebar Pinned')
                            }}
                        />
                    </div>
                </div>
            )}

            {/* ── Footer ──────────────────────────────────────── */}
            <div
                className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-[11px] font-bold rounded-b-2xl animate-in slide-in-from-bottom-2 duration-300"
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
                    <span>{stats.total} total categories</span>
                    <span style={{ color: 'var(--app-border)' }}>·</span>
                    <span>{stats.totalProducts.toLocaleString()} linked products</span>
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
                <div className="tabular-nums font-black" style={{ color: 'var(--app-foreground)' }}>
                    System Status: <span style={{ color: 'var(--app-success)' }}>Operational</span>
                </div>
            </div>

            {/* ── Delete Confirm ── */}
            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleConfirmDelete}
                title={`Delete "${deleteTarget?.name}"?`}
                description="This will permanently remove this category. Make sure it has no products assigned."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    )
}
