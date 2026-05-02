'use client'

import { useState } from 'react'
import { Settings2, X, SlidersHorizontal, Filter } from 'lucide-react'
import { ProfileManager } from './ProfileManager'
import { DraggableColumnList } from './DraggableColumnList'
import { FilterList } from './FilterList'
import type { ColumnDef, FilterDef, ViewProfile } from './types'

interface CustomizePanelProps<CK extends string = string, FK extends string = string> {
  isOpen: boolean
  onClose: () => void
  title?: string
  
  // Data
  allColumns: ColumnDef<CK>[]
  allFilters?: FilterDef<FK>[]
  
  // State
  profiles: ViewProfile<CK>[]
  setProfiles: (p: ViewProfile<CK>[]) => void
  activeProfileId: string
  switchProfile: (id: string) => void
  
  // Visibility & Order
  visibleColumns: Record<CK, boolean>
  visibleFilters?: Record<FK, boolean>
  columnOrder: CK[]
  
  // Handlers
  onToggleColumn: (key: CK) => void
  onToggleFilter?: (key: FK) => void
  onReorderColumns: (order: CK[]) => void
  onResetColumns: () => void
  onResetFilters?: () => void
  
  // Persistence Helpers
  onSaveProfiles: (p: ViewProfile<CK>[]) => void
  onSaveActiveId: (id: string) => void
  
  footerContent?: React.ReactNode
  otherTabContent?: React.ReactNode
}

const TABS = [
  { key: 'layout' as const, label: 'Layout', icon: <SlidersHorizontal size={12} /> },
  { key: 'filter' as const, label: 'Filter', icon: <Filter size={12} /> },
  { key: 'other' as const, label: 'Other', icon: <Settings2 size={12} /> },
]

export function CustomizePanel<CK extends string, FK extends string>({
  isOpen, onClose, title = "Customize View",
  allColumns, allFilters,
  profiles, setProfiles, activeProfileId, switchProfile,
  visibleColumns, visibleFilters, columnOrder,
  onToggleColumn, onToggleFilter, onReorderColumns, onResetColumns, onResetFilters,
  onSaveProfiles, onSaveActiveId,
  footerContent, otherTabContent
}: CustomizePanelProps<CK, FK>) {
  const [activeTab, setActiveTab] = useState<'layout' | 'filter' | 'other'>('layout')

  if (!isOpen) return null

  const activeProfile = profiles.find(p => p.id === activeProfileId)
  const visibleCount = allColumns.filter(c => visibleColumns[c.key]).length

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-[60] animate-in fade-in duration-150" 
        onClick={onClose} 
      />
      
      {/* Panel */}
      <div 
        className="fixed right-0 top-0 bottom-0 w-[340px] max-w-full z-[61] flex flex-col animate-in slide-in-from-right duration-200 shadow-2xl"
        style={{ background: 'var(--app-bg, var(--app-surface))', borderLeft: '1px solid var(--app-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border/50">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-app-primary" />
            <span className="text-[13px] font-black text-app-foreground uppercase tracking-tight">{title}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-surface transition-colors text-app-muted-foreground hover:text-app-foreground">
            <X size={14} />
          </button>
        </div>

        {/* Profile Manager */}
        <ProfileManager
          profiles={profiles as any}
          setProfiles={setProfiles as any}
          activeProfileId={activeProfileId}
          switchProfile={switchProfile}
          currentColumns={visibleColumns}
          currentFilters={visibleFilters}
          currentOrder={columnOrder}
          onSaveProfiles={onSaveProfiles as any}
          onSaveActiveId={onSaveActiveId}
        />

        {/* Tabs */}
        <div className="flex p-1 gap-1 border-b border-app-border/30 bg-app-surface/30">
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            if (tab.key === 'filter' && !allFilters) return null
            if (tab.key === 'other' && !otherTabContent) return null

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-app-surface text-app-primary shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface/50'}`}
              >
                {tab.icon} {tab.label}
              </button>
            )
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {activeTab === 'layout' && (
            <DraggableColumnList
              allColumns={allColumns as any}
              columnOrder={columnOrder}
              visibleColumns={visibleColumns}
              onToggle={onToggleColumn as any}
              onReorder={onReorderColumns as any}
              onReset={onResetColumns}
            />
          )}

          {activeTab === 'filter' && allFilters && visibleFilters && onToggleFilter && (
            <FilterList
              allFilters={allFilters as any}
              visibleFilters={visibleFilters}
              onToggle={onToggleFilter as any}
              onReset={onResetFilters || (() => {})}
            />
          )}

          {activeTab === 'other' && otherTabContent && (
            <div className="space-y-4">
              {otherTabContent}
            </div>
          )}
          
          {/* SaaS Governance Notice */}
          <div className="rounded-xl border border-dashed border-app-border/60 p-3 mt-6">
            <div className="text-[10px] font-black text-app-primary uppercase tracking-widest mb-1">SaaS Governed</div>
            <p className="text-[10px] text-app-muted-foreground leading-relaxed">
              Column layouts and profiles are saved per-user and per-organization. SaaS-level policies coming soon.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-app-border/50">
          {footerContent ? footerContent : (
            <div className="text-[10px] font-bold text-app-muted-foreground text-center">
              {activeProfile?.name} · {visibleCount} / {allColumns.length} columns visible
            </div>
          )}
        </div>
      </div>
    </>
  )
}
