'use client'

/**
 * Customize Panel — Orchestrator
 * ================================
 * This component now uses the shared CustomizePanel template.
 * Modifying the template in src/components/ui/CustomizePanel/ will update
 * this page and all other pages using it (like Purchase Orders).
 */

import { SlidersHorizontal, Filter, Settings2, Eye, ShoppingCart, ArrowRightLeft, Edit, Download } from 'lucide-react'
import type { ViewProfile, ColumnDef } from '../_lib/types'
import { ALL_COLUMNS, ALL_FILTERS } from '../_lib/constants'
import { saveProfiles, saveActiveProfileId, syncProfileToBackend } from '../_lib/profiles'
import { CustomizePanel as SharedCustomizePanel } from '@/components/ui/CustomizePanel/CustomizePanel'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

interface CustomizePanelProps {
  isOpen: boolean
  onClose: () => void
  visibleColumns: Record<string, boolean>
  setVisibleColumns: (v: Record<string, boolean>) => void
  visibleFilters: Record<string, boolean>
  setVisibleFilters: (v: Record<string, boolean>) => void
  columnOrder: string[]
  setColumnOrder: (order: string[]) => void
  profiles: ViewProfile[]
  setProfiles: (p: ViewProfile[]) => void
  activeProfileId: string
  setActiveProfileId: (id: string) => void
  onShare?: (id: string, shared: boolean) => void
  isStaff?: boolean
  policyHiddenColumns: Set<string>
  policyHiddenFilters: Set<string>
}

export function CustomizePanel({
  isOpen, onClose, visibleColumns, setVisibleColumns, visibleFilters, setVisibleFilters,
  columnOrder, setColumnOrder,
  profiles, setProfiles, activeProfileId, setActiveProfileId, 
  onShare, isStaff,
  policyHiddenColumns, policyHiddenFilters,
}: CustomizePanelProps) {

  /* ── Persistence helpers (delegated to page lib) ── */
  const persistColumns = (next: Record<string, boolean>) => {
    setVisibleColumns(next)
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, columns: next } : p)
    setProfiles(updated); saveProfiles(updated)
    const ap = updated.find(p => p.id === activeProfileId)
    if (ap) syncProfileToBackend(ap)
  }

  const persistFilters = (next: Record<string, boolean>) => {
    setVisibleFilters(next)
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, filters: next } : p)
    setProfiles(updated); saveProfiles(updated)
    const ap = updated.find(p => p.id === activeProfileId)
    if (ap) syncProfileToBackend(ap)
  }

  const persistOrder = (newOrder: string[]) => {
    setColumnOrder(newOrder)
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, columnOrder: newOrder } : p)
    setProfiles(updated); saveProfiles(updated)
    const ap = updated.find(p => p.id === activeProfileId)
    if (ap) syncProfileToBackend(ap)
  }

  const switchProfile = (id: string) => {
    const prof = profiles.find(p => p.id === id)
    if (!prof) return
    setActiveProfileId(id); saveActiveProfileId(id)
    setVisibleColumns(prof.columns); setVisibleFilters(prof.filters)
    setColumnOrder(prof.columnOrder || ALL_COLUMNS.map(c => c.key))
  }

  return (
    <SharedCustomizePanel<string, string>
      isOpen={isOpen}
      onClose={onClose}
      title="Product Manager"
      
      allColumns={ALL_COLUMNS}
      allFilters={ALL_FILTERS}
      
      profiles={profiles as any}
      setProfiles={setProfiles as any}
      activeProfileId={activeProfileId}
      switchProfile={switchProfile}
      
      visibleColumns={visibleColumns}
      visibleFilters={visibleFilters}
      columnOrder={columnOrder}
      
      onToggleColumn={(key) => {
        const next = { ...visibleColumns, [key]: !visibleColumns[key] }
        persistColumns(next)
      }}
      onToggleFilter={(key) => {
        const next = { ...visibleFilters, [key]: !visibleFilters[key] }
        persistFilters(next)
      }}
      onReorderColumns={persistOrder}
      onResetColumns={() => {
        const next: Record<string, boolean> = {}
        ALL_COLUMNS.forEach(c => { next[c.key] = c.defaultVisible })
        persistColumns(next)
        persistOrder(ALL_COLUMNS.map(c => c.key))
      }}
      onResetFilters={() => {
        const next: Record<string, boolean> = {}
        ALL_FILTERS.forEach(f => { next[f.key] = f.defaultVisible })
        persistFilters(next)
      }}
      
      onSaveProfiles={saveProfiles as any}
      onSaveActiveId={saveActiveProfileId}
      onShareProfile={onShare}
      isStaff={isStaff}
      
      otherTabContent={(
        <>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Row Actions</span>
          </div>
          <div className="space-y-0.5">
             {[
               { key: 'view', label: 'View Detail', icon: <Eye size={12} /> },
               { key: 'edit', label: 'Quick Edit', icon: <Edit size={12} /> },
               { key: 'stock', label: 'Stock History', icon: <SlidersHorizontal size={12} /> },
               { key: 'po', label: 'Pipeline', icon: <ShoppingCart size={12} /> },
               { key: 'move', label: 'Movements', icon: <ArrowRightLeft size={12} /> },
               { key: 'export', label: 'Export Data', icon: <Download size={12} /> },
             ].map(opt => (
               <div key={opt.key} className="flex items-center gap-1.5 px-2 py-2 rounded-xl transition-all hover:bg-app-surface/60">
                 <div className="p-1.5 rounded-lg bg-app-surface/50 text-app-muted-foreground">{opt.icon}</div>
                 <span className="flex-1 text-[12px] font-bold text-app-foreground">{opt.label}</span>
                 <ToggleSwitch on={true} />
               </div>
             ))}
          </div>
        </>
      )}
    />
  )
}
