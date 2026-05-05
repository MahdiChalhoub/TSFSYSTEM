/**
 * 🎨 UNIFIED DESIGN ENGINE SWITCHER
 * ==================================
 * Single component to change EVERYTHING:
 * - Colors & theme
 * - Layout & spacing
 * - Components (buttons, cards, inputs)
 * - Sidebar & navigation
 * - Typography
 *
 * Instead of switching Layout + Theme separately,
 * users now select ONE design preset!
 */
"use client"

import React from 'react'
import { useDesignEngine, type DesignPresetId } from '@/contexts/DesignEngineContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Palette, Check, Sparkles } from 'lucide-react'

interface DesignEngineSwitcherProps {
  className?: string
  showLabel?: boolean
}

export function DesignEngineSwitcher({ className, showLabel = true }: DesignEngineSwitcherProps) {
  const { preset, config, setPreset, presetsByCategory } = useDesignEngine()
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <Palette className="h-4 w-4" />
        {showLabel && <span>{config.name}</span>}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-[500px] max-h-[600px] rounded-[var(--card-radius)] border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-lg z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--bg-app-bg)]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--theme-primary)]" />
                <h3 className="text-[var(--)]">
                  Design Engine
                </h3>
              </div>
              <p className="text-xs text-[var(--text-app-muted-foreground)] mt-1">
                Choose a design preset that controls colors, layout, components, and sidebar
              </p>
            </div>

            {/* Preset List - Grouped by Category */}
            <div className="max-h-[500px] overflow-y-auto p-3">
              {Object.entries(presetsByCategory).map(([category, presets]) => (
                <div key={category} className="mb-4">
                  {/* Category Header */}
                  <h4 className="text-xs font-semibold text-[var(--text-app-muted-foreground)] uppercase tracking-wider mb-2 px-1">
                    {category}
                  </h4>

                  {/* Presets in Category */}
                  <div className="space-y-2">
                    {presets.map((presetOption) => (
                      <PresetOption
                        key={presetOption.id}
                        presetOption={presetOption}
                        isActive={preset === presetOption.id}
                        onClick={() => {
                          setPreset(presetOption.id)
                          setIsOpen(false)
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface PresetOptionProps {
  presetOption: {
    id: DesignPresetId
    name: string
    description: string
    category: string
    colors: {
      mode: string
      primary: string
      bg: string
      surface: string
      text: string
    }
    layout: {
      density: string
      structure: string
    }
    navigation: {
      position: string
    }
    bestFor: string[]
  }
  isActive: boolean
  onClick: () => void
}

function PresetOption({ presetOption, isActive, onClick }: PresetOptionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-3 rounded-[var(--card-radius)] border-2 transition-all text-left',
        isActive
          ? 'border-[var(--theme-primary)] bg-[var(--theme-surface-hover)]'
          : 'border-[var(--theme-border)] hover:border-[var(--theme-primary)]/50 hover:bg-[var(--theme-surface-hover)]'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Color Preview */}
        <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden border border-[var(--theme-border)]"
             style={{ backgroundColor: presetOption.colors.surface }}>
          <div className="w-full h-2/3" style={{ backgroundColor: presetOption.colors.bg }}></div>
          <div className="w-full h-1/3 flex items-center justify-center">
            <div className="w-6 h-1 rounded-full" style={{ backgroundColor: presetOption.colors.primary }}></div>
          </div>
        </div>

        {/* Preset Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--text-app-foreground)]">
              {presetOption.name}
            </h4>
            {isActive && (
              <Check className="h-4 w-4 text-[var(--theme-primary)] flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-[var(--text-app-muted-foreground)] mt-0.5">
            {presetOption.description}
          </p>

          {/* Characteristics */}
          <div className="flex gap-2 mt-1.5 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--theme-surface)] text-[var(--text-app-muted-foreground)] border border-[var(--theme-border)]">
              {presetOption.colors.mode}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--theme-surface)] text-[var(--text-app-muted-foreground)] border border-[var(--theme-border)]">
              {presetOption.layout.density}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--theme-surface)] text-[var(--text-app-muted-foreground)] border border-[var(--theme-border)]">
              {presetOption.navigation.position === 'hidden' ? 'fullscreen' : presetOption.navigation.position}
            </span>
          </div>

          {/* Best For */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {presetOption.bestFor.slice(0, 4).map((use) => (
              <span
                key={use}
                className="text-xs px-1.5 py-0.5 rounded bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]"
              >
                {use}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}

// Compact version for tight spaces
export function DesignEngineSwitcherCompact({ className }: { className?: string }) {
  return <DesignEngineSwitcher className={className} showLabel={false} />
}

// Quick preset buttons for common choices
export function QuickDesignPresets({ className }: { className?: string }) {
  const { preset, setPreset } = useDesignEngine()

  const quickPresets: { id: DesignPresetId; label: string; icon: string }[] = [
    { id: 'corporate-minimal', label: 'Corporate', icon: '💼' },
    { id: 'finance-pro', label: 'Finance', icon: '💰' },
    { id: 'creative-purple', label: 'Creative', icon: '🎨' },
    { id: 'dashboard-compact', label: 'Compact', icon: '📊' },
    { id: 'pos-fullscreen', label: 'POS', icon: '🛒' },
  ]

  return (
    <div className={cn('flex gap-2', className)}>
      {quickPresets.map((p) => (
        <Button
          key={p.id}
          size="sm"
          variant={preset === p.id ? 'default' : 'outline'}
          onClick={() => setPreset(p.id)}
          className="gap-2"
        >
          <span>{p.icon}</span>
          <span>{p.label}</span>
        </Button>
      ))}
    </div>
  )
}
