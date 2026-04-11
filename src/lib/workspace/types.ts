/**
 * WORKSPACE LAYOUT SYSTEM - TYPE DEFINITIONS
 * ===========================================
 * Single source of truth for workspace layouts across TSFSYSTEM
 */

/**
 * Layout Modes (NOT just screen sizes)
 * Each mode represents a DIFFERENT WORKSPACE STRUCTURE
 */
export type WorkspaceMode = 'standard' | 'split' | 'workspace' | 'command'

/**
 * Screen Tiers (detect capability, not just width)
 */
export type ScreenTier = 'normal' | 'wide' | 'ultrawide' | 'superwide'

export const SCREEN_TIERS = {
  normal: { minWidth: 1280, maxWidth: 1919, defaultMode: 'standard' },
  wide: { minWidth: 1920, maxWidth: 2559, defaultMode: 'split' },
  ultrawide: { minWidth: 2560, maxWidth: 3439, defaultMode: 'workspace' },
  superwide: { minWidth: 3440, maxWidth: Infinity, defaultMode: 'command' }
} as const

/**
 * Panel Position in Workspace
 */
export type PanelPosition = 'left' | 'center-left' | 'center' | 'center-right' | 'right'

/**
 * Panel Configuration
 */
export interface WorkspacePanel {
  id: string
  position?: PanelPosition
  title: string
  component: React.ComponentType<any>
  props?: Record<string, any>
  width?: string // e.g., '300px', '400px', 'flex', '30%'
  minMode?: WorkspaceMode // Minimum mode required to show this panel
  collapsible?: boolean
  defaultCollapsed?: boolean
}

/**
 * Page Capability Declaration
 * Each page defines what panels it can render in different modes
 */
export interface PageCapability {
  pageId: string
  displayName: string
  modes: {
    standard: {
      panels: WorkspacePanel[]
      layout: 'single' | 'stacked'
    }
    split: {
      panels: WorkspacePanel[]
      layout: 'grid' | 'flex'
      gridTemplate?: string
    }
    workspace: {
      panels: WorkspacePanel[]
      layout: 'grid' | 'flex'
      gridTemplate?: string
    }
    command: {
      panels: WorkspacePanel[]
      layout: 'grid' | 'flex'
      gridTemplate?: string
    }
  }
  allowUserOverride?: boolean
}

/**
 * Workspace State
 */
export interface WorkspaceState {
  currentMode: WorkspaceMode
  currentTier: ScreenTier
  screenWidth: number
  userOverride: WorkspaceMode | null
  activePanels: string[]
  collapsedPanels: string[]
}

/**
 * Workspace Actions
 */
export interface WorkspaceActions {
  setMode: (mode: WorkspaceMode) => void
  togglePanel: (panelId: string) => void
  collapsePanel: (panelId: string) => void
  expandPanel: (panelId: string) => void
  resetToDefault: () => void
}

/**
 * Workspace Context Value
 */
export interface WorkspaceContextValue {
  state: WorkspaceState
  actions: WorkspaceActions
  capability: PageCapability | null
}
