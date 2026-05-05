/**
 * 🎨 UNIFIED DESIGN ENGINE
 * ========================
 * Merges LayoutContext + ThemeContext into ONE powerful system
 *
 * Controls:
 * - Colors & themes (dark/light modes, brand colors)
 * - Layout & spacing (density, padding, margins)
 * - Components (buttons, cards, inputs)
 * - Sidebar & navigation
 * - Typography & fonts
 * - Shadows & effects
 *
 * Instead of switching Layout + Theme separately,
 * you now select ONE "Design Preset" that controls everything!
 */
"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export type DesignPresetId =
  // Professional & Corporate
  | 'corporate-minimal'      // Clean, professional, Apple-like
  | 'finance-pro'            // Dark emerald, compact, data-focused
  | 'executive-spacious'     // Generous whitespace, premium feel

  // Creative & Modern
  | 'creative-purple'        // Purple dream with card-heavy layout
  | 'modern-ocean'           // Ocean blue with balanced spacing
  | 'sunset-energy'          // Orange with grid layout

  // Efficiency & Productivity
  | 'dashboard-compact'      // Maximum data, minimal space
  | 'data-dense'             // Analytics-focused, grid layout

  // Specialized
  | 'pos-fullscreen'         // Fullscreen POS mode
  | 'light-minimal'          // Light mode, clean and simple

export interface DesignPreset {
  id: DesignPresetId
  name: string
  description: string
  category: 'professional' | 'creative' | 'efficiency' | 'specialized'

  // COLOR SYSTEM (from ThemeContext)
  colors: {
    mode: 'dark' | 'light'
    primary: string
    primaryDark: string
    bg: string
    surface: string
    surfaceHover: string
    text: string
    textMuted: string
    border: string
    accent?: string
    success?: string
    warning?: string
    error?: string
  }

  // LAYOUT SYSTEM (from LayoutContext)
  layout: {
    density: 'sparse' | 'medium' | 'dense'
    whitespace: 'generous' | 'balanced' | 'minimal'
    structure: 'single-column' | 'two-column' | 'grid' | 'fullscreen'
    spacing: {
      container: string
      section: string
      card: string
      element: string
    }
  }

  // COMPONENT SYSTEM (NEW!)
  components: {
    // Cards
    cards: {
      enabled: boolean
      borderRadius: string
      shadow: string
      border: string
      padding: string
      style: 'prominent' | 'subtle' | 'none'
    }

    // Buttons
    buttons: {
      borderRadius: string
      height: string
      padding: string
      fontSize: string
      fontWeight: string
    }

    // Inputs
    inputs: {
      borderRadius: string
      height: string
      padding: string
      fontSize: string
      border: string
    }

    // Typography
    typography: {
      headingFont: string
      bodyFont: string
      h1Size: string
      h2Size: string
      h3Size: string
      bodySize: string
      smallSize: string
    }
  }

  // SIDEBAR/NAVIGATION SYSTEM
  navigation: {
    position: 'top' | 'side' | 'hidden'
    style: 'compact' | 'expanded' | 'minimal'
    width: string
    collapsible: boolean
  }

  // Use cases
  bestFor: string[]
}

// ============================================================================
// DESIGN PRESETS (10 presets combining theme + layout + components)
// ============================================================================

export const DESIGN_PRESETS: Record<DesignPresetId, DesignPreset> = {
  'corporate-minimal': {
    id: 'corporate-minimal',
    name: 'Corporate Minimal',
    description: 'Clean Apple-style design for professional environments',
    category: 'professional',

    colors: {
      mode: 'light',
      primary: '#007AFF',      // Apple blue
      primaryDark: '#0051D5',
      bg: '#F5F5F7',           // Apple gray
      surface: '#FFFFFF',
      surfaceHover: 'rgba(0, 0, 0, 0.04)',
      text: '#1D1D1F',
      textMuted: '#86868B',
      border: 'rgba(0, 0, 0, 0.1)',
    },

    layout: {
      density: 'medium',
      whitespace: 'balanced',
      structure: 'single-column',
      spacing: {
        container: '1.25rem',
        section: '1.5rem',
        card: '1rem',
        element: '0.75rem',
      },
    },

    components: {
      cards: {
        enabled: true,
        borderRadius: '0.625rem',  // 10px - Apple radius
        shadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
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
        border: '1px solid rgba(0, 0, 0, 0.1)',
      },
      typography: {
        // The body className already loads Outfit via next/font; using
        // 'Outfit' here lets the JS-driven --font-heading inherit the
        // same family instead of forcing a system-font chain that
        // makes h1/h2 visibly thinner than the Outfit body around them.
        headingFont: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        bodyFont: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        h1Size: '2rem',
        h2Size: '1.5rem',
        h3Size: '1.25rem',
        bodySize: '0.875rem',
        smallSize: '0.75rem',
      },
    },

    navigation: {
      position: 'side',
      style: 'minimal',
      width: '240px',
      collapsible: true,
    },

    bestFor: ['Corporate', 'Professional', 'Clean design', 'macOS users'],
  },

  'finance-pro': {
    id: 'finance-pro',
    name: 'Finance Pro',
    description: 'Dark emerald theme with compact layout for financial data',
    category: 'professional',

    colors: {
      mode: 'dark',
      primary: '#10B981',
      primaryDark: '#059669',
      bg: '#020617',
      surface: '#0F172A',
      surfaceHover: 'rgba(255, 255, 255, 0.07)',
      text: '#F1F5F9',
      textMuted: '#94A3B8',
      border: 'rgba(255, 255, 255, 0.08)',
      success: '#22C55E',
      error: '#EF4444',
    },

    layout: {
      density: 'dense',
      whitespace: 'minimal',
      structure: 'grid',
      spacing: {
        container: '1rem',
        section: '1.25rem',
        card: '0.875rem',
        element: '0.625rem',
      },
    },

    components: {
      cards: {
        enabled: true,
        borderRadius: '0.5rem',
        shadow: '0 1px 2px rgba(0,0,0,0.05)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0.875rem',
        style: 'subtle',
      },
      buttons: {
        borderRadius: '0.375rem',
        height: '2.25rem',
        padding: '0 1rem',
        fontSize: '0.813rem',
        fontWeight: '500',
      },
      inputs: {
        borderRadius: '0.375rem',
        height: '2.25rem',
        padding: '0 0.75rem',
        fontSize: '0.813rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      },
      typography: {
        headingFont: 'Inter, system-ui, sans-serif',
        bodyFont: 'Inter, system-ui, sans-serif',
        h1Size: '1.75rem',
        h2Size: '1.375rem',
        h3Size: '1.125rem',
        bodySize: '0.813rem',
        smallSize: '0.688rem',
      },
    },

    navigation: {
      position: 'side',
      style: 'compact',
      width: '220px',
      collapsible: true,
    },

    bestFor: ['Finance', 'Accounting', 'Reports', 'Data-heavy'],
  },

  'executive-spacious': {
    id: 'executive-spacious',
    name: 'Executive Spacious',
    description: 'Generous whitespace and premium feel for presentations',
    category: 'professional',

    colors: {
      mode: 'light',
      primary: '#6366F1',
      primaryDark: '#4F46E5',
      bg: '#FFFFFF',
      surface: '#F9FAFB',
      surfaceHover: 'rgba(99, 102, 241, 0.04)',
      text: '#111827',
      textMuted: '#6B7280',
      border: 'rgba(0, 0, 0, 0.08)',
    },

    layout: {
      density: 'sparse',
      whitespace: 'generous',
      structure: 'single-column',
      spacing: {
        container: '2.5rem',
        section: '2.5rem',
        card: '1.75rem',
        element: '1.25rem',
      },
    },

    components: {
      cards: {
        enabled: true,
        borderRadius: '0.75rem',
        shadow: '0 2px 4px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        padding: '1.75rem',
        style: 'subtle',
      },
      buttons: {
        borderRadius: '0.625rem',
        height: '3rem',
        padding: '0 2rem',
        fontSize: '1rem',
        fontWeight: '600',
      },
      inputs: {
        borderRadius: '0.625rem',
        height: '3rem',
        padding: '0 1.25rem',
        fontSize: '1rem',
        border: '1px solid rgba(0, 0, 0, 0.1)',
      },
      typography: {
        headingFont: 'Georgia, serif',
        bodyFont: 'system-ui, sans-serif',
        h1Size: '2.5rem',
        h2Size: '2rem',
        h3Size: '1.5rem',
        bodySize: '1rem',
        smallSize: '0.875rem',
      },
    },

    navigation: {
      position: 'top',
      style: 'minimal',
      width: '100%',
      collapsible: false,
    },

    bestFor: ['Presentations', 'Reports', 'Reading', 'Executive dashboards'],
  },

  'creative-purple': {
    id: 'creative-purple',
    name: 'Creative Purple',
    description: 'Modern purple theme with card-heavy layout',
    category: 'creative',

    colors: {
      mode: 'dark',
      primary: '#9b87f5',
      primaryDark: '#7E69AB',
      bg: '#0F0F1E',
      surface: '#1A1A2E',
      surfaceHover: 'rgba(155, 135, 245, 0.1)',
      text: '#E0E7FF',
      textMuted: '#A5B4FC',
      border: 'rgba(155, 135, 245, 0.2)',
      accent: '#F97316',
    },

    layout: {
      density: 'medium',
      whitespace: 'balanced',
      structure: 'grid',
      spacing: {
        container: '2rem',
        section: '2rem',
        card: '1.5rem',
        element: '1rem',
      },
    },

    components: {
      cards: {
        enabled: true,
        borderRadius: '0.75rem',
        shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid rgba(155, 135, 245, 0.2)',
        padding: '1.5rem',
        style: 'prominent',
      },
      buttons: {
        borderRadius: '0.5rem',
        height: '2.75rem',
        padding: '0 1.5rem',
        fontSize: '0.938rem',
        fontWeight: '600',
      },
      inputs: {
        borderRadius: '0.5rem',
        height: '2.75rem',
        padding: '0 1rem',
        fontSize: '0.938rem',
        border: '1px solid rgba(155, 135, 245, 0.2)',
      },
      typography: {
        headingFont: 'Poppins, system-ui, sans-serif',
        bodyFont: 'Inter, system-ui, sans-serif',
        h1Size: '2.25rem',
        h2Size: '1.75rem',
        h3Size: '1.375rem',
        bodySize: '0.938rem',
        smallSize: '0.813rem',
      },
    },

    navigation: {
      position: 'side',
      style: 'expanded',
      width: '280px',
      collapsible: true,
    },

    bestFor: ['Marketing', 'Creative work', 'Dashboards', 'Modern apps'],
  },

  'modern-ocean': {
    id: 'modern-ocean',
    name: 'Modern Ocean',
    description: 'Deep blue theme with balanced spacing',
    category: 'creative',

    colors: {
      mode: 'dark',
      primary: '#3b82f6',
      primaryDark: '#2563eb',
      bg: '#0A1929',
      surface: '#1e3a5f',
      surfaceHover: 'rgba(59, 130, 246, 0.1)',
      text: '#E3F2FD',
      textMuted: '#90CAF9',
      border: 'rgba(59, 130, 246, 0.2)',
    },

    layout: {
      density: 'medium',
      whitespace: 'balanced',
      structure: 'two-column',
      spacing: {
        container: '1.5rem',
        section: '1.75rem',
        card: '1.25rem',
        element: '0.875rem',
      },
    },

    components: {
      cards: {
        enabled: true,
        borderRadius: '0.625rem',
        shadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        padding: '1.25rem',
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
        padding: '0 1rem',
        fontSize: '0.875rem',
        border: '1px solid rgba(59, 130, 246, 0.2)',
      },
      typography: {
        headingFont: 'system-ui, sans-serif',
        bodyFont: 'system-ui, sans-serif',
        h1Size: '2rem',
        h2Size: '1.5rem',
        h3Size: '1.25rem',
        bodySize: '0.875rem',
        smallSize: '0.75rem',
      },
    },

    navigation: {
      position: 'side',
      style: 'expanded',
      width: '260px',
      collapsible: true,
    },

    bestFor: ['HR', 'Admin', 'Settings', 'General use'],
  },

  'sunset-energy': {
    id: 'sunset-energy',
    name: 'Sunset Energy',
    description: 'Bold orange with grid layout for high-energy work',
    category: 'creative',

    colors: {
      mode: 'dark',
      primary: '#f97316',
      primaryDark: '#ea580c',
      bg: '#1A0A00',
      surface: '#2D1810',
      surfaceHover: 'rgba(249, 115, 22, 0.1)',
      text: '#FFF7ED',
      textMuted: '#FDBA74',
      border: 'rgba(249, 115, 22, 0.2)',
    },

    layout: {
      density: 'medium',
      whitespace: 'balanced',
      structure: 'grid',
      spacing: {
        container: '1.5rem',
        section: '1.5rem',
        card: '1.25rem',
        element: '0.875rem',
      },
    },

    components: {
      cards: {
        enabled: true,
        borderRadius: '0.625rem',
        shadow: '0 2px 4px rgba(0,0,0,0.15)',
        border: '1px solid rgba(249, 115, 22, 0.2)',
        padding: '1.25rem',
        style: 'prominent',
      },
      buttons: {
        borderRadius: '0.5rem',
        height: '2.5rem',
        padding: '0 1.25rem',
        fontSize: '0.875rem',
        fontWeight: '600',
      },
      inputs: {
        borderRadius: '0.5rem',
        height: '2.5rem',
        padding: '0 1rem',
        fontSize: '0.875rem',
        border: '1px solid rgba(249, 115, 22, 0.2)',
      },
      typography: {
        headingFont: 'system-ui, sans-serif',
        bodyFont: 'system-ui, sans-serif',
        h1Size: '2rem',
        h2Size: '1.5rem',
        h3Size: '1.25rem',
        bodySize: '0.875rem',
        smallSize: '0.75rem',
      },
    },

    navigation: {
      position: 'side',
      style: 'expanded',
      width: '260px',
      collapsible: true,
    },

    bestFor: ['Sales', 'Marketing', 'Analytics', 'High energy'],
  },

  'dashboard-compact': {
    id: 'dashboard-compact',
    name: 'Dashboard Compact',
    description: 'Maximum data visibility with minimal space',
    category: 'efficiency',

    colors: {
      mode: 'dark',
      primary: '#10b981',
      primaryDark: '#059669',
      bg: '#0F172A',
      surface: '#1E293B',
      surfaceHover: 'rgba(16, 185, 129, 0.1)',
      text: '#F1F5F9',
      textMuted: '#94A3B8',
      border: 'rgba(255, 255, 255, 0.1)',
    },

    layout: {
      density: 'dense',
      whitespace: 'minimal',
      structure: 'grid',
      spacing: {
        container: '1rem',
        section: '1.25rem',
        card: '0.875rem',
        element: '0.625rem',
      },
    },

    components: {
      cards: {
        enabled: true,
        borderRadius: '0.5rem',
        shadow: '0 1px 2px rgba(0,0,0,0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '0.875rem',
        style: 'subtle',
      },
      buttons: {
        borderRadius: '0.375rem',
        height: '2rem',
        padding: '0 0.875rem',
        fontSize: '0.75rem',
        fontWeight: '500',
      },
      inputs: {
        borderRadius: '0.375rem',
        height: '2rem',
        padding: '0 0.625rem',
        fontSize: '0.75rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      },
      typography: {
        headingFont: 'system-ui, sans-serif',
        bodyFont: 'system-ui, sans-serif',
        h1Size: '1.5rem',
        h2Size: '1.25rem',
        h3Size: '1rem',
        bodySize: '0.75rem',
        smallSize: '0.625rem',
      },
    },

    navigation: {
      position: 'side',
      style: 'compact',
      width: '200px',
      collapsible: true,
    },

    bestFor: ['Dashboards', 'Monitoring', 'Data tables', 'Small screens'],
  },

  'data-dense': {
    id: 'data-dense',
    name: 'Data Dense',
    description: 'Analytics-focused with maximum information density',
    category: 'efficiency',

    colors: {
      mode: 'dark',
      primary: '#3b82f6',
      primaryDark: '#2563eb',
      bg: '#0A1929',
      surface: '#132F4C',
      surfaceHover: 'rgba(59, 130, 246, 0.08)',
      text: '#E3F2FD',
      textMuted: '#90CAF9',
      border: 'rgba(59, 130, 246, 0.15)',
    },

    layout: {
      density: 'dense',
      whitespace: 'minimal',
      structure: 'grid',
      spacing: {
        container: '1rem',
        section: '1.5rem',
        card: '1rem',
        element: '0.75rem',
      },
    },

    components: {
      cards: {
        enabled: true,
        borderRadius: '0.5rem',
        shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        padding: '1rem',
        style: 'prominent',
      },
      buttons: {
        borderRadius: '0.375rem',
        height: '2rem',
        padding: '0 0.875rem',
        fontSize: '0.75rem',
        fontWeight: '500',
      },
      inputs: {
        borderRadius: '0.375rem',
        height: '2rem',
        padding: '0 0.75rem',
        fontSize: '0.75rem',
        border: '1px solid rgba(59, 130, 246, 0.15)',
      },
      typography: {
        headingFont: 'Roboto Mono, monospace',
        bodyFont: 'system-ui, sans-serif',
        h1Size: '1.5rem',
        h2Size: '1.25rem',
        h3Size: '1rem',
        bodySize: '0.75rem',
        smallSize: '0.625rem',
      },
    },

    navigation: {
      position: 'top',
      style: 'compact',
      width: '100%',
      collapsible: false,
    },

    bestFor: ['Analytics', 'KPI tracking', 'Data visualization', 'Monitoring'],
  },

  'pos-fullscreen': {
    id: 'pos-fullscreen',
    name: 'POS Fullscreen',
    description: 'Immersive fullscreen for point-of-sale and kiosk mode',
    category: 'specialized',

    colors: {
      mode: 'dark',
      primary: '#10B981',
      primaryDark: '#059669',
      bg: '#020617',
      surface: '#0F172A',
      surfaceHover: 'rgba(16, 185, 129, 0.1)',
      text: '#F1F5F9',
      textMuted: '#94A3B8',
      border: 'rgba(255, 255, 255, 0.08)',
      success: '#22C55E',
      warning: '#F59E0B',
      error: '#EF4444',
    },

    layout: {
      density: 'medium',
      whitespace: 'minimal',
      structure: 'fullscreen',
      spacing: {
        container: '0',
        section: '0.5rem',
        card: '1rem',
        element: '0.75rem',
      },
    },

    components: {
      cards: {
        enabled: false,
        borderRadius: '0',
        shadow: 'none',
        border: 'none',
        padding: '1rem',
        style: 'none',
      },
      buttons: {
        borderRadius: '0.5rem',
        height: '3.5rem',
        padding: '0 1.5rem',
        fontSize: '1.125rem',
        fontWeight: '600',
      },
      inputs: {
        borderRadius: '0.5rem',
        height: '3.5rem',
        padding: '0 1.25rem',
        fontSize: '1.125rem',
        border: '2px solid rgba(255, 255, 255, 0.1)',
      },
      typography: {
        headingFont: 'system-ui, sans-serif',
        bodyFont: 'system-ui, sans-serif',
        h1Size: '2.5rem',
        h2Size: '2rem',
        h3Size: '1.5rem',
        bodySize: '1rem',
        smallSize: '0.875rem',
      },
    },

    navigation: {
      position: 'hidden',
      style: 'minimal',
      width: '0',
      collapsible: false,
    },

    bestFor: ['POS Terminal', 'Kiosk', 'Cashier', 'Single-task', 'Touch interface'],
  },

  'light-minimal': {
    id: 'light-minimal',
    name: 'Light Minimal',
    description: 'Clean light mode for daylight work',
    category: 'specialized',

    colors: {
      mode: 'light',
      primary: '#6366F1',
      primaryDark: '#4F46E5',
      bg: '#FFFFFF',
      surface: '#F9FAFB',
      surfaceHover: 'rgba(99, 102, 241, 0.04)',
      text: '#111827',
      textMuted: '#6B7280',
      border: 'rgba(0, 0, 0, 0.1)',
    },

    layout: {
      density: 'medium',
      whitespace: 'balanced',
      structure: 'two-column',
      spacing: {
        container: '1.5rem',
        section: '1.75rem',
        card: '1.25rem',
        element: '0.875rem',
      },
    },

    components: {
      cards: {
        enabled: true,
        borderRadius: '0.625rem',
        shadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        padding: '1.25rem',
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
        padding: '0 1rem',
        fontSize: '0.875rem',
        border: '1px solid rgba(0, 0, 0, 0.15)',
      },
      typography: {
        headingFont: 'system-ui, sans-serif',
        bodyFont: 'system-ui, sans-serif',
        h1Size: '2rem',
        h2Size: '1.5rem',
        h3Size: '1.25rem',
        bodySize: '0.875rem',
        smallSize: '0.75rem',
      },
    },

    navigation: {
      position: 'side',
      style: 'minimal',
      width: '240px',
      collapsible: true,
    },

    bestFor: ['Light mode', 'Daylight work', 'Reading', 'Clean interface'],
  },
}

// ============================================================================
// CONTEXT
// ============================================================================

interface DesignEngineContextValue {
  preset: DesignPresetId
  config: DesignPreset
  setPreset: (presetId: DesignPresetId) => void
  availablePresets: DesignPreset[]
  presetsByCategory: Record<string, DesignPreset[]>
}

const DesignEngineContext = createContext<DesignEngineContextValue | undefined>(undefined)

interface DesignEngineProviderProps {
  children: React.ReactNode
  defaultPreset?: DesignPresetId
  storageKey?: string
}

export function DesignEngineProvider({
  children,
  defaultPreset = 'finance-pro',
  storageKey = 'tsfsystem-design-preset',
}: DesignEngineProviderProps) {
  const [preset, setPresetState] = useState<DesignPresetId>(defaultPreset)

  // Load saved preset from localStorage on mount
  useEffect(() => {
    try {
      const savedPreset = localStorage.getItem(storageKey)
      if (savedPreset && savedPreset in DESIGN_PRESETS) {
        setPresetState(savedPreset as DesignPresetId)
      }
    } catch (error) {
      console.error('Failed to load design preset from localStorage:', error)
    }
  }, [storageKey])

  // Apply ALL design CSS variables when preset changes
  useEffect(() => {
    const config = DESIGN_PRESETS[preset]
    const root = document.documentElement

    // Apply COLOR variables
    root.style.setProperty('--theme-primary', config.colors.primary)
    root.style.setProperty('--theme-primary-dark', config.colors.primaryDark)
    root.style.setProperty('--bg-app-bg', config.colors.bg)
    root.style.setProperty('--theme-surface', config.colors.surface)
    root.style.setProperty('--theme-surface-hover', config.colors.surfaceHover)
    root.style.setProperty('--text-app-foreground', config.colors.text)
    root.style.setProperty('--text-app-muted-foreground', config.colors.textMuted)
    root.style.setProperty('--theme-border', config.colors.border)
    if (config.colors.accent) root.style.setProperty('--theme-accent', config.colors.accent)
    if (config.colors.success) root.style.setProperty('--theme-success', config.colors.success)
    if (config.colors.warning) root.style.setProperty('--theme-warning', config.colors.warning)
    if (config.colors.error) root.style.setProperty('--theme-error', config.colors.error)

    // Apply LAYOUT variables
    root.style.setProperty('--layout-container-padding', config.layout.spacing.container)
    root.style.setProperty('--layout-section-spacing', config.layout.spacing.section)
    root.style.setProperty('--layout-card-padding', config.layout.spacing.card)
    root.style.setProperty('--layout-element-gap', config.layout.spacing.element)

    // Apply CARD variables
    root.style.setProperty('--card-radius', config.components.cards.borderRadius)
    root.style.setProperty('--card-shadow', config.components.cards.shadow)
    root.style.setProperty('--card-border', config.components.cards.border)
    root.style.setProperty('--card-padding', config.components.cards.padding)

    // Apply BUTTON variables
    root.style.setProperty('--button-radius', config.components.buttons.borderRadius)
    root.style.setProperty('--button-height', config.components.buttons.height)
    root.style.setProperty('--button-padding', config.components.buttons.padding)
    root.style.setProperty('--button-font-size', config.components.buttons.fontSize)
    root.style.setProperty('--button-font-weight', config.components.buttons.fontWeight)

    // Apply INPUT variables
    root.style.setProperty('--input-radius', config.components.inputs.borderRadius)
    root.style.setProperty('--input-height', config.components.inputs.height)
    root.style.setProperty('--input-padding', config.components.inputs.padding)
    root.style.setProperty('--input-font-size', config.components.inputs.fontSize)
    root.style.setProperty('--input-border', config.components.inputs.border)

    // Typography is now LOCKED to the canonical scale in AppThemeProvider
    // (see components/app/AppThemeProvider.tsx). DesignEngine presets
    // can still SHIP typography fields for the preview UI, but they
    // are intentionally NOT written to the live :root vars here —
    // doing so would race AppThemeProvider and let preset.h1Size = '3rem'
    // win, recreating the historical drift this consolidation fixes.
    //
    // To change typography globally: edit globals.css :root + the
    // CANONICAL_FONT block in AppThemeProvider.tsx. There is no
    // per-preset typography override anymore.

    // Apply NAVIGATION variables
    // Guard: presets with position:'top' set width:'100%' which breaks the sidebar layout.
    // Only apply pixel values; ignore percentage/viewport-based widths.
    const rawNavWidth = config.navigation.width || '240px';
    if (/^\d+px$/.test(rawNavWidth)) {
      root.style.setProperty('--nav-width', rawNavWidth);
    }

    // Set data attributes for CSS targeting
    root.setAttribute('data-design-preset', preset)
    root.setAttribute('data-color-mode', config.colors.mode)
    root.setAttribute('data-layout-density', config.layout.density)
    root.setAttribute('data-layout-structure', config.layout.structure)
    root.setAttribute('data-cards-enabled', config.components.cards.enabled.toString())
    root.setAttribute('data-nav-position', config.navigation.position)
    root.setAttribute('data-nav-collapsible', config.navigation.collapsible.toString())

  }, [preset])

  const setPreset = (newPreset: DesignPresetId) => {
    setPresetState(newPreset)
    try {
      localStorage.setItem(storageKey, newPreset)
    } catch (error) {
      console.error('Failed to save design preset to localStorage:', error)
    }
  }

  // Group presets by category
  const presetsByCategory = Object.values(DESIGN_PRESETS).reduce((acc, preset) => {
    if (!acc[preset.category]) {
      acc[preset.category] = []
    }
    acc[preset.category].push(preset)
    return acc
  }, {} as Record<string, DesignPreset[]>)

  const value: DesignEngineContextValue = {
    preset,
    config: DESIGN_PRESETS[preset],
    setPreset,
    availablePresets: Object.values(DESIGN_PRESETS),
    presetsByCategory,
  }

  return (
    <DesignEngineContext.Provider value={value}>
      {children}
    </DesignEngineContext.Provider>
  )
}

export function useDesignEngine() {
  const context = useContext(DesignEngineContext)
  if (!context) {
    throw new Error('useDesignEngine must be used within a DesignEngineProvider')
  }
  return context
}

// Utility functions
export function getDesignPreset(presetId: DesignPresetId): DesignPreset {
  return DESIGN_PRESETS[presetId]
}

export function getAllPresets(): DesignPreset[] {
  return Object.values(DESIGN_PRESETS)
}

export function getPresetsByCategory(category: string): DesignPreset[] {
  return Object.values(DESIGN_PRESETS).filter(p => p.category === category)
}

export function getProfessionalPresets(): DesignPreset[] {
  return getPresetsByCategory('professional')
}

export function getCreativePresets(): DesignPreset[] {
  return getPresetsByCategory('creative')
}

export function getEfficiencyPresets(): DesignPreset[] {
  return getPresetsByCategory('efficiency')
}
