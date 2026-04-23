// @ts-nocheck
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

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
    Package, Plus, Pencil, Trash2, Ruler, ArrowRight, ArrowRightLeft, Layers,
    Loader2, X, Check, ChevronRight, Box, Sparkles, Bookmark, Power,
    GitBranch, Tag, ShieldCheck, FolderTree, ExternalLink, Zap,
    TrendingUp, Info,
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

interface Props {
    initialTemplates: Template[]
    units: any[]
    categories: Option[]
    brands: Option[]
    attributes: Option[]
    loadErrors?: Record<string, string>
}

export default function PackagesClient({ initialTemplates, units, categories, brands, attributes, loadErrors }: Props) {
    const router = useRouter()
    const [templates, setTemplates] = useState<Template[]>(initialTemplates)
    const [editing, setEditing] = useState<Template | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)

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
            const data = await erpFetch('unit-packages/', { cache: 'no-store' } as any)
            setTemplates(Array.isArray(data) ? data : (data?.results ?? []))
        } catch (e: any) {
            toast.error('Failed to refresh templates', { description: e?.message || 'network error' })
        }
        router.refresh()
    }, [router])

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
    const tree = useMemo(() => {
        const byUnit: Record<string, any> = {}
        units.forEach((u: any) => {
            byUnit[u.id] = { id: `unit-${u.id}`, _type: 'unit', _unit: u, name: u.name, code: u.code, children: [] }
        })
        // Index templates by id for child lookup
        const tplById = new Map<number, Template>()
        templates.forEach(t => tplById.set(t.id, t))

        // Build node for each template and link parent→children within the same unit
        const nodesById: Record<number, any> = {}
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
        const sortChildren = (n: any) => {
            n.children.sort((a: any, b: any) => Number(a._tpl?.ratio || 0) - Number(b._tpl?.ratio || 0))
            n.children.forEach(sortChildren)
        }
        Object.values(byUnit).forEach(sortChildren)

        const populated = Object.values(byUnit).filter((u: any) => u.children.length > 0)
        populated.sort((a: any, b: any) => {
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

    const handleSave = async (data: any) => {
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
        } catch (e: any) { toast.error(e?.message || 'Save failed') }
    }

    const [seeding, setSeeding] = useState(false)
    const handleSeedDefaults = async () => {
        if (seeding) return
        setSeeding(true)
        try {
            const res: any = await erpFetch('unit-packages/seed_defaults/', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
            })
            const n = Array.isArray(res?.created) ? res.created.length : 0
            if (n > 0) {
                toast.success(res?.message || `Seeded ${n} templates`)
                refresh()
            } else {
                toast.info('All units already have templates — nothing to seed.')
            }
        } catch (e: any) {
            toast.error(e?.message || 'Seed failed')
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
        } catch (e: any) { toast.error(e?.message || 'Delete failed') }
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
                primaryAction: { label: 'New Template', icon: <Plus size={14} />, onClick: openNewForm },
                secondaryActions: [
                    { label: 'Units', icon: <Ruler size={13} />, href: '/inventory/units' },
                    { label: 'Rules', icon: <ShieldCheck size={13} />, href: '/inventory/packaging-suggestions' },
                ],
                columnHeaders: [
                    { label: 'Template', width: 'auto' },
                    { label: 'Ratio', width: '60px', color: 'var(--app-info)', hideOnMobile: true },
                    { label: 'Links', width: '48px', color: 'var(--app-info)', hideOnMobile: true },
                    { label: 'Used By', width: '60px', color: 'var(--app-success)', hideOnMobile: true },
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
                        tpl={editing}
                        units={units}
                        allTemplates={templates}
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
            </>}
            detailPanel={(node, { onClose, onPin }) => {
                if (node._type !== 'template') return null
                return (
                    <TemplateDetailPanel
                        tpl={node._tpl}
                        categories={categories}
                        brands={brands}
                        attributes={attributes}
                        onEdit={() => openEditForm(node._tpl)}
                        onDelete={() => setDeleteTarget(node._tpl)}
                        onClose={onClose}
                        onPin={onPin ? () => onPin(node) : undefined}
                    />
                )
            }}
        >
            {({ searchQuery, expandAll, expandKey, splitPanel, pinnedSidebar, selectedNode, setSelectedNode, sidebarNode, setSidebarNode, setSidebarTab }) => {
                const q = searchQuery.trim().toLowerCase()
                const filteredTree = q
                    ? tree.map((u: any) => ({
                        ...u,
                        children: u.children.filter((c: any) => {
                            const t = c._tpl
                            return (t.name || '').toLowerCase().includes(q)
                                || (t.code || '').toLowerCase().includes(q)
                                || (u.name || '').toLowerCase().includes(q)
                        }),
                    })).filter((u: any) => u.children.length > 0)
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
                                            style={{ background: 'color-mix(in srgb, #8b5cf6 12%, transparent)', color: '#8b5cf6', border: '1px solid color-mix(in srgb, #8b5cf6 40%, transparent)' }}
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

                return filteredTree.map((unitNode: any) => (
                    <UnitGroup key={`${unitNode.id}-${expandKey}`} node={unitNode} forceExpanded={expandAll}
                        selectedId={(splitPanel || pinnedSidebar) ? selectedNode?.id : sidebarNode?.id}
                        onOpenTemplate={(tplNode: any) => {
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
function UnitGroup({ node, forceExpanded, selectedId, onOpenTemplate, onEdit, onDelete }: any) {
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

            {open && kids.map((c: any) => (
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

function TemplateRow({ node, depth, forceExpanded, selectedId, onOpenTemplate, onEdit, onDelete }: any) {
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
                                style={{ color: '#8b5cf6' }}
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
            {expanded && hasChildren && node.children.map((child: any) => (
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
        erpFetch(`packaging-suggestions/?packaging=${tplId}`, { cache: 'no-store' } as any)
            .then((d: any) => { if (alive) setN(Array.isArray(d) ? d.length : (d?.results?.length ?? 0)) })
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
        erpFetch(`product-packaging/?unit=${tpl.unit}`, { cache: 'no-store' } as any)
            .then((d: any) => {
                const list = Array.isArray(d) ? d : (d?.results ?? [])
                const matched = list.filter((pp: any) => Number(pp.ratio) === Number(tpl.ratio))
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
type DetailTab = 'overview' | 'links' | 'usage'

function TemplateDetailPanel({ tpl, categories, brands, attributes, onEdit, onDelete, onClose, onPin }: any) {
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
    }, [tpl.id])

    const loadRules = useCallback(async () => {
        if (rulesLoaded) return
        try {
            const d = await erpFetch(`packaging-suggestions/?packaging=${tpl.id}`, { cache: 'no-store' } as any)
            setRules(Array.isArray(d) ? d : (d?.results ?? []))
        } catch { setRules([]) }
        setRulesLoaded(true)
    }, [tpl.id, rulesLoaded])

    const loadProducts = useCallback(async () => {
        if (productsLoaded) return
        try {
            const d = await erpFetch(`product-packaging/?unit=${tpl.unit}`, { cache: 'no-store' } as any)
            const list = Array.isArray(d) ? d : (d?.results ?? [])
            setProducts(list.filter((pp: any) => Number(pp.ratio) === Number(tpl.ratio)))
        } catch { setProducts([]) }
        setProductsLoaded(true)
    }, [tpl.unit, tpl.ratio, productsLoaded])

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
        } catch (e: any) { toast.error(e?.message || 'Failed') }
    }
    const handleRemoveLink = async (id: number) => {
        if (!confirm('Remove this link?')) return
        try { await deletePackagingRule(id); toast.success('Removed'); setRulesLoaded(false); loadRules() }
        catch (e: any) { toast.error(e?.message || 'Failed') }
    }

    const tabs: { key: DetailTab; label: string; icon: any; count?: number; color: string }[] = [
        { key: 'overview', label: 'Overview', icon: <Layers size={12} />, color: 'var(--app-info)' },
        { key: 'links', label: 'Links', icon: <GitBranch size={12} />, count: rulesLoaded ? rules.length : undefined, color: 'var(--app-info)' },
        { key: 'usage', label: 'Usage', icon: <Package size={12} />, count: productsLoaded ? products.length : undefined, color: 'var(--app-success)' },
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
                        onAdd={handleAddLink} onRemove={handleRemoveLink}
                    />
                )}
                {tab === 'usage' && <UsageTab products={products} loaded={productsLoaded} />}
            </div>
        </div>
    )
}

function OverviewTab({ tpl }: any) {
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

function LinksTab({ tpl, rules, loaded, adding, setAdding, newLink, setNewLink, categories, brands, attributes, onAdd, onRemove }: any) {
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
                            <input value={newLink.attribute_value} onChange={(e) => setNewLink({ ...newLink, attribute_value: e.target.value })}
                                placeholder="e.g. Big" className="w-full px-2.5 py-1.5 rounded-lg text-tp-sm font-bold outline-none"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
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
                    {rules.map((r: any) => (
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
                            {r.usage_count > 0 && (
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

function UsageTab({ products, loaded }: any) {
    if (!loaded) return <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-app-primary" /></div>
    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <Package size={22} className="text-app-muted-foreground mb-2 opacity-40" />
                <p className="text-tp-md font-bold text-app-muted-foreground">No products have adopted this template yet</p>
                <p className="text-tp-xs text-app-muted-foreground mt-1 max-w-[240px]">Products adopt a template by creating a ProductPackaging with the matching ratio + unit. The smart engine proposes this when category / brand / attribute matches.</p>
            </div>
        )
    }
    return (
        <div className="p-3 space-y-1">
            <p className="text-tp-xxs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--app-muted-foreground)' }}>
                {products.length} product packaging{products.length !== 1 ? 's' : ''} adopt this shape
            </p>
            {products.map((pp: any) => (
                <div key={pp.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-app-surface/50 transition-all group">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}><Package size={11} /></div>
                    <div className="flex-1 min-w-0">
                        <div className="text-tp-sm font-bold truncate">
                            {pp.product_name || `Product #${pp.product}`}
                            {pp.display_name && <span className="text-app-muted-foreground ml-1 font-normal">· {pp.display_name}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {pp.barcode && <span className="font-mono text-tp-xxs font-bold" style={{ color: 'var(--app-info)' }}>{pp.barcode}</span>}
                            {pp.effective_selling_price > 0 && (
                                <span className="text-tp-xxs font-bold" style={{ color: 'var(--app-warning)' }}>
                                    {Number(pp.effective_selling_price).toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>
                    <a href={`/inventory/products/${pp.product}`} target="_blank" rel="noreferrer"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-app-border/50">
                        <ExternalLink size={11} />
                    </a>
                </div>
            ))}
        </div>
    )
}

function LinkSelect({ label, icon, value, onChange, options }: any) {
    return (
        <div>
            <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: 'var(--app-muted-foreground)' }}>{icon} {label}</label>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-tp-sm font-bold outline-none"
                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                <option value="">— Any {label.toLowerCase()} (wildcard) —</option>
                {options.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
        </div>
    )
}

function Chip({ icon, color, children }: any) {
    return (
        <span className="inline-flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-lg"
            style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
            {icon}{children}
        </span>
    )
}

function StatTile({ label, value, icon, color }: any) {
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
 *  FORM MODAL — shape only (no barcode / price)
 * ═══════════════════════════════════════════════════════════ */
function TemplateFormModal({ tpl, units, onSave, onClose, allTemplates }: any) {
    const [form, setForm] = useState<any>({
        unit: tpl?.unit ?? units[0]?.id ?? 0,
        parent: tpl?.parent ?? null,
        parent_ratio: tpl?.parent_ratio ?? null,
        name: tpl?.name ?? '',
        code: tpl?.code ?? '',
        ratio: tpl?.ratio ?? 1,
        is_default: tpl?.is_default ?? false,
        order: tpl?.order ?? 0,
        notes: tpl?.notes ?? '',
    })
    const [saving, setSaving] = useState(false)

    // Candidate parents: same-unit templates, excluding self + descendants (no loops)
    const candidateParents = useMemo(() => {
        const all: Template[] = allTemplates || []
        const myId = tpl?.id
        if (!form.unit) return []
        const descendants = new Set<number>()
        if (myId) {
            const gather = (pid: number) => {
                all.filter(t => t.parent === pid).forEach(c => { descendants.add(c.id); gather(c.id) })
            }
            gather(myId)
        }
        return all.filter(t => t.unit === form.unit && t.id !== myId && !descendants.has(t.id))
            .sort((a, b) => Number(a.ratio) - Number(b.ratio))
    }, [allTemplates, form.unit, tpl?.id])

    // Auto-compute total ratio from parent chain
    const parentTpl = candidateParents.find((t: Template) => t.id === form.parent)
    const computedRatio = parentTpl && form.parent_ratio
        ? Number(parentTpl.ratio) * Number(form.parent_ratio)
        : null
    useEffect(() => {
        if (computedRatio != null && !isNaN(computedRatio) && computedRatio > 0) {
            setForm((f: any) => ({ ...f, ratio: computedRatio }))
        }
    }, [computedRatio])

    const submit = async () => {
        if (!form.name?.trim()) { toast.error('Name required'); return }
        if (!form.unit) { toast.error('Pick a unit'); return }
        if (!form.ratio || form.ratio < 1) { toast.error('Ratio must be ≥ 1'); return }
        if (form.parent && (!form.parent_ratio || form.parent_ratio < 1)) {
            toast.error('Parent ratio required when parent is set'); return
        }
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
                            <h3 className="text-sm font-bold">{tpl ? 'Edit Template' : 'New Template'}</h3>
                            <p className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                Shape only — products supply their own barcode + price
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-app-border/30"><X size={16} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
                        style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                        <Info size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info)' }} />
                        <p className="text-tp-sm leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                            A template is a reusable shape (e.g. "Pack of 6" ×6 Piece). Each product that adopts this shape gets its own barcode and price on its product page.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField label="Name *" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} placeholder="Pack of 6" />
                        <FormField label="Code" value={form.code} onChange={(v: string) => setForm({ ...form, code: v })} placeholder="PK6" mono />
                        <div>
                            <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Unit *</label>
                            <select value={form.unit}
                                onChange={e => setForm({ ...form, unit: Number(e.target.value), parent: null, parent_ratio: null })}
                                className="w-full px-3 py-2 rounded-xl outline-none text-tp-md font-bold"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}{u.code ? ` (${u.code})` : ''}</option>)}
                            </select>
                        </div>
                        <FormField label="Order" value={String(form.order)} onChange={(v: string) => setForm({ ...form, order: Number(v) || 0 })} mono placeholder="0" />
                    </div>

                    {/* ── Chain picker: parent + parent_ratio ── */}
                    <div className="rounded-xl p-3 space-y-2"
                        style={{ background: 'color-mix(in srgb, #8b5cf6 5%, transparent)', border: '1px solid color-mix(in srgb, #8b5cf6 25%, transparent)' }}>
                        <div className="flex items-center gap-1.5 text-tp-xxs font-bold uppercase tracking-wide" style={{ color: '#8b5cf6' }}>
                            <ArrowRight size={11} /> Packaging Chain (pipeline step)
                        </div>
                        <p className="text-tp-sm leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                            Build a chain: <strong>pc → pack → box → pallet → TC</strong>. Pick the previous step in the chain and how many of it this level contains. Total base units will auto-compute.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-2">
                            <div>
                                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Parent step</label>
                                <select value={form.parent ?? ''}
                                    onChange={e => setForm({ ...form, parent: e.target.value ? Number(e.target.value) : null })}
                                    className="w-full px-3 py-2 rounded-xl outline-none text-tp-md font-bold"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <option value="">— No parent (base-level / stand-alone) —</option>
                                    {candidateParents.map((p: Template) => (
                                        <option key={p.id} value={p.id}>{p.name} (×{Number(p.ratio).toLocaleString()} {p.unit_code || ''})</option>
                                    ))}
                                </select>
                            </div>
                            <FormField
                                label={`× Parent${parentTpl ? ` (${parentTpl.name})` : ''}`}
                                value={form.parent_ratio != null ? String(form.parent_ratio) : ''}
                                onChange={(v: string) => setForm({ ...form, parent_ratio: v ? Number(v) : null })}
                                mono placeholder="6"
                            />
                        </div>
                        {parentTpl && form.parent_ratio ? (
                            <div className="text-tp-sm font-mono px-2 py-1.5 rounded-lg tabular-nums"
                                style={{ background: 'var(--app-background)', color: 'var(--app-foreground)' }}>
                                <span style={{ color: 'var(--app-muted-foreground)' }}>This level =</span>{' '}
                                <span style={{ color: '#8b5cf6' }}>{form.parent_ratio}</span> ×{' '}
                                <span>{parentTpl.name}</span>{' '}
                                <span style={{ color: 'var(--app-muted-foreground)' }}>×</span>{' '}
                                <span style={{ color: 'var(--app-info)' }}>{Number(parentTpl.ratio).toLocaleString()}</span>{' '}
                                <span style={{ color: 'var(--app-muted-foreground)' }}>base/parent =</span>{' '}
                                <span style={{ color: 'var(--app-warning)', fontWeight: 900 }}>{Number(form.ratio).toLocaleString()}</span> base units
                            </div>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField label="Total ratio (base units) *" value={String(form.ratio)} onChange={(v: string) => setForm({ ...form, ratio: Number(v) || 1 })} mono placeholder="6" />
                        <label className="flex items-center gap-2 text-tp-sm font-bold cursor-pointer mt-5">
                            <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
                            Default for this unit
                        </label>
                    </div>
                    <div>
                        <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Notes</label>
                        <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}
                            rows={2} className="w-full px-3 py-2 rounded-xl outline-none text-tp-md"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                    </div>
                </div>

                <div className="px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)', borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onClose} disabled={saving} className="text-tp-sm font-bold px-3 py-2 rounded-xl" style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button onClick={submit} disabled={saving}
                        className="flex items-center gap-1.5 text-tp-sm font-bold uppercase tracking-wider px-4 py-2 rounded-xl"
                        style={{ background: 'var(--app-primary)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {tpl ? 'Save Template' : 'Create Template'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function FormField({ label, value, onChange, placeholder, mono }: any) {
    return (
        <div>
            <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{label}</label>
            <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className={`w-full px-3 py-2 rounded-xl outline-none text-tp-md ${mono ? 'font-mono font-bold' : 'font-medium'}`}
                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
        </div>
    )
}
