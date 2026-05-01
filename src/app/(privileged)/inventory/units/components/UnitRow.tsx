'use client'

import { useState, useRef, useEffect } from 'react'
import {
    ChevronRight, Plus, Pencil, Trash2, Ruler, Scale, Package, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { MasterListCard, type MasterListBadge } from '@/components/templates/MasterListCard'

/* ═══════════════════════════════════════════════════════════
 *  UNIT ROW — thin MasterListCard consumer.
 *  Only bespoke concern: tree recursion + expand/collapse.
 * ═══════════════════════════════════════════════════════════ */

export type UnitNode = {
    id: number
    name: string
    code?: string
    short_name?: string
    reference_code?: string
    type?: string
    base_unit?: number | null
    conversion_factor?: number
    needs_balance?: boolean
    product_count?: number
    package_count?: number
    children?: UnitNode[]
}

type UnitRowProps = {
    node: UnitNode
    level: number
    onEdit: (n: UnitNode) => void
    onAdd: (parentId?: number) => void
    onDelete: (n: UnitNode) => void
    searchQuery?: string
    forceExpanded?: boolean
    onViewProducts: (n: UnitNode) => void
    onSelect?: (n: UnitNode) => void
    allUnits: UnitNode[]
    selectable?: boolean
    isCheckedFn?: (id: number) => boolean
    onToggleCheck?: (id: number) => void
}

export const UnitRow = ({
    node, level, onEdit, onAdd, onDelete, searchQuery, forceExpanded,
    onViewProducts, onSelect, allUnits,
    selectable, isCheckedFn, onToggleCheck,
}: UnitRowProps) => {
    const rowChecked = isCheckedFn ? isCheckedFn(node.id) : false
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
    const packageCount = node.package_count ?? 0
    const childCount = node.children?.length ?? 0
    const convFactor = node.conversion_factor ?? 1
    const unitType = (node.type || 'COUNT').charAt(0) + (node.type || 'COUNT').slice(1).toLowerCase()

    const badges: MasterListBadge[] = [{ label: unitType, color: 'var(--app-info)' }]

    return (
        <div>
            <div style={{ paddingLeft: level > 0 ? level * 20 : 0, position: 'relative' }}>
                {level > 0 && (
                    <div className="absolute top-0 bottom-0"
                        style={{
                            left: `${10 + (level - 1) * 20}px`,
                            width: '1px',
                            background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                        }} />
                )}

                <MasterListCard
                    icon={<Ruler size={13} />}
                    accentColor="var(--app-info)"
                    leftAccent={isBase ? 'var(--app-info)' : undefined}
                    onClick={() => { if (isParent) setIsOpen(o => !o); else onSelect?.(node) }}
                    onDoubleClick={() => onSelect?.(node)}
                    leadingSlot={
                        <>
                            {selectable && (
                                <button type="button"
                                    onClick={(e) => { e.stopPropagation(); onToggleCheck?.(node.id) }}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mr-1 ${rowChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                    style={{
                                        borderColor: rowChecked ? 'var(--app-primary)' : 'var(--app-border)',
                                        background: rowChecked ? 'var(--app-primary)' : 'transparent',
                                    }}
                                    aria-checked={rowChecked}
                                    role="checkbox"
                                    aria-label={`Select ${node.name}`}>
                                    {rowChecked && <span className="text-white text-[10px] font-bold">✓</span>}
                                </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); if (isParent) setIsOpen(!isOpen) }}
                                className={`w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0 ${isParent ? 'hover:bg-app-border/40' : ''}`}>
                                {isParent ? (
                                    <ChevronRight size={14}
                                        className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                                        style={{ color: isOpen ? 'var(--app-info)' : 'var(--app-muted-foreground)' }} />
                                ) : (
                                    <div className="w-1.5 h-1.5 rounded-full"
                                        style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
                                )}
                            </button>
                        </>
                    }
                    title={
                        <span onClick={(e) => { e.stopPropagation(); onSelect?.(node) }} className="cursor-pointer flex items-center gap-1.5">
                            {node.name}
                            {node.needs_balance && <Scale size={11} style={{ color: 'var(--app-warning)', flexShrink: 0 }} />}
                        </span>
                    }
                    badges={badges}
                    subtitle={(node.reference_code || node.code || node.short_name) ? (
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
                            {node.short_name && (
                                <span className="font-medium opacity-70">{node.short_name}</span>
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
                            <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold tabular-nums"
                                    style={{ color: !isBase ? 'var(--app-info)' : 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)' }}>
                                    {isBase ? '1:1' : `×${convFactor}`}
                                </span>
                            </div>
                            <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold tabular-nums flex items-center gap-0.5"
                                    style={{ color: packageCount > 0 ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                    <Package size={10} />{packageCount}
                                </span>
                            </div>
                            <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                                <button onClick={(e) => { e.stopPropagation(); onViewProducts(node) }}
                                    className="text-tp-xs font-semibold tabular-nums transition-colors hover:underline"
                                    style={{ color: productCount > 0 ? 'var(--app-success)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                    {productCount}
                                </button>
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
                                className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-info transition-colors" title="Add derived">
                                <Plus size={13} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if (isParent) { toast.error('Delete derived units first.'); return } onDelete(node) }}
                                className="p-1.5 hover:bg-app-border/40 rounded-lg transition-colors"
                                style={{ color: isParent ? 'var(--app-border)' : 'var(--app-muted-foreground)', cursor: isParent ? 'not-allowed' : 'pointer' }}>
                                {isParent ? <AlertCircle size={12} /> : <Trash2 size={12} />}
                            </button>
                        </>
                    }
                />
            </div>
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children?.map((child) => (
                        <UnitRow key={child.id} node={child} level={level + 1}
                            onEdit={onEdit} onAdd={onAdd} onDelete={onDelete}
                            onViewProducts={onViewProducts} onSelect={onSelect}
                            searchQuery={searchQuery} forceExpanded={forceExpanded} allUnits={allUnits}
                            selectable={selectable} isCheckedFn={isCheckedFn} onToggleCheck={onToggleCheck} />
                    ))}
                </div>
            )}
        </div>
    )
}

