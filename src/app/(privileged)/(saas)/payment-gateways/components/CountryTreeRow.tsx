'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight, Globe, MapPin } from 'lucide-react'
import type { GatewayTreeNode, RefGateway } from './types'
import { getFlagEmoji, REGION_COLORS } from './types'

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
    onGotoGateway: (gatewayId: number) => void
}

export function CountryTreeRow({
    node, level, searchQuery, forceExpanded, compact, selectable,
    isCheckedFn, onToggleCheck, onSelect, onGotoGateway,
}: Props) {
    const isRegion = node._kind === 'region'
    const isParent = isRegion && (node.children?.length ?? 0) > 0
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
    const regionColor = isRegion ? REGION_COLORS[node.region || 'Other'] || 'var(--app-muted-foreground)' : null
    const gateways = node._gateways || []

    return (
        <div>
            <div
                className="group flex items-stretch relative transition-colors duration-150 cursor-pointer hover:bg-app-surface-hover"
                onClick={(e) => {
                    e.stopPropagation()
                    if (compact && !isRegion) { onSelect?.(node); return }
                    if (isParent) setIsOpen(o => !o)
                    else onSelect?.(node)
                }}
                onDoubleClick={(e) => { e.stopPropagation(); if (!isRegion) onSelect?.(node) }}
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}
            >
                {isRoot && regionColor && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                        style={{ background: regionColor }} />
                )}

                {selectable && (
                    <div className="w-9 flex-shrink-0 flex items-center justify-center">
                        {!isRegion ? (
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

                <div className={`relative flex flex-col gap-1 flex-1 min-w-0 ${isRoot ? 'py-2.5' : 'py-2'}`}
                    style={{ paddingLeft: `${12 + (level > 0 ? level * 20 : 0)}px`, paddingRight: '12px' }}>

                    {level > 0 && (
                        <div className="absolute top-0 bottom-0"
                            style={{ left: `${10 + (level - 1) * 20}px`, width: '1px', background: 'color-mix(in srgb, var(--app-border) 25%, transparent)' }} />
                    )}

                    <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); if (isParent) setIsOpen(!isOpen) }}
                            className={`w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0 ${isParent ? 'hover:bg-app-border/40' : ''}`}>
                            {isParent ? (
                                <ChevronRight size={14}
                                    className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                                    style={{ color: isOpen ? regionColor || 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
                            )}
                        </button>

                        {isRegion ? (
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                    background: `color-mix(in srgb, ${regionColor} 15%, transparent)`,
                                    color: regionColor || 'var(--app-muted-foreground)',
                                }}>
                                <MapPin size={13} strokeWidth={2} />
                            </div>
                        ) : (
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                                style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)' }}>
                                {getFlagEmoji(node.iso2)}
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className={`truncate text-tp-lg ${isRegion ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}>
                                    {node.name}
                                </span>
                                {isRegion && (
                                    <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                                        style={{
                                            background: `color-mix(in srgb, ${regionColor} 12%, transparent)`,
                                            color: regionColor || 'var(--app-muted-foreground)',
                                        }}>
                                        REGION
                                    </span>
                                )}
                            </div>
                            {!isRegion && (node.code || node.subregion) && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    {node.code && (
                                        <span className="font-mono text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                                            style={{
                                                background: `color-mix(in srgb, ${regionColor} 10%, transparent)`,
                                                color: regionColor || 'var(--app-muted-foreground)',
                                            }}>
                                            {node.code}{node.iso3 ? ` · ${node.iso3.toUpperCase()}` : ''}
                                        </span>
                                    )}
                                    {node.subregion && (
                                        <span className="text-tp-xxs text-app-muted-foreground truncate">{node.subregion}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Counts cell */}
                        {!compact && (
                            <>
                                <div className="hidden sm:flex w-[90px] flex-shrink-0 justify-center">
                                    {!isRegion && (
                                        <span className="font-mono text-tp-xs font-medium text-app-muted-foreground">
                                            {node.code}
                                        </span>
                                    )}
                                </div>
                                <div className="hidden sm:flex w-[110px] flex-shrink-0 justify-center">
                                    {isRegion ? (
                                        <span className="text-tp-xs font-semibold tabular-nums" style={{ color: regionColor || 'var(--app-muted-foreground)' }}>
                                            {node._countryCount} countries
                                        </span>
                                    ) : (
                                        <span className="text-tp-xs font-semibold text-app-muted-foreground truncate">
                                            {node.region || '–'}
                                        </span>
                                    )}
                                </div>
                                <div className="hidden sm:flex w-[80px] flex-shrink-0 justify-center">
                                    <span className="text-tp-xs font-semibold tabular-nums"
                                        style={{ color: gateways.length > 0 || isRegion ? 'var(--app-success, #22c55e)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                        {isRegion ? `${node._gatewayCount} GW` : gateways.length}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Inline gateway chips for country rows — REGIONAL ONLY.
                        Worldwide gateways are shown once at the top of the page. */}
                    {!isRegion && gateways.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pl-7 pt-0.5 pb-0.5">
                            {gateways.slice(0, 12).map(gw => (
                                <GatewayChip key={gw.id} gw={gw} onClick={(e) => { e.stopPropagation(); onGotoGateway(gw.id) }} />
                            ))}
                            {gateways.length > 12 && (
                                <span className="text-tp-xxs font-bold text-app-muted-foreground self-center px-1.5">
                                    +{gateways.length - 12} more
                                </span>
                            )}
                            {(node._globalCount || 0) > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-tp-xxs font-bold px-1.5 py-0.5 rounded ml-1"
                                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)', color: 'var(--app-info, #3b82f6)' }}
                                    title={`${node._globalCount} worldwide gateway${node._globalCount! > 1 ? 's' : ''} also apply here`}>
                                    <Globe size={9} /> +{node._globalCount} worldwide
                                </span>
                            )}
                        </div>
                    )}
                    {!isRegion && gateways.length === 0 && (
                        <div className="flex items-center gap-2 pl-7 pt-0.5 pb-0.5">
                            <span className="text-tp-xxs font-medium text-app-muted-foreground italic">
                                No country-specific gateways
                            </span>
                            {(node._globalCount || 0) > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                    <Globe size={9} /> {node._globalCount} worldwide apply
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {(node.children || []).map(child => (
                        <CountryTreeRow
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
                            onGotoGateway={onGotoGateway}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function GatewayChip({ gw, onClick }: { gw: RefGateway; onClick: (e: React.MouseEvent) => void }) {
    const color = gw.color || '#6366f1'
    return (
        <button
            onClick={onClick}
            title={`${gw.name}${gw.is_global ? ' (worldwide)' : ''}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-tp-xxs font-bold transition-all hover:scale-[1.04]"
            style={{
                background: `color-mix(in srgb, ${color} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                color: gw.is_active ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                opacity: gw.is_active ? 1 : 0.55,
            }}
        >
            <span className="text-[12px] leading-none">{gw.logo_emoji || '💳'}</span>
            <span className="truncate max-w-[110px]">{gw.name}</span>
            {gw.is_global && <Globe size={9} style={{ color: 'var(--app-info, #3b82f6)' }} />}
        </button>
    )
}
