// ─── Storefront Engine — Theme Registry ─────────────────────────────────────
// Helpers for theme metadata and selection.

import type { ThemeConfig } from './types'
import { THEME_CONFIGS } from './ThemeConfigs'

export function getAvailableThemes(): ThemeConfig[] {
    return Object.values(THEME_CONFIGS)
}

export function getDefaultThemeId(): string {
    return 'midnight'
}
