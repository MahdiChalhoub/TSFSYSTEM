'use client'
import { toast } from 'sonner'
import { useState, useEffect, useTransition, useCallback } from 'react'
import {
    getPurchaseAnalyticsConfig, savePurchaseAnalyticsConfig, getConfigHistory,
} from '@/app/actions/settings/purchase-analytics-config'
import type { PurchaseAnalyticsConfig, ConfigHistoryEntry } from '@/app/actions/settings/purchase-analytics-config'
import { getAnalyticsProfiles } from '@/app/actions/settings/analytics-profiles'
import { PAGE_CONTEXT_LABELS } from '@/lib/analytics-constants'
import type { AnalyticsProfile, AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles'

import { pageWrap } from './_lib/constants'
import {
    computeConfigScore, computeScoreBreakdown, computeCompleteness,
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
import { paHandlers } from './_hooks/paHandlers'
import { paFields } from './_hooks/paFields'
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

    // After early return: config is non-null. Build helpers (regular functions, not React hooks).
    const {
        val, valWeight, globalVal, globalWeight, isOverridden,
        update, updateWeight, clearOverride, clearWeightOverride, resetSection, toggleFieldLock,
        warnings, getWarning, suggestions, cardVisible, defaultHint, weightTotal,
    } = paFields({
        config, setConfig, editingProfile, creatingForContext,
        profileOverrides, setProfileOverrides, setUndoStack,
        lockedFields, setLockedFields, configSearch,
    })

    const {
        reloadProfiles, handleSave, handleUndo, handleSelectProfile, handleBackToGlobal,
        handleStartCreate, handleDuplicate, handleExport, handleImport, handleCompare,
        applyPreset, handleClipboardImport, handleShareUrl, handleExportConfig,
        handleSaveActive, handleShowHistory, handleCopyChangelog,
    } = paHandlers({
        config, setConfig, originalConfig, setOriginalConfig,
        profilesData, setProfilesData,
        editingProfile, setEditingProfile,
        profileOverrides, setProfileOverrides,
        creatingForContext, setCreatingForContext,
        newProfileName, setNewProfileName,
        newProfileVisibility, setNewProfileVisibility,
        setCompareProfiles, setHistoryData, setShowHistory,
        setSaved, setLastSavedAt,
        undoStack, setUndoStack,
        isCreateMode, isEditMode,
        update, startTransition,
    })

    const diffEntries = Object.keys(config)
        .filter(k => !k.startsWith('_'))
        .map(k => ({
            field: k, oldVal: (originalConfig as any)?.[k], newVal: (config as any)[k],
            changed: JSON.stringify((originalConfig as any)?.[k]) !== JSON.stringify((config as any)[k]),
        }))
        .filter(e => e.changed)

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
                    onCopyChangelog={handleCopyChangelog}
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
