'use client'

import { useState, useMemo } from 'react'
import type { ExplorerData, ExplorerProduct } from '@/app/actions/inventory/explorer'
import { Search, Layers, Globe2, Tag, ChevronRight, ChevronDown, Package, Boxes, Hash } from 'lucide-react'

/* ─────────── helpers ─────────── */
type ViewMode = 'brand-first' | 'country-first'

interface TreeNode {
    key: string
    label: string
    icon?: string
    count: number
    children: TreeNode[]
    products?: ExplorerProduct[]
}

function buildTree(data: ExplorerData, mode: ViewMode, search: string): TreeNode[] {
    let filtered = data.products
    if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.brand_name.toLowerCase().includes(q)
        )
    }

    if (mode === 'brand-first') {
        // Brand → Country → Parfum/Attribute → Products
        const brandMap = new Map<string, Map<string, Map<string, ExplorerProduct[]>>>()
        for (const p of filtered) {
            const bKey = p.brand_name || 'Unbranded'
            const cKey = p.country_name || 'Unknown'
            const aKey = p.parfum_name || 'General'
            if (!brandMap.has(bKey)) brandMap.set(bKey, new Map())
            const cMap = brandMap.get(bKey)!
            if (!cMap.has(cKey)) cMap.set(cKey, new Map())
            const aMap = cMap.get(cKey)!
            if (!aMap.has(aKey)) aMap.set(aKey, [])
            aMap.get(aKey)!.push(p)
        }
        return Array.from(brandMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([brandName, cMap]) => ({
                key: `b:${brandName}`,
                label: brandName,
                icon: '🏷️',
                count: Array.from(cMap.values()).reduce((s, am) =>
                    s + Array.from(am.values()).reduce((s2, ps) => s2 + ps.length, 0), 0),
                children: Array.from(cMap.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([countryName, aMap]) => ({
                        key: `b:${brandName}:c:${countryName}`,
                        label: countryName,
                        icon: '🌍',
                        count: Array.from(aMap.values()).reduce((s, ps) => s + ps.length, 0),
                        children: Array.from(aMap.entries())
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([attrName, products]) => ({
                                key: `b:${brandName}:c:${countryName}:a:${attrName}`,
                                label: attrName,
                                icon: '🧪',
                                count: products.length,
                                children: [],
                                products,
                            })),
                    })),
            }))
    } else {
        // Country → Brand → Parfum/Attribute → Products
        const countryMap = new Map<string, Map<string, Map<string, ExplorerProduct[]>>>()
        for (const p of filtered) {
            const cKey = p.country_name || 'Unknown'
            const bKey = p.brand_name || 'Unbranded'
            const aKey = p.parfum_name || 'General'
            if (!countryMap.has(cKey)) countryMap.set(cKey, new Map())
            const bMap = countryMap.get(cKey)!
            if (!bMap.has(bKey)) bMap.set(bKey, new Map())
            const aMap = bMap.get(bKey)!
            if (!aMap.has(aKey)) aMap.set(aKey, [])
            aMap.get(aKey)!.push(p)
        }
        return Array.from(countryMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([countryName, bMap]) => ({
                key: `c:${countryName}`,
                label: countryName,
                icon: '🌍',
                count: Array.from(bMap.values()).reduce((s, am) =>
                    s + Array.from(am.values()).reduce((s2, ps) => s2 + ps.length, 0), 0),
                children: Array.from(bMap.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([brandName, aMap]) => ({
                        key: `c:${countryName}:b:${brandName}`,
                        label: brandName,
                        icon: '🏷️',
                        count: Array.from(aMap.values()).reduce((s, ps) => s + ps.length, 0),
                        children: Array.from(aMap.entries())
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([attrName, products]) => ({
                                key: `c:${countryName}:b:${brandName}:a:${attrName}`,
                                label: attrName,
                                icon: '🧪',
                                count: products.length,
                                children: [],
                                products,
                            })),
                    })),
            }))
    }
}

/* ─────────── Tree node renderer ─────────── */
function TreeRow({ node, depth, expanded, toggle }: {
    node: TreeNode; depth: number; expanded: Set<string>; toggle: (key: string) => void
}) {
    const isOpen = expanded.has(node.key)
    const hasChildren = node.children.length > 0 || (node.products && node.products.length > 0)
    const depthColors = ['text-app-primary', 'text-emerald-500', 'text-amber-500', 'text-rose-500']
    const depthBg = ['bg-app-primary/5', 'bg-emerald-500/5', 'bg-amber-500/5', 'bg-rose-500/5']

    return (
        <>
            <button
                onClick={() => toggle(node.key)}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-all duration-150
                    hover:bg-app-primary/5 border-b border-app-border/30
                    ${isOpen ? depthBg[depth] || 'bg-app-surface' : ''}`}
                style={{ paddingLeft: `${16 + depth * 28}px` }}
            >
                {hasChildren && (
                    <span className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''} ${depthColors[depth] || 'text-app-text-muted'}`}>
                        <ChevronRight size={14} />
                    </span>
                )}
                {!hasChildren && <span className="w-3.5" />}

                <span className="text-base">{node.icon}</span>
                <span className="flex-1 font-medium text-sm text-app-text truncate">{node.label}</span>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${depthColors[depth] || 'text-app-text-muted'}
                    ${depth === 0 ? 'bg-app-primary/10' : depth === 1 ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                    {node.count}
                </span>
            </button>

            {isOpen && node.children.map(ch => (
                <TreeRow key={ch.key} node={ch} depth={depth + 1} expanded={expanded} toggle={toggle} />
            ))}

            {isOpen && node.products && node.products.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <div
                        className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-4 py-1.5 text-[10px] font-semibold text-app-text-muted uppercase tracking-wider border-b border-app-border/20"
                        style={{ paddingLeft: `${16 + (depth + 1) * 28}px` }}
                    >
                        <span>Product</span>
                        <span className="text-right">Price</span>
                        <span className="text-right">Cost</span>
                        <span className="text-right">SKU</span>
                    </div>
                    {node.products.map(p => (
                        <div
                            key={p.id}
                            className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-4 py-2.5 text-sm border-b border-app-border/10
                                hover:bg-app-primary/3 transition-colors duration-100"
                            style={{ paddingLeft: `${16 + (depth + 1) * 28}px` }}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Package size={13} className="text-app-text-muted shrink-0" />
                                <span className="truncate text-app-text font-medium">{p.name}</span>
                            </div>
                            <span className="text-right text-app-text tabular-nums">
                                {p.selling_price_ttc > 0 ? p.selling_price_ttc.toLocaleString() : '—'}
                            </span>
                            <span className="text-right text-app-text-muted tabular-nums">
                                {p.cost_price > 0 ? p.cost_price.toLocaleString() : '—'}
                            </span>
                            <span className="text-right text-app-text-muted text-xs font-mono truncate">
                                {p.sku}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    )
}

/* ─────────── Main component ─────────── */
export default function ExplorerClient({ data }: { data: ExplorerData }) {
    const [mode, setMode] = useState<ViewMode>('brand-first')
    const [search, setSearch] = useState('')
    const [expanded, setExpanded] = useState(new Set<string>())

    const tree = useMemo(() => buildTree(data, mode, search), [data, mode, search])

    const totalProducts = data.products.length
    const totalBrands = data.brands.length
    const totalCountries = data.countries.length
    const totalGroups = data.groups.length

    const toggle = (key: string) => {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const expandAll = () => {
        const all = new Set<string>()
        const walk = (nodes: TreeNode[]) => {
            for (const n of nodes) {
                all.add(n.key)
                walk(n.children)
            }
        }
        walk(tree)
        setExpanded(all)
    }

    const collapseAll = () => setExpanded(new Set())

    return (
        <div className="min-h-screen p-4 md:p-6 space-y-6">
            {/* ── Premium Header ── */}
            <div className="relative overflow-hidden rounded-2xl border border-app-border/50 p-6 md:p-8"
                style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 8%, var(--app-surface)), var(--app-surface))' }}>
                <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.03]"
                    style={{ background: 'var(--app-primary)' }} />

                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
                            style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #000))' }}>
                            <Layers size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-app-text">Product Explorer</h1>
                            <p className="text-xs text-app-text-muted">Multi-dimensional product hierarchy</p>
                        </div>
                    </div>

                    {/* Stats ribbon */}
                    <div className="flex gap-4 md:ml-auto">
                        {[
                            { label: 'Products', value: totalProducts, icon: <Package size={13} /> },
                            { label: 'Brands', value: totalBrands, icon: <Tag size={13} /> },
                            { label: 'Countries', value: totalCountries, icon: <Globe2 size={13} /> },
                            { label: 'Groups', value: totalGroups, icon: <Boxes size={13} /> },
                        ].map(s => (
                            <div key={s.label} className="text-center">
                                <div className="flex items-center justify-center gap-1 text-app-text-muted mb-0.5">
                                    {s.icon}
                                    <span className="text-[10px] font-medium uppercase tracking-wide">{s.label}</span>
                                </div>
                                <span className="text-lg font-bold text-app-text tabular-nums">{s.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Controls Bar ── */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                {/* View Mode Toggle */}
                <div className="flex rounded-xl border border-app-border/50 overflow-hidden text-xs font-semibold"
                    style={{ background: 'var(--app-surface)' }}>
                    {[
                        { id: 'brand-first' as ViewMode, label: 'Brand → Country', icon: <Tag size={12} /> },
                        { id: 'country-first' as ViewMode, label: 'Country → Brand', icon: <Globe2 size={12} /> },
                    ].map(v => (
                        <button
                            key={v.id}
                            onClick={() => { setMode(v.id); setExpanded(new Set()) }}
                            className={`flex items-center gap-1.5 px-4 py-2 transition-all duration-200
                                ${mode === v.id
                                    ? 'bg-app-primary text-white shadow-sm'
                                    : 'text-app-text-muted hover:text-app-text hover:bg-app-primary/5'
                                }`}
                        >
                            {v.icon} {v.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search products, brands, SKU..."
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-app-border/50 bg-app-surface text-app-text
                            placeholder:text-app-text-muted/50 outline-none focus:border-app-primary/50 focus:ring-1 focus:ring-app-primary/20
                            transition-all duration-200"
                    />
                </div>

                {/* Expand / Collapse */}
                <div className="flex gap-1.5">
                    <button onClick={expandAll}
                        className="text-[11px] font-medium px-3 py-2 rounded-lg border border-app-border/30 text-app-text-muted
                            hover:text-app-text hover:bg-app-primary/5 transition-all">
                        <ChevronDown size={12} className="inline mr-1" />Expand All
                    </button>
                    <button onClick={collapseAll}
                        className="text-[11px] font-medium px-3 py-2 rounded-lg border border-app-border/30 text-app-text-muted
                            hover:text-app-text hover:bg-app-primary/5 transition-all">
                        <ChevronRight size={12} className="inline mr-1" />Collapse
                    </button>
                </div>
            </div>

            {/* ── Tree View ── */}
            <div className="rounded-2xl border border-app-border/50 overflow-hidden" style={{ background: 'var(--app-surface)' }}>
                {/* Column header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-app-border/30 text-[10px] font-semibold text-app-text-muted uppercase tracking-wider"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))' }}>
                    <Hash size={10} />
                    <span className="flex-1">
                        {mode === 'brand-first' ? 'Brand → Country → Attribute → Products' : 'Country → Brand → Attribute → Products'}
                    </span>
                    <span className="text-[9px]">{tree.length} top-level</span>
                </div>

                {tree.length === 0 ? (
                    <div className="py-16 text-center text-app-text-muted">
                        <Layers size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No products found</p>
                        <p className="text-xs mt-1">Try a different search or view mode</p>
                    </div>
                ) : (
                    <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                        {tree.map(node => (
                            <TreeRow key={node.key} node={node} depth={0} expanded={expanded} toggle={toggle} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Inventory Groups Summary ── */}
            {data.groups.length > 0 && (
                <div className="rounded-2xl border border-app-border/50 overflow-hidden" style={{ background: 'var(--app-surface)' }}>
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border/30"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))' }}>
                        <Boxes size={15} className="text-app-primary" />
                        <span className="text-sm font-bold text-app-text">Inventory Groups</span>
                        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-app-primary/10 text-app-primary">
                            {data.groups.length}
                        </span>
                    </div>
                    <div className="divide-y divide-app-border/20">
                        {data.groups.slice(0, 20).map(g => (
                            <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-app-primary/3 transition-colors">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded
                                    ${g.group_type === 'EXACT' ? 'bg-emerald-500/10 text-emerald-600' :
                                        g.group_type === 'SIMILAR' ? 'bg-amber-500/10 text-amber-600' :
                                            'bg-blue-500/10 text-blue-600'}`}>
                                    {g.group_type}
                                </span>
                                <span className="flex-1 text-sm font-medium text-app-text truncate">{g.name}</span>
                                {g.brand_name && (
                                    <span className="text-xs text-app-text-muted">{g.brand_name}</span>
                                )}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded
                                    ${g.approval_status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600' :
                                        g.approval_status === 'PENDING' ? 'bg-amber-500/10 text-amber-600' :
                                            'bg-red-500/10 text-red-600'}`}>
                                    {g.approval_status}
                                </span>
                                <span className="text-[10px] text-app-text-muted font-mono">{g.member_count} members</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
