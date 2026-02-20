// ─── Storefront Engine — Theme Registry ─────────────────────────────────────
// Maps theme IDs to lazy-loaded theme modules.
// Add new themes here when creating them.

import type { ThemeModule, ThemeConfig } from './types'

// ─── Theme Configs (metadata only, no component imports) ────────────────────

export const THEME_CONFIGS: Record<string, ThemeConfig> = {
    midnight: {
        id: 'midnight',
        name: 'Midnight',
        description: 'Premium dark e-commerce theme with emerald accents. Sleek, modern, and luxurious.',
        author: 'TSF Platform',
        version: '1.0.0',
        colors: {
            primary: '#10b981',    // emerald-500
            secondary: '#6366f1',  // indigo-500
            accent: '#f59e0b',     // amber-500
            background: '#020617', // slate-950
            surface: '#0f172a',    // slate-900
            text: '#ffffff',
        },
        supports: ['b2c', 'b2b', 'catalog_quote', 'hybrid'],
        fonts: {
            heading: 'Inter, system-ui, sans-serif',
            body: 'Inter, system-ui, sans-serif',
        },
    },
}

// ─── Theme Loader ───────────────────────────────────────────────────────────
// Lazy-loads theme components to keep the bundle small.

export async function loadTheme(themeId: string): Promise<ThemeModule | null> {
    const config = THEME_CONFIGS[themeId]
    if (!config) return null

    try {
        switch (themeId) {
            case 'midnight': {
                const components = await import('../themes/midnight')
                return { config, components: components.default }
            }
            default:
                return null
        }
    } catch (err) {
        console.error(`[StorefrontEngine] Failed to load theme "${themeId}":`, err)
        return null
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getAvailableThemes(): ThemeConfig[] {
    return Object.values(THEME_CONFIGS)
}

export function getDefaultThemeId(): string {
    return 'midnight'
}
