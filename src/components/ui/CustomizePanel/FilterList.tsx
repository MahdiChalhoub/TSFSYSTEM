'use client'

import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import type { FilterDef } from './types'

interface FilterListProps {
  allFilters: FilterDef[]
  visibleFilters: Record<string, boolean>
  onToggle: (key: string) => void
  onReset: () => void
}

export function FilterList({
  allFilters, visibleFilters, onToggle, onReset,
}: FilterListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Available Filters</span>
        <button onClick={onReset} className="text-[10px] font-bold text-app-primary hover:underline">Reset</button>
      </div>
      <p className="text-[10px] text-app-muted-foreground mb-3">
        Select which filter cards appear in the sidebar for quick access.
      </p>
      <div className="space-y-0.5">
        {allFilters.map(f => {
          const isOn = !!visibleFilters[f.key]
          return (
            <div
              key={f.key}
              className="flex items-center gap-1.5 px-2 py-2 rounded-xl transition-all hover:bg-app-surface/60"
            >
              <button type="button" onClick={() => onToggle(f.key)} className="flex-1 text-left min-w-0">
                <span className={`text-[12px] font-bold ${isOn ? 'text-app-foreground' : 'text-app-muted-foreground line-through opacity-60'}`}>
                  {f.label}
                </span>
              </button>
              <div className="flex-shrink-0 cursor-pointer" onClick={() => onToggle(f.key)}>
                <ToggleSwitch on={isOn} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
