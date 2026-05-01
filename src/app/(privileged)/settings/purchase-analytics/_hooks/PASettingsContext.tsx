'use client'

import { createContext, useContext } from 'react'
import type { PurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'
import type { AnalyticsProfile, AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles'

export type Warning = { field: string; severity: 'warn' | 'danger'; message: string }

export type PASettingsContextValue = {
    // Read state
    config: PurchaseAnalyticsConfig
    profilesData: AnalyticsProfilesData | null
    editingProfile: AnalyticsProfile | null
    creatingForContext: string | null
    profileOverrides: Record<string, unknown>
    isProfileMode: boolean
    isEditMode: boolean
    isCreateMode: boolean
    overrideCount: number
    weightTotal: number

    // Field readers — return `any` because consumers feed these directly into
    // <input value={...} />, parseFloat, .toFixed, comparisons, etc. across
    // 6 section files. Narrowing to `unknown` here would require fixes at
    // ~40 call sites; deferred to a per-section pass.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    val: (key: string) => any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valWeight: (key: string) => any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalVal: (key: string) => any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalWeight: (key: string) => any
    isOverridden: (key: string) => boolean

    // Field mutators
    update: (key: keyof PurchaseAnalyticsConfig, value: unknown) => void
    updateWeight: (key: string, value: number) => void
    clearOverride: (key: string) => void
    clearWeightOverride: () => void
    resetSection: (section: string) => void

    // Validation / hints
    getWarning: (field: string) => Warning | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultHint: (field: string, currentVal: any) => React.ReactNode
    lockedFields: Set<string>
    toggleFieldLock: (field: string) => void

    // Search filter
    configSearch: string
    cardVisible: (keywords: string) => boolean
}

const PASettingsContext = createContext<PASettingsContextValue | null>(null)

export const PASettingsProvider = PASettingsContext.Provider

export function usePASettings(): PASettingsContextValue {
    const v = useContext(PASettingsContext)
    if (!v) throw new Error('usePASettings must be used within PASettingsProvider')
    return v
}
