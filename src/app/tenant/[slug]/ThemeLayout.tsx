'use client'

import { ThemeProvider, useTheme } from '@/storefront/engine/ThemeProvider'
import { usePortal } from '@/context/PortalContext'
import { ReactNode } from 'react'

/**
 * ThemeLayout — wraps tenant pages with the active theme's Header + Footer.
 * Reads the org's selected theme from storefront config and passes it to ThemeProvider.
 */
export function ThemeLayout({ children }: { children: ReactNode }) {
    const { config } = usePortal()
    const themeId = (config as any)?.storefront_theme || undefined

    return (
        <ThemeProvider themeId={themeId}>
            <ThemeShell>{children}</ThemeShell>
        </ThemeProvider>
    )
}

function ThemeShell({ children }: { children: ReactNode }) {
    const { components, loading, config: themeConfig } = useTheme()

    if (loading || !components) {
        // Use theme-aware loading color based on theme config
        const bgColor = themeConfig?.colors?.background || '#020617'
        const spinColor = themeConfig?.colors?.primary || '#10b981'
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: bgColor }}>
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: spinColor, borderTopColor: 'transparent' }} />
            </div>
        )
    }

    const Header = components.Header
    const Footer = components.Footer
    const CartDrawer = (components as any).CartDrawer

    return (
        <>
            <Header />
            {children}
            <Footer />
            {CartDrawer && <CartDrawer />}
        </>
    )
}

