'use client'

/**
 * PO Customize Panel
 * ====================
 * Slide-in sidebar for column/filter visibility management.
 * Uses shared ToggleListPanel and ToggleSwitch from @/components/ui/.
 */

import { useState } from 'react'
import { X, Settings2, Layers, Filter } from 'lucide-react'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { ToggleListPanel } from '@/components/ui/ToggleListPanel'
import { ALL_COLUMNS, ALL_FILTERS, DEFAULT_VISIBLE_COLS, DEFAULT_VISIBLE_FILTERS } from '../_lib/constants'

interface POCustomizePanelProps {
  isOpen: boolean
  onClose: () => void
  visibleColumns: Record<string, boolean>
  setVisibleColumns: (v: Record<string, boolean>) => void
  visibleFilters: Record<string, boolean>
  setVisibleFilters: (v: Record<string, boolean>) => void
  policyHiddenColumns: Set<string>
  policyHiddenFilters: Set<string>
}

const TABS = [
  { key: 'layout' as const, label: 'Layout', icon: <Layers size={12} /> },
  { key: 'filter' as const, label: 'Filters', icon: <Filter size={12} /> },
  { key: 'other' as const, label: 'Other', icon: <Settings2 size={12} /> },
]

export function POCustomizePanel({
  isOpen, onClose, visibleColumns, setVisibleColumns, visibleFilters, setVisibleFilters,
  policyHiddenColumns, policyHiddenFilters,
}: POCustomizePanelProps) {
  const [tab, setTab] = useState<'layout' | 'filter' | 'other'>('layout')
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-app-surface border-l border-app-border shadow-2xl flex flex-col animate-in slide-in-from-right-5 duration-200">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-app-border/50">
          <h3 className="text-sm font-black text-app-foreground">Customize View</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-muted/10 text-app-muted-foreground hover:text-app-foreground transition-all">
            <X size={14} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="px-4 pt-3 pb-1 flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${tab === t.key
                ? 'bg-app-primary text-white shadow-sm'
                : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface'
                }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {tab === 'layout' && (
            <ToggleListPanel
              title="List Columns"
              items={ALL_COLUMNS}
              visibility={visibleColumns}
              hiddenByPolicy={policyHiddenColumns}
              onToggle={key => setVisibleColumns({ ...visibleColumns, [key]: !visibleColumns[key] })}
              onReset={() => setVisibleColumns(DEFAULT_VISIBLE_COLS)}
            />
          )}

          {tab === 'filter' && (
            <ToggleListPanel
              title="Visible Filters"
              items={ALL_FILTERS}
              visibility={visibleFilters}
              hiddenByPolicy={policyHiddenFilters}
              onToggle={key => setVisibleFilters({ ...visibleFilters, [key]: !visibleFilters[key] })}
              onReset={() => setVisibleFilters(DEFAULT_VISIBLE_FILTERS)}
            />
          )}

          {tab === 'other' && (
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block mb-3">Display</span>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-app-surface/60 transition-all">
                    <span className="text-[12px] font-bold text-app-foreground">Default Page Size</span>
                    <span className="text-[11px] font-bold text-app-primary">50</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-app-surface/60 transition-all">
                    <span className="text-[12px] font-bold text-app-foreground">Expand on Click</span>
                    <ToggleSwitch on={true} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-app-border/60 p-3">
                <div className="text-[10px] font-black text-app-primary uppercase tracking-widest mb-1">SaaS Governed</div>
                <p className="text-[10px] text-app-muted-foreground leading-relaxed">
                  Column layouts, filters, and action availability are configurable per-organization from the SaaS admin panel.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-app-border/50">
          <div className="text-[10px] font-bold text-app-muted-foreground text-center">
            {Object.values(visibleColumns).filter(Boolean).length} columns · {Object.values(visibleFilters).filter(Boolean).length} filters
          </div>
        </div>
      </div>
    </>
  )
}
