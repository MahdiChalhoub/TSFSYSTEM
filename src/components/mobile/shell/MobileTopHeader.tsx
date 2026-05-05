// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileTopHeader — compact 48px header.
 *  Layout: hamburger · title · search · avatar.
 *  Title is derived from the active route via MENU_ITEMS lookup.
 *  Hides on scroll-down, reveals on scroll-up.
 * ═══════════════════════════════════════════════════════════ */

import { useMemo } from 'react'
import { Menu, Search, Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MENU_ITEMS } from '@/components/admin/Sidebar'

interface Props {
    user?: { username?: string; email?: string } | null
    onMenuPress: () => void
    onSearchPress?: () => void
    onAvatarPress?: () => void
}

/* Walk MENU_ITEMS to find the best-matching title for the current path */
function resolveTitle(pathname: string): string {
    if (!pathname) return ''
    let best: { title: string; len: number } | null = null
    const visit = (items: any[]) => {
        for (const item of items) {
            if (item.path && pathname.startsWith(item.path)) {
                const len = item.path.length
                if (!best || len > best.len) best = { title: item.title, len }
            }
            if (item.children) visit(item.children)
        }
    }
    visit(MENU_ITEMS)
    return best?.title || ''
}

export function MobileTopHeader({ user, onMenuPress, onSearchPress, onAvatarPress }: Props) {
    const pathname = usePathname() || ''
    const title = useMemo(() => resolveTitle(pathname), [pathname])

    const initials = (user?.username || user?.email || '?')
        .split(/[^a-zA-Z0-9]/)
        .filter(Boolean)
        .slice(0, 2)
        .map(s => s[0]?.toUpperCase())
        .join('') || '?'

    return (
        <header
            className="fixed top-0 left-0 right-0 z-[45] flex items-center gap-1 px-2"
                    style={{
                        height: 48,
                        paddingTop: 'env(safe-area-inset-top, 0)',
                        background: 'color-mix(in srgb, var(--app-surface) 95%, transparent)',
                        backdropFilter: 'blur(14px)',
                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                        boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
                    }}>

                    <button
                        onClick={onMenuPress}
                        aria-label="Menu"
                        className="flex items-center justify-center rounded-xl active:scale-90 transition-transform"
                        style={{ width: 40, height: 40, color: 'var(--app-foreground)' }}>
                        <Menu size={20} strokeWidth={2.4} />
                    </button>

                    <div className="flex-1 min-w-0">
                        <h1 className="truncate"
                            style={{ fontSize: 'var(--tp-xl)' }}>
                            {title || 'TSF'}
                        </h1>
                    </div>

                    <button
                        onClick={onSearchPress}
                        aria-label="Search"
                        className="flex items-center justify-center rounded-xl active:scale-90 transition-transform"
                        style={{ width: 40, height: 40, color: 'var(--app-muted-foreground)' }}>
                        <Search size={18} strokeWidth={2.2} />
                    </button>

                    <Link
                        href="/settings/notifications"
                        aria-label="Notifications"
                        className="flex items-center justify-center rounded-xl active:scale-90 transition-transform"
                        style={{ width: 40, height: 40, color: 'var(--app-muted-foreground)' }}>
                        <Bell size={18} strokeWidth={2.2} />
                    </Link>

                    <button
                        onClick={onAvatarPress}
                        aria-label="Account"
                        className="flex items-center justify-center rounded-full font-black text-white active:scale-90 transition-transform"
                        style={{
                            width: 34, height: 34,
                            fontSize: 'var(--tp-sm)',
                            marginLeft: 2,
                            background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        }}>
                        {initials}
                    </button>
        </header>
    )
}

export const MOBILE_TOP_HEADER_HEIGHT = 48
