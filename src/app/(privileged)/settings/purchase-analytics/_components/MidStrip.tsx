'use client'

import { useRef } from 'react'
import {
    AlertTriangle, X, Zap, ArrowLeft, RotateCcw, Undo2,
    Save, Loader2, CheckCircle2,
} from 'lucide-react'
import { PAGE_CONTEXT_LABELS } from '@/lib/analytics-constants'
import type { AnalyticsProfile } from '@/app/actions/settings/analytics-profiles'
import { card, fieldLabel, fieldInput, toggleBtn, CONFIG_PRESETS } from '../_lib/constants'

type Suggestion = { field: string; reason: string; current: any; suggested: any }
type Warning = { field: string; severity: 'warn' | 'danger'; message: string }

type Props = {
    isProfileMode: boolean
    isCreateMode: boolean
    isEditMode: boolean
    editingProfile: AnalyticsProfile | null
    creatingForContext: string | null
    overrideCount: number
    warnings: Warning[]
    showSuggestions: boolean
    setShowSuggestions: (v: boolean) => void
    suggestions: Suggestion[]
    onApplySuggestion: (field: string, suggested: any) => void
    onApplyConfigPreset: (preset: typeof CONFIG_PRESETS[number]) => void
    onImportProfileFile: (e: React.ChangeEvent<HTMLInputElement>) => void
    onBackToGlobal: () => void
    onUndo: () => void
    undoStackLength: number
    confirmResetAll: boolean
    setConfirmResetAll: (v: boolean) => void
    onResetAllOverrides: () => void
    isPending: boolean
    saved: boolean
    newProfileName: string
    setNewProfileName: (v: string) => void
    newProfileVisibility: 'organization' | 'personal'
    setNewProfileVisibility: (v: 'organization' | 'personal') => void
    onSaveActive: () => void
}

export function MidStrip(p: Props) {
    const importRef = useRef<HTMLInputElement>(null)

    return (
        <>
            {/* Mode Banner */}
            {p.isProfileMode && (
                <div className={`mb-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-2 ${
                    p.isCreateMode ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600' : 'bg-app-primary/5 border-app-primary/20 text-app-primary'
                }`}>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: p.isCreateMode ? '#10b981' : 'var(--app-primary)' }} />
                    {p.isCreateMode ? 'CREATE MODE' : 'EDIT MODE'}
                    <span className="text-app-muted-foreground font-normal ml-1">
                        {p.isCreateMode
                            ? `Creating new profile for ${PAGE_CONTEXT_LABELS[p.creatingForContext!]}`
                            : `Editing "${p.editingProfile?.name}" — ${p.overrideCount} override${p.overrideCount !== 1 ? 's' : ''}`}
                    </span>
                </div>
            )}

            {/* Warnings */}
            {p.warnings.length > 0 && (
                <div className="mb-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle size={11} className="text-amber-500" />
                        <span className="text-[10px] font-bold text-amber-600">{p.warnings.length} Configuration Warning{p.warnings.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-0.5">
                        {p.warnings.map((w, i) => (
                            <div key={i} className={`text-[9px] flex items-center gap-1.5 ${w.severity === 'danger' ? 'text-red-500' : 'text-amber-600'}`}>
                                <span className={`w-1 h-1 rounded-full ${w.severity === 'danger' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                {w.message}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Suggestions */}
            {p.showSuggestions && p.suggestions.length > 0 && (
                <div className="mb-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden">
                    <div className="px-3 py-2 border-b border-amber-500/10 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1"><Zap size={10} /> Optimization Suggestions</span>
                        <button type="button" onClick={() => p.setShowSuggestions(false)} className="text-amber-500 hover:text-amber-600"><X size={12} /></button>
                    </div>
                    <div className="px-3 py-2 space-y-1.5">
                        {p.suggestions.map((s, i) => (
                            <div key={i} className="flex items-center justify-between py-1 gap-3">
                                <div className="flex-1">
                                    <span className="text-[10px] font-bold text-app-foreground">{s.field.replace(/_/g, ' ')}</span>
                                    <span className="text-[9px] text-app-muted-foreground ml-1.5">— {s.reason}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-red-500/70 line-through">{JSON.stringify(s.current)}</span>
                                    <span className="text-[9px] text-app-muted-foreground">→</span>
                                    <span className="text-[9px] text-emerald-600 font-bold">{JSON.stringify(s.suggested)}</span>
                                    <button type="button" onClick={() => p.onApplySuggestion(s.field, s.suggested)}
                                        className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold hover:bg-emerald-500/20 transition-colors">Apply</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Presets row + Import */}
            <div className="mb-2 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-[9px] text-app-muted-foreground font-bold uppercase tracking-widest">
                    <Zap size={9} /> Quick Presets
                </div>
                {CONFIG_PRESETS.map(preset => (
                    <button key={preset.name} type="button" onClick={() => p.onApplyConfigPreset(preset)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:border-app-primary/30 hover:bg-app-primary/5 transition-all"
                        title={preset.desc}>
                        <span>{preset.icon}</span> {preset.name}
                    </button>
                ))}
                <input type="file" ref={importRef} accept=".json" className="hidden" onChange={p.onImportProfileFile} />
                <button type="button" onClick={() => importRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:border-app-primary/30 transition-all ml-auto">
                    Import Profile
                </button>
            </div>

            {/* Action row */}
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {p.isProfileMode && (
                        <button type="button" onClick={p.onBackToGlobal}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:border-app-primary/30 transition-all">
                            <ArrowLeft size={10} /> Back to Global
                        </button>
                    )}
                    {p.isEditMode && p.overrideCount > 0 && (p.confirmResetAll ? (
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-red-500 font-bold">Reset all?</span>
                            <button type="button" onClick={p.onResetAllOverrides}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white hover:bg-red-600 transition-colors">Yes</button>
                            <button type="button" onClick={() => p.setConfirmResetAll(false)}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-app-surface border border-app-border text-app-muted-foreground hover:text-app-foreground transition-colors">No</button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => p.setConfirmResetAll(true)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-red-500/70 hover:text-red-600 border border-red-500/20 hover:border-red-500/40 transition-all">
                            <RotateCcw size={9} /> Reset All
                        </button>
                    ))}
                    {p.undoStackLength > 0 && (
                        <button type="button" onClick={p.onUndo}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:border-app-primary/30 transition-all">
                            <Undo2 size={9} /> Undo <span className="text-[8px] px-1 rounded bg-app-background text-app-muted-foreground/60">{p.undoStackLength}</span>
                        </button>
                    )}
                </div>
                <button onClick={p.onSaveActive} disabled={p.isPending || (p.isCreateMode && !p.newProfileName.trim())}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 bg-app-primary text-white rounded-lg text-[11px] font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm shrink-0 ${p.saved ? 'ring-2 ring-emerald-400/50' : ''}`}>
                    {p.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : p.saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {p.saved ? 'Saved!' : p.isCreateMode ? 'Create Profile' : p.isEditMode ? 'Save Profile' : 'Save Configuration'}
                </button>
            </div>

            {/* Create-mode form */}
            {p.isCreateMode && (
                <div className={`${card} mb-3`}>
                    <div className="px-3 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={fieldLabel}>Profile Name</label>
                            <input type="text" className={fieldInput} value={p.newProfileName}
                                onChange={e => p.setNewProfileName(e.target.value)} placeholder="e.g., My Wholesale Analysis" autoFocus />
                        </div>
                        <div>
                            <label className={fieldLabel}>Visibility</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => p.setNewProfileVisibility('organization')}
                                    className={toggleBtn(p.newProfileVisibility === 'organization')}>Organization</button>
                                <button type="button" onClick={() => p.setNewProfileVisibility('personal')}
                                    className={toggleBtn(p.newProfileVisibility === 'personal')}>Personal</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
