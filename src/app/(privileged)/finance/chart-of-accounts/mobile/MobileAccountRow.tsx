// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileAccountRow — two-tier COA row
 *  Line 1: chevron · code · name · type chip
 *  Line 2: balance (tabular) · inactive badge · inline actions
 * ═══════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect } from 'react'
import {
    ChevronRight, Pencil, Power, EyeOff, Wallet, TrendingDown, TrendingUp,
    BarChart3, Scale,
} from 'lucide-react'
import { useRowGestures } from '@/hooks/use-row-gestures'

const TYPE_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
    ASSET:     { color: 'var(--app-info, #3B82F6)',    icon: Wallet,       label: 'Asset' },
    LIABILITY: { color: 'var(--app-error, #EF4444)',   icon: TrendingDown, label: 'Liability' },
    EQUITY:    { color: '#8b5cf6',                     icon: Scale,        label: 'Equity' },
    INCOME:    { color: 'var(--app-success, #10B981)', icon: TrendingUp,   label: 'Income' },
    EXPENSE:   { color: 'var(--app-warning, #F59E0B)', icon: BarChart3,    label: 'Expense' },
    REVENUE:   { color: 'var(--app-success, #10B981)', icon: TrendingUp,   label: 'Revenue' },
}

function formatBalance(n: number | undefined): string {
    if (n == null || isNaN(n)) return '—'
    const abs = Math.abs(n)
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return n < 0 ? `(${formatted})` : formatted
}

interface Props {
    node: any
    level: number
    searchQuery: string
    forceExpanded?: boolean
    onOpenSheet: (n: any) => void
    onEdit: (n: any) => void
    onLongPress?: (n: any) => void
    onReactivate?: (n: any) => void
    selected?: boolean
}

export function MobileAccountRow({
    node, level, searchQuery, forceExpanded,
    onOpenSheet, onEdit, onLongPress, onReactivate, selected,
}: Props) {
    const isParent = node.children && node.children.length > 0
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
    const typeConf = TYPE_CONFIG[node.type] ?? TYPE_CONFIG.ASSET
    const TypeIcon = typeConf.icon
    const balance = node.rollupBalance ?? node.rollup_balance ?? node.balance ?? 0

    return (
        <div style={{ opacity: node.isActive === false ? 0.55 : 1 }}>
            <div
                ref={rowRef}
                onClick={() => {
                    if (isLongPressing) return
                    if (isParent) setIsOpen(o => !o)
                    else onOpenSheet(node)
                }}
                className="relative rounded-xl mb-1.5 transition-all active:scale-[0.99]"
                style={{
                    minHeight: isRoot ? 72 : 62,
                    padding: `10px 10px 10px ${indentPx + (deepCap ? 16 : 0)}px`,
                    background: isLongPressing
                        ? 'color-mix(in srgb, var(--app-primary) 12%, var(--app-surface))'
                        : selected
                            ? 'color-mix(in srgb, var(--app-primary) 7%, var(--app-surface))'
                            : isRoot
                                ? `linear-gradient(90deg, color-mix(in srgb, ${typeConf.color} 6%, var(--app-surface)) 0%, var(--app-surface) 100%)`
                                : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                    border: (isLongPressing || selected)
                        ? '1px solid color-mix(in srgb, var(--app-primary) 45%, transparent)'
                        : '1px solid color-mix(in srgb, var(--app-border) 45%, transparent)',
                    boxShadow: isRoot ? `0 2px 8px color-mix(in srgb, ${typeConf.color} 10%, transparent)` : 'none',
                    transform: isLongPressing ? 'scale(0.985)' : undefined,
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                }}>

                {/* Left accent for root */}
                {isRoot && (
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
                        style={{ background: typeConf.color }} />
                )}

                {deepCap && (
                    <div className="absolute font-black"
                        style={{ left: indentPx, top: 10, fontSize: 'var(--tp-xs)', color: 'color-mix(in srgb, var(--app-muted-foreground) 50%, transparent)' }}>
                        └─
                    </div>
                )}

                {/* Line 1 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); isParent && setIsOpen(!isOpen) }}
                        className="flex items-center justify-center rounded-lg flex-shrink-0 transition-all active:scale-90"
                        style={{
                            width: 26, height: 26,
                            background: isParent
                                ? (isOpen ? `color-mix(in srgb, ${typeConf.color} 12%, transparent)` : 'color-mix(in srgb, var(--app-border) 25%, transparent)')
                                : 'transparent',
                        }}>
                        {isParent ? (
                            <ChevronRight size={13}
                                style={{
                                    color: isOpen ? typeConf.color : 'var(--app-muted-foreground)',
                                    transition: 'transform 160ms',
                                    transform: isOpen ? 'rotate(90deg)' : 'none',
                                }} />
                        ) : (
                            <div style={{ width: 5, height: 5, borderRadius: 999, background: `color-mix(in srgb, ${typeConf.color} 40%, transparent)` }} />
                        )}
                    </button>

                    <div className="flex items-center justify-center rounded-lg flex-shrink-0"
                        style={{
                            width: 28, height: 28,
                            background: `color-mix(in srgb, ${typeConf.color} 12%, transparent)`,
                            color: typeConf.color,
                        }}>
                        <TypeIcon size={13} />
                    </div>

                    <span className="font-mono font-black tabular-nums text-app-foreground flex-shrink-0"
                        style={{ fontSize: 'var(--tp-md)' }}>
                        {node.code}
                    </span>

                    <span className="flex-1 truncate font-bold text-app-foreground"
                        style={{ fontSize: 'var(--tp-lg)', fontWeight: isRoot ? 900 : 600 }}>
                        {node.name}
                    </span>

                    {isRoot && (
                        <span className="flex-shrink-0 font-black uppercase tracking-widest rounded-full"
                            style={{
                                fontSize: 'var(--tp-xxs)', padding: '2px 7px',
                                background: `color-mix(in srgb, ${typeConf.color} 14%, transparent)`,
                                color: typeConf.color,
                            }}>
                            {typeConf.label}
                        </span>
                    )}
                </div>

                {/* Line 2 */}
                <div className="flex items-center gap-2 mt-1.5" style={{ paddingLeft: 62 }}>
                    <span className="flex-1 font-mono font-black tabular-nums truncate"
                        style={{
                            fontSize: 'var(--tp-md)',
                            color: balance < 0
                                ? 'var(--app-error, #ef4444)'
                                : balance > 0
                                    ? 'var(--app-foreground)'
                                    : 'var(--app-muted-foreground)',
                        }}>
                        {formatBalance(balance)}
                    </span>

                    {node.isActive === false && (
                        <span className="flex items-center gap-1 font-black uppercase tracking-wider rounded-md px-2 py-0.5"
                            style={{
                                fontSize: 'var(--tp-xxs)',
                                color: 'var(--app-muted-foreground)',
                                background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                            }}>
                            <EyeOff size={10} /> Inactive
                        </span>
                    )}

                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {node.isActive === false ? (
                            <button
                                onClick={() => onReactivate?.(node)}
                                className="flex items-center justify-center rounded-lg active:scale-90 transition-transform"
                                style={{
                                    width: 30, height: 30,
                                    color: 'var(--app-success, #10b981)',
                                    background: 'color-mix(in srgb, var(--app-success, #10b981) 12%, transparent)',
                                }}
                                aria-label="Reactivate">
                                <Power size={12} />
                            </button>
                        ) : (
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
                        )}
                    </div>
                </div>
            </div>

            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children.map((child: any) => (
                        <MobileAccountRow
                            key={child.id}
                            node={child}
                            level={level + 1}
                            searchQuery={searchQuery}
                            forceExpanded={forceExpanded}
                            onOpenSheet={onOpenSheet}
                            onEdit={onEdit}
                            onLongPress={onLongPress}
                            onReactivate={onReactivate}
                            selected={selected}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
