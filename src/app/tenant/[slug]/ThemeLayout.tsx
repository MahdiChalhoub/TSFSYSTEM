'use client'

import { ThemeProvider, useTheme } from '@/storefront/engine'
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

    return (
        <div className="relative font-sans antialiased selection:bg-emerald-500/30 selection:text-white">
            {/* Global Smooth Scroll Style */}
            <style jsx global>{`
                html { scroll-behavior: smooth; }
                body { overflow-x: hidden; }
            `}</style>

            {/* Premium Film Grain Overlay */}
            <div
                className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.02] mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
            />

            <Header />
            <main className="relative z-10">
                {children}
            </main>
            <Footer />
        </div>
    )
}

