'use client'

/**
 * Ledger Customize Panel
 * ========================
 * Slide-in sidebar for column/filter visibility and view profile management.
 * Uses shared ToggleListPanel from @/components/ui/.
 */

import { useState } from 'react'
import {
  X, Plus, Edit, Trash2, Copy, Save, SlidersHorizontal,
  Filter, Settings2,
} from 'lucide-react'
import type { ViewProfile } from '../_lib/types'
import { ALL_COLUMNS, ALL_FILTERS, DEFAULT_VISIBLE_COLS, DEFAULT_VISIBLE_FILTERS } from '../_lib/constants'
import { MAX_PROFILES, saveProfiles, saveActiveProfileId } from '../_lib/profiles'
import { ToggleListPanel } from '@/components/ui/ToggleListPanel'

interface LedgerCustomizePanelProps {
  isOpen: boolean
  onClose: () => void
  visibleColumns: Record<string, boolean>
  setVisibleColumns: (v: Record<string, boolean>) => void
  visibleFilters: Record<string, boolean>
  setVisibleFilters: (v: Record<string, boolean>) => void
  profiles: ViewProfile[]
  setProfiles: (p: ViewProfile[]) => void
  activeProfileId: string
  setActiveProfileId: (id: string) => void
  policyHiddenColumns: Set<string>
  policyHiddenFilters: Set<string>
}

export function LedgerCustomizePanel({
  isOpen, onClose, visibleColumns, setVisibleColumns, visibleFilters, setVisibleFilters,
  profiles, setProfiles, activeProfileId, setActiveProfileId, policyHiddenColumns, policyHiddenFilters,
}: LedgerCustomizePanelProps) {
  const [tab, setTab] = useState<'layout' | 'filter'>('layout')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  if (!isOpen) return null

  /* ── Profile persistence helpers ── */
  const persistColumns = (next: Record<string, boolean>) => {
    setVisibleColumns(next)
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, columns: next } : p)
    setProfiles(updated); saveProfiles(updated)
  }
  const persistFilters = (next: Record<string, boolean>) => {
    setVisibleFilters(next)
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, filters: next } : p)
    setProfiles(updated); saveProfiles(updated)
  }

  const switchProfile = (id: string) => {
    const prof = profiles.find(p => p.id === id); if (!prof) return
    setActiveProfileId(id); saveActiveProfileId(id)
    setVisibleColumns(prof.columns); setVisibleFilters(prof.filters)
  }
  const createProfile = () => {
    if (profiles.length >= MAX_PROFILES) return
    const id = `profile_${Date.now()}`
    const newP: ViewProfile = { id, name: `View ${profiles.length + 1}`, columns: { ...visibleColumns }, filters: { ...visibleFilters } }
    const next = [...profiles, newP]; setProfiles(next); saveProfiles(next); switchProfile(id)
  }
  const duplicateProfile = () => {
    if (profiles.length >= MAX_PROFILES) return
    const cur = profiles.find(p => p.id === activeProfileId); if (!cur) return
    const id = `profile_${Date.now()}`
    const newP: ViewProfile = { id, name: `${cur.name} (copy)`, columns: { ...cur.columns }, filters: { ...cur.filters } }
    const next = [...profiles, newP]; setProfiles(next); saveProfiles(next); switchProfile(id)
  }
  const deleteProfile = () => {
    if (profiles.length <= 1) return
    const next = profiles.filter(p => p.id !== activeProfileId); setProfiles(next); saveProfiles(next); switchProfile(next[0].id)
  }
  const startRename = () => { setRenameValue(profiles.find(p => p.id === activeProfileId)?.name || ''); setIsRenaming(true) }
  const finishRename = () => {
    if (!renameValue.trim()) { setIsRenaming(false); return }
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, name: renameValue.trim() } : p)
    setProfiles(updated); saveProfiles(updated); setIsRenaming(false)
  }
  const ap = profiles.find(p => p.id === activeProfileId)

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60] animate-in fade-in duration-150" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[340px] z-[61] flex flex-col animate-in slide-in-from-right duration-200"
        style={{ background: 'var(--app-bg)', borderLeft: '1px solid var(--app-border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border/50">
          <div className="flex items-center gap-2"><Settings2 size={16} className="text-app-primary" />
            <span className="text-[13px] font-black text-app-foreground">Customize View</span></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-surface transition-colors text-app-muted-foreground hover:text-app-foreground"><X size={14} /></button>
        </div>
        {/* Profile Selector */}
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
        {/* Tab Bar */}
        <div className="px-4 pt-3 pb-1 flex gap-1">
          {[{ key: 'layout' as const, label: 'Columns', icon: <SlidersHorizontal size={12} /> },
            { key: 'filter' as const, label: 'Filters', icon: <Filter size={12} /> }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${tab === t.key ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {tab === 'layout' && (
            <ToggleListPanel
              title="List Columns"
              items={ALL_COLUMNS}
              visibility={visibleColumns}
              hiddenByPolicy={policyHiddenColumns}
              onToggle={key => persistColumns({ ...visibleColumns, [key]: !visibleColumns[key] })}
              onReset={() => persistColumns(DEFAULT_VISIBLE_COLS)}
            />
          )}
          {tab === 'filter' && (
            <ToggleListPanel
              title="Visible Filters"
              items={ALL_FILTERS}
              visibility={visibleFilters}
              hiddenByPolicy={policyHiddenFilters}
              onToggle={key => persistFilters({ ...visibleFilters, [key]: !visibleFilters[key] })}
              onReset={() => persistFilters(DEFAULT_VISIBLE_FILTERS)}
            />
          )}
          {/* SaaS Note */}
          <div className="rounded-xl border border-dashed border-app-border/60 p-3">
            <div className="text-[10px] font-black text-app-primary uppercase tracking-widest mb-1">SaaS Governed</div>
            <p className="text-[10px] text-app-muted-foreground leading-relaxed">
              Column layouts, filters, and action availability are configurable per-organization from the SaaS admin panel.
            </p>
          </div>
        </div>
        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-app-border/50">
          <div className="text-[10px] font-bold text-app-muted-foreground text-center">
            {ap?.name} · {Object.values(visibleColumns).filter(Boolean).length} columns · {Object.values(visibleFilters).filter(Boolean).length} filters
          </div>
        </div>
      </div>
    </>
  )
}
