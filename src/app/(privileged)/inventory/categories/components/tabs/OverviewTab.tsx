// @ts-nocheck
'use client'

import {
    Plus, Folder, Trash2, GitBranch, Package, Paintbrush, Tag, Layers
} from 'lucide-react'
import type { CategoryNode, PanelTab } from '../types'

/* ═══════════════════════════════════════════════════════════
 *  Overview Tab — Compact stat grid + sub-categories list
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
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                        {node.code}
                    </span>
                )}
                {node.short_name && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                        {node.short_name}
                    </span>
                )}
                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{
                        background: isRoot
                            ? 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))'
                            : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                        color: isRoot ? '#fff' : 'var(--app-muted-foreground)',
                    }}>
                    {isRoot ? 'Root' : `Level ${node.level ?? 1}`}
                </span>
                {(node.parfum_count ?? 0) > 0 && (
                    <span className="text-[9px] font-bold tabular-nums ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>
                        {node.parfum_count} parfums
                    </span>
                )}
            </div>

            {/* ── Stat Grid 2×2 ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {[
                    { label: 'Children', value: childCount, icon: <GitBranch size={12} />, color: 'var(--app-primary)', tab: null as PanelTab | null },
                    { label: 'Products', value: productCount, icon: <Package size={12} />, color: 'var(--app-success, #22c55e)', tab: 'products' as PanelTab },
                    { label: 'Brands', value: brandCount, icon: <Paintbrush size={12} />, color: '#8b5cf6', tab: 'brands' as PanelTab },
                    { label: 'Attrs', value: attributeCount, icon: <Tag size={12} />, color: 'var(--app-warning, #f59e0b)', tab: 'attributes' as PanelTab },
                ].map(s => (
                    <button key={s.label}
                        onClick={() => s.tab && onTabChange(s.tab)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all text-left ${s.tab ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : 'cursor-default'}`}
                        style={{
                            background: s.value > 0
                                ? `color-mix(in srgb, ${s.color} 5%, var(--app-surface))`
                                : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: `1px solid ${s.value > 0 ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                                background: `color-mix(in srgb, ${s.color} ${s.value > 0 ? '12' : '6'}%, transparent)`,
                                color: s.value > 0 ? s.color : 'var(--app-muted-foreground)',
                            }}>
                            {s.icon}
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-black tabular-nums leading-tight"
                                style={{ color: s.value > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                {s.value}
                            </div>
                            <div className="text-[8px] font-bold uppercase tracking-widest leading-none"
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
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Sub-categories</p>
                        <button onClick={() => onAdd(node.id)}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all"
                            style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
                            <Plus size={9} /> Add
                        </button>
                    </div>
                    <div className="flex flex-col">
                        {node.children!.map(child => {
                            const cp = child.product_count ?? 0
                            const cb = child.brand_count ?? 0
                            return (
                                <div key={child.id}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:brightness-105 transition-all"
                                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 12%, transparent)' }}>
                                    <Folder size={10} style={{ color: 'var(--app-muted-foreground)', flexShrink: 0 }} />
                                    <span className="flex-1 text-[11px] font-semibold text-app-foreground truncate">{child.name}</span>
                                    {cb > 0 && <span className="text-[9px] font-black tabular-nums" style={{ color: '#8b5cf6' }}>{cb}b</span>}
                                    {cp > 0 && <span className="text-[9px] font-black tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>{cp}p</span>}
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
                    <p className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Leaf — no sub-categories</p>
                    <button onClick={() => onAdd(node.id)}
                        className="mt-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg mx-auto flex items-center gap-1 transition-all"
                        style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
                        <Plus size={9} /> Add Sub-category
                    </button>
                </div>
            )}

            {/* ── Delete ── */}
            {!isParent && (
                <button onClick={() => onDelete(node)}
                    className="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-xl border transition-all hover:brightness-105"
                    style={{
                        color: 'var(--app-error, #ef4444)',
                        borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)',
                        background: 'color-mix(in srgb, var(--app-error, #ef4444) 4%, transparent)',
                    }}>
                    <Trash2 size={11} /> Delete
                </button>
            )}
        </div>
    )
}
