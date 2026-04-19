// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileDrawer — full-height slide-in menu (left edge).
 *  Uses MENU_ITEMS as source of truth. Top-level modules are
 *  expandable; leaf items navigate via Next Link.
 * ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { X, Search, LogOut, ChevronRight, ChevronDown, Sun, Moon } from 'lucide-react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { MENU_ITEMS } from '@/components/admin/Sidebar'
import { TenantSwitcher } from '@/components/admin/TenantSwitcher'
import { useAppTheme } from '@/components/app/AppThemeProvider'
import { logoutAction } from '@/app/actions/auth'
import { useBackHandler, useEscapeKey } from '@/hooks/use-back-handler'

interface Props {
    open: boolean
    onClose: () => void
    user?: { username?: string; email?: string } | null
    organizations?: any[]
    currentSlug?: string
}

function flattenLeaves(items: any[], acc: any[] = []): any[] {
    for (const item of items) {
        if (item.path) acc.push(item)
        if (item.children) flattenLeaves(item.children, acc)
    }
    return acc
}

export function MobileDrawer({ open, onClose, user, organizations, currentSlug }: Props) {
    const pathname = usePathname() || ''
    const router = useRouter()
    const [q, setQ] = useState('')
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const { isDark, toggleColorMode } = useAppTheme()

    useBackHandler(open, onClose, 'mobile-drawer')
    useEscapeKey(open, onClose)

    const handleDragEnd = (_: any, info: PanInfo) => {
        // Swipe left past threshold (or with velocity) to dismiss
        if (info.offset.x < -80 || info.velocity.x < -500) {
            onClose()
        }
    }

    // Pre-expand the module matching the current route when the drawer opens.
    // MENU_ITEMS can contain duplicate titles (e.g. two "Finance" modules), so we
    // key by `${title}-${index}` — same scheme as the rendering loop.
    useEffect(() => {
        if (!open) return
        const idx = MENU_ITEMS.findIndex(m => {
            if (m.path && pathname.startsWith(m.path)) return true
            return (m.children || []).some((c: any) => {
                if (c.path && pathname.startsWith(c.path)) return true
                return (c.children || []).some((l: any) => l.path && pathname.startsWith(l.path))
            })
        })
        if (idx >= 0) {
            const key = `${MENU_ITEMS[idx].title}-${idx}`
            setExpanded(prev => new Set(prev).add(key))
        }
    }, [open, pathname])

    const searchResults = useMemo(() => {
        if (!q.trim()) return []
        const query = q.toLowerCase()
        return flattenLeaves(MENU_ITEMS).filter(i =>
            i.title?.toLowerCase().includes(query)
        ).slice(0, 40)
    }, [q])

    const toggle = (title: string) => {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(title)) next.delete(title)
            else next.add(title)
            return next
        })
    }

    const go = (path: string) => {
        router.push(path)
        onClose()
    }

    const handleLogout = async () => {
        try {
            await logoutAction()
            router.push('/login')
        } catch {
            // ignore
        }
    }

    const initials = (user?.username || user?.email || '?')
        .split(/[^a-zA-Z0-9]/)
        .filter(Boolean)
        .slice(0, 2)
        .map(s => s[0]?.toUpperCase())
        .join('') || '?'

    const renderModule = (module: any, i: number) => {
        const Icon = module.icon
        const moduleKey = `${module.title}-${i}`
        const isActive = module.path && pathname.startsWith(module.path)
        const isExpanded = expanded.has(moduleKey)
        const hasChildren = !!module.children

        if (!hasChildren) {
            return (
                <button
                    key={moduleKey}
                    onClick={() => module.path && go(module.path)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:bg-app-primary/10 transition-colors text-left"
                    style={{
                        minHeight: 48,
                        background: isActive ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                        color: isActive ? 'var(--app-primary)' : 'var(--app-foreground)',
                    }}>
                    {Icon && <Icon size={17} />}
                    <span className="font-black tracking-tight" style={{ fontSize: 'var(--tp-lg)' }}>
                        {module.title}
                    </span>
                </button>
            )
        }

        return (
            <div key={moduleKey}>
                <button
                    onClick={() => toggle(moduleKey)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:bg-app-primary/10 transition-colors text-left"
                    style={{
                        minHeight: 48,
                        background: isActive ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                        color: isActive ? 'var(--app-primary)' : 'var(--app-foreground)',
                    }}>
                    {Icon && <Icon size={17} />}
                    <span className="flex-1 font-black tracking-tight" style={{ fontSize: 'var(--tp-lg)' }}>
                        {module.title}
                    </span>
                    {isExpanded
                        ? <ChevronDown size={15} style={{ color: 'var(--app-muted-foreground)' }} />
                        : <ChevronRight size={15} style={{ color: 'var(--app-muted-foreground)' }} />}
                </button>
                {isExpanded && (
                    <div className="pl-3 pb-1 animate-in fade-in duration-150">
                        {(module.children || []).map((child: any, j: number) => {
                            const ChildIcon = child.icon
                            const childKey = child.path || `${module.title}-${i}-child-${j}`
                            if (child.path) {
                                const childActive = pathname.startsWith(child.path)
                                return (
                                    <button
                                        key={childKey}
                                        onClick={() => go(child.path)}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg active:bg-app-primary/10 transition-colors text-left"
                                        style={{
                                            minHeight: 40,
                                            color: childActive ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                            background: childActive ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'transparent',
                                        }}>
                                        {ChildIcon && <ChildIcon size={14} />}
                                        <span className="font-bold truncate" style={{ fontSize: 'var(--tp-md)' }}>
                                            {child.title}
                                        </span>
                                    </button>
                                )
                            }
                            // Nested group — render as a subgroup with label + indented leaves
                            const leafs = (child.children || []).filter((l: any) => l.path)
                            if (leafs.length === 0) return null
                            return (
                                <div key={childKey} className="mt-1 mb-0.5">
                                    <div className="flex items-center gap-2 px-3 pt-1.5 pb-0.5"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        {ChildIcon && <ChildIcon size={11} style={{ opacity: 0.6 }} />}
                                        <span className="font-black uppercase tracking-widest"
                                            style={{ fontSize: 'var(--tp-xxs)', opacity: 0.7 }}>
                                            {child.title}
                                        </span>
                                    </div>
                                    {leafs.map((leaf: any) => {
                                        const LeafIcon = leaf.icon
                                        const active = pathname.startsWith(leaf.path)
                                        return (
                                            <button
                                                key={leaf.path}
                                                onClick={() => go(leaf.path)}
                                                className="w-full flex items-center gap-3 px-5 py-1.5 rounded-lg active:bg-app-primary/10 transition-colors text-left"
                                                style={{
                                                    minHeight: 36,
                                                    color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                                    background: active ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'transparent',
                                                }}>
                                                {LeafIcon && <LeafIcon size={12} />}
                                                <span className="font-bold truncate" style={{ fontSize: 'var(--tp-sm)' }}>
                                                    {leaf.title}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[80]"
                        style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(3px)' }}
                    />

                    <motion.aside
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={{ left: 0.25, right: 0 }}
                        onDragEnd={handleDragEnd}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Main navigation"
                        className="fixed top-0 left-0 bottom-0 z-[81] flex flex-col"
                        style={{
                            width: 'min(88vw, 340px)',
                            background: 'var(--app-surface)',
                            borderRight: '1px solid var(--app-border)',
                            boxShadow: '8px 0 32px rgba(0,0,0,0.35)',
                            paddingTop: 'env(safe-area-inset-top, 0)',
                        }}>

                        {/* Header */}
                        <div className="flex-shrink-0 px-4 pt-3 pb-3 flex items-center gap-3"
                            style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)' }}>
                            <div className="flex items-center justify-center rounded-full font-black text-white"
                                style={{
                                    width: 42, height: 42,
                                    fontSize: 'var(--tp-md)',
                                    background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))',
                                    boxShadow: '0 2px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                }}>
                                {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-black text-app-foreground truncate" style={{ fontSize: 'var(--tp-lg)' }}>
                                    {user?.username || user?.email || 'User'}
                                </div>
                                <div className="font-bold text-app-muted-foreground truncate" style={{ fontSize: 'var(--tp-xs)' }}>
                                    {user?.email || ''}
                                </div>
                            </div>
                            <button onClick={onClose} aria-label="Close menu"
                                className="flex items-center justify-center rounded-xl active:scale-90 transition-transform"
                                style={{ width: 36, height: 36, color: 'var(--app-muted-foreground)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Organization switcher */}
                        {organizations && organizations.length > 0 && (
                            <div className="flex-shrink-0 px-3 pt-2 pb-1">
                                <TenantSwitcher
                                    organizations={organizations}
                                    forcedSlug={currentSlug}
                                    user={user}
                                />
                            </div>
                        )}

                        {/* Search */}
                        <div className="flex-shrink-0 px-3 pt-3 pb-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                    placeholder="Search pages…"
                                    className="w-full pl-9 pr-3 bg-app-surface/50 border border-app-border/60 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 outline-none"
                                    style={{ height: 40, fontSize: 'var(--tp-xl)' }}
                                />
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-2 pb-3">
                            {q.trim() ? (
                                searchResults.length === 0 ? (
                                    <div className="py-8 text-center font-bold text-app-muted-foreground"
                                        style={{ fontSize: 'var(--tp-md)' }}>
                                        No matching pages
                                    </div>
                                ) : (
                                    searchResults.map(r => (
                                        <button
                                            key={r.path}
                                            onClick={() => go(r.path)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl active:bg-app-primary/10 transition-colors text-left"
                                            style={{ minHeight: 48 }}>
                                            {r.icon && <r.icon size={16} style={{ color: 'var(--app-muted-foreground)' }} />}
                                            <span className="flex-1 font-bold text-app-foreground truncate"
                                                style={{ fontSize: 'var(--tp-lg)' }}>
                                                {r.title}
                                            </span>
                                            <span className="font-mono text-app-muted-foreground truncate"
                                                style={{ fontSize: 'var(--tp-xxs)' }}>
                                                {r.path}
                                            </span>
                                        </button>
                                    ))
                                )
                            ) : (
                                (() => {
                                    const withIndex = MENU_ITEMS.map((m, i) => ({ module: m, idx: i }))
                                    const prodItems = withIndex.filter(({ module }: any) => module.stage === 'production')
                                    const devItems = withIndex.filter(({ module }: any) => module.stage !== 'production')
                                    return (
                                        <>
                                            {prodItems.length > 0 && (
                                                <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                                                    <span className="font-black uppercase tracking-widest"
                                                        style={{ fontSize: 'var(--tp-xxs)', color: 'var(--app-success, #10b981)', opacity: 0.85 }}>
                                                        Production
                                                    </span>
                                                    <span className="font-bold tabular-nums"
                                                        style={{ fontSize: 'var(--tp-xxs)', color: 'var(--app-success, #10b981)', opacity: 0.6 }}>
                                                        {prodItems.length}
                                                    </span>
                                                </div>
                                            )}
                                            {prodItems.map(({ module, idx }: any) => renderModule(module, idx))}
                                            {devItems.length > 0 && (
                                                <div className="px-3 pt-3 pb-1 flex items-center gap-2"
                                                    style={{ borderTop: prodItems.length > 0 ? '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' : undefined, marginTop: prodItems.length > 0 ? 8 : 0 }}>
                                                    <span className="font-black uppercase tracking-widest"
                                                        style={{ fontSize: 'var(--tp-xxs)', color: 'var(--app-muted-foreground)' }}>
                                                        Development
                                                    </span>
                                                    <span className="font-bold tabular-nums text-app-muted-foreground"
                                                        style={{ fontSize: 'var(--tp-xxs)', opacity: 0.6 }}>
                                                        {devItems.length}
                                                    </span>
                                                </div>
                                            )}
                                            {devItems.map(({ module, idx }: any) => renderModule(module, idx))}
                                        </>
                                    )
                                })()
                            )}
                        </div>

                        {/* Footer: theme toggle + logout + safe-area padding */}
                        <div className="flex-shrink-0 px-3 py-2 border-t flex items-center gap-2"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--app-border) 55%, transparent)',
                                paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0))',
                            }}>
                            <button
                                onClick={toggleColorMode}
                                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl active:scale-[0.98] transition-transform font-black"
                                style={{
                                    fontSize: 'var(--tp-md)',
                                    color: 'var(--app-foreground)',
                                    background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    minWidth: 48,
                                }}
                                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
                                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl active:scale-[0.98] transition-transform font-black"
                                style={{
                                    fontSize: 'var(--tp-md)',
                                    color: 'var(--app-error, #ef4444)',
                                    background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 22%, transparent)',
                                }}>
                                <LogOut size={15} /> Sign out
                            </button>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    )
}
