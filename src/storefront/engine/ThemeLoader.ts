// ─── Storefront Engine — Theme Loader ─────────────────────────────────────────
// Decoupled loader to prevent circular dependencies between Provider and Registry.

import type { ThemeModule } from './types'
import { THEME_CONFIGS } from './ThemeConfigs'

export async function loadTheme(themeId: string): Promise<ThemeModule | null> {
    const config = THEME_CONFIGS[themeId]
    if (!config) return null

    try {
        switch (themeId) {
            case 'midnight': {
                const mod = await import('../themes/midnight')
                return mod.default
            }
            case 'boutique': {
                const mod = await import('../themes/boutique')
                return mod.default
            }
            case 'emporium': {
                const mod = await import('../themes/emporium')
                return mod.default
            }
            default:
                return null
        }
    } catch (err) {
        console.error(`[StorefrontEngine] Failed to load theme "${themeId}":`, err)
        return null
    }
}
