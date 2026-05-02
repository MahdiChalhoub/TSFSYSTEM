'use client'

import { useState } from 'react'
import { Plus, Edit, Trash2, Copy, Save, Globe, Lock } from 'lucide-react'
import type { ViewProfile } from './types'
import { MAX_PROFILES } from './profiles'

interface ProfileManagerProps {
  profiles: ViewProfile[]
  setProfiles: (p: ViewProfile[]) => void
  activeProfileId: string
  switchProfile: (id: string) => void
  currentColumns: Record<string, boolean>
  currentFilters?: Record<string, boolean>
  currentOrder?: string[]
  onSaveProfiles: (p: ViewProfile[]) => void
  onSaveActiveId: (id: string) => void
  onShareProfile?: (id: string, shared: boolean) => void
  isStaff?: boolean
}

export function ProfileManager({
  profiles, setProfiles, activeProfileId, switchProfile,
  currentColumns, currentFilters, currentOrder,
  onSaveProfiles, onSaveActiveId, onShareProfile,
  isStaff = false
}: ProfileManagerProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const activeProfile = profiles.find(p => p.id === activeProfileId)
  const isShared = activeProfile?.is_shared

  const createProfile = () => {
    if (profiles.length >= MAX_PROFILES) return
    const id = `profile_${Date.now()}`
    const newP: ViewProfile = { 
        id, 
        name: `View ${profiles.length + 1}`, 
        columns: { ...currentColumns }, 
        filters: currentFilters ? { ...currentFilters } : undefined,
        columnOrder: currentOrder ? [...currentOrder] : undefined
    }
    const next = [...profiles, newP]
    setProfiles(next); onSaveProfiles(next); switchProfile(id)
  }

  const duplicateProfile = () => {
    if (profiles.length >= MAX_PROFILES) return
    const current = profiles.find(p => p.id === activeProfileId)
    if (!current) return
    const id = `profile_${Date.now()}`
    const newP: ViewProfile = { 
        id, 
        name: `${current.name} (copy)`, 
        columns: { ...current.columns }, 
        filters: current.filters ? { ...current.filters } : undefined,
        columnOrder: current.columnOrder ? [...current.columnOrder] : undefined,
        is_shared: false // Duplicates are always private
    }
    const next = [...profiles, newP]
    setProfiles(next); onSaveProfiles(next); switchProfile(id)
  }

  const deleteProfile = () => {
    if (profiles.length <= 1) return
    // If deleting a shared profile, we need special handling? 
    // For now just prevent deletion if shared unless staff
    if (isShared && !isStaff) return
    
    const next = profiles.filter(p => p.id !== activeProfileId)
    setProfiles(next); onSaveProfiles(next); switchProfile(next[0].id)
  }

  const startRename = () => {
    const current = profiles.find(p => p.id === activeProfileId)
    setRenameValue(current?.name || ''); setIsRenaming(true)
  }

  const finishRename = () => {
    if (!renameValue.trim()) { setIsRenaming(false); return }
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, name: renameValue.trim() } : p)
    setProfiles(updated); onSaveProfiles(updated); setIsRenaming(false)
  }

  const toggleShare = () => {
    if (!onShareProfile || !activeProfile) return
    onShareProfile(activeProfileId, !isShared)
  }

  return (
    <div className="px-4 py-3 border-b border-app-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Profile</span>
            {isShared && <span className="flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-app-primary/10 text-app-primary border border-app-primary/20"><Globe size={8}/> SHARED</span>}
        </div>
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
          <div className="relative flex-1 min-w-0">
            <select value={activeProfileId} onChange={e => { switchProfile(e.target.value); onSaveActiveId(e.target.value); }}
                className="w-full text-[12px] font-bold pl-2.5 pr-8 py-1.5 rounded-lg bg-app-surface/50 border border-app-border/50 text-app-foreground outline-none appearance-none truncate">
                {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                        {p.is_shared ? '🌍 ' : ''}{p.name}
                    </option>
                ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-app-muted-foreground opacity-50">
                <Plus size={10} className="rotate-45" />
            </div>
          </div>

          <button onClick={startRename} title="Rename" disabled={isShared && !isStaff}
            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all disabled:opacity-30"><Edit size={12} /></button>
          
          {isStaff && (
            <button onClick={toggleShare} title={isShared ? "Make Private" : "Share with Organization"}
                className={`p-1.5 rounded-lg border transition-all ${isShared ? 'bg-app-primary text-white border-app-primary' : 'border-app-border text-app-muted-foreground hover:text-app-primary hover:bg-app-surface'}`}>
                <Globe size={12} />
            </button>
          )}

          <button onClick={duplicateProfile} title="Duplicate" disabled={profiles.length >= MAX_PROFILES}
            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all disabled:opacity-30"><Copy size={12} /></button>
          
          <button onClick={deleteProfile} title="Delete" disabled={profiles.length <= 1 || (isShared && !isStaff)}
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
