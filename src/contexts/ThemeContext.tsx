/**
 * Theme Context - Color Theme System
 * ===================================
 * Manages color themes independently from layouts
 * Users can switch between 10 predefined themes
 * 
 * Themes are CSS-variable based for instant switching
 */
"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export type ThemeType =
  | 'midnight-pro'      // Dark emerald (default/current)
  | 'purple-dream'      // Dark purple (user's favorite)
  | 'ocean-blue'        // Dark blue
  | 'sunset-orange'     // Dark orange
  | 'forest-green'      // Dark green
  | 'ruby-red'          // Dark red
  | 'arctic-blue'       // Light mode (sky blue)
  | 'ivory'             // Light mode (warm white)
  | 'cyber-neon'        // Dark with neon accents
  | 'monochrome'        // Minimal black & white

export interface ThemeConfig {
  id: ThemeType
  name: string
  description: string
  mode: 'dark' | 'light'
  colors: {
    primary: string
    primaryDark: string
    bg: string
    surface: string
    surfaceHover: string
    text: string
    textMuted: string
    border: string
  }
  bestFor: string[]
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

export const THEMES: Record<ThemeType, ThemeConfig> = {
  'midnight-pro': {
    id: 'midnight-pro',
    name: 'Midnight Pro',
    description: 'Dark emerald theme - professional and tech',
    mode: 'dark',
    colors: {
      primary: '#10B981',
      primaryDark: '#059669',
      bg: '#020617',
      surface: '#0F172A',
      surfaceHover: 'rgba(255, 255, 255, 0.07)',
      text: '#F1F5F9',
      textMuted: '#94A3B8',
      border: 'rgba(255, 255, 255, 0.08)',
    },
    bestFor: ['Finance', 'Corporate', 'Reports'],
  },
  'purple-dream': {
    id: 'purple-dream',
    name: 'Purple Dream',
    description: 'Modern purple theme - creative and premium',
    mode: 'dark',
    colors: {
      primary: '#9b87f5',
      primaryDark: '#7E69AB',
      bg: '#0F0F1E',
      surface: '#1A1A2E',
      surfaceHover: 'rgba(155, 135, 245, 0.1)',
      text: '#E0E7FF',
      textMuted: '#A5B4FC',
      border: 'rgba(155, 135, 245, 0.2)',
    },
    bestFor: ['Dashboard', 'Marketing', 'Creative'],
  },
  'ocean-blue': {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    description: 'Deep blue theme - trust and stability',
    mode: 'dark',
    colors: {
      primary: '#3b82f6',
      primaryDark: '#2563eb',
      bg: '#0A1929',
      surface: '#1e3a5f',
      surfaceHover: 'rgba(59, 130, 246, 0.1)',
      text: '#E3F2FD',
      textMuted: '#90CAF9',
      border: 'rgba(59, 130, 246, 0.2)',
    },
    bestFor: ['HR', 'Admin', 'Settings'],
  },
  'sunset-orange': {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    description: 'Bold orange theme - energetic and creative',
    mode: 'dark',
    colors: {
      primary: '#f97316',
      primaryDark: '#ea580c',
      bg: '#1A0A00',
      surface: '#2D1810',
      surfaceHover: 'rgba(249, 115, 22, 0.1)',
      text: '#FFF7ED',
      textMuted: '#FDBA74',
      border: 'rgba(249, 115, 22, 0.2)',
    },
    bestFor: ['Sales', 'Marketing', 'Analytics'],
  },
  'forest-green': {
    id: 'forest-green',
    name: 'Forest Green',
    description: 'Natural green theme - growth and eco',
    mode: 'dark',
    colors: {
      primary: '#10b981',
      primaryDark: '#059669',
      bg: '#022c22',
      surface: '#064e3b',
      surfaceHover: 'rgba(16, 185, 129, 0.1)',
      text: '#D1FAE5',
      textMuted: '#6EE7B7',
      border: 'rgba(16, 185, 129, 0.2)',
    },
    bestFor: ['Inventory', 'Reports', 'Sustainability'],
  },
  'ruby-red': {
    id: 'ruby-red',
    name: 'Ruby Red',
    description: 'Urgent red theme - important and alert',
    mode: 'dark',
    colors: {
      primary: '#ef4444',
      primaryDark: '#dc2626',
      bg: '#1a0505',
      surface: '#450a0a',
      surfaceHover: 'rgba(239, 68, 68, 0.1)',
      text: '#FEE2E2',
      textMuted: '#FCA5A5',
      border: 'rgba(239, 68, 68, 0.2)',
    },
    bestFor: ['Alerts', 'Critical', 'Urgent Tasks'],
  },
  'arctic-blue': {
    id: 'arctic-blue',
    name: 'Arctic Blue',
    description: 'Light sky blue theme - clean and bright',
    mode: 'light',
    colors: {
      primary: '#0ea5e9',
      primaryDark: '#0284c7',
      bg: '#f8fafc',
      surface: '#ffffff',
      surfaceHover: 'rgba(14, 165, 233, 0.05)',
      text: '#0f172a',
      textMuted: '#64748b',
      border: 'rgba(14, 165, 233, 0.2)',
    },
    bestFor: ['POS', 'Day Mode', 'Public Pages'],
  },
  'ivory': {
    id: 'ivory',
    name: 'Ivory',
    description: 'Light warm theme - elegant and soft',
    mode: 'light',
    colors: {
      primary: '#9b87f5',
      primaryDark: '#7E69AB',
      bg: '#fffbf5',
      surface: '#ffffff',
      surfaceHover: 'rgba(155, 135, 245, 0.05)',
      text: '#1a1a1a',
      textMuted: '#6b7280',
      border: 'rgba(155, 135, 245, 0.2)',
    },
    bestFor: ['Documents', 'Day Mode', 'Reading'],
  },
  'cyber-neon': {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    description: 'Futuristic neon theme - tech and gaming',
    mode: 'dark',
    colors: {
      primary: '#06b6d4',
      primaryDark: '#0891b2',
      bg: '#000000',
      surface: '#0a0a0a',
      surfaceHover: 'rgba(6, 182, 212, 0.1)',
      text: '#00ff9f',
      textMuted: '#22d3ee',
      border: 'rgba(6, 182, 212, 0.3)',
    },
    bestFor: ['Tech Startups', 'Dev Tools', 'Gaming'],
  },
  'monochrome': {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Minimal black & white - timeless elegance',
    mode: 'dark',
    colors: {
      primary: '#ffffff',
      primaryDark: '#d4d4d4',
      bg: '#0a0a0a',
      surface: '#171717',
      surfaceHover: 'rgba(255, 255, 255, 0.05)',
      text: '#fafafa',
      textMuted: '#a3a3a3',
      border: 'rgba(255, 255, 255, 0.1)',
    },
    bestFor: ['Portfolio', 'Minimal UI', 'Focus Mode'],
  },
}

// ============================================================================
// CONTEXT
// ============================================================================

interface ThemeContextType {
  theme: ThemeType
  themeConfig: ThemeConfig
  setTheme: (theme: ThemeType) => void
  availableThemes: ThemeConfig[]
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// ============================================================================
// PROVIDER
// ============================================================================

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: ThemeType
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'midnight-pro',
  storageKey = 'tsfsystem-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeType>(defaultTheme)

  // Load theme from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored && stored in THEMES) {
        setThemeState(stored as ThemeType)
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error)
    }
  }, [storageKey])

  // Apply theme CSS variables
  useEffect(() => {
    const config = THEMES[theme]
    const root = document.documentElement

    // Apply all theme colors as CSS variables
    root.style.setProperty('--theme-primary', config.colors.primary)
    root.style.setProperty('--theme-primary-dark', config.colors.primaryDark)
    root.style.setProperty('--theme-bg', config.colors.bg)
    root.style.setProperty('--theme-surface', config.colors.surface)
    root.style.setProperty('--theme-surface-hover', config.colors.surfaceHover)
    root.style.setProperty('--theme-text', config.colors.text)
    root.style.setProperty('--theme-text-muted', config.colors.textMuted)
    root.style.setProperty('--theme-border', config.colors.border)

    // Apply mode (dark/light)
    root.setAttribute('data-theme-mode', config.mode)
    root.setAttribute('data-theme', theme)

    // Also update app-* variables for compatibility
    root.style.setProperty('--app-primary', config.colors.primary)
    root.style.setProperty('--app-primary-dark', config.colors.primaryDark)
    root.style.setProperty('--app-bg', config.colors.bg)
    root.style.setProperty('--app-surface', config.colors.surface)
    root.style.setProperty('--app-surface-hover', config.colors.surfaceHover)
    root.style.setProperty('--app-text', config.colors.text)
    root.style.setProperty('--app-text-muted', config.colors.textMuted)
    root.style.setProperty('--app-border', config.colors.border)
  }, [theme])

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(storageKey, newTheme)
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error)
    }
  }

  const value: ThemeContextType = {
    theme,
    themeConfig: THEMES[theme],
    setTheme,
    availableThemes: Object.values(THEMES),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// ============================================================================
// HOOK
// ============================================================================

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getThemeConfig(theme: ThemeType): ThemeConfig {
  return THEMES[theme]
}

export function getAllThemes(): ThemeConfig[] {
  return Object.values(THEMES)
}

export function getDarkThemes(): ThemeConfig[] {
  return Object.values(THEMES).filter(t => t.mode === 'dark')
}

export function getLightThemes(): ThemeConfig[] {
  return Object.values(THEMES).filter(t => t.mode === 'light')
}
