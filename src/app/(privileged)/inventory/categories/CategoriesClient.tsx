'use client'

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react'
import {
    ChevronRight, ChevronDown, Plus, Folder, FolderOpen,
    Pencil, X, Search, FolderTree,
    Trash2, Layers, Box, GitBranch,
    Maximize2, Minimize2, ChevronsUpDown, ChevronsDownUp, Bookmark, AlertCircle, Wrench,
    Package, Paintbrush, Link2, Unlink, Loader2, ExternalLink, LayoutPanelLeft, PanelLeftClose,
    Hash, Tag, ChevronUp, Info, ArrowRightLeft, Check, AlertTriangle, SlidersHorizontal
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteCategory } from '@/app/actions/inventory/categories'
import { buildTree } from '@/lib/utils/tree'
import { CategoryFormModal } from '@/components/admin/categories/CategoryFormModal'
import { erpFetch } from '@/lib/erp-api'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */
interface CategoryNode {
    id: number; name: string; parent: number | null; code?: string; short_name?: string;
    children?: CategoryNode[]; product_count?: number; brand_count?: number; parfum_count?: number; level?: number;
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
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
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
        erpFetch(`inventory/brands/`)
            .then((data: any) => {
                const all = Array.isArray(data) ? data : data?.results ?? []
                setAllBrands(all)
                // Filter brands that have this category in their M2M categories
                const linked = all.filter((b: any) =>
                    (b.categories || []).some((c: any) =>
                        (typeof c === 'object' ? c.id : c) === category.id
                    )
                )
                setBrands(linked)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [category.id])

    useEffect(() => { loadBrands() }, [loadBrands])

    const linkedIds = useMemo(() => new Set(brands.map(b => b.id)), [brands])

    const unlinkBrand = async (brandId: number) => {
        setLinking(true)
        try {
            const brand = allBrands.find(b => b.id === brandId)
            if (brand) {
                // Get current category IDs, remove this one
                const currentCatIds = (brand.categories || []).map((c: any) => typeof c === 'object' ? c.id : c)
                const newCatIds = currentCatIds.filter((id: number) => id !== category.id)
                await erpFetch(`inventory/brands/${brandId}/`, {
                    method: 'PATCH',
                    body: JSON.stringify({ category_ids: newCatIds }),
                })
                toast.success(`Unlinked "${brand.name}"`)
                loadBrands()
                router.refresh()
            }
        } catch (e: any) {
            toast.error(e?.message || 'Failed to unlink brand')
        } finally {
            setLinking(false)
        }
    }

    const linkBrand = async (brandId: number) => {
        setLinking(true)
        try {
            const brand = allBrands.find(b => b.id === brandId)
            if (brand) {
                // Get current category IDs, add this one
                const currentCatIds = (brand.categories || []).map((c: any) => typeof c === 'object' ? c.id : c)
                const newCatIds = [...currentCatIds, category.id]
                await erpFetch(`inventory/brands/${brandId}/`, {
                    method: 'PATCH',
                    body: JSON.stringify({ category_ids: newCatIds }),
                })
                toast.success(`Linked "${brand.name}" to "${category.name}"`)
                loadBrands()
                router.refresh()
            }
        } catch (e: any) {
            toast.error(e?.message || 'Failed to link brand')
        } finally {
            setLinking(false)
        }
    }


    const unlinkedBrands = allBrands.filter(b => !linkedIds.has(b.id))

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
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
    onViewProducts, onViewBrands,
}: {
    node: CategoryNode; level: number; searchQuery: string; forceExpanded?: boolean;
    onEdit: (n: CategoryNode) => void; onAdd: (parentId?: number) => void; onDelete: (n: CategoryNode) => void;
    onViewProducts: (n: CategoryNode) => void; onViewBrands: (n: CategoryNode) => void;
}) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 2)

    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => { if (forceExpanded !== undefined) setIsOpen(forceExpanded) }, [forceExpanded])

    const isRoot = level === 0
    const productCount = node.product_count ?? 0
    const brandCount = node.brand_count ?? 0

    return (
        <div>
            {/* ── ROW ── */}
            <div
                className={`
                    group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-default
                    border-b border-app-border/30
                    ${level === 0
                        ? 'hover:bg-app-surface py-2.5 md:py-3'
                        : 'hover:bg-app-surface/40 py-1.5 md:py-2'
                    }
                `}
                style={{
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    background: isRoot
                        ? 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))'
                        : undefined,
                    borderLeft: isRoot
                        ? '3px solid var(--app-primary)'
                        : undefined,
                }}
            >
                {/* Indent spacer */}
                {level > 0 && <div style={{ width: `${level * 20}px` }} className="flex-shrink-0" />}
                {/* Toggle */}
                <button
                    onClick={() => isParent && setIsOpen(!isOpen)}
                    className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${isParent ? 'hover:bg-app-border/50 text-app-muted-foreground' : 'text-app-border'}`}
                >
                    {isParent ? (
                        isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-primary)' }} />
                    )}
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: isRoot
                            ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                            : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                        color: isRoot ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                    }}
                >
                    {isRoot
                        ? <Bookmark size={14} strokeWidth={2.5} />
                        : isParent
                            ? (isOpen ? <FolderOpen size={14} /> : <Folder size={14} />)
                            : <Folder size={13} />}
                </div>

                {/* Code + Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                    {node.code && (
                        <span
                            className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                                background: isRoot
                                    ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)'
                                    : 'color-mix(in srgb, var(--app-background) 60%, transparent)',
                                color: isRoot ? 'var(--app-primary)' : 'var(--app-foreground)',
                            }}
                        >
                            {node.code}
                        </span>
                    )}
                    <span className={`truncate text-[13px] ${isRoot ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}>
                        {node.name}
                    </span>
                    {node.short_name && (
                        <span className="hidden md:inline text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider bg-app-border/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            {node.short_name}
                        </span>
                    )}
                    {isRoot && (
                        <span
                            className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                color: 'var(--app-primary)',
                                border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                            }}
                        >
                            Root
                        </span>
                    )}
                </div>

                {/* Children count */}
                <div className="hidden sm:flex w-16 flex-shrink-0">
                    <span className="text-[10px] font-bold text-app-muted-foreground">
                        {isParent ? `${node.children!.length} sub` : 'Leaf'}
                    </span>
                </div>

                {/* Brands — clickable badge */}
                <div className="hidden sm:flex w-20 flex-shrink-0">
                    <button
                        onClick={() => onViewBrands(node)}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition-all hover:brightness-120"
                        style={brandCount > 0 ? {
                            color: '#8b5cf6',
                            background: 'color-mix(in srgb, #8b5cf6 8%, transparent)',
                        } : {
                            color: 'var(--app-muted-foreground)',
                            opacity: 0.5,
                        }}
                        title={`${brandCount} brand${brandCount !== 1 ? 's' : ''} — click to view`}
                    >
                        <Paintbrush size={10} />
                        {brandCount}
                    </button>
                </div>

                {/* Products — clickable badge */}
                <div className="hidden sm:flex w-20 flex-shrink-0">
                    <button
                        onClick={() => onViewProducts(node)}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition-all hover:brightness-120"
                        style={productCount > 0 ? {
                            color: 'var(--app-success)',
                            background: 'color-mix(in srgb, var(--app-success) 8%, transparent)',
                        } : {
                            color: 'var(--app-muted-foreground)',
                            opacity: 0.5,
                        }}
                        title={`${productCount} product${productCount !== 1 ? 's' : ''} — click to view`}
                    >
                        <Box size={10} />
                        {productCount}
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(node)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                        <Pencil size={12} />
                    </button>
                    <button onClick={() => onAdd(node.id)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors" title="Add sub-category">
                        <Plus size={13} />
                    </button>
                    <button
                        onClick={() => { if (isParent) { toast.error('Delete sub-categories first.'); return; } onDelete(node); }}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
                        style={{ color: isParent ? 'var(--app-border)' : 'var(--app-muted-foreground)', cursor: isParent ? 'not-allowed' : 'pointer' }}
                        title={isParent ? 'Delete sub-categories first' : 'Delete'}
                    >
                        {isParent ? <AlertCircle size={12} /> : <Trash2 size={12} />}
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

function CategoryDetailPanel({ node, onEdit, onAdd, onDelete, allCategories, initialTab, onClose }: {
    node: CategoryNode
    onEdit: (n: CategoryNode) => void
    onAdd: (parentId?: number) => void
    onDelete: (n: CategoryNode) => void
    allCategories: any[]
    initialTab?: PanelTab
    onClose?: () => void
}) {
    const [activeTab, setActiveTab] = useState<PanelTab>(initialTab ?? 'overview')
    const isParent = (node.children?.length ?? 0) > 0
    const productCount = node.product_count ?? 0
    const brandCount = node.brand_count ?? 0
    const childCount = node.children?.length ?? 0

    useEffect(() => { setActiveTab(initialTab ?? 'overview') }, [node.id, initialTab])

    const tabs: { key: PanelTab; label: string; icon: React.ReactNode; count?: number; color: string }[] = [
        { key: 'overview', label: 'Overview', icon: <Layers size={12} />, color: 'var(--app-primary)' },
        { key: 'products', label: 'Products', icon: <Package size={12} />, count: productCount, color: 'var(--app-success, #22c55e)' },
        { key: 'brands', label: 'Brands', icon: <Paintbrush size={12} />, count: brandCount, color: '#8b5cf6' },
        { key: 'attributes', label: 'Attributes', icon: <Tag size={12} />, color: 'var(--app-warning, #f59e0b)' },
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
            <div className="flex-shrink-0 flex items-center px-3 overflow-x-auto"
                style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)' }}>
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
                        childCount={childCount} productCount={productCount} brandCount={brandCount} />
                )}
                {activeTab === 'products' && <PanelProductsTab categoryId={node.id} categoryName={node.name} allCategories={allCategories} />}
                {activeTab === 'brands' && <PanelBrandsTab categoryId={node.id} categoryName={node.name} />}
                {activeTab === 'attributes' && <PanelAttributesTab categoryId={node.id} categoryName={node.name} />}
            </div>
        </div>
    )
}

/* ── Overview Tab — §4 KPI pattern ── */
function PanelOverviewTab({ node, onAdd, onDelete, isParent, childCount, productCount, brandCount }: {
    node: CategoryNode; onAdd: (pid?: number) => void; onDelete: (n: CategoryNode) => void;
    isParent: boolean; childCount: number; productCount: number; brandCount: number;
}) {
    return (
        <div className="p-4 space-y-3 animate-in fade-in duration-200">
            {/* KPI Cards — §4 standard pattern */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                {[
                    { label: 'Children', value: childCount, icon: <GitBranch size={11} />, color: 'var(--app-primary)' },
                    { label: 'Products', value: productCount, icon: <Package size={11} />, color: 'var(--app-success, #22c55e)' },
                    { label: 'Brands', value: brandCount, icon: <Paintbrush size={11} />, color: '#8b5cf6' },
                ].map(s => (
                    <div key={s.label}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all text-left"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                            <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Sub-categories List */}
            {childCount > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Sub-categories ({childCount})</p>
                        <button onClick={() => onAdd(node.id)}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                            style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
                            <Plus size={10} /> Add
                        </button>
                    </div>
                    <div className="flex flex-col gap-1">
                        {node.children!.map(child => (
                            <div key={child.id}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all border-b border-app-border/20"
                                style={{ background: 'color-mix(in srgb, var(--app-background) 40%, transparent)' }}>
                                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                    <Folder size={11} />
                                </div>
                                <span className="flex-1 text-[12px] font-medium text-app-foreground truncate">{child.name}</span>
                                {(child.product_count ?? 0) > 0 && (
                                    <span className="text-[10px] font-bold flex items-center gap-0.5"
                                        style={{ color: 'var(--app-success, #22c55e)' }}>
                                        <Box size={9} /> {child.product_count}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {childCount === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <Folder size={28} className="text-app-muted-foreground mb-2 opacity-30" />
                    <p className="text-[11px] font-bold text-app-muted-foreground">Leaf category — no sub-categories</p>
                    <p className="text-[10px] text-app-muted-foreground mt-1">Products can be assigned directly to this node.</p>
                </div>
            )}

            {/* Danger Zone */}
            {!isParent && (
                <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={() => onDelete(node)}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all"
                        style={{
                            color: 'var(--app-error, #ef4444)',
                            borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)',
                            background: 'color-mix(in srgb, var(--app-error, #ef4444) 5%, transparent)',
                        }}>
                        <Trash2 size={12} /> Delete Category
                    </button>
                </div>
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
    // Filters
    const [filterBrand, setFilterBrand] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string | null>(null)
    const [filterType, setFilterType] = useState<string | null>(null)
    const [filterUnit, setFilterUnit] = useState<string | null>(null)
    const [filterTva, setFilterTva] = useState<string | null>(null)
    const [filterMarginMin, setFilterMarginMin] = useState('')
    const [filterMarginMax, setFilterMarginMax] = useState('')
    const [filterPriceMin, setFilterPriceMin] = useState('')
    const [filterPriceMax, setFilterPriceMax] = useState('')
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
                setLoading(false)
                setLoadingMore(false)
            })
            .catch(() => {
                if (!append) setProducts([])
                setLoading(false)
                setLoadingMore(false)
            })
    }, [categoryId, debouncedSearch])

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

    // Unique values for filter chips (from loaded products)
    const uniqueBrands = useMemo(() => {
        const set = new Set<string>()
        products.forEach(p => { if (p.brand_name) set.add(p.brand_name) })
        return Array.from(set).sort()
    }, [products])
    const uniqueStatuses = useMemo(() => {
        const set = new Set<string>()
        products.forEach(p => { if (p.status) set.add(p.status) })
        return Array.from(set).sort()
    }, [products])
    const uniqueTypes = useMemo(() => {
        const set = new Set<string>()
        products.forEach(p => { if (p.product_type) set.add(p.product_type) })
        return Array.from(set).sort()
    }, [products])
    const uniqueUnits = useMemo(() => {
        const set = new Set<string>()
        products.forEach(p => { if (p.unit_code) set.add(p.unit_code) })
        return Array.from(set).sort()
    }, [products])
    const uniqueTvaRates = useMemo(() => {
        const set = new Set<string>()
        products.forEach(p => { if (p.tva_rate !== undefined) set.add(String(p.tva_rate)) })
        return Array.from(set).sort((a, b) => Number(a) - Number(b))
    }, [products])

    const activeFilterCount = (filterBrand ? 1 : 0) + (filterStatus ? 1 : 0) + (filterType ? 1 : 0) +
        (filterUnit ? 1 : 0) + (filterTva ? 1 : 0) +
        (filterMarginMin || filterMarginMax ? 1 : 0) + (filterPriceMin || filterPriceMax ? 1 : 0)

    const clearAllFilters = () => {
        setFilterBrand(null); setFilterStatus(null); setFilterType(null)
        setFilterUnit(null); setFilterTva(null)
        setFilterMarginMin(''); setFilterMarginMax('')
        setFilterPriceMin(''); setFilterPriceMax('')
    }

    // Client-side filters on loaded data (search is server-side)
    const filtered = useMemo(() => {
        let list = products
        if (filterBrand) list = list.filter(p => p.brand_name === filterBrand)
        if (filterStatus) list = list.filter(p => p.status === filterStatus)
        if (filterType) list = list.filter(p => p.product_type === filterType)
        if (filterUnit) list = list.filter(p => p.unit_code === filterUnit)
        if (filterTva) list = list.filter(p => String(p.tva_rate) === filterTva)
        if (filterMarginMin) list = list.filter(p => p.margin_pct !== null && p.margin_pct >= Number(filterMarginMin))
        if (filterMarginMax) list = list.filter(p => p.margin_pct !== null && p.margin_pct <= Number(filterMarginMax))
        if (filterPriceMin) list = list.filter(p => p.selling_price_ttc >= Number(filterPriceMin))
        if (filterPriceMax) list = list.filter(p => p.selling_price_ttc <= Number(filterPriceMax))
        return list
    }, [products, filterBrand, filterStatus, filterType, filterUnit, filterTva, filterMarginMin, filterMarginMax, filterPriceMin, filterPriceMax])

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

                        {/* Filter Popup */}
                        {showFilterPopup && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                                style={{
                                    background: 'var(--app-surface)',
                                    border: '1px solid var(--app-border)',
                                    boxShadow: '0 12px 40px -8px rgba(0,0,0,0.25)',
                                }}>
                                <div className="px-3 py-2 flex items-center justify-between"
                                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))' }}>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Filters</span>
                                    {activeFilterCount > 0 && (
                                        <button onClick={() => { setFilterBrand(null); setFilterStatus(null) }}
                                            className="text-[9px] font-bold text-app-error hover:underline">Clear all</button>
                                    )}
                                </div>

                                {/* Brand Filter */}
                                {uniqueBrands.length > 0 && (
                                    <div className="px-3 py-2" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">
                                            <Paintbrush size={9} className="inline mr-1" />Brand
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {uniqueBrands.map(b => (
                                                <button key={b} onClick={() => setFilterBrand(filterBrand === b ? null : b)}
                                                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all"
                                                    style={{
                                                        background: filterBrand === b ? 'color-mix(in srgb, #8b5cf6 15%, transparent)' : 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                                                        color: filterBrand === b ? '#8b5cf6' : 'var(--app-muted-foreground)',
                                                        border: filterBrand === b ? '1px solid color-mix(in srgb, #8b5cf6 30%, transparent)' : '1px solid transparent',
                                                    }}>
                                                    {filterBrand === b && <Check size={8} className="inline mr-0.5" />}{b}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Status Filter */}
                                {uniqueStatuses.length > 0 && (
                                    <div className="px-3 py-2" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">
                                            <AlertCircle size={9} className="inline mr-1" />Status
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {uniqueStatuses.map(s => (
                                                <button key={s} onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                                                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all uppercase"
                                                    style={{
                                                        background: filterStatus === s ? 'color-mix(in srgb, var(--app-primary) 15%, transparent)' : 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                                                        color: filterStatus === s ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                                        border: filterStatus === s ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)' : '1px solid transparent',
                                                    }}>
                                                    {filterStatus === s && <Check size={8} className="inline mr-0.5" />}{s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Apply/Close */}
                                <div className="px-3 py-2">
                                    <button onClick={() => setShowFilterPopup(false)}
                                        className="w-full text-[11px] font-bold py-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all">
                                        Apply
                                    </button>
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
                                        {p.selling_price_ttc != null && (
                                            <span className="text-[11px] font-bold text-app-foreground tabular-nums flex-shrink-0">
                                                {Number(p.selling_price_ttc).toLocaleString()}
                                            </span>
                                        )}
                                        <Link href={`/inventory/products/${p.id}`}
                                            onClick={e => e.stopPropagation()}
                                            className="p-1 rounded-lg text-app-muted-foreground hover:text-app-primary opacity-0 group-hover:opacity-100 transition-all">
                                            <ExternalLink size={11} />
                                        </Link>
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
                                                                        {movePreview.target_brands?.length > 0 && (
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
                                                                                    border: isReassigned ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)' : '1px solid var(--app-border)',
                                                                                    color: isReassigned ? 'var(--app-primary)' : undefined,
                                                                                }}>
                                                                                <option value="">Reassign to...</option>
                                                                                {movePreview.target_brands.map((tb: any) => (
                                                                                    <option key={tb.id} value={String(tb.id)}>{tb.name}</option>
                                                                                ))}
                                                                            </select>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Attribute conflicts */}
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
                                                            const linked = autoLinkAttrs.has(a.id)
                                                            return (
                                                                <div key={a.id}
                                                                    className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all hover:bg-app-border/10"
                                                                    onClick={() => {
                                                                        const next = new Set(autoLinkAttrs)
                                                                        next.has(a.id) ? next.delete(a.id) : next.add(a.id)
                                                                        setAutoLinkAttrs(next)
                                                                    }}>
                                                                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                                                        style={{
                                                                            background: linked ? 'var(--app-success)' : 'transparent',
                                                                            border: linked ? '1px solid var(--app-success)' : '1px solid var(--app-border)',
                                                                        }}>
                                                                        {linked && <Check size={10} className="text-white" />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-[12px] font-bold text-app-foreground">{a.name}</span>
                                                                        {a.code && <span className="text-[10px] font-mono text-app-muted-foreground ml-2">{a.code}</span>}
                                                                    </div>
                                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0" style={{
                                                                        background: linked ? 'color-mix(in srgb, var(--app-success) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                                                                        color: linked ? 'var(--app-success)' : 'var(--app-error)',
                                                                    }}>
                                                                        {linked ? '✓ Will link' : '⚠ Unresolved'}
                                                                    </span>
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
                        {(moveStep === 'preview' || moveStep === 'executing') && movePreview && (
                            <div className="px-5 py-3 flex items-center gap-2"
                                style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, var(--app-surface))' }}>
                                <button onClick={() => { setMoveStep('picking'); setMovePreview(null) }}
                                    className="flex-1 text-[12px] font-bold py-2 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-border/30 transition-all">
                                    ← Back
                                </button>
                                <button onClick={executeMove} disabled={moveStep === 'executing'}
                                    className="flex-[2] flex items-center justify-center gap-2 text-[12px] font-bold bg-app-primary text-white py-2 rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
                                    style={{ boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    {moveStep === 'executing' ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                                    {moveStep === 'executing' ? 'Moving...' : `Move ${selected.size} Product${selected.size > 1 ? 's' : ''}`}
                                </button>
                            </div>
                        )}
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
    const router = useRouter()

    const loadData = useCallback(() => {
        setLoading(true)
        // Fetch brands linked to this category (M2M) AND all brands for the link palette
        Promise.all([
            erpFetch(`inventory/brands/by_category/?category_id=${categoryId}`),
            erpFetch('inventory/brands/'),
        ]).then(([linked, all]: any[]) => {
            setLinkedBrands(Array.isArray(linked) ? linked : linked?.results ?? [])
            setAllBrands(Array.isArray(all) ? all : all?.results ?? [])
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [categoryId])

    useEffect(() => { loadData() }, [loadData])

    const linkedIds = useMemo(() => new Set(linkedBrands.map(b => b.id)), [linkedBrands])
    const unlinkedBrands = allBrands.filter(b => !linkedIds.has(b.id))

    const linkBrand = async (brandId: number) => {
        setLinking(true)
        try {
            const brand = allBrands.find(b => b.id === brandId)
            if (brand) {
                const existingCatIds = (brand.categories || []).map((c: any) => typeof c === 'object' ? c.id : c)
                await erpFetch(`inventory/brands/${brandId}/`, {
                    method: 'PATCH',
                    body: JSON.stringify({ category_ids: [...existingCatIds, categoryId] }),
                })
                toast.success(`Linked "${brand.name}"`)
                loadData(); router.refresh()
            }
        } catch (e: any) { toast.error(e?.message || 'Failed to link') }
        finally { setLinking(false) }
    }

    const unlinkBrand = async (brandId: number) => {
        setLinking(true)
        try {
            const brand = allBrands.find(b => b.id === brandId)
            if (brand) {
                const existingCatIds = (brand.categories || []).map((c: any) => typeof c === 'object' ? c.id : c)
                await erpFetch(`inventory/brands/${brandId}/`, {
                    method: 'PATCH',
                    body: JSON.stringify({ category_ids: existingCatIds.filter((id: number) => id !== categoryId) }),
                })
                toast.success(`Unlinked "${brand.name}"`)
                loadData(); router.refresh()
            }
        } catch (e: any) { toast.error(e?.message || 'Failed to unlink') }
        finally { setLinking(false) }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-[10px] font-bold text-app-muted-foreground">
                    {loading ? 'Loading...' : `${linkedBrands.length} brand${linkedBrands.length !== 1 ? 's' : ''} linked`}
                </p>
                <button onClick={() => setShowLink(!showLink)}
                    className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-xl hover:bg-app-surface transition-all">
                    <Link2 size={11} /> {showLink ? 'Hide' : 'Link'}
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

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: '#8b5cf6' }} /></div>
                ) : linkedBrands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Paintbrush size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">No brands linked</p>
                        <p className="text-[11px] text-app-muted-foreground mt-1">Click &ldquo;Link&rdquo; to associate brands with this category.</p>
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
                                    <p className="text-[12px] font-bold text-app-foreground truncate">{b.name}</p>
                                    {b.product_count != null && (
                                        <p className="text-[10px] font-bold text-app-muted-foreground">{b.product_count} products</p>
                                    )}
                                </div>
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
    const [attributes, setAttributes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        // Fetch the full attribute tree, then filter to those linked to this category
        erpFetch('inventory/product-attributes/tree/')
            .then((data: any) => {
                if (!cancelled) {
                    const tree = Array.isArray(data) ? data : data?.results ?? []
                    // Filter: only show attribute groups that are linked to this category
                    const linked = tree.filter((group: any) =>
                        (group.linked_categories || []).some((c: any) => c.id === categoryId)
                    )
                    setAttributes(linked)
                    setLoading(false)
                }
            })
            .catch(() => { if (!cancelled) { setAttributes([]); setLoading(false) } })
        return () => { cancelled = true }
    }, [categoryId])

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-[10px] font-bold text-app-muted-foreground">
                    {loading ? 'Loading...' : `${attributes.length} attribute group${attributes.length !== 1 ? 's' : ''} linked`}
                </p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-warning)' }} /></div>
                ) : attributes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Tag size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">No attribute groups linked</p>
                        <p className="text-[11px] text-app-muted-foreground mt-1">
                            Link attributes from the Attributes page.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {attributes.map((group: any) => (
                            <div key={group.id} className="px-4 py-2.5">
                                {/* Attribute Group header */}
                                <div className="flex items-center gap-2.5 mb-1.5">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>
                                        <Tag size={12} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-bold text-app-foreground truncate">{group.name}</p>
                                        {group.code && <p className="text-[10px] font-mono font-bold text-app-muted-foreground">{group.code}</p>}
                                    </div>
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                                        style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', color: 'var(--app-warning)' }}>
                                        {group.children?.length ?? 0} values
                                    </span>
                                </div>
                                {/* Attribute values as chips */}
                                {group.children && group.children.length > 0 && (
                                    <div className="flex flex-wrap gap-1 ml-8">
                                        {group.children.map((val: any) => (
                                            <span key={val.id}
                                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                                style={{
                                                    background: val.color_hex
                                                        ? `color-mix(in srgb, ${val.color_hex} 12%, transparent)`
                                                        : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                                    color: val.color_hex || 'var(--app-muted-foreground)',
                                                    border: val.color_hex
                                                        ? `1px solid color-mix(in srgb, ${val.color_hex} 25%, transparent)`
                                                        : '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                                                }}>
                                                {val.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
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
            style={{ height: 'calc(100dvh - 6rem)' }}>

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
                                <div>
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Categories</h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        {stats.total} Nodes · Hierarchical Tree
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <Link
                                    href="/inventory/maintenance?tab=category"
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Wrench size={13} />
                                    <span className="hidden md:inline">Cleanup</span>
                                </Link>
                                {/* Split Panel toggle */}
                                <button
                                    onClick={() => { setSplitPanel(p => !p); setSelectedCategory(null) }}
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
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
                        <div className="flex items-center gap-2">
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

            {productsTarget && (
                <ProductsPopup category={productsTarget} onClose={() => setProductsTarget(null)} />
            )}

            {brandsTarget && (
                <BrandsPopup category={brandsTarget} onClose={() => setBrandsTarget(null)} />
            )}

            {/* ═══════════════ TREE TABLE (with optional split panel) ═══════════════ */}
            <div className={`flex-1 min-h-0 flex gap-3 ${splitPanel ? 'flex-row' : 'flex-col'} animate-in fade-in duration-200`}>

                {/* Left: Tree */}
                <div className={`${splitPanel ? 'flex-[5] min-w-0' : 'flex-1'} min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col`}>
                    {/* Column Headers */}
                    <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                        <div className="w-5 flex-shrink-0" />
                        <div className="w-7 flex-shrink-0" />
                        <div className="flex-1 min-w-0">Category</div>
                        <div className="hidden sm:block w-16 flex-shrink-0">Children</div>
                        <div className="hidden sm:block w-20 flex-shrink-0">Brands</div>
                        <div className="hidden sm:block w-20 flex-shrink-0">Products</div>
                        <div className="w-16 flex-shrink-0" />
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                        {tree.length > 0 ? (
                            tree.map((node) => (
                                <div key={`${node.id}-${expandKey}`}
                                    onClick={splitPanel ? () => { setSelectedCategory(node); setPanelTab('overview') } : undefined}
                                    className={splitPanel && selectedCategory?.id === node.id ? 'ring-1 ring-inset ring-app-primary/30' : ''}
                                >
                                    <CategoryRow
                                        node={node}
                                        level={0}
                                        onEdit={openEditModal}
                                        onAdd={openAddModal}
                                        onDelete={requestDelete}
                                        onViewProducts={(n) => {
                                            if (splitPanel) {
                                                setSelectedCategory(n)
                                                setPanelTab('products')
                                            } else {
                                                setSidebarNode(n)
                                                setSidebarTab('products')
                                            }
                                        }}
                                        onViewBrands={(n) => {
                                            if (splitPanel) {
                                                setSelectedCategory(n)
                                                setPanelTab('brands')
                                            } else {
                                                setSidebarNode(n)
                                                setSidebarTab('brands')
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

                {/* Right: Detail Panel (split mode only) */}
                {splitPanel && (
                    <div className="flex-[5] min-w-0 min-h-0 border border-app-border/50 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
                        {selectedCategory ? (
                            <CategoryDetailPanel
                                node={selectedCategory}
                                onEdit={openEditModal}
                                onAdd={openAddModal}
                                onDelete={requestDelete}
                                allCategories={data}
                                initialTab={panelTab}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center"
                                style={{ background: 'var(--app-surface)' }}>
                                <LayoutPanelLeft size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                                <p className="text-sm font-bold text-app-muted-foreground">Select a category</p>
                                <p className="text-[11px] text-app-muted-foreground mt-1">
                                    Click any row in the tree to view details.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════════ RIGHT SIDEBAR DRAWER (tree-only mode) ═══════════════ */}
            {sidebarNode && !splitPanel && (
                <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', backdropFilter: 'blur(4px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setSidebarNode(null) }}>
                    <div className="w-full max-w-lg h-full flex flex-col animate-in slide-in-from-right-4 duration-300"
                        style={{
                            background: 'var(--app-surface)',
                            borderLeft: '1px solid var(--app-border)',
                            boxShadow: '-8px 0 30px rgba(0,0,0,0.15)',
                        }}>
                        <CategoryDetailPanel
                            node={sidebarNode}
                            onEdit={openEditModal}
                            onAdd={openAddModal}
                            onDelete={requestDelete}
                            allCategories={data}
                            initialTab={sidebarTab}
                            onClose={() => setSidebarNode(null)}
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
