'use client'

/**
 * Task Customize Panel
 * ======================
 * Ported 1:1 from /inventory/products CustomizePanel — same side-panel
 * chrome, same tabs, same ProfileManager pattern, but scoped to the
 * task filter surface. Layout tab is omitted here because the tasks
 * page doesn't have a configurable column layout yet; Filter and
 * Other tabs mirror the products UI exactly.
 */

import { useState } from 'react'
import {
    X, SlidersHorizontal, Filter, Settings2,
    Plus, Edit, Trash2, Copy, Save,
} from 'lucide-react'
import { ToggleListPanel } from '@/components/ui/ToggleListPanel'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

// ═══════════════════════════════════════════════════════════
//  FILTER KEYS + PROFILE CONSTANTS
// ═══════════════════════════════════════════════════════════

export type FilterKey =
    | 'status' | 'priority' | 'source' | 'assignee' | 'creator'
    | 'overdue' | 'hasLink' | 'dateRange'

export const ALL_FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'source', label: 'Source (Auto / Manual)' },
    { key: 'assignee', label: 'Assigned to' },
    { key: 'creator', label: 'Created by' },
    { key: 'overdue', label: 'Overdue only' },
    { key: 'hasLink', label: 'Has source link' },
    { key: 'dateRange', label: 'Date range + presets' },
]

export const DEFAULT_VISIBLE_FILTERS: Record<FilterKey, boolean> = {
    status: true, priority: true, source: true, assignee: true,
    creator: true, overdue: true, hasLink: false, dateRange: true,
}

export interface TaskViewProfile {
    id: string
    name: string
    filters: Record<FilterKey, boolean>
}

const MAX_PROFILES = 10
const PROFILES_KEY = 'tsf_task_profiles'
const ACTIVE_PROFILE_KEY = 'tsf_task_active_profile'

export function loadProfiles(): TaskViewProfile[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(PROFILES_KEY)
        if (raw) return JSON.parse(raw)
    } catch { /* noop */ }
    return [{ id: 'default', name: 'Default', filters: DEFAULT_VISIBLE_FILTERS }]
}
export function saveProfiles(profiles: TaskViewProfile[]) {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)) } catch { /* noop */ }
}
export function loadActiveProfileId(): string {
    if (typeof window === 'undefined') return 'default'
    try { return localStorage.getItem(ACTIVE_PROFILE_KEY) || 'default' } catch { return 'default' }
}
export function saveActiveProfileId(id: string) {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(ACTIVE_PROFILE_KEY, id) } catch { /* noop */ }
}

// ═══════════════════════════════════════════════════════════
//  PANEL
// ═══════════════════════════════════════════════════════════

interface CustomizePanelProps {
    isOpen: boolean
    onClose: () => void
    visibleFilters: Record<FilterKey, boolean>
    setVisibleFilters: (v: Record<FilterKey, boolean>) => void
    profiles: TaskViewProfile[]
    setProfiles: (p: TaskViewProfile[]) => void
    activeProfileId: string
    setActiveProfileId: (id: string) => void
}

const TABS = [
    { key: 'filter' as const, label: 'Filter', icon: <Filter size={12} /> },
    { key: 'other' as const, label: 'Other', icon: <Settings2 size={12} /> },
]

export function TaskCustomizePanel({
    isOpen, onClose,
    visibleFilters, setVisibleFilters,
    profiles, setProfiles, activeProfileId, setActiveProfileId,
}: CustomizePanelProps) {
    const [customizeTab, setCustomizeTab] = useState<'filter' | 'other'>('filter')

    if (!isOpen) return null

    const persistFilters = (next: Record<FilterKey, boolean>) => {
        setVisibleFilters(next)
        const updated = profiles.map(p => p.id === activeProfileId ? { ...p, filters: next } : p)
        setProfiles(updated); saveProfiles(updated)
    }

    const switchProfile = (id: string) => {
        const prof = profiles.find(p => p.id === id)
        if (!prof) return
        setActiveProfileId(id); saveActiveProfileId(id)
        setVisibleFilters(prof.filters)
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
                        <span className="text-tp-lg font-bold text-app-foreground">Customize View</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-surface transition-colors text-app-muted-foreground hover:text-app-foreground">
                        <X size={14} />
                    </button>
                </div>

                {/* Profile Selector */}
                <TaskProfileManager
                    profiles={profiles}
                    setProfiles={setProfiles}
                    activeProfileId={activeProfileId}
                    switchProfile={switchProfile}
                    visibleFilters={visibleFilters}
                />

                {/* Tab Bar */}
                <div className="px-4 pt-3 pb-1 flex gap-1">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setCustomizeTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-tp-sm font-bold transition-all ${customizeTab === tab.key
                                ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface'}`}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">

                    {/* ═══ FILTER TAB ═══ */}
                    {customizeTab === 'filter' && (
                        <ToggleListPanel
                            title="Visible Filters"
                            items={ALL_FILTERS}
                            visibility={visibleFilters}
                            hiddenByPolicy={new Set()}
                            onToggle={key => persistFilters({ ...visibleFilters, [key]: !visibleFilters[key as FilterKey] } as Record<FilterKey, boolean>)}
                            onReset={() => persistFilters(DEFAULT_VISIBLE_FILTERS)}
                        />
                    )}

                    {/* ═══ OTHER TAB ═══ */}
                    {customizeTab === 'other' && (
                        <div className="space-y-6">
                            <div>
                                <span className="text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wide block mb-3">Row Actions</span>
                                <p className="text-tp-xs text-app-muted-foreground mb-3">Choose which actions appear directly on each task row. Others go into the overflow menu.</p>
                                <div className="space-y-1">
                                    {[
                                        { label: 'Open source object', role: 'Primary' },
                                        { label: 'Quick toggle Done', role: 'Primary' },
                                        { label: 'Edit', role: 'Dropdown' },
                                        { label: 'Delete', role: 'Dropdown' },
                                    ].map(action => (
                                        <div key={action.label} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-app-surface/60 transition-all">
                                            <span className="text-tp-md font-bold text-app-foreground">{action.label}</span>
                                            <span className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wider">{action.role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <span className="text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wide block mb-3">Display</span>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-app-surface/60 transition-all">
                                        <span className="text-tp-md font-bold text-app-foreground">Show completed by default</span>
                                        <ToggleSwitch on={false} />
                                    </div>
                                    <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-app-surface/60 transition-all">
                                        <span className="text-tp-md font-bold text-app-foreground">Expand on Click</span>
                                        <ToggleSwitch on={true} />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-dashed border-app-border/60 p-3">
                                <div className="text-tp-xs font-bold text-app-primary uppercase tracking-wide mb-1">Local Only</div>
                                <p className="text-tp-xs text-app-muted-foreground leading-relaxed">
                                    Profiles and filter visibility are stored in this browser's localStorage. Backend sync lands with the shared profile service.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-4 py-3 border-t border-app-border/50">
                    <div className="text-tp-xs font-bold text-app-muted-foreground text-center">
                        {activeProfile?.name ?? 'Default'} · {Object.values(visibleFilters).filter(Boolean).length} filters
                    </div>
                </div>
            </div>
        </>
    )
}

// ═══════════════════════════════════════════════════════════
//  PROFILE MANAGER — same UX as /inventory/products
// ═══════════════════════════════════════════════════════════

interface ProfileManagerProps {
    profiles: TaskViewProfile[]
    setProfiles: (p: TaskViewProfile[]) => void
    activeProfileId: string
    switchProfile: (id: string) => void
    visibleFilters: Record<FilterKey, boolean>
}

function TaskProfileManager({
    profiles, setProfiles, activeProfileId, switchProfile, visibleFilters,
}: ProfileManagerProps) {
    const [isRenaming, setIsRenaming] = useState(false)
    const [renameValue, setRenameValue] = useState('')

    const createProfile = () => {
        if (profiles.length >= MAX_PROFILES) return
        const id = `profile_${Date.now()}`
        const newP: TaskViewProfile = { id, name: `View ${profiles.length + 1}`, filters: { ...visibleFilters } }
        const next = [...profiles, newP]
        setProfiles(next); saveProfiles(next); switchProfile(id)
    }

    const duplicateProfile = () => {
        if (profiles.length >= MAX_PROFILES) return
        const current = profiles.find(p => p.id === activeProfileId)
        if (!current) return
        const id = `profile_${Date.now()}`
        const newP: TaskViewProfile = { id, name: `${current.name} (copy)`, filters: { ...current.filters } }
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
                <span className="text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wide">Profile</span>
                <span className="text-tp-xxs font-bold text-app-muted-foreground">{profiles.length}/{MAX_PROFILES}</span>
            </div>
            {isRenaming ? (
                <div className="flex gap-1.5">
                    <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setIsRenaming(false) }}
                        autoFocus className="flex-1 text-tp-md font-bold px-2.5 py-1.5 rounded-lg bg-app-bg border border-app-primary/50 text-app-foreground outline-none" />
                    <button onClick={finishRename} className="p-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all"><Save size={12} /></button>
                </div>
            ) : (
                <div className="flex gap-1.5">
                    <select value={activeProfileId} onChange={e => switchProfile(e.target.value)}
                        className="flex-1 text-tp-md font-bold px-2.5 py-1.5 rounded-lg bg-app-surface border border-app-border text-app-foreground outline-none">
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={startRename} className="p-1.5 rounded-lg bg-app-surface border border-app-border hover:border-app-primary/50 text-app-muted-foreground hover:text-app-primary transition-all" title="Rename">
                        <Edit size={12} />
                    </button>
                </div>
            )}
            <div className="grid grid-cols-3 gap-1.5">
                <button onClick={createProfile} disabled={profiles.length >= MAX_PROFILES}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-app-primary text-white text-tp-xs font-bold hover:brightness-110 transition-all disabled:opacity-40"
                    title="New profile">
                    <Plus size={10} /> New
                </button>
                <button onClick={duplicateProfile} disabled={profiles.length >= MAX_PROFILES}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-app-surface border border-app-border text-app-foreground text-tp-xs font-bold hover:bg-app-surface/70 transition-all disabled:opacity-40"
                    title="Duplicate current">
                    <Copy size={10} /> Copy
                </button>
                <button onClick={deleteProfile} disabled={profiles.length <= 1}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-app-surface border border-app-border text-app-muted-foreground text-tp-xs font-bold hover:bg-app-error/10 hover:text-app-error hover:border-app-error/30 transition-all disabled:opacity-40"
                    title="Delete profile">
                    <Trash2 size={10} /> Delete
                </button>
            </div>
        </div>
    )
}
