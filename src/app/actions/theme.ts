/**
 * Theme Server Actions
 * ====================
 * Server-side API calls for theme management.
 */

'use server'

import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import type {
  ThemesListResponse,
  CurrentThemeResponse,
  ThemePreset,
  CreateThemeInput,
  ImportThemeInput,
  ThemeActivateResponse,
  ColorModeToggleResponse,
  ThemeValidationResult,
} from '@/types/theme'

const API_BASE = process.env.DJANGO_URL || 'http://backend:8000'

// Helper to get auth token from cookies
async function getAuthToken() {
  const cookieStore = await cookies()
  return cookieStore.get('auth_token')?.value
}

// Helper to darken a color by a percentage
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) - amt
  const G = ((num >> 8) & 0x00ff) - amt
  const B = (num & 0x0000ff) - amt
  return (
    '#' +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  )
}

// Helper to enrich color schemes with computed fields
function enrichColors(colors: any) {
  return {
    primary: colors.primary || '#10B981',
    primaryDark: colors.primaryDark || darkenColor(colors.primary || '#10B981', 10),
    bg: colors.bg || '#020617',
    surface: colors.surface || '#0F172A',
    surfaceHover: colors.surfaceHover || 'rgba(255, 255, 255, 0.07)',
    text: colors.text || '#F1F5F9',
    textMuted: colors.textMuted || colors.muted || '#94A3B8',
    border: colors.border || 'rgba(255, 255, 255, 0.08)',
  }
}

// Helper to transform snake_case API response to camelCase for TypeScript
function transformThemeFromAPI(apiTheme: any): ThemePreset {
  return {
    id: apiTheme.id,
    slug: apiTheme.slug,
    name: apiTheme.name,
    description: apiTheme.description,
    category: apiTheme.category,
    isSystem: apiTheme.is_system,
    isActive: apiTheme.is_active ?? true,
    isDefault: apiTheme.is_default ?? false,
    tags: apiTheme.tags || [],
    presetData: {
      colors: {
        dark: enrichColors(apiTheme.preset_data?.colors?.dark || {}),
        light: enrichColors(apiTheme.preset_data?.colors?.light || {}),
      },
      layout: apiTheme.preset_data?.layout || {
        density: 'medium',
        whitespace: 'balanced',
        structure: 'single-column',
        spacing: {
          container: '1.5rem',
          section: '1.75rem',
          card: '1.25rem',
          element: '0.875rem',
        },
      },
      components: apiTheme.preset_data?.components || {
        cards: { borderRadius: '0.75rem', shadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--app-border)', padding: '1.25rem', style: 'subtle' },
        buttons: { borderRadius: '0.5rem', height: '2.5rem', padding: '0 1.25rem', fontSize: '0.875rem', fontWeight: '500' },
        inputs: { borderRadius: '0.5rem', height: '2.5rem', padding: '0 0.875rem', fontSize: '0.875rem', border: '1px solid var(--app-border)' },
        /* Canonical typography defaults — synced with globals.css.
           Sizes: h1=18 h2=16 h3=15 body=15 small=13 (px). Outfit body. */
        typography: { headingFont: "'Outfit', ui-sans-serif, system-ui, sans-serif", bodyFont: "'Outfit', ui-sans-serif, system-ui, sans-serif", h1Size: '1.125rem', h2Size: '1rem', h3Size: '0.9375rem', bodySize: '0.9375rem', smallSize: '0.8125rem', fontWeight: 'medium', lineHeight: 'normal', letterSpacing: 'normal' },
        tables: { rowHeight: '3rem', headerStyle: 'bold', borderStyle: 'rows', striped: true, hoverEffect: true, density: 'comfortable' },
        modals: { maxWidth: '600px', borderRadius: '0.75rem', padding: '1.5rem', backdrop: 'blur', animation: 'scale', shadow: '0 20px 25px -5px rgba(0,0,0,0.1)' },
        forms: { labelPosition: 'top', labelStyle: 'bold', fieldSpacing: '1rem', groupSpacing: '1.5rem', validationStyle: 'inline' },
        tabs: { style: 'underline', size: 'md', spacing: '1.5rem', activeIndicator: 'underline' },
        badges: { size: 'sm', style: 'soft', borderRadius: '0.375rem', fontWeight: '600', textTransform: 'uppercase' },
        alerts: { style: 'soft', borderRadius: '0.5rem', padding: '1rem', iconSize: '1.25rem', showIcon: true }
      },
      navigation: apiTheme.preset_data?.navigation || {
        position: 'side',
        style: 'minimal',
        width: '240px',
        collapsible: true,
      },
    },
    usageCount: apiTheme.usage_count,
    lastUsedAt: apiTheme.last_used_at,
    createdAt: apiTheme.created_at,
    updatedAt: apiTheme.updated_at,
  }
}

// Helper for authenticated API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  tenantSlug?: string,
): Promise<T> {
  const token = await getAuthToken()
  const url = `${API_BASE}/api/${endpoint}`
  const tenantHeaders: Record<string, string> = {}
  if (tenantSlug) {
    tenantHeaders['X-Tenant-Slug'] = tenantSlug
    tenantHeaders['X-Tenant-Id'] = tenantSlug
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Token ${token}` }),
      ...tenantHeaders,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    // Only warn on actual failures — successful calls are noise.
    console.warn('[Theme API]', endpoint, response.status, error.substring(0, 200))
    throw new Error(`API Error: ${response.status} - ${error}`)
  }

  return response.json()
}

// ============================================================================
// THEME QUERIES
// ============================================================================

export async function getThemes(tenantSlug?: string): Promise<ThemesListResponse> {
  try {
    // 5-min HTTP fetch cache. Per-user safe (token in Authorization header
    // → cache key). Tag-bust via revalidateTag('themes:<slug>') after a write.
    const result = await apiCall<any>('ui-themes/', {
      next: { revalidate: 300, tags: [`themes:${tenantSlug || 'default'}`, 'themes'] },
    } as any, tenantSlug)
    return {
      system: (result.system || []).map(transformThemeFromAPI),
      custom: (result.custom || []).map(transformThemeFromAPI),
      current: {
        theme_slug: result.current?.theme_slug || 'finance-pro',
        color_mode: result.current?.color_mode || 'dark',
      },
    }
  } catch (error) {
    console.warn('[Theme Action] fetch failed:', error)
    return {
      system: [], custom: [],
      current: { theme_slug: 'finance-pro', color_mode: 'dark' },
    }
  }
}

/**
 * Get current user's active theme
 */
export async function getCurrentTheme(): Promise<CurrentThemeResponse> {
  return apiCall<CurrentThemeResponse>('ui-themes/current/')
}

/**
 * Get specific theme by ID
 */
export async function getThemeById(themeId: number): Promise<ThemePreset> {
  return apiCall<ThemePreset>(`ui-themes/${themeId}/`)
}

// ============================================================================
// THEME MUTATIONS
// ============================================================================

/**
 * Activate a theme for current user
 */
export async function activateTheme(
  themeId: number
): Promise<ThemeActivateResponse> {
  const result = await apiCall<ThemeActivateResponse>(`ui-themes/${themeId}/activate/`, {
    method: 'POST',
  })
  revalidateTag('themes')
  return result
}

/**
 * Toggle between dark and light mode
 */
export async function toggleColorMode(): Promise<ColorModeToggleResponse> {
  return apiCall<ColorModeToggleResponse>('ui-themes/toggle-mode/', {
    method: 'POST',
  })
}

/**
 * Set specific color mode
 */
export async function setColorMode(
  mode: 'dark' | 'light' | 'auto'
): Promise<ColorModeToggleResponse> {
  return apiCall<ColorModeToggleResponse>('ui-themes/toggle-mode/', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  })
}

/**
 * Create a new custom theme
 */
export async function createTheme(
  themeData: CreateThemeInput
): Promise<ThemePreset> {
  return apiCall<ThemePreset>('ui-themes/create/', {
    method: 'POST',
    body: JSON.stringify(themeData),
  })
}

/**
 * Update an existing custom theme
 */
export async function updateTheme(
  themeId: number,
  updates: Partial<ThemePreset>
): Promise<ThemePreset> {
  return apiCall<ThemePreset>(`ui-themes/${themeId}/update/`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

/**
 * Delete a custom theme
 */
export async function deleteTheme(themeId: number): Promise<void> {
  await apiCall<void>(`ui-themes/${themeId}/delete/`, {
    method: 'DELETE',
  })
}

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

/**
 * Export theme as JSON
 */
export async function exportTheme(themeId: number): Promise<string> {
  const data = await apiCall<any>(`ui-themes/${themeId}/export/`)
  return JSON.stringify(data, null, 2)
}

/**
 * Import theme from JSON
 */
export async function importTheme(json: string): Promise<ThemePreset> {
  const themeData = JSON.parse(json) as ImportThemeInput
  return apiCall<ThemePreset>('ui-themes/import/', {
    method: 'POST',
    body: JSON.stringify(themeData),
  })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate theme JSON structure
 */
export async function validateThemeJson(json: string): Promise<ThemeValidationResult> {
  const errors: string[] = []

  try {
    const data = JSON.parse(json)

    // Required fields
    if (!data.name) errors.push('Missing required field: name')
    if (!data.preset_data) errors.push('Missing required field: preset_data')

    // Validate preset_data structure
    if (data.preset_data) {
      if (!data.preset_data.colors) errors.push('Missing colors in preset_data')
      if (!data.preset_data.layout) errors.push('Missing layout in preset_data')
      if (!data.preset_data.components)
        errors.push('Missing components in preset_data')
      if (!data.preset_data.navigation)
        errors.push('Missing navigation in preset_data')

      // Validate colors have dark and light variants
      if (data.preset_data.colors) {
        if (!data.preset_data.colors.dark)
          errors.push('Missing dark color scheme')
        if (!data.preset_data.colors.light)
          errors.push('Missing light color scheme')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  } catch (e) {
    return {
      valid: false,
      errors: ['Invalid JSON format'],
    }
  }
}

/**
 * Get theme by slug from themes list
 */
export async function findThemeBySlug(
  themes: ThemePreset[],
  slug: string
): Promise<ThemePreset | undefined> {
  return themes.find((t) => t.slug === slug)
}

/**
 * Filter themes by category
 */
export async function filterThemesByCategory(
  themes: ThemePreset[],
  category: string
): Promise<ThemePreset[]> {
  return themes.filter((t) => t.category === category)
}

/**
 * Search themes by name or tag
 */
export async function searchThemes(themes: ThemePreset[], query: string): Promise<ThemePreset[]> {
  const lowerQuery = query.toLowerCase()
  return themes.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  )
}
