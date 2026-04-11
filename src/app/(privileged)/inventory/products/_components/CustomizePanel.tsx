'use client'

/**
 * Customize Panel — Orchestrator
 * ================================
 * Slide-in sidebar for column/filter visibility, column ordering,
 * and view profile management.
 * 
 * UPDATED: April 2026
 * Added drag-and-drop column reordering in the Layout tab.
 */

import { useState, useRef, useMemo } from 'react'
import {
  X, SlidersHorizontal, Filter, Settings2,
  Eye, ShoppingCart, ArrowRightLeft, Edit, Download,
  GripVertical,
} from 'lucide-react'
import type { ViewProfile, ColumnDef } from '../_lib/types'
import { ALL_COLUMNS, ALL_FILTERS, DEFAULT_VISIBLE_COLS, DEFAULT_VISIBLE_FILTERS } from '../_lib/constants'
import { saveProfiles, saveActiveProfileId, syncProfileToBackend } from '../_lib/profiles'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { ToggleListPanel } from '@/components/ui/ToggleListPanel'
import { ProfileManager } from './customize/ProfileManager'

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
  policyHiddenColumns: Set<string>
  policyHiddenFilters: Set<string>
}

const TABS = [
  { key: 'layout' as const, label: 'Layout', icon: <SlidersHorizontal size={12} /> },
  { key: 'filter' as const, label: 'Filter', icon: <Filter size={12} /> },
  { key: 'other' as const, label: 'Other', icon: <Settings2 size={12} /> },
]

export function CustomizePanel({
  isOpen, onClose, visibleColumns, setVisibleColumns, visibleFilters, setVisibleFilters,
  columnOrder, setColumnOrder,
  profiles, setProfiles, activeProfileId, setActiveProfileId, policyHiddenColumns, policyHiddenFilters,
}: CustomizePanelProps) {
  const [customizeTab, setCustomizeTab] = useState<'layout' | 'filter' | 'other'>('layout')

  if (!isOpen) return null

  /* ── Profile persistence helpers ── */
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

  const activeProfile = profiles.find(p => p.id === activeProfileId)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-[60] animate-in fade-in duration-150" onClick={onClose} />
      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[340px] z-[61] flex flex-col animate-in slide-in-from-right duration-200"
        style={{ background: 'var(--app-bg)', borderLeft: '1px solid var(--app-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border/50">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-app-primary" />
            <span className="text-[13px] font-black text-app-foreground">Customize View</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-surface transition-colors text-app-muted-foreground hover:text-app-foreground">
            <X size={14} />
          </button>
        </div>

        {/* Profile Selector */}
        <ProfileManager
          profiles={profiles}
          setProfiles={setProfiles}
          activeProfileId={activeProfileId}
          switchProfile={switchProfile}
          visibleColumns={visibleColumns}
          visibleFilters={visibleFilters}
        />

        {/* Tab Bar */}
        <div className="px-4 pt-3 pb-1 flex gap-1">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setCustomizeTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${customizeTab === tab.key
                ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">

          {/* ═══ LAYOUT TAB ═══ */}
          {customizeTab === 'layout' && (
            <DraggableColumnList
              columnOrder={columnOrder}
              visibleColumns={visibleColumns}
              policyHiddenColumns={policyHiddenColumns}
              onToggle={key => persistColumns({ ...visibleColumns, [key]: !visibleColumns[key] })}
              onReorder={persistOrder}
              onReset={() => {
                persistColumns(DEFAULT_VISIBLE_COLS)
                persistOrder(ALL_COLUMNS.map(c => c.key))
              }}
            />
          )}

          {/* ═══ FILTER TAB ═══ */}
          {customizeTab === 'filter' && (
            <ToggleListPanel
              title="Visible Filters"
              items={ALL_FILTERS}
              visibility={visibleFilters}
              hiddenByPolicy={policyHiddenFilters}
              onToggle={key => persistFilters({ ...visibleFilters, [key]: !visibleFilters[key] })}
              onReset={() => persistFilters(DEFAULT_VISIBLE_FILTERS)}
            />
          )}

          {/* ═══ OTHER TAB ═══ */}
          {customizeTab === 'other' && (
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block mb-3">Row Actions</span>
                <p className="text-[10px] text-app-muted-foreground mb-3">Choose which actions appear directly on each row. Others will be in the &quot;⋯&quot; dropdown.</p>
                <div className="space-y-1">
                  {[
                    { key: 'view', label: 'View Details', icon: <Eye size={12} className="text-app-primary" />, role: 'Primary' },
                    { key: 'purchase', label: 'Request Purchase', icon: <ShoppingCart size={12} className="text-app-info" />, role: 'Dropdown' },
                    { key: 'transfer', label: 'Request Transfer', icon: <ArrowRightLeft size={12} className="text-app-warning" />, role: 'Dropdown' },
                    { key: 'edit', label: 'Edit Product', icon: <Edit size={12} className="text-app-muted-foreground" />, role: 'Dropdown' },
                  ].map(action => (
                    <div key={action.key} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-app-surface/60 transition-all">
                      <div className="flex items-center gap-2">{action.icon}<span className="text-[12px] font-bold text-app-foreground">{action.label}</span></div>
                      <span className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider">{action.role}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block mb-3">Bulk Actions</span>
                <div className="space-y-1">
                  {[
                    { label: 'Request Purchase', icon: <ShoppingCart size={12} className="text-app-info" /> },
                    { label: 'Request Transfer', icon: <ArrowRightLeft size={12} className="text-app-warning" /> },
                    { label: 'Export', icon: <Download size={12} className="text-app-muted-foreground" /> },
                  ].map(action => (
                    <div key={action.label} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-app-surface/60 transition-all">
                      <div className="flex items-center gap-2">{action.icon}<span className="text-[12px] font-bold text-app-foreground">{action.label}</span></div>
                      <ToggleSwitch on={true} />
                    </div>
                  ))}
                </div>
              </div>
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
                  Column layouts, filters, and action availability will be configurable per-organization from the SaaS admin panel.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-app-border/50">
          <div className="text-[10px] font-bold text-app-muted-foreground text-center">
            {activeProfile?.name} · {Object.values(visibleColumns).filter(Boolean).length} columns · {Object.values(visibleFilters).filter(Boolean).length} filters
          </div>
        </div>
      </div>
    </>
  )
}


/* ═══════════════════════════════════════════════════════════
 *  DRAGGABLE COLUMN LIST
 *  Drag-and-drop reordering + toggle visibility
 * ═══════════════════════════════════════════════════════════ */

function DraggableColumnList({
  columnOrder, visibleColumns, policyHiddenColumns,
  onToggle, onReorder, onReset,
}: {
  columnOrder: string[]
  visibleColumns: Record<string, boolean>
  policyHiddenColumns: Set<string>
  onToggle: (key: string) => void
  onReorder: (order: string[]) => void
  onReset: () => void
}) {
  const dragRef = useRef<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  // Derive ordered column defs
  const orderedCols = useMemo(() => {
    const colMap = new Map(ALL_COLUMNS.map(c => [c.key, c]))
    const seen = new Set<string>()
    const result: ColumnDef[] = []
    for (const key of columnOrder) {
      const col = colMap.get(key)
      if (col && !seen.has(key)) { result.push(col); seen.add(key) }
    }
    for (const col of ALL_COLUMNS) {
      if (!seen.has(col.key)) result.push(col)
    }
    return result
  }, [columnOrder])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">List Columns</span>
        <button onClick={onReset} className="text-[10px] font-bold text-app-primary hover:underline">Reset</button>
      </div>
      <p className="text-[10px] text-app-muted-foreground mb-3">
        Toggle visibility and <strong>drag</strong> the grip handle to reorder columns.
      </p>
      <div className="space-y-0.5">
        {orderedCols.filter(col => !policyHiddenColumns.has(col.key)).map(col => {
          const isOn = !!visibleColumns[col.key]
          const isDragTarget = dragOver === col.key
          return (
            <div
              key={col.key}
              className={`flex items-center gap-1.5 px-2 py-2 rounded-xl transition-all ${isDragTarget ? 'ring-2 ring-app-primary/40 bg-app-primary/5' : 'hover:bg-app-surface/60'}`}
              draggable
              onDragStart={() => { dragRef.current = col.key }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
              onDragLeave={() => { if (dragOver === col.key) setDragOver(null) }}
              onDrop={() => {
                setDragOver(null)
                if (!dragRef.current || dragRef.current === col.key) return
                const newOrder = [...columnOrder]
                const fromIdx = newOrder.indexOf(dragRef.current)
                const toIdx = newOrder.indexOf(col.key)
                if (fromIdx < 0 || toIdx < 0) return
                newOrder.splice(fromIdx, 1)
                newOrder.splice(toIdx, 0, dragRef.current)
                onReorder(newOrder)
                dragRef.current = null
              }}
              onDragEnd={() => { dragRef.current = null; setDragOver(null) }}
            >
              {/* Grip handle */}
              <div className="cursor-grab active:cursor-grabbing text-app-muted-foreground hover:text-app-foreground flex-shrink-0">
                <GripVertical size={14} />
              </div>
              {/* Label — clicking toggles visibility */}
              <button type="button" onClick={() => onToggle(col.key)} className="flex-1 text-left min-w-0">
                <span className={`text-[12px] font-bold ${isOn ? 'text-app-foreground' : 'text-app-muted-foreground line-through opacity-60'}`}>
                  {col.label}
                </span>
              </button>
              {/* Toggle */}
              <div className="flex-shrink-0" onClick={() => onToggle(col.key)}>
                <ToggleSwitch on={isOn} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
