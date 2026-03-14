/**
 * Unified Theme Engine Context
 * =============================
 * Single source of truth for theming across the entire application.
 *
 * Replaces:
 * - ThemeContext (colors only)
 * - LayoutContext (spacing only)
 * - DesignEngineContext (presets only)
 *
 * Features:
 * - Backend-driven themes
 * - Dark/light mode toggle
 * - Real-time CSS variable updates
 * - LocalStorage persistence
 * - Auto-migration from old system
 */

'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import type {
  ThemePreset,
  ColorMode,
  ColorScheme,
  LayoutConfig,
  ComponentConfig,
  NavigationConfig,
  UnifiedThemeEngineContextValue,
  CreateThemeInput,
  ThemeCategory,
} from '@/types/theme'
import {
  getThemes,
  getCurrentTheme,
  activateTheme as activateThemeAPI,
  toggleColorMode as toggleColorModeAPI,
  setColorMode as setColorModeAPI,
  createTheme as createThemeAPI,
  updateTheme as updateThemeAPI,
  deleteTheme as deleteThemeAPI,
  exportTheme as exportThemeAPI,
  importTheme as importThemeAPI,
  findThemeBySlug,
  filterThemesByCategory,
} from '@/app/actions/theme'
import { CSS_VARIABLES } from '@/types/theme'

// ============================================================================
// CONTEXT
// ============================================================================

const UnifiedThemeEngineContext = createContext<
  UnifiedThemeEngineContextValue | undefined
>(undefined)

// ============================================================================
// PROVIDER
// ============================================================================

interface UnifiedThemeEngineProviderProps {
  children: React.ReactNode
  defaultTheme?: string
  defaultColorMode?: ColorMode
}

export function UnifiedThemeEngineProvider({
  children,
  defaultTheme = 'ant-design',  // Changed from finance-pro to ant-design
  defaultColorMode = 'dark',
}: UnifiedThemeEngineProviderProps) {
  console.log('🎨 [ThemeEngine] Provider initializing with defaults:', { defaultTheme, defaultColorMode })

  // Initialize from localStorage IMMEDIATELY to prevent FOUC (Flash Of Unstyled Content)
  const getInitialState = () => {
    if (typeof window === 'undefined') {
      return { theme: null, colorMode: defaultColorMode }
    }

    try {
      const cached = localStorage.getItem('unified-theme-preference')
      if (cached) {
        const parsed = JSON.parse(cached)
        console.log('💾 [Theme] Loaded from localStorage:', { theme: parsed.currentTheme?.name, colorMode: parsed.colorMode })
        return {
          theme: parsed.currentTheme || null,
          colorMode: parsed.colorMode || defaultColorMode
        }
      }
    } catch (e) {
      console.warn('⚠️ [Theme] Failed to load from localStorage:', e)
    }

    return { theme: null, colorMode: defaultColorMode }
  }

  const initialState = getInitialState()

  // State
  const [currentTheme, setCurrentTheme] = useState<ThemePreset | null>(initialState.theme)
  const [colorMode, setColorModeState] = useState<ColorMode>(initialState.colorMode)
  const [systemThemes, setSystemThemes] = useState<ThemePreset[]>([])
  const [customThemes, setCustomThemes] = useState<ThemePreset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  console.log('🎨 [ThemeEngine] Current state:', {
    currentTheme: currentTheme?.name,
    colorMode,
    systemThemesCount: systemThemes.length,
    customThemesCount: customThemes.length,
    isLoading,
    error
  })

  // All themes combined
  const allThemes = useMemo(
    () => [...systemThemes, ...customThemes],
    [systemThemes, customThemes]
  )

  // Get active color scheme based on mode
  const activeColors = useMemo<ColorScheme>(() => {
    if (!currentTheme) {
      // Fallback colors
      return {
        primary: '#10B981',
        primaryDark: '#059669',
        bg: '#020617',
        surface: '#0F172A',
        surfaceHover: 'rgba(255, 255, 255, 0.07)',
        text: '#F1F5F9',
        textMuted: '#94A3B8',
        border: 'rgba(255, 255, 255, 0.08)',
      }
    }

    const effectiveMode = colorMode === 'auto' ? getSystemColorMode() : colorMode
    return currentTheme?.presetData?.colors?.[effectiveMode] ?? {
      primary: '#10B981',
      primaryDark: '#059669',
      bg: '#020617',
      surface: '#0F172A',
      surfaceHover: 'rgba(255, 255, 255, 0.07)',
      text: '#F1F5F9',
      textMuted: '#94A3B8',
      border: 'rgba(255, 255, 255, 0.08)',
    }
  }, [currentTheme, colorMode])

  // Get active configurations
  const activeLayout = useMemo<LayoutConfig>(
    () =>
      currentTheme?.presetData?.layout ?? {
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
    [currentTheme]
  )

  const activeComponents = useMemo<ComponentConfig>(
    () =>
      currentTheme?.presetData?.components ?? {
        cards: {
          borderRadius: '0.625rem',
          shadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid var(--theme-border)',
          padding: '1rem',
          style: 'subtle',
        },
        buttons: {
          borderRadius: '0.5rem',
          height: '2.5rem',
          padding: '0 1.25rem',
          fontSize: '0.875rem',
          fontWeight: '500',
        },
        inputs: {
          borderRadius: '0.5rem',
          height: '2.5rem',
          padding: '0 0.875rem',
          fontSize: '0.875rem',
          border: '1px solid var(--theme-border)',
        },
        typography: {
          headingFont: 'Inter, system-ui, sans-serif',
          bodyFont: 'Inter, system-ui, sans-serif',
          h1Size: '2rem',
          h2Size: '1.5rem',
          h3Size: '1.25rem',
          bodySize: '0.875rem',
          smallSize: '0.75rem',
          fontWeight: 'normal',
          lineHeight: 'normal',
          letterSpacing: 'normal',
        },
        tables: {
          rowHeight: '2.5rem',
          headerStyle: 'bold',
          borderStyle: 'rows',
          striped: false,
          hoverEffect: true,
          density: 'comfortable',
        },
        modals: {
          maxWidth: '32rem',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          backdrop: 'blur',
          animation: 'scale',
          shadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        },
        forms: {
          labelPosition: 'top',
          labelStyle: 'normal',
          fieldSpacing: '1rem',
          groupSpacing: '1.5rem',
          validationStyle: 'inline',
        },
        tabs: {
          style: 'underline',
          size: 'md',
          spacing: '0.5rem',
          activeIndicator: 'underline',
        },
        badges: {
          size: 'md',
          style: 'soft',
          borderRadius: '0.375rem',
          fontWeight: '600',
          textTransform: 'none',
        },
        alerts: {
          style: 'soft',
          borderRadius: '0.5rem',
          padding: '1rem',
          iconSize: '1.25rem',
          showIcon: true,
        },
      },
    [currentTheme]
  )

  const activeNavigation = useMemo<NavigationConfig>(
    () =>
      currentTheme?.presetData?.navigation ?? {
        position: 'side',
        style: 'minimal',
        width: '240px',
        collapsible: true,
      },
    [currentTheme]
  )

  // Load themes from backend on mount
  useEffect(() => {
    loadThemesFromBackend()
  }, [])

  // Apply CSS variables when theme or color mode changes
  useEffect(() => {
    if (currentTheme) {
      applyCSSVariables()
    }
  }, [currentTheme, colorMode, activeColors, activeLayout, activeComponents, activeNavigation])

  // Save to localStorage for instant loading on next page load (prevent FOUC)
  useEffect(() => {
    if (currentTheme && typeof window !== 'undefined') {
      try {
        localStorage.setItem('unified-theme-preference', JSON.stringify({
          currentTheme: currentTheme,
          colorMode: colorMode
        }))
        console.log('💾 [Theme] Saved to localStorage:', { theme: currentTheme.name, colorMode })
      } catch (e) {
        console.warn('⚠️ [Theme] Failed to save to localStorage:', e)
      }
    }
  }, [currentTheme, colorMode])

  // Auto-migration from old system
  useEffect(() => {
    migrateFromOldSystem()
  }, [])

  // ============================================================================
  // FUNCTIONS
  // ============================================================================

  async function loadThemesFromBackend() {
    try {
      setIsLoading(true)
      setError(null)

      console.log('🎨 [Theme] Loading themes from backend...')

      // Try client-side API call first (faster, works in browser)
      try {
        console.log('🎨 [Theme] Attempting client-side fetch to /api/proxy/themes')
        const response = await fetch('/api/proxy/themes', {
          credentials: 'include', // Include cookies for auth
          headers: {
            'Content-Type': 'application/json',
          },
        })

        console.log('🎨 [Theme] Client fetch response:', {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        })

        if (response.ok) {
          const data = await response.json()
          console.log('🎨 [Theme] Loaded themes via client fetch:', {
            systemCount: data.system?.length || 0,
            customCount: data.custom?.length || 0,
            current: data.current
          })

          // Transform snake_case to camelCase and enrich color data
          const transformTheme = (apiTheme: any): ThemePreset => {
            // Enrich color schemes with computed fields
            const enrichColors = (colors: any) => ({
              primary: colors.primary || '#10B981',
              primaryDark: colors.primaryDark || darkenColor(colors.primary || '#10B981', 10),
              bg: colors.bg || '#020617',
              surface: colors.surface || '#0F172A',
              surfaceHover: colors.surfaceHover || 'rgba(255, 255, 255, 0.07)',
              text: colors.text || '#F1F5F9',
              textMuted: colors.textMuted || colors.muted || '#94A3B8',
              border: colors.border || 'rgba(255, 255, 255, 0.08)',
            })

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
                layout: {
                  density: apiTheme.preset_data?.layout?.density || 'medium',
                  whitespace: apiTheme.preset_data?.layout?.whitespace || 'balanced',
                  structure: apiTheme.preset_data?.layout?.structure || 'single-column',
                  spacing: {
                    container: apiTheme.preset_data?.layout?.spacing?.container || '1.5rem',
                    section: apiTheme.preset_data?.layout?.spacing?.section || '1.75rem',
                    card: apiTheme.preset_data?.layout?.spacing?.card || '1.25rem',
                    element: apiTheme.preset_data?.layout?.spacing?.element || '0.875rem',
                  },
                },
                components: {
                  cards: {
                    borderRadius: apiTheme.preset_data?.components?.cards?.borderRadius || '0.625rem',
                    shadow: apiTheme.preset_data?.components?.cards?.shadow || '0 1px 3px rgba(0,0,0,0.08)',
                    border: apiTheme.preset_data?.components?.cards?.border || '1px solid var(--theme-border)',
                    padding: apiTheme.preset_data?.components?.cards?.padding || '1rem',
                    style: apiTheme.preset_data?.components?.cards?.style || 'subtle',
                  },
                  buttons: {
                    borderRadius: apiTheme.preset_data?.components?.buttons?.borderRadius || '0.5rem',
                    height: apiTheme.preset_data?.components?.buttons?.height || '2.5rem',
                    padding: apiTheme.preset_data?.components?.buttons?.padding || '0 1.25rem',
                    fontSize: apiTheme.preset_data?.components?.buttons?.fontSize || '0.875rem',
                    fontWeight: apiTheme.preset_data?.components?.buttons?.fontWeight || '500',
                  },
                  inputs: {
                    borderRadius: apiTheme.preset_data?.components?.inputs?.borderRadius || '0.5rem',
                    height: apiTheme.preset_data?.components?.inputs?.height || '2.5rem',
                    padding: apiTheme.preset_data?.components?.inputs?.padding || '0 0.875rem',
                    fontSize: apiTheme.preset_data?.components?.inputs?.fontSize || '0.875rem',
                    border: apiTheme.preset_data?.components?.inputs?.border || '1px solid var(--theme-border)',
                  },
                  typography: {
                    headingFont: apiTheme.preset_data?.components?.typography?.headingFont || 'Inter, system-ui, sans-serif',
                    bodyFont: apiTheme.preset_data?.components?.typography?.bodyFont || 'Inter, system-ui, sans-serif',
                    h1Size: apiTheme.preset_data?.components?.typography?.h1Size || '2rem',
                    h2Size: apiTheme.preset_data?.components?.typography?.h2Size || '1.5rem',
                    h3Size: apiTheme.preset_data?.components?.typography?.h3Size || '1.25rem',
                    bodySize: apiTheme.preset_data?.components?.typography?.bodySize || '0.875rem',
                    smallSize: apiTheme.preset_data?.components?.typography?.smallSize || '0.75rem',
                    fontWeight: apiTheme.preset_data?.components?.typography?.fontWeight || 'normal',
                    lineHeight: apiTheme.preset_data?.components?.typography?.lineHeight || 'normal',
                    letterSpacing: apiTheme.preset_data?.components?.typography?.letterSpacing || 'normal',
                  },
                  tables: {
                    rowHeight: apiTheme.preset_data?.components?.tables?.rowHeight || '2.5rem',
                    headerStyle: apiTheme.preset_data?.components?.tables?.headerStyle || 'bold',
                    borderStyle: apiTheme.preset_data?.components?.tables?.borderStyle || 'rows',
                    striped: apiTheme.preset_data?.components?.tables?.striped ?? false,
                    hoverEffect: apiTheme.preset_data?.components?.tables?.hoverEffect ?? true,
                    density: apiTheme.preset_data?.components?.tables?.density || 'comfortable',
                  },
                  modals: {
                    maxWidth: apiTheme.preset_data?.components?.modals?.maxWidth || '32rem',
                    borderRadius: apiTheme.preset_data?.components?.modals?.borderRadius || '0.75rem',
                    padding: apiTheme.preset_data?.components?.modals?.padding || '1.5rem',
                    backdrop: apiTheme.preset_data?.components?.modals?.backdrop || 'blur',
                    animation: apiTheme.preset_data?.components?.modals?.animation || 'scale',
                    shadow: apiTheme.preset_data?.components?.modals?.shadow || '0 20px 25px -5px rgba(0,0,0,0.1)',
                  },
                  forms: {
                    labelPosition: apiTheme.preset_data?.components?.forms?.labelPosition || 'top',
                    labelStyle: apiTheme.preset_data?.components?.forms?.labelStyle || 'normal',
                    fieldSpacing: apiTheme.preset_data?.components?.forms?.fieldSpacing || '1rem',
                    groupSpacing: apiTheme.preset_data?.components?.forms?.groupSpacing || '1.5rem',
                    validationStyle: apiTheme.preset_data?.components?.forms?.validationStyle || 'inline',
                  },
                  tabs: {
                    style: apiTheme.preset_data?.components?.tabs?.style || 'underline',
                    size: apiTheme.preset_data?.components?.tabs?.size || 'md',
                    spacing: apiTheme.preset_data?.components?.tabs?.spacing || '0.5rem',
                    activeIndicator: apiTheme.preset_data?.components?.tabs?.activeIndicator || 'underline',
                  },
                  badges: {
                    size: apiTheme.preset_data?.components?.badges?.size || 'md',
                    style: apiTheme.preset_data?.components?.badges?.style || 'soft',
                    borderRadius: apiTheme.preset_data?.components?.badges?.borderRadius || '0.375rem',
                    fontWeight: apiTheme.preset_data?.components?.badges?.fontWeight || '600',
                    textTransform: apiTheme.preset_data?.components?.badges?.textTransform || 'none',
                  },
                  alerts: {
                    style: apiTheme.preset_data?.components?.alerts?.style || 'soft',
                    borderRadius: apiTheme.preset_data?.components?.alerts?.borderRadius || '0.5rem',
                    padding: apiTheme.preset_data?.components?.alerts?.padding || '1rem',
                    iconSize: apiTheme.preset_data?.components?.alerts?.iconSize || '1.25rem',
                    showIcon: apiTheme.preset_data?.components?.alerts?.showIcon ?? true,
                  },
                },
                navigation: {
                  position: apiTheme.preset_data?.navigation?.position || 'side',
                  style: apiTheme.preset_data?.navigation?.style || 'minimal',
                  width: apiTheme.preset_data?.navigation?.width || '240px',
                  collapsible: apiTheme.preset_data?.navigation?.collapsible ?? true,
                },
              },
              usageCount: apiTheme.usage_count,
              lastUsedAt: apiTheme.last_used_at,
            }
          }

          // Helper to darken a color by a percentage
          const darkenColor = (hex: string, percent: number): string => {
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

          setSystemThemes((data.system || []).map(transformTheme))
          setCustomThemes((data.custom || []).map(transformTheme))

          // Set current theme
          const currentSlug = data.current?.theme_slug || defaultTheme
          const systemTransformed = (data.system || []).map(transformTheme)
          const customTransformed = (data.custom || []).map(transformTheme)
          const allLoadedThemes = [...systemTransformed, ...customTransformed]
          const theme =
            allLoadedThemes.find((t: ThemePreset) => t.slug === currentSlug) ||
            systemTransformed.find((t: ThemePreset) => t.slug === defaultTheme) ||
            systemTransformed[0]

          if (theme) {
            console.log('🎨 [Theme] Setting current theme to:', theme.name)
            setCurrentTheme(theme)
          }

          console.log('🎨 [Theme] Setting color mode to:', data.current?.color_mode || defaultColorMode)
          setColorModeState(data.current?.color_mode || defaultColorMode)
          return // Success!
        } else {
          const errorText = await response.text()
          console.error('❌ [Theme] Client fetch failed:', response.status, errorText.substring(0, 200))
        }
      } catch (clientErr) {
        console.error('❌ [Theme] Client fetch error:', clientErr)
      }

      // Fallback to server action
      console.log('🎨 [Theme] Falling back to server action...')
      const data = await getThemes()
      console.log('🎨 [Theme] Loaded themes via server action:', {
        systemCount: data.system.length,
        customCount: data.custom.length,
        current: data.current
      })

      setSystemThemes(data.system)
      setCustomThemes(data.custom)

      // Set current theme
      const currentSlug = data.current.theme_slug
      const theme =
        [...data.system, ...data.custom].find((t) => t.slug === currentSlug) ||
        data.system.find((t) => t.slug === defaultTheme) ||
        data.system[0]

      if (theme) {
        console.log('🎨 [Theme] Setting current theme to:', theme.name)
        setCurrentTheme(theme)
      }

      console.log('🎨 [Theme] Setting color mode to:', data.current.color_mode)
      setColorModeState(data.current.color_mode)
    } catch (err) {
      console.error('❌ [Theme] Failed to load themes:', err)
      setError(err instanceof Error ? err.message : 'Failed to load themes')
    } finally {
      setIsLoading(false)
    }
  }

  function applyCSSVariables() {
    if (typeof window === 'undefined') return

    const root = document.documentElement

    console.log('🎨 [ThemeEngine] Applying CSS variables:', {
      theme: currentTheme?.name,
      colorMode,
      primaryColor: activeColors.primary,
      bgColor: activeColors.bg,
    })

    // Apply color variables - Core theme colors
    root.style.setProperty('--app-primary', activeColors.primary)
    root.style.setProperty('--app-primary-dark', activeColors.primaryDark)
    root.style.setProperty('--app-primary-hover', activeColors.primaryDark)
    root.style.setProperty('--app-primary-light', activeColors.primary)
    root.style.setProperty('--app-bg', activeColors.bg)
    root.style.setProperty('--app-surface', activeColors.surface)
    root.style.setProperty('--app-surface-2', activeColors.surface)
    root.style.setProperty('--app-surface-hover', activeColors.surfaceHover)
    root.style.setProperty('--app-text', activeColors.text)
    root.style.setProperty('--app-text-muted', activeColors.textMuted)
    root.style.setProperty('--app-text-faint', activeColors.textMuted)
    root.style.setProperty('--app-border', activeColors.border)
    root.style.setProperty('--app-border-strong', activeColors.border)

    // Sidebar colors — active must be a SUBTLE tint, never the solid primary
    root.style.setProperty('--app-sidebar-bg', activeColors.bg || activeColors.surface)
    root.style.setProperty('--app-sidebar-surface', `color-mix(in srgb, ${activeColors.primary} 5%, ${activeColors.surface})`)
    root.style.setProperty('--app-sidebar-text', activeColors.text)
    root.style.setProperty('--app-sidebar-muted', activeColors.textMuted)
    root.style.setProperty('--app-sidebar-active', `color-mix(in srgb, ${activeColors.primary} 8%, transparent)`)
    root.style.setProperty('--app-sidebar-border', activeColors.border)

    // Status colors (use defaults if not in theme)
    root.style.setProperty('--app-success', activeColors.success || '#10B981')
    root.style.setProperty('--app-warning', activeColors.warning || '#F59E0B')
    root.style.setProperty('--app-error', activeColors.error || '#EF4444')
    root.style.setProperty('--app-info', '#3B82F6')

    console.log('✅ [ThemeEngine] CSS variables applied successfully')

    // Apply layout variables
    root.style.setProperty('--layout-container-padding', activeLayout.spacing?.container || '1.5rem')
    root.style.setProperty('--layout-section-spacing', activeLayout.spacing?.section || '1.75rem')
    root.style.setProperty('--layout-card-padding', activeLayout.spacing?.card || '1.25rem')
    root.style.setProperty('--layout-element-gap', activeLayout.spacing?.element || '0.875rem')
    root.style.setProperty('--layout-density', activeLayout.density || 'medium')

    // ============================================================================
    // APPLY COMPONENT DESIGN PHILOSOPHY
    // ============================================================================

    // Cards
    root.style.setProperty('--card-radius', activeComponents.cards?.borderRadius || '0.75rem')
    root.style.setProperty('--card-shadow', activeComponents.cards?.shadow || '0 1px 3px rgba(0,0,0,0.1)')
    root.style.setProperty('--card-border', activeComponents.cards?.border || '1px solid var(--app-border)')
    root.style.setProperty('--card-padding', activeComponents.cards?.padding || '1.25rem')

    // Buttons
    root.style.setProperty('--button-radius', activeComponents.buttons?.borderRadius || '0.5rem')
    root.style.setProperty('--button-height', activeComponents.buttons?.height || '2.5rem')
    root.style.setProperty('--button-padding', activeComponents.buttons?.padding || '0 1.25rem')
    root.style.setProperty('--button-font-size', activeComponents.buttons?.fontSize || '0.875rem')
    root.style.setProperty('--button-font-weight', activeComponents.buttons?.fontWeight || '500')

    // Inputs
    root.style.setProperty('--input-radius', activeComponents.inputs?.borderRadius || '0.5rem')
    root.style.setProperty('--input-height', activeComponents.inputs?.height || '2.5rem')
    root.style.setProperty('--input-padding', activeComponents.inputs?.padding || '0 0.875rem')
    root.style.setProperty('--input-font-size', activeComponents.inputs?.fontSize || '0.875rem')
    root.style.setProperty('--input-border', activeComponents.inputs?.border || '1px solid var(--app-border)')

    // Typography
    root.style.setProperty('--font-heading', activeComponents.typography?.headingFont || 'Inter, sans-serif')
    root.style.setProperty('--font-body', activeComponents.typography?.bodyFont || 'Inter, sans-serif')
    root.style.setProperty('--font-size-h1', activeComponents.typography?.h1Size || '2rem')
    root.style.setProperty('--font-size-h2', activeComponents.typography?.h2Size || '1.5rem')
    root.style.setProperty('--font-size-h3', activeComponents.typography?.h3Size || '1.25rem')
    root.style.setProperty('--font-size-body', activeComponents.typography?.bodySize || '0.875rem')
    root.style.setProperty('--font-size-small', activeComponents.typography?.smallSize || '0.75rem')

    // Tables
    root.style.setProperty('--table-row-height', activeComponents.tables?.rowHeight || '3rem')
    root.style.setProperty('--table-density', activeComponents.tables?.density || 'comfortable')

    // Modals
    root.style.setProperty('--modal-max-width', activeComponents.modals?.maxWidth || '600px')
    root.style.setProperty('--modal-radius', activeComponents.modals?.borderRadius || '0.75rem')
    root.style.setProperty('--modal-padding', activeComponents.modals?.padding || '1.5rem')
    root.style.setProperty('--modal-shadow', activeComponents.modals?.shadow || '0 20px 25px -5px rgba(0,0,0,0.1)')

    // Forms
    root.style.setProperty('--form-field-spacing', activeComponents.forms?.fieldSpacing || '1rem')
    root.style.setProperty('--form-group-spacing', activeComponents.forms?.groupSpacing || '1.5rem')

    // Tabs
    root.style.setProperty('--tabs-spacing', activeComponents.tabs?.spacing || '1.5rem')

    // Badges
    root.style.setProperty('--badge-radius', activeComponents.badges?.borderRadius || '0.375rem')
    root.style.setProperty('--badge-font-weight', activeComponents.badges?.fontWeight || '600')

    // Alerts
    root.style.setProperty('--alert-radius', activeComponents.alerts?.borderRadius || '0.5rem')
    root.style.setProperty('--alert-padding', activeComponents.alerts?.padding || '1rem')

    console.log('🎨 [ThemeEngine] Component design philosophy applied:', {
      cardRadius: activeComponents.cards?.borderRadius,
      buttonHeight: activeComponents.buttons?.height,
      tableRowHeight: activeComponents.tables?.rowHeight,
      density: activeLayout.density
    })

    // Navigation
    root.style.setProperty('--nav-width', activeNavigation.width || '240px')

    // Set data attributes for CSS targeting
    root.setAttribute('data-theme', currentTheme?.slug || '')
    root.setAttribute('data-color-mode', colorMode)
    root.setAttribute('data-layout-density', activeLayout.density)
    root.setAttribute('data-layout-structure', activeLayout.structure)
    root.setAttribute('data-nav-position', activeNavigation.position)
    root.setAttribute(
      'data-cards-enabled',
      activeComponents.cards.style !== 'none' ? 'true' : 'false'
    )

    // apply class-based theme (fallback for CSS-only overrides)
    // Remove any existing theme- classes
    const classes = Array.from(root.classList).filter(c => c.startsWith('theme-'))
    classes.forEach(c => root.classList.remove(c))

    // Add current theme class
    if (currentTheme?.slug) {
      root.classList.add(`theme-${currentTheme.slug}`)
    }
  }

  function migrateFromOldSystem() {
    if (typeof window === 'undefined') return

    // Check for old localStorage keys
    const oldTheme = localStorage.getItem('tsfsystem-theme')
    const oldLayout = localStorage.getItem('tsfsystem-layout')
    const oldDesignPreset = localStorage.getItem('tsfsystem-design-preset')

    if (oldTheme || oldLayout || oldDesignPreset) {
      console.log('🔄 Auto-migrating from old theme system...')

      // Map old selections to new unified themes
      // This is a simple migration - you can enhance it
      const mapping: Record<string, string> = {
        'midnight-pro': 'finance-pro',
        'purple-dream': 'purple-dream',
        'ocean-blue': 'ocean-blue',
        'compact': 'dashboard-compact',
        'apple-minimal': 'corporate-minimal',
        'fullscreen-focus': 'pos-fullscreen',
      }

      const newThemeSlug =
        mapping[oldTheme || ''] ||
        mapping[oldLayout || ''] ||
        mapping[oldDesignPreset || ''] ||
        'finance-pro'

      // Clean up old keys
      localStorage.removeItem('tsfsystem-theme')
      localStorage.removeItem('tsfsystem-layout')
      localStorage.removeItem('tsfsystem-design-preset')

      console.log(`✅ Migrated to: ${newThemeSlug}`)
    }
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const setTheme = useCallback(
    async (slug: string) => {
      try {
        console.log('🎨 [Theme] Setting theme to:', slug)
        const theme = allThemes.find((t) => t.slug === slug)
        if (!theme) {
          throw new Error(`Theme not found: ${slug}`)
        }

        console.log('🎨 [Theme] Found theme:', theme.name, 'ID:', theme.id)

        // Update backend - direct API call via proxy
        const response = await fetch(`/api/proxy/themes/${theme.id}/activate`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const error = await response.text()
          console.error('❌ [Theme] Activate API error:', error)
          throw new Error(`Failed to activate theme: ${response.status}`)
        }

        console.log('🎨 [Theme] Backend activated theme:', theme.id)

        // Update local state
        setCurrentTheme(theme)
        console.log('🎨 [Theme] Local state updated')
      } catch (err) {
        console.error('❌ [Theme] Failed to set theme:', err)
        setError(err instanceof Error ? err.message : 'Failed to set theme')
      }
    },
    [allThemes]
  )

  const toggleColorMode = useCallback(async () => {
    try {
      console.log('🎨 [Theme] Toggling color mode from:', colorMode)

      // Direct API call via proxy instead of server action
      const response = await fetch('/api/proxy/themes/toggle-mode', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('❌ [Theme] API error:', error)
        throw new Error(`Failed to toggle color mode: ${response.status}`)
      }

      const result = await response.json()
      console.log('🎨 [Theme] Toggle result:', result)
      setColorModeState(result.color_mode)
      console.log('🎨 [Theme] Color mode updated to:', result.color_mode)
    } catch (err) {
      console.error('❌ [Theme] Failed to toggle color mode:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to toggle color mode'
      )
    }
  }, [colorMode])

  const setColorMode = useCallback(async (mode: ColorMode) => {
    try {
      console.log('🎨 [Theme] Setting color mode to:', mode)
      const result = await setColorModeAPI(mode)
      console.log('🎨 [Theme] Set mode result:', result)
      setColorModeState(result.color_mode)
      console.log('🎨 [Theme] Color mode state updated to:', result.color_mode)
    } catch (err) {
      console.error('❌ [Theme] Failed to set color mode:', err)
      setError(err instanceof Error ? err.message : 'Failed to set color mode')
    }
  }, [])

  const createTheme = useCallback(async (themeData: CreateThemeInput) => {
    try {
      const newTheme = await createThemeAPI(themeData)
      setCustomThemes((prev) => [...prev, newTheme])
      return newTheme
    } catch (err) {
      console.error('Failed to create theme:', err)
      setError(err instanceof Error ? err.message : 'Failed to create theme')
      throw err
    }
  }, [])

  const updateTheme = useCallback(
    async (id: number, updates: Partial<ThemePreset>) => {
      try {
        const updatedTheme = await updateThemeAPI(id, updates)
        setCustomThemes((prev) =>
          prev.map((t) => (t.id === id ? updatedTheme : t))
        )
        if (currentTheme?.id === id) {
          setCurrentTheme(updatedTheme)
        }
        return updatedTheme
      } catch (err) {
        console.error('Failed to update theme:', err)
        setError(err instanceof Error ? err.message : 'Failed to update theme')
        throw err
      }
    },
    [currentTheme]
  )

  const deleteTheme = useCallback(async (id: number) => {
    try {
      await deleteThemeAPI(id)
      setCustomThemes((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      console.error('Failed to delete theme:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete theme')
      throw err
    }
  }, [])

  const refreshThemes = useCallback(async () => {
    await loadThemesFromBackend()
  }, [])

  const exportTheme = useCallback(async (slug: string) => {
    try {
      const theme = allThemes.find((t) => t.slug === slug)
      if (!theme) {
        throw new Error(`Theme not found: ${slug}`)
      }
      return await exportThemeAPI(theme.id)
    } catch (err) {
      console.error('Failed to export theme:', err)
      setError(err instanceof Error ? err.message : 'Failed to export theme')
      throw err
    }
  }, [allThemes])

  const importTheme = useCallback(async (json: string) => {
    try {
      const newTheme = await importThemeAPI(json)
      setCustomThemes((prev) => [...prev, newTheme])
      return newTheme
    } catch (err) {
      console.error('Failed to import theme:', err)
      setError(err instanceof Error ? err.message : 'Failed to import theme')
      throw err
    }
  }, [])

  const getThemeBySlug = useCallback(
    (slug: string) => findThemeBySlug(allThemes, slug),
    [allThemes]
  )

  const getThemesByCategory = useCallback(
    (category: ThemeCategory) => filterThemesByCategory(allThemes, category),
    [allThemes]
  )

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: UnifiedThemeEngineContextValue = {
    // Current state
    currentTheme,
    colorMode,
    isLoading,
    error,

    // Available themes
    systemThemes,
    customThemes,
    allThemes,

    // Computed values
    activeColors,
    activeLayout,
    activeComponents,
    activeNavigation,

    // Actions
    setTheme,
    toggleColorMode,
    setColorMode,
    createTheme,
    updateTheme,
    deleteTheme,
    refreshThemes,

    // Utilities
    exportTheme,
    importTheme,
    getThemeBySlug,
    getThemesByCategory,
  }

  return (
    <UnifiedThemeEngineContext.Provider value={value}>
      {children}
    </UnifiedThemeEngineContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

export function useUnifiedThemeEngine() {
  const context = useContext(UnifiedThemeEngineContext)
  if (!context) {
    throw new Error(
      'useUnifiedThemeEngine must be used within UnifiedThemeEngineProvider'
    )
  }
  return context
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSystemColorMode(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}
