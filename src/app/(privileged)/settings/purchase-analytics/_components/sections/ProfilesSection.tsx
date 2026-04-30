'use client'

import { useState } from 'react'
import { Layers, User, Shield, GripVertical } from 'lucide-react'
import { PAGE_CONTEXT_LABELS } from '@/lib/analytics-constants'
import type { AnalyticsProfile, AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles'
import AnalyticsProfileSelector from '@/components/analytics/AnalyticsProfileSelector'

const C = '#6366f1'

type Props = {
    profilesData: AnalyticsProfilesData | null
    pageOrder: string[]
    setPageOrder: React.Dispatch<React.SetStateAction<string[]>>
    editingProfile: AnalyticsProfile | null
    creatingForContext: string | null
    onReload: () => void
    onSelect: (profile: AnalyticsProfile) => void
    onCreate: (ctx: string) => void
    onDuplicate: (profile: AnalyticsProfile) => void
    onExport: (profile: AnalyticsProfile) => void
    onCompare: (profile: AnalyticsProfile) => void
}

export function ProfilesSection({
    profilesData, pageOrder, setPageOrder,
    editingProfile, creatingForContext,
    onReload, onSelect, onCreate, onDuplicate, onExport, onCompare,
}: Props) {
    const [draggedCtx, setDraggedCtx] = useState<string | null>(null)
    const [dragOverCtx, setDragOverCtx] = useState<string | null>(null)
    const [hoverProfile, setHoverProfile] = useState<AnalyticsProfile | null>(null)

    return (
        <div className="mb-3">
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${C} 12%, transparent)` }}>
                    <Layers size={15} style={{ color: C }} />
                </div>
                <div>
                    <h2 className="text-[14px] font-black text-app-foreground tracking-tight">Page Profiles</h2>
                    <p className="text-[10px] font-bold text-app-muted-foreground">Each page can override global defaults with its own profile.</p>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: `1.5px solid color-mix(in srgb, ${C} 15%, var(--app-border))` }}>
                {/* Header Row */}
                <div className="grid grid-cols-[24px_140px_1fr_70px_50px] gap-2 px-4 py-2.5"
                    style={{ background: `color-mix(in srgb, ${C} 4%, transparent)`, borderBottom: `1px solid color-mix(in srgb, ${C} 10%, transparent)` }}>
                    <div></div>
                    <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Page</div>
                    <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Active Profile</div>
                    <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Overrides</div>
                    <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Actions</div>
                </div>

                {pageOrder.map((ctx, i) => {
                    const label = (PAGE_CONTEXT_LABELS as any)[ctx]
                    if (!label) return null
                    const ctxProfiles = (profilesData?.profiles || []).filter(p => p.page_context === ctx)
                    const activeId = profilesData?.active_profile_per_page?.[ctx]
                    const activeProf = ctxProfiles.find(p => p.id === activeId)
                    const overrideCount = Object.keys(activeProf?.overrides || {}).length
                    const isActive = editingProfile?.page_context === ctx || creatingForContext === ctx

                    return (
                        <div key={ctx}
                            draggable
                            onDragStart={() => setDraggedCtx(ctx)}
                            onDragEnd={() => { setDraggedCtx(null); setDragOverCtx(null) }}
                            onDragOver={(e) => { e.preventDefault(); setDragOverCtx(ctx) }}
                            onDragLeave={() => setDragOverCtx(null)}
                            onDrop={(e) => {
                                e.preventDefault()
                                if (draggedCtx && draggedCtx !== ctx) {
                                    setPageOrder(prev => {
                                        const next = [...prev]
                                        const fromIdx = next.indexOf(draggedCtx)
                                        const toIdx = next.indexOf(ctx)
                                        next.splice(fromIdx, 1)
                                        next.splice(toIdx, 0, draggedCtx)
                                        return next
                                    })
                                }
                                setDraggedCtx(null); setDragOverCtx(null)
                            }}
                            className={`grid grid-cols-[24px_140px_1fr_70px_50px] gap-2 items-center px-4 py-2.5 transition-all ${draggedCtx === ctx ? 'opacity-30' : ''}`}
                            style={{
                                borderBottom: i < pageOrder.length - 1 ? '1px solid color-mix(in srgb, var(--app-border) 20%, transparent)' : 'none',
                                background: isActive ? `color-mix(in srgb, ${C} 6%, transparent)` : dragOverCtx === ctx && draggedCtx !== ctx ? `color-mix(in srgb, ${C} 4%, transparent)` : 'transparent',
                            }}>
                            <div className="flex flex-col items-center cursor-grab active:cursor-grabbing text-app-muted-foreground/30 hover:text-app-muted-foreground/60 transition-colors">
                                <GripVertical size={12} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? C : 'var(--app-muted-foreground)', opacity: isActive ? 1 : 0.3 }} />
                                <span className={`text-[11px] font-bold ${isActive ? 'text-app-foreground font-black' : 'text-app-foreground'}`}>{label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 relative"
                                onMouseEnter={() => activeProf && Object.keys(activeProf.overrides || {}).length > 0 ? setHoverProfile(activeProf) : null}
                                onMouseLeave={() => setHoverProfile(null)}>
                                {activeProf?.is_system ? <Shield size={10} className="text-app-muted-foreground shrink-0" /> : activeProf ? <User size={10} className="text-app-muted-foreground shrink-0" /> : null}
                                <span className="text-[11px] font-bold text-app-foreground truncate cursor-default">{activeProf?.name || 'System Default'}</span>
                                {hoverProfile?.id === activeProf?.id && hoverProfile && (
                                    <div className="absolute z-50 top-full left-0 mt-1.5 w-[240px] p-3 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                                        style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                        <p className="text-[10px] font-black text-app-foreground mb-2">{hoverProfile.name} — Overrides</p>
                                        <div className="space-y-1">
                                            {Object.entries(hoverProfile.overrides || {}).slice(0, 6).map(([k, v]) => (
                                                <div key={k} className="flex justify-between text-[9px]">
                                                    <span className="text-app-muted-foreground truncate">{k.replace(/_/g, ' ')}</span>
                                                    <span className="text-app-foreground font-black ml-1">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                                </div>
                                            ))}
                                            {Object.keys(hoverProfile.overrides || {}).length > 6 && (
                                                <span className="text-[8px] font-bold text-app-muted-foreground">+{Object.keys(hoverProfile.overrides || {}).length - 6} more…</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                {overrideCount > 0 ? (
                                    <span className="text-[9px] px-2 py-0.5 rounded-lg font-black"
                                        style={{ background: `color-mix(in srgb, ${C} 10%, transparent)`, color: C }}>{overrideCount}</span>
                                ) : (
                                    <span className="text-[9px] text-app-muted-foreground/40">—</span>
                                )}
                            </div>
                            <div className="flex items-center">
                                <AnalyticsProfileSelector
                                    pageContext={ctx}
                                    onProfileChange={onReload}
                                    onEditProfile={onSelect}
                                    onCreateProfile={onCreate}
                                    onDuplicateProfile={onDuplicate}
                                    onExportProfile={onExport}
                                    onCompareProfile={onCompare}
                                    compact
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
