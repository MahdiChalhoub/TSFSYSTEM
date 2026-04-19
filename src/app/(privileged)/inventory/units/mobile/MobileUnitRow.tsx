// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileUnitRow — two-tier row for Units & Packaging
 *  Line 1: chevron · icon · name · BASE badge · scale icon
 *  Line 2: code · ×factor · products chip · inline actions
 * ═══════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect } from 'react'
import {
    ChevronRight, Plus, Pencil, Trash2, Ruler, Package, Scale, AlertCircle,
    ArrowRightLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRowGestures } from '@/hooks/use-row-gestures'

interface Props {
    node: any
    level: number
    searchQuery: string
    forceExpanded?: boolean
    onOpenSheet: (n: any) => void
    onEdit: (n: any) => void
    onAdd: (parentId?: number) => void
    onDelete: (n: any) => void
    onLongPress?: (n: any) => void
    selected?: boolean
}

export function MobileUnitRow({
    node, level, searchQuery, forceExpanded,
    onOpenSheet, onEdit, onAdd, onDelete, onLongPress, selected,
}: Props) {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 1)
    const prevForce = useRef(forceExpanded)
    const rowRef = useRef<HTMLDivElement>(null)
    const { isLongPressing } = useRowGestures(rowRef, { onLongPress: () => onLongPress?.(node) })

    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => {
        if (forceExpanded !== undefined && forceExpanded !== prevForce.current) setIsOpen(forceExpanded)
        prevForce.current = forceExpanded
    }, [forceExpanded])

    const isBase = level === 0
    const visibleLevel = Math.min(level, 3)
    const indentPx = 12 + visibleLevel * 14
    const productCount = node.product_count ?? 0
    const convFactor = node.conversion_factor ?? 1
    const needsBalance = !!node.needs_balance

    return (
        <div>
            <div
                ref={rowRef}
                onClick={() => {
                    if (isLongPressing) return
                    if (isParent) setIsOpen(o => !o)
                    else onOpenSheet(node)
                }}
                className="relative rounded-xl mb-1.5 transition-all active:scale-[0.99]"
                style={{
                    minHeight: isBase ? 72 : 62,
                    padding: `10px 10px 10px ${indentPx}px`,
                    background: isLongPressing
                        ? 'color-mix(in srgb, var(--app-primary) 12%, var(--app-surface))'
                        : selected
                            ? 'color-mix(in srgb, var(--app-primary) 7%, var(--app-surface))'
                            : isBase
                                ? 'linear-gradient(90deg, color-mix(in srgb, var(--app-info, #3b82f6) 6%, var(--app-surface)) 0%, var(--app-surface) 100%)'
                                : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                    border: (isLongPressing || selected)
                        ? '1px solid color-mix(in srgb, var(--app-primary) 45%, transparent)'
                        : '1px solid color-mix(in srgb, var(--app-border) 45%, transparent)',
                    boxShadow: isBase ? '0 2px 8px color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)' : 'none',
                    transform: isLongPressing ? 'scale(0.985)' : undefined,
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                }}>
                {isBase && (
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
                        style={{ background: 'var(--app-info, #3b82f6)' }} />
                )}

                {/* Line 1 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); isParent && setIsOpen(!isOpen) }}
                        className="flex items-center justify-center rounded-lg flex-shrink-0 transition-all active:scale-90"
                        style={{
                            width: 26, height: 26,
                            background: isParent
                                ? (isOpen ? 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 25%, transparent)')
                                : 'transparent',
                        }}>
                        {isParent ? (
                            <ChevronRight size={13}
                                style={{
                                    color: isOpen ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)',
                                    transition: 'transform 160ms',
                                    transform: isOpen ? 'rotate(90deg)' : 'none',
                                }} />
                        ) : (
                            <div style={{ width: 5, height: 5, borderRadius: 999, background: 'color-mix(in srgb, var(--app-info, #3b82f6) 40%, transparent)' }} />
                        )}
                    </button>

                    <div className="flex items-center justify-center rounded-xl flex-shrink-0"
                        style={{
                            width: 28, height: 28,
                            background: isBase
                                ? 'linear-gradient(135deg, var(--app-info, #3b82f6), color-mix(in srgb, var(--app-info, #3b82f6) 70%, #6366f1))'
                                : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                            color: isBase ? '#fff' : 'var(--app-muted-foreground)',
                        }}>
                        <Ruler size={isBase ? 13 : 12} />
                    </div>

                    <span className="flex-1 truncate font-black text-app-foreground"
                        style={{ fontSize: 'var(--tp-lg)', fontWeight: isBase ? 900 : 600 }}>
                        {node.name}
                    </span>

                    {needsBalance && (
                        <Scale size={13} style={{ color: 'var(--app-warning, #f59e0b)', flexShrink: 0 }} />
                    )}

                    {isBase && (
                        <span className="flex-shrink-0 font-black uppercase tracking-widest rounded-full"
                            style={{
                                fontSize: 'var(--tp-xxs)', padding: '2px 7px',
                                background: 'color-mix(in srgb, var(--app-info, #3b82f6) 14%, transparent)',
                                color: 'var(--app-info, #3b82f6)',
                            }}>
                            Base
                        </span>
                    )}
                </div>

                {/* Line 2 */}
                <div className="flex items-center gap-1.5 mt-2" style={{ paddingLeft: 36 }}>
                    <div className="flex items-center gap-1.5 flex-1 flex-wrap min-w-0">
                        {node.code && (
                            <span className="font-mono font-black text-app-muted-foreground px-1.5"
                                style={{ fontSize: 'var(--tp-sm)' }}>
                                {node.code}
                            </span>
                        )}
                        {!isBase && (
                            <span className="flex items-center gap-1 font-black tabular-nums rounded-lg px-2 py-0.5"
                                style={{
                                    fontSize: 'var(--tp-xs)',
                                    color: '#8b5cf6',
                                    background: 'color-mix(in srgb, #8b5cf6 10%, transparent)',
                                    border: '1px solid color-mix(in srgb, #8b5cf6 20%, transparent)',
                                }}>
                                <ArrowRightLeft size={10} /> ×{convFactor}
                            </span>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onOpenSheet(node) }}
                            disabled={productCount === 0}
                            className="flex items-center gap-1 font-black tabular-nums rounded-lg px-2 active:scale-95 transition-transform"
                            style={{
                                height: 26,
                                fontSize: 'var(--tp-xs)',
                                color: productCount > 0 ? 'var(--app-success, #10b981)' : 'color-mix(in srgb, var(--app-muted-foreground) 45%, transparent)',
                                background: productCount > 0 ? 'color-mix(in srgb, var(--app-success, #10b981) 10%, transparent)' : 'color-mix(in srgb, var(--app-border) 18%, transparent)',
                                border: `1px solid ${productCount > 0 ? 'color-mix(in srgb, var(--app-success, #10b981) 20%, transparent)' : 'transparent'}`,
                            }}
                            aria-label={`${productCount} products`}>
                            <Package size={10} /> {productCount}
                        </button>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => onAdd(node.id)}
                            className="flex items-center justify-center rounded-lg active:scale-90 transition-transform"
                            style={{
                                width: 30, height: 30,
                                color: 'var(--app-primary)',
                                background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            }}
                            aria-label="Add derived unit">
                            <Plus size={14} strokeWidth={2.6} />
                        </button>
                        <button
                            onClick={() => onEdit(node)}
                            className="flex items-center justify-center rounded-lg active:scale-90 transition-transform"
                            style={{
                                width: 30, height: 30,
                                color: 'var(--app-muted-foreground)',
                                background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                            }}
                            aria-label="Edit">
                            <Pencil size={12} />
                        </button>
                        <button
                            onClick={() => {
                                if (isParent) { toast.error('Remove derived units first.'); return }
                                onDelete(node)
                            }}
                            className="flex items-center justify-center rounded-lg active:scale-90 transition-transform"
                            style={{
                                width: 30, height: 30,
                                color: isParent ? 'var(--app-muted-foreground)' : 'var(--app-error, #ef4444)',
                                background: isParent
                                    ? 'color-mix(in srgb, var(--app-border) 20%, transparent)'
                                    : 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
                                opacity: isParent ? 0.5 : 1,
                            }}
                            aria-label={isParent ? 'Delete (locked)' : 'Delete'}>
                            {isParent ? <AlertCircle size={12} /> : <Trash2 size={12} />}
                        </button>
                    </div>
                </div>
            </div>

            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children.map((child: any) => (
                        <MobileUnitRow
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
                            selected={selected}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
