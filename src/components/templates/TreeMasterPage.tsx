// @ts-nocheck
'use client'

import { useState, useMemo, useRef, useEffect, ReactNode } from 'react'
import {
    Search, Plus, Layers,
    Maximize2, Minimize2, ChevronsUpDown, ChevronsDownUp,
    X, LayoutPanelLeft, PanelLeftClose, Bookmark, RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { TourTriggerButton } from '@/components/ui/GuidedTour'
import { usePageTour } from '@/lib/tours/useTour'
import type { MasterPageConfig } from '@/components/templates/master-page-config'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */

// Re-exported for backward compatibility — definitions live in master-page-config.ts
export type { KPI, ActionButton } from '@/components/templates/master-page-config'

export interface ColumnHeader {
    label: string; width: string; color?: string; hideOnMobile?: boolean
}

export interface TreeMasterConfig extends MasterPageConfig {
    columnHeaders?: ColumnHeader[]
    contentHeader?: string
    tourId?: string  // If set, renders a Tour button in the header
    treeTourId?: string  // Custom data-tour for the tree container (default: 'tree-container')
}

export interface TreeMasterRenderProps {
    searchQuery: string
    expandAll: boolean | undefined
    expandKey: number
    splitPanel: boolean
    pinnedSidebar: boolean
    selectedNode: any | null
    setSelectedNode: (n: any | null) => void
    sidebarNode: any | null
    setSidebarNode: (n: any | null) => void
    sidebarTab: string
    setSidebarTab: (t: string) => void
    panelTab: string
    setPanelTab: (t: string) => void
    setExpandAll: (v: boolean | undefined | ((prev: boolean | undefined) => boolean | undefined)) => void
    setExpandKey: (v: number | ((prev: number) => number)) => void
}

interface TreeMasterPageProps {
    config: TreeMasterConfig
    children: (props: TreeMasterRenderProps) => ReactNode
    detailPanel: (node: any, props: {
        tab: string
        onClose: () => void
        onPin: (n: any) => void
        isInline?: boolean
    }) => ReactNode
    modals?: ReactNode
    aboveTree?: ReactNode
}

/* ═══════════════════════════════════════════════════════════
 *  TREE MASTER PAGE — Reusable shell matching Categories design
 * ═══════════════════════════════════════════════════════════ */
export function TreeMasterPage({ config, children, detailPanel, modals, aboveTree }: TreeMasterPageProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const [splitPanel, setSplitPanel] = useState(false)
    const [pinnedSidebar, setPinnedSidebar] = useState(false)
    const [selectedNode, setSelectedNode] = useState<any | null>(null)
    const [panelTab, setPanelTab] = useState('overview')
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)
    const [expandKey, setExpandKey] = useState(0)
    const [sidebarNode, setSidebarNode] = useState<any | null>(null)
    const [sidebarTab, setSidebarTab] = useState('overview')
    const [refreshing, setRefreshing] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)

    const handleRefresh = async () => {
        if (!config.onRefresh || refreshing) return
        setRefreshing(true)
        try { await config.onRefresh() } finally { setRefreshing(false) }
    }

    // Tour support
    const tourHook = config.tourId ? usePageTour(config.tourId) : null

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const renderProps: TreeMasterRenderProps = {
        searchQuery, expandAll, expandKey, splitPanel, pinnedSidebar,
        selectedNode, setSelectedNode,
        sidebarNode, setSidebarNode,
        sidebarTab, setSidebarTab,
        panelTab, setPanelTab,
        setExpandAll, setExpandKey,
    }

    return (
        <div className="flex flex-col p-4 md:px-6 md:pt-6 md:pb-2 animate-in fade-in duration-300 transition-all overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)', paddingRight: pinnedSidebar ? '34rem' : undefined }}>

            {/* ═══════════════ HEADER ═══════════════ */}
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
                {focusMode ? (
                    /* ── Focus Mode Header ── */
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: config.iconColor }}>
                                <span className="text-white [&>svg]:w-[14px] [&>svg]:h-[14px]">{config.icon}</span>
                            </div>
                            <span className="text-tp-md font-black text-app-foreground hidden sm:inline">{config.title}</span>
                        </div>
                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-tp-md bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all" />
                        </div>
                        <button onClick={() => config.primaryAction.onClick()}
                            className="flex items-center gap-1 text-tp-xs font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
                            {config.primaryAction.icon}<span className="hidden sm:inline">New</span>
                        </button>
                        <button onClick={() => setFocusMode(false)} title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* ── Action Row ── */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon" style={{ background: config.iconColor, boxShadow: `0 4px 14px color-mix(in srgb, ${config.iconColor} 30%, transparent)` }}>
                                    <span className="text-white [&>svg]:w-[20px] [&>svg]:h-[20px]">{config.icon}</span>
                                </div>
                                <div data-tour="page-title">
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">{config.title}</h1>
                                    <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-widest">
                                        {config.subtitle}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                {config.secondaryActions?.map((action, i) => (
                                    action.href ? (
                                        <Link key={i} href={action.href}
                                            className="flex items-center gap-1.5 text-tp-sm font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                            {action.icon}<span className="hidden md:inline">{action.label}</span>
                                        </Link>
                                    ) : (
                                        <button key={i} onClick={action.onClick}
                                            className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-1.5 rounded-xl border transition-all"
                                            style={action.active ? {
                                                background: `color-mix(in srgb, ${action.activeColor || 'var(--app-primary)'} 10%, transparent)`,
                                                color: action.activeColor || 'var(--app-primary)',
                                                borderColor: `color-mix(in srgb, ${action.activeColor || 'var(--app-primary)'} 30%, transparent)`,
                                            } : {
                                                color: 'var(--app-muted-foreground)',
                                                borderColor: 'var(--app-border)',
                                            }}>
                                            {action.icon}<span className="hidden md:inline">{action.label}</span>
                                        </button>
                                    )
                                ))}
                                {/* Split Panel toggle */}
                                <button
                                    data-tour="split-panel-btn"
                                    onClick={() => { setSplitPanel(p => !p); if (splitPanel) setSelectedNode(null) }}
                                    title={splitPanel ? 'Exit split panel' : 'Split panel view'}
                                    className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-1.5 rounded-xl border transition-all"
                                    style={splitPanel ? {
                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                        color: 'var(--app-primary)',
                                        borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                    } : { color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                                    {splitPanel ? <PanelLeftClose size={13} /> : <LayoutPanelLeft size={13} />}
                                    <span className="hidden md:inline">{splitPanel ? 'Tree Only' : 'Split Panel'}</span>
                                </button>
                                <button data-tour={config.primaryAction.dataTour || 'add-btn'} onClick={() => config.primaryAction.onClick()}
                                    className="flex items-center gap-1.5 text-tp-sm font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    <Plus size={14} /><span className="hidden sm:inline">{config.primaryAction.label}</span>
                                </button>
                                {tourHook && <TourTriggerButton onClick={tourHook.start} />}
                                {config.onRefresh && (
                                    <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
                                        className="flex items-center gap-1 text-tp-sm font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all disabled:opacity-60">
                                        <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.9s linear infinite' : undefined }} />
                                    </button>
                                )}
                                <button onClick={() => setFocusMode(true)} title="Focus mode (Ctrl+Q)"
                                    className="flex items-center gap-1 text-tp-sm font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* ── KPI Strip ── */}
                        <div data-tour="kpi-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                            {config.kpis.map(s => (
                                <div key={s.label}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left"
                                    style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                        {s.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-tp-xxs font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Search Bar ── */}
                        <div className="flex items-center gap-2" data-tour="search-bar">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    placeholder={config.searchPlaceholder || 'Search...'}
                                    className="w-full pl-9 pr-3 py-2 text-tp-md md:text-tp-lg bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                            </div>
                            <button
                                onClick={() => { setExpandAll(prev => !prev); setExpandKey(k => k + 1) }}
                                className="flex items-center gap-1 text-tp-sm font-bold px-2.5 py-2 rounded-xl border transition-all flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)', color: 'var(--app-primary)', borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                                {expandAll ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                                <span className="hidden sm:inline">{expandAll ? 'Collapse' : 'Expand'}</span>
                            </button>
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')}
                                    className="text-tp-sm font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══════════════ MODALS ═══════════════ */}
            {modals}

            {/* ═══════════════ BODY ═══════════════ */}
            <div className={`flex-1 min-h-0 flex gap-3 ${splitPanel ? 'flex-row' : 'flex-col'} animate-in fade-in duration-200`}>

                {/* Left: Tree */}
                <div data-tour={config.treeTourId || 'tree-container'} className={`${splitPanel ? 'flex-[4] min-w-0' : 'flex-1'} min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col transition-all duration-300`}>
                    {/* Column Headers */}
                    {config.columnHeaders && (
                        <div className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 text-tp-xxs font-black text-app-muted-foreground uppercase tracking-widest"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', borderBottom: '2px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                            <div className="w-5 flex-shrink-0" />
                            <div className="w-7 flex-shrink-0" />
                            {config.columnHeaders.map((col, i) => (
                                <div key={i} className={`${col.hideOnMobile ? 'hidden sm:block' : ''} flex-shrink-0 text-center`}
                                    style={{ width: col.width, color: col.color, ...(i === 0 ? { flex: '1 1 0%', minWidth: 0, textAlign: 'left' } : {}) }}>
                                    {col.label}
                                </div>
                            ))}
                            <div className="w-[68px] flex-shrink-0" />
                        </div>
                    )}

                    {/* Above tree content (calculator, etc.) */}
                    {aboveTree}

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                        {children(renderProps)}
                    </div>
                </div>

                {/* ═══════════════ INLINE SPLIT PANEL ═══════════════ */}
                {splitPanel && (
                    <div className="flex-[6] min-w-0 min-h-0 border border-app-border/50 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
                        {selectedNode ? (
                            detailPanel(selectedNode, {
                                tab: panelTab,
                                onClose: () => setSelectedNode(null),
                                onPin: (node) => { setSplitPanel(false); setPinnedSidebar(true); toast.success('Sidebar Pinned') },
                                isInline: true,
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center" style={{ background: 'var(--app-surface)' }}>
                                <LayoutPanelLeft size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                                <p className="text-sm font-bold text-app-muted-foreground">Select an item</p>
                                <p className="text-tp-sm text-app-muted-foreground mt-1">Click any row to view details in split view.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════════ PINNED SIDEBAR ═══════════════ */}
            {pinnedSidebar && (
                <div className="fixed top-0 right-0 z-[90] w-full max-w-lg h-full flex flex-col animate-in slide-in-from-right-4 duration-300 shadow-2xl"
                    style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>
                    {selectedNode ? (
                        detailPanel(selectedNode, {
                            tab: panelTab,
                            onClose: () => { setPinnedSidebar(false); setSelectedNode(null) },
                            onPin: () => { setPinnedSidebar(false); setSelectedNode(null) },
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                            <LayoutPanelLeft size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">Select an item</p>
                            <p className="text-tp-sm text-app-muted-foreground mt-1">Click any row to view details here.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════ MODAL DRAWER ═══════════════ */}
            {sidebarNode && !splitPanel && !pinnedSidebar && (
                <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-200"
                    style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setSidebarNode(null) }}>
                    <div data-tour="detail-drawer" className="w-full max-w-lg h-full flex flex-col animate-in slide-in-from-right-4 duration-300 shadow-2xl"
                        style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>
                        {detailPanel(sidebarNode, {
                            tab: sidebarTab,
                            onClose: () => setSidebarNode(null),
                            onPin: (node) => {
                                setSelectedNode(node)
                                setPanelTab(sidebarTab)
                                setPinnedSidebar(true)
                                setSidebarNode(null)
                                toast.success('Sidebar Pinned')
                            },
                        })}
                    </div>
                </div>
            )}

            {/* ── Footer ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-tp-sm font-bold rounded-b-2xl animate-in slide-in-from-bottom-2 duration-300"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    borderTop: 'none', marginTop: '-1px',
                    color: 'var(--app-muted-foreground)', backdropFilter: 'blur(10px)',
                }}>
                <div className="flex items-center gap-3 flex-wrap">
                    {config.footerLeft}
                    {searchQuery && (
                        <>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span style={{ color: 'var(--app-info)' }}>Search active</span>
                            <button onClick={() => setSearchQuery('')} className="underline hover:opacity-80 transition-opacity" style={{ color: 'var(--app-info)' }}>Clear</button>
                        </>
                    )}
                </div>
                <div className="tabular-nums font-black" style={{ color: 'var(--app-foreground)' }}>
                    System Status: <span style={{ color: 'var(--app-success)' }}>Operational</span>
                </div>
            </div>
        </div>
    )
}
