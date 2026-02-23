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
                const components = await import('../themes/midnight')
                return { config, components: components.default }
            }
            case 'boutique': {
                const components = await import('../themes/boutique')
                return { config, components: components.default }
            }
            case 'emporium': {
                const components = await import('../themes/emporium')
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
