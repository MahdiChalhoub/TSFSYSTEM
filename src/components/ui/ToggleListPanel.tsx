'use client'

/**
 * Toggle List Panel
 * ==================
 * Reusable list of labeled toggle switches with a reset button.
 * Used by both Layout (columns) and Filter tabs in CustomizePanels.
 */

import React from 'react'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

interface ToggleItem {
  key: string
  label: string
}

interface ToggleListPanelProps {
  title: string
  items: ToggleItem[]
  visibility: Record<string, boolean>
  hiddenByPolicy: Set<string>
  onToggle: (key: string) => void
  onReset: () => void
}

export const ToggleListPanel = React.memo(function ToggleListPanel({
  title, items, visibility, hiddenByPolicy, onToggle, onReset,
}: ToggleListPanelProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">{title}</span>
        <button onClick={onReset} className="text-[10px] font-bold text-app-primary hover:underline">Reset</button>
      </div>
      <div className="space-y-1">
        {items.filter(item => !hiddenByPolicy.has(item.key)).map(item => (
          <button key={item.key} type="button" onClick={() => onToggle(item.key)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-app-surface/60 transition-all">
            <span className={`text-[12px] font-bold ${visibility[item.key] ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>
              {item.label}
            </span>
            <ToggleSwitch on={!!visibility[item.key]} />
          </button>
        ))}
      </div>
    </div>
  )
})
