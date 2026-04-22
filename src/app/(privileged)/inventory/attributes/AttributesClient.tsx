// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useEffect, useTransition } from 'react'
import {
    Tags, Plus, Pencil, Trash2, Palette, Hash, Layers, Package,
    ChevronRight, Link2, Building2, Sparkles, FolderTree, Barcode,
    X, Bookmark,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    createAttribute, updateAttribute,
    deleteAttribute, addAttributeValue,
    linkCategories, linkBrands,
} from '@/app/actions/inventory/attributes'
import {
    AddGroupForm, AddValueForm, EditModal,
    CategoryLinkModal, BrandLinkModal,
} from './ComponentParts'

/* ═══════════════════════════════════════════════════════════
 *  Data shapes mirror the /tree/ endpoint.
 * ═══════════════════════════════════════════════════════════ */
type AttributeChild = {
    id: number; name: string; code: string; sort_order: number
    color_hex: string | null; image_url: string | null; products_count: number
}
type AttributeGroup = {
    id: number; name: string; code: string; is_variant: boolean; sort_order: number
    children: AttributeChild[]; children_count: number; products_count: number
    color_hex: string | null; image_url: string | null
    linked_categories: Array<{ id: number; name: string }>
    linked_brands: Array<{ id: number; name: string; logo: string | null }>
    show_in_name: boolean; name_position: number; short_label: string | null
    is_required: boolean; show_by_default: boolean; requires_barcode: boolean
}

/* ═══════════════════════════════════════════════════════════
 *  AttributesClient — thin consumer of TreeMasterPage.
 *  The full nested node is carried through so the row & detail
 *  panel have all the metadata without extra fetches.
 * ═══════════════════════════════════════════════════════════ */
type Props = {
    initialTree: AttributeGroup[]
    initialCategories: any[]
    initialBrands: any[]
}

export function AttributesClient({ initialTree, initialCategories, initialBrands }: Props) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const [tree, setTree] = useState<AttributeGroup[]>(initialTree)
    const [showAddGroup, setShowAddGroup] = useState(false)
    const [addingValueTo, setAddingValueTo] = useState<AttributeGroup | null>(null)
    const [editingItem, setEditingItem] = useState<{ id: number; parentId: number | null } | null>(null)
    const [linkingCategoryFor, setLinkingCategoryFor] = useState<AttributeGroup | null>(null)
    const [linkingBrandFor, setLinkingBrandFor] = useState<AttributeGroup | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; isRoot: boolean } | null>(null)
    const [allCategories] = useState<any[]>(initialCategories)
    const [allBrands] = useState<any[]>(initialBrands)

    // Re-sync state when the server re-renders with fresh data (router.refresh()).
    useEffect(() => { setTree(initialTree) }, [initialTree])

    const fetchTree = useCallback(() => {
        // Trigger a server re-render; the SSR fetch above pulls latest data.
        router.refresh()
    }, [router])

    /* ── Flatten nested tree into items-with-parent so TreeMasterPage's
     * buildTree can rebuild the hierarchy using treeParentKey='parent'.
     * We keep the full group/child metadata inline so the row has
     * everything it needs without re-keying. ── */
    const data = useMemo(() => {
        const flat: any[] = []
        for (const g of tree) {
            flat.push({
                ...g,
                parent: null,
                _type: 'group',
                _valueCount: g.children?.length || 0,
                _productsTotal: (g.products_count || 0)
                    + (g.children?.reduce((s, c) => s + (c.products_count || 0), 0) || 0),
            })
            for (const c of g.children || []) {
                flat.push({ ...c, parent: g.id, _type: 'value', _valueCount: 0, _productsTotal: c.products_count || 0 })
            }
        }
        return flat
    }, [tree])

    /* ── Handlers ──────────────────────────────────────────── */
    const handleConfirmDelete = () => {
        const t = deleteTarget
        if (!t) return
        setDeleteTarget(null)
        startTransition(async () => {
            const res = await deleteAttribute(t.id)
            if (res?.success) { toast.success(`"${t.name}" deleted`); fetchTree() }
            else { toast.error(res?.error || 'Delete failed') }
        })
    }

    const handleCreateGroup = async (payload: any) => {
        const res = await createAttribute(payload)
        if (res?.success) { toast.success('Created'); setShowAddGroup(false); fetchTree() }
        else { toast.error(res?.error || 'Create failed') }
    }
    const handleAddValue = async (groupId: number, payload: { name: string; code?: string; color_hex?: string | null }) => {
        const res = await addAttributeValue(groupId, payload)
        if (res?.success) { toast.success('Value added'); setAddingValueTo(null); fetchTree() }
        else { toast.error(res?.error || 'Failed') }
    }
    const handleEdit = async (id: number, payload: any) => {
        const res = await updateAttribute(id, payload)
        if (res?.success) { toast.success('Saved'); setEditingItem(null); fetchTree() }
        else { toast.error(res?.error || 'Save failed') }
    }

    return (
        <>
            <TreeMasterPage
                config={{
                    title: 'Attributes',
                    subtitle: (_, all) => {
                        const groups = all.filter((n: any) => n._type === 'group').length
                        const values = all.filter((n: any) => n._type === 'value').length
                        return `${groups} groups · ${values} values`
                    },
                    icon: <Tags size={20} />,
                    iconColor: 'var(--app-primary)',
                    searchPlaceholder: 'Search by name, code… (Ctrl+K)',
                    primaryAction: { label: 'New Attribute', icon: <Plus size={14} />, onClick: () => setShowAddGroup(true) },
                    secondaryActions: [
                        { label: 'Product Matrix', icon: <Sparkles size={13} />, href: '/inventory/attributes/matrix' },
                    ],
                    columnHeaders: [
                        { label: 'Attribute', width: 'auto' },
                        { label: 'Values', width: '48px', color: 'var(--app-info)', hideOnMobile: true },
                        { label: 'Links', width: '56px', color: 'var(--app-warning)', hideOnMobile: true },
                        { label: 'Products', width: '56px', color: 'var(--app-success)', hideOnMobile: true },
                    ],

                    // ── Template owns filter + tree build ──
                    data,
                    searchFields: ['name', 'code', 'short_label'],
                    treeParentKey: 'parent',
                    kpiPredicates: {
                        groups: (n) => n._type === 'group',
                        values: (n) => n._type === 'value',
                        variant: (n) => n._type === 'group' && n.is_variant,
                        required: (n) => n._type === 'group' && n.is_required,
                        hasProducts: (n) => (n._productsTotal || 0) > 0,
                    },

                    kpis: [
                        {
                            label: 'Total', icon: <Layers size={11} />, color: 'var(--app-primary)',
                            filterKey: 'all', hint: 'Show everything (clear filters)',
                            value: (_, all) => all.length,
                        },
                        {
                            label: 'Groups', icon: <Tags size={11} />, color: 'var(--app-info)',
                            filterKey: 'groups', hint: 'Show only root attribute groups',
                            value: (_, all) => all.filter((n: any) => n._type === 'group').length,
                        },
                        {
                            label: 'Values', icon: <Hash size={11} />, color: 'var(--app-info)',
                            filterKey: 'values', hint: 'Show only values (leaf nodes)',
                            value: (_, all) => all.filter((n: any) => n._type === 'value').length,
                        },
                        {
                            label: 'Variant', icon: <Palette size={11} />, color: 'var(--app-warning)',
                            filterKey: 'variant', hint: 'Groups marked as variant (size, color, …)',
                            value: (_, all) => all.filter((n: any) => n._type === 'group' && n.is_variant).length,
                        },
                        {
                            label: 'Required', icon: <Barcode size={11} />, color: 'var(--app-error)',
                            filterKey: 'required', hint: 'Groups flagged required on product creation',
                            value: (_, all) => all.filter((n: any) => n._type === 'group' && n.is_required).length,
                        },
                        {
                            label: 'Products', icon: <Package size={11} />, color: 'var(--app-success)',
                            filterKey: 'hasProducts', hint: 'Items currently used by products',
                            value: (filtered) => filtered.reduce((s: number, n: any) => s + (n._productsTotal || 0), 0),
                        },
                    ],

                    emptyState: {
                        icon: <Tags size={36} />,
                        title: (hasSearch) => hasSearch ? 'No matching attributes' : 'No attributes yet',
                        subtitle: (hasSearch) => hasSearch
                            ? 'Try a different search or clear filters.'
                            : 'Create an attribute group like "Size" or "Color" to start classifying products.',
                        actionLabel: 'Create First Attribute',
                    },
                    footerLeft: (filtered, all) => {
                        const groups = all.filter((n: any) => n._type === 'group').length
                        const values = all.filter((n: any) => n._type === 'value').length
                        return (
                            <div className="flex items-center gap-3 flex-wrap">
                                <span>{groups} groups</span>
                                <span style={{ color: 'var(--app-border)' }}>·</span>
                                <span>{values} values</span>
                                {filtered.length < all.length && (
                                    <>
                                        <span style={{ color: 'var(--app-border)' }}>·</span>
                                        <span style={{ color: 'var(--app-info)' }}>{filtered.length} showing</span>
                                    </>
                                )}
                            </div>
                        )
                    },
                }}
                modals={
                    <>
                        {showAddGroup && (
                            <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 animate-in fade-in duration-200"
                                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                                onClick={(e) => { if (e.target === e.currentTarget) setShowAddGroup(false) }}>
                                <div className="w-full max-w-2xl">
                                    <AddGroupForm onSave={handleCreateGroup} onCancel={() => setShowAddGroup(false)} groups={tree as any} />
                                </div>
                            </div>
                        )}
                        {addingValueTo && (
                            <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 animate-in fade-in duration-200"
                                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                                onClick={(e) => { if (e.target === e.currentTarget) setAddingValueTo(null) }}>
                                <div className="w-full max-w-xl">
                                    <AddValueForm
                                        groupId={addingValueTo.id}
                                        groupName={addingValueTo.name}
                                        onSave={(payload: any) => handleAddValue(addingValueTo.id, payload)}
                                        onCancel={() => setAddingValueTo(null)}
                                    />
                                </div>
                            </div>
                        )}
                        {editingItem && (
                            <EditModal item={editingItem} tree={tree as any}
                                onSave={handleEdit}
                                onCancel={() => setEditingItem(null)} />
                        )}
                        {linkingCategoryFor && (
                            <CategoryLinkModal
                                attributeId={linkingCategoryFor.id}
                                attributeName={linkingCategoryFor.name}
                                currentCategoryIds={linkingCategoryFor.linked_categories?.map((c: any) => c.id) || []}
                                allCategories={allCategories}
                                onCancel={() => setLinkingCategoryFor(null)}
                                onSave={async (ids: number[]) => {
                                    const res = await linkCategories(linkingCategoryFor.id, ids)
                                    if (res?.success) { toast.success('Categories linked'); setLinkingCategoryFor(null); fetchTree() }
                                    else { toast.error(res?.error || 'Failed') }
                                }}
                            />
                        )}
                        {linkingBrandFor && (
                            <BrandLinkModal
                                attributeId={linkingBrandFor.id}
                                attributeName={linkingBrandFor.name}
                                currentBrandIds={linkingBrandFor.linked_brands?.map((b: any) => b.id) || []}
                                allBrands={allBrands}
                                onCancel={() => setLinkingBrandFor(null)}
                                onSave={async (ids: number[]) => {
                                    const res = await linkBrands(linkingBrandFor.id, ids)
                                    if (res?.success) { toast.success('Brands linked'); setLinkingBrandFor(null); fetchTree() }
                                    else { toast.error(res?.error || 'Failed') }
                                }}
                            />
                        )}
                        <ConfirmDialog
                            open={deleteTarget !== null}
                            onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                            onConfirm={handleConfirmDelete}
                            title={`Delete "${deleteTarget?.name}"?`}
                            description={deleteTarget?.isRoot
                                ? 'Deleting an attribute group also deletes every value under it. Products referencing those values will lose them.'
                                : 'Products currently tagged with this value will lose it.'}
                            confirmText="Delete"
                            variant="danger"
                        />
                    </>
                }
                detailPanel={(node, { onClose, onPin }) => (
                    <AttributeDetailPanel
                        node={node}
                        onEdit={() => setEditingItem({ id: node.id, parentId: node._type === 'group' ? null : node.parent })}
                        onAddValue={node._type === 'group' ? (() => setAddingValueTo(node)) : undefined}
                        onLinkCategories={node._type === 'group' ? (() => setLinkingCategoryFor(node)) : undefined}
                        onLinkBrands={node._type === 'group' ? (() => setLinkingBrandFor(node)) : undefined}
                        onDelete={() => setDeleteTarget({ id: node.id, name: node.name, isRoot: node._type === 'group' })}
                        onClose={onClose}
                        onPin={onPin ? () => onPin(node) : undefined}
                    />
                )}
            >
                {({ tree: rendered, expandKey, expandAll, searchQuery, isSelected, openNode }) => (
                    rendered.map((node: any) => (
                        <div key={`${node.id}-${expandKey}`}
                            className={`rounded-xl transition-all duration-300 ${isSelected(node) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                            <AttributeRow
                                node={node}
                                level={0}
                                forceExpanded={expandAll}
                                searchQuery={searchQuery}
                                onSelect={(n) => openNode(n, 'overview')}
                                onEdit={(n) => setEditingItem({ id: n.id, parentId: n._type === 'group' ? null : n.parent })}
                                onAddValue={(n) => setAddingValueTo(n)}
                                onLinkCategories={(n) => setLinkingCategoryFor(n)}
                                onLinkBrands={(n) => setLinkingBrandFor(n)}
                                onDelete={(n) => setDeleteTarget({ id: n.id, name: n.name, isRoot: n._type === 'group' })}
                            />
                        </div>
                    ))
                )}
            </TreeMasterPage>
        </>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  ATTRIBUTE ROW — group or value
 * ═══════════════════════════════════════════════════════════ */
function AttributeRow({
    node, level, forceExpanded, searchQuery,
    onSelect, onEdit, onAddValue, onLinkCategories, onLinkBrands, onDelete,
}: {
    node: any
    level: number
    forceExpanded?: boolean
    searchQuery: string
    onSelect: (n: any) => void
    onEdit: (n: any) => void
    onAddValue: (n: any) => void
    onLinkCategories: (n: any) => void
    onLinkBrands: (n: any) => void
    onDelete: (n: any) => void
}) {
    const isGroup = node._type === 'group'
    const hasChildren = isGroup && (node.children?.length || 0) > 0
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 1)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => { if (forceExpanded !== undefined) setIsOpen(forceExpanded) }, [forceExpanded])

    const products = node._productsTotal || 0
    const values = node._valueCount || 0
    const linksCount = (node.linked_categories?.length || 0) + (node.linked_brands?.length || 0)

    return (
        <div>
            <div
                className="group flex items-center gap-2 py-2 hover:bg-app-surface-hover transition-colors relative cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation()
                    if (hasChildren) setIsOpen(o => !o)
                    else onSelect(node)
                }}
                onDoubleClick={(e) => { e.stopPropagation(); onSelect(node) }}
                style={{
                    paddingLeft: `${12 + level * 20}px`, paddingRight: 12,
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                }}>

                {isGroup && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                        style={{ background: 'var(--app-primary)' }} />
                )}

                {/* Chevron or dot */}
                <button
                    onClick={(e) => { e.stopPropagation(); if (hasChildren) setIsOpen(!isOpen) }}
                    className={`w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0 ${hasChildren ? 'hover:bg-app-border/40' : ''}`}
                >
                    {hasChildren ? (
                        <ChevronRight size={14}
                            className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                            style={{ color: isOpen ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
                    )}
                </button>

                {/* Icon — color swatch if value has color */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{
                        background: node.color_hex || (isGroup
                            ? 'color-mix(in srgb, var(--app-primary) 15%, transparent)'
                            : 'color-mix(in srgb, var(--app-border) 20%, transparent)'),
                        color: node.color_hex ? '#fff' : (isGroup ? 'var(--app-primary)' : 'var(--app-muted-foreground)'),
                    }}>
                    {isGroup ? <Tags size={13} strokeWidth={2} /> : <Hash size={12} />}
                </div>

                {/* Name block */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`truncate text-tp-lg ${isGroup ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}>
                            {node.name}
                        </span>
                        {isGroup && node.is_variant && (
                            <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}>
                                Variant
                            </span>
                        )}
                        {isGroup && node.is_required && (
                            <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--app-error) 12%, transparent)', color: 'var(--app-error)' }}>
                                Required
                            </span>
                        )}
                    </div>
                    {node.code && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-tp-xxs font-medium text-app-muted-foreground">{node.code}</span>
                            {node.short_label && (
                                <span className="text-tp-xxs font-medium text-app-muted-foreground opacity-60">
                                    · {node.short_label}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Values count */}
                <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                    <span className="text-tp-xs font-semibold tabular-nums"
                        style={{ color: isGroup && values > 0 ? 'var(--app-info)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                        {isGroup ? values : '–'}
                    </span>
                </div>

                {/* Links count (category + brand) */}
                <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                    <span className="text-tp-xs font-semibold tabular-nums"
                        style={{ color: linksCount > 0 ? 'var(--app-warning)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}
                        title={`${node.linked_categories?.length || 0} categories, ${node.linked_brands?.length || 0} brands`}>
                        {linksCount || '–'}
                    </span>
                </div>

                {/* Products */}
                <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                    <span className="text-tp-xs font-semibold tabular-nums"
                        style={{ color: products > 0 ? 'var(--app-success)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                        {products || '–'}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {isGroup && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); onAddValue(node) }}
                                className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors" title="Add value">
                                <Plus size={13} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onLinkCategories(node) }}
                                className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-info transition-colors" title="Link categories">
                                <FolderTree size={12} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onLinkBrands(node) }}
                                className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-warning transition-colors" title="Link brands">
                                <Building2 size={12} />
                            </button>
                        </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onEdit(node) }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                        <Pencil size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(node) }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors" title="Delete">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Children */}
            {hasChildren && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children!.map((child: any) => (
                        <AttributeRow
                            key={child.id}
                            node={{ ...child, _type: 'value', parent: node.id, _productsTotal: child.products_count || 0, _valueCount: 0 }}
                            level={level + 1}
                            forceExpanded={forceExpanded}
                            searchQuery={searchQuery}
                            onSelect={onSelect}
                            onEdit={onEdit}
                            onAddValue={onAddValue}
                            onLinkCategories={onLinkCategories}
                            onLinkBrands={onLinkBrands}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  DETAIL PANEL — overview + linked chips + quick actions
 * ═══════════════════════════════════════════════════════════ */
function AttributeDetailPanel({
    node, onEdit, onAddValue, onLinkCategories, onLinkBrands, onDelete, onClose, onPin,
}: {
    node: any
    onEdit: () => void
    onAddValue?: () => void
    onLinkCategories?: () => void
    onLinkBrands?: () => void
    onDelete: () => void
    onClose: () => void
    onPin?: () => void
}) {
    const isGroup = node._type === 'group'

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-surface)' }}>
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                            background: node.color_hex || 'color-mix(in srgb, var(--app-primary) 15%, transparent)',
                            color: node.color_hex ? '#fff' : 'var(--app-primary)',
                        }}>
                        {isGroup ? <Tags size={16} /> : <Hash size={14} />}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold tracking-tight truncate">{node.name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {node.code && (
                                <span className="font-mono text-tp-xs font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    {node.code}
                                </span>
                            )}
                            <span className="text-tp-xxs font-bold uppercase tracking-wide"
                                style={{ color: isGroup ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }}>
                                {isGroup ? 'Group' : 'Value'}
                            </span>
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

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {/* Quick actions */}
                {isGroup && (
                    <div className="grid grid-cols-3 gap-1.5">
                        {onAddValue && (
                            <QuickAction onClick={onAddValue} icon={<Plus size={12} />} label="Add Value" color="var(--app-primary)" />
                        )}
                        {onLinkCategories && (
                            <QuickAction onClick={onLinkCategories} icon={<FolderTree size={12} />} label="Link Cats" color="var(--app-info)" />
                        )}
                        {onLinkBrands && (
                            <QuickAction onClick={onLinkBrands} icon={<Building2 size={12} />} label="Link Brands" color="var(--app-warning)" />
                        )}
                    </div>
                )}

                {/* Flags row (groups only) */}
                {isGroup && (
                    <div className="grid grid-cols-2 gap-1.5">
                        <FlagTile label="Variant" on={node.is_variant} color="var(--app-warning)" />
                        <FlagTile label="Required" on={node.is_required} color="var(--app-error)" />
                        <FlagTile label="Show in name" on={node.show_in_name} color="var(--app-info)" />
                        <FlagTile label="Barcode" on={node.requires_barcode} color="var(--app-success)" />
                    </div>
                )}

                {/* Values list (groups only) */}
                {isGroup && (
                    <SectionCard title="Values" icon={<Hash size={12} />} color="var(--app-info)" count={node.children?.length || 0}>
                        {node.children?.length ? (
                            <div className="flex flex-wrap gap-1.5">
                                {node.children.map((c: AttributeChild) => (
                                    <span key={c.id} className="text-tp-xxs font-bold px-2 py-1 rounded-full flex items-center gap-1"
                                        style={{
                                            background: c.color_hex || 'color-mix(in srgb, var(--app-info) 10%, transparent)',
                                            color: c.color_hex ? '#fff' : 'var(--app-info)',
                                        }}>
                                        {c.name}
                                        {c.products_count ? <span className="opacity-70">({c.products_count})</span> : null}
                                    </span>
                                ))}
                            </div>
                        ) : <p className="text-tp-sm text-app-muted-foreground">No values yet.</p>}
                    </SectionCard>
                )}

                {/* Linked categories (groups only) */}
                {isGroup && (
                    <SectionCard title="Categories" icon={<FolderTree size={12} />} color="var(--app-info)" count={node.linked_categories?.length || 0}>
                        {node.linked_categories?.length ? (
                            <div className="flex flex-wrap gap-1.5">
                                {node.linked_categories.map((c: any) => (
                                    <span key={c.id} className="text-tp-xxs font-bold px-2 py-1 rounded-full"
                                        style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                        {c.name}
                                    </span>
                                ))}
                            </div>
                        ) : <p className="text-tp-sm text-app-muted-foreground">No category links.</p>}
                    </SectionCard>
                )}

                {/* Linked brands (groups only) */}
                {isGroup && (
                    <SectionCard title="Brands" icon={<Building2 size={12} />} color="var(--app-warning)" count={node.linked_brands?.length || 0}>
                        {node.linked_brands?.length ? (
                            <div className="flex flex-wrap gap-1.5">
                                {node.linked_brands.map((b: any) => (
                                    <span key={b.id} className="text-tp-xxs font-bold px-2 py-1 rounded-full"
                                        style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>
                                        {b.name}
                                    </span>
                                ))}
                            </div>
                        ) : <p className="text-tp-sm text-app-muted-foreground">No brand links.</p>}
                    </SectionCard>
                )}
            </div>
        </div>
    )
}

function QuickAction({ onClick, icon, label, color }: any) {
    return (
        <button onClick={onClick}
            className="flex items-center justify-center gap-1 text-tp-xs font-bold px-2 py-2 rounded-xl transition-all hover:scale-[1.02]"
            style={{
                background: `color-mix(in srgb, ${color} 8%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                color,
            }}>
            {icon}<span>{label}</span>
        </button>
    )
}

function FlagTile({ label, on, color }: any) {
    return (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl"
            style={{
                background: on ? `color-mix(in srgb, ${color} 10%, transparent)` : 'color-mix(in srgb, var(--app-border) 15%, transparent)',
                border: `1px solid color-mix(in srgb, ${on ? color : 'var(--app-border)'} 30%, transparent)`,
            }}>
            <span className="text-tp-xxs font-bold uppercase tracking-wider" style={{ color: on ? color : 'var(--app-muted-foreground)' }}>
                {label}
            </span>
            <span className="text-tp-xxs font-bold" style={{ color: on ? color : 'var(--app-muted-foreground)' }}>
                {on ? 'ON' : '—'}
            </span>
        </div>
    )
}

function SectionCard({ title, icon, color, count, children }: any) {
    return (
        <div className="rounded-xl p-3"
            style={{ background: 'color-mix(in srgb, var(--app-border) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-tp-xxs font-bold uppercase tracking-wider" style={{ color }}>
                    {icon} {title}
                </div>
                <span className="text-tp-xxs font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                    {count}
                </span>
            </div>
            {children}
        </div>
    )
}
