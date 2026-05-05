/**
 * WORKSPACE LAYOUT SHELL
 * ======================
 * Renders the actual layout structure based on current mode
 * This is where the REAL layout switching happens
 */

'use client'

import { useWorkspace } from '@/lib/workspace/WorkspaceContext'
import type { WorkspaceMode } from '@/lib/workspace/types'

interface WorkspaceLayoutShellProps {
  children?: React.ReactNode
}

export function WorkspaceLayoutShell({ children }: WorkspaceLayoutShellProps) {
  const { state, capability } = useWorkspace()

  if (!capability) {
    // Fallback to standard single-column layout
    return <div className="max-w-[1400px] mx-auto">{children}</div>
  }

  const modeConfig = capability.modes[state.currentMode]
  if (!modeConfig) {
    return <div className="max-w-[1400px] mx-auto">{children}</div>
  }

  // Get panels for current mode
  const panels = modeConfig.panels.filter(panel =>
    state.activePanels.includes(panel.id) &&
    !state.collapsedPanels.includes(panel.id)
  )

  // Render based on layout type
  if (modeConfig.layout === 'single' || modeConfig.layout === 'stacked') {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6">
        {panels.map(panel => {
          const Component = panel.component
          return (
            <div key={panel.id} className="w-full">
              <Component {...(panel.props || {})} />
            </div>
          )
        })}
      </div>
    )
  }

  if (modeConfig.layout === 'grid') {
    const gridTemplate = modeConfig.gridTemplate || getDefaultGridTemplate(state.currentMode, panels.length)

    // For workspace/command modes, use centered container with max-width
    const isUltraWide = state.currentMode === 'workspace' || state.currentMode === 'command'

    return (
      <div className={isUltraWide ? 'w-full max-w-[1920px] mx-auto px-6' : 'w-full'}>
        <div
          className="grid gap-6 h-[calc(100vh-10rem)]"
          style={{
            gridTemplateColumns: gridTemplate
          }}
        >
          {panels.map((panel, index) => {
            const Component = panel.component
            const isFirstPanel = index === 0
            const isLastPanel = index === panels.length - 1

            return (
              <div
                key={panel.id}
                className={`min-w-0 flex flex-col overflow-hidden ${
                  isFirstPanel ? 'panel-list' :
                  isLastPanel ? 'panel-inspector' :
                  'panel-main'
                }`}
                style={{
                  width: panel.width || 'auto'
                }}
              >
                {/* Panel Header */}
                {panel.title && (
                  <div className="px-4 py-3 border-b border-app-border/30 bg-app-surface/50 shrink-0">
                    <h3 className="text-sm font-bold text-app-foreground">{panel.title}</h3>
                  </div>
                )}

                {/* Panel Content - Independently Scrollable */}
                <div className="flex-1 overflow-auto">
                  <Component {...(panel.props || {})} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (modeConfig.layout === 'flex') {
    return (
      <div className="flex gap-6 max-w-none">
        {panels.map(panel => {
          const Component = panel.component
          const isFixed = panel.width && !panel.width.includes('flex')

          return (
            <div
              key={panel.id}
              className={isFixed ? 'shrink-0' : 'flex-1 min-w-0'}
              style={{
                width: isFixed ? panel.width : undefined
              }}
            >
              <Component {...(panel.props || {})} />
            </div>
          )
        })}
      </div>
    )
  }

  return <div>{children}</div>
}

/**
 * Default grid templates based on mode and panel count
 *
 * DUAL VERIFICATION WORKSPACE PRINCIPLES:
 * - Left panel: 280-320px (list/navigation)
 * - Center-Left: ~40% (System Data - editable, validated)
 * - Center-Right: ~40% (Scanned Document - interactive viewer)
 * - Right panel: 360-420px (Verification Engine - actions/audit)
 * - Never use equal-width columns
 * - Center split enables side-by-side comparison
 */
function getDefaultGridTemplate(mode: WorkspaceMode, panelCount: number): string {
  if (mode === 'split') {
    // SPLIT MODE: List + Main (No inspector)
    if (panelCount === 2) return '320px minmax(800px, 1fr)'
    if (panelCount === 3) return '300px minmax(700px, 1fr) 400px'
    return `repeat(${panelCount}, 1fr)`
  }

  if (mode === 'workspace') {
    // WORKSPACE MODE: DUAL VERIFICATION WORKSPACE
    // Left: list | Center-Left: System Data | Center-Right: Document | Right: Actions
    if (panelCount === 2) return '320px minmax(900px, 1fr)'
    if (panelCount === 3) return '300px 1fr 1fr 380px' // 3 panels = split center + inspector
    if (panelCount === 4) return '300px 1fr 1fr 380px' // DUAL VERIFICATION MODE ⭐
    if (panelCount === 5) return '280px 1fr 1fr 360px 320px'
    return `repeat(${panelCount}, 1fr)`
  }

  if (mode === 'command') {
    // COMMAND MODE: Full Power Verification + Audit
    // List | System Data | Document | Inspector | Audit Drawer
    if (panelCount === 3) return '320px minmax(800px, 1fr) 420px'
    if (panelCount === 4) return '300px 1fr 1fr 400px' // DUAL VERIFICATION ⭐
    if (panelCount === 5) return '280px 1fr 1fr 380px 340px' // + Audit panel
    return `repeat(${panelCount}, 1fr)`
  }

  return `repeat(${panelCount}, 1fr)`
}
