'use client'

/* ═══════════════════════════════════════════════════════════
 *  TSFSYSTEM — MasterDataPage Template
 *
 *  Shared page shell for all inventory definition pages.
 *  Change this template → all pages update automatically.
 *
 *  Features included:
 *  - Icon-box header + title + subtitle
 *  - KPI strip (auto-fit grid)
 *  - Search bar (Ctrl+K) + expand/collapse
 *  - Focus mode (Ctrl+Q)
 *  - Split panel toggle
 *  - Modal drawer sidebar (click row → open)
 *  - Pinned sidebar mode
 *  - Tour trigger button + GuidedTour
 *  - Footer bar
 *
 *  Used by: Categories, Brands, Units, Attributes, Countries
 * ═══════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import {
    Search, Plus, X, Maximize2, Minimize2,
    ChevronsUpDown, ChevronsDownUp, LayoutPanelLeft, PanelLeftClose, Bookmark
} from 'lucide-react'
import Link from 'next/link'
import { GuidedTour, TourTriggerButton } from '@/components/ui/GuidedTour'
import { usePageTour } from '@/lib/tours/useTour'
import type { StepActions } from '@/lib/tours/types'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */

export type KpiItem = {
    label: string
    value: number | string
    icon: ReactNode
    color: string
}

export type ActionButton = {
    label: string
    icon: ReactNode
    onClick?: () => void
    href?: string
    active?: boolean
    activeColor?: string
    hideOnMobile?: boolean
    /** data-tour attribute */
    dataTour?: string
}

export type MasterDataPageConfig = {
    /* ── Identity ── */
    title: string
    subtitle: string
    icon: ReactNode
    iconColor?: string

    /* ── KPI Strip ── */
    kpis: KpiItem[]

    /* ── Search ── */
    searchPlaceholder?: string
    showExpandToggle?: boolean
    searchActions?: ReactNode

    /* ── Actions ── */
    primaryAction: { label: string; icon?: ReactNode; onClick: () => void }
    secondaryActions?: ActionButton[]

    /* ── Detail Panel ── */
    /** Enable split panel + drawer features */
    enableDetailPanel?: boolean

    /* ── Footer ── */
    footerLeft?: ReactNode
    footerRight?: ReactNode

    /* ── Tour ── */
    tourId?: string
    tourStepActions?: StepActions

    /* ── Layout ── */
    contentHeader?: string
    containerHeight?: string
}

/** Context passed to children render function */
export type MasterDataChildCtx<T = any> = {
    searchQuery: string
    expandAll: boolean | undefined
    expandKey: number
    focusMode: boolean
    /* ── Detail panel state ── */
    splitPanel: boolean
    selectedNode: T | null
    setSelectedNode: (node: T | null) => void
    drawerNode: T | null
    setDrawerNode: (node: T | null) => void
    drawerTab: string
    setDrawerTab: (tab: string) => void
}

/* ═══════════════════════════════════════════════════════════
 *  COMPONENT
 * ═══════════════════════════════════════════════════════════ */
export function MasterDataPage<T = any>({
    config,
    children,
    modals,
    detailPanel,
}: {
    config: MasterDataPageConfig
    children: (ctx: MasterDataChildCtx<T>) => ReactNode
    modals?: ReactNode
    /** Render the detail panel for a selected node (used in split + drawer) */
    detailPanel?: (node: T, opts: {
        tab: string
        onClose: () => void
        onPin: () => void
    }) => ReactNode
}) {
    const {
        title, subtitle, icon, iconColor = 'var(--app-primary)',
        kpis, searchPlaceholder, showExpandToggle = true, searchActions,
        primaryAction, secondaryActions = [],
        enableDetailPanel = false,
        footerLeft, footerRight,
        tourId, tourStepActions = {},
        contentHeader,
        containerHeight = 'calc(100dvh - 6rem)',
    } = config

    /* ── State ── */
    const [searchQuery, setSearchQuery] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)
    const [expandKey, setExpandKey] = useState(0)
    const searchRef = useRef<HTMLInputElement>(null)

    /* ── Detail panel state ── */
    const [splitPanel, setSplitPanel] = useState(false)
    const [pinnedSidebar, setPinnedSidebar] = useState(false)
    const [selectedNode, setSelectedNode] = useState<T | null>(null)
    const [drawerNode, setDrawerNode] = useState<T | null>(null)
    const [drawerTab, setDrawerTab] = useState('overview')

    /* ── Tour ── */
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const tourHook = tourId ? usePageTour(tourId) : null

    /* ── Keyboard shortcuts ── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                searchRef.current?.focus()
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') {
                e.preventDefault()
                setFocusMode(prev => !prev)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    /* ── Context for children ── */
    const childCtx = useMemo(() => ({
        searchQuery,
        expandAll,
        expandKey,
        focusMode,
        splitPanel,
        selectedNode,
        setSelectedNode: setSelectedNode as (node: T | null) => void,
        drawerNode,
        setDrawerNode: setDrawerNode as (node: T | null) => void,
        drawerTab,
        setDrawerTab,
    }), [searchQuery, expandAll, expandKey, focusMode, splitPanel, selectedNode, drawerNode, drawerTab])

    const hasSplitPanel = enableDetailPanel && splitPanel
    const hasDrawer = enableDetailPanel && drawerNode && !splitPanel && !pinnedSidebar

    return (
        <div
            className="flex flex-col p-4 md:px-6 md:pt-6 md:pb-2 animate-in fade-in duration-300 transition-all overflow-hidden"
            style={{
                height: containerHeight,
                paddingRight: pinnedSidebar ? '34rem' : undefined,
            }}
        >
            {/* ═══════════════ HEADER ═══════════════ */}
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {focusMode ? (
                    /* ── Focus Mode: compact header ── */
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: iconColor }}>
                                <span className="text-white flex items-center justify-center [&>svg]:w-[14px] [&>svg]:h-[14px]">{icon}</span>
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">{title}</span>
                        </div>

                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef} type="text" value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                        </div>

                        <button onClick={primaryAction.onClick}
                            className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
                            <Plus size={12} /><span className="hidden sm:inline">New</span>
                        </button>

                        <button onClick={() => setFocusMode(false)} title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    /* ── Full Header ── */
                    <>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon"
                                    style={{ background: iconColor, boxShadow: `0 4px 14px color-mix(in srgb, ${iconColor} 30%, transparent)` }}>
                                    <span className="text-white flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
                                </div>
                                <div data-tour="page-title">
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">{title}</h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">{subtitle}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                {tourHook && <TourTriggerButton onClick={tourHook.start} />}

                                {secondaryActions.map((action, i) => {
                                    const st = action.active ? {
                                        background: `color-mix(in srgb, ${action.activeColor || 'var(--app-primary)'} 10%, transparent)`,
                                        color: action.activeColor || 'var(--app-primary)',
                                        borderColor: `color-mix(in srgb, ${action.activeColor || 'var(--app-primary)'} 30%, transparent)`,
                                    } : { color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }

                                    const cls = "flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all"
                                    if (action.href) {
                                        return (
                                            <Link key={i} href={action.href} className={`${cls} hover:text-app-foreground hover:bg-app-surface`} style={st}
                                                {...(action.dataTour ? { 'data-tour': action.dataTour } : {})}>
                                                <span className="flex items-center [&>svg]:w-[13px] [&>svg]:h-[13px]">{action.icon}</span>
                                                <span className="hidden md:inline">{action.label}</span>
                                            </Link>
                                        )
                                    }
                                    return (
                                        <button key={i} onClick={action.onClick} className={cls} style={st}
                                            {...(action.dataTour ? { 'data-tour': action.dataTour } : {})}>
                                            <span className="flex items-center [&>svg]:w-[13px] [&>svg]:h-[13px]">{action.icon}</span>
                                            <span className="hidden md:inline">{action.label}</span>
                                        </button>
                                    )
                                })}

                                {/* Split Panel toggle */}
                                {enableDetailPanel && (
                                    <button
                                        data-tour="split-panel-btn"
                                        onClick={() => { setSplitPanel(p => !p); if (splitPanel) setSelectedNode(null) }}
                                        title={splitPanel ? 'Exit split panel' : 'Split panel view'}
                                        className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all"
                                        style={splitPanel ? {
                                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                            color: 'var(--app-primary)',
                                            borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                        } : { color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}
                                    >
                                        {splitPanel ? <PanelLeftClose size={13} /> : <LayoutPanelLeft size={13} />}
                                        <span className="hidden md:inline">{splitPanel ? 'Tree Only' : 'Split Panel'}</span>
                                    </button>
                                )}

                                <button data-tour="add-btn" onClick={primaryAction.onClick}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    {primaryAction.icon || <Plus size={14} />}
                                    <span className="hidden sm:inline">{primaryAction.label}</span>
                                </button>

                                <button onClick={() => setFocusMode(true)} title="Focus mode (Ctrl+Q)"
                                    className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* KPI Strip */}
                        <div data-tour="kpi-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                            {kpis.map(s => (
                                <div key={s.label}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}>
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                        {s.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Search Bar */}
                        <div className="flex items-center gap-2" data-tour="search-bar">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input ref={searchRef} type="text" value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder={searchPlaceholder || 'Search by name, code... (Ctrl+K)'}
                                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                            </div>

                            {showExpandToggle && (
                                <button
                                    onClick={() => { setExpandAll(prev => !prev); setExpandKey(k => k + 1) }}
                                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                        color: 'var(--app-primary)',
                                        borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                    }}>
                                    {expandAll ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                                    <span className="hidden sm:inline">{expandAll ? 'Collapse' : 'Expand'}</span>
                                </button>
                            )}

                            {searchActions}

                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')}
                                    className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══════════════ TOUR ═══════════════ */}
            {tourId && <GuidedTour tourId={tourId} stepActions={tourStepActions} />}

            {/* ═══════════════ MODALS ═══════════════ */}
            {modals}

            {/* ═══════════════ CONTENT AREA ═══════════════ */}
            <div className={`flex-1 min-h-0 flex gap-3 ${hasSplitPanel ? 'flex-row' : 'flex-col'} animate-in fade-in duration-200`}>

                {/* ── Main content ── */}
                <div
                    data-tour="main-content"
                    className={`${hasSplitPanel ? 'flex-[5]' : 'flex-1'} min-h-0 rounded-t-2xl overflow-hidden flex flex-col`}
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    }}
                >
                    {contentHeader && (
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <span>{contentHeader}</span>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                        {children(childCtx)}
                    </div>
                </div>

                {/* ── Inline Split Panel ── */}
                {hasSplitPanel && detailPanel && (
                    <div className="flex-[6] min-w-0 min-h-0 border border-app-border/50 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
                        {selectedNode ? (
                            detailPanel(selectedNode, {
                                tab: drawerTab,
                                onClose: () => setSelectedNode(null),
                                onPin: () => {
                                    setSplitPanel(false)
                                    setPinnedSidebar(true)
                                },
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center"
                                style={{ background: 'var(--app-surface)' }}>
                                <LayoutPanelLeft size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                                <p className="text-sm font-bold text-app-muted-foreground">Select an item</p>
                                <p className="text-[11px] text-app-muted-foreground mt-1">Click any row to view details in split view.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════════ PINNED SIDEBAR ═══════════════ */}
            {enableDetailPanel && pinnedSidebar && detailPanel && (
                <div className="fixed top-0 right-0 z-[90] w-full max-w-lg h-full flex flex-col animate-in slide-in-from-right-4 duration-300 shadow-2xl"
                    style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>
                    {selectedNode ? (
                        detailPanel(selectedNode, {
                            tab: drawerTab,
                            onClose: () => { setPinnedSidebar(false); setSelectedNode(null) },
                            onPin: () => { setPinnedSidebar(false); setSelectedNode(null) },
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                            <LayoutPanelLeft size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">Select an item</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">Click any row to view details here.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════ MODAL DRAWER ═══════════════ */}
            {hasDrawer && detailPanel && (
                <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-200"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setDrawerNode(null) }}>
                    <div data-tour="detail-drawer"
                        className="w-full max-w-lg h-full flex flex-col animate-in slide-in-from-right-4 duration-300 shadow-2xl"
                        style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>
                        {detailPanel(drawerNode!, {
                            tab: drawerTab,
                            onClose: () => setDrawerNode(null),
                            onPin: () => {
                                setSelectedNode(drawerNode)
                                setPinnedSidebar(true)
                                setDrawerNode(null)
                            },
                        })}
                    </div>
                </div>
            )}

            {/* ═══════════════ FOOTER ═══════════════ */}
            <div
                className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-[11px] font-bold rounded-b-2xl"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    borderTop: 'none', marginTop: '-1px',
                    color: 'var(--app-muted-foreground)',
                }}
            >
                <div className="flex items-center gap-3 flex-wrap">
                    {footerLeft}
                    {searchQuery && (
                        <>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span style={{ color: 'var(--app-info)' }}>Search active</span>
                            <button onClick={() => setSearchQuery('')}
                                className="underline hover:opacity-80 transition-opacity"
                                style={{ color: 'var(--app-info)' }}>Clear</button>
                        </>
                    )}
                </div>
                <div className="tabular-nums font-black" style={{ color: 'var(--app-foreground)' }}>
                    {footerRight || <>System Status: <span style={{ color: 'var(--app-success)' }}>Operational</span></>}
                </div>
            </div>
        </div>
    )
}
