// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import {
    ChevronRight, Plus, Folder, FolderOpen, Pencil, Trash2,
    Bookmark, AlertCircle, Package, Paintbrush, Tag, Box,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRowGestures } from '@/hooks/use-row-gestures'
import type { CategoryNode, PanelTab } from '../components/types'

/* ═══════════════════════════════════════════════════════════
 *  MobileCategoryRow — two-tier, max-info-density row
 *  Line 1: chevron + icon + name + ROOT badge
 *  Line 2: code · short_name
 *  Line 3: count chips + inline edit/add-sub/delete buttons
 * ═══════════════════════════════════════════════════════════ */

interface Props {
    node: CategoryNode
    level: number
    searchQuery: string
    forceExpanded?: boolean
    onOpenSheet: (n: CategoryNode, tab: PanelTab) => void
    onEdit: (n: CategoryNode) => void
    onAdd: (parentId?: number) => void
    onDelete: (n: CategoryNode) => void
    onLongPress?: (n: CategoryNode) => void
    onDrillIn?: (n: CategoryNode) => void
    selected?: boolean
}

export function MobileCategoryRow({
    node, level, searchQuery, forceExpanded,
    onOpenSheet, onEdit, onAdd, onDelete, onLongPress, onDrillIn, selected,
}: Props) {
    const isParent = node.children && node.children.length > 0
    // Mobile: default open only at level 0 (keeps the first screen less dense)
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 1)
    const prevForce = useRef(forceExpanded)
    const rowRef = useRef<HTMLDivElement>(null)
    const { isLongPressing } = useRowGestures(rowRef, {
        onLongPress: () => onLongPress?.(node),
    })

    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => {
        if (forceExpanded !== undefined && forceExpanded !== prevForce.current) {
            setIsOpen(forceExpanded)
        }
        prevForce.current = forceExpanded
    }, [forceExpanded])

    const isRoot = level === 0
    const visibleLevel = Math.min(level, 3)
    const indentPx = 12 + visibleLevel * 14
    const deepCap = level > 3

    const productCount = node.product_count ?? 0
    const brandCount = node.brand_count ?? 0
    const attributeCount = node.attribute_count ?? 0
    const childCount = node.children?.length ?? 0

    const chip = (count: number, icon: any, color: string, onTap: () => void, title: string) => {
        const enabled = count > 0
        return (
            <button
                onClick={(e) => { e.stopPropagation(); if (enabled) onTap() }}
                className="flex items-center gap-1 px-2 rounded-lg font-bold tabular-nums active:scale-95 transition-all"
                style={{
                    height: 28,
                    fontSize: 'var(--tp-md)',
                    minWidth: 44,
                    color: enabled ? color : 'color-mix(in srgb, var(--app-muted-foreground) 45%, transparent)',
                    background: enabled
                        ? `color-mix(in srgb, ${color} 10%, transparent)`
                        : 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                    border: enabled ? `1px solid color-mix(in srgb, ${color} 20%, transparent)` : '1px solid transparent',
                }}
                disabled={!enabled}
                aria-label={title}>
                {icon}
                <span>{count}</span>
            </button>
        )
    }

    return (
        <div style={{
            // Viewport virtualization — browser skips offscreen row work.
            contentVisibility: 'auto',
            containIntrinsicSize: `0 ${isRoot ? 88 : 78}px`,
        }}>
            <div
                ref={rowRef}
                onClick={() => {
                    if (isLongPressing) return  // swallow tap right after long-press
                    if (isParent) setIsOpen(o => !o)
                    else onOpenSheet(node, 'overview')
                }}
                className="relative rounded-xl mb-1.5 transition-all active:scale-[0.99]"
                style={{
                    minHeight: isRoot ? 80 : 70,
                    padding: '10px 10px 10px ' + (indentPx + (deepCap ? 16 : 0)) + 'px',
                    background: isLongPressing
                        ? 'color-mix(in srgb, var(--app-primary) 12%, var(--app-surface))'
                        : selected
                            ? 'color-mix(in srgb, var(--app-primary) 7%, var(--app-surface))'
                            : isRoot
                                ? 'linear-gradient(90deg, color-mix(in srgb, var(--app-primary) 5%, var(--app-surface)) 0%, var(--app-surface) 100%)'
                                : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                    border: (isLongPressing || selected)
                        ? '1px solid color-mix(in srgb, var(--app-primary) 45%, transparent)'
                        : '1px solid color-mix(in srgb, var(--app-border) 45%, transparent)',
                    boxShadow: isRoot ? '0 2px 8px color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'none',
                    transform: isLongPressing ? 'scale(0.985)' : undefined,
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                }}>

                {/* Left accent for root */}
                {isRoot && (
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
                        style={{ background: 'linear-gradient(180deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 40%, transparent))' }} />
                )}

                {/* Deep-level continuation glyph */}
                {deepCap && (
                    <div className="absolute text-tp-xs font-bold text-app-muted-foreground/50"
                        style={{ left: indentPx, top: 10 }}>
                        └─
                    </div>
                )}

                {/* ── LINE 1 ── */}
                <div className="flex items-center gap-2">
                    {/* Chevron for parents */}
                    <button
                        onClick={(e) => { e.stopPropagation(); isParent && setIsOpen(!isOpen) }}
                        className="flex items-center justify-center rounded-lg flex-shrink-0 transition-all active:scale-90"
                        style={{
                            width: 28, height: 28,
                            background: isParent
                                ? (isOpen ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 25%, transparent)')
                                : 'transparent',
                        }}>
                        {isParent ? (
                            <ChevronRight size={14}
                                style={{
                                    color: isOpen ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                    transition: 'transform 160ms',
                                    transform: isOpen ? 'rotate(90deg)' : 'none',
                                }} />
                        ) : (
                            <div style={{ width: 6, height: 6, borderRadius: 999, background: 'color-mix(in srgb, var(--app-primary) 35%, transparent)' }} />
                        )}
                    </button>

                    {/* Icon */}
                    <div className="rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                            width: 32, height: 32,
                            background: isRoot
                                ? 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))'
                                : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                            color: isRoot ? '#fff' : 'var(--app-muted-foreground)',
                            boxShadow: isRoot ? '0 2px 8px color-mix(in srgb, var(--app-primary) 22%, transparent)' : 'none',
                        }}>
                        {isRoot
                            ? <Bookmark size={15} strokeWidth={2.5} />
                            : isParent ? (isOpen ? <FolderOpen size={15} /> : <Folder size={15} />) : <Folder size={14} />}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="truncate font-bold text-app-foreground"
                                style={{ fontSize: 'var(--tp-xl)', fontWeight: isRoot ? 900 : 700, lineHeight: 1.15 }}>
                                {node.name}
                            </span>
                            {isRoot && (
                                <span className="flex-shrink-0 font-bold uppercase tracking-wide rounded-full"
                                    style={{
                                        fontSize: 'var(--tp-xxs)', padding: '2px 6px',
                                        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))',
                                        color: '#fff',
                                    }}>ROOT</span>
                            )}
                        </div>
                        {(node.code || node.short_name) && (
                            <div className="flex items-center gap-2 mt-0.5">
                                {node.code && (
                                    <span className="font-mono font-bold text-app-muted-foreground" style={{ fontSize: 'var(--tp-sm)' }}>
                                        {node.code}
                                    </span>
                                )}
                                {node.short_name && (
                                    <span className="font-bold uppercase tracking-wider text-app-muted-foreground"
                                        style={{ fontSize: 'var(--tp-xs)', opacity: 0.7 }}>
                                        {node.short_name}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── LINE 2: chips + inline actions ── */}
                <div className="flex items-center gap-1.5 mt-2.5" style={{ paddingLeft: 36 }}>
                    <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                        {chip(productCount, <Package size={11} />, 'var(--app-success, #10b981)',
                            () => onOpenSheet(node, 'products'), 'Products')}
                        {chip(brandCount, <Paintbrush size={11} />, 'var(--app-info)',
                            () => onOpenSheet(node, 'brands'), 'Brands')}
                        {chip(attributeCount, <Tag size={11} />, 'var(--app-warning, #f59e0b)',
                            () => onOpenSheet(node, 'attributes'), 'Attributes')}
                        {isParent && (
                            <div className="flex items-center gap-1 px-2 rounded-lg font-bold tabular-nums"
                                style={{
                                    height: 28, fontSize: 'var(--tp-md)', minWidth: 44,
                                    color: 'var(--app-muted-foreground)',
                                    background: 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                                }}>
                                <Box size={11} />
                                <span>{childCount}</span>
                            </div>
                        )}
                    </div>

                    {/* Inline actions — always visible (touch-accessible) */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => onAdd(node.id)}
                            className="flex items-center justify-center rounded-lg active:scale-90 transition-all"
                            style={{
                                width: 32, height: 32,
                                color: 'var(--app-primary)',
                                background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            }}
                            aria-label="Add sub-category">
                            <Plus size={15} strokeWidth={2.6} />
                        </button>
                        <button
                            onClick={() => onEdit(node)}
                            className="flex items-center justify-center rounded-lg active:scale-90 transition-all"
                            style={{
                                width: 32, height: 32,
                                color: 'var(--app-muted-foreground)',
                                background: 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                            }}
                            aria-label="Edit">
                            <Pencil size={13} />
                        </button>
                        <button
                            onClick={() => {
                                if (isParent) { toast.error('Delete sub-categories first.'); return }
                                onDelete(node)
                            }}
                            className="flex items-center justify-center rounded-lg active:scale-90 transition-all"
                            style={{
                                width: 32, height: 32,
                                color: isParent ? 'var(--app-muted-foreground)' : 'var(--app-error, #ef4444)',
                                background: isParent
                                    ? 'color-mix(in srgb, var(--app-border) 20%, transparent)'
                                    : 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
                                opacity: isParent ? 0.5 : 1,
                            }}
                            aria-label={isParent ? 'Delete (locked — has children)' : 'Delete'}>
                            {isParent ? <AlertCircle size={13} /> : <Trash2 size={13} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Children */}
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children!.map((child) => (
                        <MobileCategoryRow
                            key={child.id}
                            node={child}
                            level={level + 1}
                            searchQuery={searchQuery}
                            forceExpanded={forceExpanded}
                            onOpenSheet={onOpenSheet}
                            onEdit={onEdit}
                            onAdd={onAdd}
                            onDelete={onDelete}
                            onLongPress={onLongPress}
                            onDrillIn={onDrillIn}
                            selected={selected && node.id === child.id}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
