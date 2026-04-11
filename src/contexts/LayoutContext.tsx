"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

export type LayoutType =
  | 'apple-minimal'     // Apple-style: tight, clean, minimalist (NEW)
  | 'card-heavy'        // Emphasis on cards, modern feel (DEFAULT)
  | 'compact'           // Efficient spacing, maximum content visibility
  | 'dashboard-grid'    // Dense, information-rich grid
  | 'spacious'          // Generous whitespace, relaxed reading
  | 'fullscreen-focus'  // Single task focus (like POS)

export interface LayoutConfig {
  id: LayoutType
  name: string
  description: string
  characteristics: {
    density: 'sparse' | 'medium' | 'dense'
    whitespace: 'generous' | 'balanced' | 'minimal'
    cardStyle: 'prominent' | 'subtle' | 'none'
    layout: 'single-column' | 'two-column' | 'grid' | 'fullscreen'
  }
  spacing: {
    container: string      // Container padding
    section: string        // Section spacing
    card: string          // Card padding
    element: string       // Element gap
  }
  cards: {
    enabled: boolean
    borderRadius: string
    shadow: string
    border: string
    padding: string
  }
  navigation: {
    position: 'top' | 'side' | 'hidden'
    style: 'compact' | 'expanded' | 'minimal'
  }
  bestFor: string[]
}

export const LAYOUTS: Record<LayoutType, LayoutConfig> = {
  'apple-minimal': {
    id: 'apple-minimal',
    name: 'Apple Minimal',
    description: 'Clean Apple-style design with tight spacing and subtle borders',
    characteristics: {
      density: 'medium',
      whitespace: 'balanced',
      cardStyle: 'subtle',
      layout: 'single-column',
    },
    spacing: {
      container: '1.25rem',   // 20px - Tight like macOS
      section: '1.5rem',      // 24px - Clean separation
      card: '1rem',           // 16px - Compact cards
      element: '0.75rem',     // 12px - Minimal gaps
    },
    cards: {
      enabled: true,
      borderRadius: '0.625rem',  // 10px - Apple's signature radius
      shadow: '0 1px 3px rgba(0,0,0,0.08)',  // Very subtle shadow
      border: '1px solid var(--theme-border)',
      padding: '1rem',  // 16px - Tight padding
    },
    navigation: {
      position: 'side',
      style: 'minimal',
    },
    bestFor: ['macOS-like', 'Clean design', 'Professional', 'Documents', 'Settings'],
  },

  'card-heavy': {
    id: 'card-heavy',
    name: 'Card Heavy',
    description: 'Modern card-based interface with prominent shadows',
    characteristics: {
      density: 'medium',
      whitespace: 'balanced',
      cardStyle: 'prominent',
      layout: 'grid',
    },
    spacing: {
      container: '2rem',      // 32px
      section: '2rem',        // 32px
      card: '1.5rem',        // 24px
      element: '1rem',       // 16px
    },
    cards: {
      enabled: true,
      borderRadius: '0.75rem',  // 12px
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      border: '1px solid var(--theme-border)',
      padding: '1.5rem',
    },
    navigation: {
      position: 'side',
      style: 'expanded',
    },
    bestFor: ['Dashboards', 'Overview pages', 'Marketing', 'Modern feel'],
  },

  'compact': {
    id: 'compact',
    name: 'Compact',
    description: 'Efficient spacing for maximum content visibility',
    characteristics: {
      density: 'dense',
      whitespace: 'minimal',
      cardStyle: 'subtle',
      layout: 'grid',
    },
    spacing: {
      container: '1rem',      // 16px - Tight container
      section: '1.25rem',     // 20px - Minimal section gaps
      card: '0.875rem',       // 14px - Very compact cards
      element: '0.625rem',    // 10px - Tight element spacing
    },
    cards: {
      enabled: true,
      borderRadius: '0.5rem',  // 8px
      shadow: '0 1px 2px rgba(0,0,0,0.05)',
      border: '1px solid var(--theme-border)',
      padding: '0.875rem',  // 14px
    },
    navigation: {
      position: 'side',
      style: 'compact',
    },
    bestFor: ['Data tables', 'Admin panels', 'Maximum content', 'Small screens'],
  },

  'dashboard-grid': {
    id: 'dashboard-grid',
    name: 'Dashboard Grid',
    description: 'Dense, information-rich grid layout',
    characteristics: {
      density: 'dense',
      whitespace: 'minimal',
      cardStyle: 'prominent',
      layout: 'grid',
    },
    spacing: {
      container: '1rem',      // 16px
      section: '1.5rem',      // 24px
      card: '1rem',          // 16px
      element: '0.75rem',    // 12px
    },
    cards: {
      enabled: true,
      borderRadius: '0.5rem',  // 8px
      shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      border: '1px solid var(--theme-border)',
      padding: '1rem',
    },
    navigation: {
      position: 'top',
      style: 'compact',
    },
    bestFor: ['Analytics', 'Monitoring', 'Data visualization', 'KPI tracking'],
  },

  'spacious': {
    id: 'spacious',
    name: 'Spacious',
    description: 'Generous whitespace for comfortable reading and focus',
    characteristics: {
      density: 'sparse',
      whitespace: 'generous',
      cardStyle: 'subtle',
      layout: 'single-column',
    },
    spacing: {
      container: '2.5rem',    // 40px - Generous padding
      section: '2.5rem',      // 40px - Spacious sections
      card: '1.75rem',        // 28px - Roomy cards
      element: '1.25rem',     // 20px - Comfortable gaps
    },
    cards: {
      enabled: true,
      borderRadius: '0.75rem',  // 12px
      shadow: '0 2px 4px rgba(0,0,0,0.06)',
      border: '1px solid var(--theme-border)',
      padding: '1.75rem',  // 28px
    },
    navigation: {
      position: 'top',
      style: 'minimal',
    },
    bestFor: ['Reading', 'Writing', 'Focus work', 'Presentations', 'Reports'],
  },

  'fullscreen-focus': {
    id: 'fullscreen-focus',
    name: 'Fullscreen Focus',
    description: 'Immersive fullscreen mode for single-task workflows (POS, Kiosk)',
    characteristics: {
      density: 'medium',
      whitespace: 'minimal',
      cardStyle: 'none',
      layout: 'fullscreen',
    },
    spacing: {
      container: '0',         // NO padding - true fullscreen
      section: '0.5rem',      // Minimal section spacing
      card: '1rem',           // Card padding when needed
      element: '0.75rem',     // Tight element gaps
    },
    cards: {
      enabled: false,         // NO cards in fullscreen
      borderRadius: '0',      // Sharp corners
      shadow: 'none',
      border: 'none',
      padding: '1rem',        // Fallback padding
    },
    navigation: {
      position: 'hidden',
      style: 'minimal',
    },
    bestFor: ['POS Terminal', 'Kiosk mode', 'Cashier', 'Single-task', 'Presentations'],
  },
}

interface LayoutContextValue {
  layout: LayoutType
  layoutConfig: LayoutConfig
  setLayout: (layout: LayoutType) => void
  availableLayouts: LayoutConfig[]
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined)

interface LayoutProviderProps {
  children: React.ReactNode
  defaultLayout?: LayoutType
  storageKey?: string
}

export function LayoutProvider({
  children,
  defaultLayout = 'card-heavy',
  storageKey = 'tsfsystem-layout',
}: LayoutProviderProps) {
  const [layout, setLayoutState] = useState<LayoutType>(defaultLayout)

  // Load saved layout from localStorage on mount
  useEffect(() => {
    try {
      const savedLayout = localStorage.getItem(storageKey)
      if (savedLayout && savedLayout in LAYOUTS) {
        setLayoutState(savedLayout as LayoutType)
      }
    } catch (error) {
      console.error('Failed to load layout from localStorage:', error)
    }
  }, [storageKey])

  // Apply layout CSS variables and attributes when layout changes
  useEffect(() => {
    const config = LAYOUTS[layout]
    const root = document.documentElement

    // Apply spacing CSS variables
    root.style.setProperty('--layout-container-padding', config.spacing.container)
    root.style.setProperty('--layout-section-spacing', config.spacing.section)
    root.style.setProperty('--layout-card-padding', config.spacing.card)
    root.style.setProperty('--layout-element-gap', config.spacing.element)

    // Apply card styling variables
    root.style.setProperty('--layout-card-radius', config.cards.borderRadius)
    root.style.setProperty('--layout-card-shadow', config.cards.shadow)
    root.style.setProperty('--layout-card-border', config.cards.border)
    root.style.setProperty('--layout-card-padding', config.cards.padding)

    // Apply density variables
    root.style.setProperty('--layout-density', config.characteristics.density)
    root.style.setProperty('--layout-whitespace', config.characteristics.whitespace)

    // Set data attributes for CSS targeting
    root.setAttribute('data-layout', layout)
    root.setAttribute('data-layout-density', config.characteristics.density)
    root.setAttribute('data-layout-style', config.characteristics.cardStyle)
    root.setAttribute('data-cards-enabled', config.cards.enabled.toString())
    root.setAttribute('data-nav-position', config.navigation.position)

  }, [layout])

  const setLayout = (newLayout: LayoutType) => {
    setLayoutState(newLayout)
    try {
      localStorage.setItem(storageKey, newLayout)
    } catch (error) {
      console.error('Failed to save layout to localStorage:', error)
    }
  }

  const value: LayoutContextValue = {
    layout,
    layoutConfig: LAYOUTS[layout],
    setLayout,
    availableLayouts: Object.values(LAYOUTS),
  }

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}

// Utility functions for convenience
export function getLayoutConfig(layoutId: LayoutType): LayoutConfig {
  return LAYOUTS[layoutId]
}

export function getAllLayouts(): LayoutConfig[] {
  return Object.values(LAYOUTS)
}

export function getDenseLayouts(): LayoutConfig[] {
  return Object.values(LAYOUTS).filter(
    (layout) => layout.characteristics.density === 'dense'
  )
}

export function getSparseLayouts(): LayoutConfig[] {
  return Object.values(LAYOUTS).filter(
    (layout) => layout.characteristics.density === 'sparse'
  )
}

export function getLayoutsForTask(taskType: string): LayoutConfig[] {
  return Object.values(LAYOUTS).filter((layout) =>
    layout.bestFor.some((use) => use.toLowerCase().includes(taskType.toLowerCase()))
  )
}
