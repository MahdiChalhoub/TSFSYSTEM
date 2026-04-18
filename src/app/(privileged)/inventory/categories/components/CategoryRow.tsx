// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import {
    ChevronRight, Plus, Folder, FolderOpen,
    Pencil, Trash2, Bookmark, AlertCircle,
    Package, Paintbrush, Tag, Box
} from 'lucide-react'
import { toast } from 'sonner'
import type { CategoryNode } from './types'

/* ═══════════════════════════════════════════════════════════
 *  RECURSIVE TREE NODE (COA-style)
 * ═══════════════════════════════════════════════════════════ */
export const CategoryRow = ({
    node, level, onEdit, onAdd, onDelete, searchQuery, forceExpanded,
    onViewProducts, onViewBrands, onViewAttributes, onSelect,
}: {
    node: CategoryNode; level: number; searchQuery: string; forceExpanded?: boolean;
    onEdit: (n: CategoryNode) => void; onAdd: (parentId?: number) => void; onDelete: (n: CategoryNode) => void;
    onViewProducts: (n: CategoryNode) => void; onViewBrands: (n: CategoryNode) => void; onViewAttributes: (n: CategoryNode) => void;
    onSelect?: (n: CategoryNode) => void;
}) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 2)
    const prevForceExpanded = useRef(forceExpanded)

    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    // Only react to intentional expand-all / collapse-all toggles, not selection re-renders
    useEffect(() => {
        if (forceExpanded !== undefined && forceExpanded !== prevForceExpanded.current) {
            setIsOpen(forceExpanded)
        }
        prevForceExpanded.current = forceExpanded
    }, [forceExpanded])

    const isRoot = level === 0
    const productCount = node.product_count ?? 0
    const brandCount = node.brand_count ?? 0
    const attributeCount = node.attribute_count ?? 0

    return (
        <div>
            {/* ── ROW ── */}
            <div
                className={`
                    group flex items-center gap-2.5 transition-all duration-200 relative
                    cursor-pointer
                    ${level === 0
                        ? 'py-2.5 md:py-3 hover:brightness-105'
                        : 'py-1.5 md:py-2 hover:brightness-105'
                    }
                `}
                onClick={(e) => {
                    e.stopPropagation()
                    if (isParent) { setIsOpen(o => !o) } else { onSelect?.(node) }
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation()
                    onSelect?.(node)
                }}
                style={{
                    paddingLeft: `${12 + (level > 0 ? level * 18 : 0)}px`,
                    paddingRight: '12px',
                    background: isRoot
                        ? 'linear-gradient(90deg, color-mix(in srgb, var(--app-primary) 6%, var(--app-surface)) 0%, var(--app-surface) 100%)'
                        : 'transparent',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                }}
            >
                {/* Left accent bar for root */}
                {isRoot && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                        style={{ background: 'linear-gradient(180deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 40%, transparent))' }} />
                )}

                {/* Indent connector line for children */}
                {level > 0 && (
                    <div className="absolute top-0 bottom-0" style={{ left: `${8 + (level - 1) * 18}px`, width: '1px', background: 'color-mix(in srgb, var(--app-border) 20%, transparent)' }} />
                )}

                {/* Toggle */}
                <button
                    onClick={(e) => { e.stopPropagation(); isParent && setIsOpen(!isOpen) }}
                    className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${isParent ? 'hover:bg-app-border/40' : ''}`}
                >
                    {isParent ? (
                        <div className={`w-2 h-2 rounded-sm transition-all duration-200 ${isOpen ? 'rotate-45 scale-110' : ''}`}
                            style={{ background: isOpen ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-muted-foreground) 60%, transparent)' }} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-primary) 35%, transparent)' }} />
                    )}
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                    style={{
                        background: isRoot
                            ? 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))'
                            : 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                        color: isRoot ? '#fff' : 'var(--app-muted-foreground)',
                        boxShadow: isRoot ? '0 2px 8px color-mix(in srgb, var(--app-primary) 20%, transparent)' : 'none',
                    }}
                >
                    {isRoot
                        ? <Bookmark size={13} strokeWidth={2.5} />
                        : isParent
                            ? (isOpen ? <FolderOpen size={13} /> : <Folder size={13} />)
                            : <Folder size={12} />}
                </div>

                {/* Name block */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={(e) => {
                        e.stopPropagation()
                        if (isParent) { setIsOpen(o => !o) } else { onSelect?.(node) }
                    }}>
                        <div className="flex items-center gap-1.5">
                            <span className={`truncate text-tp-lg ${isRoot ? 'font-black text-app-foreground' : 'font-semibold text-app-foreground'}`}>
                                {node.name}
                            </span>
                            {isRoot && (
                                <span className="text-tp-xxs font-black uppercase tracking-widest px-1.5 py-[1px] rounded-full flex-shrink-0"
                                    style={{
                                        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))',
                                        color: '#fff',
                                    }}>
                                    ROOT
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {node.code && (
                                <span className="font-mono text-tp-xxs font-bold text-app-muted-foreground">
                                    {node.code}
                                </span>
                            )}
                            {node.short_name && (
                                <span className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wider opacity-60">
                                    {node.short_name}
                                </span>
                            )}
                        </div>
                    </div>

                {/* ── Stat Badges ── */}
                {/* Children */}
                <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                    <span className="text-tp-xxs font-black px-1.5 py-0.5 rounded-md tabular-nums"
                        style={{
                            background: isParent ? 'color-mix(in srgb, var(--app-foreground) 6%, transparent)' : 'transparent',
                            color: isParent ? 'var(--app-foreground)' : 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)',
                        }}>
                        {isParent ? node.children!.length : '–'}
                    </span>
                </div>

                {/* Brands */}
                <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewBrands(node) }}
                        className="text-tp-xxs font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 tabular-nums transition-all hover:scale-105"
                        style={brandCount > 0 ? {
                            color: '#8b5cf6',
                            background: 'color-mix(in srgb, #8b5cf6 8%, transparent)',
                        } : {
                            color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)',
                        }}
                        title={`${brandCount} brand${brandCount !== 1 ? 's' : ''}`}
                    >
                        <Paintbrush size={9} />
                        {brandCount}
                    </button>
                </div>

                {/* Attributes */}
                <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewAttributes(node) }}
                        className="text-tp-xxs font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 tabular-nums transition-all hover:scale-105"
                        style={attributeCount > 0 ? {
                            color: 'var(--app-warning)',
                            background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)',
                        } : {
                            color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)',
                        }}
                        title={`${attributeCount} attribute${attributeCount !== 1 ? 's' : ''}`}
                    >
                        <Tag size={9} />
                        {attributeCount}
                    </button>
                </div>

                {/* Products */}
                <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewProducts(node) }}
                        className="text-tp-xxs font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 tabular-nums transition-all hover:scale-105"
                        style={productCount > 0 ? {
                            color: 'var(--app-success)',
                            background: 'color-mix(in srgb, var(--app-success) 8%, transparent)',
                        } : {
                            color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)',
                        }}
                        title={`${productCount} product${productCount !== 1 ? 's' : ''}`}
                    >
                        <Box size={9} />
                        {productCount}
                    </button>
                </div>

                {/* Actions — appear on hover */}
                <div className="w-[68px] flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(node) }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-all" title="Edit">
                        <Pencil size={11} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onAdd(node.id) }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-primary transition-all" title="Add sub-category">
                        <Plus size={12} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); if (isParent) { toast.error('Delete sub-categories first.'); return; } onDelete(node); }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg transition-all"
                        style={{ color: isParent ? 'var(--app-border)' : 'var(--app-muted-foreground)', cursor: isParent ? 'not-allowed' : 'pointer' }}
                        title={isParent ? 'Delete sub-categories first' : 'Delete'}
                    >
                        {isParent ? <AlertCircle size={11} /> : <Trash2 size={11} />}
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
                            onViewAttributes={onViewAttributes}
                            onSelect={onSelect}
                            searchQuery={searchQuery}
                            forceExpanded={forceExpanded}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
