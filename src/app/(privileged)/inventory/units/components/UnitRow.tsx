// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import {
    ChevronRight, Plus, Pencil, Trash2, Ruler, Scale,
    ArrowRightLeft, Package, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

/* ═══════════════════════════════════════════════════════════
 *  UNIT ROW — simplified visual hierarchy, standard chevron
 * ═══════════════════════════════════════════════════════════ */
export const UnitRow = ({ node, level, onEdit, onAdd, onDelete, searchQuery, forceExpanded, onViewProducts, onSelect, allUnits }: any) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 2)
    const prevForceExpanded = useRef(forceExpanded)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => {
        if (forceExpanded !== undefined && forceExpanded !== prevForceExpanded.current) setIsOpen(forceExpanded)
        prevForceExpanded.current = forceExpanded
    }, [forceExpanded])

    const isBase = level === 0
    const productCount = node.product_count ?? 0
    const childCount = node.children?.length ?? 0
    const convFactor = node.conversion_factor ?? 1

    return (
        <div>
            <div className={`group flex items-center gap-2 transition-colors duration-150 relative cursor-pointer
                ${isBase ? 'py-2.5' : 'py-2'} hover:bg-app-surface-hover`}
                onClick={(e) => { e.stopPropagation(); if (isParent) setIsOpen(o => !o); else onSelect?.(node) }}
                onDoubleClick={(e) => { e.stopPropagation(); onSelect?.(node) }}
                style={{
                    paddingLeft: `${12 + (level > 0 ? level * 20 : 0)}px`, paddingRight: '12px',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                }}>
                {/* Left accent for base */}
                {isBase && <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full" style={{ background: 'var(--app-info)' }} />}
                {/* Indent connector */}
                {level > 0 && <div className="absolute top-0 bottom-0" style={{ left: `${10 + (level - 1) * 20}px`, width: '1px', background: 'color-mix(in srgb, var(--app-border) 25%, transparent)' }} />}

                {/* Expand chevron */}
                <button onClick={(e) => { e.stopPropagation(); isParent && setIsOpen(!isOpen) }}
                    className={`w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0 ${isParent ? 'hover:bg-app-border/40' : ''}`}>
                    {isParent ? (
                        <ChevronRight size={14}
                            className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                            style={{ color: isOpen ? 'var(--app-info)' : 'var(--app-muted-foreground)' }} />
                    ) : <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />}
                </button>

                {/* Icon — flat */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: isBase ? 'color-mix(in srgb, var(--app-info) 15%, transparent)' : 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                        color: isBase ? 'var(--app-info)' : 'var(--app-muted-foreground)',
                    }}>
                    <Ruler size={13} />
                </div>

                {/* Name block */}
                <div className="flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); onSelect?.(node) }}>
                    <div className="flex items-center gap-1.5">
                        <span className={`truncate text-tp-lg ${isBase ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}>{node.name}</span>
                        {isBase && <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>BASE</span>}
                        {node.needs_balance && <Scale size={11} style={{ color: 'var(--app-warning)', flexShrink: 0 }} />}
                    </div>
                    {(node.code || node.short_name) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {node.code && <span className="font-mono text-tp-xxs font-medium text-app-muted-foreground">{node.code}</span>}
                            {node.short_name && <span className="text-tp-xxs font-medium text-app-muted-foreground opacity-60">{node.short_name}</span>}
                        </div>
                    )}
                </div>

                {/* Sub count */}
                <div className="hidden sm:flex w-10 flex-shrink-0 justify-center">
                    <span className="text-tp-xs font-semibold tabular-nums"
                        style={{ color: isParent ? 'var(--app-foreground)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                        {isParent ? childCount : '–'}
                    </span>
                </div>

                {/* Conversion */}
                <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                    <span className="text-tp-xs font-semibold tabular-nums flex items-center gap-0.5"
                        style={{ color: !isBase ? '#8b5cf6' : 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)' }}>
                        {isBase ? '1:1' : `×${convFactor}`}
                    </span>
                </div>

                {/* Products */}
                <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                    <button onClick={(e) => { e.stopPropagation(); onViewProducts(node) }}
                        className="text-tp-xs font-semibold tabular-nums transition-colors hover:underline"
                        style={{ color: productCount > 0 ? 'var(--app-success)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                        {productCount}
                    </button>
                </div>

                {/* Actions */}
                <div className="w-[68px] flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(node) }} className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit"><Pencil size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onAdd(node.id) }} className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-info transition-colors" title="Add derived"><Plus size={13} /></button>
                    <button onClick={(e) => { e.stopPropagation(); if (isParent) { toast.error('Delete derived units first.'); return; } onDelete(node); }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg transition-colors"
                        style={{ color: isParent ? 'var(--app-border)' : 'var(--app-muted-foreground)', cursor: isParent ? 'not-allowed' : 'pointer' }}>
                        {isParent ? <AlertCircle size={12} /> : <Trash2 size={12} />}
                    </button>
                </div>
            </div>
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children.map((child: any) => (
                        <UnitRow key={child.id} node={child} level={level + 1} onEdit={onEdit} onAdd={onAdd} onDelete={onDelete}
                            onViewProducts={onViewProducts} onSelect={onSelect} searchQuery={searchQuery} forceExpanded={forceExpanded} allUnits={allUnits} />
                    ))}
                </div>
            )}
        </div>
    )
}
