// @ts-nocheck
'use client'

/**
 * DajingoCustomizePanel — Universal Customize View
 * ==================================================
 * Exact copy of the Products CustomizePanel architecture,
 * but fully parameterized — accepts columns, filters, etc. as props.
 *
 * Features:
 *  - View Profiles (create/rename/duplicate/delete — up to 10)
 *  - Layout tab: drag-and-drop column reorder + toggle visibility
 *  - Filter tab: toggle filter visibility
 *  - Other tab: SaaS governance info + display settings
 *  - localStorage persistence per module
 */

import React, { useState, useRef, useMemo, useEffect } from 'react'
import {
  X, SlidersHorizontal, Filter, Settings2,
  GripVertical, Plus, Edit, Trash2, Copy, Save,
} from 'lucide-react'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { ToggleListPanel } from '@/components/ui/ToggleListPanel'
import type { DajingoColumnDef } from './DajingoListView'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */

export type DajingoViewProfile = {
  id: string
  name: string
  columns: Record<string, boolean>
  filters: Record<string, boolean>
  columnOrder?: string[]
}

export type DajingoFilterDef = { key: string; label: string; defaultVisible: boolean }

/* ═══════════════════════════════════════════════════════════
 *  PROFILE PERSISTENCE — Dual-write (localStorage + backend)
 *
 *  Strategy (matches useListViewSettings pattern):
 *    1. localStorage — instant client-side feedback
 *    2. Backend write-through — debounced 1.2s saveUserListPreference()
 *    3. Backend load on mount — getUserListPreference() hydrates profiles
 *       Backend wins if source !== 'default'
 * ═══════════════════════════════════════════════════════════ */

const MAX_PROFILES = 10

function profileStorageKey(moduleKey: string) { return `dajingo_profiles_${moduleKey}` }
function activeProfileStorageKey(moduleKey: string) { return `dajingo_active_profile_${moduleKey}` }

/** Convert module key to backend list_key format */
function toListKey(moduleKey: string): string {
  return moduleKey.replace(/_/g, '.')
}

export function loadDajingoProfiles(moduleKey: string, defaultCols: Record<string, boolean>, defaultFilters: Record<string, boolean>, defaultOrder: string[]): DajingoViewProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(profileStorageKey(moduleKey))
    if (raw) {
      const profiles = JSON.parse(raw) as DajingoViewProfile[]
      // Backfill missing columnOrder
      return profiles.map(p => ({ ...p, columnOrder: p.columnOrder || defaultOrder }))
    }
  } catch { /* noop */ }
  return [{ id: 'default', name: 'Default', columns: defaultCols, filters: defaultFilters, columnOrder: defaultOrder }]
}

export function saveDajingoProfiles(moduleKey: string, profiles: DajingoViewProfile[]) {
  if (typeof window === 'undefined') return
  // ── 1. Instant localStorage write ──
  try { localStorage.setItem(profileStorageKey(moduleKey), JSON.stringify(profiles)) } catch { /* noop */ }
  // ── 2. Debounced backend write-through ──
  scheduleBackendSync(moduleKey)
}

export function loadDajingoActiveProfileId(moduleKey: string): string {
  if (typeof window === 'undefined') return 'default'
  return localStorage.getItem(activeProfileStorageKey(moduleKey)) || 'default'
}

export function saveDajingoActiveProfileId(moduleKey: string, id: string) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(activeProfileStorageKey(moduleKey), id) } catch { /* noop */ }
  // ── Backend sync ──
  scheduleBackendSync(moduleKey)
}

/* ── Debounced backend sync engine ── */
const _syncTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function scheduleBackendSync(moduleKey: string) {
  if (_syncTimers[moduleKey]) clearTimeout(_syncTimers[moduleKey])
  _syncTimers[moduleKey] = setTimeout(async () => {
    try {
      const { saveUserListPreference } = await import('@/app/actions/list-preferences')
      const listKey = toListKey(moduleKey)
      const profiles = loadDajingoProfiles(moduleKey, {}, {}, [])
      const activeId = loadDajingoActiveProfileId(moduleKey)
      const activeProfile = profiles.find(p => p.id === activeId) || profiles[0]

      await saveUserListPreference(listKey, {
        visible_columns: activeProfile
          ? (activeProfile.columnOrder || []).filter(k => activeProfile.columns[k] !== false)
          : [],
        default_filters: activeProfile?.filters || {},
        view_profiles: profiles,
        active_profile_id: activeId,
      })
    } catch { /* silent — localStorage is fallback */ }
  }, 1200) // 1.2s debounce
}

/**
 * Load profiles from backend — called once on first panel open.
 * If the backend has profiles (source !== 'default'), they override localStorage.
 */
export async function hydrateProfilesFromBackend(
  moduleKey: string,
  defaultCols: Record<string, boolean>,
  defaultFilters: Record<string, boolean>,
  defaultOrder: string[],
): Promise<{ profiles: DajingoViewProfile[]; activeId: string } | null> {
  try {
    const { getUserListPreference } = await import('@/app/actions/list-preferences')
    const listKey = toListKey(moduleKey)
    const pref = await getUserListPreference(listKey)
    if (!pref || pref.source === 'default') return null

    const backendProfiles = (pref.view_profiles || []) as DajingoViewProfile[]
    if (backendProfiles.length === 0) return null

    // Backfill column orders
    const hydrated = backendProfiles.map(p => ({
      ...p,
      columnOrder: p.columnOrder || defaultOrder,
      columns: { ...defaultCols, ...p.columns },
      filters: { ...defaultFilters, ...p.filters },
    }))

    // Write to localStorage for instant access
    try { localStorage.setItem(profileStorageKey(moduleKey), JSON.stringify(hydrated)) } catch { /* noop */ }
    const activeId = pref.active_profile_id || 'default'
    try { localStorage.setItem(activeProfileStorageKey(moduleKey), activeId) } catch { /* noop */ }

    return { profiles: hydrated, activeId }
  } catch { return null }
}


/* ═══════════════════════════════════════════════════════════
 *  MAIN PANEL
 * ═══════════════════════════════════════════════════════════ */

interface DajingoCustomizePanelProps {
  isOpen: boolean
  onClose: () => void

  /* Column definitions — from DajingoListView */
  columns: DajingoColumnDef[]
  visibleColumns: Record<string, boolean>
  setVisibleColumns: (v: Record<string, boolean>) => void
  columnOrder: string[]
  setColumnOrder: (order: string[]) => void
  policyHiddenColumns?: Set<string>

  /* Filter definitions — optional, for Filter tab */
  allFilters?: DajingoFilterDef[]
  visibleFilters?: Record<string, boolean>
  setVisibleFilters?: (v: Record<string, boolean>) => void
  policyHiddenFilters?: Set<string>

  /* Module key for localStorage profiles */
  moduleKey?: string
  entityLabel?: string
}

const TABS = [
  { key: 'layout' as const, label: 'Layout', icon: <SlidersHorizontal size={12} /> },
  { key: 'filter' as const, label: 'Filter', icon: <Filter size={12} /> },
  { key: 'other' as const, label: 'Other', icon: <Settings2 size={12} /> },
]

export function DajingoCustomizePanel({
  isOpen, onClose,
  columns, visibleColumns, setVisibleColumns,
  columnOrder, setColumnOrder, policyHiddenColumns,
  allFilters, visibleFilters, setVisibleFilters, policyHiddenFilters,
  moduleKey, entityLabel = 'Item',
}: DajingoCustomizePanelProps) {
  const [customizeTab, setCustomizeTab] = useState<'layout' | 'filter' | 'other'>('layout')
  const mKey = moduleKey || entityLabel.toLowerCase().replace(/\s+/g, '_')

  // ── Profile state ──
  const defaultCols = Object.fromEntries(columns.map(c => [c.key, c.defaultVisible]))
  const defaultFilters = allFilters ? Object.fromEntries(allFilters.map(f => [f.key, f.defaultVisible])) : {}
  const defaultOrder = columns.map(c => c.key)

  const [profiles, setProfiles] = useState<DajingoViewProfile[]>(() => loadDajingoProfiles(mKey, defaultCols, defaultFilters, defaultOrder))
  const [activeProfileId, setActiveProfileId] = useState(() => loadDajingoActiveProfileId(mKey))
  const [hydrated, setHydrated] = useState(false)

  // ── Backend hydration: load profiles from server on first mount ──
  useEffect(() => {
    if (hydrated) return
    setHydrated(true)
    hydrateProfilesFromBackend(mKey, defaultCols, defaultFilters, defaultOrder).then(result => {
      if (!result) return
      setProfiles(result.profiles)
      setActiveProfileId(result.activeId)
      // Apply the active profile's settings to the view
      const activeProf = result.profiles.find(p => p.id === result.activeId) || result.profiles[0]
      if (activeProf) {
        setVisibleColumns(activeProf.columns)
        setColumnOrder(activeProf.columnOrder || defaultOrder)
        if (setVisibleFilters) setVisibleFilters(activeProf.filters)
      }
    })
  }, [mKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const phc = policyHiddenColumns || new Set<string>()
  const phf = policyHiddenFilters || new Set<string>()

  if (!isOpen) return null

  /* ── Profile persistence helpers ── */
  const persistColumns = (next: Record<string, boolean>) => {
    setVisibleColumns(next)
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, columns: next } : p)
    setProfiles(updated); saveDajingoProfiles(mKey, updated)
  }

  const persistFilters = (next: Record<string, boolean>) => {
    if (setVisibleFilters) setVisibleFilters(next)
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, filters: next } : p)
    setProfiles(updated); saveDajingoProfiles(mKey, updated)
  }

  const persistOrder = (newOrder: string[]) => {
    setColumnOrder(newOrder)
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, columnOrder: newOrder } : p)
    setProfiles(updated); saveDajingoProfiles(mKey, updated)
  }

  const switchProfile = (id: string) => {
    const prof = profiles.find(p => p.id === id)
    if (!prof) return
    setActiveProfileId(id); saveDajingoActiveProfileId(mKey, id)
    setVisibleColumns(prof.columns)
    if (setVisibleFilters) setVisibleFilters(prof.filters)
    setColumnOrder(prof.columnOrder || defaultOrder)
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
        <DajingoProfileManager
          profiles={profiles}
          setProfiles={setProfiles}
          activeProfileId={activeProfileId}
          switchProfile={switchProfile}
          visibleColumns={visibleColumns}
          visibleFilters={visibleFilters || defaultFilters}
          moduleKey={mKey}
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
              columns={columns}
              columnOrder={columnOrder}
              visibleColumns={visibleColumns}
              policyHiddenColumns={phc}
              onToggle={key => {
                const col = columns.find(c => c.key === key)
                if (!col) return
                const isOn = col.defaultVisible ? visibleColumns[key] !== false : !!visibleColumns[key]
                persistColumns({ ...visibleColumns, [key]: !isOn })
              }}
              onReorder={persistOrder}
              onReset={() => {
                persistColumns(defaultCols)
                persistOrder(defaultOrder)
              }}
            />
          )}

          {/* ═══ FILTER TAB ═══ */}
          {customizeTab === 'filter' && (
            allFilters && allFilters.length > 0 ? (
              <ToggleListPanel
                title="Visible Filters"
                items={allFilters}
                visibility={visibleFilters || defaultFilters}
                hiddenByPolicy={phf}
                onToggle={key => persistFilters({ ...(visibleFilters || defaultFilters), [key]: !(visibleFilters || defaultFilters)[key] })}
                onReset={() => persistFilters(defaultFilters)}
              />
            ) : (
              <div className="text-center py-8">
                <Filter size={24} className="mx-auto text-app-muted-foreground/40 mb-2" />
                <p className="text-[11px] font-bold text-app-muted-foreground">No custom filters defined</p>
                <p className="text-[10px] text-app-muted-foreground/60 mt-1">This module uses the toolbar search for filtering.</p>
              </div>
            )
          )}

          {/* ═══ OTHER TAB ═══ */}
          {customizeTab === 'other' && (
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
                  Column layouts, filters, and action availability will be configurable per-organization from the SaaS admin panel.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-app-border/50">
          <div className="text-[10px] font-bold text-app-muted-foreground text-center">
            {activeProfile?.name || 'Default'} · {columns.filter(c => {
              const isOn = c.defaultVisible ? visibleColumns[c.key] !== false : !!visibleColumns[c.key]
              return isOn && !phc.has(c.key)
            }).length} columns{allFilters ? ` · ${Object.values(visibleFilters || defaultFilters).filter(Boolean).length} filters` : ''}
          </div>
        </div>
      </div>
    </>
  )
}


/* ═══════════════════════════════════════════════════════════
 *  PROFILE MANAGER (exact copy from Products)
 * ═══════════════════════════════════════════════════════════ */

function DajingoProfileManager({
  profiles, setProfiles, activeProfileId, switchProfile,
  visibleColumns, visibleFilters, moduleKey,
}: {
  profiles: DajingoViewProfile[]
  setProfiles: (p: DajingoViewProfile[]) => void
  activeProfileId: string
  switchProfile: (id: string) => void
  visibleColumns: Record<string, boolean>
  visibleFilters: Record<string, boolean>
  moduleKey: string
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const createProfile = () => {
    if (profiles.length >= MAX_PROFILES) return
    const id = `profile_${Date.now()}`
    const newP: DajingoViewProfile = { id, name: `View ${profiles.length + 1}`, columns: { ...visibleColumns }, filters: { ...visibleFilters } }
    const next = [...profiles, newP]
    setProfiles(next); saveDajingoProfiles(moduleKey, next); switchProfile(id)
  }

  const duplicateProfile = () => {
    if (profiles.length >= MAX_PROFILES) return
    const current = profiles.find(p => p.id === activeProfileId)
    if (!current) return
    const id = `profile_${Date.now()}`
    const newP: DajingoViewProfile = { id, name: `${current.name} (copy)`, columns: { ...current.columns }, filters: { ...current.filters } }
    const next = [...profiles, newP]
    setProfiles(next); saveDajingoProfiles(moduleKey, next); switchProfile(id)
  }

  const deleteProfile = () => {
    if (profiles.length <= 1) return
    const next = profiles.filter(p => p.id !== activeProfileId)
    setProfiles(next); saveDajingoProfiles(moduleKey, next); switchProfile(next[0].id)
  }

  const startRename = () => {
    const current = profiles.find(p => p.id === activeProfileId)
    setRenameValue(current?.name || ''); setIsRenaming(true)
  }

  const finishRename = () => {
    if (!renameValue.trim()) { setIsRenaming(false); return }
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, name: renameValue.trim() } : p)
    setProfiles(updated); saveDajingoProfiles(moduleKey, updated); setIsRenaming(false)
  }

  return (
    <div className="px-4 py-3 border-b border-app-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Profile</span>
        <span className="text-[9px] font-bold text-app-muted-foreground">{profiles.length}/{MAX_PROFILES}</span>
      </div>
      {isRenaming ? (
        <div className="flex gap-1.5">
          <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setIsRenaming(false) }}
            autoFocus className="flex-1 text-[12px] font-bold px-2.5 py-1.5 rounded-lg bg-app-bg border border-app-primary/50 text-app-foreground outline-none" />
          <button onClick={finishRename} className="p-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all"><Save size={12} /></button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <select value={activeProfileId} onChange={e => switchProfile(e.target.value)}
            className="flex-1 text-[12px] font-bold px-2.5 py-1.5 rounded-lg bg-app-surface/50 border border-app-border/50 text-app-foreground outline-none">
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={startRename} title="Rename" className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all"><Edit size={12} /></button>
          <button onClick={duplicateProfile} title="Duplicate" disabled={profiles.length >= MAX_PROFILES}
            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all disabled:opacity-30"><Copy size={12} /></button>
          <button onClick={deleteProfile} title="Delete" disabled={profiles.length <= 1}
            className="p-1.5 rounded-lg border border-app-border hover:bg-app-surface transition-all disabled:opacity-30" style={{ color: 'var(--app-error)' }}><Trash2 size={12} /></button>
        </div>
      )}
      <button onClick={createProfile} disabled={profiles.length >= MAX_PROFILES}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg border border-dashed border-app-border text-app-muted-foreground hover:text-app-primary hover:border-app-primary/40 transition-all disabled:opacity-30">
        <Plus size={12} /> New Profile
      </button>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════
 *  DRAGGABLE COLUMN LIST (exact copy from Products)
 * ═══════════════════════════════════════════════════════════ */

function DraggableColumnList({
  columns, columnOrder, visibleColumns, policyHiddenColumns,
  onToggle, onReorder, onReset,
}: {
  columns: DajingoColumnDef[]
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
    const colMap = new Map(columns.map(c => [c.key, c]))
    const seen = new Set<string>()
    const result: DajingoColumnDef[] = []
    for (const key of columnOrder) {
      const col = colMap.get(key)
      if (col && !seen.has(key)) { result.push(col); seen.add(key) }
    }
    for (const col of columns) {
      if (!seen.has(col.key)) result.push(col)
    }
    return result
  }, [columns, columnOrder])

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
          const isOn = col.defaultVisible ? visibleColumns[col.key] !== false : !!visibleColumns[col.key]
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
