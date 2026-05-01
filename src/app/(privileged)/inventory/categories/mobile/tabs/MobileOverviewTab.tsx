'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileOverviewTab — mobile-native rewrite of the Overview tab
 *  Bigger type, larger tap targets, cleaner layout for bottom-sheet use.
 * ═══════════════════════════════════════════════════════════ */

import {
    Plus, Folder, Trash2, GitBranch, Package, Paintbrush, Tag, ChevronRight,
} from 'lucide-react'
import type { CategoryNode, PanelTab } from '../../components/types'

interface Props {
    node: CategoryNode
    isParent: boolean
    childCount: number
    productCount: number
    brandCount: number
    attributeCount: number
    onAdd: (pid?: number) => void
    onDelete: (n: CategoryNode) => void
    onTabChange: (tab: PanelTab) => void
    onOpenChild?: (child: CategoryNode) => void
}

export function MobileOverviewTab({
    node, isParent, childCount, productCount, brandCount, attributeCount,
    onAdd, onDelete, onTabChange, onOpenChild,
}: Props) {
    const isRoot = node.parent === null

    const statCards = [
        { key: 'children', label: 'Children', value: childCount, icon: <GitBranch size={16} />, color: 'var(--app-primary)', tab: null as PanelTab | null },
        { key: 'products', label: 'Products', value: productCount, icon: <Package size={16} />, color: 'var(--app-success, #10b981)', tab: 'products' as PanelTab },
        { key: 'brands', label: 'Brands', value: brandCount, icon: <Paintbrush size={16} />, color: 'var(--app-info)', tab: 'brands' as PanelTab },
        { key: 'attrs', label: 'Attributes', value: attributeCount, icon: <Tag size={16} />, color: 'var(--app-warning, #f59e0b)', tab: 'attributes' as PanelTab },
    ]

    return (
        <div className="p-3 space-y-3 animate-in fade-in duration-200">

            {/* ── Meta strip ── */}
            <div className="flex items-center gap-2 flex-wrap">
                {node.code && (
                    <span className="font-mono font-bold rounded-lg px-2.5 py-1"
                        style={{
                            fontSize: 'var(--tp-md)',
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            color: 'var(--app-primary)',
                        }}>
                        {node.code}
                    </span>
                )}
                {node.short_name && (
                    <span className="font-bold uppercase tracking-wider rounded-lg px-2.5 py-1"
                        style={{
                            fontSize: 'var(--tp-sm)',
                            background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                            color: 'var(--app-muted-foreground)',
                        }}>
                        {node.short_name}
                    </span>
                )}
                <span className="font-bold uppercase tracking-wide rounded-full px-2.5 py-1"
                    style={{
                        fontSize: 'var(--tp-xs)',
                        background: isRoot
                            ? 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))'
                            : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                        color: isRoot ? '#fff' : 'var(--app-muted-foreground)',
                    }}>
                    {isRoot ? 'Root' : `Level ${node.level ?? 1}`}
                </span>
                {(node.parfum_count ?? 0) > 0 && (
                    <span className="ml-auto tabular-nums font-bold" style={{ fontSize: 'var(--tp-md)', color: 'var(--app-muted-foreground)' }}>
                        {node.parfum_count} parfums
                    </span>
                )}
            </div>

            {/* ── Stat grid 2×2 (large, tappable) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {statCards.map(s => {
                    const tappable = !!s.tab
                    const hot = s.value > 0
                    return (
                        <button
                            key={s.key}
                            onClick={() => s.tab && onTabChange(s.tab)}
                            disabled={!tappable}
                            className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-all text-left active:scale-[0.98]"
                            style={{
                                background: hot
                                    ? `color-mix(in srgb, ${s.color} 7%, var(--app-surface))`
                                    : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                border: `1px solid ${hot
                                    ? `color-mix(in srgb, ${s.color} 22%, transparent)`
                                    : 'color-mix(in srgb, var(--app-border) 45%, transparent)'}`,
                                minHeight: 64,
                                opacity: !tappable && !hot ? 0.7 : 1,
                            }}>
                            <div className="flex items-center justify-center flex-shrink-0"
                                style={{
                                    width: 38, height: 38, borderRadius: 12,
                                    background: `color-mix(in srgb, ${s.color} ${hot ? '14' : '7'}%, transparent)`,
                                    color: hot ? s.color : 'var(--app-muted-foreground)',
                                }}>
                                {s.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-bold tabular-nums leading-none"
                                    style={{ fontSize: 'var(--tp-stat)', color: hot ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                    {s.value}
                                </div>
                                <div className="font-bold uppercase tracking-wide mt-0.5"
                                    style={{ fontSize: 'var(--tp-xs)', color: 'var(--app-muted-foreground)' }}>
                                    {s.label}
                                </div>
                            </div>
                            {tappable && (
                                <ChevronRight size={14} className="flex-shrink-0"
                                    style={{ color: 'color-mix(in srgb, var(--app-muted-foreground) 50%, transparent)' }} />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Sub-categories ── */}
            {childCount > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-1.5 px-1">
                        <p className="font-bold uppercase tracking-wide"
                            style={{ fontSize: 'var(--tp-sm)', color: 'var(--app-muted-foreground)' }}>
                            Sub-categories
                        </p>
                        <button onClick={() => onAdd(node.id)}
                            className="flex items-center gap-1 font-bold px-2.5 py-1 rounded-lg active:scale-95 transition-all"
                            style={{
                                fontSize: 'var(--tp-md)',
                                color: 'var(--app-primary)',
                                background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            }}>
                            <Plus size={13} /> Add
                        </button>
                    </div>
                    <div className="flex flex-col gap-1">
                        {node.children!.map(child => {
                            const cp = child.product_count ?? 0
                            const cb = child.brand_count ?? 0
                            return (
                                <button
                                    key={child.id}
                                    onClick={() => onOpenChild?.(child)}
                                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl active:scale-[0.99] transition-all text-left"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 35%, transparent)',
                                        minHeight: 48,
                                    }}>
                                    <Folder size={14} style={{ color: 'var(--app-muted-foreground)', flexShrink: 0 }} />
                                    <span className="flex-1 font-bold text-app-foreground truncate" style={{ fontSize: 'var(--tp-lg)' }}>
                                        {child.name}
                                    </span>
                                    {child.barcode_prefix && (
                                        <span className="font-mono font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                                            title={`Barcode prefix — products get ${child.barcode_prefix}NNN`}
                                            style={{
                                                fontSize: 'var(--tp-xxs)',
                                                background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                                                color: 'var(--app-success, #22c55e)',
                                            }}>
                                            🏷 {child.barcode_prefix}
                                        </span>
                                    )}
                                    {cb > 0 && (
                                        <span className="font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                                            style={{ fontSize: 'var(--tp-sm)', color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 10%, transparent)' }}>
                                            {cb}b
                                        </span>
                                    )}
                                    {cp > 0 && (
                                        <span className="font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                                            style={{ fontSize: 'var(--tp-sm)', color: 'var(--app-success, #10b981)', background: 'color-mix(in srgb, var(--app-success, #10b981) 10%, transparent)' }}>
                                            {cp}p
                                        </span>
                                    )}
                                    <ChevronRight size={13} style={{ color: 'var(--app-muted-foreground)', flexShrink: 0, opacity: 0.6 }} />
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Leaf ── */}
            {childCount === 0 && (
                <div className="rounded-2xl py-4 px-4 text-center"
                    style={{
                        background: 'color-mix(in srgb, var(--app-bg) 40%, transparent)',
                        border: '1px dashed color-mix(in srgb, var(--app-border) 50%, transparent)',
                    }}>
                    <p className="font-bold mb-2" style={{ fontSize: 'var(--tp-md)', color: 'var(--app-muted-foreground)' }}>
                        Leaf · no sub-categories
                    </p>
                    <button onClick={() => onAdd(node.id)}
                        className="inline-flex items-center gap-1.5 font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
                        style={{
                            fontSize: 'var(--tp-lg)',
                            color: '#fff',
                            background: 'var(--app-primary)',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                        }}>
                        <Plus size={14} /> Add Sub-category
                    </button>
                </div>
            )}

            {/* ── Delete (only for leaves) ── */}
            {!isParent && (
                <button onClick={() => onDelete(node)}
                    className="w-full flex items-center justify-center gap-2 font-bold px-3 py-3 rounded-xl active:scale-[0.98] transition-all"
                    style={{
                        fontSize: 'var(--tp-lg)',
                        color: 'var(--app-error, #ef4444)',
                        borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)',
                        background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)',
                    }}>
                    <Trash2 size={14} /> Delete this category
                </button>
            )}
        </div>
    )
}
