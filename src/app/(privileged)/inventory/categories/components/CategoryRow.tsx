// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import {
    ChevronRight, Plus, Folder, FolderOpen,
    Pencil, Trash2, Bookmark, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import type { CategoryNode } from './types'

/* ═══════════════════════════════════════════════════════════
 *  RECURSIVE TREE NODE — simplified visual hierarchy
 * ═══════════════════════════════════════════════════════════ */
export const CategoryRow = ({
    node, level, onEdit, onAdd, onDelete, searchQuery, forceExpanded,
    onViewProducts, onViewBrands, onViewAttributes, onSelect,
    onDuplicate, onArchive, onRestore,
}: {
    node: CategoryNode; level: number; searchQuery: string; forceExpanded?: boolean;
    onEdit: (n: CategoryNode) => void; onAdd: (parentId?: number) => void; onDelete: (n: CategoryNode) => void;
    onViewProducts: (n: CategoryNode) => void; onViewBrands: (n: CategoryNode) => void; onViewAttributes: (n: CategoryNode) => void;
    onSelect?: (n: CategoryNode) => void;
    onDuplicate?: (n: CategoryNode) => void;
    onArchive?: (n: CategoryNode) => void;
    onRestore?: (n: CategoryNode) => void;
}) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 2)
    const prevForceExpanded = useRef(forceExpanded)

    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
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
                    group flex items-center gap-2 transition-colors duration-150 relative cursor-pointer
                    ${isRoot ? 'py-2.5' : 'py-2'}
                    hover:bg-app-surface-hover
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
                    paddingLeft: `${12 + (level > 0 ? level * 20 : 0)}px`,
                    paddingRight: '12px',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                }}
            >
                {/* Left accent bar for root — simple solid */}
                {isRoot && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                        style={{ background: 'var(--app-primary)' }} />
                )}

                {/* Indent connector line */}
                {level > 0 && (
                    <div className="absolute top-0 bottom-0" style={{ left: `${10 + (level - 1) * 20}px`, width: '1px', background: 'color-mix(in srgb, var(--app-border) 25%, transparent)' }} />
                )}

                {/* Expand chevron — standard UX pattern */}
                <button
                    onClick={(e) => { e.stopPropagation(); isParent && setIsOpen(!isOpen) }}
                    className={`w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0 ${isParent ? 'hover:bg-app-border/40' : ''}`}
                >
                    {isParent ? (
                        <ChevronRight size={14}
                            className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                            style={{ color: isOpen ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
                    )}
                </button>

                {/* Icon — flat, no gradient */}
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: isRoot
                            ? 'color-mix(in srgb, var(--app-primary) 15%, transparent)'
                            : 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                        color: isRoot ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                    }}
                >
                    {isRoot
                        ? <Bookmark size={13} strokeWidth={2} />
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
                        <span className={`truncate text-tp-lg ${isRoot ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}>
                            {node.name}
                        </span>
                        {isRoot && (
                            <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                    color: 'var(--app-primary)',
                                }}>
                                ROOT
                            </span>
                        )}
                    </div>
                    {(node.code || node.short_name) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {node.code && (
                                <span className="font-mono text-tp-xxs font-medium text-app-muted-foreground">
                                    {node.code}
                                </span>
                            )}
                            {node.short_name && (
                                <span className="text-tp-xxs font-medium text-app-muted-foreground opacity-60">
                                    {node.short_name}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Stat Badges — numbers only, clean ── */}
                {/* Children */}
                <div className="hidden sm:flex w-10 flex-shrink-0 justify-center">
                    <span className="text-tp-xs font-semibold tabular-nums"
                        style={{
                            color: isParent ? 'var(--app-foreground)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)',
                        }}>
                        {isParent ? node.children!.length : '–'}
                    </span>
                </div>

                {/* Brands */}
                <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewBrands(node) }}
                        className="text-tp-xs font-semibold tabular-nums transition-colors hover:underline"
                        style={{ color: brandCount > 0 ? 'var(--app-info)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}
                        title={`${brandCount} brand${brandCount !== 1 ? 's' : ''}`}
                    >
                        {brandCount}
                    </button>
                </div>

                {/* Attributes */}
                <div className="hidden sm:flex w-10 flex-shrink-0 justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewAttributes(node) }}
                        className="text-tp-xs font-semibold tabular-nums transition-colors hover:underline"
                        style={{ color: attributeCount > 0 ? 'var(--app-warning)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}
                        title={`${attributeCount} attribute${attributeCount !== 1 ? 's' : ''}`}
                    >
                        {attributeCount}
                    </button>
                </div>

                {/* Products */}
                <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewProducts(node) }}
                        className="text-tp-xs font-semibold tabular-nums transition-colors hover:underline"
                        style={{ color: productCount > 0 ? 'var(--app-success)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}
                        title={`${productCount} product${productCount !== 1 ? 's' : ''}`}
                    >
                        {productCount}
                    </button>
                </div>

                {/* Actions — appear on hover */}
                <div className="w-[68px] flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(node) }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                        <Pencil size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onAdd(node.id) }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors" title="Add sub-category">
                        <Plus size={13} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); if (isParent) { toast.error('Delete sub-categories first.'); return; } onDelete(node); }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg transition-colors"
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
