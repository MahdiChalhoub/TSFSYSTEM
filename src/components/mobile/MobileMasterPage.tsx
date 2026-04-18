// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileMasterPage — reusable mobile shell
 *  Shell-only; pages provide rows via render prop.
 *  Does NOT ship split-panel, pinned-sidebar, tours, focus-mode,
 *  or desktop keyboard shortcuts.
 * ═══════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react'
import { Search, Plus, X, ChevronsUpDown, ChevronsDownUp, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export interface MobileKPI { label: string; value: number | string; icon: ReactNode; color: string }
export interface MobileAction { label: string; icon: ReactNode; onClick?: () => void; href?: string }

export interface MobileMasterConfig {
    title: string
    subtitle: string
    icon: ReactNode
    iconColor: string
    kpis: MobileKPI[]
    searchPlaceholder?: string
    primaryAction: { label: string; icon: ReactNode; onClick: () => void }
    secondaryActions?: MobileAction[]
    footerLeft?: ReactNode
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
    sheet?: ReactNode   // page-provided bottom sheet (e.g., detail)
    modals?: ReactNode  // page-provided modals (edit, delete, etc.)
}

export function MobileMasterPage({ config, children, sheet, modals }: Props) {
    const [searchQuery, setSearchQuery] = useState('')
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)
    const [expandKey, setExpandKey] = useState(0)
    const [overflowOpen, setOverflowOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(false)
    const [fabVisible, setFabVisible] = useState(true)

    const scrollRef = useRef<HTMLDivElement>(null)
    const lastScrollY = useRef(0)
    const rafId = useRef<number>(0)

    const onScroll = useCallback(() => {
        if (rafId.current) return
        rafId.current = requestAnimationFrame(() => {
            const el = scrollRef.current
            if (!el) { rafId.current = 0; return }
            const y = el.scrollTop
            const dy = y - lastScrollY.current

            setCollapsed(y > 40)

            if (Math.abs(dy) > 8) {
                setFabVisible(dy < 0 || y < 80)
                lastScrollY.current = y
            }
            rafId.current = 0
        })
    }, [])

    return (
        <div className="flex flex-col animate-in fade-in duration-200"
            style={{ height: 'calc(100dvh - var(--mobile-chrome, 0px))', background: 'var(--app-bg)' }}>

            {/* ─── STICKY TOP + SEARCH STACK ─── */}
            <div className="flex-shrink-0 sticky top-0 z-30"
                style={{
                    background: 'var(--app-bg)',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
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
                            animate={{ fontSize: collapsed ? 14 : 18 }}
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
                                    className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest truncate">
                                    {config.subtitle}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>

                    <button onClick={config.primaryAction.onClick}
                        className="flex items-center gap-1 font-bold bg-app-primary text-white px-3 py-2 rounded-xl text-[12px] active:scale-95 transition-transform"
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
                                                <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-bold text-app-foreground hover:bg-app-primary/10 active:bg-app-primary/15 transition-colors">
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
            </div>

            {/* ─── SCROLL CONTENT ─── */}
            <div
                ref={scrollRef}
                onScroll={onScroll}
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
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-app-muted-foreground truncate">{k.label}</div>
                                    <div className="text-[15px] font-black text-app-foreground tabular-nums leading-tight">{k.value}</div>
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
                                className="w-full pl-9 pr-3 text-[14px] bg-app-surface/50 border border-app-border/60 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 outline-none transition-all"
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
                <div className="px-4 py-3 text-[11px] font-bold text-app-muted-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                        {config.footerLeft}
                    </div>
                </div>
            </div>

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
