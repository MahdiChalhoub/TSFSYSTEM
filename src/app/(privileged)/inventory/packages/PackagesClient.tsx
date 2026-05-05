'use client'

/* ═══════════════════════════════════════════════════════════
 *  PackagesClient — UnitPackage TEMPLATE catalog
 *
 *  Templates define the SHAPE of a packaging (name + ratio + unit).
 *  They do NOT carry barcode or price — those belong to each product's
 *  own ProductPackaging instance. Templates are reusable across products
 *  and drive the Smart Suggestion Engine via PackagingSuggestionRule.
 *
 *  Flow:
 *    1. Define templates here (e.g. "Pack of 6" ×6 Piece)
 *    2. Link templates to categories / brands / attributes (Links tab)
 *    3. When a user creates a product, the engine suggests templates
 *       matching that product's category / brand / attributes. The
 *       product then adopts the template and fills in its OWN barcode
 *       and price at the ProductPackaging level.
 *
 *  Same TreeMasterPage shell as Units / Categories — grouped by unit,
 *  split-panel, focus mode, tour, keyboard shortcuts.
 * ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useCallback, useEffect, useContext } from 'react'
import type { ReactNode } from 'react'
import {
    Package, Plus, Pencil, Trash2, Ruler, ArrowRight, ArrowRightLeft, Layers,
    Loader2, X, Check, ChevronRight, Box, Sparkles, Bookmark,
    GitBranch, Tag, ShieldCheck, FolderTree, ExternalLink, Zap,
    TrendingUp, Info, Archive, History, User as UserIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { PageTour } from '@/components/ui/PageTour'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { erpFetch } from '@/lib/erp-api'
import {
    createPackagingRule, deletePackagingRule,
} from '@/app/actions/inventory/packaging-suggestions'
import { TemplateFormModal } from './_shared/TemplateFormModal'
import { buildPackagesDataTools } from './_lib/dataTools'
import { AdminContext } from '@/context/AdminContext'
import '@/lib/tours/definitions/inventory-packages'

type Option = { id: number; name: string; code?: string }
type Template = {
    id: number
    unit: number
    unit_name?: string
    unit_code?: string
    parent?: number | null
    parent_name?: string | null
    parent_ratio?: number | null
    name: string
    code?: string | null
    ratio: number
    is_default?: boolean
    order?: number
    notes?: string | null
    created_at?: string
    updated_at?: string
}

type UnitOption = {
    id: number
    name: string
    code?: string
    base_unit?: number | null
    conversion_factor?: number
    needs_balance?: boolean
    type?: string
}

type UnitNode = {
    id: string
    _type: 'unit'
    _unit: UnitOption
    name: string
    code?: string
    children: TemplateNode[]
}

type TemplateNode = {
    id: string
    _type: 'template'
    _tpl: Template
    name: string
    code?: string | null
    children: TemplateNode[]
}

type RuleRow = {
    id: number
    category_name?: string
    brand_name?: string
    attribute_name?: string
    attribute_value?: string
    effective_priority?: number
    usage_count?: number
}

type ProductPackagingRow = {
    id: number
    product?: number
    /** Product-level identity — shown as the row's main title. */
    product_name?: string
    product_sku?: string
    /** Product-level fallback barcode (the master SKU's own scan code). */
    product_barcode?: string
    /** Per-package display name, e.g. "Can 330ml" — describes the package
     *  shape this product was sold in, not the product itself. */
    display_name?: string
    /** Per-package SKU (independent of the product SKU). */
    sku?: string
    /** Per-package barcode — what scans at the POS for THIS specific
     *  packaging level. Distinct from `product_barcode` (the base SKU). */
    barcode?: string
    effective_selling_price?: number
    ratio?: number | string
    unit?: number
    /** Template this row officially adopted (set by backend auto-link or
     *  explicit clone). When equal to the panel's template id, the row is
     *  badged as a strict adopter. */
    template?: number | null
}

interface Props {
    initialTemplates: Template[]
    units: UnitOption[]
    categories: Option[]
    brands: Option[]
    attributes: Option[]
    attributeValuesByParent?: Record<number, Option[]>
    loadErrors?: Record<string, string>
}

export default function PackagesClient({ initialTemplates, units, categories, brands, attributes, attributeValuesByParent, loadErrors, currentUser }: Props & { currentUser?: { is_staff?: boolean; is_superuser?: boolean } | null }) {
    const router = useRouter()
    const [templates, setTemplates] = useState<Template[]>(initialTemplates)
    const [editing, setEditing] = useState<Template | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
    // Toolbar toggle: include archived rows in the listing. Backend
    // filterset surfaces it via `?include_archived=1`. Defaults off so
    // the catalog view stays focused on active templates.
    const [showArchived, setShowArchived] = useState(false)
    // Bulk-delete request — same pattern as the Units page. We capture
    // the toolbar's `clear` callback so the dialog can wipe the
    // selection after a successful run.
    const [bulkDeleteRequest, setBulkDeleteRequest] = useState<{ ids: number[]; clear: () => void } | null>(null)
    const [bulkDeleting, setBulkDeleting] = useState(false)
    // Bulk-archive request — flips `is_archived` on every selected row.
    // Lower-friction than delete because templates retain their history.
    const [bulkArchiveRequest, setBulkArchiveRequest] = useState<{ ids: number[]; clear: () => void } | null>(null)
    const [bulkArchiving, setBulkArchiving] = useState(false)
    const isStaff = !!(currentUser?.is_staff || currentUser?.is_superuser)

    useEffect(() => { setTemplates(initialTemplates) }, [initialTemplates])

    // Surface server-side load failures once on mount so empty dropdowns don't look "broken"
    useEffect(() => {
        if (!loadErrors) return
        const keys = Object.keys(loadErrors)
        if (keys.length === 0) return
        toast.error(`Could not load: ${keys.join(', ')}`, {
            description: 'Some lists may appear empty. Refresh or check backend connectivity.',
        })
    }, [loadErrors])

    const refresh = useCallback(async () => {
        try {
            // Hides archived rows by default. The toolbar toggle adds
            // `?include_archived=1` so admins can review / restore them
            // without leaving the page.
            const url = showArchived ? 'unit-packages/?include_archived=1' : 'unit-packages/'
            const data = await erpFetch(url, { cache: 'no-store' } as RequestInit) as { results?: Template[] } | Template[]
            setTemplates(Array.isArray(data) ? data : (data?.results ?? []))
        } catch (e: unknown) {
            toast.error('Failed to refresh templates', { description: e instanceof Error ? e.message : 'network error' })
        }
        router.refresh()
    }, [router, showArchived])

    // Re-fetch when the archived toggle flips so the operator sees the
    // change immediately without waiting for the next manual refresh.
    useEffect(() => { refresh() }, [showArchived, refresh])

    /* ── Stats ────────────────────────────────────────────── */
    const stats = useMemo(() => {
        const defaults = templates.filter(t => t.is_default).length
        const unitsUsed = new Set(templates.map(t => t.unit)).size
        const avgRatio = templates.length
            ? Math.round(templates.reduce((s, t) => s + Number(t.ratio || 1), 0) / templates.length * 10) / 10
            : 0
        const ratios = new Set(templates.map(t => Number(t.ratio || 1)))
        return { total: templates.length, defaults, unitsUsed, avgRatio, distinctRatios: ratios.size }
    }, [templates])

    /* ── Tree of Units → Packaging CHAIN (pc → pack → box → pallet → TC) ────
     *  Each unit family groups its templates; within that group we build a
     *  parent→child tree using UnitPackage.parent. Roots (parent=null) sit
     *  at the top of the chain for each unit. Orphans (parent set but parent
     *  deleted) get surfaced at the unit root to avoid hiding them.
     */
    const tree = useMemo<UnitNode[]>(() => {
        const byUnit: Record<string, UnitNode> = {}
        units.forEach((u) => {
            byUnit[u.id] = { id: `unit-${u.id}`, _type: 'unit', _unit: u, name: u.name, code: u.code, children: [] }
        })
        // Index templates by id for child lookup
        const tplById = new Map<number, Template>()
        templates.forEach(t => tplById.set(t.id, t))

        // Build node for each template and link parent→children within the same unit
        const nodesById: Record<number, TemplateNode> = {}
        templates.forEach(t => {
            nodesById[t.id] = { id: `tpl-${t.id}`, _type: 'template', _tpl: t, name: t.name, code: t.code, children: [] }
        })

        templates.forEach(t => {
            const node = nodesById[t.id]
            if (t.parent && nodesById[t.parent] && tplById.get(t.parent)?.unit === t.unit) {
                nodesById[t.parent].children.push(node)
            } else if (byUnit[t.unit]) {
                // No valid parent within this unit → root under the unit
                byUnit[t.unit].children.push(node)
            }
        })

        // Sort: each level by ratio ascending (so the chain reads pc→pack→box)
        const sortChildren = (n: { children: TemplateNode[] }) => {
            n.children.sort((a, b) => Number(a._tpl?.ratio || 0) - Number(b._tpl?.ratio || 0))
            n.children.forEach(sortChildren)
        }
        Object.values(byUnit).forEach(sortChildren)

        const populated = Object.values(byUnit).filter((u) => u.children.length > 0)
        populated.sort((a, b) => {
            const aBase = !a._unit?.base_unit
            const bBase = !b._unit?.base_unit
            if (aBase !== bBase) return aBase ? -1 : 1
            return (a.name || '').localeCompare(b.name || '')
        })
        return populated
    }, [templates, units])

    /* ── Handlers ─────────────────────────────────────────── */
    const openNewForm = useCallback(() => { setEditing(null); setShowForm(true) }, [])
    const openEditForm = useCallback((t: Template) => { setEditing(t); setShowForm(true) }, [])
    const closeForm = useCallback(() => { setShowForm(false); setEditing(null) }, [])

    const handleSave = async (data: Record<string, unknown>) => {
        try {
            if (editing?.id) {
                await erpFetch(`unit-packages/${editing.id}/`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
                toast.success('Template updated')
            } else {
                await erpFetch(`unit-packages/`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
                toast.success('Template created')
            }
            closeForm()
            refresh()
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    }

    const [seeding, setSeeding] = useState(false)
    const handleSeedDefaults = async () => {
        if (seeding) return
        setSeeding(true)
        try {
            const res = await erpFetch('unit-packages/seed_defaults/', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
            }) as { created?: unknown[]; message?: string }
            const n = Array.isArray(res?.created) ? res.created.length : 0
            if (n > 0) {
                toast.success(res?.message || `Seeded ${n} templates`)
                refresh()
            } else {
                toast.info('All units already have templates — nothing to seed.')
            }
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Seed failed')
        } finally {
            setSeeding(false)
        }
    }

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const t = deleteTarget
        setDeleteTarget(null)
        try {
            await erpFetch(`unit-packages/${t.id}/`, { method: 'DELETE' })
            toast.success(`"${t.name}" deleted`)
            refresh()
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
    }

    const handleBulkDelete = async () => {
        if (!bulkDeleteRequest) return
        const { ids, clear } = bulkDeleteRequest
        setBulkDeleting(true)
        let ok = 0, fail = 0
        for (const id of ids) {
            try {
                await erpFetch(`unit-packages/${id}/`, { method: 'DELETE' })
                ok++
            } catch { fail++ }
        }
        setBulkDeleting(false)
        setBulkDeleteRequest(null)
        if (ok) toast.success(`Deleted ${ok} template${ok === 1 ? '' : 's'}`)
        if (fail) toast.error(`${fail} template${fail === 1 ? '' : 's'} failed — may be referenced by ProductPackagings`)
        clear()
        refresh()
    }

    // Toggle archive across the selected set. If everything is already
    // archived, restore them; otherwise archive the rest. Mirrors the
    // single-row "Restore" button on archived rows.
    const handleBulkArchive = async () => {
        if (!bulkArchiveRequest) return
        const { ids, clear } = bulkArchiveRequest
        setBulkArchiving(true)
        const allArchived = ids.every(id => templates.find(t => t.id === id)?.is_archived)
        const target = !allArchived
        let ok = 0, fail = 0
        for (const id of ids) {
            try {
                await erpFetch(`unit-packages/${id}/`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_archived: target }),
                })
                ok++
            } catch { fail++ }
        }
        setBulkArchiving(false)
        setBulkArchiveRequest(null)
        if (ok) toast.success(`${target ? 'Archived' : 'Restored'} ${ok} template${ok === 1 ? '' : 's'}`)
        if (fail) toast.error(`${fail} template${fail === 1 ? '' : 's'} failed`)
        clear()
        refresh()
    }

    return (
        <TreeMasterPage
            config={{
                title: 'Package Templates',
                subtitle: `${stats.total} template${stats.total !== 1 ? 's' : ''} · ${stats.unitsUsed} unit familie${stats.unitsUsed !== 1 ? 's' : ''}`,
                icon: <Package size={20} />,
                iconColor: 'var(--app-primary)',
                tourId: 'inventory-packages',
                kpis: [
                    { label: 'Templates', value: stats.total, icon: <Box size={11} />, color: 'var(--app-primary)' },
                    { label: 'Unit Families', value: stats.unitsUsed, icon: <Ruler size={11} />, color: 'var(--app-info, #3b82f6)' },
                    { label: 'Defaults', value: stats.defaults, icon: <Sparkles size={11} />, color: 'var(--app-info)' },
                    { label: 'Distinct Ratios', value: stats.distinctRatios, icon: <ArrowRightLeft size={11} />, color: 'var(--app-warning, #f59e0b)' },
                    { label: 'Avg Ratio', value: `×${stats.avgRatio}`, icon: <TrendingUp size={11} />, color: 'var(--app-muted-foreground)' },
                ],
                searchPlaceholder: 'Search templates by name, code, unit… (Ctrl+K)',
                primaryAction: { label: 'New Template', icon: <Plus size={14} />, onClick: openNewForm, dataTour: 'add-btn' },
                secondaryActions: [
                    { label: showArchived ? 'Hide archived' : 'Show archived', icon: <Archive size={13} />, onClick: () => setShowArchived(s => !s), active: showArchived, activeColor: 'var(--app-warning)', dataTour: 'pkg-archive-toggle' },
                    { label: 'Units', icon: <Ruler size={13} />, href: '/inventory/units' },
                    { label: 'Rules', icon: <ShieldCheck size={13} />, href: '/inventory/packaging-suggestions' },
                ],
                dataTools: buildPackagesDataTools(templates, units),
                selectable: true,
                onBulkDelete: (ids, clear) => setBulkDeleteRequest({ ids, clear }),
                // Custom bulk-action toolbar adds an "Archive" verb next
                // to the default Move/Delete pair so the operator can
                // soft-deactivate without losing history.
                bulkActions: ({ count, ids, clearSelection }) => (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-2xl animate-in slide-in-from-bottom-4 duration-200"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 12px 36px rgba(0,0,0,0.22)' }}>
                        <div className="px-3 py-1.5 rounded-xl text-tp-sm font-bold"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                            {count} selected
                        </div>
                        <button type="button"
                            onClick={() => setBulkArchiveRequest({ ids, clear: clearSelection })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold transition-all hover:-translate-y-0.5"
                            style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', color: 'var(--app-warning, #f59e0b)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)' }}>
                            <Archive size={13} /> {showArchived ? 'Restore / archive' : 'Archive'}
                        </button>
                        <button type="button"
                            onClick={() => setBulkDeleteRequest({ ids, clear: clearSelection })}
                            disabled={!isStaff}
                            title={isStaff ? 'Permanently delete the selected templates' : 'Only staff can hard-delete templates'}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)' }}>
                            <Trash2 size={13} /> Delete
                        </button>
                        <button type="button" onClick={clearSelection}
                            title="Clear selection (Esc)"
                            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:bg-app-border/40"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            <X size={14} />
                        </button>
                    </div>
                ),
                columnHeaders: [
                    { label: 'Template', width: 'auto', sortKey: 'name' },
                    { label: 'Ratio', width: '60px', color: 'var(--app-info)', hideOnMobile: true, sortKey: 'ratio' },
                    { label: 'Links', width: '48px', color: 'var(--app-info)', hideOnMobile: true, sortKey: 'link_count' },
                    { label: 'Used By', width: '60px', color: 'var(--app-success)', hideOnMobile: true, sortKey: 'used_by_count' },
                ],
                footerLeft: (
                    <>
                        <span>{stats.total} templates</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.defaults} defaults</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>templates define shape · products supply barcode + price</span>
                    </>
                ),
                onRefresh: async () => { await refresh() },
            }}
            modals={<>
                {showForm && (
                    <TemplateFormModal
                        tpl={editing ? {
                            id: editing.id,
                            unit: editing.unit,
                            parent: editing.parent,
                            parent_ratio: editing.parent_ratio,
                            name: editing.name,
                            code: editing.code ?? undefined,
                            ratio: editing.ratio,
                            is_default: editing.is_default,
                            order: editing.order,
                            notes: editing.notes ?? undefined,
                            unit_code: editing.unit_code,
                        } : null}
                        units={units.map((u) => ({ id: u.id, name: u.name, code: u.code }))}
                        allTemplates={templates.map((t) => ({
                            id: t.id,
                            unit: t.unit,
                            parent: t.parent,
                            parent_ratio: t.parent_ratio,
                            name: t.name,
                            code: t.code ?? undefined,
                            ratio: t.ratio,
                            is_default: t.is_default,
                            order: t.order,
                            notes: t.notes ?? undefined,
                            unit_code: t.unit_code,
                        }))}
                        onSave={handleSave}
                        onClose={closeForm}
                    />
                )}
                <ConfirmDialog
                    open={deleteTarget !== null}
                    onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                    onConfirm={handleConfirmDelete}
                    title={`Delete template "${deleteTarget?.name}"?`}
                    description="Products currently using this template shape keep their existing ProductPackaging rows. Suggestion rules targeting this template are removed."
                    confirmText="Delete" variant="danger"
                />
                <ConfirmDialog
                    open={bulkDeleteRequest !== null}
                    onOpenChange={(o) => { if (!o && !bulkDeleting) setBulkDeleteRequest(null) }}
                    onConfirm={handleBulkDelete}
                    title={`Delete ${bulkDeleteRequest?.ids.length ?? 0} template${(bulkDeleteRequest?.ids.length ?? 0) === 1 ? '' : 's'}?`}
                    description="Templates referenced by existing ProductPackaging rows may fail to delete — those will be reported back so you can fix them and retry. Past ProductPackagings keep their data."
                    confirmText={bulkDeleting ? 'Deleting…' : 'Delete'}
                    variant="danger"
                />
                <ConfirmDialog
                    open={bulkArchiveRequest !== null}
                    onOpenChange={(o) => { if (!o && !bulkArchiving) setBulkArchiveRequest(null) }}
                    onConfirm={handleBulkArchive}
                    title={
                        (bulkArchiveRequest?.ids ?? []).every(id => templates.find(t => t.id === id)?.is_archived)
                            ? `Restore ${bulkArchiveRequest?.ids.length ?? 0} template${(bulkArchiveRequest?.ids.length ?? 0) === 1 ? '' : 's'}?`
                            : `Archive ${bulkArchiveRequest?.ids.length ?? 0} template${(bulkArchiveRequest?.ids.length ?? 0) === 1 ? '' : 's'}?`
                    }
                    description="Archived templates are hidden from default listings and the suggestion engine. Existing ProductPackaging rows that reference them stay intact. Toggle ‘Show archived’ in the toolbar to view / restore."
                    confirmText={bulkArchiving ? 'Working…' : 'Confirm'}
                />
            </>}
            detailPanel={(rawNode, { onClose, onPin }) => {
                const node = rawNode as unknown as UnitNode | TemplateNode
                if (node._type !== 'template') return null
                return (
                    <TemplateDetailPanel
                        tpl={node._tpl}
                        categories={categories}
                        brands={brands}
                        attributes={attributes}
                        attributeValuesByParent={attributeValuesByParent}
                        onEdit={() => openEditForm(node._tpl)}
                        onDelete={() => setDeleteTarget(node._tpl)}
                        onClose={onClose}
                        onPin={onPin ? () => onPin(rawNode) : undefined}
                    />
                )
            }}
        >
            {({ searchQuery, expandAll, expandKey, splitPanel, pinnedSidebar, selectedNode, setSelectedNode, sidebarNode, setSidebarNode, setSidebarTab }) => {
                const q = searchQuery.trim().toLowerCase()
                const filteredTree: UnitNode[] = q
                    ? tree.map((u) => ({
                        ...u,
                        children: u.children.filter((c) => {
                            const t = c._tpl
                            return (t.name || '').toLowerCase().includes(q)
                                || (t.code || '').toLowerCase().includes(q)
                                || (u.name || '').toLowerCase().includes(q)
                        }),
                    })).filter((u) => u.children.length > 0)
                    : tree

                if (filteredTree.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Package size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground mb-1">
                                {q ? 'No matching templates' : 'No package templates yet'}
                            </p>
                            <p className="text-tp-sm text-app-muted-foreground mb-5 max-w-sm">
                                {q ? 'Try a different term.' : 'Define the SHAPE of your packagings — "Pack of 6", "Carton 24", "Pallet 144" — then link them to categories / brands / attributes. Products will adopt the shape and supply their own barcode + price.'}
                            </p>
                            {!q && (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="flex items-center gap-2 flex-wrap justify-center">
                                        <button onClick={openNewForm} className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold">
                                            <Plus size={16} className="inline mr-1.5" />Create First Template
                                        </button>
                                        <button
                                            onClick={handleSeedDefaults}
                                            disabled={seeding || units.length === 0}
                                            className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                                            style={{ background: 'color-mix(in srgb, var(--app-accent) 12%, transparent)', color: 'var(--app-accent)', border: '1px solid color-mix(in srgb, var(--app-accent) 40%, transparent)' }}
                                            title={units.length === 0 ? 'Define a unit first' : 'Bootstrap Pack → Carton → Pallet chain for every unit that has no templates yet'}
                                        >
                                            {seeding ? (
                                                <><Loader2 size={16} className="inline mr-1.5 animate-spin" />Seeding…</>
                                            ) : (
                                                <><Sparkles size={16} className="inline mr-1.5" />Seed starter chains</>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-tp-xxs text-app-muted-foreground max-w-xs">
                                        Starter chain = Pack of 6 → Carton of 24 → Pallet of 144, created once per unit. Safe to click — won't touch units that already have templates.
                                    </p>
                                </div>
                            )}
                        </div>
                    )
                }

                return filteredTree.map((unitNode) => (
                    <UnitGroup key={`${unitNode.id}-${expandKey}`} node={unitNode} forceExpanded={expandAll}
                        selectedId={((splitPanel || pinnedSidebar) ? (selectedNode as { id?: string } | null)?.id : (sidebarNode as { id?: string } | null)?.id) ?? null}
                        onOpenTemplate={(tplNode) => {
                            if (splitPanel || pinnedSidebar) setSelectedNode(tplNode)
                            else { setSidebarNode(tplNode); setSidebarTab('overview') }
                        }}
                        onEdit={(t: Template) => openEditForm(t)}
                        onDelete={(t: Template) => setDeleteTarget(t)}
                    />
                ))
            }}
        </TreeMasterPage>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  UNIT GROUP
 * ═══════════════════════════════════════════════════════════ */
interface UnitGroupProps {
    node: UnitNode
    forceExpanded?: boolean
    selectedId: string | null
    onOpenTemplate: (n: TemplateNode) => void
    onEdit: (t: Template) => void
    onDelete: (t: Template) => void
}
function UnitGroup({ node, forceExpanded, selectedId, onOpenTemplate, onEdit, onDelete }: UnitGroupProps) {
    const [open, setOpen] = useState(forceExpanded ?? true)
    useEffect(() => { if (forceExpanded !== undefined) setOpen(forceExpanded) }, [forceExpanded])
    const unit = node._unit
    const kids = node.children
    const isBase = unit && !unit.base_unit
    const unitType = unit?.type || (unit?.needs_balance ? 'Weight' : isBase ? 'Base' : 'Derived')

    return (
        <div>
            <div onClick={() => setOpen(o => !o)}
                className="group flex items-center gap-2.5 cursor-pointer py-2.5 md:py-3 hover:bg-app-surface-hover relative transition-colors"
                style={{
                    paddingLeft: 12, paddingRight: 12,
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                }}>
                <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
                    style={{ background: 'var(--app-info)' }} />
                <button className="w-5 h-5 flex items-center justify-center rounded-md">
                    <ChevronRight size={14}
                        className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                        style={{ color: open ? 'var(--app-info)' : 'var(--app-muted-foreground)' }} />
                </button>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-info) 15%, transparent)', color: 'var(--app-info)' }}>
                    <Ruler size={13} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-tp-lg font-bold text-app-foreground truncate">{unit?.name || node.name}</span>
                        <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full"
                            style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                            {unitType}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        {unit?.code && <span className="font-mono text-tp-xxs font-semibold text-app-muted-foreground">{unit.code}</span>}
                        <span className="text-tp-xs font-semibold tabular-nums" style={{ color: 'var(--app-primary)' }}>
                            {kids.length} package{kids.length !== 1 ? 's' : ''}
                        </span>
                        {unit?.conversion_factor && unit.conversion_factor !== 1 && (
                            <span className="text-tp-xs font-semibold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                ×{unit.conversion_factor}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {open && kids.map((c) => (
                <TemplateRow key={c.id}
                    node={c}
                    depth={0}
                    forceExpanded={forceExpanded}
                    selectedId={selectedId}
                    onOpenTemplate={onOpenTemplate}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    )
}

interface TemplateRowProps {
    node: TemplateNode
    depth: number
    forceExpanded?: boolean
    selectedId: string | null
    onOpenTemplate: (n: TemplateNode) => void
    onEdit: (t: Template) => void
    onDelete: (t: Template) => void
}
function TemplateRow({ node, depth, forceExpanded, selectedId, onOpenTemplate, onEdit, onDelete }: TemplateRowProps) {
    const t: Template = node._tpl
    const ratio = Number(t.ratio ?? 1)
    const parentRatio = t.parent_ratio != null ? Number(t.parent_ratio) : null
    const hasChildren = node.children?.length > 0
    const [expanded, setExpanded] = useState(forceExpanded ?? true)
    useEffect(() => { if (forceExpanded !== undefined) setExpanded(forceExpanded) }, [forceExpanded])
    const selected = selectedId === node.id
    const indent = 30 + depth * 24

    return (
        <div>
            <div onDoubleClick={() => onOpenTemplate(node)}
                className={`group flex items-center gap-2.5 py-1.5 md:py-2 hover:bg-app-surface-hover cursor-pointer transition-all relative ${selected ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03]' : ''}`}
                onClick={() => (hasChildren ? setExpanded(e => !e) : onOpenTemplate(node))}
                style={{
                    paddingLeft: indent, paddingRight: 12,
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                }}>
                {/* Indent guide lines */}
                {Array.from({ length: depth + 1 }).map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0"
                        style={{ left: 20 + i * 24, width: '1px', background: 'color-mix(in srgb, var(--app-border) 20%, transparent)' }} />
                ))}

                <button onClick={(e) => { e.stopPropagation(); if (hasChildren) setExpanded(x => !x) }}
                    className="w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0">
                    {hasChildren ? (
                        <ChevronRight size={14}
                            className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                            style={{ color: expanded ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                    ) : <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-primary) 35%, transparent)' }} />}
                </button>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                    <Box size={12} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-tp-lg font-semibold text-app-foreground truncate">{t.name}</span>
                        {t.is_default && (
                            <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full"
                                style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>Default</span>
                        )}
                        {/* Chain hint: "×6 pc" (parent step) */}
                        {parentRatio != null && t.parent_name && (
                            <span className="text-tp-xxs font-bold flex items-center gap-0.5"
                                style={{ color: 'var(--app-accent)' }}
                                title={`This contains ${parentRatio} × ${t.parent_name}`}>
                                <ArrowRight size={9} />×{parentRatio} {t.parent_name}
                            </span>
                        )}
                    </div>
                    {t.code && <span className="font-mono text-tp-xxs font-bold text-app-muted-foreground">{t.code}</span>}
                </div>
                <div className="hidden sm:flex w-[60px] flex-shrink-0 justify-center">
                    <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums"
                        style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 8%, transparent)' }}
                        title={`Total base units: ${ratio}`}>
                        <ArrowRightLeft size={9} />×{ratio}
                    </span>
                </div>
                <div className="hidden sm:flex w-[48px] flex-shrink-0 justify-center">
                    <LinksCountBadge tplId={t.id} />
                </div>
                <div className="hidden sm:flex w-[60px] flex-shrink-0 justify-center">
                    <UsageCountBadge tpl={t} />
                </div>
                <div className="w-[68px] flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(t) }} className="p-1.5 hover:bg-app-border/40 rounded-lg" title="Edit"><Pencil size={11} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(t) }} className="p-1.5 hover:bg-app-border/40 rounded-lg" title="Delete"><Trash2 size={11} style={{ color: 'var(--app-error)' }} /></button>
                </div>
            </div>

            {/* Recursive children — chain continues (pack → box → pallet → TC) */}
            {expanded && hasChildren && node.children.map((child) => (
                <TemplateRow key={child.id}
                    node={child}
                    depth={depth + 1}
                    forceExpanded={forceExpanded}
                    selectedId={selectedId}
                    onOpenTemplate={onOpenTemplate}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    )
}

function LinksCountBadge({ tplId }: { tplId: number }) {
    const [n, setN] = useState<number | null>(null)
    useEffect(() => {
        let alive = true
        erpFetch(`packaging-suggestions/?packaging=${tplId}`, { cache: 'no-store' } as RequestInit)
            .then((d: { results?: unknown[] } | unknown[]) => { if (alive) setN(Array.isArray(d) ? d.length : (d?.results?.length ?? 0)) })
            .catch(() => { if (alive) setN(0) })
        return () => { alive = false }
    }, [tplId])
    if (n === null) return <span className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>…</span>
    if (n === 0) return <span className="text-tp-xxs" style={{ color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)' }}>0</span>
    return (
        <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums"
            style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 10%, transparent)' }}>
            <GitBranch size={9} />{n}
        </span>
    )
}

function UsageCountBadge({ tpl }: { tpl: Template }) {
    const [n, setN] = useState<number | null>(null)
    useEffect(() => {
        let alive = true
        // Products whose ProductPackaging matches this unit + ratio
        erpFetch(`product-packaging/?unit=${tpl.unit}`, { cache: 'no-store' } as RequestInit)
            .then((d: { results?: ProductPackagingRow[] } | ProductPackagingRow[]) => {
                const list: ProductPackagingRow[] = Array.isArray(d) ? d : (d?.results ?? [])
                const matched = list.filter((pp) => Number(pp.ratio) === Number(tpl.ratio))
                if (alive) setN(matched.length)
            })
            .catch(() => { if (alive) setN(0) })
        return () => { alive = false }
    }, [tpl.unit, tpl.ratio])
    if (n === null) return <span className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>…</span>
    if (n === 0) return <span className="text-tp-xxs" style={{ color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)' }}>0</span>
    return (
        <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums"
            style={{ color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}>
            <Package size={9} />{n}
        </span>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  DETAIL PANEL — Overview / Links / Usage
 * ═══════════════════════════════════════════════════════════ */
type DetailTab = 'overview' | 'links' | 'usage' | 'audit'

interface TemplateDetailPanelProps {
    tpl: Template
    categories: Option[]
    brands: Option[]
    attributes: Option[]
    attributeValuesByParent?: Record<number, Option[]>
    onEdit: () => void
    onDelete: () => void
    onClose?: () => void
    onPin?: () => void
}
function TemplateDetailPanel({ tpl, categories, brands, attributes, attributeValuesByParent, onEdit, onDelete, onClose, onPin }: TemplateDetailPanelProps) {
    const [tab, setTab] = useState<DetailTab>('overview')
    const [rules, setRules] = useState<RuleRow[]>([])
    const [rulesLoaded, setRulesLoaded] = useState(false)
    const [products, setProducts] = useState<ProductPackagingRow[]>([])
    const [productsLoaded, setProductsLoaded] = useState(false)
    const [adding, setAdding] = useState(false)
    const [newLink, setNewLink] = useState({ category: '', brand: '', attribute: '', attribute_value: '' })

    useEffect(() => {
        setTab('overview'); setRulesLoaded(false); setProductsLoaded(false)
        setRules([]); setProducts([])
    }, [tpl.id])

    const loadRules = useCallback(async () => {
        if (rulesLoaded) return
        try {
            const d = await erpFetch(`packaging-suggestions/?packaging=${tpl.id}`, { cache: 'no-store' } as RequestInit) as { results?: RuleRow[] } | RuleRow[]
            setRules(Array.isArray(d) ? d : (d?.results ?? []))
        } catch { setRules([]) }
        setRulesLoaded(true)
    }, [tpl.id, rulesLoaded])

    const loadProducts = useCallback(async () => {
        if (productsLoaded) return
        try {
            // Load every ProductPackaging on this unit (broad picture) —
            // the strict adopters (template_id == tpl.id, OR the historic
            // ratio-equality match) get badged in the UI. Filtering only
            // by ratio used to hide rows whose operator-set ratio diverged
            // from the template's canonical ratio (e.g. PP=1 vs tpl=0.33).
            const d = await erpFetch(`product-packaging/?unit=${tpl.unit}`, { cache: 'no-store' } as RequestInit) as { results?: ProductPackagingRow[] } | ProductPackagingRow[]
            const list: ProductPackagingRow[] = Array.isArray(d) ? d : (d?.results ?? [])
            // Sort strict adopters first, then ratio-matchers, then everything else.
            const ratioOf = (pp: ProductPackagingRow) => Number(pp.ratio)
            list.sort((a, b) => {
                const aStrict = Number(a.template) === Number(tpl.id) ? 0 : 1
                const bStrict = Number(b.template) === Number(tpl.id) ? 0 : 1
                if (aStrict !== bStrict) return aStrict - bStrict
                const aRatio = ratioOf(a) === Number(tpl.ratio) ? 0 : 1
                const bRatio = ratioOf(b) === Number(tpl.ratio) ? 0 : 1
                return aRatio - bRatio
            })
            setProducts(list)
        } catch { setProducts([]) }
        setProductsLoaded(true)
    }, [tpl.unit, tpl.ratio, tpl.id, productsLoaded])

    useEffect(() => {
        if (tab === 'links' && !rulesLoaded) loadRules()
        if (tab === 'usage' && !productsLoaded) loadProducts()
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
                packaging: tpl.id,
            })
            toast.success('Link added')
            setNewLink({ category: '', brand: '', attribute: '', attribute_value: '' })
            setAdding(false); setRulesLoaded(false); loadRules()
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    }
    const handleRemoveLink = async (id: number) => {
        if (!confirm('Remove this link?')) return
        try { await deletePackagingRule(id); toast.success('Removed'); setRulesLoaded(false); loadRules() }
        catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    }

    const tabs: { key: DetailTab; label: string; icon: ReactNode; count?: number; color: string }[] = [
        { key: 'overview', label: 'Overview', icon: <Layers size={12} />, color: 'var(--app-info)' },
        { key: 'links', label: 'Links', icon: <GitBranch size={12} />, count: rulesLoaded ? rules.length : undefined, color: 'var(--app-info)' },
        { key: 'usage', label: 'Usage', icon: <Package size={12} />, count: productsLoaded ? products.length : undefined, color: 'var(--app-success)' },
        { key: 'audit', label: 'Audit', icon: <History size={12} />, color: 'var(--app-muted-foreground)' },
    ]

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-surface)' }}>
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', color: 'var(--app-primary)' }}>
                        <Package size={15} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold tracking-tight truncate">{tpl.name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {tpl.code && <span className="font-mono text-tp-xs font-bold px-1.5 py-0.5 rounded"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>{tpl.code}</span>}
                            <span className="text-tp-xxs font-mono font-bold" style={{ color: 'var(--app-info)' }}>
                                ×{Number(tpl.ratio).toLocaleString()} {tpl.unit_code || tpl.unit_name}
                            </span>
                            {tpl.is_default && (
                                <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>Default</span>
                            )}
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

            {/* Tabs */}
            <div className="flex-shrink-0 flex items-center px-3 overflow-x-auto"
                style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', scrollbarWidth: 'none' }}>
                {tabs.map(t => {
                    const active = tab === t.key
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-2.5 whitespace-nowrap"
                            style={{ color: active ? 'var(--app-foreground)' : 'var(--app-muted-foreground)', borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent', marginBottom: '-1px' }}>
                            {t.icon}<span className="hidden sm:inline">{t.label}</span>
                            {t.count !== undefined && t.count > 0 && (
                                <span className="text-tp-xxs font-bold px-1 py-0.5 rounded min-w-[16px] text-center"
                                    style={{ background: `color-mix(in srgb, ${t.color} 10%, transparent)`, color: t.color }}>{t.count}</span>
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {tab === 'overview' && <OverviewTab tpl={tpl} />}
                {tab === 'links' && (
                    <LinksTab
                        tpl={tpl} rules={rules} loaded={rulesLoaded}
                        adding={adding} setAdding={setAdding}
                        newLink={newLink} setNewLink={setNewLink}
                        categories={categories} brands={brands} attributes={attributes}
                        attributeValuesByParent={attributeValuesByParent}
                        onAdd={handleAddLink} onRemove={handleRemoveLink}
                    />
                )}
                {tab === 'usage' && <UsageTab products={products} loaded={productsLoaded} tpl={tpl} />}
                {tab === 'audit' && <TemplateAuditTimeline tplId={tpl.id} />}
            </div>
        </div>
    )
}

function OverviewTab({ tpl }: { tpl: Template }) {
    return (
        <div className="p-3 space-y-2 animate-in fade-in duration-150">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                <StatTile label="Ratio" value={`×${Number(tpl.ratio).toLocaleString()}`} icon={<ArrowRightLeft size={12} />} color="var(--app-info)" />
                <StatTile label="Unit" value={tpl.unit_code || tpl.unit_name || '—'} icon={<Ruler size={12} />} color="var(--app-primary)" />
                <StatTile label="Default" value={tpl.is_default ? 'Yes' : '—'} icon={<Sparkles size={12} />} color={tpl.is_default ? 'var(--app-info)' : 'var(--app-muted-foreground)'} />
                <StatTile label="Order" value={tpl.order ?? 0} icon={<TrendingUp size={12} />} color="var(--app-muted-foreground)" />
            </div>
            <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
                style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                <Info size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info)' }} />
                <p className="text-tp-sm leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                    Templates are reusable shapes. <strong style={{ color: 'var(--app-foreground)' }}>Barcodes and prices</strong> live on each product's own packaging — open the product page and add a packaging level adopting this shape.
                </p>
            </div>
            <div className="space-y-1.5">
                {[
                    ['Name', tpl.name],
                    ['Code', tpl.code],
                    ['Unit', `${tpl.unit_name || ''}${tpl.unit_code ? ` (${tpl.unit_code})` : ''}`],
                    ['Ratio', `×${Number(tpl.ratio).toLocaleString()} ${tpl.unit_code || ''}`],
                    ['Default', tpl.is_default ? 'Yes — primary template for this unit' : 'No'],
                    ['Order', tpl.order ?? 0],
                    ['Notes', tpl.notes],
                ].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                    <div key={k} className="flex items-start gap-3 px-3 py-2 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                        <span className="text-tp-xxs font-bold uppercase tracking-wide w-24 flex-shrink-0 pt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>{k}</span>
                        <span className="text-tp-sm font-bold text-app-foreground flex-1">{v}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

type LinkForm = { category: string; brand: string; attribute: string; attribute_value: string }
interface LinksTabProps {
    tpl: Template
    rules: RuleRow[]
    loaded: boolean
    adding: boolean
    setAdding: (v: boolean) => void
    newLink: LinkForm
    setNewLink: (v: LinkForm) => void
    categories: Option[]
    brands: Option[]
    attributes: Option[]
    attributeValuesByParent?: Record<number, Option[]>
    onAdd: () => void
    onRemove: (id: number) => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- tpl is wired by caller; reserved for future use
function LinksTab({ tpl, rules, loaded, adding, setAdding, newLink, setNewLink, categories, brands, attributes, attributeValuesByParent, onAdd, onRemove }: LinksTabProps) {
    // Children of the attribute the user just picked — e.g. for
    // ``Size`` this is the list ``[Small, Medium, Big]``. The Value
    // field becomes a dropdown of these instead of a free-text input,
    // with a "Custom value…" fallback for one-off tags.
    const attributeChildren: Option[] = (newLink.attribute && attributeValuesByParent?.[Number(newLink.attribute)]) || []
    const isCustomValue = !!newLink.attribute_value && !attributeChildren.some((c) => c.name === newLink.attribute_value)
    return (
        <div className="p-3 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
                <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                    {rules.length} link{rules.length !== 1 ? 's' : ''} — smart suggestion rules
                </p>
                <button onClick={() => setAdding(!adding)}
                    className="flex items-center gap-1 text-tp-xs font-bold uppercase tracking-wide px-2 py-1 rounded-lg"
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
                            <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Value</label>
                            {attributeChildren.length > 0 ? (
                                <>
                                    <select
                                        value={isCustomValue ? '__custom__' : (newLink.attribute_value || '')}
                                        onChange={(e) => {
                                            const v = e.target.value
                                            if (v === '__custom__') setNewLink({ ...newLink, attribute_value: '' })
                                            else setNewLink({ ...newLink, attribute_value: v })
                                        }}
                                        className="w-full px-2.5 py-1.5 rounded-lg text-tp-sm font-bold outline-none"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        <option value="">Any value (attribute present)</option>
                                        {attributeChildren.map((c) => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                        <option value="__custom__">Custom value…</option>
                                    </select>
                                    {isCustomValue && (
                                        <input value={newLink.attribute_value}
                                            onChange={(e) => setNewLink({ ...newLink, attribute_value: e.target.value })}
                                            placeholder="Custom value"
                                            className="w-full mt-1.5 px-2.5 py-1.5 rounded-lg text-tp-sm font-bold outline-none"
                                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                    )}
                                </>
                            ) : (
                                // No children defined under this attribute yet — fall back to free text.
                                <input value={newLink.attribute_value}
                                    onChange={(e) => setNewLink({ ...newLink, attribute_value: e.target.value })}
                                    placeholder="e.g. Big"
                                    className="w-full px-2.5 py-1.5 rounded-lg text-tp-sm font-bold outline-none"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            )}
                        </div>
                    )}
                    <button onClick={onAdd}
                        className="w-full flex items-center justify-center gap-1.5 text-tp-sm font-bold uppercase tracking-wider py-2 rounded-lg"
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
                    <p className="text-tp-md font-bold text-app-muted-foreground">No links yet</p>
                    <p className="text-tp-xs text-app-muted-foreground mt-1 max-w-[240px]">Link this template to a category, brand, or attribute so the smart engine suggests it during product creation.</p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {rules.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 p-2 rounded-xl group"
                            style={{ background: 'color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                            <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
                                {r.category_name && <Chip icon={<FolderTree size={9} />} color="var(--app-success)">{r.category_name}</Chip>}
                                {r.brand_name && <Chip icon={<Tag size={9} />} color="var(--app-info)">{r.brand_name}</Chip>}
                                {r.attribute_name && <Chip icon={<Layers size={9} />} color="var(--app-warning)">{r.attribute_name}{r.attribute_value ? `=${r.attribute_value}` : ''}</Chip>}
                            </div>
                            <span className="text-tp-xxs font-mono flex items-center gap-0.5" title={`Priority: ${r.effective_priority}`}
                                style={{ color: 'var(--app-primary)' }}>
                                <Zap size={9} />p{r.effective_priority}
                            </span>
                            {(r.usage_count ?? 0) > 0 && (
                                <span className="text-tp-xxs font-bold flex items-center gap-0.5" title={`Used ${r.usage_count} times`}
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

function UsageTab({ products, loaded, tpl }: { products: ProductPackagingRow[]; loaded: boolean; tpl: Template }) {
    // Open the product inside the app's tab system instead of spawning a
    // new browser tab. Falls back to a direct navigation when used outside
    // the privileged shell (where AdminContext isn't mounted).
    const admin = useAdminSafe()
    const openProduct = (id: number | undefined, label: string) => {
        if (!id) return
        const path = `/inventory/products/${id}`
        if (admin?.openTab) admin.openTab(label, path)
        else window.location.assign(path)
    }
    if (!loaded) return <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-app-primary" /></div>
    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Package size={22} className="text-app-muted-foreground mb-2 opacity-40" />
                <p className="text-tp-md font-bold text-app-muted-foreground">No product packagings on this unit yet</p>
                <p className="text-tp-xs text-app-muted-foreground mt-1 max-w-[280px]">
                    Add a product packaging on this unit to start tracking. Rows that match this template&apos;s ratio (×{Number(tpl.ratio).toLocaleString()}) get badged below.
                </p>
            </div>
        )
    }

    // Three categories of "adopter" the operator cares about:
    //   - strict (template_id = this template) → official adoption
    //   - ratio  (same ratio, different/no template) → likely should be linked
    //   - other  (same unit, different ratio) → context only
    const strictCount = products.filter(p => Number(p.template) === Number(tpl.id)).length
    const ratioCount  = products.filter(p => Number(p.template) !== Number(tpl.id) && Number(p.ratio) === Number(tpl.ratio)).length

    return (
        <div className="p-3 space-y-3">
            {/* ── Explainer banner ────────────────────────────
                Tells the operator what this list means + maps the
                badge colors to the underlying relationship state. */}
            <div className="rounded-xl p-2.5"
                 style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 18%, transparent)' }}>
                <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                         style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 14%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                        <Info size={12} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-tp-sm font-bold text-app-foreground">What you&apos;re seeing</p>
                        <p className="text-tp-xs text-app-muted-foreground leading-snug">
                            Every <span className="font-bold text-app-foreground">ProductPackaging</span> row whose <code className="font-mono">unit</code> matches this template&apos;s unit. Each row is one product&apos;s instance of a packaging — the template defines the <em>shape</em> (ratio &times; unit); the product fills in its own <em>barcode</em> and <em>price</em>.
                        </p>
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                            <span className="text-tp-xxs font-bold flex items-center gap-1.5"
                                  style={{ color: 'var(--app-success)' }}>
                                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-success)' }} />
                                ✓ adopted = template_id matches (strict link)
                            </span>
                            <span className="text-tp-xxs font-bold flex items-center gap-1.5"
                                  style={{ color: 'var(--app-warning)' }}>
                                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-warning)' }} />
                                ratio match = same ratio, no template link yet
                            </span>
                            <span className="text-tp-xxs font-bold flex items-center gap-1.5"
                                  style={{ color: 'var(--app-muted-foreground)' }}>
                                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-muted-foreground)' }} />
                                same-unit context (different ratio)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Counters strip ── */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-tp-xxs font-bold uppercase tracking-widest"
                      style={{ color: 'var(--app-muted-foreground)' }}>
                    {products.length} on this unit
                </span>
                {strictCount > 0 && (
                    <span className="text-tp-xxs font-black px-1.5 py-0.5 rounded"
                        style={{ background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}>
                        {strictCount} adopted
                    </span>
                )}
                {ratioCount > 0 && (
                    <span className="text-tp-xxs font-black px-1.5 py-0.5 rounded"
                        style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}>
                        {ratioCount} ratio match
                    </span>
                )}
            </div>

            {/* ── Cards (one per ProductPackaging) ── */}
            <div className="space-y-1.5">
                {products.map((pp) => {
                    const isStrict = Number(pp.template) === Number(tpl.id)
                    const isRatioMatch = !isStrict && Number(pp.ratio) === Number(tpl.ratio)
                    const accent = isStrict ? 'var(--app-success)' : isRatioMatch ? 'var(--app-warning)' : 'var(--app-muted-foreground)'
                    const productLabel = pp.product_name || (pp.product ? `Product #${pp.product}` : 'Unnamed product')
                    const samePackageBarcode = pp.barcode && pp.product_barcode && pp.barcode === pp.product_barcode
                    return (
                        <div key={pp.id} className="rounded-xl p-2.5 group"
                            style={{ background: 'var(--app-bg)', border: `1px solid color-mix(in srgb, ${accent} 25%, var(--app-border))` }}>
                            {/* Header: product name + adoption badge + open-product button */}
                            <div className="flex items-start gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
                                    <Package size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-tp-md font-bold text-app-foreground truncate" title={productLabel}>
                                            {productLabel}
                                        </span>
                                        {pp.product_sku && (
                                            <span className="font-mono text-tp-xxs px-1 py-0.5 rounded"
                                                  style={{ background: 'color-mix(in srgb, var(--app-foreground) 6%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                SKU {pp.product_sku}
                                            </span>
                                        )}
                                        {isStrict && (
                                            <span className="text-tp-xxs font-black px-1.5 py-0.5 rounded flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-success) 14%, transparent)', color: 'var(--app-success)' }}
                                                title="ProductPackaging.template == this template — official adopter">
                                                ✓ adopted
                                            </span>
                                        )}
                                        {isRatioMatch && (
                                            <span className="text-tp-xxs font-black px-1.5 py-0.5 rounded flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-warning) 14%, transparent)', color: 'var(--app-warning)' }}
                                                title="Same ratio but template_id is unset — likely should be linked">
                                                ratio match
                                            </span>
                                        )}
                                    </div>
                                    {/* Sub-line: package shape this product is sold in */}
                                    <div className="text-tp-xs text-app-muted-foreground mt-0.5">
                                        Sold as <span className="font-bold text-app-foreground">{pp.display_name || pp.name || 'package'}</span>
                                        {' · '}<span className="font-mono">×{pp.ratio}</span> base units
                                    </div>
                                </div>
                                <button type="button"
                                    onClick={() => openProduct(pp.product, productLabel)}
                                    title="Open this product in a new app tab"
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-app-border/50 flex-shrink-0"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    <ExternalLink size={12} />
                                </button>
                            </div>

                            {/* ── Relation chain ──
                                Visual chain showing who's linked to whom:
                                  Template (this page) ─→ Product (master) ─→ ProductPackaging instance
                                Each chip is a real entity; the arrows show the FK direction. */}
                            <div className="mt-2 -mx-0.5 px-2 py-1.5 rounded-lg overflow-x-auto custom-scrollbar"
                                 style={{ background: 'color-mix(in srgb, var(--app-foreground) 3%, transparent)', border: '1px dashed color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                <div className="flex items-center gap-1.5 min-w-max">
                                    <ChainChip
                                        icon={<Box size={10} />}
                                        label="Template"
                                        value={tpl.name}
                                        sub={`×${Number(tpl.ratio).toLocaleString()} ${tpl.unit_code || tpl.unit_name || ''}`}
                                        accent="var(--app-primary)"
                                    />
                                    <ChainArrow strict={isStrict} />
                                    <ChainChip
                                        icon={<Tag size={10} />}
                                        label="Product"
                                        value={productLabel}
                                        sub={pp.product_sku ? `SKU ${pp.product_sku}` : undefined}
                                        accent="var(--app-info, #3b82f6)"
                                        onClick={() => openProduct(pp.product, productLabel)}
                                    />
                                    <ChainArrow strict={isStrict} />
                                    <ChainChip
                                        icon={<Package size={10} />}
                                        label="Packaging"
                                        value={pp.display_name || pp.name || `Package #${pp.id}`}
                                        sub={pp.barcode || pp.sku || `id ${pp.id}`}
                                        accent={accent}
                                    />
                                </div>
                            </div>

                            {/* Labelled fact strip — every cell is named so the row stops reading like a row of mystery numbers. */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2 pt-2"
                                 style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                {/* Package barcode (per-packaging) */}
                                <Fact label="Package barcode"
                                      value={pp.barcode || '—'}
                                      hint={samePackageBarcode ? 'Same as product barcode (single-pack item)' : pp.barcode ? 'Scans at POS as this packaging level' : 'No package-level barcode set'}
                                      mono accent={pp.barcode ? 'var(--app-info, #3b82f6)' : undefined} />
                                {/* Product master barcode */}
                                {pp.product_barcode && pp.product_barcode !== pp.barcode && (
                                    <Fact label="Product barcode"
                                          value={pp.product_barcode}
                                          hint="The base SKU's master barcode — for reference"
                                          mono accent="var(--app-muted-foreground)" />
                                )}
                                {/* Price */}
                                <Fact label="Selling price"
                                      value={(pp.effective_selling_price ?? 0) > 0 ? Number(pp.effective_selling_price).toLocaleString() : '—'}
                                      hint="Effective sale price for this packaging level"
                                      accent={(pp.effective_selling_price ?? 0) > 0 ? 'var(--app-warning)' : undefined} />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/** Labelled cell for the Usage tab fact strip. */
function Fact({ label, value, hint, mono, accent }: { label: string; value: React.ReactNode; hint?: string; mono?: boolean; accent?: string }) {
    return (
        <div className="rounded-lg px-2 py-1.5"
             style={{ background: 'color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}
             title={hint}>
            <div className="text-tp-xxs font-bold uppercase tracking-widest"
                 style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
            <div className={`text-tp-sm font-bold truncate ${mono ? 'font-mono' : ''}`}
                 style={{ color: accent || 'var(--app-foreground)' }}>{value}</div>
        </div>
    )
}

/* ─── Relation chain helpers ───
 *  Visualises the entity chain in the Usage tab:
 *    Template ──→ Product ──→ ProductPackaging
 *  Each chip is a tiny labelled box with its identity; arrows render
 *  in green when the relation is "strict" (template_id matches), grey
 *  otherwise. Optional onClick makes the chip behave as a tab-opener.
 */
function ChainChip({ icon, label, value, sub, accent, onClick }: {
    icon: React.ReactNode
    label: string
    value: string
    sub?: string
    accent: string
    onClick?: () => void
}) {
    const Element = onClick ? 'button' : 'div'
    return (
        <Element
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-left ${onClick ? 'hover:brightness-110 active:scale-[0.97] cursor-pointer transition-all' : ''}`}
            style={{
                background: `color-mix(in srgb, ${accent} 8%, transparent)`,
                border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
                color: accent,
            }}
            title={`${label}: ${value}${sub ? ` (${sub})` : ''}`}
        >
            <span className="flex-shrink-0">{icon}</span>
            <span className="flex flex-col leading-tight">
                <span className="text-tp-xxs font-bold uppercase tracking-widest opacity-70">{label}</span>
                <span className="text-tp-xs font-bold text-app-foreground truncate max-w-[140px]">{value}</span>
                {sub && (
                    <span className="text-tp-xxs font-mono opacity-60 truncate max-w-[140px]">{sub}</span>
                )}
            </span>
        </Element>
    )
}

function ChainArrow({ strict }: { strict: boolean }) {
    const color = strict ? 'var(--app-success)' : 'var(--app-muted-foreground)'
    return (
        <span className="flex items-center" style={{ color }}>
            <ArrowRight size={12} />
        </span>
    )
}

/** Safe wrapper around AdminContext — returns null when mounted
 *  outside the privileged shell (e.g. tests / storybook) so the
 *  caller can fall back to a plain navigation. Hook itself is always
 *  called, satisfying the rules of hooks. */
function useAdminSafe(): { openTab: (title: string, path: string) => void } | null {
    const ctx = useContext(AdminContext)
    return ctx ? (ctx as unknown as { openTab: (title: string, path: string) => void }) : null
}

interface LinkSelectProps {
    label: string
    icon: ReactNode
    value: string
    onChange: (v: string) => void
    options: Option[]
}
function LinkSelect({ label, icon, value, onChange, options }: LinkSelectProps) {
    return (
        <div>
            <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: 'var(--app-muted-foreground)' }}>{icon} {label}</label>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-tp-sm font-bold outline-none"
                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                <option value="">— Any {label.toLowerCase()} (wildcard) —</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
        </div>
    )
}

function Chip({ icon, color, children }: { icon: ReactNode; color: string; children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-lg"
            style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
            {icon}{children}
        </span>
    )
}

function StatTile({ label, value, icon, color }: { label: string; value: string | number; icon: ReactNode; color: string }) {
    return (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
            style={{ background: `color-mix(in srgb, ${color} 5%, var(--app-surface))`, border: `1px solid color-mix(in srgb, ${color} 15%, transparent)` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>{icon}</div>
            <div>
                <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--app-foreground)' }}>{value}</div>
                <div className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
            </div>
        </div>
    )
}


/* ═══════════════════════════════════════════════════════════
 *  TEMPLATE AUDIT TIMELINE
 *  ----------------------
 *  Compact who-changed-what view scoped to a single template.
 *  Reads the kernel audit-trail (`resource_type=unitpackage`,
 *  `resource_id=<id>`) — same data the per-Unit timeline uses,
 *  same component shape so the page reads consistently.
 * ═══════════════════════════════════════════════════════════ */
type TplAuditFieldChange = { field_name: string; old_value: string | null; new_value: string | null }
type TplAuditEntry = {
    id: number
    action: string
    timestamp: string
    username?: string
    field_changes?: TplAuditFieldChange[]
}

function tplTimeAgo(ts: string): string {
    const ms = Date.now() - new Date(ts).getTime()
    if (Number.isNaN(ms)) return ts
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d}d ago`
    return new Date(ts).toLocaleDateString()
}

function tplActionTone(action: string): { bg: string; fg: string } {
    const tail = (action.split('.').pop() || '').toLowerCase()
    if (tail === 'create') return { bg: 'color-mix(in srgb, var(--app-success) 12%, transparent)', fg: 'var(--app-success)' }
    if (tail === 'delete') return { bg: 'color-mix(in srgb, var(--app-error) 12%, transparent)', fg: 'var(--app-error)' }
    return { bg: 'color-mix(in srgb, var(--app-info) 12%, transparent)', fg: 'var(--app-info)' }
}

function TemplateAuditTimeline({ tplId }: { tplId: number }) {
    const [entries, setEntries] = useState<TplAuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        erpFetch(`inventory/audit-trail/?resource_type=unitpackage&resource_id=${tplId}&limit=80`)
            .then((data: unknown) => {
                if (cancelled) return
                const list = Array.isArray(data) ? data : ((data as { results?: TplAuditEntry[] })?.results ?? [])
                setEntries(list as TplAuditEntry[])
            })
            .catch((e: unknown) => {
                if (cancelled) return
                setError(e instanceof Error ? e.message : 'Failed to load history')
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [tplId])

    if (loading) return <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-app-muted-foreground" /></div>
    if (error) return <div className="p-3 text-tp-sm text-app-muted-foreground">Audit log isn&apos;t available on this deployment.</div>
    if (entries.length === 0) return (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <History size={20} className="text-app-muted-foreground mb-2 opacity-40" />
            <p className="text-tp-md font-bold text-app-muted-foreground">No history yet</p>
            <p className="text-tp-xs text-app-muted-foreground mt-1 max-w-[260px]">
                Edits to this template show up here — who changed what, when.
            </p>
        </div>
    )

    return (
        <div className="p-3 space-y-2">
            <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                {entries.length} event{entries.length === 1 ? '' : 's'} · most recent first
            </p>
            {entries.map(e => {
                const tone = tplActionTone(e.action)
                const tail = (e.action.split('.').pop() || '').toLowerCase()
                return (
                    <div key={e.id} className="rounded-xl p-2.5 space-y-1.5"
                         style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-tp-xxs font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                  style={{ background: tone.bg, color: tone.fg }}>
                                {tail || e.action}
                            </span>
                            <div className="flex items-center gap-1 text-tp-xxs text-app-muted-foreground">
                                <UserIcon size={10} /><span className="truncate max-w-[120px]">{e.username || 'system'}</span>
                            </div>
                            <span className="text-tp-xxs text-app-muted-foreground" title={e.timestamp}>
                                {tplTimeAgo(e.timestamp)}
                            </span>
                        </div>
                        {e.field_changes && e.field_changes.length > 0 && (
                            <div className="space-y-0.5">
                                {e.field_changes.map((fc, i) => (
                                    <div key={i} className="text-tp-xs flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono font-bold" style={{ color: 'var(--app-foreground)' }}>{fc.field_name}</span>
                                        <span className="font-mono px-1 rounded" title="before"
                                              style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-muted-foreground)', textDecoration: 'line-through' }}>
                                            {fc.old_value ?? '∅'}
                                        </span>
                                        <ChevronRight size={9} className="opacity-50" />
                                        <span className="font-mono px-1 rounded" title="after"
                                              style={{ background: 'color-mix(in srgb, var(--app-success) 8%, transparent)', color: 'var(--app-foreground)' }}>
                                            {fc.new_value ?? '∅'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
