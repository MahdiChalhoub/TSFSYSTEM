'use client'

/**
 * Profile Manager
 * =================
 * Profile selector/creator/editor UI for view profiles.
 * Extracted from the Products CustomizePanel.
 */

import { useState } from 'react'
import { Plus, Edit, Trash2, Copy, Save } from 'lucide-react'
import type { ViewProfile } from '../../_lib/types'
import { MAX_PROFILES, saveProfiles, saveActiveProfileId } from '../../_lib/profiles'

interface ProfileManagerProps {
  profiles: ViewProfile[]
  setProfiles: (p: ViewProfile[]) => void
  activeProfileId: string
  switchProfile: (id: string) => void
  visibleColumns: Record<string, boolean>
  visibleFilters: Record<string, boolean>
}

export function ProfileManager({
  profiles, setProfiles, activeProfileId, switchProfile,
  visibleColumns, visibleFilters,
}: ProfileManagerProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const createProfile = () => {
    if (profiles.length >= MAX_PROFILES) return
    const id = `profile_${Date.now()}`
    const newP: ViewProfile = { id, name: `View ${profiles.length + 1}`, columns: { ...visibleColumns }, filters: { ...visibleFilters } }
    const next = [...profiles, newP]
    setProfiles(next); saveProfiles(next); switchProfile(id)
  }

  const duplicateProfile = () => {
    if (profiles.length >= MAX_PROFILES) return
    const current = profiles.find(p => p.id === activeProfileId)
    if (!current) return
    const id = `profile_${Date.now()}`
    const newP: ViewProfile = { id, name: `${current.name} (copy)`, columns: { ...current.columns }, filters: { ...current.filters } }
    const next = [...profiles, newP]
    setProfiles(next); saveProfiles(next); switchProfile(id)
  }

  const deleteProfile = () => {
    if (profiles.length <= 1) return
    const next = profiles.filter(p => p.id !== activeProfileId)
    setProfiles(next); saveProfiles(next); switchProfile(next[0].id)
  }

  const startRename = () => {
    const current = profiles.find(p => p.id === activeProfileId)
    setRenameValue(current?.name || ''); setIsRenaming(true)
  }

  const finishRename = () => {
    if (!renameValue.trim()) { setIsRenaming(false); return }
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, name: renameValue.trim() } : p)
    setProfiles(updated); saveProfiles(updated); setIsRenaming(false)
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
