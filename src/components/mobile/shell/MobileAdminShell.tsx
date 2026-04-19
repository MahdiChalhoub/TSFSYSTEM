// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileAdminShell — replaces Sidebar + TopHeader + AdminShell
 *  on mobile viewports. Composes:
 *    - MobileTopHeader (48px, fixed top)
 *    - Content area (children scroll inside)
 *    - MobileBottomNav (56px + safe-area, fixed bottom)
 *    - MobileDrawer (slide-in from hamburger)
 * ═══════════════════════════════════════════════════════════ */

import { useState, useCallback } from 'react'
import { MobileTopHeader, MOBILE_TOP_HEADER_HEIGHT } from './MobileTopHeader'
import { MobileBottomNav, MOBILE_BOTTOM_NAV_HEIGHT } from './MobileBottomNav'
import { MobileDrawer } from './MobileDrawer'

interface Props {
    user?: any
    organizations?: any[]
    currentSlug?: string
    children: React.ReactNode
}

export function MobileAdminShell({ user, organizations, currentSlug, children }: Props) {
    const [drawerOpen, setDrawerOpen] = useState(false)

    const openCommandPalette = useCallback(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    }, [])

    // Expose chrome height to descendants (MobileMasterPage reads it to
    // size its fixed-height scroll container correctly).
    const chromeHeightVar = `calc(${MOBILE_TOP_HEADER_HEIGHT}px + ${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-top, 0) + env(safe-area-inset-bottom, 0))`

    return (
        <div
            className="flex flex-col min-h-dvh"
            style={{
                background: 'var(--app-bg)',
                ['--mobile-chrome' as any]: chromeHeightVar,
            }}>
            <MobileTopHeader
                user={user}
                onMenuPress={() => setDrawerOpen(true)}
                onAvatarPress={() => setDrawerOpen(true)}
                onSearchPress={openCommandPalette}
            />

            <main
                className="flex-1 w-full"
                style={{
                    paddingTop: `calc(${MOBILE_TOP_HEADER_HEIGHT}px + env(safe-area-inset-top, 0))`,
                    paddingBottom: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0))`,
                }}>
                {children}
            </main>

            <MobileBottomNav onMorePress={() => setDrawerOpen(true)} />

            <MobileDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                user={user}
                organizations={organizations}
                currentSlug={currentSlug}
            />
        </div>
    )
}
