'use client'

import {
    Save, Loader2, CheckCircle2, AlertTriangle, Heart, Copy, ClipboardPaste,
    FileJson, Printer, Zap, History, Download, Search, ChevronDown, ChevronUp,
    Home, Eye, Undo2,
} from 'lucide-react'
import type { PurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'
import type { AnalyticsProfile, AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles'
import { pageHeader, pageTitle, pageSub, QUICK_PRESETS } from '../_lib/constants'

type Suggestion = { field: string; reason: string; current: any; suggested: any }
type Warning = { field: string; severity: 'warn' | 'danger'; message: string }
type ScoreCheck = { label: string; pass: boolean; impact: string }

type Props = {
    config: PurchaseAnalyticsConfig
    profilesData: AnalyticsProfilesData | null
    editingProfile: AnalyticsProfile | null
    creatingForContext: string | null
    isProfileMode: boolean
    overrideCount: number
    lastSavedAt: Date | null
    saved: boolean
    isPending: boolean
    hasChanges: boolean
    diffEntriesCount: number
    configScore: number
    scoreBreakdown: ScoreCheck[]
    showScoreBreakdown: boolean
    setShowScoreBreakdown: (v: boolean) => void
    completenessScore: number
    warnings: Warning[]
    suggestions: Suggestion[]
    showSuggestions: boolean
    setShowSuggestions: (v: boolean) => void
    draftSavedAt: string | null
    fieldSearch: string
    setFieldSearch: (v: string) => void
    configSearch: string
    setConfigSearch: (v: string) => void
    allCollapsed: boolean
    setAllCollapsed: (fn: (v: boolean) => boolean) => void
    onSave: () => void
    onShareUrl: () => void
    onClipboardImport: () => void
    onExportConfig: () => void
    onPrint: () => void
    onCopyChangelog: () => void
    onShowDiff: () => void
    onShowHistory: () => void
    onShowTemplates: () => void
    onShowShortcuts: () => void
    onApplyPreset: (key: string) => void
    onBack?: () => void
}

export function HeaderBar(p: Props) {
    const c = p.config
    const isProfileMode = p.isProfileMode

    return (
        <>
            {/* Breadcrumb */}
            <nav className="mb-2 flex items-center gap-1.5 text-[10px] text-app-muted-foreground">
                <Home size={10} />
                <span>/</span>
                <span>Settings</span>
                <span>/</span>
                <span className={isProfileMode ? 'cursor-pointer hover:text-app-foreground transition-colors' : 'text-app-foreground font-bold'}
                    onClick={isProfileMode ? p.onBack : undefined}>Purchase Analytics</span>
                {p.editingProfile && <><span>/</span><span className="text-app-primary font-bold">{p.editingProfile.name}</span></>}
                {p.creatingForContext && <><span>/</span><span className="text-emerald-600 font-bold">New Profile</span></>}
            </nav>

            <div className={pageHeader}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className={pageTitle}>Purchase Analytics</h1>
                            {c._user_role && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                    c._user_role === 'admin' ? 'bg-emerald-500/10 text-emerald-600' :
                                    c._user_role === 'editor' ? 'bg-blue-500/10 text-blue-600' :
                                    'bg-app-surface-2/10 text-app-muted-foreground'
                                }`}>{c._user_role}</span>
                            )}
                            {c._active_editors && c._active_editors.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[9px] text-emerald-600 font-bold">{c._active_editors.join(', ')} also viewing</span>
                                </div>
                            )}
                        </div>
                        <p className={pageSub}>
                            Customize how the PO Intelligence Grid calculates sales averages, proposed quantities, scoring, and pricing.
                            {p.lastSavedAt && (
                                <span className="ml-2 text-[9px] text-app-muted-foreground/60">
                                    Last saved {Math.round((Date.now() - p.lastSavedAt.getTime()) / 60000)} min ago
                                </span>
                            )}
                        </p>
                        {c._user_role === 'viewer' && (
                            <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[9px] text-amber-600 font-bold">
                                <AlertTriangle size={9} /> Read-only mode — contact an admin to make changes
                            </div>
                        )}
                    </div>

                    {/* Always-visible chips strip */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Chip label="Profiles" value={String(p.profilesData?.profiles?.length || 0)} />
                        <button type="button" onClick={() => p.setShowScoreBreakdown(!p.showScoreBreakdown)} className="relative">
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer ${
                                p.configScore >= 80 ? 'bg-emerald-500/5 border-emerald-500/20' :
                                p.configScore >= 50 ? 'bg-amber-500/5 border-amber-500/20' :
                                'bg-red-500/5 border-red-500/20'
                            }`}>
                                <Heart size={9} className={p.configScore >= 80 ? 'text-emerald-500' : p.configScore >= 50 ? 'text-amber-500' : 'text-red-500'} />
                                <span className={`text-[10px] font-black tabular-nums ${
                                    p.configScore >= 80 ? 'text-emerald-600' : p.configScore >= 50 ? 'text-amber-600' : 'text-red-600'
                                }`}>{p.configScore}%</span>
                            </div>
                            {p.showScoreBreakdown && (
                                <div className="absolute z-50 top-full right-0 mt-1 w-[220px] p-2 rounded-lg bg-app-surface border border-app-border shadow-xl text-left">
                                    <p className="text-[9px] font-bold text-app-foreground mb-1.5">Health Score Breakdown</p>
                                    <div className="space-y-1">
                                        {p.scoreBreakdown.map((c, ci) => (
                                            <div key={ci} className="flex items-center justify-between text-[9px]">
                                                <div className="flex items-center gap-1">
                                                    <span className={c.pass ? 'text-emerald-500' : 'text-red-500'}>{c.pass ? '✓' : '✗'}</span>
                                                    <span className={c.pass ? 'text-app-muted-foreground' : 'text-app-foreground font-bold'}>{c.label}</span>
                                                </div>
                                                {!c.pass && <span className="text-red-500 font-bold">{c.impact}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </button>
                        <Chip
                            label="Done"
                            value={`${p.completenessScore}%`}
                            tone={p.completenessScore === 100 ? 'success' : p.completenessScore >= 75 ? 'primary' : 'warning'}
                        />
                        {p.warnings.length > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                <AlertTriangle size={9} className="text-amber-500" />
                                <span className="text-[10px] font-black text-amber-600 tabular-nums">{p.warnings.length}</span>
                            </div>
                        )}
                        {p.isProfileMode && p.overrideCount > 0 && (
                            <Chip label="Overrides" value={String(p.overrideCount)} tone="primary" />
                        )}

                        {/* Action buttons */}
                        <ActionBtn icon={<Copy size={9} />} label="Share" onClick={p.onShareUrl} title="Copy shareable config URL" />
                        <ActionBtn icon={<ClipboardPaste size={9} />} label="Paste" onClick={p.onClipboardImport} title="Import config from clipboard" />
                        <ActionBtn icon={<FileJson size={9} />} label="Export" onClick={p.onExportConfig} title="Export config as JSON" />
                        <ActionBtn icon={<Printer size={9} />} label="Print" onClick={p.onPrint} title="Print configuration" />
                        {p.suggestions.length > 0 && (
                            <button type="button" onClick={() => p.setShowSuggestions(!p.showSuggestions)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[9px] font-bold text-amber-600 hover:bg-amber-500/10 transition-all">
                                <Zap size={9} /> {p.suggestions.length} Tip{p.suggestions.length !== 1 ? 's' : ''}
                            </button>
                        )}
                        {p.hasChanges && (
                            <>
                                <ActionBtn icon={<Copy size={9} />} label="Changelog" onClick={p.onCopyChangelog} title="Copy changelog" />
                                <ActionBtn icon={<Eye size={9} />} label={`Diff (${p.diffEntriesCount})`} onClick={p.onShowDiff} title="View unsaved changes" />
                            </>
                        )}
                        {p.draftSavedAt && (
                            <span className="text-[8px] text-app-muted-foreground/50 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Draft {p.draftSavedAt}
                            </span>
                        )}
                        <ActionBtn icon={<History size={9} />} label="History" onClick={p.onShowHistory} title="Version history">
                            {c._version_count && c._version_count > 0 && (
                                <span className="text-[8px] px-1 rounded bg-app-primary/10 text-app-primary font-black ml-0.5">{c._version_count}</span>
                            )}
                        </ActionBtn>
                        <ActionBtn icon={<Download size={9} />} label="Templates" onClick={p.onShowTemplates} title="Manage config templates" />
                        <button type="button" onClick={p.onShowShortcuts} className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all" title="Keyboard shortcuts (?)">
                            <span className="text-[9px] font-mono">?</span>
                        </button>
                        <button type="button" onClick={() => p.setAllCollapsed(prev => !prev)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title={p.allCollapsed ? 'Expand all sections' : 'Collapse all sections'}>
                            {p.allCollapsed ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
                            {p.allCollapsed ? 'Expand' : 'Collapse'}
                        </button>
                    </div>

                    {/* Second row: presets + search */}
                    <div className="flex items-center gap-2 flex-wrap mt-1.5 w-full">
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-bold text-app-muted-foreground/50 uppercase mr-0.5">Presets:</span>
                            {Object.entries(QUICK_PRESETS).map(([key, preset]) => (
                                <button key={key} type="button" onClick={() => p.onApplyPreset(key)}
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-app-background border border-app-border/30 text-[8px] font-bold text-app-muted-foreground hover:text-app-foreground hover:border-app-primary/30 transition-all"
                                    title={`Apply ${preset.label} preset`}>
                                    <span>{preset.icon}</span> {preset.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                            <div className="relative">
                                <Search size={9} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-app-muted-foreground/40" />
                                <input type="text" value={p.fieldSearch} onChange={e => p.setFieldSearch(e.target.value)}
                                    placeholder="Filter fields..."
                                    className="pl-5 pr-2 py-0.5 rounded-md bg-app-background border border-app-border/30 text-[9px] text-app-foreground placeholder:text-app-muted-foreground/30 w-28 focus:w-40 transition-all focus:outline-none focus:ring-1 focus:ring-app-primary/30" />
                            </div>
                            <div className="relative">
                                <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input type="text" placeholder="Filter sections..."
                                    value={p.configSearch} onChange={e => p.setConfigSearch(e.target.value)}
                                    className="pl-6 pr-2 py-1 rounded-lg text-[10px] bg-app-surface border border-app-border focus:border-app-primary/30 focus:ring-1 focus:ring-app-primary/10 outline-none text-app-foreground w-[140px]" />
                            </div>
                        </div>
                    </div>

                    {c._last_modified_by && (
                        <div className="text-[8px] text-app-muted-foreground/60 mt-0.5">
                            Last modified by <span className="font-bold text-app-muted-foreground">{c._last_modified_by}</span>
                            {c._last_modified_at && <> · {new Date(c._last_modified_at).toLocaleDateString()} {new Date(c._last_modified_at).toLocaleTimeString()}</>}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

function Chip({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'primary' | 'success' | 'warning' }) {
    const tones = {
        neutral: 'bg-app-background border-app-border/50 text-app-foreground',
        primary: 'bg-app-primary/5 border-app-primary/20 text-app-primary',
        success: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600',
        warning: 'bg-amber-500/5 border-amber-500/20 text-amber-600',
    }
    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${tones[tone]}`}>
            <span className="text-[9px] text-app-muted-foreground">{label}</span>
            <span className="text-[10px] font-black tabular-nums">{value}</span>
        </div>
    )
}

function ActionBtn({ icon, label, onClick, title, children }: { icon: React.ReactNode; label: string; onClick: () => void; title: string; children?: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick} title={title}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all">
            {icon} {label}{children}
        </button>
    )
}
