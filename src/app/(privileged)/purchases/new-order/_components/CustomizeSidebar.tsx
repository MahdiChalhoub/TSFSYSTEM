// @ts-nocheck
'use client'

/**
 * CustomizeSidebar — Column Customize View Panel
 * ==================================================
 */

import { SlidersHorizontal, X, Plus, Copy, Trash2 } from 'lucide-react'
import {
    PO_ALL_COLUMNS, PO_DEFAULT_VISIBLE_COLS, PO_MAX_PROFILES,
    savePOProfiles, savePOActiveProfileId,
    type POViewProfile,
} from '../_lib/constants'

export function CustomizeSidebar({ customizeOpen, setCustomizeOpen, poProfiles, setPOProfiles,
    poActiveProfileId, setPOActiveProfileId, visibleColumns, setVisibleColumns, activeProfile, visibleColCount,
}: {
    customizeOpen: boolean, setCustomizeOpen: (v: boolean) => void,
    poProfiles: POViewProfile[], setPOProfiles: (v: POViewProfile[]) => void,
    poActiveProfileId: string, setPOActiveProfileId: (v: string) => void,
    visibleColumns: Record<string, boolean>, setVisibleColumns: (v: Record<string, boolean>) => void,
    activeProfile: POViewProfile | undefined, visibleColCount: number,
}) {
    if (!customizeOpen) return null
    return (
        <>
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setCustomizeOpen(false)} />
        <div className="fixed right-0 top-0 bottom-0 w-[320px] border-l border-app-border z-50 flex flex-col animate-in slide-in-from-right duration-200"
            style={{ background: 'var(--app-surface)', backdropFilter: 'blur(20px)' }}>
            <div className="px-5 py-3.5 border-b border-app-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}>
                        <SlidersHorizontal size={13} className="text-app-primary" />
                    </div>
                    <span className="text-[13px] font-black text-app-foreground">Customize View</span>
                </div>
                <button onClick={() => setCustomizeOpen(false)} className="p-1 rounded-lg hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-all">
                    <X size={16} />
                </button>
            </div>
            {/* Profile Selector */}
            <div className="px-5 py-3 border-b border-app-border/50 space-y-2 flex-shrink-0">
                <div className="flex gap-1.5">
                    <select value={poActiveProfileId} onChange={e => {
                        const prof = poProfiles.find(p => p.id === e.target.value)
                        if (!prof) return
                        setPOActiveProfileId(prof.id); savePOActiveProfileId(prof.id); setVisibleColumns(prof.columns)
                    }} className="flex-1 text-[12px] font-bold px-2.5 py-1.5 rounded-lg bg-app-surface/50 border border-app-border/50 text-app-foreground outline-none">
                        {poProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button title="Duplicate" disabled={poProfiles.length >= PO_MAX_PROFILES} onClick={() => {
                        const current = poProfiles.find(p => p.id === poActiveProfileId)
                        if (!current) return
                        const id = `profile_${Date.now()}`
                        const newP: POViewProfile = { id, name: `${current.name} (copy)`, columns: { ...current.columns } }
                        const next = [...poProfiles, newP]
                        setPOProfiles(next); savePOProfiles(next); setPOActiveProfileId(id); savePOActiveProfileId(id); setVisibleColumns(newP.columns)
                    }} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all disabled:opacity-30">
                        <Copy size={12} />
                    </button>
                    <button title="Delete" disabled={poProfiles.length <= 1} onClick={() => {
                        if (poProfiles.length <= 1) return
                        const next = poProfiles.filter(p => p.id !== poActiveProfileId)
                        setPOProfiles(next); savePOProfiles(next); setPOActiveProfileId(next[0].id); savePOActiveProfileId(next[0].id); setVisibleColumns(next[0].columns)
                    }} className="p-1.5 rounded-lg border border-app-border hover:bg-app-surface transition-all disabled:opacity-30" style={{ color: 'var(--app-error)' }}>
                        <Trash2 size={12} />
                    </button>
                </div>
                <button disabled={poProfiles.length >= PO_MAX_PROFILES} onClick={() => {
                    const id = `profile_${Date.now()}`
                    const newP: POViewProfile = { id, name: `View ${poProfiles.length + 1}`, columns: { ...visibleColumns } }
                    const next = [...poProfiles, newP]
                    setPOProfiles(next); savePOProfiles(next); setPOActiveProfileId(id); savePOActiveProfileId(id)
                }} className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg border border-dashed border-app-border text-app-muted-foreground hover:text-app-primary hover:border-app-primary/40 transition-all disabled:opacity-30">
                    <Plus size={12} /> New Profile
                </button>
            </div>
            {/* Column Toggles */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1" style={{ scrollbarWidth: 'thin' }}>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Columns</span>
                    <button onClick={() => {
                        setVisibleColumns(PO_DEFAULT_VISIBLE_COLS)
                        const updated = poProfiles.map(p => p.id === poActiveProfileId ? { ...p, columns: PO_DEFAULT_VISIBLE_COLS } : p)
                        setPOProfiles(updated); savePOProfiles(updated)
                    }} className="text-[10px] font-bold text-app-primary hover:underline">Reset</button>
                </div>
                {PO_ALL_COLUMNS.map(col => (
                    <button key={col.key} type="button" onClick={() => {
                        const next = { ...visibleColumns, [col.key]: !visibleColumns[col.key] }
                        setVisibleColumns(next)
                        const updated = poProfiles.map(p => p.id === poActiveProfileId ? { ...p, columns: next } : p)
                        setPOProfiles(updated); savePOProfiles(updated)
                    }} className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-app-surface/60 transition-all">
                        <span className={`text-[12px] font-bold ${visibleColumns[col.key] ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>
                            {col.label}
                            {col.sub && <span className="text-[9px] font-normal text-app-muted-foreground ml-1.5">({col.sub})</span>}
                        </span>
                        <div className={`w-8 h-[18px] rounded-full transition-all relative ${visibleColumns[col.key] ? 'bg-app-primary' : 'bg-app-border'}`}>
                            <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all ${visibleColumns[col.key] ? 'left-[18px]' : 'left-[2px]'}`} />
                        </div>
                    </button>
                ))}
            </div>
            <div className="flex-shrink-0 px-4 py-3 border-t border-app-border/50">
                <div className="text-[10px] font-bold text-app-muted-foreground text-center">
                    {activeProfile?.name} · {visibleColCount} of {PO_ALL_COLUMNS.length} columns
                </div>
            </div>
        </div>
        </>
    )
}
