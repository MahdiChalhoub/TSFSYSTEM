'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { loadTheme } from './ThemeLoader'
import { getDefaultThemeId } from './ThemeRegistry'
import type { ThemeModule, ThemeComponents, ThemeConfig } from './types'

// ─── Context ────────────────────────────────────────────────────────────────

interface ThemeContextState {
    theme: ThemeModule | null
    themeId: string
    loading: boolean
    components: ThemeComponents | null
    config: ThemeConfig | null
}

const ThemeContext = createContext<ThemeContextState>({
    theme: null,
    themeId: 'midnight',
    loading: true,
    components: null,
    config: null,
})

export const useTheme = () => useContext(ThemeContext)

// ─── Provider ───────────────────────────────────────────────────────────────

interface ThemeProviderProps {
    children: ReactNode
    themeId?: string  // Override from org settings
}

export function ThemeProvider({ children, themeId: propThemeId }: ThemeProviderProps) {
    const [theme, setTheme] = useState<ThemeModule | null>(null)
    const [loading, setLoading] = useState(true)
    const themeId = propThemeId || getDefaultThemeId()

    useEffect(() => {
        let cancelled = false

        loadTheme(themeId).then(loaded => {
            if (cancelled) return
            if (loaded) {
                setTheme(loaded)
            } else {
                // Fallback to default if requested theme fails
                console.warn(`[ThemeProvider] Theme "${themeId}" not found, falling back to default`)
                loadTheme(getDefaultThemeId()).then(fallback => {
                    if (!cancelled) setTheme(fallback)
                })
            }
            setLoading(false)
        })

        return () => { cancelled = true }
    }, [themeId])

    return (
        <ThemeContext.Provider value={{
            theme,
            themeId,
            loading,
            components: theme?.components || null,
            config: theme?.config || null,
        }}>
            {children}
        </ThemeContext.Provider>
    )
}
