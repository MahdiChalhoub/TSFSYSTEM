/**
 * WORKSPACE SWITCHER
 * ==================
 * Mode selector with REAL render control
 * Not just CSS hiding - actually changes the layout structure
 */

'use client'

import { useWorkspace } from '@/lib/workspace/WorkspaceContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { WorkspaceMode } from '@/lib/workspace/types'
import {
  Maximize2,
  Columns2,
  Columns3,
  LayoutGrid,
  Monitor,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

const MODE_CONFIG = {
  standard: {
    label: 'Standard',
    icon: Maximize2,
    desc: 'Single view',
    color: 'bg-slate-100 text-slate-700'
  },
  split: {
    label: 'Split',
    icon: Columns2,
    desc: '2-panel workspace',
    color: 'bg-blue-100 text-blue-700'
  },
  workspace: {
    label: 'Workspace',
    icon: Columns3,
    desc: '3-panel 360° view',
    color: 'bg-purple-100 text-purple-700'
  },
  command: {
    label: 'Command',
    icon: LayoutGrid,
    desc: '4-panel command center',
    color: 'bg-emerald-100 text-emerald-700'
  }
} as const

export function WorkspaceSwitcher({ className = '' }: { className?: string }) {
  const { state, actions, capability } = useWorkspace()

  if (!capability) return null

  const handleModeChange = (mode: WorkspaceMode) => {
    // Check if page supports this mode
    if (!capability.modes[mode]) {
      toast.error(`This page doesn't support ${MODE_CONFIG[mode].label} mode`)
      return
    }

    actions.setMode(mode)
    toast.success(`Switched to ${MODE_CONFIG[mode].label} mode`)
  }

  const handleReset = () => {
    actions.resetToDefault()
    toast.success('Reset to automatic mode')
  }

  // Available modes for this page
  const availableModes = Object.keys(capability.modes) as WorkspaceMode[]

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Current Tier Indicator */}
      <div className="flex items-center gap-2">
        <Monitor size={14} className="text-app-muted-foreground" />
        <Badge variant="outline" className="text-xs font-bold">
          {state.currentTier.toUpperCase()}
        </Badge>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-1 bg-app-surface/50 rounded-xl p-1 border border-app-border/30">
        {availableModes.map(mode => {
          const config = MODE_CONFIG[mode]
          const Icon = config.icon
          const isActive = state.currentMode === mode
          const isUserOverride = state.userOverride === mode

          return (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-lg
                text-xs font-bold transition-all
                ${isActive
                  ? 'bg-app-primary text-white shadow-sm'
                  : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface'
                }
              `}
              title={`${config.desc}${isUserOverride ? ' (override)' : ''}`}
            >
              <Icon size={14} />
              <span className="hidden xl:inline">{config.label}</span>
              {isUserOverride && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Manual override active" />
              )}
            </button>
          )
        })}
      </div>

      {/* Reset Button (if user override active) */}
      {state.userOverride && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-9 px-3 text-xs"
          title="Reset to automatic mode"
        >
          <RefreshCw size={12} className="mr-1" />
          Auto
        </Button>
      )}

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-app-muted-foreground ml-2">
          {state.screenWidth}px | {state.activePanels.length} panels
        </div>
      )}
    </div>
  )
}
