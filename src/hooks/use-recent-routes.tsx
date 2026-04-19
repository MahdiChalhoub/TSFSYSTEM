// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MENU_ITEMS } from '@/components/admin/Sidebar'

/* ═══════════════════════════════════════════════════════════
 *  useRecentRoutes — persists the last N visited routes to
 *  localStorage, returning them with their titles resolved from
 *  MENU_ITEMS. Skips the home/dashboard so the list is useful.
 * ═══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'tsf_recent_routes'
const MAX_ENTRIES = 8
const SKIP_PATHS = new Set<string>(['/', '/dashboard', '/home'])

export interface RecentRoute {
    path: string
    title: string
    icon?: any
    visitedAt: number
}

/** Walk MENU_ITEMS to find the leaf that matches a path (longest-prefix) */
function resolveMeta(path: string): { title: string; icon?: any } {
    let best: { title: string; icon?: any; len: number } | null = null
    const visit = (items: any[], parentTitle?: string) => {
        for (const it of items) {
            if (it.path && path.startsWith(it.path)) {
                const len = it.path.length
                if (!best || len > best.len) {
                    best = { title: it.title, icon: it.icon, len }
                }
            }
            if (it.children) visit(it.children, it.title)
        }
    }
    visit(MENU_ITEMS)
    return { title: best?.title || path.split('/').filter(Boolean).slice(-1)[0] || path, icon: best?.icon }
}

function loadFromStorage(): RecentRoute[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        // Re-hydrate meta since icons are component refs (not serializable)
        return parsed
            .filter(e => e && typeof e.path === 'string')
            .slice(0, MAX_ENTRIES)
            .map(e => {
                const meta = resolveMeta(e.path)
                return { path: e.path, title: meta.title, icon: meta.icon, visitedAt: e.visitedAt || 0 }
            })
    } catch {
        return []
    }
}

function saveToStorage(routes: RecentRoute[]) {
    if (typeof window === 'undefined') return
    try {
        const serializable = routes.map(r => ({ path: r.path, visitedAt: r.visitedAt }))
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
    } catch {
        // localStorage full or disabled — silently ignore
    }
}

/**
 * Track the current pathname in recent-routes. Call this once at a high
 * level (e.g., inside the mobile admin shell). Returns the current list.
 */
export function useRecentRoutes(): RecentRoute[] {
    const pathname = usePathname() || ''
    const [routes, setRoutes] = useState<RecentRoute[]>([])

    // Load once on mount
    useEffect(() => {
        setRoutes(loadFromStorage())
    }, [])

    // Record every visit
    useEffect(() => {
        if (!pathname || SKIP_PATHS.has(pathname)) return
        setRoutes(prev => {
            // De-dup by base route (strip query & anchors)
            const base = pathname.split('?')[0].split('#')[0]
            const filtered = prev.filter(r => r.path !== base)
            const meta = resolveMeta(base)
            const next: RecentRoute[] = [
                { path: base, title: meta.title, icon: meta.icon, visitedAt: Date.now() },
                ...filtered,
            ].slice(0, MAX_ENTRIES)
            saveToStorage(next)
            return next
        })
    }, [pathname])

    return routes
}

export function clearRecentRoutes() {
    if (typeof window === 'undefined') return
    try { window.localStorage.removeItem(STORAGE_KEY) } catch {}
}
