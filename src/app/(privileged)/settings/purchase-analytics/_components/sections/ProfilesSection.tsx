'use client'

import { useState } from 'react'
import { Layers, User, Shield, GripVertical } from 'lucide-react'
import { PAGE_CONTEXT_LABELS } from '@/lib/analytics-constants'
import type { AnalyticsProfile, AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles'
import AnalyticsProfileSelector from '@/components/analytics/AnalyticsProfileSelector'
import { card, pageSub } from '../../_lib/constants'

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
            <div className="mb-2">
                <h2 className="text-[14px] font-black text-app-foreground tracking-tight">Page Profiles</h2>
                <p className={pageSub}>Each page can override the global defaults below with its own profile.</p>
            </div>
            <div className={card}>
                <div className="grid grid-cols-[24px_140px_200px_70px_40px] gap-2 px-3 py-2 border-b border-app-border/40 bg-app-background/30">
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
                            className={`grid grid-cols-[24px_140px_200px_70px_40px] gap-2 items-center px-3 py-2 ${i < pageOrder.length - 1 ? 'border-b border-app-border/20' : ''} transition-all ${
                                (editingProfile?.page_context === ctx || creatingForContext === ctx)
                                    ? 'bg-app-primary/[0.06] ring-1 ring-app-primary/20 rounded-lg'
                                    : dragOverCtx === ctx && draggedCtx !== ctx
                                    ? 'bg-app-primary/[0.04] border-t-2 border-app-primary/30'
                                    : 'hover:bg-app-background/20'
                            } ${draggedCtx === ctx ? 'opacity-40' : ''}`}>
                            <div className="flex flex-col items-center cursor-grab active:cursor-grabbing text-app-muted-foreground/30 hover:text-app-muted-foreground/60 transition-colors">
                                <GripVertical size={12} />
                            </div>
                            <div className="flex items-center gap-2">
                                <Layers size={12} className="text-indigo-500 shrink-0" />
                                <span className="text-[11px] font-bold text-app-foreground">{label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 relative"
                                onMouseEnter={() => activeProf && Object.keys(activeProf.overrides || {}).length > 0 ? setHoverProfile(activeProf) : null}
                                onMouseLeave={() => setHoverProfile(null)}>
                                {activeProf?.is_system ? <Shield size={10} className="text-app-muted-foreground shrink-0" /> : activeProf ? <User size={10} className="text-app-muted-foreground shrink-0" /> : null}
                                <span className="text-[11px] text-app-foreground truncate cursor-default">{activeProf?.name || 'System Default'}</span>
                                {hoverProfile?.id === activeProf?.id && hoverProfile && (
                                    <div className="absolute z-50 top-full left-0 mt-1 w-[220px] p-2 rounded-lg bg-app-surface border border-app-border shadow-xl animate-[fadeIn_0.1s_ease-in-out]">
                                        <p className="text-[9px] font-bold text-app-foreground mb-1">{hoverProfile.name} — Overrides</p>
                                        <div className="space-y-0.5">
                                            {Object.entries(hoverProfile.overrides || {}).slice(0, 6).map(([k, v]) => (
                                                <div key={k} className="flex justify-between text-[8px]">
                                                    <span className="text-app-muted-foreground truncate">{k.replace(/_/g, ' ')}</span>
                                                    <span className="text-app-foreground font-bold ml-1">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                                </div>
                                            ))}
                                            {Object.keys(hoverProfile.overrides || {}).length > 6 && (
                                                <span className="text-[8px] text-app-muted-foreground">+{Object.keys(hoverProfile.overrides || {}).length - 6} more...</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                {overrideCount > 0 ? (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-app-primary/10 text-app-primary font-black">{overrideCount}</span>
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
