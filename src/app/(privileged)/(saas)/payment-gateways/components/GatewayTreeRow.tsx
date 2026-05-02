'use client'

import { useState, useEffect, useRef } from 'react'
import {
    ChevronRight, Pencil, Trash2, Power, Eye, EyeOff,
    ExternalLink, Globe, Lock, Layers,
} from 'lucide-react'
import type { GatewayTreeNode } from './types'
import { getFlagEmoji } from './types'

interface Props {
    node: GatewayTreeNode
    level: number
    searchQuery: string
    forceExpanded?: boolean
    compact?: boolean
    selectable?: boolean
    isCheckedFn?: (id: string) => boolean
    onToggleCheck?: (id: string) => void
    onSelect?: (n: GatewayTreeNode) => void
    onEdit: (n: GatewayTreeNode) => void
    onToggle: (n: GatewayTreeNode) => void
    onAskDelete: (n: GatewayTreeNode) => void
    onGotoCountry: (iso2: string) => void
}

export function GatewayTreeRow({
    node, level, searchQuery, forceExpanded, compact, selectable,
    isCheckedFn, onToggleCheck, onSelect, onEdit, onToggle, onAskDelete, onGotoCountry,
}: Props) {
    const isFamily = node._kind === 'family'
    const isParent = isFamily && (node.children?.length ?? 0) > 0

    const [isOpen, setIsOpen] = useState(forceExpanded ?? true)
    const prevForceExpanded = useRef(forceExpanded)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => {
        if (forceExpanded !== undefined && forceExpanded !== prevForceExpanded.current) {
            setIsOpen(forceExpanded)
        }
        prevForceExpanded.current = forceExpanded
    }, [forceExpanded])

    const rowChecked = isCheckedFn ? isCheckedFn(node.id) : false
    const isRoot = level === 0

    return (
        <div>
            <div
                className="group flex items-stretch relative transition-colors duration-150 cursor-pointer hover:bg-app-surface-hover"
                onClick={(e) => {
                    e.stopPropagation()
                    if (compact && !isFamily) { onSelect?.(node); return }
                    if (isParent) setIsOpen(o => !o)
                    else onSelect?.(node)
                }}
                onDoubleClick={(e) => { e.stopPropagation(); if (!isFamily) onSelect?.(node) }}
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}
            >
                {isRoot && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                        style={{ background: 'var(--app-primary)' }} />
                )}

                {selectable && (
                    <div className="w-9 flex-shrink-0 flex items-center justify-center">
                        {!isFamily ? (
                            <button type="button"
                                onClick={(e) => { e.stopPropagation(); onToggleCheck?.(node.id) }}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${rowChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                style={{
                                    borderColor: rowChecked ? 'var(--app-primary)' : 'var(--app-border)',
                                    background: rowChecked ? 'var(--app-primary)' : 'transparent',
                                }}
                                aria-checked={rowChecked} role="checkbox"
                                aria-label={`Select ${node.name}`}>
                                {rowChecked && <span className="text-white text-[10px] font-bold">✓</span>}
                            </button>
                        ) : null}
                    </div>
                )}

                <div className={`relative flex items-center gap-2 flex-1 min-w-0 ${isRoot ? 'py-2.5' : 'py-2'}`}
                    style={{ paddingLeft: `${12 + (level > 0 ? level * 20 : 0)}px`, paddingRight: '12px' }}>

                    {level > 0 && (
                        <div className="absolute top-0 bottom-0"
                            style={{ left: `${10 + (level - 1) * 20}px`, width: '1px', background: 'color-mix(in srgb, var(--app-border) 25%, transparent)' }} />
                    )}

                    <button onClick={(e) => { e.stopPropagation(); if (isParent) setIsOpen(!isOpen) }}
                        className={`w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0 ${isParent ? 'hover:bg-app-border/40' : ''}`}>
                        {isParent ? (
                            <ChevronRight size={14}
                                className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                                style={{ color: isOpen ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                        ) : (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
                        )}
                    </button>

                    {/* Icon */}
                    {isFamily ? (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)',
                                color: 'var(--app-primary)',
                            }}>
                            <Layers size={13} strokeWidth={2} />
                        </div>
                    ) : (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                            style={{
                                background: `color-mix(in srgb, ${node._gw?.color || '#6366f1'} 12%, transparent)`,
                                opacity: node._gw?.is_active ? 1 : 0.55,
                            }}>
                            {node._gw?.logo_emoji || '💳'}
                        </div>
                    )}

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className={`truncate text-tp-lg ${isFamily ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}
                                style={{ opacity: !isFamily && node._gw && !node._gw.is_active ? 0.6 : 1 }}>
                                {node.name}
                            </span>
                            {isFamily && (
                                <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                        color: 'var(--app-primary)',
                                    }}>
                                    FAMILY
                                </span>
                            )}
                            {!isFamily && node._gw?.is_global && (
                                <span className="inline-flex items-center gap-0.5 text-tp-xxs font-bold px-1 py-[1px] rounded flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                    <Globe size={9} /> GLOBAL
                                </span>
                            )}
                        </div>
                        {!isFamily && (node.code || node.description) && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                                {node.code && (
                                    <span className="font-mono text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                            color: 'var(--app-primary)',
                                        }}>
                                        {node.code}
                                    </span>
                                )}
                                {node.description && (
                                    <span className="text-tp-xxs text-app-muted-foreground truncate">{node.description}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Secondary cells (gateway rows only, hidden in compact mode) */}
                    {!compact && !isFamily && (
                        <>
                            {/* Code */}
                            <div className="hidden sm:flex w-[90px] flex-shrink-0 justify-center">
                                <span className="font-mono text-tp-xs font-medium text-app-muted-foreground truncate">
                                    {node._gw?.code || '–'}
                                </span>
                            </div>
                            {/* Family */}
                            <div className="hidden sm:flex w-[120px] flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold text-app-muted-foreground truncate">
                                    {node._gw?.provider_family || '–'}
                                </span>
                            </div>
                            {/* Countries — flag strip */}
                            <div className="hidden sm:flex w-[110px] flex-shrink-0 justify-center items-center gap-0.5">
                                {node._gw?.is_global ? (
                                    <span title="Worldwide" style={{ color: 'var(--app-info, #3b82f6)' }}>
                                        <Globe size={12} />
                                    </span>
                                ) : (node._gw?.country_codes || []).length === 0 ? (
                                    <span className="text-tp-xs text-app-muted-foreground opacity-50">–</span>
                                ) : (
                                    <>
                                        {(node._gw!.country_codes || []).slice(0, 3).map(cc => (
                                            <button key={cc}
                                                onClick={(e) => { e.stopPropagation(); onGotoCountry(cc) }}
                                                title={cc}
                                                className="text-[12px] leading-none hover:scale-110 transition-transform">
                                                {getFlagEmoji(cc)}
                                            </button>
                                        ))}
                                        {(node._gw!.country_codes || []).length > 3 && (
                                            <span className="text-tp-xxs text-app-muted-foreground">
                                                +{(node._gw!.country_codes!).length - 3}
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                            {/* Fields count */}
                            <div className="hidden sm:flex w-[70px] flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold tabular-nums flex items-center gap-0.5"
                                    style={{ color: (node._gw?.config_schema?.length || 0) > 0 ? 'var(--app-accent)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                    <Lock size={9} /> {node._gw?.config_schema?.length || 0}
                                </span>
                            </div>
                            {/* Status */}
                            <div className="hidden sm:flex w-[80px] flex-shrink-0 justify-center">
                                {node._gw?.is_active ? (
                                    <span className="inline-flex items-center gap-0.5 text-tp-xxs font-black px-1.5 py-0.5 rounded-full"
                                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                        <Eye size={9} /> LIVE
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-0.5 text-tp-xxs font-black px-1.5 py-0.5 rounded-full"
                                        style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                        <EyeOff size={9} /> DRAFT
                                    </span>
                                )}
                            </div>
                        </>
                    )}

                    {/* Family secondary cells (counts) */}
                    {!compact && isFamily && (
                        <>
                            <div className="hidden sm:flex w-[90px] flex-shrink-0 justify-center" />
                            <div className="hidden sm:flex w-[120px] flex-shrink-0 justify-center" />
                            <div className="hidden sm:flex w-[110px] flex-shrink-0 justify-center" />
                            <div className="hidden sm:flex w-[70px] flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold tabular-nums text-app-muted-foreground">
                                    {node._gatewayCount}
                                </span>
                            </div>
                            <div className="hidden sm:flex w-[80px] flex-shrink-0 justify-center">
                                <span className="text-tp-xxs font-bold tabular-nums"
                                    style={{ color: 'var(--app-success, #22c55e)' }}>
                                    {node._activeCount}/{node._gatewayCount} live
                                </span>
                            </div>
                        </>
                    )}

                    {/* Hover actions (gateway rows only) */}
                    {!isFamily && (
                        <div className="flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <button onClick={(e) => { e.stopPropagation(); onToggle(node) }}
                                className="p-1.5 hover:bg-app-border/40 rounded-lg transition-colors"
                                style={{ color: node._gw?.is_active ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' }}
                                title={node._gw?.is_active ? 'Deactivate' : 'Activate'}>
                                <Power size={12} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onEdit(node) }}
                                className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                                <Pencil size={12} />
                            </button>
                            {node._gw?.website_url && (
                                <a href={node._gw.website_url} target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Website">
                                    <ExternalLink size={12} />
                                </a>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); onAskDelete(node) }}
                                className="p-1.5 hover:bg-app-border/40 rounded-lg transition-colors"
                                style={{ color: 'var(--app-muted-foreground)' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-error, #ef4444)' }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)' }}
                                title="Delete">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {(node.children || []).map(child => (
                        <GatewayTreeRow
                            key={child.id}
                            node={child}
                            level={level + 1}
                            searchQuery={searchQuery}
                            forceExpanded={forceExpanded}
                            compact={compact}
                            selectable={selectable}
                            isCheckedFn={isCheckedFn}
                            onToggleCheck={onToggleCheck}
                            onSelect={onSelect}
                            onEdit={onEdit}
                            onToggle={onToggle}
                            onAskDelete={onAskDelete}
                            onGotoCountry={onGotoCountry}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

