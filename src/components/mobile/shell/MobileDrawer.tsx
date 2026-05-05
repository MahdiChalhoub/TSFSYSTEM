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
import { X, Search, LogOut, ChevronRight, ChevronDown, Sun, Moon, Clock, Eye, EyeOff, Building2, GitBranch as GitBranchIcon, Check, Globe } from 'lucide-react'
import { motion, PanInfo } from 'framer-motion'
import { MENU_ITEMS } from '@/components/admin/Sidebar'
import { useAdmin } from '@/context/AdminContext'
import { useBranchScope } from '@/context/BranchContext'
import { getAllWarehouseContextItems } from '@/app/actions/inventory/warehouses'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { useAppTheme } from '@/components/app/AppThemeProvider'
import { logoutAction } from '@/app/actions/auth'
import { useBackHandler, useEscapeKey } from '@/hooks/use-back-handler'
import { useRecentRoutes } from '@/hooks/use-recent-routes'

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
    const { viewScope, setViewScope, canToggleScope } = useAdmin()
    const { branchId, locationId, setSelection } = useBranchScope()

    // Resolve the active workspace name from the slug — surfaced next to
    // the avatar so the user always sees which org they're in.
    const activeWorkspace = (organizations || []).find(o => o.slug === currentSlug)
    const workspaceName = activeWorkspace?.name || activeWorkspace?.slug || ''

    // Branch + location lookup. We fetch the warehouse context items so we
    // can resolve `branchId`/`locationId` to friendly names AND drive the
    // bottom-sheet picker without needing the desktop dropdown widget.
    const [warehouses, setWarehouses] = useState<Record<string, any>[]>([])
    useEffect(() => {
        if (!open) return
        getAllWarehouseContextItems().then(setWarehouses).catch(() => { /* offline / 401 */ })
    }, [open])
    const branches = warehouses.filter(w => w.location_type === 'BRANCH')
    const locations = branchId
        ? warehouses.filter(w => w.location_type !== 'BRANCH' && w.parent === branchId)
        : warehouses.filter(w => w.location_type !== 'BRANCH')
    const activeBranch = branches.find(b => b.id === branchId) ?? null
    const activeLocation = locations.find(l => l.id === locationId) ?? null
    const branchLabel = activeBranch
        ? (activeLocation ? `${activeBranch.name} · ${activeLocation.name}` : activeBranch.name)
        : 'All Branches'

    const [branchSheetOpen, setBranchSheetOpen] = useState(false)
    const recentRoutes = useRecentRoutes()
    // Suppress hydration mismatch on the theme toggle — server renders a
    // default colorMode, client reads the real one from localStorage. The
    // button content depends on isDark; gate it behind a mount flag so the
    // server render is neutral.
    const [themeReady, setThemeReady] = useState(false)
    useEffect(() => { setThemeReady(true) }, [])

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

    // Stay mounted — toggle via transform/opacity instead of unmount. First
    // open costs the initial render; every open after is instant because the
    // MENU_ITEMS tree and TenantSwitcher are already warm.
    return (
        <>
            <motion.div
                initial={false}
                animate={{ opacity: open ? 1 : 0 }}
                transition={{ duration: 0.18 }}
                onClick={onClose}
                // Use `inert` instead of aria-hidden — the latter triggers
                // a11y warnings when focused descendants exist while the
                // drawer animates out. inert blocks focus + screen readers
                // in one go (TS doesn't ship the prop yet, hence the cast).
                {...(open ? {} : { inert: true as unknown as undefined })}
                className="fixed inset-0 z-[80]"
                style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(3px)',
                    pointerEvents: open ? 'auto' : 'none',
                }}
            />

            <motion.aside
                initial={false}
                animate={{ x: open ? 0 : '-100%' }}
                transition={{ type: 'spring', stiffness: 420, damping: 40 }}
                drag={open ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.25, right: 0 }}
                onDragEnd={handleDragEnd}
                role="dialog"
                aria-modal="true"
                {...(open ? {} : { inert: true as unknown as undefined })}
                aria-label="Main navigation"
                className="fixed top-0 left-0 bottom-0 z-[81] flex flex-col"
                style={{
                    width: 'min(88vw, 340px)',
                    background: 'var(--app-surface)',
                    borderRight: '1px solid var(--app-border)',
                    boxShadow: '8px 0 32px rgba(0,0,0,0.35)',
                    paddingTop: 'env(safe-area-inset-top, 0)',
                    visibility: open ? 'visible' : 'hidden',
                    pointerEvents: open ? 'auto' : 'none',
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
                                {/* Workspace name surfaces the active tenant
                                    next to the avatar so the user instantly
                                    sees which org they're in. Falls back to
                                    the email when no org is resolved. */}
                                <div className="font-bold text-app-muted-foreground truncate flex items-center gap-1" style={{ fontSize: 'var(--tp-xs)' }}>
                                    {workspaceName ? (
                                        <>
                                            <Building2 size={10} />
                                            <span className="truncate">{workspaceName}</span>
                                        </>
                                    ) : (
                                        user?.email || ''
                                    )}
                                </div>
                            </div>
                            <button onClick={onClose} aria-label="Close menu"
                                className="flex items-center justify-center rounded-xl active:scale-90 transition-transform"
                                style={{ width: 36, height: 36, color: 'var(--app-muted-foreground)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Branch · Location row — full width, shows the
                            current selection beside the icon. Tap opens a
                            full-width MobileBottomSheet picker that always
                            fits the screen (no clipped dropdown). The
                            scope toggle sits beside it as a compact button. */}
                        <div className="flex-shrink-0 px-3 pt-2 pb-1 flex items-center gap-1.5">
                            <button
                                onClick={() => setBranchSheetOpen(true)}
                                className="flex-1 min-w-0 flex items-center gap-2 px-3 h-9 rounded-xl active:scale-[0.98] transition-transform"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-surface-2, var(--app-surface)) 50%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                }}>
                                {activeBranch
                                    ? <GitBranchIcon size={13} className="flex-shrink-0" style={{ color: 'var(--app-primary)' }} />
                                    : <Globe size={13} className="flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }} />}
                                <span className="flex-1 min-w-0 text-left text-tp-xs font-bold truncate"
                                    style={{ color: 'var(--app-foreground)' }}>
                                    {branchLabel}
                                </span>
                                <ChevronDown size={12} className="flex-shrink-0 opacity-60" />
                            </button>
                            {canToggleScope && (
                                <button
                                    onClick={() => { setViewScope(viewScope === 'OFFICIAL' ? 'INTERNAL' : 'OFFICIAL'); onClose() }}
                                    title={`Currently ${viewScope} — tap to switch`}
                                    className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl active:scale-90 transition-transform"
                                    style={{
                                        background: viewScope === 'OFFICIAL'
                                            ? 'color-mix(in srgb, var(--app-success, #10b981) 14%, transparent)'
                                            : 'color-mix(in srgb, var(--app-primary) 14%, transparent)',
                                        color: viewScope === 'OFFICIAL' ? 'var(--app-success, #10b981)' : 'var(--app-primary)',
                                        border: `1px solid ${viewScope === 'OFFICIAL'
                                            ? 'color-mix(in srgb, var(--app-success, #10b981) 30%, transparent)'
                                            : 'color-mix(in srgb, var(--app-primary) 30%, transparent)'}`,
                                    }}>
                                    {viewScope === 'OFFICIAL' ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                            )}
                        </div>

                        {/* Branch picker — full-width bottom sheet so the
                            list is never clipped by the drawer column. */}
                        <MobileBottomSheet open={branchSheetOpen} onClose={() => setBranchSheetOpen(false)} initialSnap="expanded">
                            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6">
                                <div className="text-tp-xxs font-bold uppercase tracking-wider px-2 pt-1 pb-2"
                                    style={{ color: 'var(--app-muted-foreground)' }}>Branch</div>
                                <button
                                    onClick={() => { setSelection(null, null); setBranchSheetOpen(false) }}
                                    className="w-full flex items-center gap-3 px-3 h-12 rounded-xl mb-1 active:scale-[0.98] transition-transform"
                                    style={{
                                        background: branchId === null ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                        color: 'var(--app-foreground)',
                                    }}>
                                    <Globe size={16} className="flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }} />
                                    <span className="flex-1 text-left font-bold">All Branches</span>
                                    {branchId === null && <Check size={16} style={{ color: 'var(--app-primary)' }} />}
                                </button>
                                {branches.map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => setSelection(b.id, null)}
                                        className="w-full flex items-center gap-3 px-3 h-12 rounded-xl mb-1 active:scale-[0.98] transition-transform"
                                        style={{
                                            background: branchId === b.id ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                            color: 'var(--app-foreground)',
                                        }}>
                                        <GitBranchIcon size={16} className="flex-shrink-0" style={{ color: branchId === b.id ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="font-bold truncate" style={{ fontSize: 'var(--tp-md)' }}>{b.name}</div>
                                            {b.code && <div className="font-bold opacity-60 truncate" style={{ fontSize: 'var(--tp-xxs)' }}>{b.code}</div>}
                                        </div>
                                        {branchId === b.id && <Check size={16} style={{ color: 'var(--app-primary)' }} />}
                                    </button>
                                ))}
                                {locations.length > 0 && (
                                    <>
                                        <div className="text-tp-xxs font-bold uppercase tracking-wider px-2 pt-3 pb-2"
                                            style={{ color: 'var(--app-muted-foreground)' }}>Location</div>
                                        <button
                                            onClick={() => { setSelection(branchId, null); setBranchSheetOpen(false) }}
                                            className="w-full flex items-center gap-3 px-3 h-12 rounded-xl mb-1 active:scale-[0.98] transition-transform"
                                            style={{
                                                background: locationId === null ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                            }}>
                                            <Globe size={16} className="flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }} />
                                            <span className="flex-1 text-left font-bold">All in branch</span>
                                            {locationId === null && <Check size={16} style={{ color: 'var(--app-primary)' }} />}
                                        </button>
                                        {locations.map(l => (
                                            <button
                                                key={l.id}
                                                onClick={() => { setSelection(branchId, l.id); setBranchSheetOpen(false) }}
                                                className="w-full flex items-center gap-3 px-3 h-12 rounded-xl mb-1 active:scale-[0.98] transition-transform"
                                                style={{
                                                    background: locationId === l.id ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                                }}>
                                                <Building2 size={16} className="flex-shrink-0" style={{ color: locationId === l.id ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                                                <div className="flex-1 text-left min-w-0">
                                                    <div className="font-bold truncate" style={{ fontSize: 'var(--tp-md)' }}>{l.name}</div>
                                                    {l.code && <div className="font-bold opacity-60 truncate" style={{ fontSize: 'var(--tp-xxs)' }}>{l.code}</div>}
                                                </div>
                                                {locationId === l.id && <Check size={16} style={{ color: 'var(--app-primary)' }} />}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        </MobileBottomSheet>


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
                                    // Skip the active route from Recent — you're already there
                                    const recent = recentRoutes.filter(r => !pathname.startsWith(r.path)).slice(0, 5)
                                    return (
                                        <>
                                            {recent.length > 0 && (
                                                <>
                                                    <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                                                        <Clock size={10} style={{ color: 'var(--app-muted-foreground)', opacity: 0.7 }} />
                                                        <span className="font-black uppercase tracking-widest"
                                                            style={{ fontSize: 'var(--tp-xxs)', color: 'var(--app-muted-foreground)' }}>
                                                            Recent
                                                        </span>
                                                    </div>
                                                    {recent.map(r => {
                                                        const RIcon = r.icon
                                                        return (
                                                            <button
                                                                key={`recent-${r.path}`}
                                                                onClick={() => go(r.path)}
                                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl active:bg-app-primary/10 transition-colors text-left"
                                                                style={{ minHeight: 40, color: 'var(--app-foreground)' }}>
                                                                {RIcon
                                                                    ? <RIcon size={15} style={{ color: 'var(--app-muted-foreground)' }} />
                                                                    : <div style={{ width: 15 }} />}
                                                                <span className="flex-1 font-bold truncate" style={{ fontSize: 'var(--tp-md)' }}>
                                                                    {r.title}
                                                                </span>
                                                                <span className="font-mono truncate text-app-muted-foreground"
                                                                    style={{ fontSize: 'var(--tp-xxs)', maxWidth: 120, opacity: 0.6 }}>
                                                                    {r.path}
                                                                </span>
                                                            </button>
                                                        )
                                                    })}
                                                    <div className="mx-3 my-2 h-px" style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }} />
                                                </>
                                            )}
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
                                suppressHydrationWarning
                                aria-label={themeReady ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle color mode'}>
                                <span suppressHydrationWarning>
                                    {themeReady ? (isDark ? <Sun size={16} /> : <Moon size={16} />) : <Moon size={16} />}
                                </span>
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
    )
}
