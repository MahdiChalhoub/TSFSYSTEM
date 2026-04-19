// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileBottomNav — fixed tab bar at viewport bottom.
 *  4 primary destinations + More → opens drawer.
 *  Uses env(safe-area-inset-bottom) to clear the iOS gesture area.
 * ═══════════════════════════════════════════════════════════ */

import { useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard, Package, ShoppingCart, FileText, MoreHorizontal,
} from 'lucide-react'
import { MENU_ITEMS } from '@/components/admin/Sidebar'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { useRowGestures } from '@/hooks/use-row-gestures'

export interface BottomNavItem {
    label: string
    icon: any
    path?: string
    key: string
    menuTitle?: string  // lookup key into MENU_ITEMS for long-press shortcuts
}

const DEFAULT_ITEMS: BottomNavItem[] = [
    { key: 'home', label: 'Home', icon: LayoutDashboard, path: '/dashboard', menuTitle: 'Dashboard' },
    { key: 'inventory', label: 'Inventory', icon: Package, path: '/inventory/categories', menuTitle: 'Inventory' },
    { key: 'sales', label: 'Sales', icon: ShoppingCart, path: '/sales', menuTitle: 'Commercial' },
    { key: 'finance', label: 'Finance', icon: FileText, path: '/finance/chart-of-accounts', menuTitle: 'Finance' },
    { key: 'more', label: 'More', icon: MoreHorizontal }, // opens drawer (no path)
]

/** Collect the first N leaf pages of a top-level module */
function collectModuleLeaves(menuTitle: string, max: number = 6): any[] {
    const module = MENU_ITEMS.find(m => m.title === menuTitle)
    if (!module) return []
    const leaves: any[] = []
    const walk = (items: any[]) => {
        for (const item of items) {
            if (leaves.length >= max) return
            if (item.path) leaves.push(item)
            if (item.children) walk(item.children)
        }
    }
    if (module.path) leaves.push(module)
    if (module.children) walk(module.children)
    return leaves.slice(0, max)
}

interface Props {
    items?: BottomNavItem[]
    onMorePress?: () => void
}

const haptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.(8) } catch {}
    }
}

function TabButton({ item, active, onTap, onLongPress }: {
    item: BottomNavItem
    active: boolean
    onTap: () => void
    onLongPress?: (item: BottomNavItem) => void
}) {
    const Icon = item.icon
    const ref = useRef<HTMLDivElement>(null)
    const { isLongPressing } = useRowGestures(ref, {
        onLongPress: () => item.menuTitle && onLongPress?.(item),
    }, { longPressMs: 420 })

    const content = (
        <div
            ref={ref}
            className="flex flex-col items-center justify-center gap-0.5 h-full w-full active:scale-95 transition-transform"
            style={{
                color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
            }}>
            <div className="flex items-center justify-center rounded-xl"
                style={{
                    width: 38, height: 26,
                    background: isLongPressing
                        ? 'color-mix(in srgb, var(--app-primary) 22%, transparent)'
                        : (active ? 'color-mix(in srgb, var(--app-primary) 14%, transparent)' : 'transparent'),
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

    const wrapperClass = 'flex-1 flex items-stretch py-1.5 min-h-[56px]'
    if (item.path) {
        return (
            <Link
                href={item.path}
                className={wrapperClass}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                onClick={(e) => { if (isLongPressing) { e.preventDefault(); return } haptic(); onTap() }}>
                {content}
            </Link>
        )
    }
    return (
        <button onClick={() => { haptic(); onTap() }} className={wrapperClass} aria-label={item.label}>
            {content}
        </button>
    )
}

export function MobileBottomNav({ items = DEFAULT_ITEMS, onMorePress }: Props) {
    const pathname = usePathname() || ''
    const router = useRouter()
    const [shortcutItem, setShortcutItem] = useState<BottomNavItem | null>(null)

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

    const shortcutActions = useMemo(() => {
        if (!shortcutItem?.menuTitle) return []
        return collectModuleLeaves(shortcutItem.menuTitle, 8).map(leaf => ({
            key: leaf.path,
            label: leaf.title,
            hint: leaf.path,
            icon: leaf.icon ? <leaf.icon size={15} /> : undefined,
            onClick: () => { haptic(); router.push(leaf.path) },
        }))
    }, [shortcutItem, router])

    return (
        <>
            <nav
                aria-label="Primary"
                className="fixed left-0 right-0 bottom-0 z-40 flex items-stretch"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 95%, transparent)',
                    backdropFilter: 'blur(14px)',
                    borderTop: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.15)',
                    paddingBottom: 'env(safe-area-inset-bottom, 0)',
                }}>
                {items.map(item => (
                    <TabButton
                        key={item.key}
                        item={item}
                        active={activeKey === item.key}
                        onTap={() => { if (!item.path) onMorePress?.() }}
                        onLongPress={(it) => setShortcutItem(it)}
                    />
                ))}
            </nav>

            <MobileActionSheet
                open={shortcutItem !== null}
                onClose={() => setShortcutItem(null)}
                title={shortcutItem?.label}
                subtitle="Jump to a page"
                items={shortcutActions}
            />
        </>
    )
}

export const MOBILE_BOTTOM_NAV_HEIGHT = 56  // shell uses this to pad the content
