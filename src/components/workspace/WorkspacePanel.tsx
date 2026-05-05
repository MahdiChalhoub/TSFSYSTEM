/**
 * WORKSPACE PANEL
 * ===============
 * Individual panel container with optional collapse/expand
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace/WorkspaceContext'

interface WorkspacePanelProps {
  id: string
  title?: string
  icon?: React.ReactNode
  collapsible?: boolean
  children: React.ReactNode
  className?: string
  headerActions?: React.ReactNode
}

export function WorkspacePanel({
  id,
  title,
  icon,
  collapsible = false,
  children,
  className = '',
  headerActions
}: WorkspacePanelProps) {
  const { state, actions } = useWorkspace()

  const isCollapsed = state.collapsedPanels.includes(id)

  const handleToggleCollapse = () => {
    actions.togglePanel(id)
  }

  if (isCollapsed && collapsible) {
    // Collapsed state - show minimal sidebar
    return (
      <div className={`flex flex-col items-center gap-4 p-4 border-r border-app-border/30 ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleCollapse}
          className="w-10 h-10 p-0 rounded-xl"
        >
          <ChevronRight size={16} />
        </Button>
        {icon && (
          <div className="text-app-muted-foreground">
            {icon}
          </div>
        )}
        {title && (
          <div
            className="writing-mode-vertical-rl text-xs font-bold text-app-muted-foreground uppercase tracking-wider"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {title}
          </div>
        )}
      </div>
    )
  }

  // Expanded state
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {(title || collapsible || headerActions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border/30 bg-app-surface/50">
          <div className="flex items-center gap-2">
            {icon}
            {title && (
              <h3>{title}</h3>
            )}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleCollapse}
                className="h-8 w-8 p-0"
                title="Collapse panel"
              >
                <ChevronLeft size={14} />
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
