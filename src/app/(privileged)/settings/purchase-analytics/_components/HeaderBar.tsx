'use client'

import {
    Save, Loader2, CheckCircle2, AlertTriangle, Heart, Copy, ClipboardPaste,
    FileJson, Printer, Zap, History, Download, Search, ChevronDown, ChevronUp,
    Home, Eye, Undo2, BarChart3, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import type { PurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'
import type { AnalyticsProfile, AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles'
import { QUICK_PRESETS } from '../_lib/constants'

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

    /* ── Score color helpers ── */
    const scoreColor = p.configScore >= 80 ? 'var(--app-success, #22c55e)' : p.configScore >= 50 ? 'var(--app-warning)' : 'var(--app-error, #ef4444)'

    return (
        <>
            {/* ═══ V2 Icon-Box Header ═══ */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5 fade-in-up">
                <div className="flex items-center gap-4">
                    <Link href="/settings">
                        <button className="w-9 h-9 rounded-xl border border-app-border flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all">
                            <ArrowLeft size={16} />
                        </button>
                    </Link>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: 'var(--app-primary-bg)', border: '1px solid var(--app-primary-border)' }}>
                        <BarChart3 size={26} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                            Settings · Procurement
                        </p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground">
                            Purchase Analytics
                        </h1>
                        <p className="text-[11px] text-app-muted-foreground mt-0.5">
                            Configure the PO Intelligence Grid — sales averages, quantities, scoring, and pricing.
                            {p.lastSavedAt && (
                                <span className="ml-2 text-[9px] opacity-60">
                                    · Saved {Math.round((Date.now() - p.lastSavedAt.getTime()) / 60000)}m ago
                                </span>
                            )}
                        </p>
                        {isProfileMode && (
                            <div className="flex items-center gap-1.5 mt-1">
                                {p.editingProfile && (
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                        Editing: {p.editingProfile.name}
                                    </span>
                                )}
                                {p.creatingForContext && (
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>
                                        ✨ New Profile
                                    </span>
                                )}
                                <button onClick={p.onBack} className="text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground underline ml-1">
                                    ← Back to Global
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-2 shrink-0">
                    {p.saved && (
                        <span className="flex items-center gap-1 text-[10px] font-bold animate-in fade-in duration-300" style={{ color: 'var(--app-success, #22c55e)' }}>
                            <CheckCircle2 size={13} /> Saved
                        </span>
                    )}
                    {p.hasChanges && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>
                            {p.diffEntriesCount} unsaved
                        </span>
                    )}
                    <button type="button" onClick={p.onSave} disabled={p.isPending}
                        className="flex items-center gap-2 text-[11px] font-black bg-app-primary hover:brightness-110 text-white px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                        style={{ boxShadow: '0 2px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        {p.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        {p.isPending ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </header>

            {/* ═══ KPI Strip ═══ */}
            <div className="mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                {/* Health Score */}
                <button type="button" onClick={() => p.setShowScoreBreakdown(!p.showScoreBreakdown)} className="relative">
                    <KpiTile label="Health" value={`${p.configScore}%`} color={scoreColor}
                        icon={<Heart size={14} />} />
                    {p.showScoreBreakdown && (
                        <div className="absolute z-50 top-full left-0 mt-1.5 w-[240px] p-3 rounded-xl shadow-2xl text-left animate-in fade-in zoom-in-95 duration-150"
                            style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                            <p className="text-[10px] font-black text-app-foreground mb-2">Health Score Breakdown</p>
                            <div className="space-y-1.5">
                                {p.scoreBreakdown.map((c, ci) => (
                                    <div key={ci} className="flex items-center justify-between text-[9px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-black ${c.pass ? 'text-white' : 'text-white'}`}
                                                style={{ background: c.pass ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }}>
                                                {c.pass ? '✓' : '✗'}
                                            </span>
                                            <span className="font-bold text-app-foreground">{c.label}</span>
                                        </div>
                                        {!c.pass && <span className="font-black" style={{ color: 'var(--app-error, #ef4444)' }}>{c.impact}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </button>

                <KpiTile label="Completeness" value={`${p.completenessScore}%`}
                    color={p.completenessScore === 100 ? 'var(--app-success, #22c55e)' : p.completenessScore >= 75 ? 'var(--app-primary)' : 'var(--app-warning)'}
                    icon={<CheckCircle2 size={14} />} />

                <KpiTile label="Profiles" value={String(p.profilesData?.profiles?.length || 0)}
                    color="var(--app-info, #3b82f6)" icon={<Download size={14} />} />

                {p.warnings.length > 0 && (
                    <KpiTile label="Warnings" value={String(p.warnings.length)}
                        color="var(--app-warning)" icon={<AlertTriangle size={14} />} />
                )}

                {isProfileMode && p.overrideCount > 0 && (
                    <KpiTile label="Overrides" value={String(p.overrideCount)}
                        color="var(--app-primary)" icon={<Zap size={14} />} />
                )}

                {c._user_role && (
                    <KpiTile label="Role" value={c._user_role}
                        color={c._user_role === 'admin' ? 'var(--app-success, #22c55e)' : c._user_role === 'editor' ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)'}
                        icon={<Eye size={14} />} />
                )}
            </div>

            {/* ═══ Action Toolbar ═══ */}
            <div className="flex items-center gap-2 flex-wrap mb-4 px-1">
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 mr-2">
                    <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Presets</span>
                    {Object.entries(QUICK_PRESETS).map(([key, preset]) => (
                        <button key={key} type="button" onClick={() => p.onApplyPreset(key)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all hover:shadow-sm"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                            title={`Apply ${preset.label} preset`}>
                            <span>{preset.icon}</span> {preset.label}
                        </button>
                    ))}
                </div>

                <div className="w-px h-5 bg-app-border/40 mx-1" />

                {/* Tools */}
                <ToolBtn icon={<Copy size={10} />} label="Share" onClick={p.onShareUrl} title="Copy shareable config URL" />
                <ToolBtn icon={<ClipboardPaste size={10} />} label="Paste" onClick={p.onClipboardImport} title="Import from clipboard" />
                <ToolBtn icon={<FileJson size={10} />} label="Export" onClick={p.onExportConfig} title="Export JSON" />
                <ToolBtn icon={<Printer size={10} />} label="Print" onClick={p.onPrint} title="Print configuration" />

                {p.suggestions.length > 0 && (
                    <button type="button" onClick={() => p.setShowSuggestions(!p.showSuggestions)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black transition-all"
                        style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)', color: 'var(--app-warning)' }}>
                        <Zap size={10} /> {p.suggestions.length} Tip{p.suggestions.length !== 1 ? 's' : ''}
                    </button>
                )}
                {p.hasChanges && (
                    <>
                        <ToolBtn icon={<Copy size={10} />} label="Changelog" onClick={p.onCopyChangelog} title="Copy changelog" />
                        <ToolBtn icon={<Eye size={10} />} label={`Diff (${p.diffEntriesCount})`} onClick={p.onShowDiff} title="View diff" highlight />
                    </>
                )}
                <ToolBtn icon={<History size={10} />} label="History" onClick={p.onShowHistory} title="Version history">
                    {c._version_count && c._version_count > 0 && (
                        <span className="text-[7px] px-1 rounded font-black ml-0.5" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>{c._version_count}</span>
                    )}
                </ToolBtn>
                <ToolBtn icon={<Download size={10} />} label="Templates" onClick={p.onShowTemplates} title="Config templates" />

                <div className="w-px h-5 bg-app-border/40 mx-1" />

                <button type="button" onClick={p.onShowShortcuts}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-black text-app-muted-foreground hover:text-app-foreground transition-all"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                    title="Keyboard shortcuts (?)">?</button>

                <button type="button" onClick={() => p.setAllCollapsed(prev => !prev)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                    title={p.allCollapsed ? 'Expand all' : 'Collapse all'}>
                    {p.allCollapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                    {p.allCollapsed ? 'Expand' : 'Collapse'}
                </button>

                {/* Search Inputs — pushed to right */}
                <div className="flex items-center gap-2 ml-auto">
                    <div className="relative">
                        <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground/50 pointer-events-none" />
                        <input type="text" value={p.fieldSearch} onChange={e => p.setFieldSearch(e.target.value)}
                            placeholder="Filter fields…"
                            className="pl-7 pr-2 py-1 rounded-lg bg-app-bg border border-app-border/40 text-[10px] font-bold text-app-foreground placeholder:text-app-muted-foreground/40 w-28 focus:w-36 transition-all focus:outline-none focus:ring-1 focus:ring-app-primary/20 focus:border-app-primary" />
                    </div>
                    <div className="relative">
                        <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground/50 pointer-events-none" />
                        <input type="text" placeholder="Filter sections…"
                            value={p.configSearch} onChange={e => p.setConfigSearch(e.target.value)}
                            className="pl-7 pr-2 py-1 rounded-lg bg-app-bg border border-app-border/40 text-[10px] font-bold text-app-foreground placeholder:text-app-muted-foreground/40 w-32 focus:w-40 transition-all focus:outline-none focus:ring-1 focus:ring-app-primary/20 focus:border-app-primary" />
                    </div>
                </div>

                {p.draftSavedAt && (
                    <span className="text-[8px] text-app-muted-foreground/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-success, #22c55e)' }} /> Draft {p.draftSavedAt}
                    </span>
                )}
            </div>

            {/* Active Editors */}
            {c._active_editors && c._active_editors.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 animate-in fade-in duration-200"
                    style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 5%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)' }}>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--app-success, #22c55e)' }} />
                    <span className="text-[10px] font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>{c._active_editors.join(', ')} also viewing</span>
                </div>
            )}

            {c._user_role === 'viewer' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
                    style={{ background: 'color-mix(in srgb, var(--app-warning) 5%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)' }}>
                    <AlertTriangle size={12} style={{ color: 'var(--app-warning)' }} />
                    <span className="text-[10px] font-bold" style={{ color: 'var(--app-warning)' }}>Read-only mode — contact an admin to make changes</span>
                </div>
            )}

            {c._last_modified_by && (
                <div className="text-[9px] text-app-muted-foreground/60 mb-3 px-1">
                    Last modified by <span className="font-bold text-app-muted-foreground">{c._last_modified_by}</span>
                    {c._last_modified_at && <> · {new Date(c._last_modified_at).toLocaleDateString()} {new Date(c._last_modified_at).toLocaleTimeString()}</>}
                </div>
            )}
        </>
    )
}

/* ── KPI Tile ── */
function KpiTile({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>{icon}</div>
            <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground">{label}</div>
                <div className="text-base font-black text-app-foreground tabular-nums leading-none">{value}</div>
            </div>
        </div>
    )
}

/* ── Toolbar Button ── */
function ToolBtn({ icon, label, onClick, title, children, highlight }: {
    icon: React.ReactNode; label: string; onClick: () => void; title: string; children?: React.ReactNode; highlight?: boolean
}) {
    return (
        <button type="button" onClick={onClick} title={title}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all hover:shadow-sm"
            style={highlight ? {
                background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                color: 'var(--app-primary)',
            } : {
                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                color: 'var(--app-muted-foreground)',
            }}>
            {icon} {label}{children}
        </button>
    )
}
