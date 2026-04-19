// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileBottomNav — fixed tab bar at viewport bottom.
 *  4 primary destinations + More → opens drawer.
 *  Uses env(safe-area-inset-bottom) to clear the iOS gesture area.
 * ═══════════════════════════════════════════════════════════ */

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, Package, ShoppingCart, FileText, MoreHorizontal,
} from 'lucide-react'

export interface BottomNavItem {
    label: string
    icon: any
    path?: string
    key: string
}

const DEFAULT_ITEMS: BottomNavItem[] = [
    { key: 'home', label: 'Home', icon: LayoutDashboard, path: '/dashboard' },
    { key: 'inventory', label: 'Inventory', icon: Package, path: '/inventory/categories' },
    { key: 'sales', label: 'Sales', icon: ShoppingCart, path: '/sales' },
    { key: 'finance', label: 'Finance', icon: FileText, path: '/finance/chart-of-accounts' },
    { key: 'more', label: 'More', icon: MoreHorizontal }, // opens drawer (no path)
]

interface Props {
    items?: BottomNavItem[]
    onMorePress?: () => void
}

const haptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.(8) } catch {}
    }
}

export function MobileBottomNav({ items = DEFAULT_ITEMS, onMorePress }: Props) {
    const pathname = usePathname() || ''

    const activeKey = useMemo(() => {
        // Longest-prefix match: e.g. /inventory/categories/123 matches 'inventory'
        let best: { key: string; len: number } | null = null
        for (const it of items) {
            if (!it.path) continue
            const base = it.path.split('/').filter(Boolean)[0] // "inventory"
            if (!base) continue
            if (pathname.startsWith('/' + base)) {
                const len = ('/' + base).length
                if (!best || len > best.len) best = { key: it.key, len }
            }
        }
        return best?.key
    }, [pathname, items])

    return (
        <nav
            className="fixed left-0 right-0 bottom-0 z-40 flex items-stretch"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 95%, transparent)',
                backdropFilter: 'blur(14px)',
                borderTop: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                boxShadow: '0 -2px 10px rgba(0,0,0,0.15)',
                paddingBottom: 'env(safe-area-inset-bottom, 0)',
            }}>
            {items.map(item => {
                const Icon = item.icon
                const active = activeKey === item.key
                const content = (
                    <div className="flex flex-col items-center justify-center gap-0.5 h-full w-full active:scale-95 transition-transform"
                        style={{
                            color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                        }}>
                        <div className="flex items-center justify-center rounded-xl"
                            style={{
                                width: 38, height: 26,
                                background: active ? 'color-mix(in srgb, var(--app-primary) 14%, transparent)' : 'transparent',
                                transition: 'background 120ms',
                            }}>
                            <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                        </div>
                        <span className="font-black tracking-tight"
                            style={{
                                fontSize: 'var(--tp-xxs)',
                                opacity: active ? 1 : 0.75,
                            }}>
                            {item.label}
                        </span>
                    </div>
                )
                const common = 'flex-1 flex items-stretch py-1.5 min-h-[56px]'
                if (item.path) {
                    return (
                        <Link key={item.key} href={item.path} className={common} onClick={haptic}>
                            {content}
                        </Link>
                    )
                }
                return (
                    <button key={item.key} onClick={() => { haptic(); onMorePress?.() }} className={common} aria-label={item.label}>
                        {content}
                    </button>
                )
            })}
        </nav>
    )
}

export const MOBILE_BOTTOM_NAV_HEIGHT = 56  // shell uses this to pad the content
