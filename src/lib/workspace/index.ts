/**
 * WORKSPACE SYSTEM - PUBLIC API
 * ==============================
 * Export everything needed to use the workspace system
 */

// Types
export type {
  WorkspaceMode,
  ScreenTier,
  WorkspacePanel as WorkspacePanelConfig,
  PageCapability,
  WorkspaceState,
  WorkspaceActions,
  WorkspaceContextValue
} from './types'

export { SCREEN_TIERS } from './types'

// Hooks
export { useWorkspaceLayout } from './useWorkspaceLayout'
export { useWorkspace, WorkspaceProvider } from './WorkspaceContext'

// Components (re-export from components folder)
export { WorkspaceLayoutShell } from '@/components/workspace/WorkspaceLayoutShell'
export { WorkspacePanel } from '@/components/workspace/WorkspacePanel'
export { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher'
