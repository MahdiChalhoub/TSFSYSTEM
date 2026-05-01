'use client'

import { toast } from 'sonner'
import { savePurchaseAnalyticsConfig, getConfigHistory } from '@/app/actions/settings/purchase-analytics-config'
import type { PurchaseAnalyticsConfig, ConfigHistoryEntry } from '@/app/actions/settings/purchase-analytics-config'
import {
    getAnalyticsProfiles, updateProfile, createProfile,
} from '@/app/actions/settings/analytics-profiles'
import { PAGE_CONTEXT_LABELS } from '@/lib/analytics-constants'
import type { AnalyticsProfile, AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles'
import { QUICK_PRESETS } from '../_lib/constants'

type Args = {
    config: PurchaseAnalyticsConfig | null
    setConfig: React.Dispatch<React.SetStateAction<PurchaseAnalyticsConfig | null>>
    originalConfig: PurchaseAnalyticsConfig | null
    setOriginalConfig: React.Dispatch<React.SetStateAction<PurchaseAnalyticsConfig | null>>
    profilesData: AnalyticsProfilesData | null
    setProfilesData: React.Dispatch<React.SetStateAction<AnalyticsProfilesData | null>>
    editingProfile: AnalyticsProfile | null
    setEditingProfile: React.Dispatch<React.SetStateAction<AnalyticsProfile | null>>
    profileOverrides: Record<string, unknown>
    setProfileOverrides: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
    creatingForContext: string | null
    setCreatingForContext: React.Dispatch<React.SetStateAction<string | null>>
    newProfileName: string
    setNewProfileName: React.Dispatch<React.SetStateAction<string>>
    newProfileVisibility: 'organization' | 'personal'
    setNewProfileVisibility: React.Dispatch<React.SetStateAction<'organization' | 'personal'>>
    setCompareProfiles: React.Dispatch<React.SetStateAction<[AnalyticsProfile, AnalyticsProfile] | null>>
    setHistoryData: React.Dispatch<React.SetStateAction<ConfigHistoryEntry[]>>
    setShowHistory: React.Dispatch<React.SetStateAction<boolean>>
    setSaved: React.Dispatch<React.SetStateAction<boolean>>
    setLastSavedAt: React.Dispatch<React.SetStateAction<Date | null>>
    undoStack: Array<{ key: string; prev: unknown; configSnapshot?: PurchaseAnalyticsConfig }>
    setUndoStack: React.Dispatch<React.SetStateAction<Array<{ key: string; prev: unknown; configSnapshot?: PurchaseAnalyticsConfig }>>>
    isCreateMode: boolean
    isEditMode: boolean
    update: (key: keyof PurchaseAnalyticsConfig, value: unknown) => void
    startTransition: React.TransitionStartFunction
}

export function paHandlers(a: Args) {
    const reloadProfiles = async () => a.setProfilesData(await getAnalyticsProfiles())

    const handleSave = () => {
        if (!a.config) return
        a.startTransition(async () => {
            const r = await savePurchaseAnalyticsConfig(a.config!)
            if (r.success) { a.setSaved(true); a.setLastSavedAt(new Date()); setTimeout(() => a.setSaved(false), 3000) }
        })
    }

    const handleUndo = () => {
        if (a.undoStack.length === 0) return
        const last = a.undoStack[a.undoStack.length - 1]
        a.setUndoStack(prev => prev.slice(0, -1))
        if (a.editingProfile) {
            if (last.prev === undefined) a.setProfileOverrides(prev => { const n = { ...prev }; delete n[last.key]; return n })
            else a.setProfileOverrides(prev => ({ ...prev, [last.key]: last.prev }))
        } else if (a.config) a.setConfig(prev => prev ? { ...prev, [last.key]: last.prev } : prev)
    }

    const handleSelectProfile = (profile: AnalyticsProfile) => {
        a.setEditingProfile(profile)
        const draft = (() => {
            const d = localStorage.getItem(`pa_draft_${profile.id}`)
            try { return d ? JSON.parse(d) : null } catch { return null }
        })()
        a.setProfileOverrides(draft || profile.overrides || {})
        a.setSaved(false)
    }

    const handleBackToGlobal = () => {
        if (a.editingProfile) localStorage.removeItem(`pa_draft_${a.editingProfile.id}`)
        a.setEditingProfile(null); a.setProfileOverrides({}); a.setCreatingForContext(null)
        a.setNewProfileName(''); a.setSaved(false)
    }

    const handleStartCreate = (ctx: string) => {
        a.setEditingProfile(null); a.setCreatingForContext(ctx); a.setProfileOverrides({})
        a.setNewProfileName(''); a.setNewProfileVisibility('organization'); a.setSaved(false)
    }

    const handleDuplicate = (profile: AnalyticsProfile) => {
        a.setEditingProfile(null); a.setCreatingForContext(profile.page_context)
        a.setProfileOverrides({ ...profile.overrides })
        a.setNewProfileName(`${profile.name} (Copy)`); a.setNewProfileVisibility('organization'); a.setSaved(false)
    }

    const handleExport = (profile: AnalyticsProfile) => {
        const data = { name: profile.name, page_context: profile.page_context, overrides: profile.overrides, exported_at: new Date().toISOString() }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const aEl = document.createElement('a'); aEl.href = url; aEl.download = `profile_${profile.name.replace(/\s+/g, '_').toLowerCase()}.json`; aEl.click()
        URL.revokeObjectURL(url)
    }

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return
        try {
            const data = JSON.parse(await file.text())
            if (data.name && data.overrides) {
                a.setEditingProfile(null); a.setCreatingForContext(data.page_context || Object.keys(PAGE_CONTEXT_LABELS)[0])
                a.setProfileOverrides(data.overrides); a.setNewProfileName(data.name + ' (Imported)'); a.setNewProfileVisibility('organization')
            }
        } catch { alert('Invalid JSON file') }
        e.target.value = ''
    }

    const handleCompare = (profile: AnalyticsProfile) => {
        const all = a.profilesData?.profiles?.filter(p => p.page_context === profile.page_context) || []
        if (all.length >= 2) a.setCompareProfiles([all[0], all[1]])
    }

    const applyPreset = (key: string) => {
        const preset = QUICK_PRESETS[key]
        if (!preset || !a.config) return
        a.setConfig(prev => prev ? { ...prev, ...preset.values } : prev)
        toast.success(`Applied "${preset.label}" preset`)
    }

    const handleClipboardImport = async () => {
        try {
            const parsed = JSON.parse(await navigator.clipboard.readText()) as Record<string, unknown> | null
            if (parsed && typeof parsed === 'object' && parsed.sales_avg_period_days !== undefined) {
                Object.entries(parsed).forEach(([k, v]) => { if (!k.startsWith('_')) a.update(k as keyof PurchaseAnalyticsConfig, v) })
            }
        } catch {}
    }

    const handleShareUrl = () => {
        if (!a.config) return
        const { _last_modified_by, _last_modified_at, _version_count, _user_role, _restricted_fields, _active_editors, ...clean } = a.config as unknown as Record<string, unknown>
        const encoded = btoa(JSON.stringify(clean))
        navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#config=${encoded}`)
        a.setSaved(true); setTimeout(() => a.setSaved(false), 2000)
    }

    const handleExportConfig = () => {
        if (!a.config) return
        const blob = new Blob([JSON.stringify(a.config, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const aEl = document.createElement('a'); aEl.href = url; aEl.download = `purchase-analytics-config-${new Date().toISOString().slice(0,10)}.json`; aEl.click()
        URL.revokeObjectURL(url)
    }

    const generateChangelog = () => {
        if (!a.config || !a.originalConfig) return ''
        const changes: string[] = []
        const orig = a.originalConfig as unknown as Record<string, unknown>
        const cur = a.config as unknown as Record<string, unknown>
        Object.keys(a.config).forEach(k => {
            if (k.startsWith('_')) return
            if (JSON.stringify(orig[k]) !== JSON.stringify(cur[k])) {
                changes.push(`- **${k.replace(/_/g, ' ')}**: ${JSON.stringify(orig[k])} → ${JSON.stringify(cur[k])}`)
            }
        })
        if (changes.length === 0) return 'No unsaved changes.'
        return `## Purchase Analytics Config Changes\n\n${changes.join('\n')}\n\n_Generated ${new Date().toLocaleString()}_`
    }

    const handleSaveActive = () => {
        if (a.isCreateMode) {
            if (!a.newProfileName.trim()) return
            a.startTransition(async () => {
                await createProfile(a.newProfileName, a.creatingForContext!, a.profileOverrides, a.newProfileVisibility)
                await reloadProfiles(); handleBackToGlobal()
                a.setSaved(true); a.setLastSavedAt(new Date()); setTimeout(() => a.setSaved(false), 3000)
            })
        } else if (a.editingProfile) {
            a.startTransition(async () => {
                await updateProfile(a.editingProfile!.id, { overrides: a.profileOverrides })
                localStorage.removeItem(`pa_draft_${a.editingProfile!.id}`)
                await reloadProfiles()
                a.setSaved(true); a.setLastSavedAt(new Date()); setTimeout(() => a.setSaved(false), 3000)
            })
        } else handleSave()
    }

    const handleShowHistory = async () => {
        const d = await getConfigHistory()
        a.setHistoryData(d.history); a.setShowHistory(true)
    }

    const handleCopyChangelog = () => {
        navigator.clipboard.writeText(generateChangelog())
        a.setSaved(true); setTimeout(() => a.setSaved(false), 2000)
    }

    return {
        reloadProfiles, handleSave, handleUndo,
        handleSelectProfile, handleBackToGlobal, handleStartCreate, handleDuplicate,
        handleExport, handleImport, handleCompare, applyPreset,
        handleClipboardImport, handleShareUrl, handleExportConfig,
        generateChangelog, handleSaveActive, handleShowHistory, handleCopyChangelog,
    }
}
