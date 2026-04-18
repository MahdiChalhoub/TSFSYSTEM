// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileMasterPage — reusable mobile shell
 *  Shell-only; pages provide rows via render prop.
 *  Does NOT ship split-panel, pinned-sidebar, tours, focus-mode,
 *  or desktop keyboard shortcuts.
 * ═══════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react'
import { Search, Plus, X, ChevronsUpDown, ChevronsDownUp, MoreHorizontal, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { MasterPageConfig } from '@/components/templates/master-page-config'

// Re-export for callers; kept as aliases to the shared types.
export type { KPI as MobileKPI, ActionButton as MobileAction } from '@/components/templates/master-page-config'

export interface MobileMasterConfig extends MasterPageConfig {
    onRefresh?: () => void | Promise<void>
}

export interface MobileMasterRenderProps {
    searchQuery: string
    expandAll: boolean | undefined
    expandKey: number
    setExpandAll: (v: boolean | undefined | ((p: boolean | undefined) => boolean | undefined)) => void
    setExpandKey: (v: number | ((p: number) => number)) => void
}

interface Props {
    config: MobileMasterConfig
    children: (props: MobileMasterRenderProps) => ReactNode
    sheet?: ReactNode
    modals?: ReactNode
    belowTopBar?: ReactNode    // sticky content rendered between top bar and scroll area (e.g., breadcrumb)
}

const PULL_THRESHOLD = 72

export function MobileMasterPage({ config, children, sheet, modals, belowTopBar }: Props) {
    const [searchQuery, setSearchQuery] = useState('')
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)
    const [expandKey, setExpandKey] = useState(0)
    const [overflowOpen, setOverflowOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(false)
    const [fabVisible, setFabVisible] = useState(true)
    const [scrolled, setScrolled] = useState(false)  // for shadow
    const [pullY, setPullY] = useState(0)
    const [refreshing, setRefreshing] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
    const lastScrollY = useRef(0)
    const rafId = useRef<number>(0)
    const touchStartY = useRef<number | null>(null)

    const onScroll = useCallback(() => {
        if (rafId.current) return
        rafId.current = requestAnimationFrame(() => {
            const el = scrollRef.current
            if (!el) { rafId.current = 0; return }
            const y = el.scrollTop
            const dy = y - lastScrollY.current

            setScrolled(y > 2)
            setCollapsed(y > 40)

            if (Math.abs(dy) > 8) {
                setFabVisible(dy < 0 || y < 80)
                lastScrollY.current = y
            }
            rafId.current = 0
        })
    }, [])

    // Pull-to-refresh gesture handlers (only activates at scrollTop === 0)
    const onTouchStart = useCallback((e: any) => {
        const el = scrollRef.current
        if (!el || el.scrollTop > 0 || refreshing) { touchStartY.current = null; return }
        touchStartY.current = e.touches?.[0]?.clientY ?? null
    }, [refreshing])

    const onTouchMove = useCallback((e: any) => {
        if (touchStartY.current == null) return
        const currentY = e.touches?.[0]?.clientY
        if (currentY == null) return
        const dy = currentY - touchStartY.current
        if (dy > 0) {
            // Dampen with a rubber-band factor
            const damped = Math.min(dy * 0.5, PULL_THRESHOLD * 1.6)
            setPullY(damped)
        } else {
            setPullY(0)
        }
    }, [])

    const onTouchEnd = useCallback(async () => {
        if (touchStartY.current == null) { setPullY(0); return }
        touchStartY.current = null
        if (pullY >= PULL_THRESHOLD && config.onRefresh && !refreshing) {
            setRefreshing(true)
            try {
                await config.onRefresh()
            } finally {
                setRefreshing(false)
                setPullY(0)
            }
        } else {
            setPullY(0)
        }
    }, [pullY, config, refreshing])

    const pullProgress = Math.min(pullY / PULL_THRESHOLD, 1)
    const pullReady = pullY >= PULL_THRESHOLD
    const indicatorTop = refreshing ? 16 : Math.min(pullY - 20, PULL_THRESHOLD - 8)

    return (
        <div className="flex flex-col animate-in fade-in duration-200"
            style={{ height: 'calc(100dvh - var(--mobile-chrome, 0px))', background: 'var(--app-bg)' }}>

            {/* ─── STICKY TOP + SEARCH STACK ─── */}
            <div className="flex-shrink-0 sticky top-0 z-30 transition-shadow duration-200"
                style={{
                    background: 'var(--app-bg)',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                    boxShadow: scrolled ? '0 6px 18px rgba(0,0,0,0.18)' : 'none',
                }}>
                {/* Top bar */}
                <motion.div
                    animate={{ paddingTop: collapsed ? 8 : 12, paddingBottom: collapsed ? 8 : 12 }}
                    transition={{ duration: 0.18 }}
                    className="px-4 flex items-center gap-2"
                >
                    <motion.div
                        animate={{ width: collapsed ? 32 : 40, height: collapsed ? 32 : 40 }}
                        transition={{ duration: 0.18 }}
                        className="rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                            background: config.iconColor,
                            boxShadow: `0 4px 14px color-mix(in srgb, ${config.iconColor} 30%, transparent)`,
                        }}>
                        <span className="text-white [&>svg]:w-[18px] [&>svg]:h-[18px]">{config.icon}</span>
                    </motion.div>
                    <div className="flex-1 min-w-0">
                        <motion.h1
                            animate={{ fontSize: collapsed ? 'var(--tp-xl)' : 'var(--tp-3xl)' }}
                            transition={{ duration: 0.18 }}
                            className="font-black text-app-foreground tracking-tight truncate leading-tight">
                            {config.title}
                        </motion.h1>
                        <AnimatePresence initial={false}>
                            {!collapsed && (
                                <motion.p
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="text-tp-xs font-bold text-app-muted-foreground uppercase tracking-widest truncate">
                                    {config.subtitle}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>

                    <button onClick={config.primaryAction.onClick}
                        className="flex items-center gap-1 font-bold bg-app-primary text-white px-3 py-2 rounded-xl text-tp-md active:scale-95 transition-transform"
                        style={{ boxShadow: '0 2px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)', minHeight: 36 }}>
                        {config.primaryAction.icon}
                        <span className="sr-only">{config.primaryAction.label}</span>
                    </button>

                    {config.secondaryActions && config.secondaryActions.length > 0 && (
                        <div className="relative">
                            <button onClick={() => setOverflowOpen(o => !o)}
                                className="p-2 rounded-xl text-app-muted-foreground hover:bg-app-surface active:scale-95 transition-all"
                                style={{ minHeight: 36, minWidth: 36 }}>
                                <MoreHorizontal size={18} />
                            </button>
                            {overflowOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOverflowOpen(false)} />
                                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-xl overflow-hidden animate-in slide-in-from-top-1 fade-in duration-150"
                                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
                                        {config.secondaryActions.map((a, i) => {
                                            const content = (
                                                <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-tp-lg font-bold text-app-foreground hover:bg-app-primary/10 active:bg-app-primary/15 transition-colors">
                                                    <span className="text-app-muted-foreground flex-shrink-0">{a.icon}</span>
                                                    {a.label}
                                                </div>
                                            )
                                            return a.href ? (
                                                <Link key={i} href={a.href} onClick={() => setOverflowOpen(false)}>{content}</Link>
                                            ) : (
                                                <button key={i} onClick={() => { a.onClick?.(); setOverflowOpen(false) }} className="w-full text-left">
                                                    {content}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Optional sticky slot below top bar (e.g., breadcrumb) */}
                {belowTopBar && (
                    <div className="px-3 pb-2">
                        {belowTopBar}
                    </div>
                )}
            </div>

            {/* ─── PULL-TO-REFRESH INDICATOR ─── */}
            {config.onRefresh && (pullY > 0 || refreshing) && (
                <div
                    className="absolute left-0 right-0 z-20 flex items-center justify-center pointer-events-none"
                    style={{
                        top: indicatorTop,
                        transition: refreshing ? 'top 200ms' : 'none',
                    }}>
                    <div
                        className="rounded-full flex items-center justify-center"
                        style={{
                            width: 40, height: 40,
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                            color: pullReady || refreshing ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                            transform: `rotate(${pullProgress * 360}deg)`,
                            transition: refreshing ? 'transform 0.9s linear infinite' : 'color 120ms',
                            animation: refreshing ? 'spin 0.9s linear infinite' : undefined,
                        }}>
                        <RefreshCw size={18} strokeWidth={2.5} />
                    </div>
                </div>
            )}

            {/* ─── SCROLL CONTENT ─── */}
            <motion.div
                ref={scrollRef}
                onScroll={onScroll}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
                animate={{ y: refreshing ? 44 : pullY }}
                transition={{ type: 'tween', duration: refreshing ? 0.2 : 0 }}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">

                {/* KPI rail — scrolls away with content */}
                <div className="px-3 pt-3 pb-1">
                    <div className="flex gap-2 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-1"
                        style={{ scrollbarWidth: 'none' }}>
                        {config.kpis.map((k, i) => (
                            <div key={k.label}
                                className="flex-shrink-0 snap-start flex items-center gap-2 px-3 py-2 rounded-xl"
                                style={{
                                    minWidth: 130,
                                    background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: `color-mix(in srgb, ${k.color} 12%, transparent)`, color: k.color }}>
                                    {k.icon}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground truncate">{k.label}</div>
                                    <div className="text-tp-xl font-black text-app-foreground tabular-nums leading-tight">{k.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Search bar — sticks when KPI rail scrolls out of its parent sticky ancestor */}
                <div className="sticky top-0 z-20 px-3 pt-2 pb-2"
                    style={{
                        background: 'var(--app-bg)',
                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={config.searchPlaceholder || 'Search…'}
                                className="w-full pl-9 pr-3 text-tp-xl bg-app-surface/50 border border-app-border/60 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 outline-none transition-all"
                                style={{ height: 40 }}
                            />
                        </div>
                        <button
                            onClick={() => { setExpandAll(p => !p); setExpandKey(k => k + 1) }}
                            className="flex items-center justify-center rounded-xl border active:scale-95 transition-all flex-shrink-0"
                            style={{
                                height: 40, width: 40,
                                background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                                color: 'var(--app-primary)',
                                borderColor: 'color-mix(in srgb, var(--app-primary) 25%, transparent)',
                            }}
                            title={expandAll ? 'Collapse all' : 'Expand all'}>
                            {expandAll ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
                        </button>
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')}
                                className="flex items-center justify-center rounded-xl border active:scale-95 transition-all flex-shrink-0"
                                style={{
                                    height: 40, width: 40,
                                    color: 'var(--app-error, #ef4444)',
                                    borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)',
                                    background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)',
                                }}>
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Rows */}
                <div className="px-3 pb-24">
                    {children({ searchQuery, expandAll, expandKey, setExpandAll, setExpandKey })}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 text-tp-sm font-bold text-app-muted-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                        {config.footerLeft}
                    </div>
                </div>
            </motion.div>

            {/* ─── FAB ─── */}
            <AnimatePresence>
                {fabVisible && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        onClick={config.primaryAction.onClick}
                        className="fixed z-40 flex items-center justify-center rounded-full bg-app-primary text-white active:scale-95 transition-transform"
                        style={{
                            right: 20,
                            bottom: 'calc(20px + env(safe-area-inset-bottom, 0))',
                            width: 56, height: 56,
                            boxShadow: '0 8px 24px color-mix(in srgb, var(--app-primary) 45%, transparent), 0 4px 10px rgba(0,0,0,0.2)',
                        }}
                        aria-label={config.primaryAction.label}>
                        <Plus size={24} strokeWidth={2.5} />
                    </motion.button>
                )}
            </AnimatePresence>

            {modals}
            {sheet}
        </div>
    )
}
