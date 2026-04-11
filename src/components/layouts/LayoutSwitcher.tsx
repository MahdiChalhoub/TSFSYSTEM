/**
 * Layout Switcher Component
 *
 * Allows users to switch between different layout modes on wide/ultra screens
 * - Shows only on screens >= 1920px
 * - Saves preference in localStorage
 * - Provides quick toggle between single/dual/triple/quad column layouts
 */

'use client'

import { useState, useEffect } from 'react'
import { Columns2, Columns3, Columns4, Maximize2, Monitor } from 'lucide-react'
import { toast } from 'sonner'

export type LayoutMode = 'single' | 'dual' | 'triple' | 'quad'

interface LayoutSwitcherProps {
  storageKey?: string
  onLayoutChange?: (mode: LayoutMode) => void
  className?: string
}

const LAYOUTS = [
  {
    mode: 'single' as LayoutMode,
    label: 'Single',
    icon: Maximize2,
    desc: 'Centered view',
    minWidth: 1280
  },
  {
    mode: 'dual' as LayoutMode,
    label: '2-Column',
    icon: Columns2,
    desc: 'Split view',
    minWidth: 1920
  },
  {
    mode: 'triple' as LayoutMode,
    label: '3-Column',
    icon: Columns3,
    desc: 'Dashboard',
    minWidth: 2560
  },
  {
    mode: 'quad' as LayoutMode,
    label: '4-Panel',
    icon: Columns4,
    desc: 'Command Center',
    minWidth: 3440
  }
]

export function LayoutSwitcher({
  storageKey = 'app-layout-preference',
  onLayoutChange,
  className = ''
}: LayoutSwitcherProps) {
  const [currentLayout, setCurrentLayout] = useState<LayoutMode>('single')
  const [screenWidth, setScreenWidth] = useState(0)

  // Detect screen size
  useEffect(() => {
    const updateWidth = () => setScreenWidth(window.innerWidth)
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved && ['single', 'dual', 'triple', 'quad'].includes(saved)) {
      setCurrentLayout(saved as LayoutMode)
    } else {
      // Auto-detect based on screen width
      if (screenWidth >= 3440) setCurrentLayout('quad')
      else if (screenWidth >= 2560) setCurrentLayout('triple')
      else if (screenWidth >= 1920) setCurrentLayout('dual')
      else setCurrentLayout('single')
    }
  }, [screenWidth, storageKey])

  const handleLayoutChange = (mode: LayoutMode) => {
    setCurrentLayout(mode)
    localStorage.setItem(storageKey, mode)
    onLayoutChange?.(mode)

    // Dispatch custom event so useLayoutMode hook picks it up
    window.dispatchEvent(new CustomEvent('layout-mode-changed', { detail: mode }))

    toast.success(`Layout: ${LAYOUTS.find(l => l.mode === mode)?.label}`)
  }

  // Show all layouts for testing (remove this condition later if needed)
  // For production, you can uncomment this to hide on small screens:
  // if (screenWidth < 1920) {
  //   return null
  // }

  // Show all layouts for testing (in production, filter by screen width)
  const availableLayouts = LAYOUTS // Show all for testing
  // const availableLayouts = LAYOUTS.filter(l => screenWidth >= l.minWidth) // Uncomment for production

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Monitor size={14} className="text-app-text-muted" />
      <div className="flex items-center gap-1 bg-app-surface/50 rounded-xl p-1 border border-app-border/30">
        {availableLayouts.map(layout => {
          const Icon = layout.icon
          const isActive = currentLayout === layout.mode

          return (
            <button
              key={layout.mode}
              onClick={() => handleLayoutChange(layout.mode)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                text-[11px] font-bold transition-all
                ${isActive
                  ? 'bg-app-primary text-white shadow-sm'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-surface'
                }
              `}
              title={layout.desc}
            >
              <Icon size={14} />
              <span className="hidden xl:inline">{layout.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Hook to use current layout mode
 */
export function useLayoutMode(storageKey = 'app-layout-preference'): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>('dual') // Default to dual for wide screens

  useEffect(() => {
    // Initial load
    const saved = localStorage.getItem(storageKey)
    if (saved && ['single', 'dual', 'triple', 'quad'].includes(saved)) {
      setMode(saved as LayoutMode)
    } else {
      // Auto-detect based on screen width
      const width = window.innerWidth
      if (width >= 3440) setMode('quad')
      else if (width >= 2560) setMode('triple')
      else if (width >= 1920) setMode('dual')
      else setMode('single')
    }

    // Listen for custom event from LayoutSwitcher
    const handleLayoutChange = (e: CustomEvent) => {
      setMode(e.detail as LayoutMode)
    }

    window.addEventListener('layout-mode-changed' as any, handleLayoutChange)

    // Also listen for storage changes (for multi-tab sync)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        setMode(e.newValue as LayoutMode)
      }
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('layout-mode-changed' as any, handleLayoutChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [storageKey])

  return mode
}
