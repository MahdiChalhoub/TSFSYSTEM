'use client'

import { useState, useRef, useEffect, type ComponentType } from 'react'
import {
    ChevronRight, Plus, Pencil, Trash2, MapPin,
    Building2, Store, Warehouse as WarehouseIcon, Cloud, Package,
} from 'lucide-react'
import { MasterListCard } from '@/components/templates/MasterListCard'

/* ═══════════════════════════════════════════════════════════
 *  WAREHOUSE ROW — thin MasterListCard consumer.
 *  Owns only: recursion, expand/collapse state, indent spacing.
 *  Every other bit of visual grammar (icon tile, title block,
 *  badges, right slot, hover-actions) comes from the shared card.
 * ═══════════════════════════════════════════════════════════ */

type IconComponent = ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>

export type WarehouseNode = {
    id: number
    name: string
    code?: string
    reference_code?: string
    city?: string
    location_type?: string
    can_sell?: boolean
    is_active?: boolean
    inventory_count?: number
    country_name?: string
    country_iso2?: string
    children?: WarehouseNode[]
}

type WarehouseRowProps = {
    node: WarehouseNode
    level: number
    onEdit: (n: WarehouseNode) => void
    onAdd: (parentId: number) => void
    onDelete: (n: WarehouseNode) => void
    onSelect?: (n: WarehouseNode) => void
    searchQuery?: string
    forceExpanded?: boolean
}

type Badge = { label: string; color: string }

const TYPE_CONFIG: Record<string, { icon: IconComponent; label: string; color: string }> = {
    BRANCH:    { icon: Building2,     label: 'Branch',    color: 'var(--app-success)' },
    STORE:     { icon: Store,         label: 'Store',     color: 'var(--app-info)' },
    WAREHOUSE: { icon: WarehouseIcon, label: 'Warehouse', color: 'var(--app-warning)' },
    VIRTUAL:   { icon: Cloud,         label: 'Virtual',   color: 'var(--app-primary)' },
}

export const WarehouseRow = ({
    node, level, onEdit, onAdd, onDelete, onSelect,
    searchQuery, forceExpanded,
}: WarehouseRowProps) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 2)
    const prevForceExpanded = useRef(forceExpanded)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => {
        if (forceExpanded !== undefined && forceExpanded !== prevForceExpanded.current) setIsOpen(forceExpanded)
        prevForceExpanded.current = forceExpanded
    }, [forceExpanded])

    const cfg = TYPE_CONFIG[node.location_type || 'WAREHOUSE'] || TYPE_CONFIG.WAREHOUSE
    const Icon = cfg.icon
    const skuCount = node.inventory_count ?? 0
    const childCount = node.children?.length ?? 0

    // Badges: type always; POS + Inactive conditionally.
    const badges: Badge[] = [{ label: cfg.label, color: cfg.color }]
    if (node.can_sell) badges.push({ label: 'POS', color: 'var(--app-success)' })
    if (node.is_active === false) badges.push({ label: 'Inactive', color: 'var(--app-error)' })

    return (
        <div>
            <div style={{ paddingLeft: level > 0 ? level * 20 : 0, position: 'relative' }}>
                {/* Tree indent guide */}
                {level > 0 && (
                    <div className="absolute top-0 bottom-0"
                        style={{
                            left: `${10 + (level - 1) * 20}px`,
                            width: '1px',
                            background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                        }} />
                )}

                <MasterListCard
                    icon={<Icon size={13} />}
                    accentColor={cfg.color}
                    leftAccent={level === 0 ? cfg.color : undefined}
                    onClick={() => { if (isParent) setIsOpen(o => !o); else onSelect?.(node) }}
                    onDoubleClick={() => onSelect?.(node)}
                    leadingSlot={
                        <button onClick={(e) => { e.stopPropagation(); if (isParent) setIsOpen(!isOpen) }}
                            className={`w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0 ${isParent ? 'hover:bg-app-border/40' : ''}`}>
                            {isParent ? (
                                <ChevronRight size={14}
                                    className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                                    style={{ color: isOpen ? cfg.color : 'var(--app-muted-foreground)' }} />
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
                            )}
                        </button>
                    }
                    title={
                        <span
                            onClick={(e) => { e.stopPropagation(); onSelect?.(node) }}
                            className="cursor-pointer">
                            {node.name}
                        </span>
                    }
                    badges={badges}
                    subtitle={(node.reference_code || node.code || node.city) ? (
                        <>
                            {node.reference_code && (
                                <span className="font-mono font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                        color: 'var(--app-primary)',
                                    }}>
                                    {node.reference_code}
                                </span>
                            )}
                            {node.code && (
                                <span className="font-mono font-medium">{node.code}</span>
                            )}
                            {node.city && (
                                <span className="flex items-center gap-0.5 font-medium">
                                    <MapPin size={9} />{node.city}
                                </span>
                            )}
                        </>
                    ) : null}
                    rightSlot={
                        <>
                            <div className="hidden sm:flex w-10 flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold tabular-nums"
                                    style={{ color: isParent ? 'var(--app-foreground)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                    {isParent ? childCount : '–'}
                                </span>
                            </div>
                            <div className="hidden md:flex w-16 flex-shrink-0 justify-center">
                                {node.country_name ? (
                                    <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                                        style={{ color: cfg.color, background: `color-mix(in srgb, ${cfg.color} 8%, transparent)` }}>
                                        {node.country_iso2 || node.country_name}
                                    </span>
                                ) : (
                                    <span className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>—</span>
                                )}
                            </div>
                            <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold tabular-nums flex items-center gap-0.5"
                                    style={{ color: skuCount > 0 ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                    <Package size={10} />{skuCount}
                                </span>
                            </div>
                        </>
                    }
                    actions={
                        <>
                            <button onClick={(e) => { e.stopPropagation(); onEdit(node) }}
                                className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                                <Pencil size={12} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onAdd(node.id) }}
                                className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-info transition-colors" title="Add child">
                                <Plus size={13} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(node) }}
                                className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors">
                                <Trash2 size={12} />
                            </button>
                        </>
                    }
                />
            </div>
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children?.map((child) => (
                        <WarehouseRow key={child.id} node={child} level={level + 1}
                            onEdit={onEdit} onAdd={onAdd} onDelete={onDelete} onSelect={onSelect}
                            searchQuery={searchQuery} forceExpanded={forceExpanded} />
                    ))}
                </div>
            )}
        </div>
    )
}
