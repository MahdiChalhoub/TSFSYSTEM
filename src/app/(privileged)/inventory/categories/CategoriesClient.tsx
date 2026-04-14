'use client'

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react'
import {
    ChevronRight, ChevronDown, Plus, Folder, FolderOpen,
    Pencil, X, Search, FolderTree,
    Trash2, Layers, Box, GitBranch,
    Maximize2, Minimize2, ChevronsUpDown, ChevronsDownUp, Bookmark, AlertCircle, Wrench,
    Package, Paintbrush, Link2, Unlink, Loader2, ExternalLink, LayoutPanelLeft, PanelLeftClose,
    Hash, Tag, ChevronUp, Info
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
                    paddingLeft: `${12 + level * 20}px`,
                    paddingRight: '12px',
                    background: isRoot
                        ? 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))'
                        : undefined,
                    borderLeft: isRoot
                        ? '3px solid var(--app-primary)'
                        : level > 0
                            ? '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)'
                            : undefined,
                    marginLeft: level > 0 ? `${12 + (level - 1) * 20 + 10}px` : undefined,
                }}
            >
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
 *  MAIN VIEWER (COA-style)
 * ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
 *  CATEGORY DETAIL PANEL (split-panel right side)
 * ═══════════════════════════════════════════════════════════ */
function CategoryDetailPanel({ node, onEdit, onAdd, onDelete }: {
    node: CategoryNode
    onEdit: (n: CategoryNode) => void
    onAdd: (parentId?: number) => void
    onDelete: (n: CategoryNode) => void
}) {
    const isParent = (node.children?.length ?? 0) > 0
    const productCount = node.product_count ?? 0
    const brandCount = node.brand_count ?? 0
    const childCount = node.children?.length ?? 0
    return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar" style={{ background: 'var(--app-surface)' }}>
            {/* Panel Header */}
            <div className="flex-shrink-0 px-5 py-4" style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))' }}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                            {isParent ? <FolderOpen size={18} /> : <Folder size={18} />}
                        </div>
                        <div>
                            <h2 className="text-[15px] font-black text-app-foreground tracking-tight leading-tight">{node.name}</h2>
                            {node.short_name && <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest mt-0.5">{node.short_name}</p>}
                        </div>
                    </div>
                </div>
                {node.code && (
                    <div className="mt-3 flex items-center gap-1.5">
                        <Hash size={10} className="text-app-muted-foreground" />
                        <span className="font-mono text-[12px] font-bold px-2 py-0.5 rounded-lg"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                            {node.code}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ml-1"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                            {node.parent === null ? 'Root' : 'Child'}
                        </span>
                    </div>
                )}
            </div>

            {/* Stats Row */}
            <div className="flex-shrink-0 px-5 py-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                    {[
                        { label: 'Sub-categories', value: childCount, icon: <GitBranch size={12} />, color: 'var(--app-primary)' },
                        { label: 'Products', value: productCount, icon: <Package size={12} />, color: 'var(--app-success, #22c55e)' },
                        { label: 'Brands', value: brandCount, icon: <Paintbrush size={12} />, color: '#8b5cf6' },
                    ].map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 px-5 py-3 flex items-center gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <button onClick={() => onEdit(node)}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all"
                    style={{ color: 'var(--app-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                    <Pencil size={12} /> Edit
                </button>
                <button onClick={() => onAdd(node.id)}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                    style={{ background: 'var(--app-primary)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                    <Plus size={12} /> Add Child
                </button>
                {!isParent && (
                    <button onClick={() => onDelete(node)}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all"
                        style={{ color: 'var(--app-error, #ef4444)', borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error, #ef4444) 5%, transparent)' }}>
                        <Trash2 size={12} /> Delete
                    </button>
                )}
            </div>

            {/* Children List */}
            {childCount > 0 && (
                <div className="flex-1 px-5 py-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">Sub-categories ({childCount})</p>
                    <div className="flex flex-col gap-1">
                        {node.children!.map(child => (
                            <div key={child.id} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                                style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                    <Folder size={11} />
                                </div>
                                <span className="flex-1 text-[12px] font-medium text-app-foreground truncate">{child.name}</span>
                                {child.product_count != null && child.product_count > 0 && (
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
                <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
                    <Info size={28} className="text-app-muted-foreground mb-2 opacity-30" />
                    <p className="text-[11px] font-bold text-app-muted-foreground">Leaf category</p>
                    <p className="text-[10px] text-app-muted-foreground mt-1">No sub-categories. Products can be assigned directly.</p>
                </div>
            )}
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
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)
    const [expandKey, setExpandKey] = useState(0)
    const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null)
    const [productsTarget, setProductsTarget] = useState<CategoryNode | null>(null)
    const [brandsTarget, setBrandsTarget] = useState<CategoryNode | null>(null)
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
        <div className={`flex flex-col animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}
            style={{ height: '100%' }}>

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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                            {[
                                { label: 'Root', value: stats.roots, icon: <FolderTree size={11} />, color: 'var(--app-primary)' },
                                { label: 'Leaf', value: stats.leafCount, icon: <GitBranch size={11} />, color: '#8b5cf6' },
                                { label: 'Total', value: stats.total, icon: <Layers size={11} />, color: 'var(--app-info, #3b82f6)' },
                                { label: 'Products', value: stats.totalProducts, icon: <Box size={11} />, color: 'var(--app-success, #22c55e)' },
                                { label: 'Brands', value: stats.totalBrands, icon: <Paintbrush size={11} />, color: '#8b5cf6' },
                            ].map(s => (
                                <div key={s.label}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}
                                >
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                        {s.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
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
                <div className={`${splitPanel ? 'flex-[4] min-w-0' : 'flex-1'} min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col`}>
                    {/* Column Headers */}
                    <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                        <div className="w-5 flex-shrink-0" />
                        <div className="w-7 flex-shrink-0" />
                        <div className="flex-1 min-w-0">Category</div>
                        <div className="hidden sm:block w-16 flex-shrink-0">Children</div>
                        {!splitPanel && <div className="hidden sm:block w-20 flex-shrink-0">Brands</div>}
                        {!splitPanel && <div className="hidden sm:block w-20 flex-shrink-0">Products</div>}
                        <div className="w-16 flex-shrink-0" />
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                        {tree.length > 0 ? (
                            tree.map((node) => (
                                <div key={`${node.id}-${expandKey}`}
                                    onClick={splitPanel ? () => setSelectedCategory(node) : undefined}
                                    className={splitPanel && selectedCategory?.id === node.id ? 'ring-1 ring-inset ring-app-primary/30' : ''}
                                >
                                    <CategoryRow
                                        node={node}
                                        level={0}
                                        onEdit={openEditModal}
                                        onAdd={openAddModal}
                                        onDelete={requestDelete}
                                        onViewProducts={setProductsTarget}
                                        onViewBrands={setBrandsTarget}
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
                    <div className="flex-[6] min-w-0 min-h-0 border border-app-border/50 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
                        {selectedCategory ? (
                            <CategoryDetailPanel
                                node={selectedCategory}
                                onEdit={openEditModal}
                                onAdd={openAddModal}
                                onDelete={requestDelete}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center"
                                style={{ background: 'var(--app-surface)' }}>
                                <LayoutPanelLeft size={36} className="text-app-muted-foreground mb-3 opacity-30" />
                                <p className="text-sm font-bold text-app-muted-foreground">Select a category</p>
                                <p className="text-[11px] text-app-muted-foreground mt-1">Click any row in the tree to view its details here.</p>
                            </div>
                        )}
                    </div>
                )}
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
