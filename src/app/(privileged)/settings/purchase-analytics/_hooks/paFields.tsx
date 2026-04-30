'use client'

import type { PurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'
import type { AnalyticsProfile } from '@/app/actions/settings/analytics-profiles'
import { SECTION_DEFAULTS, DEFAULTS } from '../_lib/constants'
import { computeWarnings, computeSuggestions } from '../_lib/validation'

type Args = {
    config: PurchaseAnalyticsConfig
    setConfig: React.Dispatch<React.SetStateAction<PurchaseAnalyticsConfig | null>>
    editingProfile: AnalyticsProfile | null
    creatingForContext: string | null
    profileOverrides: Record<string, any>
    setProfileOverrides: React.Dispatch<React.SetStateAction<Record<string, any>>>
    setUndoStack: React.Dispatch<React.SetStateAction<Array<{ key: string; prev: any; configSnapshot?: PurchaseAnalyticsConfig }>>>
    lockedFields: Set<string>
    setLockedFields: React.Dispatch<React.SetStateAction<Set<string>>>
    configSearch: string
}

export function paFields(a: Args) {
    const val = (key: string) => {
        if ((a.editingProfile || a.creatingForContext) && key in a.profileOverrides) return a.profileOverrides[key]
        return (a.config as any)?.[key]
    }
    const valWeight = (key: string) => {
        if ((a.editingProfile || a.creatingForContext) && a.profileOverrides.financial_score_weights) {
            return a.profileOverrides.financial_score_weights[key] ?? (a.config?.financial_score_weights as any)?.[key]
        }
        return (a.config?.financial_score_weights as any)?.[key]
    }
    const globalVal = (key: string) => (a.config as any)?.[key]
    const globalWeight = (key: string) => (a.config?.financial_score_weights as any)?.[key]
    const isOverridden = (key: string) => (a.editingProfile || a.creatingForContext) ? key in a.profileOverrides : false
    const isFieldRestricted = (key: string) => (a.config?._restricted_fields || []).includes(key)

    const update = (key: keyof PurchaseAnalyticsConfig, value: any) => {
        if (isFieldRestricted(key as string)) return
        if (a.editingProfile) {
            const prevVal = a.profileOverrides[key as string]
            a.setUndoStack(prev => [...prev.slice(-19), { key: key as string, prev: prevVal }])
            a.setProfileOverrides(prev => ({ ...prev, [key]: value }))
            return
        }
        if (!a.config) return
        a.setUndoStack(prev => [...prev.slice(-19), { key: key as string, prev: a.config[key], configSnapshot: a.config }])
        a.setConfig({ ...a.config, [key]: value })
    }
    const updateWeight = (key: string, value: number) => {
        if (a.editingProfile) {
            const weights = a.profileOverrides.financial_score_weights || a.config?.financial_score_weights || {}
            a.setProfileOverrides(prev => ({ ...prev, financial_score_weights: { ...weights, [key]: value } }))
            return
        }
        if (!a.config) return
        a.setConfig({ ...a.config, financial_score_weights: { ...a.config.financial_score_weights, [key]: value } })
    }
    const clearOverride = (key: string) => {
        const next = { ...a.profileOverrides }; delete next[key]; a.setProfileOverrides(next)
    }
    const clearWeightOverride = () => {
        const next = { ...a.profileOverrides }; delete next['financial_score_weights']; a.setProfileOverrides(next)
    }
    const resetSection = (section: string) => {
        const defaults = SECTION_DEFAULTS[section]
        if (!defaults || !a.config) return
        Object.entries(defaults).forEach(([k, v]) => update(k as any, v))
    }
    const toggleFieldLock = (field: string) => {
        a.setLockedFields(prev => {
            const next = new Set(prev)
            next.has(field) ? next.delete(field) : next.add(field)
            return next
        })
    }

    const warnings = computeWarnings(val, valWeight)
    const getWarning = (field: string) => warnings.find(w => w.field === field)
    const suggestions = a.config ? computeSuggestions(a.config, val, valWeight) : []
    const cardVisible = (keywords: string) => !a.configSearch || keywords.toLowerCase().includes(a.configSearch.toLowerCase())
    const defaultHint = (field: string, currentVal: any) => {
        const def = DEFAULTS[field]
        if (def === undefined || JSON.stringify(def) === JSON.stringify(currentVal)) return null
        return <span className="text-[8px] text-app-muted-foreground/50 ml-1">(default: {String(def)})</span>
    }
    const weightTotal = (valWeight('margin') || 0) + (valWeight('velocity') || 0) + (valWeight('stock_health') || 0)

    return {
        val, valWeight, globalVal, globalWeight, isOverridden,
        update, updateWeight, clearOverride, clearWeightOverride,
        resetSection, toggleFieldLock,
        warnings, getWarning, suggestions, cardVisible, defaultHint, weightTotal,
    }
}
