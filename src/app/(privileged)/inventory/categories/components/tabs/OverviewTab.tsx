// @ts-nocheck
'use client'

import {
    Plus, Folder, Trash2, GitBranch, Package, Paintbrush, Tag
} from 'lucide-react'
import type { CategoryNode, PanelTab } from '../types'

/* ═══════════════════════════════════════════════════════════
 *  Overview Tab — Stat grid + sub-categories list
 * ═══════════════════════════════════════════════════════════ */
export function OverviewTab({ node, onAdd, onDelete, isParent, childCount, productCount, brandCount, attributeCount, onTabChange }: {
    node: CategoryNode; onAdd: (pid?: number) => void; onDelete: (n: CategoryNode) => void;
    isParent: boolean; childCount: number; productCount: number; brandCount: number;
    attributeCount: number; onTabChange: (tab: PanelTab) => void;
}) {
    const isRoot = node.parent === null

    return (
        <div className="p-3 space-y-3 animate-in fade-in duration-150">

            {/* ── Quick Info Strip ── */}
            <div className="flex items-center gap-2 flex-wrap">
                {node.code && (
                    <span className="font-mono text-tp-xs font-semibold px-2 py-0.5 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                        {node.code}
                    </span>
                )}
                {node.short_name && (
                    <span className="text-tp-xs font-medium px-2 py-0.5 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                        {node.short_name}
                    </span>
                )}
                <span className="text-tp-xxs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{
                        background: isRoot
                            ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                            : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                        color: isRoot ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                    }}>
                    {isRoot ? 'Root' : `Level ${node.level ?? 1}`}
                </span>
            </div>

            {/* ── Stat Grid 2×2 ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {[
                    { label: 'Children', value: childCount, icon: <GitBranch size={13} />, color: 'var(--app-primary)', tab: null as PanelTab | null },
                    { label: 'Products', value: productCount, icon: <Package size={13} />, color: 'var(--app-success, #22c55e)', tab: 'products' as PanelTab },
                    { label: 'Brands', value: brandCount, icon: <Paintbrush size={13} />, color: 'var(--app-info)', tab: 'brands' as PanelTab },
                    { label: 'Attributes', value: attributeCount, icon: <Tag size={13} />, color: 'var(--app-warning, #f59e0b)', tab: 'attributes' as PanelTab },
                ].map(s => (
                    <button key={s.label}
                        onClick={() => s.tab && onTabChange(s.tab)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left ${s.tab ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : 'cursor-default'}`}
                        style={{
                            background: s.value > 0
                                ? `color-mix(in srgb, ${s.color} 5%, var(--app-surface))`
                                : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: `1px solid ${s.value > 0 ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                        }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                                background: `color-mix(in srgb, ${s.color} ${s.value > 0 ? '12' : '6'}%, transparent)`,
                                color: s.value > 0 ? s.color : 'var(--app-muted-foreground)',
                            }}>
                            {s.icon}
                        </div>
                        <div className="min-w-0">
                            <div className="text-tp-lg font-bold tabular-nums leading-tight"
                                style={{ color: s.value > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                {s.value}
                            </div>
                            <div className="text-tp-xs font-medium leading-none"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                {s.label}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* ── Sub-categories (compact) ── */}
            {childCount > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>Sub-categories</p>
                        <button onClick={() => onAdd(node.id)}
                            className="flex items-center gap-1 text-tp-xs font-semibold px-2 py-0.5 rounded-lg transition-colors"
                            style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
                            <Plus size={10} /> Add
                        </button>
                    </div>
                    <div className="flex flex-col">
                        {node.children!.map(child => {
                            const cp = child.product_count ?? 0
                            const cb = child.brand_count ?? 0
                            return (
                                <div key={child.id}
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-app-surface-hover transition-colors"
                                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 12%, transparent)' }}>
                                    <Folder size={12} style={{ color: 'var(--app-muted-foreground)', flexShrink: 0 }} />
                                    <span className="flex-1 text-tp-md font-medium text-app-foreground truncate">{child.name}</span>
                                    {cb > 0 && <span className="text-tp-xs font-semibold tabular-nums" style={{ color: 'var(--app-info)' }}>{cb}b</span>}
                                    {cp > 0 && <span className="text-tp-xs font-semibold tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>{cp}p</span>}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Leaf ── */}
            {childCount === 0 && (
                <div className="rounded-xl py-3 px-3 text-center"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 40%, transparent)', border: '1px dashed color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    <p className="text-tp-sm font-medium" style={{ color: 'var(--app-muted-foreground)' }}>No sub-categories</p>
                    <button onClick={() => onAdd(node.id)}
                        className="mt-1.5 text-tp-sm font-semibold px-2.5 py-1 rounded-lg mx-auto flex items-center gap-1 transition-colors"
                        style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
                        <Plus size={10} /> Add Sub-category
                    </button>
                </div>
            )}

            {/* ── Delete ── */}
            {!isParent && (
                <button onClick={() => onDelete(node)}
                    className="w-full flex items-center justify-center gap-1.5 text-tp-sm font-semibold px-3 py-2 rounded-xl border transition-colors hover:brightness-105"
                    style={{
                        color: 'var(--app-error, #ef4444)',
                        borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)',
                        background: 'color-mix(in srgb, var(--app-error, #ef4444) 4%, transparent)',
                    }}>
                    <Trash2 size={12} /> Delete
                </button>
            )}
        </div>
    )
}
