'use client'

import { ThemeProvider, useTheme } from '@/storefront/engine'
import { ReactNode } from 'react'

/**
 * ThemeLayout — wraps tenant pages with the active theme's Header + Footer.
 * The ThemeProvider loads the org's selected theme and makes it available
 * to all child pages via useTheme().
 */
export function ThemeLayout({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <ThemeShell>{children}</ThemeShell>
        </ThemeProvider>
    )
}

function ThemeShell({ children }: { children: ReactNode }) {
    const { components, loading } = useTheme()

    if (loading || !components) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const Header = components.Header
    const Footer = components.Footer

    return (
        <>
            <Header />
            {children}
            <Footer />
        </>
    )
}
