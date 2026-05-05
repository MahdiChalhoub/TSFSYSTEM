'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    Tags, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight,
    Search, Loader2, Maximize2, Minimize2, Package, Palette, Layers, Grid3X3,
    ChevronUp, Sparkles, Hash, Link2, Check, FolderTree, Building2, Barcode
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getAttributeTree, createAttribute, updateAttribute,
    deleteAttribute, addAttributeValue, seedDefaultAttributes,
    removeCategoryFromAttribute, linkCategories, getAllCategories,
    linkBrands, getAllBrands,
} from '@/app/actions/inventory/attributes'
import { getInventoryCountries } from '@/app/actions/inventory/countries'

// Extracted Parts
import { DynamicProductMatrix } from './MatrixView'
import { CategoryView } from './CategoryView'
import { AddGroupForm, AddValueForm, EditModal, CategoryLinkModal, BrandLinkModal } from './ComponentParts'

/* ═══════════════════════════════════════════════════════════════
   Product Attributes V3 — Tree Manager
   Dajingo Pro Design Language (Coordinator)
   V3: Brand linking, requires_barcode, Dynamic Product Matrix
   ═══════════════════════════════════════════════════════════════ */

type AttributeChild = {
    id: number; name: string; code: string; sort_order: number;
    color_hex: string | null; image_url: string | null; products_count: number;
}
type LinkedCategory = { id: number; name: string }
type LinkedBrand = { id: number; name: string; logo: string | null }
type AttributeGroup = {
    id: number; name: string; code: string; is_variant: boolean;
    sort_order: number; children: AttributeChild[]; children_count: number;
    products_count: number; color_hex: string | null; image_url: string | null;
    linked_categories: LinkedCategory[];
    linked_brands: LinkedBrand[];
    // V3 Nomenclature + Governance fields
    show_in_name: boolean;
    name_position: number;
    short_label: string | null;
    is_required: boolean;
    show_by_default: boolean;
    requires_barcode: boolean;
}

export default function AttributesClientPage() {
    const [tree, setTree] = useState<AttributeGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [viewMode, setViewMode] = useState<'by-attribute' | 'by-category' | 'matrix'>('by-attribute')
    const [focusMode, setFocusMode] = useState(false)
    const [expanded, setExpanded] = useState<Set<number>>(new Set())
    const [showAddGroup, setShowAddGroup] = useState(false)
    const [addingValueTo, setAddingValueTo] = useState<number | null>(null)
    const [editingItem, setEditingItem] = useState<{ id: number; parentId: number | null } | null>(null)
    const [linkingCategoryFor, setLinkingCategoryFor] = useState<number | null>(null)
    const [linkingBrandFor, setLinkingBrandFor] = useState<number | null>(null)
    const [allCategories, setAllCategories] = useState<{ id: number; name: string; parent_id?: number | null }[]>([])
    const [allBrands, setAllBrands] = useState<{ id: number; name: string; logo?: string | null }[]>([])
    const [allCountries, setAllCountries] = useState<{ id: number; name: string }[]>([])
    const searchRef = useRef<HTMLInputElement>(null)

    const fetchTree = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getAttributeTree()
            setTree(Array.isArray(data) ? data : [])
        } catch { toast.error('Failed to load attributes') }
        setLoading(false)
    }, [])

    useEffect(() => { fetchTree() }, [fetchTree])

    useEffect(() => {
        Promise.all([getAllCategories(), getAllBrands(), getInventoryCountries()]).then(([cats, brands, countries]) => {
            setAllCategories(Array.isArray(cats) ? cats.map((c: any) => ({
                id: c.id, name: c.name, parent_id: c.parent_id
            })) : [])
            setAllBrands(Array.isArray(brands) ? brands.map((b: any) => ({
                id: b.id, name: b.name, logo: b.logo || null
            })) : [])
            setAllCountries(Array.isArray(countries) ? countries.map((c: any) => ({
                id: c.id, name: c.name || c.country_name || 'Unknown'
            })) : [])
        })
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const toggleExpand = (id: number) => {
        setExpanded(prev => {
            const n = new Set(prev)
            n.has(id) ? n.delete(id) : n.add(id)
            return n
        })
    }
    const expandAll = () => setExpanded(new Set(tree.map(g => g.id)))
    const collapseAll = () => setExpanded(new Set())

    const handleDeleteGroup = async (id: number) => {
        if (!confirm('Delete this attribute group and all values?')) return
        const r = await deleteAttribute(id)
        if (r.success) { toast.success('Deleted'); fetchTree() }
        else toast.error(r.error)
    }

    const handleDeleteValue = async (id: number) => {
        if (!confirm('Delete this value?')) return
        const r = await deleteAttribute(id)
        if (r.success) { toast.success('Deleted'); fetchTree() }
        else toast.error(r.error)
    }

    const handleSeed = async () => {
        const r = await seedDefaultAttributes()
        if (r.success) {
            toast.success(`Seeded ${r.data?.created} attributes in ${r.data?.groups} groups`)
            fetchTree()
        } else toast.error(r.error)
    }

    // Filter
    const filtered = tree.filter(g => {
        if (!search) return true
        const s = search.toLowerCase()
        if (g.name.toLowerCase().includes(s) || (g.code || '').toLowerCase().includes(s)) return true
        return g.children.some(c => c.name.toLowerCase().includes(s) || (c.code || '').toLowerCase().includes(s))
    })

    const totalValues = tree.reduce((acc, g) => acc + g.children.length, 0)
    const variantGroups = tree.filter(g => g.is_variant).length
    const nameVisibleGroups = tree.filter(g => g.show_in_name).length
    const barcodeGroups = tree.filter(g => g.requires_barcode).length

    const kpis = [
        { label: 'Attribute Groups', value: tree.length, icon: <Layers size={14} />, color: 'var(--app-primary)' },
        { label: 'Total Values', value: totalValues, icon: <Tags size={14} />, color: 'var(--app-info, #3b82f6)' },
        { label: 'Variant Attrs', value: variantGroups, icon: <Package size={14} />, color: 'var(--app-success, #22c55e)' },
        { label: 'In Product Name', value: nameVisibleGroups, icon: <Hash size={14} />, color: 'var(--app-warning)' },
        { label: 'Barcode Required', value: barcodeGroups, icon: <Barcode size={14} />, color: 'var(--app-warning)' },
    ]

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            {/* Header */}
            {!focusMode ? (
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Tags size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Product Attributes</h1>
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">{tree.length} Groups · {totalValues} Values</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {tree.length === 0 && !loading && (
                            <button onClick={handleSeed} className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl transition-all"><Sparkles size={13} /> Seed Defaults</button>
                        )}
                        <button onClick={() => expanded.size > 0 ? collapseAll() : expandAll()} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl transition-all">
                            {expanded.size > 0 ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {expanded.size > 0 ? 'Collapse' : 'Expand'}
                        </button>
                        <button onClick={() => setFocusMode(true)} className="p-1.5 rounded-xl border border-app-border text-app-muted-foreground hover:text-app-foreground transition-all"><Maximize2 size={13} /></button>
                        <button onClick={() => setShowAddGroup(true)} className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary text-white px-3 py-1.5 rounded-xl transition-all shadow-lg shadow-app-primary/20"><Plus size={14} /> New Attribute</button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-shrink-0"><div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center"><Tags size={14} className="text-white" /></div><span className="text-[12px] font-black italic">Attributes</span></div>
                    <div className="flex-1" />
                    <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground transition-all"><Minimize2 size={13} /></button>
                </div>
            )}

            {/* KPI Strip */}
            {!focusMode && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }} className="mb-3">
                    {kpis.map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left bg-app-surface/50 border border-app-border/50">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground">{s.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs + Search */}
            <div className="flex items-center gap-2 mb-3 px-1.5 py-1.5 rounded-2xl bg-app-surface/40 border border-app-border/40">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-app-surface border border-app-border/20">
                    <button onClick={() => setViewMode('by-attribute')} className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${viewMode === 'by-attribute' ? 'bg-app-primary text-white shadow-md' : 'text-app-muted-foreground hover:text-app-foreground'}`}><Tags size={12} /> <span className="hidden sm:inline">By Attribute</span></button>
                    <button onClick={() => setViewMode('by-category')} className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${viewMode === 'by-category' ? 'bg-app-primary text-white shadow-md' : 'text-app-muted-foreground hover:text-app-foreground'}`}><FolderTree size={12} /> <span className="hidden sm:inline">By Category</span></button>
                    <button onClick={() => setViewMode('matrix')} className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${viewMode === 'matrix' ? 'bg-app-primary text-white shadow-md' : 'text-app-muted-foreground hover:text-app-foreground'}`}><Grid3X3 size={12} /> <span className="hidden sm:inline">Product Matrix</span></button>
                </div>
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-xl outline-none focus:border-app-primary/50 transition-all font-bold" />
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {viewMode === 'by-attribute' ? (
                    <div className="flex flex-col gap-4">
                        {showAddGroup && (
                            <AddGroupForm groups={tree} onCancel={() => setShowAddGroup(false)} onSave={async (data) => {
                                const r = await createAttribute(data)
                                if (r.success) { toast.success('Created'); if (data.parent) toggleExpand(data.parent); fetchTree() }
                                else toast.error(r.error)
                            }} />
                        )}
                        <div className="bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                            <div className="flex items-center gap-2 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 uppercase tracking-wider text-[10px] font-black text-app-muted-foreground"><Tags size={13} className="text-app-primary" /> Attribute Groups</div>
                            <div>
                                {loading ? <div className="p-12 flex justify-center"><Loader2 size={24} className="animate-spin text-app-primary" /></div> : filtered.length === 0 ? <div className="p-12 text-center text-app-muted-foreground italic">No results</div> : (
                                    filtered.map(group => (
                                        <React.Fragment key={group.id}>
                                            <div onClick={() => toggleExpand(group.id)} className="group flex items-center gap-3 hover:bg-app-surface py-3 px-4 transition-all cursor-pointer border-b border-app-border/20" style={{ borderLeft: '3px solid var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))' }}>
                                                <button className="text-app-muted-foreground">{expanded.has(group.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-app-primary/10 text-app-primary shrink-0">{group.is_variant ? <Package size={14} /> : <Palette size={14} />}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-[13px]">{group.name}</div>
                                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                        {group.is_variant
                                                            ? <span className="text-[9px] font-bold uppercase tracking-wider bg-app-success/10 text-app-success px-1.5 py-0.5 rounded">📦 Variant</span>
                                                            : <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded">🏷️ Tag</span>
                                                        }
                                                        {group.show_in_name && <span className="text-[9px] font-bold uppercase tracking-wider bg-app-warning/10 text-app-warning px-1.5 py-0.5 rounded" title={`Position: ${group.name_position}`}>📝 In Name{group.short_label ? ` (${group.short_label})` : ''}</span>}
                                                        {group.is_required && <span className="text-[9px] font-bold uppercase tracking-wider bg-app-error/10 text-app-error px-1.5 py-0.5 rounded">⭐ Required</span>}
                                                        {group.requires_barcode && <span className="text-[9px] font-bold uppercase tracking-wider bg-app-warning/10 text-app-warning px-1.5 py-0.5 rounded">🔖 Barcode</span>}
                                                        {!group.show_by_default && <span className="text-[9px] font-bold uppercase tracking-wider bg-app-muted-foreground/10 text-app-muted-foreground px-1.5 py-0.5 rounded">Hidden by default</span>}
                                                        {group.linked_categories?.length > 0 && <span className="text-[9px] font-bold text-app-muted-foreground">{group.linked_categories.length} categories</span>}
                                                        {group.linked_brands?.length > 0 && <span className="text-[9px] font-bold text-purple-500">{group.linked_brands.length} brands</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={e => { e.stopPropagation(); setLinkingBrandFor(group.id) }} className="p-1.5 hover:bg-purple-500/10 rounded-lg" title="Link brands"><Building2 size={12} className="text-purple-500" /></button>
                                                    <button onClick={e => { e.stopPropagation(); setLinkingCategoryFor(group.id) }} className="p-1.5 hover:bg-app-border/50 rounded-lg" title="Link categories"><Link2 size={12} /></button>
                                                    <button onClick={e => { e.stopPropagation(); setAddingValueTo(group.id); toggleExpand(group.id) }} className="p-1.5 hover:bg-app-border/50 rounded-lg"><Plus size={12} /></button>
                                                    <button onClick={e => { e.stopPropagation(); setEditingItem({ id: group.id, parentId: null }) }} className="p-1.5 hover:bg-app-border/50 rounded-lg"><Pencil size={12} /></button>
                                                    <button onClick={e => { e.stopPropagation(); handleDeleteGroup(group.id) }} className="p-1.5 hover:bg-app-error/10 rounded-lg text-app-error"><Trash2 size={12} /></button>
                                                </div>
                                            </div>
                                            {expanded.has(group.id) && (
                                                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                                                    {group.children.map(child => (
                                                        <div key={child.id} className="group flex items-center gap-3 py-2 px-4 hover:bg-app-surface/50 border-b border-app-border/10 ml-6 border-l border-app-border/30">
                                                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: child.color_hex || 'var(--app-muted-foreground)' }} />
                                                            <div className="flex-1 font-medium text-[13px]">{child.name}</div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                                                <button onClick={() => setEditingItem({ id: child.id, parentId: group.id })} className="p-1.5 hover:bg-app-border/50 rounded-lg"><Pencil size={12} /></button>
                                                                <button onClick={() => handleDeleteValue(child.id)} className="p-1.5 hover:bg-app-error/10 rounded-lg text-app-error"><Trash2 size={12} /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {addingValueTo === group.id && <AddValueForm groupId={group.id} groupName={group.name} onCancel={() => setAddingValueTo(null)} onSave={async (data) => {
                                                        const r = await addAttributeValue(group.id, data); if (r.success) { toast.success('Added'); setAddingValueTo(null); fetchTree() } else toast.error(r.error)
                                                    }} />}
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                ) : viewMode === 'by-category' ? (
                    <CategoryView tree={tree} allCategories={allCategories} search={search} loading={loading} onLink={async (catId, attrIds) => {
                        toast.loading('Updating links...')
                        for (const attr of tree) {
                            const current = attr.linked_categories.map(c => c.id)
                            const should = attrIds.includes(attr.id)
                            const is = current.includes(catId)
                            if (should && !is) await linkCategories(attr.id, [...current, catId])
                            else if (!should && is) await linkCategories(attr.id, current.filter(id => id !== catId))
                        }
                        toast.dismiss(); toast.success('Updated'); fetchTree()
                    }} />
                ) : (
                    <DynamicProductMatrix search={search} tree={tree} allCategories={allCategories} allBrands={allBrands} allCountries={allCountries} />
                )}
            </div>

            {/* Modals */}
            {editingItem && <EditModal item={editingItem} tree={tree} onCancel={() => setEditingItem(null)} onSave={async (id, data) => {
                const r = await updateAttribute(id, data); if (r.success) { toast.success('Updated'); setEditingItem(null); fetchTree() } else toast.error(r.error)
            }} />}
            {linkingCategoryFor !== null && <CategoryLinkModal attributeId={linkingCategoryFor} attributeName={tree.find(g => g.id === linkingCategoryFor)?.name || ''} currentCategoryIds={tree.find(g => g.id === linkingCategoryFor)?.linked_categories.map(c => c.id) || []} allCategories={allCategories} onCancel={() => setLinkingCategoryFor(null)} onSave={async (ids) => {
                const r = await linkCategories(linkingCategoryFor, ids); if (r.success) { toast.success('Linked'); setLinkingCategoryFor(null); fetchTree() } else toast.error(r.error)
            }} />}
            {linkingBrandFor !== null && <BrandLinkModal attributeId={linkingBrandFor} attributeName={tree.find(g => g.id === linkingBrandFor)?.name || ''} currentBrandIds={tree.find(g => g.id === linkingBrandFor)?.linked_brands?.map(b => b.id) || []} allBrands={allBrands} onCancel={() => setLinkingBrandFor(null)} onSave={async (ids) => {
                const r = await linkBrands(linkingBrandFor, ids); if (r.success) { toast.success('Brands linked'); setLinkingBrandFor(null); fetchTree() } else toast.error(r.error)
            }} />}
        </div>
    )
}