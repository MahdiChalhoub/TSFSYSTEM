'use client'

import { useRef } from 'react'
import {
    AlertTriangle, X, Zap, ArrowLeft, RotateCcw, Undo2,
    Save, Loader2, CheckCircle2, Upload,
} from 'lucide-react'
import { PAGE_CONTEXT_LABELS } from '@/lib/analytics-constants'
import type { AnalyticsProfile } from '@/app/actions/settings/analytics-profiles'
import { fieldLabel, fieldInput, toggleBtn, CONFIG_PRESETS } from '../_lib/constants'

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
            {/* Mode Banner — only in profile mode */}
            {p.isProfileMode && (
                <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-3 animate-in fade-in duration-200"
                    style={{
                        background: p.isCreateMode
                            ? 'color-mix(in srgb, var(--app-success, #22c55e) 5%, var(--app-surface))'
                            : 'color-mix(in srgb, var(--app-primary) 5%, var(--app-surface))',
                        border: `1px solid color-mix(in srgb, ${p.isCreateMode ? 'var(--app-success, #22c55e)' : 'var(--app-primary)'} 20%, transparent)`,
                    }}>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: p.isCreateMode ? 'var(--app-success, #22c55e)' : 'var(--app-primary)' }} />
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: p.isCreateMode ? 'var(--app-success, #22c55e)' : 'var(--app-primary)' }}>
                        {p.isCreateMode ? 'Create Mode' : 'Edit Mode'}
                    </span>
                    <span className="text-[10px] font-bold text-app-muted-foreground">
                        {p.isCreateMode
                            ? `New profile for ${PAGE_CONTEXT_LABELS[p.creatingForContext!]}`
                            : `"${p.editingProfile?.name}" — ${p.overrideCount} override${p.overrideCount !== 1 ? 's' : ''}`}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                        {p.isEditMode && p.overrideCount > 0 && (p.confirmResetAll ? (
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] font-black" style={{ color: 'var(--app-error, #ef4444)' }}>Reset all?</span>
                                <button type="button" onClick={p.onResetAllOverrides}
                                    className="px-2 py-0.5 rounded-lg text-[9px] font-black text-white" style={{ background: 'var(--app-error, #ef4444)' }}>Yes</button>
                                <button type="button" onClick={() => p.setConfirmResetAll(false)}
                                    className="px-2 py-0.5 rounded-lg text-[9px] font-bold text-app-muted-foreground"
                                    style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>No</button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => p.setConfirmResetAll(true)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all"
                                style={{ color: 'var(--app-error, #ef4444)', background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)' }}>
                                <RotateCcw size={9} /> Reset All
                            </button>
                        ))}
                        {p.undoStackLength > 0 && (
                            <button type="button" onClick={p.onUndo}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-app-muted-foreground transition-all"
                                style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                <Undo2 size={9} /> Undo ({p.undoStackLength})
                            </button>
                        )}
                        <button type="button" onClick={p.onBackToGlobal}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                            <ArrowLeft size={9} /> Back
                        </button>
                    </div>
                </div>
            )}

            {/* Warnings */}
            {p.warnings.length > 0 && (
                <div className="mb-3 px-4 py-2.5 rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--app-warning) 4%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                        <AlertTriangle size={12} style={{ color: 'var(--app-warning)' }} />
                        <span className="text-[10px] font-black" style={{ color: 'var(--app-warning)' }}>{p.warnings.length} Warning{p.warnings.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-1">
                        {p.warnings.map((w, i) => (
                            <div key={i} className="text-[9px] font-bold flex items-center gap-1.5"
                                style={{ color: w.severity === 'danger' ? 'var(--app-error, #ef4444)' : 'var(--app-warning)' }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: w.severity === 'danger' ? 'var(--app-error, #ef4444)' : 'var(--app-warning)' }} />
                                {w.message}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Suggestions */}
            {p.showSuggestions && p.suggestions.length > 0 && (
                <div className="mb-3 rounded-xl overflow-hidden"
                    style={{ background: 'color-mix(in srgb, var(--app-warning) 3%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)' }}>
                    <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-warning) 10%, transparent)' }}>
                        <span className="text-[10px] font-black flex items-center gap-1.5" style={{ color: 'var(--app-warning)' }}><Zap size={11} /> Optimization Tips</span>
                        <button type="button" onClick={() => p.setShowSuggestions(false)} style={{ color: 'var(--app-warning)' }}><X size={13} /></button>
                    </div>
                    <div className="px-4 py-2 space-y-2">
                        {p.suggestions.map((s, i) => (
                            <div key={i} className="flex items-center justify-between py-1 gap-3">
                                <div className="flex-1">
                                    <span className="text-[10px] font-black text-app-foreground">{s.field.replace(/_/g, ' ')}</span>
                                    <span className="text-[9px] font-bold text-app-muted-foreground ml-1.5">— {s.reason}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold line-through" style={{ color: 'var(--app-error, #ef4444)', opacity: 0.6 }}>{JSON.stringify(s.current)}</span>
                                    <span className="text-[9px] text-app-muted-foreground">→</span>
                                    <span className="text-[9px] font-black" style={{ color: 'var(--app-success, #22c55e)' }}>{JSON.stringify(s.suggested)}</span>
                                    <button type="button" onClick={() => p.onApplySuggestion(s.field, s.suggested)}
                                        className="text-[8px] font-black px-2 py-0.5 rounded-lg transition-all"
                                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>Apply</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Hidden file input for profile import */}
            <input type="file" ref={importRef} accept=".json" className="hidden" onChange={p.onImportProfileFile} />

            {/* Create-mode form */}
            {p.isCreateMode && (
                <div className="mb-3 rounded-xl px-4 py-4"
                    style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 3%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
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
                        <button onClick={p.onSaveActive} disabled={p.isPending || !p.newProfileName.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black text-white transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            {p.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Create Profile
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
