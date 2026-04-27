'use client'
import { toast } from 'sonner'
import { useState, useEffect, useTransition, useCallback } from 'react'
import {
    getPurchaseAnalyticsConfig, savePurchaseAnalyticsConfig, getConfigHistory,
} from '@/app/actions/settings/purchase-analytics-config'
import type { PurchaseAnalyticsConfig, ConfigHistoryEntry } from '@/app/actions/settings/purchase-analytics-config'
import {
    getAnalyticsProfiles, updateProfile, createProfile,
} from '@/app/actions/settings/analytics-profiles'
import { PAGE_CONTEXT_LABELS } from '@/lib/analytics-constants'
import type { AnalyticsProfile, AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles'

import { pageWrap, QUICK_PRESETS, SECTION_DEFAULTS, DEFAULTS } from './_lib/constants'
import {
    computeConfigScore, computeScoreBreakdown, computeCompleteness, computeSuggestions, computeWarnings,
} from './_lib/validation'

import { CompareModal } from './_components/CompareModal'
import { HistoryModal } from './_components/HistoryModal'
import { DiffModal } from './_components/DiffModal'
import { DiffPreviewModal } from './_components/DiffPreviewModal'
import { ShortcutOverlay } from './_components/ShortcutOverlay'
import { TemplateManager } from './_components/TemplateManager'
import { HeaderBar } from './_components/HeaderBar'
import { SectionNav, type SectionId } from './_components/SectionNav'
import { InspectorStrip } from './_components/InspectorStrip'
import { StickyBottomBar } from './_components/StickyBottomBar'
import { MidStrip } from './_components/MidStrip'
import { PASettingsProvider, type PASettingsContextValue } from './_hooks/PASettingsContext'
import { ProfilesSection } from './_components/sections/ProfilesSection'
import { SalesSection } from './_components/sections/SalesSection'
import { QuantitySection } from './_components/sections/QuantitySection'
import { PricingSection } from './_components/sections/PricingSection'
import { ScoringSection } from './_components/sections/ScoringSection'
import { FlowSection } from './_components/sections/FlowSection'
import { LoadingSkeleton } from './_components/LoadingSkeleton'

export default function PurchaseAnalyticsSettingsPage() {
    // ── Core state ──
    const [config, setConfig] = useState<PurchaseAnalyticsConfig | null>(null)
    const [profilesData, setProfilesData] = useState<AnalyticsProfilesData | null>(null)
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [saved, setSaved] = useState(false)
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
    const [editingProfile, setEditingProfile] = useState<AnalyticsProfile | null>(null)
    const [profileOverrides, setProfileOverrides] = useState<Record<string, any>>({})
    const [creatingForContext, setCreatingForContext] = useState<string | null>(null)
    const [newProfileName, setNewProfileName] = useState('')
    const [newProfileVisibility, setNewProfileVisibility] = useState<'organization' | 'personal'>('organization')
    const [compareProfiles, setCompareProfiles] = useState<[AnalyticsProfile, AnalyticsProfile] | null>(null)
    const importRef = useRef<HTMLInputElement>(null)
    const [activeSection, setActiveSection] = useState<SectionId>('profiles')
    const [allCollapsed, setAllCollapsed] = useState(false)
    const [configSearch, setConfigSearch] = useState('')
    const [confirmResetAll, setConfirmResetAll] = useState(false)
    const [undoStack, setUndoStack] = useState<Array<{ key: string; prev: any; configSnapshot?: PurchaseAnalyticsConfig }>>([])
    const [scrolled, setScrolled] = useState(false)
    const [showDiffPreview, setShowDiffPreview] = useState(false)
    const [originalConfig, setOriginalConfig] = useState<PurchaseAnalyticsConfig | null>(null)
    const [showHistory, setShowHistory] = useState(false)
    const [historyData, setHistoryData] = useState<ConfigHistoryEntry[]>([])
    const [pageOrder, setPageOrder] = useState<string[]>(Object.keys(PAGE_CONTEXT_LABELS))
    const [showShortcuts, setShowShortcuts] = useState(false)
    const [showTemplates, setShowTemplates] = useState(false)
    const [fieldSearch, setFieldSearch] = useState('')
    const [lockedFields, setLockedFields] = useState<Set<string>>(new Set())
    const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [showDiff, setShowDiff] = useState(false)
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)

    // ── Mode flags ──
    const isEditMode = !!editingProfile
    const isCreateMode = !!creatingForContext
    const isProfileMode = isEditMode || isCreateMode
    const overrideCount = Object.keys(profileOverrides).length

    // ── Derived ──
    const completenessScore = config ? computeCompleteness(config) : 0
    const configScore = config ? computeConfigScore(config) : 100
    const scoreBreakdown = config ? computeScoreBreakdown(config) : []
    const hasChanges = !!(config && originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig))

    // ── Field accessors ──
    const val = (key: string) => {
        if ((editingProfile || creatingForContext) && key in profileOverrides) return profileOverrides[key]
        return (config as any)?.[key]
    }
    const valWeight = (key: string) => {
        if ((editingProfile || creatingForContext) && profileOverrides.financial_score_weights) {
            return profileOverrides.financial_score_weights[key] ?? (config?.financial_score_weights as any)?.[key]
        }
        return (config?.financial_score_weights as any)?.[key]
    }
    const globalVal = (key: string) => (config as any)?.[key]
    const globalWeight = (key: string) => (config?.financial_score_weights as any)?.[key]
    const isOverridden = (key: string) => (editingProfile || creatingForContext) ? key in profileOverrides : false

    const isFieldRestricted = (key: string) => (config?._restricted_fields || []).includes(key)

    const update = (key: keyof PurchaseAnalyticsConfig, value: any) => {
        if (isFieldRestricted(key as string)) return
        if (editingProfile) {
            const prevVal = profileOverrides[key as string]
            setUndoStack(prev => [...prev.slice(-19), { key: key as string, prev: prevVal }])
            setProfileOverrides(prev => ({ ...prev, [key]: value }))
            return
        }
        if (!config) return
        setUndoStack(prev => [...prev.slice(-19), { key: key as string, prev: config[key], configSnapshot: config }])
        setConfig({ ...config, [key]: value })
    }
    const updateWeight = (key: string, value: number) => {
        if (editingProfile) {
            const weights = profileOverrides.financial_score_weights || config?.financial_score_weights || {}
            setProfileOverrides(prev => ({ ...prev, financial_score_weights: { ...weights, [key]: value } }))
            return
        }
        if (!config) return
        setConfig({ ...config, financial_score_weights: { ...config.financial_score_weights, [key]: value } })
    }
    const clearOverride = (key: string) => {
        const next = { ...profileOverrides }
        delete next[key]
        setProfileOverrides(next)
    }
    const clearWeightOverride = () => {
        const next = { ...profileOverrides }
        delete next['financial_score_weights']
        setProfileOverrides(next)
    }
    const resetSection = (section: string) => {
        const defaults = SECTION_DEFAULTS[section]
        if (!defaults || !config) return
        Object.entries(defaults).forEach(([k, v]) => update(k as any, v))
    }
    const toggleFieldLock = (field: string) => {
        setLockedFields(prev => {
            const next = new Set(prev)
            next.has(field) ? next.delete(field) : next.add(field)
            return next
        })
    }

    const warnings = computeWarnings(val, valWeight)
    const getWarning = (field: string) => warnings.find(w => w.field === field)
    const suggestions = config ? computeSuggestions(config, val, valWeight) : []
    const cardVisible = (keywords: string) => !configSearch || keywords.toLowerCase().includes(configSearch.toLowerCase())
    const defaultHint = (field: string, currentVal: any) => {
        const def = DEFAULTS[field]
        if (def === undefined || JSON.stringify(def) === JSON.stringify(currentVal)) return null
        return <span className="text-[8px] text-app-muted-foreground/50 ml-1">(default: {String(def)})</span>
    }
    const weightTotal = (valWeight('margin') || 0) + (valWeight('velocity') || 0) + (valWeight('stock_health') || 0)

    const diffEntries = (() => {
        if (!config || !originalConfig) return []
        return Object.keys(config)
            .filter(k => !k.startsWith('_'))
            .map(k => ({
                field: k, oldVal: (originalConfig as any)[k], newVal: (config as any)[k],
                changed: JSON.stringify((originalConfig as any)[k]) !== JSON.stringify((config as any)[k]),
            }))
            .filter(e => e.changed)
    })()

    // ── Handlers ──
    const reloadProfiles = async () => setProfilesData(await getAnalyticsProfiles())
    const handleSave = useCallback(() => {
        if (!config) return
        startTransition(async () => {
            const r = await savePurchaseAnalyticsConfig(config)
            if (r.success) { setSaved(true); setLastSavedAt(new Date()); setTimeout(() => setSaved(false), 3000) }
        })
    }, [config])
    const handleUndo = () => {
        if (undoStack.length === 0) return
        const last = undoStack[undoStack.length - 1]
        setUndoStack(prev => prev.slice(0, -1))
        if (editingProfile) {
            if (last.prev === undefined) setProfileOverrides(prev => { const n = { ...prev }; delete n[last.key]; return n })
            else setProfileOverrides(prev => ({ ...prev, [last.key]: last.prev }))
        } else if (config) setConfig({ ...config, [last.key]: last.prev })
    }
    const handleSelectProfile = (profile: AnalyticsProfile) => {
        setEditingProfile(profile)
        const draft = (() => {
            const d = localStorage.getItem(`pa_draft_${profile.id}`)
            try { return d ? JSON.parse(d) : null } catch { return null }
        })()
        setProfileOverrides(draft || profile.overrides || {})
        setSaved(false)
    }
    const handleBackToGlobal = () => {
        if (editingProfile) localStorage.removeItem(`pa_draft_${editingProfile.id}`)
        setEditingProfile(null); setProfileOverrides({}); setCreatingForContext(null); setNewProfileName(''); setSaved(false)
    }
    const handleStartCreate = (ctx: string) => {
        setEditingProfile(null); setCreatingForContext(ctx); setProfileOverrides({})
        setNewProfileName(''); setNewProfileVisibility('organization'); setSaved(false)
    }
    const handleDuplicate = (profile: AnalyticsProfile) => {
        setEditingProfile(null); setCreatingForContext(profile.page_context)
        setProfileOverrides({ ...profile.overrides })
        setNewProfileName(`${profile.name} (Copy)`); setNewProfileVisibility('organization'); setSaved(false)
    }
    const handleExport = (profile: AnalyticsProfile) => {
        const data = { name: profile.name, page_context: profile.page_context, overrides: profile.overrides, exported_at: new Date().toISOString() }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `profile_${profile.name.replace(/\s+/g, '_').toLowerCase()}.json`; a.click()
        URL.revokeObjectURL(url)
    }
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return
        try {
            const data = JSON.parse(await file.text())
            if (data.name && data.overrides) {
                setEditingProfile(null); setCreatingForContext(data.page_context || Object.keys(PAGE_CONTEXT_LABELS)[0])
                setProfileOverrides(data.overrides); setNewProfileName(data.name + ' (Imported)'); setNewProfileVisibility('organization')
            }
        } catch { alert('Invalid JSON file') }
        e.target.value = ''
    }
    const handleCompare = (profile: AnalyticsProfile) => {
        const all = profilesData?.profiles?.filter(p => p.page_context === profile.page_context) || []
        if (all.length >= 2) setCompareProfiles([all[0], all[1]])
    }
    const applyPreset = (key: string) => {
        const preset = QUICK_PRESETS[key]
        if (!preset || !config) return
        setConfig(prev => prev ? { ...prev, ...preset.values } : prev)
        toast.success(`Applied "${preset.label}" preset`)
    }
    const handleClipboardImport = async () => {
        try {
            const parsed = JSON.parse(await navigator.clipboard.readText())
            if (typeof parsed === 'object' && parsed.sales_avg_period_days !== undefined) {
                Object.entries(parsed).forEach(([k, v]) => { if (!k.startsWith('_')) update(k as any, v) })
            }
        } catch {}
    }
    const handleShareUrl = () => {
        if (!config) return
        const { _last_modified_by, _last_modified_at, _version_count, _user_role, _restricted_fields, _active_editors, ...clean } = config as any
        const encoded = btoa(JSON.stringify(clean))
        navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#config=${encoded}`)
        setSaved(true); setTimeout(() => setSaved(false), 2000)
    }
    const handleExportConfig = () => {
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `purchase-analytics-config-${new Date().toISOString().slice(0,10)}.json`; a.click()
        URL.revokeObjectURL(url)
    }
    const generateChangelog = () => {
        if (!config || !originalConfig) return ''
        const changes: string[] = []
        Object.keys(config).forEach(k => {
            if (k.startsWith('_')) return
            if (JSON.stringify((originalConfig as any)[k]) !== JSON.stringify((config as any)[k])) {
                changes.push(`- **${k.replace(/_/g, ' ')}**: ${JSON.stringify((originalConfig as any)[k])} → ${JSON.stringify((config as any)[k])}`)
            }
        })
        if (changes.length === 0) return 'No unsaved changes.'
        return `## Purchase Analytics Config Changes\n\n${changes.join('\n')}\n\n_Generated ${new Date().toLocaleString()}_`
    }
    const handleSaveActive = () => {
        if (isCreateMode) {
            if (!newProfileName.trim()) return
            startTransition(async () => {
                await createProfile(newProfileName, creatingForContext!, profileOverrides, newProfileVisibility)
                await reloadProfiles(); handleBackToGlobal()
                setSaved(true); setLastSavedAt(new Date()); setTimeout(() => setSaved(false), 3000)
            })
        } else if (editingProfile) {
            startTransition(async () => {
                await updateProfile(editingProfile.id, { overrides: profileOverrides })
                localStorage.removeItem(`pa_draft_${editingProfile.id}`)
                await reloadProfiles()
                setSaved(true); setLastSavedAt(new Date()); setTimeout(() => setSaved(false), 3000)
            })
        } else handleSave()
    }

    // ── Effects ──
    useEffect(() => {
        (async () => {
            const [cfg, prof] = await Promise.all([getPurchaseAnalyticsConfig(), getAnalyticsProfiles()])
            setConfig(cfg); setOriginalConfig(JSON.parse(JSON.stringify(cfg))); setProfilesData(prof); setLoading(false)
        })()
        const onScroll = () => setScrolled(window.scrollY > 300)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])
    useEffect(() => {
        if (editingProfile && Object.keys(profileOverrides).length > 0) {
            localStorage.setItem(`pa_draft_${editingProfile.id}`, JSON.stringify(profileOverrides))
        }
    }, [profileOverrides, editingProfile])
    useEffect(() => {
        if (!config || !hasChanges) return
        const t = setInterval(() => {
            localStorage.setItem('pa_draft_autosave', JSON.stringify(config))
            setDraftSavedAt(new Date().toLocaleTimeString())
        }, 30000)
        return () => clearInterval(t)
    }, [config, hasChanges])
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isProfileMode) handleBackToGlobal()
            if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSaveActive() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); handleUndo() }
            if (e.key === '?' && !e.ctrlKey && !e.metaKey && !(e.target as any)?.closest?.('input,select,textarea')) {
                e.preventDefault(); setShowShortcuts(prev => !prev)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isProfileMode, isCreateMode, editingProfile, profileOverrides, config, undoStack])

    if (loading || !config) return <LoadingSkeleton />

    const ctx: PASettingsContextValue = {
        config, profilesData, editingProfile, creatingForContext, profileOverrides,
        isProfileMode, isEditMode, isCreateMode, overrideCount, weightTotal,
        val, valWeight, globalVal, globalWeight, isOverridden,
        update, updateWeight, clearOverride, clearWeightOverride, resetSection,
        getWarning, defaultHint, lockedFields, toggleFieldLock,
        configSearch, cardVisible,
    }

    return (
        <PASettingsProvider value={ctx}>
            <div className={pageWrap}>
                <HeaderBar
                    config={config} profilesData={profilesData}
                    editingProfile={editingProfile} creatingForContext={creatingForContext}
                    isProfileMode={isProfileMode} overrideCount={overrideCount}
                    lastSavedAt={lastSavedAt} saved={saved} isPending={isPending}
                    hasChanges={hasChanges} diffEntriesCount={diffEntries.length}
                    configScore={configScore} scoreBreakdown={scoreBreakdown}
                    showScoreBreakdown={showScoreBreakdown} setShowScoreBreakdown={setShowScoreBreakdown}
                    completenessScore={completenessScore}
                    warnings={warnings} suggestions={suggestions}
                    showSuggestions={showSuggestions} setShowSuggestions={setShowSuggestions}
                    draftSavedAt={draftSavedAt}
                    fieldSearch={fieldSearch} setFieldSearch={setFieldSearch}
                    configSearch={configSearch} setConfigSearch={setConfigSearch}
                    allCollapsed={allCollapsed} setAllCollapsed={setAllCollapsed}
                    onSave={handleSaveActive} onShareUrl={handleShareUrl}
                    onClipboardImport={handleClipboardImport} onExportConfig={handleExportConfig}
                    onPrint={() => window.print()}
                    onCopyChangelog={() => { navigator.clipboard.writeText(generateChangelog()); setSaved(true); setTimeout(() => setSaved(false), 2000) }}
                    onShowDiff={() => setShowDiff(true)}
                    onShowHistory={async () => { const d = await getConfigHistory(); setHistoryData(d.history); setShowHistory(true) }}
                    onShowTemplates={() => setShowTemplates(true)}
                    onShowShortcuts={() => setShowShortcuts(true)}
                    onApplyPreset={applyPreset}
                    onBack={handleBackToGlobal}
                />

                <MidStrip
                    isProfileMode={isProfileMode} isCreateMode={isCreateMode} isEditMode={isEditMode}
                    editingProfile={editingProfile} creatingForContext={creatingForContext}
                    overrideCount={overrideCount}
                    warnings={warnings}
                    showSuggestions={showSuggestions} setShowSuggestions={setShowSuggestions}
                    suggestions={suggestions}
                    onApplySuggestion={(field, sug) => update(field as any, sug)}
                    onApplyConfigPreset={(preset) => Object.entries(preset.values).forEach(([k, v]) => update(k as any, v))}
                    onImportProfileFile={handleImport}
                    onBackToGlobal={handleBackToGlobal}
                    onUndo={handleUndo} undoStackLength={undoStack.length}
                    confirmResetAll={confirmResetAll} setConfirmResetAll={setConfirmResetAll}
                    onResetAllOverrides={() => { setProfileOverrides({}); setConfirmResetAll(false) }}
                    isPending={isPending} saved={saved}
                    newProfileName={newProfileName} setNewProfileName={setNewProfileName}
                    newProfileVisibility={newProfileVisibility} setNewProfileVisibility={setNewProfileVisibility}
                    onSaveActive={handleSaveActive}
                />


                {/* ═══ TWO-PANE LAYOUT ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 items-start">
                    <aside className="lg:sticky lg:top-2">
                        <SectionNav
                            active={activeSection} onSelect={setActiveSection}
                            cardVisible={cardVisible}
                        />
                    </aside>
                    <main className="min-w-0">
                        {activeSection === 'profiles' && (
                            <ProfilesSection
                                profilesData={profilesData} pageOrder={pageOrder} setPageOrder={setPageOrder}
                                editingProfile={editingProfile} creatingForContext={creatingForContext}
                                onReload={reloadProfiles} onSelect={handleSelectProfile} onCreate={handleStartCreate}
                                onDuplicate={handleDuplicate} onExport={handleExport} onCompare={handleCompare}
                            />
                        )}
                        {activeSection === 'sales' && <SalesSection />}
                        {activeSection === 'quantity' && <QuantitySection />}
                        {activeSection === 'pricing' && <PricingSection />}
                        {activeSection === 'scoring' && <ScoringSection />}
                        {activeSection === 'flow' && <FlowSection />}

                        <InspectorStrip configScore={configScore} scoreBreakdown={scoreBreakdown} isProfileMode={isProfileMode} />
                    </main>
                </div>

                {/* Modals */}
                {compareProfiles && <CompareModal profiles={compareProfiles} config={config} onClose={() => setCompareProfiles(null)} />}
                {showDiffPreview && originalConfig && <DiffPreviewModal config={config} originalConfig={originalConfig} onClose={() => setShowDiffPreview(false)} onSave={handleSave} />}
                {showHistory && (
                    <HistoryModal historyData={historyData} onClose={() => setShowHistory(false)}
                        onRestore={(cfg) => {
                            setConfig(cfg); setOriginalConfig(JSON.parse(JSON.stringify(cfg))); setShowHistory(false)
                            setSaved(true); setLastSavedAt(new Date()); setTimeout(() => setSaved(false), 3000)
                        }} />
                )}
                {showShortcuts && <ShortcutOverlay onClose={() => setShowShortcuts(false)} />}
                {showTemplates && (
                    <TemplateManager config={config} onClose={() => setShowTemplates(false)}
                        onLoad={(t) => setConfig(prev => prev ? { ...prev, ...t } : prev)} />
                )}
                {showDiff && <DiffModal entries={diffEntries} onClose={() => setShowDiff(false)} />}

                <StickyBottomBar
                    visible={scrolled}
                    label={isProfileMode ? `Editing: ${editingProfile?.name || 'New Profile'}` : 'Global Config'}
                    isPending={isPending} saved={saved}
                    showDiffBtn={!!(originalConfig && config && hasChanges && !isProfileMode)}
                    showUndoBtn={undoStack.length > 0}
                    onUndo={handleUndo}
                    onShowDiff={() => setShowDiffPreview(true)}
                    onSave={handleSaveActive}
                />

                {/* Print CSS + Flash animation */}
                <style>{`
                    @keyframes flashHighlight {
                        0% { background: rgba(var(--app-primary-rgb, 99, 102, 241), 0.15); }
                        100% { background: transparent; }
                    }
                    .field-flash { animation: flashHighlight 0.6s ease-out; }
                    @media print {
                        body > *:not([class*="pageWrap"]) { display: none !important; }
                        nav, button, [data-sidebar], [data-slot="sidebar"], [data-sticky-bar] { display: none !important; }
                        .animate-pulse, .animate-spin { animation: none !important; }
                        * { color: #000 !important; background: #fff !important; border-color: #ccc !important; box-shadow: none !important; }
                    }
                `}</style>
            </div>
        </PASettingsProvider>
    )
}
