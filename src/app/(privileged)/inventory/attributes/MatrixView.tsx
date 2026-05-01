'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Grid3X3, Loader2, ChevronDown, ChevronRight,
    Package, ArrowUpDown, Save, RotateCcw,
    FolderTree, Building2, Globe2, Tags, Layers, ShoppingBag,
    X, Plus, Minus
} from 'lucide-react'
import { toast } from 'sonner'

/* ═══════════════════════════════════════════════════════════════
   Dynamic Product Matrix Explorer V4
   ─────────────────────────────────────────────────────────────
   Uses data ALREADY loaded by the parent (tree + categories + brands).
   No heavy product-matrix endpoint needed. Instant load.
   Shows full dimension hierarchy even with 0 products.
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
    show_in_name: boolean; name_position: number; short_label: string | null;
    is_required: boolean; show_by_default: boolean; requires_barcode: boolean;
}
type CategoryItem = { id: number; name: string; parent_id?: number | null }
type BrandItem = { id: number; name: string; logo?: string | null }
type CountryItem = { id: number; name: string }

// Dimension key types
type DimKey = 'category' | 'brand' | `attr_${number}`

type DimValueNode = {
    key: string        // unique path
    dimKey: string     // dimension type
    name: string       // display name (e.g. "Electronics", "Nike", "Red")
    valueId: number    // actual ID in DB
    depth: number      // nesting level
}

const BUILT_IN_DIMS = [
    { key: 'country', label: 'Country', icon: <Globe2 size={13} /> },
    { key: 'category', label: 'Category', icon: <FolderTree size={13} /> },
    { key: 'brand', label: 'Brand', icon: <Building2 size={13} /> },
]

const PRESET_KEY = 'tsf_matrix_presets'
const ACTIVE_KEY = 'tsf_matrix_active_dims'

function loadFromLS(key: string, fallback: any) {
    if (typeof window === 'undefined') return fallback
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) } catch { return fallback }
}
function saveToLS(key: string, val: any) { localStorage.setItem(key, JSON.stringify(val)) }

export function DynamicProductMatrix({
    search,
    tree,
    allCategories,
    allBrands,
    allCountries,
}: {
    search: string
    tree: AttributeGroup[]
    allCategories: CategoryItem[]
    allBrands: BrandItem[]
    allCountries: CountryItem[]
}) {
    const [activeDimensions, setActiveDimensions] = useState<string[]>(['country', 'brand'])
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [presets, setPresets] = useState<{ name: string; dimensions: string[] }[]>([])
    const [savingPreset, setSavingPreset] = useState(false)
    const [presetName, setPresetName] = useState('')

    useEffect(() => {
        setPresets(loadFromLS(PRESET_KEY, []))
        const saved = loadFromLS(ACTIVE_KEY, null)
        if (saved && saved.length > 0) setActiveDimensions(saved)
    }, [])

    useEffect(() => {
        if (activeDimensions.length > 0) saveToLS(ACTIVE_KEY, activeDimensions)
    }, [activeDimensions])

    // All available dimensions = built-ins + each attribute group
    const allDimensions = useMemo(() => {
        const attrDims = tree.map(g => ({
            key: `attr_${g.id}`,
            label: g.name,
            icon: <Tags size={13} />,
        }))
        return [...BUILT_IN_DIMS, ...attrDims]
    }, [tree])

    // For each dimension key, get the list of values
    const dimValues = useMemo(() => {
        const m: Record<string, { id: number; name: string }[]> = {}

        // Country
        m['country'] = allCountries
            .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
            .map(c => ({ id: c.id, name: c.name }))

        // Category
        m['category'] = allCategories
            .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
            .map(c => ({ id: c.id, name: c.name }))

        // Brand
        m['brand'] = allBrands
            .filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()))
            .map(b => ({ id: b.id, name: b.name }))

        // Attribute groups → their children are the values
        for (const g of tree) {
            m[`attr_${g.id}`] = g.children
                .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
                .map(c => ({ id: c.id, name: c.name }))
        }

        return m
    }, [tree, allCategories, allBrands, allCountries, search])

    // Helpers
    const addDimension = (key: string) => {
        if (!activeDimensions.includes(key)) setActiveDimensions([...activeDimensions, key])
    }
    const removeDimension = (key: string) => setActiveDimensions(activeDimensions.filter(k => k !== key))
    const moveDimension = (key: string, dir: -1 | 1) => {
        const idx = activeDimensions.indexOf(key)
        if (idx < 0) return
        const ni = idx + dir
        if (ni < 0 || ni >= activeDimensions.length) return
        const next = [...activeDimensions]
        ;[next[idx], next[ni]] = [next[ni], next[idx]]
        setActiveDimensions(next)
    }
    const toggleExpand = (path: string) => {
        setExpanded(prev => {
            const n = new Set(prev)
            if (n.has(path)) n.delete(path); else n.add(path)
            return n
        })
    }
    const handleSavePreset = () => {
        if (!presetName.trim()) return
        const next = [...presets, { name: presetName.trim(), dimensions: [...activeDimensions] }]
        setPresets(next); saveToLS(PRESET_KEY, next); setPresetName(''); setSavingPreset(false)
        toast.success(`Preset "${presetName.trim()}" saved`)
    }
    const handleLoadPreset = (p: { name: string; dimensions: string[] }) => {
        setActiveDimensions(p.dimensions); setExpanded(new Set()); toast.success(`Loaded "${p.name}"`)
    }
    const handleDeletePreset = (i: number) => {
        const next = presets.filter((_, idx) => idx !== i); setPresets(next); saveToLS(PRESET_KEY, next)
    }
    const expandAll = () => {
        // Expand all level-0 nodes
        const paths = new Set<string>()
        const firstDim = activeDimensions[0]
        if (firstDim && dimValues[firstDim]) {
            for (const v of dimValues[firstDim]) {
                paths.add(`/${firstDim}:${v.id}`)
            }
        }
        setExpanded(paths)
    }

    const dimIcon = (key: string) => allDimensions.find(d => d.key === key)?.icon || <Tags size={13} />
    const dimLabel = (key: string) => allDimensions.find(d => d.key === key)?.label || key

    // Dim-aware colors
    const dimColor = (key: string): string => {
        if (key === 'country') return 'var(--app-success, #22c55e)'
        if (key === 'category') return 'var(--app-primary)'
        if (key === 'brand') return 'var(--app-accent)'
        return 'var(--app-info, #3b82f6)'
    }

    // Build tree for level 0
    const rootNodes = useMemo(() => {
        if (activeDimensions.length === 0) return []
        const firstDim = activeDimensions[0]
        const values = dimValues[firstDim] || []
        return values.map(v => ({
            key: `/${firstDim}:${v.id}`,
            dimKey: firstDim,
            name: v.name,
            valueId: v.id,
            depth: 0,
        }))
    }, [activeDimensions, dimValues])

    // Get children for a node at depth N → show values of dimension at depth N+1
    const getChildren = (parentKey: string, depth: number): DimValueNode[] => {
        if (depth + 1 >= activeDimensions.length) return []
        const nextDim = activeDimensions[depth + 1]
        const values = dimValues[nextDim] || []
        return values.map(v => ({
            key: `${parentKey}/${nextDim}:${v.id}`,
            dimKey: nextDim,
            name: v.name,
            valueId: v.id,
            depth: depth + 1,
        }))
    }

    const totalValues = activeDimensions.reduce((sum, dim) => sum + (dimValues[dim]?.length || 0), 0)

    return (
        <div className="flex flex-col h-full gap-3">
            {/* ── Dimension Configurator ────────────────────────── */}
            <div className="flex-shrink-0 p-3 bg-app-surface/40 border border-app-border/50 rounded-2xl">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <ArrowUpDown size={13} className="text-app-primary" />
                    <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Drill-Down Arrangement</span>
                    <div className="flex-1" />

                    {presets.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                            {presets.map((p, i) => (
                                <div key={i} className="flex items-center">
                                    <button onClick={() => handleLoadPreset(p)}
                                        className="text-[10px] font-bold text-app-muted-foreground hover:text-app-primary px-2 py-1 rounded-lg hover:bg-app-primary/5 transition-all">
                                        {p.name}
                                    </button>
                                    <button onClick={() => handleDeletePreset(i)}
                                        className="p-0.5 text-app-muted-foreground hover:text-app-error transition-colors">
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                            <div className="w-px h-4 bg-app-border/50 mx-1" />
                        </div>
                    )}

                    {savingPreset ? (
                        <div className="flex items-center gap-1 animate-in fade-in duration-150">
                            <input value={presetName} onChange={e => setPresetName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                                placeholder="Preset name..."
                                className="text-[11px] font-bold px-2 py-1 bg-app-bg border border-app-border/50 rounded-lg outline-none w-28" autoFocus />
                            <button onClick={handleSavePreset} className="p-1 text-app-primary hover:bg-app-primary/10 rounded-lg"><Save size={12} /></button>
                            <button onClick={() => setSavingPreset(false)} className="p-1 text-app-muted-foreground rounded-lg"><X size={12} /></button>
                        </div>
                    ) : (
                        <button onClick={() => setSavingPreset(true)}
                            className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-primary px-2 py-1 rounded-lg hover:bg-app-surface transition-all border border-app-border/30">
                            <Save size={11} /> Save View
                        </button>
                    )}

                    <button onClick={expandAll}
                        className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground px-2 py-1 rounded-lg hover:bg-app-surface transition-all border border-app-border/30">
                        <ChevronDown size={11} /> Expand
                    </button>
                    <button onClick={() => { setActiveDimensions(['category', 'brand']); setExpanded(new Set()) }}
                        className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground px-2 py-1 rounded-lg hover:bg-app-surface transition-all border border-app-border/30">
                        <RotateCcw size={11} /> Reset
                    </button>
                </div>

                {/* Active Dimensions Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {activeDimensions.map((key, idx) => (
                        <div key={key} className="flex items-center gap-0 rounded-xl overflow-hidden"
                            style={{ background: `color-mix(in srgb, ${dimColor(key)} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${dimColor(key)} 25%, transparent)` }}>
                            <button onClick={() => moveDimension(key, -1)} disabled={idx === 0}
                                className="p-1.5 disabled:opacity-20 transition-colors" style={{ color: dimColor(key) }}>
                                <ChevronDown size={10} className="rotate-90" />
                            </button>
                            <div className="flex items-center gap-1.5 px-1" style={{ color: dimColor(key) }}>
                                {dimIcon(key)}
                                <span className="text-[11px] font-black">{dimLabel(key)}</span>
                                <span className="text-[9px] font-bold opacity-50">{dimValues[key]?.length || 0}</span>
                            </div>
                            <button onClick={() => moveDimension(key, 1)} disabled={idx === activeDimensions.length - 1}
                                className="p-1.5 disabled:opacity-20 transition-colors" style={{ color: dimColor(key) }}>
                                <ChevronDown size={10} className="-rotate-90" />
                            </button>
                            <button onClick={() => removeDimension(key)}
                                className="p-1.5 text-app-muted-foreground hover:text-app-error border-l transition-colors"
                                style={{ borderColor: `color-mix(in srgb, ${dimColor(key)} 20%, transparent)` }}>
                                <Minus size={10} />
                            </button>
                        </div>
                    ))}

                    <span className="text-[10px] font-black text-app-muted-foreground mx-1">→</span>
                    <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-app-surface border border-app-border/50 text-app-muted-foreground">
                        <ShoppingBag size={11} />
                        <span className="text-[10px] font-black">Products</span>
                    </div>

                    {allDimensions.filter(d => !activeDimensions.includes(d.key)).length > 0 && (
                        <div className="relative group/add">
                            <button className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-dashed border-app-border text-app-muted-foreground hover:border-app-primary hover:text-app-primary transition-all text-[10px] font-bold">
                                <Plus size={11} /> Add Level
                            </button>
                            <div className="absolute top-full left-0 mt-1 hidden group-hover/add:flex flex-col gap-0.5 bg-app-surface border border-app-border rounded-xl shadow-xl p-1.5 z-30 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150">
                                {allDimensions.filter(d => !activeDimensions.includes(d.key)).map(d => (
                                    <button key={d.key} onClick={() => addDimension(d.key)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold text-app-foreground hover:bg-app-primary/5 hover:text-app-primary transition-all text-left">
                                        {d.icon} {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Matrix Tree ──────────────────────────────── */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">Name</div>
                    <div className="w-20 text-right flex-shrink-0 hidden sm:block">Values</div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    {activeDimensions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Layers size={28} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-[12px] font-bold text-app-muted-foreground">Add dimensions to build your view</p>
                            <p className="text-[10px] text-app-muted-foreground mt-1">Click &quot;+ Add Level&quot; to start</p>
                        </div>
                    ) : rootNodes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Grid3X3 size={28} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-[12px] font-bold text-app-muted-foreground">No values in &quot;{dimLabel(activeDimensions[0])}&quot;</p>
                            <p className="text-[10px] text-app-muted-foreground mt-1">Create {dimLabel(activeDimensions[0]).toLowerCase()}s first.</p>
                        </div>
                    ) : (
                        rootNodes.map(node => (
                            <DimRow key={node.key} node={node}
                                expanded={expanded} toggleExpand={toggleExpand}
                                getChildren={getChildren} dimIcon={dimIcon}
                                dimColor={dimColor} activeDimensions={activeDimensions} />
                        ))
                    )}
                </div>

                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-app-surface/40 border-t border-app-border/30 text-[10px] font-bold text-app-muted-foreground">
                    <span>{activeDimensions.length} levels · {totalValues} values total</span>
                    <span className="italic">Rearrange levels to change hierarchy</span>
                </div>
            </div>
        </div>
    )
}

/* ── Dimension Row (recursive) ────────────────── */
function DimRow({ node, expanded, toggleExpand, getChildren, dimIcon, dimColor, activeDimensions }: {
    node: DimValueNode
    expanded: Set<string>
    toggleExpand: (key: string) => void
    getChildren: (parentKey: string, depth: number) => DimValueNode[]
    dimIcon: (key: string) => React.ReactNode
    dimColor: (key: string) => string
    activeDimensions: string[]
}) {
    const isOpen = expanded.has(node.key)
    const color = dimColor(node.dimKey)
    const isLeaf = node.depth + 1 >= activeDimensions.length
    const children = isOpen ? getChildren(node.key, node.depth) : []

    return (
        <>
            <div
                onClick={() => !isLeaf && toggleExpand(node.key)}
                className={`group flex items-center gap-2 transition-all duration-150 border-b border-app-border/20 py-2 px-4 ${isLeaf ? '' : 'cursor-pointer hover:bg-app-surface'}`}
                style={{
                    paddingLeft: `${16 + node.depth * 24}px`,
                    borderLeft: node.depth === 0 ? `3px solid ${color}` : undefined,
                    background: node.depth === 0 ? `color-mix(in srgb, ${color} 3%, var(--app-surface))` : undefined,
                }}
            >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-app-muted-foreground">
                    {isLeaf
                        ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: `color-mix(in srgb, ${color} 50%, transparent)` }} />
                        : isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                    }
                </div>

                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    {dimIcon(node.dimKey)}
                </div>

                <div className="flex-1 min-w-0">
                    <span className={`truncate block ${node.depth === 0 ? 'text-[13px] font-bold' : 'text-[13px] font-medium'} text-app-foreground`}>
                        {node.name}
                    </span>
                </div>

                {!isLeaf && (
                    <div className="w-20 text-right flex-shrink-0 hidden sm:block">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ color, background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
                            {getChildren(node.key, node.depth).length} ↓
                        </span>
                    </div>
                )}
            </div>

            {isOpen && children.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {children.map(child => (
                        <DimRow key={child.key} node={child}
                            expanded={expanded} toggleExpand={toggleExpand}
                            getChildren={getChildren} dimIcon={dimIcon}
                            dimColor={dimColor} activeDimensions={activeDimensions} />
                    ))}
                </div>
            )}
        </>
    )
}
