'use client'

import React, { useState, useMemo } from 'react'
import {
    FolderTree, Tags, Check, ChevronDown, ChevronRight, Loader2,
    ExternalLink, Package, Palette, Barcode, Hash, Link2, Search, X
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   Category View V3 — Scalable Attribute ↔ Category Linker
   ─────────────────────────────────────────────────────────────
   Designed to handle 100+ attribute groups gracefully.
   Collapsed: shows linked count + compact pill summary.
   Expanded: searchable compact checklist (NOT a tile grid).
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
    show_in_name: boolean;
    name_position: number;
    short_label: string | null;
    is_required: boolean;
    show_by_default: boolean;
    requires_barcode: boolean;
}

type CategoryItem = {
    id: number
    name: string
    parent_id?: number | null
}

const CAT_COLORS = [
    'var(--app-primary)', 'var(--app-accent)', 'var(--app-success, #22c55e)',
    'var(--app-warning)', 'var(--app-info, #3b82f6)', '#ec4899',
    '#14b8a6', 'var(--app-warning)', 'var(--app-accent)', 'var(--app-primary)', '#a855f7', 'var(--app-accent-cyan)',
]

export function CategoryView({ tree, allCategories, search, loading, onLink }: {
    tree: AttributeGroup[]
    allCategories: CategoryItem[]
    search: string
    loading: boolean
    onLink: (categoryId: number, attributeIds: number[]) => Promise<void>
}) {
    const [expandedCategory, setExpandedCategory] = useState<number | null>(null)
    const [attrSearch, setAttrSearch] = useState('')

    // Build category → linked attributes map
    const categoryMap = useMemo(() => {
        const m = new Map<number, Set<number>>()
        for (const cat of allCategories) m.set(cat.id, new Set())
        for (const group of tree) {
            for (const lc of group.linked_categories) {
                if (m.has(lc.id)) m.get(lc.id)!.add(group.id)
                else m.set(lc.id, new Set([group.id]))
            }
        }
        return m
    }, [tree, allCategories])

    // Filter categories
    const filteredCategories = useMemo(() => {
        if (!search) return allCategories
        const s = search.toLowerCase()
        return allCategories.filter(c => c.name.toLowerCase().includes(s))
    }, [allCategories, search])

    // Filter attributes for the expanded panel
    const filteredAttrs = useMemo(() => {
        if (!attrSearch) return tree
        const s = attrSearch.toLowerCase()
        return tree.filter(g => g.name.toLowerCase().includes(s) || (g.code || '').toLowerCase().includes(s))
    }, [tree, attrSearch])

    // Separate variant vs tag groups
    const variantAttrs = filteredAttrs.filter(g => g.is_variant)
    const tagAttrs = filteredAttrs.filter(g => !g.is_variant)

    const toggleLink = async (catId: number, groupId: number) => {
        const current = categoryMap.get(catId) || new Set()
        const next = new Set(current)
        if (next.has(groupId)) next.delete(groupId)
        else next.add(groupId)
        await onLink(catId, Array.from(next))
    }

    const totalLinks = Array.from(categoryMap.values()).reduce((sum, s) => sum + s.size, 0)

    if (loading) {
        return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Info Banner */}
            <div className="flex items-center justify-between p-3 rounded-2xl border transition-all"
                style={{
                    background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                    border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                }}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                        <Link2 size={15} />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-app-foreground">Attribute ↔ Category Linker</div>
                        <div className="text-[10px] text-app-muted-foreground">{totalLinks} links · {tree.length} attributes · {filteredCategories.length} categories</div>
                    </div>
                </div>
                <a href="/inventory/categories"
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                    style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)' }}>
                    Full Category Manager <ExternalLink size={11} />
                </a>
            </div>

            {/* Category List */}
            {filteredCategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <FolderTree size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                    <p className="text-sm font-bold text-app-muted-foreground">No categories found</p>
                    <p className="text-[11px] text-app-muted-foreground mt-1">Create categories first in the Categories page.</p>
                </div>
            ) : (
                <div className="bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden">
                    {filteredCategories.map((cat, idx) => {
                        const linked = categoryMap.get(cat.id) || new Set()
                        const isExpanded = expandedCategory === cat.id
                        const color = CAT_COLORS[idx % CAT_COLORS.length]

                        return (
                            <React.Fragment key={cat.id}>
                                {/* ── Category Row ────────────────────── */}
                                <div
                                    onClick={() => {
                                        setExpandedCategory(isExpanded ? null : cat.id)
                                        setAttrSearch('')
                                    }}
                                    className="group flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-all border-b border-app-border/20"
                                    style={{
                                        borderLeft: `3px solid ${color}`,
                                        background: isExpanded
                                            ? `color-mix(in srgb, ${color} 4%, var(--app-surface))`
                                            : 'transparent',
                                    }}
                                >
                                    <button className="w-4 flex-shrink-0 text-app-muted-foreground">
                                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                    </button>

                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
                                        <FolderTree size={13} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <span className="text-[13px] font-bold text-app-foreground truncate block">{cat.name}</span>
                                    </div>

                                    {/* Compact linked pills (max 5 shown) */}
                                    <div className="hidden md:flex items-center gap-1 flex-shrink-0 max-w-[40%] overflow-hidden">
                                        {tree.filter(g => linked.has(g.id)).slice(0, 5).map(g => (
                                            <span key={g.id}
                                                className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
                                                style={{
                                                    background: g.is_variant
                                                        ? 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)'
                                                        : 'color-mix(in srgb, var(--app-accent) 10%, transparent)',
                                                    color: g.is_variant ? 'var(--app-success, #22c55e)' : 'var(--app-accent)',
                                                }}>
                                                {g.name}
                                            </span>
                                        ))}
                                        {linked.size > 5 && (
                                            <span className="text-[9px] font-bold text-app-muted-foreground flex-shrink-0">+{linked.size - 5}</span>
                                        )}
                                    </div>

                                    <span className="text-[11px] font-black tabular-nums px-2 py-0.5 rounded-lg flex-shrink-0"
                                        style={{
                                            color: linked.size > 0 ? color : 'var(--app-muted-foreground)',
                                            background: linked.size > 0 ? `color-mix(in srgb, ${color} 8%, transparent)` : 'transparent',
                                        }}>
                                        {linked.size}
                                    </span>
                                </div>

                                {/* ── Expanded: Searchable Compact Checklist ── */}
                                {isExpanded && (
                                    <div className="animate-in fade-in slide-in-from-top-1 duration-200 border-b border-app-border/30"
                                        style={{ background: `color-mix(in srgb, ${color} 2%, var(--app-bg, var(--app-background)))` }}>
                                        {/* Search bar inside */}
                                        {tree.length > 8 && (
                                            <div className="px-4 pt-3 pb-1">
                                                <div className="relative">
                                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                                    <input
                                                        value={attrSearch}
                                                        onChange={e => setAttrSearch(e.target.value)}
                                                        placeholder={`Filter ${tree.length} attributes...`}
                                                        className="w-full pl-8 pr-8 py-1.5 text-[11px] font-bold bg-app-surface border border-app-border/50 rounded-lg outline-none focus:border-app-primary/40 transition-all"
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                    {attrSearch && (
                                                        <button onClick={e => { e.stopPropagation(); setAttrSearch('') }}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-foreground">
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="px-4 py-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {/* Variant Attributes Section */}
                                            {variantAttrs.length > 0 && (
                                                <div className="mb-2">
                                                    <div className="text-[9px] font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5"
                                                        style={{ color: 'var(--app-success, #22c55e)' }}>
                                                        <Package size={10} /> Variant Attributes ({variantAttrs.length})
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        {variantAttrs.map(g => (
                                                            <AttrCheckRow
                                                                key={g.id}
                                                                group={g}
                                                                isLinked={linked.has(g.id)}
                                                                color={color}
                                                                onToggle={() => toggleLink(cat.id, g.id)}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tag/Classification Section */}
                                            {tagAttrs.length > 0 && (
                                                <div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5"
                                                        style={{ color: 'var(--app-accent)' }}>
                                                        <Tags size={10} /> Tag Attributes ({tagAttrs.length})
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        {tagAttrs.map(g => (
                                                            <AttrCheckRow
                                                                key={g.id}
                                                                group={g}
                                                                isLinked={linked.has(g.id)}
                                                                color={color}
                                                                onToggle={() => toggleLink(cat.id, g.id)}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {filteredAttrs.length === 0 && (
                                                <div className="text-center py-6 text-[11px] text-app-muted-foreground italic">
                                                    No attributes match &quot;{attrSearch}&quot;
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick actions footer */}
                                        <div className="px-4 py-2 flex items-center justify-between border-t"
                                            style={{ borderColor: `color-mix(in srgb, ${color} 10%, transparent)` }}>
                                            <span className="text-[10px] font-bold text-app-muted-foreground">
                                                {linked.size} of {tree.length} linked
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation()
                                                        await onLink(cat.id, tree.map(g => g.id))
                                                    }}
                                                    className="text-[10px] font-bold text-app-muted-foreground hover:text-app-primary transition-colors">
                                                    Select All
                                                </button>
                                                <span className="text-app-border">·</span>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation()
                                                        await onLink(cat.id, [])
                                                    }}
                                                    className="text-[10px] font-bold text-app-muted-foreground hover:text-app-error transition-colors">
                                                    Clear All
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/* ── Compact Attribute Check Row ──────────── */
function AttrCheckRow({ group, isLinked, color, onToggle }: {
    group: AttributeGroup
    isLinked: boolean
    color: string
    onToggle: () => void
}) {
    return (
        <button
            onClick={e => { e.stopPropagation(); onToggle() }}
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg transition-all text-left group/row"
            style={{
                background: isLinked
                    ? `color-mix(in srgb, ${color} 5%, transparent)`
                    : 'transparent',
            }}
        >
            <div className={`w-4 h-4 rounded flex items-center justify-center transition-all flex-shrink-0 ${isLinked ? 'text-white' : 'border border-app-border/60'}`}
                style={isLinked ? { background: color } : {}}>
                {isLinked && <Check size={10} strokeWidth={3} />}
            </div>

            <span className="text-[12px] font-bold text-app-foreground flex-1 min-w-0 truncate group-hover/row:text-app-primary transition-colors">
                {group.name}
            </span>

            <span className="text-[10px] font-bold text-app-muted-foreground flex-shrink-0 tabular-nums">
                {group.children.length}v
            </span>

            {/* Governance badges — compact */}
            <div className="flex items-center gap-1 flex-shrink-0">
                {group.is_required && (
                    <span className="text-[7px] font-black uppercase px-1 py-0 rounded"
                        style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 10%, transparent)' }}>
                        REQ
                    </span>
                )}
                {group.requires_barcode && <Barcode size={10} className="text-app-warning" />}
                {group.show_in_name && <Hash size={10} className="text-app-warning" />}
            </div>
        </button>
    )
}
