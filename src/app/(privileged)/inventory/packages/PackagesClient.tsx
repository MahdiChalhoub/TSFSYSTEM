// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  PackagesClient — First-class package master
 *
 *  Uses TreeMasterPage (same shell as Units / Categories):
 *    • Tree groups packages under their unit
 *    • 6-tile KPI strip + search + expand/collapse + split-panel
 *    • 5-tab detail drawer: Overview / Links / Products / Economics / Barcode
 *    • Tour, focus mode, Ctrl+K / Ctrl+Q all free from the template
 * ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react'
import {
    Package, Plus, Pencil, Trash2, Search, Box, Ruler, Barcode, DollarSign,
    Tag, Layers, Sparkles, ArrowRight, ArrowRightLeft, X, Check, Loader2,
    ChevronRight, GitBranch, TrendingUp, Scale, Calculator, Copy, ExternalLink,
    Wrench, Bookmark, Percent, Zap, ShieldCheck, FolderTree, Power,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { PageTour } from '@/components/ui/PageTour'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import {
    createPackage, updatePackage, deletePackage, getPackageRules, type Package as Pkg,
} from '@/app/actions/inventory/packages'
import {
    createPackagingRule, deletePackagingRule,
} from '@/app/actions/inventory/packaging-suggestions'
import { erpFetch } from '@/lib/erp-api'
import '@/lib/tours/definitions/inventory-packages'

type Option = { id: number; name: string; code?: string }

interface Props {
    initialPackages: Pkg[]
    units: any[]
    categories: Option[]
    brands: Option[]
    attributes: Option[]
}

export default function PackagesClient({ initialPackages, units, categories, brands, attributes }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const data = initialPackages

    // Form state
    const [editing, setEditing] = useState<Pkg | null>(null)
    const [showForm, setShowForm] = useState(false)

    // Delete flow
    const [deleteTarget, setDeleteTarget] = useState<Pkg | null>(null)
    const [deleteConflict, setDeleteConflict] = useState<any>(null)

    const openNewForm = useCallback(() => { setEditing(null); setShowForm(true) }, [])
    const openEditForm = useCallback((p: Pkg) => { setEditing(p); setShowForm(true) }, [])
    const closeForm = useCallback(() => { setShowForm(false); setEditing(null) }, [])

    /* ── Stats ────────────────────────────────────────────── */
    const stats = useMemo(() => {
        const active = data.filter(p => p.is_active !== false).length
        const withBarcode = data.filter(p => !!p.barcode).length
        const withPrice = data.filter(p => p.selling_price != null && Number(p.selling_price) > 0).length
        const defaults = data.filter(p => p.is_default).length
        const unitCount = new Set(data.map(p => p.unit)).size
        const avgRatio = data.length > 0
            ? Math.round(data.reduce((s, p) => s + Number(p.ratio || 1), 0) / data.length * 10) / 10
            : 0
        return { total: data.length, active, withBarcode, withPrice, defaults, unitCount, avgRatio }
    }, [data])

    /* ── Save handler ─────────────────────────────────────── */
    const handleSave = async (formData: Pkg) => {
        const action = editing?.id ? updatePackage(editing.id, formData) : createPackage(formData)
        const res: any = await action
        if (res.success) {
            toast.success(editing ? 'Package updated' : 'Package created')
            closeForm()
            router.refresh()
        } else {
            toast.error(res.message || 'Failed to save')
        }
    }

    /* ── Delete handlers ──────────────────────────────────── */
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            const res: any = await deletePackage(source.id!)
            if (res?.success) { toast.success(`"${source.name}" deleted`); router.refresh(); return }
            if (res?.conflict) { setDeleteConflict({ conflict: res.conflict, source }); return }
            toast.error(res?.message || 'Delete failed')
        })
    }
    const handleForceDelete = async () => {
        const source = deleteConflict?.source
        if (!source) return
        const res: any = await deletePackage(source.id, { force: true })
        if (res?.success) { toast.success(`"${source.name}" force-deleted`); setDeleteConflict(null); router.refresh() }
        else toast.error(res?.message || 'Delete failed')
    }

    /* ── Build tree of Units → Packages ───────────────────── */
    const tree = useMemo(() => {
        const byUnit: Record<string, any> = {}
        units.forEach((u: any) => {
            byUnit[u.id] = {
                id: `unit-${u.id}`, _type: 'unit', _unit: u,
                name: u.name, code: u.code, children: [],
            }
        })
        const orphans: any[] = []
        data.forEach(pkg => {
            const node = { id: `pkg-${pkg.id}`, _type: 'package', _pkg: pkg, name: pkg.name, code: pkg.code }
            if (byUnit[pkg.unit]) byUnit[pkg.unit].children.push(node)
            else orphans.push(node)
        })
        // Only keep units that actually have packages, sorted by base-first
        const populated = Object.values(byUnit).filter((u: any) => u.children.length > 0)
        populated.sort((a: any, b: any) => {
            const aBase = !a._unit?.base_unit
            const bBase = !b._unit?.base_unit
            if (aBase !== bBase) return aBase ? -1 : 1
            return (a.name || '').localeCompare(b.name || '')
        })
        return [...populated, ...orphans]
    }, [data, units])

    return (
        <TreeMasterPage
            config={{
                title: 'Packages',
                subtitle: `${stats.total} Package${stats.total !== 1 ? 's' : ''} · ${stats.unitCount} Unit Familie${stats.unitCount !== 1 ? 's' : ''}`,
                icon: <Package size={20} />,
                iconColor: 'var(--app-primary)',
                tourId: 'inventory-packages',
                kpis: [
                    { label: 'Total', value: stats.total, icon: <Box size={11} />, color: 'var(--app-primary)' },
                    { label: 'Active', value: stats.active, icon: <Power size={11} />, color: 'var(--app-success, #22c55e)' },
                    { label: 'With Barcode', value: stats.withBarcode, icon: <Barcode size={11} />, color: 'var(--app-info, #3b82f6)' },
                    { label: 'With Price', value: stats.withPrice, icon: <DollarSign size={11} />, color: 'var(--app-warning, #f59e0b)' },
                    { label: 'Defaults', value: stats.defaults, icon: <Sparkles size={11} />, color: '#8b5cf6' },
                    { label: 'Avg Ratio', value: `×${stats.avgRatio}`, icon: <Ruler size={11} />, color: 'var(--app-muted-foreground)' },
                ],
                searchPlaceholder: 'Search packages by name, code, barcode, unit… (Ctrl+K)',
                primaryAction: { label: 'New Package', icon: <Plus size={14} />, onClick: openNewForm },
                secondaryActions: [
                    { label: 'Rules', icon: <Sparkles size={13} />, href: '/inventory/packaging-suggestions' },
                    { label: 'Units', icon: <Ruler size={13} />, href: '/inventory/units' },
                ],
                columnHeaders: [
                    { label: 'Package', width: 'auto' },
                    { label: 'Ratio', width: '60px', color: 'var(--app-info)', hideOnMobile: true },
                    { label: 'Barcode', width: '120px', color: 'var(--app-info)', hideOnMobile: true },
                    { label: 'Price', width: '80px', color: 'var(--app-warning)', hideOnMobile: true },
                    { label: 'Links', width: '48px', color: '#8b5cf6', hideOnMobile: true },
                ],
                footerLeft: (
                    <>
                        <span>{stats.total} packages</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.active} active</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.withBarcode} scannable</span>
                    </>
                ),
                onRefresh: async () => { router.refresh(); await new Promise(r => setTimeout(r, 400)) },
            }}
            modals={<>
                {showForm && (
                    <PackageFormModal
                        pkg={editing}
                        units={units}
                        onSave={handleSave}
                        onClose={closeForm}
                    />
                )}
                <ConfirmDialog
                    open={deleteTarget !== null}
                    onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                    onConfirm={handleConfirmDelete}
                    title={`Delete "${deleteTarget?.name}"?`}
                    description="If products reference this package as a template, you'll be guided to force-delete."
                    confirmText="Delete" variant="danger"
                />
                <DeleteConflictDialog
                    conflict={deleteConflict?.conflict || null}
                    sourceName={deleteConflict?.source?.name || ''}
                    entityName="brand"
                    targets={[]}
                    onMigrate={async () => { /* not applicable */ }}
                    onForceDelete={handleForceDelete}
                    onCancel={() => setDeleteConflict(null)}
                    migrateDisabled={true}
                />
            </>}
            detailPanel={(node, { onClose, onPin }) => {
                if (node._type !== 'package') return null
                return (
                    <PackageDetailPanel
                        pkg={node._pkg}
                        categories={categories}
                        brands={brands}
                        attributes={attributes}
                        onEdit={() => openEditForm(node._pkg)}
                        onDelete={() => setDeleteTarget(node._pkg)}
                        onClose={onClose}
                        onPin={onPin ? () => onPin(node) : undefined}
                    />
                )
            }}
        >
            {({ searchQuery, expandAll, expandKey, splitPanel, pinnedSidebar, selectedNode, setSelectedNode, sidebarNode, setSidebarNode, setSidebarTab }) => {
                const q = searchQuery.trim().toLowerCase()
                const filteredTree = q
                    ? tree
                        .map((u: any) => ({
                            ...u,
                            children: u.children.filter((c: any) => {
                                const p = c._pkg
                                return (p.name || '').toLowerCase().includes(q)
                                    || (p.code || '').toLowerCase().includes(q)
                                    || (p.barcode || '').toLowerCase().includes(q)
                                    || (u.name || '').toLowerCase().includes(q)
                            })
                        }))
                        .filter((u: any) => u.children.length > 0)
                    : tree

                if (filteredTree.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Package size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground mb-1">
                                {q ? 'No matching packages' : 'No packages defined yet'}
                            </p>
                            <p className="text-[11px] text-app-muted-foreground mb-5 max-w-xs">
                                {q ? 'Try a different search term.' : 'Create your first package — Pack of 6, Carton 24, Pallet 144 — then link it to categories / brands / attributes.'}
                            </p>
                            {!q && (
                                <button onClick={openNewForm}
                                    className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold">
                                    <Plus size={16} className="inline mr-1.5" />Create First Package
                                </button>
                            )}
                        </div>
                    )
                }

                return filteredTree.map((unitNode: any) => (
                    <UnitGroup key={`${unitNode.id}-${expandKey}`} node={unitNode} forceExpanded={expandAll}
                        selectedId={(splitPanel || pinnedSidebar) ? selectedNode?.id : sidebarNode?.id}
                        onOpenPackage={(pkgNode: any) => {
                            if (splitPanel || pinnedSidebar) { setSelectedNode(pkgNode) }
                            else { setSidebarNode(pkgNode); setSidebarTab('overview') }
                        }}
                        onEdit={(p: Pkg) => openEditForm(p)}
                        onDelete={(p: Pkg) => setDeleteTarget(p)}
                    />
                ))
            }}
        </TreeMasterPage>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  UNIT GROUP — collapsible header + package rows
 * ═══════════════════════════════════════════════════════════ */
function UnitGroup({ node, forceExpanded, selectedId, onOpenPackage, onEdit, onDelete }: any) {
    const [open, setOpen] = useState(forceExpanded ?? true)
    useEffect(() => { if (forceExpanded !== undefined) setOpen(forceExpanded) }, [forceExpanded])
    const unit = node._unit
    const pkgs = node.children
    const isBase = unit && !unit.base_unit

    return (
        <div>
            {/* Unit header row */}
            <div
                onClick={() => setOpen(o => !o)}
                className="group flex items-center gap-2.5 cursor-pointer py-2.5 md:py-3 hover:brightness-105 relative"
                style={{
                    paddingLeft: 12, paddingRight: 12,
                    background: 'linear-gradient(90deg, color-mix(in srgb, var(--app-info) 6%, var(--app-surface)) 0%, var(--app-surface) 100%)',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                }}>
                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                    style={{ background: 'linear-gradient(180deg, var(--app-info), color-mix(in srgb, var(--app-info) 40%, transparent))' }} />
                <button className="w-5 h-5 flex items-center justify-center rounded-md">
                    <div className={`w-2 h-2 rounded-sm transition-all duration-200 ${open ? 'rotate-45 scale-110' : ''}`}
                        style={{ background: open ? 'var(--app-info)' : 'color-mix(in srgb, var(--app-muted-foreground) 60%, transparent)' }} />
                </button>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                    style={{ background: 'linear-gradient(135deg, var(--app-info), color-mix(in srgb, var(--app-info) 70%, #6366f1))', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                    <Ruler size={13} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-black text-app-foreground truncate">{unit?.name || node.name}</span>
                        {isBase && (
                            <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-[1px] rounded-full"
                                style={{ background: 'linear-gradient(135deg, var(--app-info), color-mix(in srgb, var(--app-info) 70%, #6366f1))', color: '#fff' }}>BASE</span>
                        )}
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md tabular-nums"
                            style={{ background: 'color-mix(in srgb, var(--app-foreground) 6%, transparent)' }}>
                            {pkgs.length} pkg{pkgs.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {unit?.code && <span className="font-mono text-[9px] font-bold text-app-muted-foreground">{unit.code}</span>}
                </div>
            </div>

            {/* Package children */}
            {open && pkgs.map((p: any) => (
                <PackageRow key={p.id}
                    node={p}
                    selected={selectedId === p.id}
                    onOpen={() => onOpenPackage(p)}
                    onEdit={() => onEdit(p._pkg)}
                    onDelete={() => onDelete(p._pkg)}
                />
            ))}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  PACKAGE ROW
 * ═══════════════════════════════════════════════════════════ */
function PackageRow({ node, selected, onOpen, onEdit, onDelete }: any) {
    const p: Pkg = node._pkg
    const ratio = Number(p.ratio ?? 1)
    const price = p.selling_price != null ? Number(p.selling_price) : null
    const inactive = p.is_active === false

    return (
        <div
            onClick={onOpen}
            onDoubleClick={onOpen}
            className={`group flex items-center gap-2.5 py-1.5 md:py-2 hover:brightness-105 cursor-pointer transition-all relative ${selected ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03]' : ''}`}
            style={{
                paddingLeft: 30, paddingRight: 12,
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                opacity: inactive ? 0.5 : 1,
            }}>
            <div className="absolute top-0 bottom-0" style={{ left: 20, width: '1px', background: 'color-mix(in srgb, var(--app-border) 20%, transparent)' }} />

            <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-primary) 35%, transparent)' }} />
            </div>
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                <Box size={12} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-app-foreground truncate">{p.name}</span>
                    {p.is_default && (
                        <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-[1px] rounded-full"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff' }}>Default</span>
                    )}
                    {inactive && (
                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, var(--app-error) 12%, transparent)', color: 'var(--app-error)' }}>Inactive</span>
                    )}
                </div>
                {p.code && <span className="font-mono text-[9px] font-bold text-app-muted-foreground">{p.code}</span>}
            </div>

            {/* Ratio col */}
            <div className="hidden sm:flex w-[60px] flex-shrink-0 justify-center">
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums"
                    style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 8%, transparent)' }}>
                    <ArrowRightLeft size={9} />×{ratio}
                </span>
            </div>

            {/* Barcode col */}
            <div className="hidden sm:flex w-[120px] flex-shrink-0 justify-center">
                {p.barcode ? (
                    <span className="text-[9px] font-mono font-bold flex items-center gap-1 truncate max-w-full"
                        style={{ color: 'var(--app-info)' }}>
                        <Barcode size={9} /><span className="truncate">{p.barcode}</span>
                    </span>
                ) : (
                    <span className="text-[9px] font-bold" style={{ color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)' }}>—</span>
                )}
            </div>

            {/* Price col */}
            <div className="hidden sm:flex w-[80px] flex-shrink-0 justify-end">
                {price != null && price > 0 ? (
                    <span className="text-[10px] font-black tabular-nums flex items-center gap-0.5"
                        style={{ color: 'var(--app-warning)' }}>
                        <DollarSign size={9} />{price.toLocaleString()}
                    </span>
                ) : (
                    <span className="text-[9px]" style={{ color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)' }}>—</span>
                )}
            </div>

            {/* Links col */}
            <div className="hidden sm:flex w-[48px] flex-shrink-0 justify-center">
                <LinkedCountBadge pkgId={p.id!} />
            </div>

            <div className="w-[68px] flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={(e) => { e.stopPropagation(); onEdit() }} className="p-1.5 hover:bg-app-border/40 rounded-lg" title="Edit">
                    <Pencil size={11} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1.5 hover:bg-app-border/40 rounded-lg" title="Delete">
                    <Trash2 size={11} style={{ color: 'var(--app-error)' }} />
                </button>
            </div>
        </div>
    )
}

function LinkedCountBadge({ pkgId }: { pkgId: number }) {
    const [count, setCount] = useState<number | null>(null)
    useEffect(() => {
        let alive = true
        getPackageRules(pkgId).then((rules) => { if (alive) setCount(rules.length) })
        return () => { alive = false }
    }, [pkgId])
    if (count === null) return <span className="text-[8px]" style={{ color: 'var(--app-muted-foreground)' }}>…</span>
    if (count === 0) return <span className="text-[8px]" style={{ color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)' }}>0</span>
    return (
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums"
            style={{ color: '#8b5cf6', background: 'color-mix(in srgb, #8b5cf6 10%, transparent)' }}>
            <GitBranch size={9} />{count}
        </span>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  DETAIL PANEL — 5 tabs
 * ═══════════════════════════════════════════════════════════ */
type DetailTab = 'overview' | 'links' | 'products' | 'economics' | 'barcode'

function PackageDetailPanel({ pkg, categories, brands, attributes, onEdit, onDelete, onClose, onPin }: any) {
    const [tab, setTab] = useState<DetailTab>('overview')
    const [rules, setRules] = useState<any[]>([])
    const [rulesLoaded, setRulesLoaded] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [productsLoaded, setProductsLoaded] = useState(false)
    const [adding, setAdding] = useState(false)
    const [newLink, setNewLink] = useState({ category: '', brand: '', attribute: '', attribute_value: '' })

    useEffect(() => {
        setTab('overview'); setRulesLoaded(false); setProductsLoaded(false)
        setRules([]); setProducts([])
    }, [pkg.id])

    const loadRules = useCallback(async () => {
        if (rulesLoaded) return
        const data = await getPackageRules(pkg.id)
        setRules(data); setRulesLoaded(true)
    }, [pkg.id, rulesLoaded])

    const loadProducts = useCallback(async () => {
        if (productsLoaded) return
        try {
            // Find products where unit matches + there's a packaging level with matching ratio
            const data = await erpFetch(`inventory/products/?unit=${pkg.unit}`, { cache: 'no-store' } as any)
            const list = Array.isArray(data) ? data : (data?.results ?? [])
            // Client-side filter by matching ratio on any packaging_level
            const matched = list.filter((prod: any) =>
                (prod.packaging_levels || []).some((lvl: any) => Number(lvl.ratio) === Number(pkg.ratio))
            )
            setProducts(matched)
        } catch { setProducts([]) }
        setProductsLoaded(true)
    }, [pkg.id, pkg.unit, pkg.ratio, productsLoaded])

    useEffect(() => {
        if (tab === 'links' && !rulesLoaded) loadRules()
        if (tab === 'products' && !productsLoaded) loadProducts()
    }, [tab, loadRules, loadProducts, rulesLoaded, productsLoaded])

    const handleAddLink = async () => {
        if (!newLink.category && !newLink.brand && !newLink.attribute) {
            toast.error('Pick at least one dimension'); return
        }
        try {
            await createPackagingRule({
                category: newLink.category ? Number(newLink.category) : null,
                brand: newLink.brand ? Number(newLink.brand) : null,
                attribute: newLink.attribute ? Number(newLink.attribute) : null,
                attribute_value: newLink.attribute_value || null,
                packaging: pkg.id!,
            })
            toast.success('Link added')
            setNewLink({ category: '', brand: '', attribute: '', attribute_value: '' })
            setAdding(false); setRulesLoaded(false); loadRules()
        } catch (e: any) { toast.error(e?.message || 'Failed to add link') }
    }
    const handleRemoveLink = async (id: number) => {
        if (!confirm('Remove this link?')) return
        try { await deletePackagingRule(id); toast.success('Removed'); setRulesLoaded(false); loadRules() }
        catch (e: any) { toast.error(e?.message || 'Failed') }
    }

    const tabs: { key: DetailTab; label: string; icon: any; count?: number | string; color: string }[] = [
        { key: 'overview', label: 'Overview', icon: <Layers size={12} />, color: 'var(--app-info)' },
        { key: 'links', label: 'Links', icon: <GitBranch size={12} />, count: rulesLoaded ? rules.length : undefined, color: '#8b5cf6' },
        { key: 'products', label: 'Products', icon: <Package size={12} />, count: productsLoaded ? products.length : undefined, color: 'var(--app-success)' },
        { key: 'economics', label: 'Economics', icon: <Calculator size={12} />, color: 'var(--app-warning)' },
        { key: 'barcode', label: 'Barcode', icon: <Barcode size={12} />, color: 'var(--app-info)' },
    ]

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-surface)' }}>
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                        style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Package size={15} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-black tracking-tight truncate">{pkg.name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {pkg.code && <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>{pkg.code}</span>}
                            <span className="text-[9px] font-mono font-bold"
                                style={{ color: 'var(--app-info)' }}>
                                ×{Number(pkg.ratio).toLocaleString()} {pkg.unit_code || pkg.unit_name}
                            </span>
                            {pkg.is_default && <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff' }}>Default</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {onPin && <button onClick={onPin} className="p-1.5 hover:bg-app-border/50 rounded-lg" title="Pin"><Bookmark size={13} /></button>}
                    <button onClick={onEdit} className="p-1.5 hover:bg-app-border/50 rounded-lg" title="Edit"><Pencil size={13} /></button>
                    <button onClick={onDelete} className="p-1.5 hover:bg-app-border/50 rounded-lg" title="Delete"><Trash2 size={13} style={{ color: 'var(--app-error)' }} /></button>
                    {onClose && <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg ml-1" title="Close"><X size={14} /></button>}
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex-shrink-0 flex items-center px-3 overflow-x-auto"
                style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', scrollbarWidth: 'none' }}>
                {tabs.map(t => {
                    const active = tab === t.key
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2.5 transition-all whitespace-nowrap"
                            style={{ color: active ? 'var(--app-foreground)' : 'var(--app-muted-foreground)', borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent', marginBottom: '-1px' }}>
                            {t.icon}
                            <span className="hidden sm:inline">{t.label}</span>
                            {t.count !== undefined && t.count > 0 && (
                                <span className="text-[9px] font-black px-1 py-0.5 rounded min-w-[16px] text-center"
                                    style={{ background: `color-mix(in srgb, ${t.color} 10%, transparent)`, color: t.color }}>{t.count}</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {tab === 'overview' && <OverviewTab pkg={pkg} />}
                {tab === 'links' && (
                    <LinksTab
                        pkg={pkg} rules={rules} loaded={rulesLoaded}
                        adding={adding} setAdding={setAdding}
                        newLink={newLink} setNewLink={setNewLink}
                        categories={categories} brands={brands} attributes={attributes}
                        onAdd={handleAddLink} onRemove={handleRemoveLink}
                    />
                )}
                {tab === 'products' && <ProductsTab products={products} loaded={productsLoaded} />}
                {tab === 'economics' && <EconomicsTab pkg={pkg} />}
                {tab === 'barcode' && <BarcodeTab pkg={pkg} />}
            </div>
        </div>
    )
}

/* ── Overview tab ─────────────────────────────────────── */
function OverviewTab({ pkg }: any) {
    const price = pkg.selling_price != null ? Number(pkg.selling_price) : null
    const rows: [string, any][] = [
        ['Unit', pkg.unit_name ? `${pkg.unit_name}${pkg.unit_code ? ` (${pkg.unit_code})` : ''}` : '—'],
        ['Ratio', `×${Number(pkg.ratio).toLocaleString()} ${pkg.unit_code || ''}`],
        ['Barcode', pkg.barcode || null],
        ['Selling Price', price != null && price > 0 ? price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : null],
        ['Default', pkg.is_default ? '✓ Default for unit' : null],
        ['Status', pkg.is_active === false ? '⚠ Inactive (hidden from product forms)' : 'Active'],
        ['Order', pkg.order ?? 0],
        ['Notes', pkg.notes || null],
    ]
    return (
        <div className="p-3 space-y-2 animate-in fade-in duration-150">
            {/* Stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                <StatTile label="Ratio" value={`×${Number(pkg.ratio).toLocaleString()}`} icon={<ArrowRightLeft size={12} />} color="var(--app-info)" />
                <StatTile label="Price" value={price ? price.toLocaleString() : '—'} icon={<DollarSign size={12} />} color="var(--app-warning)" />
                <StatTile label="Barcode" value={pkg.barcode ? 'Yes' : '—'} icon={<Barcode size={12} />} color={pkg.barcode ? 'var(--app-success)' : 'var(--app-muted-foreground)'} />
                <StatTile label="Status" value={pkg.is_active === false ? 'Inactive' : 'Active'} icon={<Power size={12} />} color={pkg.is_active === false ? 'var(--app-error)' : 'var(--app-success)'} />
            </div>

            {/* Details */}
            <div className="space-y-1.5">
                {rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                    <div key={k} className="flex items-start gap-3 px-3 py-2 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                        <span className="text-[9px] font-black uppercase tracking-widest w-24 flex-shrink-0 pt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>{k}</span>
                        <span className="text-[11px] font-bold text-app-foreground flex-1">{v}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function StatTile({ label, value, icon, color }: any) {
    return (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
            style={{ background: `color-mix(in srgb, ${color} 5%, var(--app-surface))`, border: `1px solid color-mix(in srgb, ${color} 15%, transparent)` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>{icon}</div>
            <div>
                <div className="text-sm font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{value}</div>
                <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
            </div>
        </div>
    )
}

/* ── Links tab ────────────────────────────────────────── */
function LinksTab({ pkg, rules, loaded, adding, setAdding, newLink, setNewLink, categories, brands, attributes, onAdd, onRemove }: any) {
    return (
        <div className="p-3 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                    {rules.length} link{rules.length !== 1 ? 's' : ''} — smart suggestion rules
                </p>
                <button onClick={() => setAdding(!adding)}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg"
                    style={adding ? { background: 'var(--app-surface)', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' } : { background: 'var(--app-primary)', color: '#fff' }}>
                    {adding ? <><X size={10} /> Cancel</> : <><Plus size={10} /> Add Link</>}
                </button>
            </div>

            {adding && (
                <div className="rounded-xl p-3 space-y-2"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                    <LinkSelect label="Category" icon={<FolderTree size={11} />} value={newLink.category} onChange={(v: string) => setNewLink({ ...newLink, category: v })} options={categories} />
                    <LinkSelect label="Brand" icon={<Tag size={11} />} value={newLink.brand} onChange={(v: string) => setNewLink({ ...newLink, brand: v })} options={brands} />
                    <LinkSelect label="Attribute" icon={<Layers size={11} />} value={newLink.attribute} onChange={(v: string) => setNewLink({ ...newLink, attribute: v })} options={attributes} />
                    {newLink.attribute && (
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Value</label>
                            <input value={newLink.attribute_value} onChange={(e) => setNewLink({ ...newLink, attribute_value: e.target.value })}
                                placeholder="e.g. Big, Red, XL"
                                className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-bold outline-none"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    )}
                    <button onClick={onAdd}
                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider py-2 rounded-lg"
                        style={{ background: 'var(--app-primary)', color: '#fff' }}>
                        <Check size={12} /> Create Link
                    </button>
                </div>
            )}

            {!loaded ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-app-primary" /></div>
            ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Sparkles size={22} className="text-app-muted-foreground mb-2 opacity-40" />
                    <p className="text-[12px] font-bold text-app-muted-foreground">No links yet</p>
                    <p className="text-[10px] text-app-muted-foreground mt-1 max-w-[240px]">Link this package to a category, brand, or attribute so the smart engine suggests it during product creation.</p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {rules.map((r: any) => (
                        <div key={r.id} className="flex items-center gap-2 p-2 rounded-xl group"
                            style={{ background: 'color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                            <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
                                {r.category_name && <Chip icon={<FolderTree size={9} />} color="var(--app-success)">{r.category_name}</Chip>}
                                {r.brand_name && <Chip icon={<Tag size={9} />} color="#8b5cf6">{r.brand_name}</Chip>}
                                {r.attribute_name && <Chip icon={<Layers size={9} />} color="var(--app-warning)">{r.attribute_name}{r.attribute_value ? `=${r.attribute_value}` : ''}</Chip>}
                            </div>
                            <span className="text-[9px] font-mono flex items-center gap-0.5" title={`Priority: ${r.effective_priority}`} style={{ color: 'var(--app-primary)' }}>
                                <Zap size={9} />p{r.effective_priority}
                            </span>
                            {r.usage_count > 0 && (
                                <span className="text-[9px] font-bold flex items-center gap-0.5" title={`Used ${r.usage_count} times`}
                                    style={{ color: 'var(--app-warning)' }}>
                                    <TrendingUp size={9} />{r.usage_count}
                                </span>
                            )}
                            <button onClick={() => onRemove(r.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-app-border/50">
                                <Trash2 size={10} style={{ color: 'var(--app-error)' }} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function LinkSelect({ label, icon, value, onChange, options }: any) {
    return (
        <div>
            <label className="text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: 'var(--app-muted-foreground)' }}>{icon} {label}</label>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-bold outline-none"
                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                <option value="">— Any {label.toLowerCase()} (wildcard) —</option>
                {options.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
        </div>
    )
}

function Chip({ icon, color, children }: any) {
    return (
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-lg"
            style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
            {icon}{children}
        </span>
    )
}

/* ── Products tab ─────────────────────────────────────── */
function ProductsTab({ products, loaded }: any) {
    if (!loaded) return <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-app-primary" /></div>
    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <Package size={22} className="text-app-muted-foreground mb-2 opacity-40" />
                <p className="text-[12px] font-bold text-app-muted-foreground">No products using this ratio yet</p>
                <p className="text-[10px] text-app-muted-foreground mt-1 max-w-[240px]">Products adopt this package during creation — the smart engine will propose it when category / brand / attribute matches.</p>
            </div>
        )
    }
    return (
        <div className="p-3 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>
                {products.length} product{products.length !== 1 ? 's' : ''} with matching packaging ratio
            </p>
            {products.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-app-surface/50 transition-all group">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}><Package size={11} /></div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold truncate">{p.name}</div>
                        <div className="flex items-center gap-1.5">
                            {p.sku && <span className="font-mono text-[9px] font-bold text-app-muted-foreground">{p.sku}</span>}
                            {p.brand_name && <span className="text-[9px]" style={{ color: 'var(--app-muted-foreground)' }}>{p.brand_name}</span>}
                        </div>
                    </div>
                    <a href={`/inventory/products/${p.id}`} target="_blank" rel="noreferrer"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-app-border/50">
                        <ExternalLink size={11} />
                    </a>
                </div>
            ))}
        </div>
    )
}

/* ── Economics tab ────────────────────────────────────── */
function EconomicsTab({ pkg }: any) {
    const ratio = Number(pkg.ratio ?? 1)
    const price = pkg.selling_price != null ? Number(pkg.selling_price) : null
    const pricePerBase = price != null && ratio > 0 ? price / ratio : null

    return (
        <div className="p-3 space-y-3 animate-in fade-in duration-150">
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'color-mix(in srgb, var(--app-warning) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)' }}>
                <Calculator size={18} style={{ color: 'var(--app-warning)' }} />
                <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-warning)' }}>Price-per-base unit</p>
                    <p className="text-[12px] font-black tabular-nums mt-0.5" style={{ color: 'var(--app-foreground)' }}>
                        {pricePerBase != null
                            ? `${pricePerBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / ${pkg.unit_code || 'base unit'}`
                            : '— set a selling price to compute'}
                    </p>
                </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 20%, transparent)', color: 'var(--app-muted-foreground)' }}>
                    Conversion math
                </div>
                <div className="p-3 space-y-2 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                        <span className="font-black">1</span><span style={{ color: 'var(--app-muted-foreground)' }}>pack</span>
                        <ChevronRight size={11} className="text-app-muted-foreground" />
                        <span className="font-black" style={{ color: 'var(--app-info)' }}>{ratio}</span><span style={{ color: 'var(--app-muted-foreground)' }}>{pkg.unit_code || 'base units'}</span>
                    </div>
                    {price != null && price > 0 && (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="font-black">1</span><span style={{ color: 'var(--app-muted-foreground)' }}>pack</span>
                                <ChevronRight size={11} className="text-app-muted-foreground" />
                                <span className="font-black" style={{ color: 'var(--app-warning)' }}>{price.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-black">1</span><span style={{ color: 'var(--app-muted-foreground)' }}>{pkg.unit_code || 'base'}</span>
                                <ChevronRight size={11} className="text-app-muted-foreground" />
                                <span className="font-black" style={{ color: 'var(--app-warning)' }}>{pricePerBase!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <p className="text-[10px] text-app-muted-foreground leading-relaxed">
                When products adopt this package, the selling_price seeds each product's packaging level. Margin computation (retail − cost) happens per-product once cost is defined.
            </p>
        </div>
    )
}

/* ── Barcode tab ──────────────────────────────────────── */
function BarcodeTab({ pkg }: any) {
    const bc = pkg.barcode || ''
    const format = detectBarcodeFormat(bc)
    const isValid = format.valid

    const copyBarcode = () => {
        try { navigator.clipboard?.writeText(bc); toast.success('Copied') } catch { toast.error('Copy failed') }
    }

    if (!bc) {
        return (
            <div className="p-3">
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Barcode size={26} className="text-app-muted-foreground mb-2 opacity-40" />
                    <p className="text-[12px] font-bold text-app-muted-foreground">No barcode configured</p>
                    <p className="text-[10px] text-app-muted-foreground mt-1 max-w-[240px]">Edit this package to add a barcode. Products can then scan this package directly without a product-level override.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-3 space-y-3 animate-in fade-in duration-150">
            {/* Scan-ready card */}
            <div className="rounded-2xl p-4 text-center"
                style={{
                    background: 'var(--app-background)',
                    border: `2px solid ${isValid ? 'color-mix(in srgb, var(--app-success) 30%, transparent)' : 'color-mix(in srgb, var(--app-error) 30%, transparent)'}`,
                }}>
                <div className="flex items-center justify-center gap-2 mb-3">
                    <Barcode size={18} style={{ color: isValid ? 'var(--app-success)' : 'var(--app-error)' }} />
                    <span className="text-[10px] font-black uppercase tracking-widest"
                        style={{ color: isValid ? 'var(--app-success)' : 'var(--app-error)' }}>
                        {format.name}{isValid ? ' · Valid' : ' · Invalid check digit'}
                    </span>
                </div>
                <div className="font-mono text-[18px] font-black tracking-[0.15em]" style={{ color: 'var(--app-foreground)' }}>{bc}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest mt-2" style={{ color: 'var(--app-muted-foreground)' }}>
                    {bc.length} digits
                </div>
                <button onClick={copyBarcode}
                    className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--app-primary)', color: '#fff' }}>
                    <Copy size={10} /> Copy
                </button>
            </div>

            <div className="rounded-xl px-3 py-2 text-[10px] leading-relaxed"
                style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)', color: 'var(--app-muted-foreground)' }}>
                <div className="flex items-start gap-1.5">
                    <ShieldCheck size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info)' }} />
                    <span>
                        Format auto-detected by length + check-digit math. Products scanning this barcode at POS will match this package's ratio + price defaults.
                    </span>
                </div>
            </div>
        </div>
    )
}

/* Simple barcode format detection */
function detectBarcodeFormat(bc: string): { name: string; valid: boolean } {
    if (!bc) return { name: 'NONE', valid: false }
    const digits = bc.replace(/\D/g, '')
    const validCheckDigit = (code: string) => {
        const body = code.slice(0, -1)
        const check = Number(code.slice(-1))
        let sum = 0
        for (let i = 0; i < body.length; i++) {
            sum += Number(body[i]) * ((body.length - i) % 2 === 0 ? 1 : 3)
        }
        const calc = (10 - (sum % 10)) % 10
        return calc === check
    }
    if (digits.length === 13) return { name: 'EAN-13', valid: validCheckDigit(digits) }
    if (digits.length === 12) return { name: 'UPC-A', valid: validCheckDigit(digits) }
    if (digits.length === 14) return { name: 'GTIN-14', valid: validCheckDigit(digits) }
    if (digits.length === 8) return { name: 'EAN-8', valid: validCheckDigit(digits) }
    return { name: `Custom (${bc.length})`, valid: true }
}

/* ═══════════════════════════════════════════════════════════
 *  FORM MODAL (unchanged from earlier)
 * ═══════════════════════════════════════════════════════════ */
function PackageFormModal({ pkg, units, onSave, onClose }: any) {
    const [form, setForm] = useState<any>({
        unit: pkg?.unit ?? units[0]?.id ?? 0,
        name: pkg?.name ?? '',
        code: pkg?.code ?? '',
        ratio: pkg?.ratio ?? 1,
        barcode: pkg?.barcode ?? '',
        selling_price: pkg?.selling_price ?? null,
        image_url: pkg?.image_url ?? '',
        is_active: pkg?.is_active ?? true,
        is_default: pkg?.is_default ?? false,
        order: pkg?.order ?? 0,
        notes: pkg?.notes ?? '',
    })
    const [saving, setSaving] = useState(false)

    const submit = async () => {
        if (!form.name?.trim()) { toast.error('Name is required'); return }
        if (!form.unit) { toast.error('Pick a unit'); return }
        setSaving(true)
        try { await onSave(form) } finally { setSaving(false) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-xl rounded-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-primary)' }}>
                            <Package size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black">{pkg ? 'Edit Package' : 'New Package'}</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                {pkg ? `${pkg.code || ''} · ${pkg.name}` : 'First-class packaging template'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-app-border/30"><X size={16} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField label="Name *" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} placeholder="Pack of 6" />
                        <FormField label="Code" value={form.code} onChange={(v: string) => setForm({ ...form, code: v })} placeholder="PK6" mono />
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Unit *</label>
                            <select value={form.unit} onChange={e => setForm({ ...form, unit: Number(e.target.value) })}
                                className="w-full px-3 py-2 rounded-xl outline-none text-[12px] font-bold"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}{u.code ? ` (${u.code})` : ''}</option>)}
                            </select>
                        </div>
                        <FormField label="Ratio (base units)" value={String(form.ratio)} onChange={(v: string) => setForm({ ...form, ratio: Number(v) || 1 })} mono placeholder="6" />
                        <FormField label="Barcode" value={form.barcode} onChange={(v: string) => setForm({ ...form, barcode: v })} placeholder="6001234000001" mono />
                        <FormField label="Selling Price" value={form.selling_price != null ? String(form.selling_price) : ''} onChange={(v: string) => setForm({ ...form, selling_price: v ? Number(v) : null })} placeholder="2800" mono />
                    </div>
                    <FormField label="Image URL" value={form.image_url} onChange={(v: string) => setForm({ ...form, image_url: v })} placeholder="https://…" />
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                            <input type="checkbox" checked={form.is_default ?? false} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
                            Set as default package for this unit
                        </label>
                        <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                            <input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                            Active
                        </label>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Notes</label>
                        <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}
                            rows={2} className="w-full px-3 py-2 rounded-xl outline-none text-[12px]"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                    </div>
                </div>

                <div className="px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)', borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onClose} disabled={saving} className="text-[11px] font-bold px-3 py-2 rounded-xl" style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button onClick={submit} disabled={saving}
                        className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-xl"
                        style={{ background: 'var(--app-primary)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {pkg ? 'Save Changes' : 'Create Package'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function FormField({ label, value, onChange, placeholder, mono }: any) {
    return (
        <div>
            <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{label}</label>
            <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className={`w-full px-3 py-2 rounded-xl outline-none text-[12px] ${mono ? 'font-mono font-bold' : 'font-medium'}`}
                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
        </div>
    )
}
