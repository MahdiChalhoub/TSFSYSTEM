/**
 * WORKSPACE CONTEXT
 * =================
 * Provides workspace state to all components in a page
 */

'use client'

import { createContext, useContext } from 'react'
import type { WorkspaceContextValue, PageCapability } from './types'
import { useWorkspaceLayout } from './useWorkspaceLayout'

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

interface WorkspaceProviderProps {
  pageId: string
  capability: PageCapability
  storageKey?: string
  children: React.ReactNode
}

export function WorkspaceProvider({
  pageId,
  capability,
  storageKey,
  children
}: WorkspaceProviderProps) {
  const workspaceValue = useWorkspaceLayout({
    pageId,
    capability,
    storageKey
  })

  return (
    <WorkspaceContext.Provider value={workspaceValue}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider')
  }
  return context
}
