/**
 * WORKSPACE LAYOUT HOOK
 * =====================
 * Single source of truth for workspace layout state
 * Determines mode from: screen width + page capability + user override
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  WorkspaceMode,
  ScreenTier,
  WorkspaceState,
  WorkspaceActions,
  PageCapability
} from './types'
import { SCREEN_TIERS } from './types'

interface UseWorkspaceLayoutOptions {
  pageId: string
  capability: PageCapability | null
  storageKey?: string
}

export function useWorkspaceLayout({
  pageId,
  capability,
  storageKey = 'workspace-layout'
}: UseWorkspaceLayoutOptions) {
  // Screen detection
  const [screenWidth, setScreenWidth] = useState(0)

  // Detect screen tier
  const screenTier = useMemo<ScreenTier>(() => {
    if (screenWidth >= SCREEN_TIERS.superwide.minWidth) return 'superwide'
    if (screenWidth >= SCREEN_TIERS.ultrawide.minWidth) return 'ultrawide'
    if (screenWidth >= SCREEN_TIERS.wide.minWidth) return 'wide'
    return 'normal'
  }, [screenWidth])

  // User override (null = use automatic detection)
  const [userOverride, setUserOverride] = useState<WorkspaceMode | null>(null)

  // Collapsed panels
  const [collapsedPanels, setCollapsedPanels] = useState<string[]>([])

  // Determine current mode
  const currentMode = useMemo<WorkspaceMode>(() => {
    // 1. User override takes precedence
    if (userOverride) return userOverride

    // 2. Page capability limits what modes are available
    if (!capability) return 'standard'

    // 3. Screen tier suggests default mode
    const tierDefault = SCREEN_TIERS[screenTier].defaultMode as WorkspaceMode

    // 4. Check if page supports the tier default
    if (capability.modes[tierDefault]) return tierDefault

    // 5. Fallback to standard
    return 'standard'
  }, [userOverride, capability, screenTier])

  // Active panels for current mode
  const activePanels = useMemo(() => {
    if (!capability || !capability.modes[currentMode]) return []
    return capability.modes[currentMode].panels.map(p => p.id)
  }, [capability, currentMode])

  // Initialize screen width
  useEffect(() => {
    const updateWidth = () => setScreenWidth(window.innerWidth)
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // Load saved preferences
  useEffect(() => {
    if (typeof window === 'undefined') return

    const saved = localStorage.getItem(`${storageKey}-${pageId}`)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.userOverride && ['standard', 'split', 'workspace', 'command'].includes(data.userOverride)) {
          setUserOverride(data.userOverride)
        }
        if (Array.isArray(data.collapsedPanels)) {
          setCollapsedPanels(data.collapsedPanels)
        }
      } catch (e) {
        console.error('Failed to load workspace preferences:', e)
      }
    }
  }, [pageId, storageKey])

  // Save preferences
  const savePreferences = useCallback(() => {
    if (typeof window === 'undefined') return

    const data = {
      userOverride,
      collapsedPanels
    }

    localStorage.setItem(`${storageKey}-${pageId}`, JSON.stringify(data))
  }, [pageId, storageKey, userOverride, collapsedPanels])

  // Actions
  const setMode = useCallback((mode: WorkspaceMode) => {
    setUserOverride(mode)
    savePreferences()

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('workspace-mode-changed', {
      detail: { pageId, mode }
    }))
  }, [pageId, savePreferences])

  const togglePanel = useCallback((panelId: string) => {
    setCollapsedPanels(prev => {
      const isCollapsed = prev.includes(panelId)
      return isCollapsed
        ? prev.filter(id => id !== panelId)
        : [...prev, panelId]
    })
  }, [])

  const collapsePanel = useCallback((panelId: string) => {
    setCollapsedPanels(prev =>
      prev.includes(panelId) ? prev : [...prev, panelId]
    )
  }, [])

  const expandPanel = useCallback((panelId: string) => {
    setCollapsedPanels(prev => prev.filter(id => id !== panelId))
  }, [])

  const resetToDefault = useCallback(() => {
    setUserOverride(null)
    setCollapsedPanels([])
    localStorage.removeItem(`${storageKey}-${pageId}`)
  }, [pageId, storageKey])

  // Save on change
  useEffect(() => {
    savePreferences()
  }, [savePreferences])

  const state: WorkspaceState = {
    currentMode,
    currentTier: screenTier,
    screenWidth,
    userOverride,
    activePanels,
    collapsedPanels
  }

  const actions: WorkspaceActions = {
    setMode,
    togglePanel,
    collapsePanel,
    expandPanel,
    resetToDefault
  }

  return {
    state,
    actions,
    capability
  }
}
